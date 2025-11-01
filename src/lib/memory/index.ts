/**
 * Memory Module
 *
 * Exports all vector database and semantic memory functionality
 */

export * from './types';
export { EmbeddingProvider } from './types';
export * from './VectorStore';
export * from './EmbeddingProvider';
export * from './ConversationMemory';
export { VectorStore, normalizeVector, euclideanDistance, dotProduct } from './VectorStore';
export {
  OpenAIEmbeddingProvider,
  SimpleEmbeddingProvider,
  CachedEmbeddingProvider,
  EmbeddingCache,
  createEmbeddingProvider,
} from './EmbeddingProvider';
export {
  ConversationMemoryManager,
  getConversationMemoryManager,
} from './ConversationMemory';
