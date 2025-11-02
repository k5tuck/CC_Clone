/**
 * Vector Storage
 * Wrapper around VectorStore for semantic search
 */

import { VectorStore } from '../memory/VectorStore';

/**
 * Vector item for storage
 */
export interface VectorItem {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Search result
 */
export interface VectorSearchResult {
  item: VectorItem;
  score: number;
}

/**
 * Vector Storage - wraps VectorStore for semantic search
 */
export class VectorStorage {
  private store: VectorStore;
  private items: Map<string, VectorItem> = new Map();

  constructor() {
    this.store = new VectorStore({
      autoSave: false, // We don't need persistence for search index
    });
  }

  /**
   * Add an item to the storage
   */
  async addItem(item: VectorItem): Promise<void> {
    this.items.set(item.id, item);

    // Create a simple embedding from the content
    // In a real implementation, you would use an actual embedding model
    const embedding = this.createSimpleEmbedding(item.content);

    await this.store.add({
      embedding,
      metadata: {
        itemId: item.id,
        ...item.metadata,
      },
    });
  }

  /**
   * Search for similar items
   */
  async search(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
    const queryEmbedding = this.createSimpleEmbedding(query);

    const results = await this.store.search(queryEmbedding, limit);

    return results.map(result => {
      const itemId = result.metadata?.itemId as string;
      const item = this.items.get(itemId);

      return {
        item: item || { id: itemId, content: '' },
        score: result.score,
      };
    }).filter(r => r.item.content); // Filter out items that weren't found
  }

  /**
   * Create a simple embedding from text
   * This is a placeholder - in production, use an actual embedding model
   */
  private createSimpleEmbedding(text: string): number[] {
    // Simple hash-based embedding (for demonstration)
    // In production, use actual embeddings from OpenAI, Cohere, etc.
    const embedding = new Array(384).fill(0); // Smaller dimension for simplicity

    // Create a deterministic but distributed embedding
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode * 7) % embedding.length;
      embedding[index] += Math.sin(charCode) * 0.1;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items.clear();
    // VectorStore doesn't have a clear method, so we'll just create a new one
    this.store = new VectorStore({ autoSave: false });
  }
}
