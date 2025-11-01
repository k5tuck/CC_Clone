/**
 * Vector Store
 *
 * Lightweight vector database with cosine similarity search.
 * Pure TypeScript implementation - no native dependencies.
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Vector, VectorSearchResult, VectorStoreConfig } from './types';

// ============================================================================
// Vector Store Implementation
// ============================================================================

export class VectorStore {
  private vectors: Map<string, Vector>;
  private config: Required<VectorStoreConfig>;
  private saveTimer?: NodeJS.Timeout;
  private dirty: boolean = false;

  constructor(config?: VectorStoreConfig) {
    this.vectors = new Map();
    this.config = {
      persistPath: path.join(
        process.env.HOME || process.env.USERPROFILE || '',
        '.local-agent',
        'memory',
        'vectors.json'
      ),
      autoSave: true,
      saveInterval: 30000, // 30 seconds
      maxVectors: 10000,
      dimension: 1536, // OpenAI ada-002 dimension
      ...config,
    };

    if (this.config.autoSave) {
      this.setupAutoSave();
    }
  }

  /**
   * Add a vector to the store
   */
  async add(vector: Omit<Vector, 'id' | 'createdAt'>): Promise<string> {
    const id = uuidv4();
    const fullVector: Vector = {
      id,
      ...vector,
      createdAt: new Date(),
    };

    // Validate dimension
    if (fullVector.embedding.length !== this.config.dimension) {
      throw new Error(
        `Embedding dimension mismatch: expected ${this.config.dimension}, got ${fullVector.embedding.length}`
      );
    }

    // Check max vectors limit
    if (this.vectors.size >= this.config.maxVectors) {
      // Remove oldest vector
      const oldest = Array.from(this.vectors.values()).sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      )[0];
      this.vectors.delete(oldest.id);
    }

    this.vectors.set(id, fullVector);
    this.dirty = true;

    return id;
  }

  /**
   * Add multiple vectors in batch
   */
  async addBatch(vectors: Array<Omit<Vector, 'id' | 'createdAt'>>): Promise<string[]> {
    const ids: string[] = [];
    for (const vector of vectors) {
      const id = await this.add(vector);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Get a vector by ID
   */
  async get(id: string): Promise<Vector | null> {
    return this.vectors.get(id) || null;
  }

  /**
   * Delete a vector by ID
   */
  async delete(id: string): Promise<boolean> {
    const deleted = this.vectors.delete(id);
    if (deleted) {
      this.dirty = true;
    }
    return deleted;
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async search(
    queryEmbedding: number[],
    limit: number = 10,
    threshold: number = 0.0,
    filter?: (metadata: Record<string, any>) => boolean
  ): Promise<VectorSearchResult[]> {
    // Validate dimension
    if (queryEmbedding.length !== this.config.dimension) {
      throw new Error(
        `Query embedding dimension mismatch: expected ${this.config.dimension}, got ${queryEmbedding.length}`
      );
    }

    const results: VectorSearchResult[] = [];

    for (const vector of this.vectors.values()) {
      // Apply metadata filter if provided
      if (filter && !filter(vector.metadata)) {
        continue;
      }

      // Calculate cosine similarity
      const score = this.cosineSimilarity(queryEmbedding, vector.embedding);

      // Apply threshold
      if (score >= threshold) {
        results.push({
          id: vector.id,
          score,
          metadata: vector.metadata,
        });
      }
    }

    // Sort by score (descending) and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Update vector metadata
   */
  async updateMetadata(id: string, metadata: Record<string, any>): Promise<boolean> {
    const vector = this.vectors.get(id);
    if (!vector) {
      return false;
    }

    vector.metadata = { ...vector.metadata, ...metadata };
    this.dirty = true;
    return true;
  }

  /**
   * Get all vectors matching a metadata filter
   */
  async query(filter: (metadata: Record<string, any>) => boolean): Promise<Vector[]> {
    const results: Vector[] = [];

    for (const vector of this.vectors.values()) {
      if (filter(vector.metadata)) {
        results.push(vector);
      }
    }

    return results;
  }

  /**
   * Get count of vectors in store
   */
  count(): number {
    return this.vectors.size;
  }

  /**
   * Clear all vectors
   */
  async clear(): Promise<void> {
    this.vectors.clear();
    this.dirty = true;
  }

  /**
   * Save vectors to disk
   */
  async save(): Promise<void> {
    if (!this.dirty) {
      return; // No changes to save
    }

    try {
      const data = {
        version: '1.0',
        dimension: this.config.dimension,
        count: this.vectors.size,
        vectors: Array.from(this.vectors.values()),
        savedAt: new Date().toISOString(),
      };

      // Ensure directory exists
      const dir = path.dirname(this.config.persistPath);
      await fs.mkdir(dir, { recursive: true });

      // Write to temp file first
      const tempPath = `${this.config.persistPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(data), 'utf-8');

      // Atomic rename
      await fs.rename(tempPath, this.config.persistPath);

      this.dirty = false;
    } catch (error) {
      console.error('Failed to save vector store:', error);
      throw error;
    }
  }

  /**
   * Load vectors from disk
   */
  async load(): Promise<void> {
    try {
      const json = await fs.readFile(this.config.persistPath, 'utf-8');
      const data = JSON.parse(json);

      // Validate dimension
      if (data.dimension !== this.config.dimension) {
        console.warn(
          `Dimension mismatch: stored ${data.dimension}, expected ${this.config.dimension}. Clearing store.`
        );
        return;
      }

      // Load vectors
      this.vectors.clear();
      for (const vectorData of data.vectors) {
        const vector: Vector = {
          ...vectorData,
          createdAt: new Date(vectorData.createdAt),
        };
        this.vectors.set(vector.id, vector);
      }

      this.dirty = false;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, that's okay
        return;
      }
      console.error('Failed to load vector store:', error);
      throw error;
    }
  }

  /**
   * Get statistics about the store
   */
  getStats(): {
    count: number;
    dimension: number;
    memoryUsage: number;
    oldestVector: Date | null;
    newestVector: Date | null;
  } {
    const vectors = Array.from(this.vectors.values());
    const memoryUsage = vectors.reduce(
      (sum, v) => sum + v.embedding.length * 8 + JSON.stringify(v.metadata).length,
      0
    );

    let oldest: Date | null = null;
    let newest: Date | null = null;

    if (vectors.length > 0) {
      oldest = vectors[0].createdAt;
      newest = vectors[0].createdAt;

      for (const vector of vectors) {
        if (vector.createdAt < oldest!) oldest = vector.createdAt;
        if (vector.createdAt > newest!) newest = vector.createdAt;
      }
    }

    return {
      count: this.vectors.size,
      dimension: this.config.dimension,
      memoryUsage,
      oldestVector: oldest,
      newestVector: newest,
    };
  }

  /**
   * Export vectors to JSON
   */
  async export(exportPath: string): Promise<void> {
    const data = {
      version: '1.0',
      dimension: this.config.dimension,
      count: this.vectors.size,
      vectors: Array.from(this.vectors.values()),
      exportedAt: new Date().toISOString(),
    };

    await fs.writeFile(exportPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Import vectors from JSON
   */
  async import(importPath: string): Promise<number> {
    const json = await fs.readFile(importPath, 'utf-8');
    const data = JSON.parse(json);

    if (data.dimension !== this.config.dimension) {
      throw new Error(
        `Dimension mismatch: imported ${data.dimension}, expected ${this.config.dimension}`
      );
    }

    let imported = 0;
    for (const vectorData of data.vectors) {
      const vector: Vector = {
        ...vectorData,
        createdAt: new Date(vectorData.createdAt),
      };

      if (!this.vectors.has(vector.id)) {
        this.vectors.set(vector.id, vector);
        imported++;
      }
    }

    this.dirty = true;
    return imported;
  }

  /**
   * Cleanup - save and stop auto-save
   */
  async cleanup(): Promise<void> {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }

    if (this.dirty) {
      await this.save();
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Setup auto-save timer
   */
  private setupAutoSave(): void {
    this.saveTimer = setInterval(async () => {
      if (this.dirty) {
        try {
          await this.save();
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, this.config.saveInterval);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize a vector (make it unit length)
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  return vector.map((val) => val / magnitude);
}

/**
 * Calculate Euclidean distance between two vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate dot product of two vectors
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }

  return sum;
}

// Cleanup on process exit
process.on('exit', () => {
  // Note: Async operations won't complete in exit handler
  // Use SIGINT/SIGTERM for graceful shutdown
});

let cleanupRegistered = false;
export function registerCleanup(store: VectorStore): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const cleanup = async () => {
    await store.cleanup();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
