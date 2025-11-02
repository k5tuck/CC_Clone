/**
 * Knowledge Graph Visualizer
 * Provides ASCII visualization and navigation for the knowledge graph
 */

import { KnowledgeGraph } from './KnowledgeGraph';
import { Entity, EntityType, Relationship, RelationType } from './types';

/**
 * Graph visualization node
 */
export interface VisualNode {
  id: string;
  label: string;
  type: EntityType;
  x: number;
  y: number;
  connections: string[];
}

/**
 * Graph visualization edge
 */
export interface VisualEdge {
  from: string;
  to: string;
  label: string;
  type: RelationType;
}

/**
 * Visualization layout types
 */
export enum LayoutType {
  TREE = 'tree',
  RADIAL = 'radial',
  FORCE = 'force',
  HIERARCHICAL = 'hierarchical',
}

/**
 * Visualization options
 */
export interface VisualizationOptions {
  maxNodes?: number;
  maxDepth?: number;
  layout?: LayoutType;
  focusEntity?: string;
  showLabels?: boolean;
  showTypes?: boolean;
}

/**
 * ASCII visualization result
 */
export interface ASCIIVisualization {
  lines: string[];
  width: number;
  height: number;
  nodes: VisualNode[];
  edges: VisualEdge[];
}

/**
 * Knowledge Graph Visualizer
 */
export class GraphVisualizer {
  private kg: KnowledgeGraph;

  constructor(knowledgeGraph: KnowledgeGraph) {
    this.kg = knowledgeGraph;
  }

  /**
   * Get the underlying knowledge graph
   */
  getKnowledgeGraph(): KnowledgeGraph {
    return this.kg;
  }

  /**
   * Generate ASCII visualization of the graph
   */
  visualize(options: VisualizationOptions = {}): ASCIIVisualization {
    const {
      maxNodes = 20,
      maxDepth = 3,
      layout = LayoutType.TREE,
      focusEntity,
      showLabels = true,
      showTypes = true,
    } = options;

    // Get entities to visualize
    const entities = focusEntity
      ? this.getSubgraph(focusEntity, maxDepth, maxNodes)
      : this.getTopEntities(maxNodes);

    // Get relationships between these entities
    const entityIds = new Set(entities.map(e => e.id));
    const relationships = this.getRelationships(entityIds);

    // Convert to visual nodes and edges
    const nodes = this.createVisualNodes(entities, layout);
    const edges = this.createVisualEdges(relationships);

    // Generate ASCII representation
    const lines = this.renderASCII(nodes, edges, showLabels, showTypes);

    return {
      lines,
      width: Math.max(...lines.map(l => l.length)),
      height: lines.length,
      nodes,
      edges,
    };
  }

  /**
   * Get a subgraph centered around a focus entity
   */
  private getSubgraph(focusId: string, maxDepth: number, maxNodes: number): Entity[] {
    const visited = new Set<string>();
    const entities: Entity[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: focusId, depth: 0 }];

    while (queue.length > 0 && entities.length < maxNodes) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);

      const entity = this.kg.getEntity(id);
      if (entity) {
        entities.push(entity);

        // Add neighbors to queue
        if (depth < maxDepth) {
          const neighbors = this.kg.getNeighbors({ entityId: id });
          for (const neighbor of neighbors.slice(0, 3)) {
            // Limit neighbors
            queue.push({ id: neighbor.id, depth: depth + 1 });
          }
        }
      }
    }

    return entities;
  }

  /**
   * Get top entities by importance
   */
  private getTopEntities(maxNodes: number): Entity[] {
    const allEntities = this.kg.findEntities({});

    // Sort by degree (number of connections) and recency
    return allEntities
      .sort((a, b) => {
        const aNeighbors = this.kg.getNeighbors({ entityId: a.id }).length;
        const bNeighbors = this.kg.getNeighbors({ entityId: b.id }).length;

        if (aNeighbors !== bNeighbors) {
          return bNeighbors - aNeighbors;
        }

        return b.updatedAt.getTime() - a.updatedAt.getTime();
      })
      .slice(0, maxNodes);
  }

  /**
   * Get relationships between a set of entities
   */
  private getRelationships(entityIds: Set<string>): Relationship[] {
    const relationships: Relationship[] = [];

    for (const entityId of entityIds) {
      const rels = this.kg.getRelationships(entityId, 'out');
      for (const rel of rels) {
        if (entityIds.has(rel.target)) {
          relationships.push(rel);
        }
      }
    }

    return relationships;
  }

  /**
   * Create visual nodes from entities
   */
  private createVisualNodes(entities: Entity[], layout: LayoutType): VisualNode[] {
    const nodes: VisualNode[] = [];

    entities.forEach((entity, index) => {
      const neighbors = this.kg.getNeighbors({ entityId: entity.id });

      let x = 0, y = 0;

      // Simple layout algorithm
      switch (layout) {
        case LayoutType.TREE:
          x = index % 3;
          y = Math.floor(index / 3);
          break;
        case LayoutType.RADIAL:
          const angle = (index / entities.length) * 2 * Math.PI;
          x = Math.cos(angle) * 3;
          y = Math.sin(angle) * 3;
          break;
        default:
          x = index % 4;
          y = Math.floor(index / 4);
      }

      nodes.push({
        id: entity.id,
        label: entity.name,
        type: entity.type,
        x,
        y,
        connections: neighbors.map(n => n.id),
      });
    });

    return nodes;
  }

  /**
   * Create visual edges from relationships
   */
  private createVisualEdges(relationships: Relationship[]): VisualEdge[] {
    return relationships.map(rel => ({
      from: rel.source,
      to: rel.target,
      label: rel.type,
      type: rel.type,
    }));
  }

  /**
   * Render ASCII representation of the graph
   */
  private renderASCII(
    nodes: VisualNode[],
    edges: VisualEdge[],
    showLabels: boolean,
    showTypes: boolean
  ): string[] {
    const lines: string[] = [];

    if (nodes.length === 0) {
      return ['(empty graph)'];
    }

    // Render header
    lines.push('┌─ Knowledge Graph ─────────────────────────────┐');

    // Group nodes by type for better readability
    const nodesByType = new Map<EntityType, VisualNode[]>();
    for (const node of nodes) {
      if (!nodesByType.has(node.type)) {
        nodesByType.set(node.type, []);
      }
      nodesByType.get(node.type)!.push(node);
    }

    // Render each type group
    for (const [type, typeNodes] of nodesByType) {
      const icon = this.getEntityIcon(type);
      lines.push(`│ ${icon} ${type}${showTypes ? `(${typeNodes.length})` : ''}`);

      for (const node of typeNodes.slice(0, 5)) {
        // Show up to 5 per type
        const connections = edges.filter(e => e.from === node.id || e.to === node.id);
        const label = showLabels ? node.label : node.id.slice(0, 8);

        if (connections.length > 0) {
          lines.push(`│   [${label}]`);

          // Show connections
          for (const edge of connections.slice(0, 3)) {
            // Show up to 3 connections
            const targetNode = nodes.find(n => n.id === edge.to);
            if (targetNode && targetNode.id !== node.id) {
              const arrow = this.getRelationshipArrow(edge.type);
              lines.push(`│     ${arrow} ${targetNode.label}`);
            }
          }
        } else {
          lines.push(`│   [${label}]`);
        }
      }

      if (typeNodes.length > 5) {
        lines.push(`│   ... and ${typeNodes.length - 5} more`);
      }
      lines.push(`│`);
    }

    // Add footer with stats
    const stats = this.kg.getStats();
    lines.push(`│ Total: ${stats.nodeCount} entities, ${stats.edgeCount} relationships`);
    lines.push('└───────────────────────────────────────────────┘');

    return lines;
  }

  /**
   * Get icon for entity type
   */
  private getEntityIcon(type: EntityType): string {
    switch (type) {
      case EntityType.FILE:
        return '📄';
      case EntityType.FUNCTION:
        return '⚡';
      case EntityType.CLASS:
        return '🏛️';
      case EntityType.AGENT:
        return '🤖';
      case EntityType.TASK:
        return '📋';
      case EntityType.CONVERSATION:
        return '💬';
      case EntityType.MODULE:
        return '📦';
      case EntityType.COMPONENT:
        return '🧩';
      case EntityType.ERROR:
        return '❌';
      case EntityType.SOLUTION:
        return '✅';
      default:
        return '•';
    }
  }

  /**
   * Get arrow symbol for relationship type
   */
  private getRelationshipArrow(type: RelationType): string {
    switch (type) {
      case RelationType.IMPORTS:
      case RelationType.DEPENDS_ON:
        return '├─imports─>';
      case RelationType.EXPORTS:
        return '├─exports─>';
      case RelationType.CALLS:
        return '├─calls─>';
      case RelationType.IMPLEMENTS:
        return '├─implements─>';
      case RelationType.EXTENDS:
        return '├─extends─>';
      case RelationType.USES:
        return '├─uses─>';
      case RelationType.MODIFIED_BY:
      case RelationType.CREATED_BY:
        return '├─modifiedBy─>';
      case RelationType.TESTED_BY:
      case RelationType.TESTS:
        return '├─tests─>';
      case RelationType.DISCUSSES:
        return '├─discusses─>';
      case RelationType.SOLVED_BY:
        return '├─solvedBy─>';
      default:
        return '├─>';
    }
  }

  /**
   * Get detailed view of an entity
   */
  getEntityDetails(entityId: string): string[] {
    const entity = this.kg.getEntity(entityId);
    if (!entity) {
      return ['Entity not found'];
    }

    const lines: string[] = [];
    const icon = this.getEntityIcon(entity.type);

    lines.push('┌─ Entity Details ──────────────────────────────┐');
    lines.push(`│ ${icon} ${entity.name}`);
    lines.push(`│ Type: ${entity.type}`);
    lines.push(`│ ID: ${entity.id}`);

    if (entity.description) {
      lines.push(`│ Description: ${entity.description}`);
    }

    lines.push(`│`);

    // Show relationships
    const outgoing = this.kg.getRelationships(entityId, 'out');
    const incoming = this.kg.getRelationships(entityId, 'in');

    if (outgoing.length > 0) {
      lines.push(`│ Outgoing (${outgoing.length}):`);
      for (const rel of outgoing.slice(0, 5)) {
        const target = this.kg.getEntity(rel.target);
        if (target) {
          const arrow = this.getRelationshipArrow(rel.type);
          lines.push(`│   ${arrow} ${target.name}`);
        }
      }
      if (outgoing.length > 5) {
        lines.push(`│   ... and ${outgoing.length - 5} more`);
      }
    }

    if (incoming.length > 0) {
      lines.push(`│ Incoming (${incoming.length}):`);
      for (const rel of incoming.slice(0, 5)) {
        const source = this.kg.getEntity(rel.source);
        if (source) {
          lines.push(`│   ${source.name} → ${rel.type}`);
        }
      }
      if (incoming.length > 5) {
        lines.push(`│   ... and ${incoming.length - 5} more`);
      }
    }

    lines.push('└───────────────────────────────────────────────┘');
    return lines;
  }

  /**
   * Search graph for entities
   */
  searchGraph(query: string): Entity[] {
    const allEntities = this.kg.findEntities({});
    const lowerQuery = query.toLowerCase();

    return allEntities
      .filter(entity =>
        entity.name.toLowerCase().includes(lowerQuery) ||
        entity.description?.toLowerCase().includes(lowerQuery) ||
        entity.id.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 20);
  }
}

// Singleton instance
let visualizerInstance: GraphVisualizer | null = null;

/**
 * Get or create the graph visualizer instance
 */
export function getGraphVisualizer(knowledgeGraph: KnowledgeGraph): GraphVisualizer {
  if (!visualizerInstance || visualizerInstance['kg'] !== knowledgeGraph) {
    visualizerInstance = new GraphVisualizer(knowledgeGraph);
  }
  return visualizerInstance;
}
