/**
 * Knowledge Graph Type Definitions
 *
 * Defines entity types, relationships, and query structures for the
 * ephemeral knowledge graph system.
 */

// ============================================================================
// Entity Types
// ============================================================================

export enum EntityType {
  FILE = 'File',
  FUNCTION = 'Function',
  CLASS = 'Class',
  AGENT = 'Agent',
  TASK = 'Task',
  CONVERSATION = 'Conversation',
  MODULE = 'Module',
  COMPONENT = 'Component',
  ERROR = 'Error',
  SOLUTION = 'Solution',
}

// ============================================================================
// Relationship Types
// ============================================================================

export enum RelationType {
  // File relationships
  IMPORTS = 'IMPORTS',
  EXPORTS = 'EXPORTS',
  DEPENDS_ON = 'DEPENDS_ON',

  // Code relationships
  CALLS = 'CALLS',
  IMPLEMENTS = 'IMPLEMENTS',
  EXTENDS = 'EXTENDS',
  USES = 'USES',

  // Agent relationships
  MODIFIED_BY = 'MODIFIED_BY',
  CREATED_BY = 'CREATED_BY',
  ANALYZED_BY = 'ANALYZED_BY',
  EXECUTED_BY = 'EXECUTED_BY',

  // Task relationships
  PARENT_OF = 'PARENT_OF',
  BLOCKS = 'BLOCKS',
  RELATED_TO = 'RELATED_TO',
  SOLVED_BY = 'SOLVED_BY',

  // Conversation relationships
  DISCUSSES = 'DISCUSSES',
  REFERENCES = 'REFERENCES',
  RESULTED_IN = 'RESULTED_IN',

  // Testing relationships
  TESTED_BY = 'TESTED_BY',
  TESTS = 'TESTS',
}

// ============================================================================
// Entity Interfaces
// ============================================================================

export interface BaseEntity {
  id: string;
  type: EntityType;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface FileEntity extends BaseEntity {
  type: EntityType.FILE;
  path: string;
  language?: string;
  hash?: string;
  size?: number;
  lines?: number;
}

export interface FunctionEntity extends BaseEntity {
  type: EntityType.FUNCTION;
  signature: string;
  filePath: string;
  startLine: number;
  endLine: number;
  parameters?: string[];
  returnType?: string;
}

export interface ClassEntity extends BaseEntity {
  type: EntityType.CLASS;
  filePath: string;
  startLine: number;
  endLine: number;
  methods?: string[];
  properties?: string[];
}

export interface AgentEntity extends BaseEntity {
  type: EntityType.AGENT;
  agentId: string;
  capabilities: string[];
  successRate?: number;
  executionCount: number;
  lastExecuted?: Date;
}

export interface TaskEntity extends BaseEntity {
  type: EntityType.TASK;
  taskType: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority?: number;
  estimatedDuration?: number;
  actualDuration?: number;
}

export interface ConversationEntity extends BaseEntity {
  type: EntityType.CONVERSATION;
  conversationId: string;
  agentName?: string;
  messageCount: number;
  summary?: string;
  tags?: string[];
}

export interface ModuleEntity extends BaseEntity {
  type: EntityType.MODULE;
  moduleName: string;
  version?: string;
  exports?: string[];
}

export interface ErrorEntity extends BaseEntity {
  type: EntityType.ERROR;
  errorType: string;
  message: string;
  stackTrace?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SolutionEntity extends BaseEntity {
  type: EntityType.SOLUTION;
  approach: string;
  effectiveness?: number;
  appliedCount: number;
}

export type Entity =
  | FileEntity
  | FunctionEntity
  | ClassEntity
  | AgentEntity
  | TaskEntity
  | ConversationEntity
  | ModuleEntity
  | ErrorEntity
  | SolutionEntity;

// ============================================================================
// Relationship Interface
// ============================================================================

export interface Relationship {
  id: string;
  type: RelationType;
  source: string; // Entity ID
  target: string; // Entity ID
  createdAt: Date;
  metadata: Record<string, any>;
  weight?: number; // For weighted relationships (e.g., call frequency)
}

// ============================================================================
// Query Interfaces
// ============================================================================

export interface GraphQuery {
  entityType?: EntityType;
  relationshipType?: RelationType;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PathQuery {
  sourceId: string;
  targetId: string;
  maxDepth?: number;
  relationshipTypes?: RelationType[];
}

export interface NeighborQuery {
  entityId: string;
  relationshipType?: RelationType;
  direction?: 'in' | 'out' | 'both';
  depth?: number;
  limit?: number;
}

// ============================================================================
// Graph Statistics
// ============================================================================

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  entityCounts: Record<EntityType, number>;
  relationshipCounts: Record<RelationType, number>;
  avgDegree: number;
  densestNodes: Array<{ id: string; degree: number }>;
  lastUpdated: Date;
}

// ============================================================================
// Graph Events
// ============================================================================

export enum GraphEventType {
  ENTITY_ADDED = 'entity_added',
  ENTITY_UPDATED = 'entity_updated',
  ENTITY_REMOVED = 'entity_removed',
  RELATIONSHIP_ADDED = 'relationship_added',
  RELATIONSHIP_REMOVED = 'relationship_removed',
  GRAPH_CLEARED = 'graph_cleared',
}

export interface GraphEvent {
  type: GraphEventType;
  timestamp: Date;
  data: {
    entityId?: string;
    relationshipId?: string;
    details?: any;
  };
}
