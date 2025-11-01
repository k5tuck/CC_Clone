/**
 * Embedding Providers
 *
 * Implementations for generating text embeddings using various LLM providers.
 */

import OpenAI from 'openai';
import { EmbeddingProvider } from './types';

// ============================================================================
// OpenAI Embedding Provider
// ============================================================================

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;
  private model: string;
  private dimension: number;
  private maxLength: number;

  constructor(apiKey?: string, model: string = 'text-embedding-ada-002') {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = model;
    this.dimension = model === 'text-embedding-3-small' ? 1536 : 1536;
    this.maxLength = 8191; // tokens
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      console.error('OpenAI batch embedding error:', error);
      throw error;
    }
  }

  getDimension(): number {
    return this.dimension;
  }

  getMaxLength(): number {
    return this.maxLength;
  }

  getName(): string {
    return `OpenAI (${this.model})`;
  }
}

// ============================================================================
// Simple Hash-based Embedding Provider (Fallback)
// ============================================================================

/**
 * Simple hash-based embedding provider for testing/fallback
 * NOTE: This is NOT semantic - it's deterministic hashing for demo purposes
 */
export class SimpleEmbeddingProvider implements EmbeddingProvider {
  private dimension: number;

  constructor(dimension: number = 384) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    return this.hashToVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.hashToVector(text));
  }

  getDimension(): number {
    return this.dimension;
  }

  getMaxLength(): number {
    return 10000; // characters
  }

  getName(): string {
    return 'Simple Hash';
  }

  /**
   * Hash text to a deterministic vector
   * NOTE: This is not semantic similarity - just for testing
   */
  private hashToVector(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);

    // Simple character-based hashing
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = charCode % this.dimension;
      vector[index] += 1;
    }

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createEmbeddingProvider(
  provider: 'openai' | 'simple' = 'simple',
  config?: any
): EmbeddingProvider {
  switch (provider) {
    case 'openai':
      if (!process.env.OPENAI_API_KEY && !config?.apiKey) {
        console.warn('OpenAI API key not found, falling back to SimpleEmbeddingProvider');
        return new SimpleEmbeddingProvider();
      }
      return new OpenAIEmbeddingProvider(config?.apiKey, config?.model);

    case 'simple':
      return new SimpleEmbeddingProvider(config?.dimension);

    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}

// ============================================================================
// Embedding Cache
// ============================================================================

/**
 * Cache embeddings to avoid redundant API calls
 */
export class EmbeddingCache {
  private cache: Map<string, { embedding: number[]; timestamp: number }>;
  private maxSize: number;
  private ttl: number; // milliseconds

  constructor(maxSize: number = 1000, ttl: number = 86400000) {
    // 24 hours
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Get cached embedding
   */
  get(text: string): number[] | null {
    const hash = this.hashText(text);
    const cached = this.cache.get(hash);

    if (!cached) {
      return null;
    }

    // Check TTL
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(hash);
      return null;
    }

    return cached.embedding;
  }

  /**
   * Set cached embedding
   */
  set(text: string, embedding: number[]): void {
    const hash = this.hashText(text);

    // Evict oldest entry if at max size
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(hash, {
      embedding,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  private hashText(text: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}

// ============================================================================
// Cached Embedding Provider Wrapper
// ============================================================================

export class CachedEmbeddingProvider implements EmbeddingProvider {
  private provider: EmbeddingProvider;
  private cache: EmbeddingCache;

  constructor(provider: EmbeddingProvider, cacheSize?: number, cacheTTL?: number) {
    this.provider = provider;
    this.cache = new EmbeddingCache(cacheSize, cacheTTL);
  }

  async embed(text: string): Promise<number[]> {
    // Check cache first
    const cached = this.cache.get(text);
    if (cached) {
      return cached;
    }

    // Generate embedding
    const embedding = await this.provider.embed(text);

    // Cache it
    this.cache.set(text, embedding);

    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const textsToEmbed: string[] = [];
    const indices: number[] = [];

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const cached = this.cache.get(texts[i]);
      if (cached) {
        results[i] = cached;
      } else {
        textsToEmbed.push(texts[i]);
        indices.push(i);
      }
    }

    // Generate embeddings for uncached texts
    if (textsToEmbed.length > 0) {
      const embeddings = await this.provider.embedBatch(textsToEmbed);

      for (let i = 0; i < textsToEmbed.length; i++) {
        const embedding = embeddings[i];
        const originalIndex = indices[i];
        results[originalIndex] = embedding;

        // Cache it
        this.cache.set(textsToEmbed[i], embedding);
      }
    }

    return results;
  }

  getDimension(): number {
    return this.provider.getDimension();
  }

  getMaxLength(): number {
    return this.provider.getMaxLength();
  }

  getName(): string {
    return `${this.provider.getName()} (Cached)`;
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache(): void {
    this.cache.clear();
  }
}
