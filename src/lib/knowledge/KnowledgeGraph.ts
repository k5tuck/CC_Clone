/**
 * Knowledge Graph Core
 *
 * Ephemeral knowledge graph for tracking project entities and relationships.
 * Uses Graphology for graph operations with optimized querying and persistence.
 */

import Graph from 'graphology';
import { v4 as uuidv4 } from 'uuid';
import {
  Entity,
  EntityType,
  Relationship,
  RelationType,
  GraphQuery,
  PathQuery,
  NeighborQuery,
  GraphStats,
  GraphEvent,
  GraphEventType,
} from './types';

// ============================================================================
// Knowledge Graph Class
// ============================================================================

export class KnowledgeGraph {
  private graph: Graph;
  private projectId: string;
  private createdAt: Date;
  private listeners: Map<GraphEventType, Array<(event: GraphEvent) => void>>;

  constructor(projectId: string) {
    this.graph = new Graph({ multi: true, allowSelfLoops: true });
    this.projectId = projectId;
    this.createdAt = new Date();
    this.listeners = new Map();
  }

  // ==========================================================================
  // Entity Operations
  // ==========================================================================

  /**
   * Add an entity to the knowledge graph
   */
  addEntity(entity: Entity): void {
    if (this.graph.hasNode(entity.id)) {
      throw new Error(`Entity with id ${entity.id} already exists`);
    }

    this.graph.addNode(entity.id, {
      ...entity,
      _graphMetadata: {
        addedAt: new Date(),
        degree: 0,
      },
    });

    this.emit({
      type: GraphEventType.ENTITY_ADDED,
      timestamp: new Date(),
      data: { entityId: entity.id, details: entity },
    });
  }

  /**
   * Update an existing entity
   */
  updateEntity(entityId: string, updates: Partial<Entity>): void {
    if (!this.graph.hasNode(entityId)) {
      throw new Error(`Entity with id ${entityId} not found`);
    }

    const currentAttributes = this.graph.getNodeAttributes(entityId);
    this.graph.mergeNodeAttributes(entityId, {
      ...updates,
      updatedAt: new Date(),
    });

    this.emit({
      type: GraphEventType.ENTITY_UPDATED,
      timestamp: new Date(),
      data: { entityId, details: updates },
    });
  }

  /**
   * Get an entity by ID
   */
  getEntity(entityId: string): Entity | null {
    if (!this.graph.hasNode(entityId)) {
      return null;
    }

    const attributes = this.graph.getNodeAttributes(entityId);
    const { _graphMetadata, ...entity } = attributes;
    return entity as Entity;
  }

  /**
   * Remove an entity and all its relationships
   */
  removeEntity(entityId: string): void {
    if (!this.graph.hasNode(entityId)) {
      throw new Error(`Entity with id ${entityId} not found`);
    }

    this.graph.dropNode(entityId);

    this.emit({
      type: GraphEventType.ENTITY_REMOVED,
      timestamp: new Date(),
      data: { entityId },
    });
  }

  /**
   * Check if entity exists
   */
  hasEntity(entityId: string): boolean {
    return this.graph.hasNode(entityId);
  }

  /**
   * Find entities by type and filters
   */
  findEntities(query: GraphQuery): Entity[] {
    const results: Entity[] = [];

    this.graph.forEachNode((nodeId, attributes) => {
      const { _graphMetadata, ...entity } = attributes;

      // Type filter
      if (query.entityType && entity.type !== query.entityType) {
        return;
      }

      // Apply custom filters
      if (query.filters) {
        const matches = Object.entries(query.filters).every(
          ([key, value]) => {
            const entityValue = (entity as any)[key];
            if (typeof value === 'object' && value !== null) {
              // Support operators like { $gte: 5 }
              return this.evaluateFilter(entityValue, value);
            }
            return entityValue === value;
          }
        );
        if (!matches) return;
      }

      results.push(entity as Entity);
    });

    // Apply sorting
    if (query.orderBy) {
      results.sort((a, b) => {
        const aVal = (a as any)[query.orderBy!];
        const bVal = (b as any)[query.orderBy!];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return query.orderDirection === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  // ==========================================================================
  // Relationship Operations
  // ==========================================================================

  /**
   * Add a relationship between two entities
   */
  addRelationship(relationship: Relationship): void {
    if (!this.graph.hasNode(relationship.source)) {
      throw new Error(`Source entity ${relationship.source} not found`);
    }
    if (!this.graph.hasNode(relationship.target)) {
      throw new Error(`Target entity ${relationship.target} not found`);
    }

    this.graph.addDirectedEdge(
      relationship.source,
      relationship.target,
      {
        ...relationship,
        _graphMetadata: {
          addedAt: new Date(),
        },
      }
    );

    this.emit({
      type: GraphEventType.RELATIONSHIP_ADDED,
      timestamp: new Date(),
      data: { relationshipId: relationship.id, details: relationship },
    });
  }

  /**
   * Remove a relationship
   */
  removeRelationship(relationshipId: string): void {
    let found = false;

    this.graph.forEachEdge((edgeId, attributes) => {
      if (attributes.id === relationshipId) {
        this.graph.dropEdge(edgeId);
        found = true;
        return false; // Break iteration
      }
      return undefined;
    });

    if (!found) {
      throw new Error(`Relationship with id ${relationshipId} not found`);
    }

    this.emit({
      type: GraphEventType.RELATIONSHIP_REMOVED,
      timestamp: new Date(),
      data: { relationshipId },
    });
  }

  /**
   * Get relationships for an entity
   */
  getRelationships(
    entityId: string,
    direction: 'in' | 'out' | 'both' = 'both'
  ): Relationship[] {
    if (!this.graph.hasNode(entityId)) {
      throw new Error(`Entity with id ${entityId} not found`);
    }

    const relationships: Relationship[] = [];

    if (direction === 'out' || direction === 'both') {
      this.graph.forEachOutEdge(entityId, (edgeId, attributes) => {
        const { _graphMetadata, ...relationship } = attributes;
        relationships.push(relationship as Relationship);
      });
    }

    if (direction === 'in' || direction === 'both') {
      this.graph.forEachInEdge(entityId, (edgeId, attributes) => {
        const { _graphMetadata, ...relationship } = attributes;
        relationships.push(relationship as Relationship);
      });
    }

    return relationships;
  }

  /**
   * Find relationships by type
   */
  findRelationships(type?: RelationType): Relationship[] {
    const relationships: Relationship[] = [];

    this.graph.forEachEdge((edgeId, attributes) => {
      const { _graphMetadata, ...relationship } = attributes;

      if (!type || relationship.type === type) {
        relationships.push(relationship as Relationship);
      }
      return undefined;
    });

    return relationships;
  }

  // ==========================================================================
  // Graph Queries
  // ==========================================================================

  /**
   * Find shortest path between two entities
   */
  findPath(query: PathQuery): Entity[] | null {
    if (!this.graph.hasNode(query.sourceId) || !this.graph.hasNode(query.targetId)) {
      return null;
    }

    try {
      const path = this.breadthFirstSearch(
        query.sourceId,
        query.targetId,
        query.maxDepth || 10,
        query.relationshipTypes
      );

      if (!path) return null;

      return path.map((nodeId) => {
        const attributes = this.graph.getNodeAttributes(nodeId);
        const { _graphMetadata, ...entity } = attributes;
        return entity as Entity;
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Get neighbors of an entity
   */
  getNeighbors(query: NeighborQuery): Entity[] {
    if (!this.graph.hasNode(query.entityId)) {
      throw new Error(`Entity with id ${query.entityId} not found`);
    }

    const neighbors = new Set<string>();
    const depth = query.depth || 1;
    const limit = query.limit || 100;

    this.collectNeighbors(
      query.entityId,
      neighbors,
      depth,
      query.direction || 'both',
      query.relationshipType
    );

    const results: Entity[] = [];
    for (const neighborId of neighbors) {
      if (results.length >= limit) break;
      const entity = this.getEntity(neighborId);
      if (entity) results.push(entity);
    }

    return results;
  }

  /**
   * Get file context (comprehensive information about a file)
   */
  getFileContext(filePath: string): {
    file: Entity | null;
    dependencies: Entity[];
    dependents: Entity[];
    functions: Entity[];
    modifiedBy: Entity[];
    tests: Entity[];
  } {
    // Find the file entity
    const fileEntities = this.findEntities({
      entityType: EntityType.FILE,
      filters: { path: filePath },
      limit: 1,
    });

    const file = fileEntities[0] || null;
    if (!file) {
      return {
        file: null,
        dependencies: [],
        dependents: [],
        functions: [],
        modifiedBy: [],
        tests: [],
      };
    }

    const dependencies: Entity[] = [];
    const dependents: Entity[] = [];
    const functions: Entity[] = [];
    const modifiedBy: Entity[] = [];
    const tests: Entity[] = [];

    // Get all relationships
    const outRelationships = this.getRelationships(file.id, 'out');
    const inRelationships = this.getRelationships(file.id, 'in');

    for (const rel of outRelationships) {
      const target = this.getEntity(rel.target);
      if (!target) continue;

      if (rel.type === RelationType.DEPENDS_ON || rel.type === RelationType.IMPORTS) {
        dependencies.push(target);
      }
    }

    for (const rel of inRelationships) {
      const source = this.getEntity(rel.source);
      if (!source) continue;

      if (rel.type === RelationType.DEPENDS_ON || rel.type === RelationType.IMPORTS) {
        dependents.push(source);
      } else if (rel.type === RelationType.MODIFIED_BY) {
        modifiedBy.push(source);
      } else if (rel.type === RelationType.TESTS) {
        tests.push(source);
      }
    }

    // Get functions in the file
    functions.push(...this.findEntities({
      entityType: EntityType.FUNCTION,
      filters: { filePath },
    }));

    return { file, dependencies, dependents, functions, modifiedBy, tests };
  }

  /**
   * Get agent execution history
   */
  getAgentHistory(
    agentName: string,
    taskType?: string
  ): {
    agent: Entity | null;
    tasks: Entity[];
    filesModified: Entity[];
    errorsEncountered: Entity[];
    solutionsApplied: Entity[];
  } {
    // Find the agent entity
    const agentEntities = this.findEntities({
      entityType: EntityType.AGENT,
      filters: { name: agentName },
      limit: 1,
    });

    const agent = agentEntities[0] || null;
    if (!agent) {
      return {
        agent: null,
        tasks: [],
        filesModified: [],
        errorsEncountered: [],
        solutionsApplied: [],
      };
    }

    const tasks: Entity[] = [];
    const filesModified: Entity[] = [];
    const errorsEncountered: Entity[] = [];
    const solutionsApplied: Entity[] = [];

    // Get all relationships
    const relationships = this.getRelationships(agent.id, 'out');

    for (const rel of relationships) {
      const target = this.getEntity(rel.target);
      if (!target) continue;

      if (rel.type === RelationType.EXECUTED_BY) {
        if (!taskType || (target as any).taskType === taskType) {
          tasks.push(target);
        }
      } else if (rel.type === RelationType.MODIFIED_BY) {
        filesModified.push(target);
      } else if (rel.type === RelationType.SOLVED_BY) {
        if (target.type === EntityType.ERROR) {
          errorsEncountered.push(target);
        } else if (target.type === EntityType.SOLUTION) {
          solutionsApplied.push(target);
        }
      }
    }

    return { agent, tasks, filesModified, errorsEncountered, solutionsApplied };
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get graph statistics
   */
  getStats(): GraphStats {
    const entityCounts: Record<EntityType, number> = {} as any;
    const relationshipCounts: Record<RelationType, number> = {} as any;

    // Count entities by type
    this.graph.forEachNode((nodeId, attributes) => {
      const type = attributes.type as EntityType;
      entityCounts[type] = (entityCounts[type] || 0) + 1;
    });

    // Count relationships by type
    this.graph.forEachEdge((edgeId, attributes) => {
      const type = attributes.type as RelationType;
      relationshipCounts[type] = (relationshipCounts[type] || 0) + 1;
    });

    // Calculate average degree
    const degrees = this.graph.nodes().map((node) => this.graph.degree(node));
    const avgDegree = degrees.length > 0
      ? degrees.reduce((a, b) => a + b, 0) / degrees.length
      : 0;

    // Find densest nodes
    const densestNodes = this.graph
      .nodes()
      .map((node) => ({ id: node, degree: this.graph.degree(node) }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 10);

    return {
      nodeCount: this.graph.order,
      edgeCount: this.graph.size,
      entityCounts,
      relationshipCounts,
      avgDegree,
      densestNodes,
      lastUpdated: new Date(),
    };
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Clear the entire graph
   */
  clear(): void {
    this.graph.clear();
    this.emit({
      type: GraphEventType.GRAPH_CLEARED,
      timestamp: new Date(),
      data: {},
    });
  }

  /**
   * Get the underlying Graphology instance (for advanced operations)
   */
  getGraphInstance(): Graph {
    return this.graph;
  }

  /**
   * Export graph to JSON
   */
  toJSON(): any {
    const nodes = this.graph.nodes().map((nodeId) => ({
      id: nodeId,
      ...this.graph.getNodeAttributes(nodeId),
    }));

    const edges = this.graph.edges().map((edgeId) => ({
      id: edgeId,
      source: this.graph.source(edgeId),
      target: this.graph.target(edgeId),
      ...this.graph.getEdgeAttributes(edgeId),
    }));

    return {
      projectId: this.projectId,
      createdAt: this.createdAt,
      nodes,
      edges,
      stats: this.getStats(),
    };
  }

  /**
   * Import graph from JSON
   */
  static fromJSON(data: any): KnowledgeGraph {
    const kg = new KnowledgeGraph(data.projectId);
    kg.createdAt = new Date(data.createdAt);

    // Add nodes
    for (const node of data.nodes) {
      const { id, ...attributes } = node;
      kg.graph.addNode(id, attributes);
    }

    // Add edges
    for (const edge of data.edges) {
      const { id, source, target, ...attributes } = edge;
      kg.graph.addDirectedEdge(source, target, attributes);
    }

    return kg;
  }

  // ==========================================================================
  // Event System
  // ==========================================================================

  on(eventType: GraphEventType, handler: (event: GraphEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);
  }

  off(eventType: GraphEventType, handler: (event: GraphEvent) => void): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: GraphEvent): void {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private evaluateFilter(value: any, filter: any): boolean {
    if (filter.$eq !== undefined) return value === filter.$eq;
    if (filter.$ne !== undefined) return value !== filter.$ne;
    if (filter.$gt !== undefined) return value > filter.$gt;
    if (filter.$gte !== undefined) return value >= filter.$gte;
    if (filter.$lt !== undefined) return value < filter.$lt;
    if (filter.$lte !== undefined) return value <= filter.$lte;
    if (filter.$in !== undefined) return filter.$in.includes(value);
    if (filter.$nin !== undefined) return !filter.$nin.includes(value);
    return true;
  }

  private breadthFirstSearch(
    sourceId: string,
    targetId: string,
    maxDepth: number,
    relationshipTypes?: RelationType[]
  ): string[] | null | undefined {
    const queue: Array<{ nodeId: string; path: string[] }> = [
      { nodeId: sourceId, path: [sourceId] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === targetId) {
        return path;
      }

      if (path.length >= maxDepth) {
        continue;
      }

      if (visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);

      this.graph.forEachOutEdge(nodeId, (edgeId, attributes) => {
        if (relationshipTypes && !relationshipTypes.includes(attributes.type)) {
          return;
        }

        const neighborId = this.graph.target(edgeId);
        if (!visited.has(neighborId)) {
          queue.push({
            nodeId: neighborId,
            path: [...path, neighborId],
          });
        }
      });
    }

    return null;
  }

  private collectNeighbors(
    entityId: string,
    neighbors: Set<string>,
    depth: number,
    direction: 'in' | 'out' | 'both',
    relationshipType?: RelationType
  ): void {
    if (depth === 0) return;

    const processEdge = (edgeId: string, attributes: any, neighborId: string) => {
      if (relationshipType && attributes.type !== relationshipType) {
        return;
      }

      if (!neighbors.has(neighborId)) {
        neighbors.add(neighborId);
        this.collectNeighbors(neighborId, neighbors, depth - 1, direction, relationshipType);
      }
    };

    if (direction === 'out' || direction === 'both') {
      this.graph.forEachOutEdge(entityId, (edgeId, attributes) => {
        processEdge(edgeId, attributes, this.graph.target(edgeId));
      });
    }

    if (direction === 'in' || direction === 'both') {
      this.graph.forEachInEdge(entityId, (edgeId, attributes) => {
        processEdge(edgeId, attributes, this.graph.source(edgeId));
      });
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create entity ID from components
 */
export function createEntityId(type: EntityType, ...parts: string[]): string {
  return `${type}:${parts.join(':')}`;
}

/**
 * Create relationship ID
 */
export function createRelationshipId(): string {
  return `rel:${uuidv4()}`;
}
