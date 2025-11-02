/**
 * Impact Analyzer
 * Analyzes the impact of changes to entities in the knowledge graph
 * Uses existing dependency tracking to calculate blast radius
 */

import { KnowledgeGraph } from './KnowledgeGraph';
import { Entity, EntityType, RelationType } from './types';

export interface ImpactReport {
  targetEntity: Entity;
  operation: 'modify' | 'delete' | 'move';

  // Direct impact
  directlyAffected: Entity[];
  directRelationships: string[];

  // Indirect impact (cascading effects)
  indirectlyAffected: Entity[];
  maxDepth: number;

  // Risk assessment
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];

  // Critical paths (entities that many others depend on)
  criticalPaths: {
    path: Entity[];
    importance: number;
  }[];

  // Recommendations
  recommendations: string[];

  // Test coverage
  affectedTests: Entity[];
  untested: Entity[];
}

export interface ImpactOptions {
  maxDepth?: number;
  includeTests?: boolean;
  includeDocumentation?: boolean;
  minImportance?: number;
}

/**
 * Analyzes the impact of changes to the knowledge graph
 */
export class ImpactAnalyzer {
  constructor(private kg: KnowledgeGraph) {}

  /**
   * Analyze the impact of changing an entity
   */
  async analyze(
    entityId: string,
    operation: 'modify' | 'delete' | 'move',
    options: ImpactOptions = {}
  ): Promise<ImpactReport> {
    const {
      maxDepth = 5,
      includeTests = true,
      includeDocumentation = true,
      minImportance = 0,
    } = options;

    const entity = this.kg.getEntity(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    // Find all downstream dependencies (who depends on this?)
    const downstream = await this.findDownstream(entityId, maxDepth);

    // Find all upstream dependencies (what does this depend on?)
    const upstream = await this.findUpstream(entityId, maxDepth);

    // Find critical paths
    const criticalPaths = this.findCriticalPaths(entityId, downstream);

    // Calculate risk
    const riskLevel = this.calculateRisk(entity, downstream, upstream, operation);
    const riskFactors = this.identifyRiskFactors(entity, downstream, upstream, operation);

    // Find affected tests
    const affectedTests = includeTests ? this.findAffectedTests(entityId, downstream) : [];
    const downstreamEntities = downstream.map(d => d.entity);
    const untested = this.findUntested([entity, ...downstreamEntities]);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      entity,
      downstream,
      upstream,
      operation,
      affectedTests,
      untested
    );

    return {
      targetEntity: entity,
      operation,
      directlyAffected: downstream.filter(e => e.depth === 1).map(e => e.entity),
      directRelationships: this.getDirectRelationshipTypes(entityId),
      indirectlyAffected: downstream.filter(e => e.depth > 1).map(e => e.entity),
      maxDepth: Math.max(...downstream.map(e => e.depth), 0),
      riskLevel,
      riskFactors,
      criticalPaths,
      recommendations,
      affectedTests,
      untested,
    };
  }

  /**
   * Find all entities that depend on this entity (downstream)
   */
  private async findDownstream(
    entityId: string,
    maxDepth: number
  ): Promise<Array<{ entity: Entity; depth: number; path: string[] }>> {
    const visited = new Set<string>();
    const results: Array<{ entity: Entity; depth: number; path: string[] }> = [];

    const traverse = async (currentId: string, depth: number, path: string[]) => {
      if (depth > maxDepth || visited.has(currentId)) {
        return;
      }

      visited.add(currentId);

      // Find entities that depend on the current entity
      const dependents = this.kg.getRelationships(currentId, 'in').filter(rel =>
        [
          RelationType.DEPENDS_ON,
          RelationType.IMPORTS,
          RelationType.USES,
          RelationType.CALLS,
        ].includes(rel.type)
      );

      for (const rel of dependents) {
        const entity = this.kg.getEntity(rel.source);
        if (entity && !visited.has(entity.id)) {
          results.push({
            entity,
            depth,
            path: [...path, entity.id],
          });

          // Recursively find more dependents
          await traverse(entity.id, depth + 1, [...path, entity.id]);
        }
      }
    };

    await traverse(entityId, 1, [entityId]);
    return results;
  }

  /**
   * Find all entities this entity depends on (upstream)
   */
  private async findUpstream(
    entityId: string,
    maxDepth: number
  ): Promise<Array<{ entity: Entity; depth: number }>> {
    const visited = new Set<string>();
    const results: Array<{ entity: Entity; depth: number }> = [];

    const traverse = async (currentId: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) {
        return;
      }

      visited.add(currentId);

      // Find entities the current entity depends on
      const dependencies = this.kg.getRelationships(currentId, 'out').filter(rel =>
        [
          RelationType.DEPENDS_ON,
          RelationType.IMPORTS,
          RelationType.USES,
          RelationType.CALLS,
        ].includes(rel.type)
      );

      for (const rel of dependencies) {
        const entity = this.kg.getEntity(rel.target);
        if (entity && !visited.has(entity.id)) {
          results.push({ entity, depth });
          await traverse(entity.id, depth + 1);
        }
      }
    };

    await traverse(entityId, 1);
    return results;
  }

  /**
   * Find critical paths (entities that many others depend on)
   */
  private findCriticalPaths(
    entityId: string,
    downstream: Array<{ entity: Entity; depth: number; path: string[] }>
  ): Array<{ path: Entity[]; importance: number }> {
    const pathsByEntity = new Map<string, Entity[][]>();

    // Group paths by their terminal entity
    for (const item of downstream) {
      const pathEntities = item.path.map(id => this.kg.getEntity(id)!).filter(Boolean);
      const terminalId = item.entity.id;

      if (!pathsByEntity.has(terminalId)) {
        pathsByEntity.set(terminalId, []);
      }
      pathsByEntity.get(terminalId)!.push(pathEntities);
    }

    // Find entities that appear in many paths (critical nodes)
    const criticalNodes = new Map<string, number>();
    for (const paths of pathsByEntity.values()) {
      for (const path of paths) {
        for (const entity of path) {
          criticalNodes.set(entity.id, (criticalNodes.get(entity.id) || 0) + 1);
        }
      }
    }

    // Sort by importance and return top paths
    const sortedPaths = Array.from(pathsByEntity.entries())
      .map(([terminalId, paths]) => {
        const path = paths[0]; // Take first path as representative
        const importance = path.reduce((sum, entity) =>
          sum + (criticalNodes.get(entity.id) || 0), 0
        );
        return { path, importance };
      })
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);

    return sortedPaths;
  }

  /**
   * Calculate risk level based on impact
   */
  private calculateRisk(
    entity: Entity,
    downstream: Array<{ entity: Entity; depth: number }>,
    upstream: Array<{ entity: Entity; depth: number }>,
    operation: 'modify' | 'delete' | 'move'
  ): 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    let riskScore = 0;

    // Operation risk
    if (operation === 'delete') riskScore += 30;
    else if (operation === 'move') riskScore += 20;
    else riskScore += 10; // modify

    // Downstream impact
    const downstreamCount = downstream.length;
    if (downstreamCount > 20) riskScore += 30;
    else if (downstreamCount > 10) riskScore += 20;
    else if (downstreamCount > 5) riskScore += 10;

    // Entity type risk
    if (entity.type === EntityType.MODULE) riskScore += 20;
    else if (entity.type === EntityType.CLASS) riskScore += 15;
    else if (entity.type === EntityType.FUNCTION) riskScore += 10;

    // Depth risk (how far the impact spreads)
    const maxDepth = Math.max(...downstream.map(e => e.depth), 0);
    if (maxDepth > 3) riskScore += 20;
    else if (maxDepth > 2) riskScore += 10;

    // Calculate final risk level
    if (riskScore >= 70) return 'CRITICAL';
    if (riskScore >= 50) return 'HIGH';
    if (riskScore >= 30) return 'MEDIUM';
    if (riskScore >= 10) return 'LOW';
    return 'SAFE';
  }

  /**
   * Identify specific risk factors
   */
  private identifyRiskFactors(
    entity: Entity,
    downstream: Array<{ entity: Entity; depth: number }>,
    upstream: Array<{ entity: Entity; depth: number }>,
    operation: 'modify' | 'delete' | 'move'
  ): string[] {
    const factors: string[] = [];

    if (operation === 'delete') {
      factors.push('Deleting entity - cannot be undone easily');
    }

    if (downstream.length > 10) {
      factors.push(`High dependency count: ${downstream.length} entities depend on this`);
    }

    if (downstream.some(d => d.entity.type === EntityType.MODULE)) {
      factors.push('Affects entire modules');
    }

    const maxDepth = Math.max(...downstream.map(e => e.depth), 0);
    if (maxDepth > 3) {
      factors.push(`Deep cascading effect: ${maxDepth} levels deep`);
    }

    if (entity.type === EntityType.MODULE) {
      factors.push('Modifying a core module');
    }

    if (upstream.length === 0) {
      factors.push('Entity has no dependencies (isolated)');
    }

    return factors;
  }

  /**
   * Get direct relationship types
   */
  private getDirectRelationshipTypes(entityId: string): string[] {
    const relationships = this.kg.getRelationships(entityId, 'both');
    return Array.from(new Set(relationships.map(r => r.type)));
  }

  /**
   * Find affected tests
   */
  private findAffectedTests(
    entityId: string,
    downstream: Array<{ entity: Entity; depth: number }>
  ): Entity[] {
    const allEntities = [entityId, ...downstream.map(d => d.entity.id)];
    const tests: Entity[] = [];

    for (const id of allEntities) {
      const testRels = this.kg.getRelationships(id, 'in').filter(
        rel => rel.type === RelationType.TESTS || rel.type === RelationType.TESTED_BY
      );

      for (const rel of testRels) {
        const test = this.kg.getEntity(rel.source);
        if (test && !tests.some(t => t.id === test.id)) {
          tests.push(test);
        }
      }
    }

    return tests;
  }

  /**
   * Find entities without test coverage
   */
  private findUntested(entities: Entity[]): Entity[] {
    return entities.filter(entity => {
      const hasTests = this.kg.getRelationships(entity.id, 'in').some(
        rel => rel.type === RelationType.TESTS || rel.type === RelationType.TESTED_BY
      );
      return !hasTests && (
        entity.type === EntityType.FUNCTION ||
        entity.type === EntityType.CLASS
      );
    });
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    entity: Entity,
    downstream: Array<{ entity: Entity; depth: number }>,
    upstream: Array<{ entity: Entity; depth: number }>,
    operation: 'modify' | 'delete' | 'move',
    affectedTests: Entity[],
    untested: Entity[]
  ): string[] {
    const recommendations: string[] = [];

    if (downstream.length > 10) {
      recommendations.push(`Review all ${downstream.length} dependent entities before proceeding`);
    }

    if (operation === 'delete' && downstream.length > 0) {
      recommendations.push('Consider deprecating instead of deleting to maintain compatibility');
    }

    if (affectedTests.length > 0) {
      recommendations.push(`Run ${affectedTests.length} affected tests before merging`);
    } else if (operation !== 'delete') {
      recommendations.push('No tests found - consider adding test coverage');
    }

    if (untested.length > 0) {
      recommendations.push(`${untested.length} affected entities lack test coverage`);
    }

    if (downstream.some(d => d.entity.type === EntityType.MODULE)) {
      recommendations.push('Impact spans multiple modules - coordinate with team');
    }

    const maxDepth = Math.max(...downstream.map(e => e.depth), 0);
    if (maxDepth > 3) {
      recommendations.push('Deep cascading effects detected - review indirect dependencies carefully');
    }

    if (recommendations.length === 0) {
      recommendations.push('Impact appears minimal - proceed with standard review');
    }

    return recommendations;
  }

  /**
   * Quick impact check - returns just the count and risk level
   */
  async quickCheck(
    entityId: string,
    operation: 'modify' | 'delete' | 'move'
  ): Promise<{ affected: number; riskLevel: string }> {
    const downstream = await this.findDownstream(entityId, 3);
    const entity = this.kg.getEntity(entityId);

    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    const upstream = await this.findUpstream(entityId, 2);
    const riskLevel = this.calculateRisk(entity, downstream, upstream, operation);

    return {
      affected: downstream.length,
      riskLevel,
    };
  }
}

// Singleton instance
let impactAnalyzerInstance: ImpactAnalyzer | null = null;

/**
 * Get the global impact analyzer
 */
export function getImpactAnalyzer(kg: KnowledgeGraph): ImpactAnalyzer {
  if (!impactAnalyzerInstance) {
    impactAnalyzerInstance = new ImpactAnalyzer(kg);
  }
  return impactAnalyzerInstance;
}
