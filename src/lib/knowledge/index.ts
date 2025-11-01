/**
 * Knowledge Graph Module
 *
 * Exports all knowledge graph functionality
 */

export * from './types';
export * from './KnowledgeGraph';
export * from './GraphPersistence';
export { KnowledgeGraph, createEntityId, createRelationshipId } from './KnowledgeGraph';
export {
  GraphPersistenceManager,
  getGraphPersistenceManager,
  type PersistenceConfig,
} from './GraphPersistence';
