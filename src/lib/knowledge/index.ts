/**
 * Knowledge Graph Module
 *
 * Exports all knowledge graph functionality
 */

export * from './types';
export * from './KnowledgeGraph';
export * from './GraphPersistence';
export * from './GraphVisualizer';
export { KnowledgeGraph, createEntityId, createRelationshipId } from './KnowledgeGraph';
export {
  GraphPersistenceManager,
  getGraphPersistenceManager,
  type PersistenceConfig,
} from './GraphPersistence';
export {
  GraphVisualizer,
  getGraphVisualizer,
  type VisualNode,
  type VisualEdge,
  type ASCIIVisualization,
  LayoutType,
  type VisualizationOptions,
} from './GraphVisualizer';
