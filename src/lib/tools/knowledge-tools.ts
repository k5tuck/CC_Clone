/**
 * Knowledge Graph Tools
 *
 * Tools for agents to interact with the knowledge graph
 */

import {
  KnowledgeGraph,
  Entity,
  EntityType,
  RelationType,
  GraphQuery,
  createEntityId,
  createRelationshipId,
  getGraphPersistenceManager,
  GraphPersistenceManager,
} from '../knowledge';

// ============================================================================
// Tool Schemas
// ============================================================================

export const knowledgeGraphToolSchemas = [
  {
    name: 'queryKnowledgeGraph',
    description: 'Query the knowledge graph to find entities and relationships. Use this to discover structural information about files, agents, tasks, and their connections.',
    parameters: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          enum: ['File', 'Function', 'Class', 'Agent', 'Task', 'Conversation', 'Module', 'Component', 'Error', 'Solution'],
          description: 'The type of entity to search for',
        },
        filters: {
          type: 'object',
          description: 'Key-value filters to apply (e.g., {"name": "agent-1", "status": "completed"})',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10,
        },
        orderBy: {
          type: 'string',
          description: 'Field to sort by (e.g., "createdAt", "name")',
        },
        orderDirection: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort direction',
          default: 'desc',
        },
      },
    },
  },
  {
    name: 'getFileContext',
    description: 'Get comprehensive context about a file including dependencies, dependents, functions, who modified it, and related tests. Use this before modifying files.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The file path to get context for',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'getAgentHistory',
    description: 'Get execution history for an agent including tasks completed, files modified, and solutions applied. Use this to learn from past agent successes.',
    parameters: {
      type: 'object',
      properties: {
        agentName: {
          type: 'string',
          description: 'The name of the agent',
        },
        taskType: {
          type: 'string',
          description: 'Optional: filter by task type',
        },
      },
      required: ['agentName'],
    },
  },
  {
    name: 'storeKnowledge',
    description: 'Store knowledge in the graph about entities and their relationships. Use this to record discoveries, file modifications, or solutions.',
    parameters: {
      type: 'object',
      properties: {
        entity: {
          type: 'object',
          description: 'The entity to store (must include type, name, and other required fields)',
          properties: {
            type: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            metadata: { type: 'object' },
          },
          required: ['type', 'name'],
        },
        relationships: {
          type: 'array',
          description: 'Optional relationships to other entities',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              targetId: { type: 'string' },
              metadata: { type: 'object' },
            },
            required: ['type', 'targetId'],
          },
        },
      },
      required: ['entity'],
    },
  },
  {
    name: 'findRelatedEntities',
    description: 'Find entities related to a given entity through specific relationship types. Use this to traverse the knowledge graph.',
    parameters: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'The ID of the entity to start from',
        },
        relationshipType: {
          type: 'string',
          description: 'Optional: filter by relationship type',
        },
        direction: {
          type: 'string',
          enum: ['in', 'out', 'both'],
          description: 'Direction of relationships to follow',
          default: 'both',
        },
        depth: {
          type: 'number',
          description: 'How many hops to traverse (default: 1)',
          default: 1,
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 20,
        },
      },
      required: ['entityId'],
    },
  },
];

// ============================================================================
// Tool Implementations
// ============================================================================

export class KnowledgeGraphTools {
  private persistenceManager = getGraphPersistenceManager();
  private currentProjectId: string | null = null;
  private currentGraph: KnowledgeGraph | null = null;

  /**
   * Initialize for a project
   */
  async initialize(projectPath: string): Promise<void> {
    this.currentProjectId = GraphPersistenceManager.generateProjectId(projectPath);
    this.currentGraph = await this.persistenceManager.getOrCreate(
      this.currentProjectId!,
      projectPath
    );
  }

  /**
   * Ensure graph is initialized
   */
  private ensureInitialized(): KnowledgeGraph {
    if (!this.currentGraph) {
      throw new Error('Knowledge graph not initialized. Call initialize() first.');
    }
    return this.currentGraph;
  }

  /**
   * Query the knowledge graph
   */
  async queryKnowledgeGraph(args: {
    entityType?: EntityType;
    filters?: Record<string, any>;
    limit?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }): Promise<Entity[]> {
    const graph = this.ensureInitialized();

    const query: GraphQuery = {
      entityType: args.entityType,
      filters: args.filters,
      limit: args.limit || 10,
      orderBy: args.orderBy,
      orderDirection: args.orderDirection || 'desc',
    };

    return graph.findEntities(query);
  }

  /**
   * Get file context
   */
  async getFileContext(args: { filePath: string }) {
    const graph = this.ensureInitialized();
    return graph.getFileContext(args.filePath);
  }

  /**
   * Get agent history
   */
  async getAgentHistory(args: { agentName: string; taskType?: string }) {
    const graph = this.ensureInitialized();
    return graph.getAgentHistory(args.agentName, args.taskType);
  }

  /**
   * Store knowledge
   */
  async storeKnowledge(args: {
    entity: {
      type: string;
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      [key: string]: any;
    };
    relationships?: Array<{
      type: string;
      targetId: string;
      metadata?: Record<string, any>;
    }>;
  }): Promise<{ entityId: string; relationshipIds: string[] }> {
    const graph = this.ensureInitialized();

    // Create entity ID
    const entityId = createEntityId(args.entity.type as EntityType, args.entity.name);

    // Check if entity exists
    if (graph.hasEntity(entityId)) {
      // Update existing entity
      graph.updateEntity(entityId, {
        ...args.entity,
        type: args.entity.type as EntityType,
        updatedAt: new Date(),
      } as Partial<Entity>);
    } else {
      // Add new entity
      const { type, name, description, metadata, ...rest } = args.entity;
      const entity: Entity = {
        id: entityId,
        type: type as EntityType,
        name,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: metadata || {},
        ...rest,
      } as Entity;

      graph.addEntity(entity);
    }

    // Add relationships
    const relationshipIds: string[] = [];
    if (args.relationships) {
      for (const rel of args.relationships) {
        const relId = createRelationshipId();
        graph.addRelationship({
          id: relId,
          type: rel.type as RelationType,
          source: entityId,
          target: rel.targetId,
          createdAt: new Date(),
          metadata: rel.metadata || {},
        });
        relationshipIds.push(relId);
      }
    }

    return { entityId, relationshipIds };
  }

  /**
   * Find related entities
   */
  async findRelatedEntities(args: {
    entityId: string;
    relationshipType?: RelationType;
    direction?: 'in' | 'out' | 'both';
    depth?: number;
    limit?: number;
  }): Promise<Entity[]> {
    const graph = this.ensureInitialized();

    return graph.getNeighbors({
      entityId: args.entityId,
      relationshipType: args.relationshipType,
      direction: args.direction || 'both',
      depth: args.depth || 1,
      limit: args.limit || 20,
    });
  }

  /**
   * Get graph statistics
   */
  async getGraphStats() {
    const graph = this.ensureInitialized();
    return graph.getStats();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let knowledgeGraphTools: KnowledgeGraphTools | null = null;

export function getKnowledgeGraphTools(): KnowledgeGraphTools {
  if (!knowledgeGraphTools) {
    knowledgeGraphTools = new KnowledgeGraphTools();
  }
  return knowledgeGraphTools;
}
