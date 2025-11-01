/**
 * Vector Database Type Definitions
 *
 * Defines types for semantic memory and vector-based retrieval.
 */

// ============================================================================
// Vector Types
// ============================================================================

export interface Vector {
  id: string;
  embedding: number[];
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface VectorSearchResult {
  id: string;
  score: number; // Cosine similarity score (0-1)
  metadata: Record<string, any>;
  content?: string;
}

// ============================================================================
// Conversation Memory Types
// ============================================================================

export interface ConversationMemory {
  id: string;
  conversationId: string;
  agentName?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  embedding?: number[];
  timestamp: Date;
  metadata: {
    tokenCount?: number;
    tools?: string[];
    error?: boolean;
    success?: boolean;
    tags?: string[];
    [key: string]: any;
  };
}

export interface MemorySearchQuery {
  text: string;
  filters?: MemoryFilter;
  limit?: number;
  threshold?: number; // Minimum similarity score (0-1)
}

export interface MemoryFilter {
  conversationId?: string;
  agentName?: string;
  role?: 'user' | 'assistant' | 'system';
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  success?: boolean;
  error?: boolean;
}

// ============================================================================
// Embedding Provider Interface
// ============================================================================

export interface EmbeddingProvider {
  /**
   * Generate embeddings for a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batched)
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get the dimension of embeddings produced
   */
  getDimension(): number;

  /**
   * Get the maximum text length supported
   */
  getMaxLength(): number;

  /**
   * Get the provider name
   */
  getName(): string;
}

// ============================================================================
// Vector Store Configuration
// ============================================================================

export interface VectorStoreConfig {
  persistPath?: string;
  autoSave?: boolean;
  saveInterval?: number;
  maxVectors?: number;
  dimension?: number;
}

// ============================================================================
// Collection Interface
// ============================================================================

export interface Collection {
  name: string;
  dimension: number;
  vectorCount: number;
  createdAt: Date;
  metadata: Record<string, any>;
}
