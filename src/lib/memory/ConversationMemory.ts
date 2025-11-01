/**
 * Conversation Memory
 *
 * Semantic memory system for conversation history with vector-based retrieval.
 */

import { v4 as uuidv4 } from 'uuid';
import { VectorStore } from './VectorStore';
import { CachedEmbeddingProvider, createEmbeddingProvider } from './EmbeddingProvider';
import {
  ConversationMemory as ConversationMemoryType,
  MemorySearchQuery,
  MemoryFilter,
  VectorSearchResult,
  EmbeddingProvider,
} from './types';

// ============================================================================
// Conversation Memory Manager
// ============================================================================

export class ConversationMemoryManager {
  private vectorStore: VectorStore;
  private embeddingProvider: EmbeddingProvider;
  private memories: Map<string, ConversationMemoryType>;

  constructor(
    vectorStore?: VectorStore,
    embeddingProvider?: EmbeddingProvider
  ) {
    this.vectorStore = vectorStore || new VectorStore();
    this.embeddingProvider = embeddingProvider ||
      new CachedEmbeddingProvider(createEmbeddingProvider('simple'));
    this.memories = new Map();
  }

  /**
   * Initialize the memory system (load from disk)
   */
  async initialize(): Promise<void> {
    await this.vectorStore.load();
  }

  /**
   * Add a conversation turn to memory
   */
  async addMemory(memory: Omit<ConversationMemoryType, 'id' | 'embedding'>): Promise<string> {
    const id = uuidv4();

    // Generate embedding for the content
    const embedding = await this.embeddingProvider.embed(memory.content);

    const fullMemory: ConversationMemoryType = {
      id,
      ...memory,
      embedding,
    };

    // Store in vector database
    await this.vectorStore.add({
      embedding,
      metadata: {
        id,
        conversationId: memory.conversationId,
        agentName: memory.agentName,
        role: memory.role,
        content: memory.content,
        timestamp: memory.timestamp.toISOString(),
        ...memory.metadata,
      },
    });

    // Cache in memory
    this.memories.set(id, fullMemory);

    return id;
  }

  /**
   * Add multiple conversation turns in batch
   */
  async addMemories(
    memories: Array<Omit<ConversationMemoryType, 'id' | 'embedding'>>
  ): Promise<string[]> {
    const ids: string[] = [];

    // Generate embeddings in batch
    const contents = memories.map((m) => m.content);
    const embeddings = await this.embeddingProvider.embedBatch(contents);

    // Store each memory
    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      const embedding = embeddings[i];
      const id = uuidv4();

      const fullMemory: ConversationMemoryType = {
        id,
        ...memory,
        embedding,
      };

      await this.vectorStore.add({
        embedding,
        metadata: {
          id,
          conversationId: memory.conversationId,
          agentName: memory.agentName,
          role: memory.role,
          content: memory.content,
          timestamp: memory.timestamp.toISOString(),
          ...memory.metadata,
        },
      });

      this.memories.set(id, fullMemory);
      ids.push(id);
    }

    return ids;
  }

  /**
   * Search for similar conversations
   */
  async searchSimilar(query: MemorySearchQuery): Promise<Array<ConversationMemoryType & { score: number }>> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingProvider.embed(query.text);

    // Create metadata filter function
    const metadataFilter = this.createMetadataFilter(query.filters);

    // Search vector store
    const results = await this.vectorStore.search(
      queryEmbedding,
      query.limit || 10,
      query.threshold || 0.7,
      metadataFilter
    );

    // Map results to memories
    return results.map((result) => ({
      id: result.metadata.id,
      conversationId: result.metadata.conversationId,
      agentName: result.metadata.agentName,
      role: result.metadata.role,
      content: result.metadata.content,
      timestamp: new Date(result.metadata.timestamp),
      metadata: result.metadata,
      score: result.score,
    }));
  }

  /**
   * Find similar problems that were solved before
   */
  async findSimilarProblems(
    problemDescription: string,
    limit: number = 5
  ): Promise<Array<ConversationMemoryType & { score: number }>> {
    return this.searchSimilar({
      text: problemDescription,
      limit,
      threshold: 0.75,
      filters: {
        role: 'assistant',
        success: true,
      },
    });
  }

  /**
   * Get conversation history for a specific conversation
   */
  async getConversationHistory(
    conversationId: string,
    limit?: number
  ): Promise<ConversationMemoryType[]> {
    const results = await this.vectorStore.query(
      (metadata) => metadata.conversationId === conversationId
    );

    const memories = results
      .map((vector) => ({
        id: vector.metadata.id,
        conversationId: vector.metadata.conversationId,
        agentName: vector.metadata.agentName,
        role: vector.metadata.role,
        content: vector.metadata.content,
        embedding: vector.embedding,
        timestamp: new Date(vector.metadata.timestamp),
        metadata: vector.metadata,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return limit ? memories.slice(0, limit) : memories;
  }

  /**
   * Get memories by agent
   */
  async getMemoriesByAgent(
    agentName: string,
    limit?: number
  ): Promise<ConversationMemoryType[]> {
    const results = await this.vectorStore.query(
      (metadata) => metadata.agentName === agentName
    );

    const memories = results
      .map((vector) => ({
        id: vector.metadata.id,
        conversationId: vector.metadata.conversationId,
        agentName: vector.metadata.agentName,
        role: vector.metadata.role,
        content: vector.metadata.content,
        embedding: vector.embedding,
        timestamp: new Date(vector.metadata.timestamp),
        metadata: vector.metadata,
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? memories.slice(0, limit) : memories;
  }

  /**
   * Get related context for a query (RAG-style retrieval)
   */
  async getRelatedContext(
    query: string,
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<string[]> {
    const results = await this.searchSimilar({
      text: query,
      limit,
      threshold,
    });

    return results.map((result) => result.content);
  }

  /**
   * Delete memories for a conversation
   */
  async deleteConversation(conversationId: string): Promise<number> {
    const results = await this.vectorStore.query(
      (metadata) => metadata.conversationId === conversationId
    );

    let deleted = 0;
    for (const vector of results) {
      await this.vectorStore.delete(vector.id);
      this.memories.delete(vector.metadata.id);
      deleted++;
    }

    return deleted;
  }

  /**
   * Get statistics about memory usage
   */
  getStats(): {
    totalMemories: number;
    uniqueConversations: number;
    uniqueAgents: number;
    memoryUsage: number;
    oldestMemory: Date | null;
    newestMemory: Date | null;
  } {
    const storeStats = this.vectorStore.getStats();
    const conversations = new Set<string>();
    const agents = new Set<string>();

    this.memories.forEach((memory) => {
      conversations.add(memory.conversationId);
      if (memory.agentName) {
        agents.add(memory.agentName);
      }
    });

    return {
      totalMemories: storeStats.count,
      uniqueConversations: conversations.size,
      uniqueAgents: agents.size,
      memoryUsage: storeStats.memoryUsage,
      oldestMemory: storeStats.oldestVector,
      newestMemory: storeStats.newestVector,
    };
  }

  /**
   * Clear all memories
   */
  async clear(): Promise<void> {
    await this.vectorStore.clear();
    this.memories.clear();
  }

  /**
   * Save to disk
   */
  async save(): Promise<void> {
    await this.vectorStore.save();
  }

  /**
   * Cleanup and save
   */
  async cleanup(): Promise<void> {
    await this.vectorStore.cleanup();
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private createMetadataFilter(
    filters?: MemoryFilter
  ): ((metadata: Record<string, any>) => boolean) | undefined {
    if (!filters) {
      return undefined;
    }

    return (metadata) => {
      // Conversation ID filter
      if (filters.conversationId && metadata.conversationId !== filters.conversationId) {
        return false;
      }

      // Agent name filter
      if (filters.agentName && metadata.agentName !== filters.agentName) {
        return false;
      }

      // Role filter
      if (filters.role && metadata.role !== filters.role) {
        return false;
      }

      // Tags filter (must have at least one matching tag)
      if (filters.tags && filters.tags.length > 0) {
        const memoryTags = metadata.tags || [];
        const hasMatchingTag = filters.tags.some((tag: string) => memoryTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange) {
        const timestamp = new Date(metadata.timestamp);
        if (
          timestamp < filters.dateRange.start ||
          timestamp > filters.dateRange.end
        ) {
          return false;
        }
      }

      // Success filter
      if (filters.success !== undefined && metadata.success !== filters.success) {
        return false;
      }

      // Error filter
      if (filters.error !== undefined && metadata.error !== filters.error) {
        return false;
      }

      return true;
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let conversationMemoryManager: ConversationMemoryManager | null = null;

export function getConversationMemoryManager(
  vectorStore?: VectorStore,
  embeddingProvider?: EmbeddingProvider
): ConversationMemoryManager {
  if (!conversationMemoryManager) {
    conversationMemoryManager = new ConversationMemoryManager(
      vectorStore,
      embeddingProvider
    );
  }
  return conversationMemoryManager;
}

// Cleanup on process exit
process.on('exit', () => {
  if (conversationMemoryManager) {
    conversationMemoryManager.cleanup().catch(console.error);
  }
});

process.on('SIGINT', async () => {
  if (conversationMemoryManager) {
    await conversationMemoryManager.cleanup();
  }
  process.exit(0);
});
