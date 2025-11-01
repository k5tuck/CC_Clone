/**
 * Memory Tools
 *
 * Tools for agents to interact with semantic memory and vector database
 */

import { getConversationMemoryManager, ConversationMemoryManager } from '../memory';

// ============================================================================
// Tool Schemas
// ============================================================================

export const memoryToolSchemas = [
  {
    name: 'searchSimilarProblems',
    description: 'Search for similar problems that were solved before. Use this to learn from past successes and avoid repeating work.',
    parameters: {
      type: 'object',
      properties: {
        problemDescription: {
          type: 'string',
          description: 'Description of the current problem or task',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of similar problems to return',
          default: 5,
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity score (0-1)',
          default: 0.75,
        },
      },
      required: ['problemDescription'],
    },
  },
  {
    name: 'searchConversations',
    description: 'Search conversations semantically to find relevant past discussions. Use this to find context or learn from previous interactions.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        filters: {
          type: 'object',
          description: 'Optional filters',
          properties: {
            agentName: { type: 'string' },
            role: { type: 'string', enum: ['user', 'assistant', 'system'] },
            success: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 10,
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity score (0-1)',
          default: 0.7,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'getRelatedContext',
    description: 'Get semantically related context for a query using RAG (Retrieval Augmented Generation). Use this to enhance your understanding before responding.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The query to find context for',
        },
        limit: {
          type: 'number',
          description: 'Maximum context snippets to return',
          default: 5,
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity score (0-1)',
          default: 0.7,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'getConversationHistory',
    description: 'Get the full conversation history for a specific conversation ID.',
    parameters: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'The conversation ID to retrieve',
        },
        limit: {
          type: 'number',
          description: 'Maximum messages to return',
        },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'getMemoriesByAgent',
    description: 'Get all memories (conversation turns) from a specific agent.',
    parameters: {
      type: 'object',
      properties: {
        agentName: {
          type: 'string',
          description: 'The name of the agent',
        },
        limit: {
          type: 'number',
          description: 'Maximum memories to return',
          default: 20,
        },
      },
      required: ['agentName'],
    },
  },
  {
    name: 'getMemoryStats',
    description: 'Get statistics about the memory system including total memories, conversations, and agents.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

// ============================================================================
// Tool Implementations
// ============================================================================

export class MemoryTools {
  private memoryManager: ConversationMemoryManager;
  private initialized: boolean = false;

  constructor() {
    this.memoryManager = getConversationMemoryManager();
  }

  /**
   * Initialize the memory system
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.memoryManager.initialize();
      this.initialized = true;
    }
  }

  /**
   * Search for similar problems that were solved before
   */
  async searchSimilarProblems(args: {
    problemDescription: string;
    limit?: number;
    threshold?: number;
  }): Promise<Array<{
    content: string;
    score: number;
    agentName?: string;
    timestamp: Date;
    metadata: any;
  }>> {
    await this.initialize();

    const results = await this.memoryManager.findSimilarProblems(
      args.problemDescription,
      args.limit || 5
    );

    return results.map((r) => ({
      content: r.content,
      score: r.score,
      agentName: r.agentName,
      timestamp: r.timestamp,
      metadata: r.metadata,
    }));
  }

  /**
   * Search conversations semantically
   */
  async searchConversations(args: {
    query: string;
    filters?: {
      agentName?: string;
      role?: 'user' | 'assistant' | 'system';
      success?: boolean;
      tags?: string[];
    };
    limit?: number;
    threshold?: number;
  }): Promise<Array<{
    content: string;
    score: number;
    conversationId: string;
    agentName?: string;
    role: string;
    timestamp: Date;
  }>> {
    await this.initialize();

    const results = await this.memoryManager.searchSimilar({
      text: args.query,
      filters: args.filters,
      limit: args.limit || 10,
      threshold: args.threshold || 0.7,
    });

    return results.map((r) => ({
      content: r.content,
      score: r.score,
      conversationId: r.conversationId,
      agentName: r.agentName,
      role: r.role,
      timestamp: r.timestamp,
    }));
  }

  /**
   * Get related context using RAG
   */
  async getRelatedContext(args: {
    query: string;
    limit?: number;
    threshold?: number;
  }): Promise<string[]> {
    await this.initialize();

    return this.memoryManager.getRelatedContext(
      args.query,
      args.limit || 5,
      args.threshold || 0.7
    );
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(args: {
    conversationId: string;
    limit?: number;
  }): Promise<Array<{
    content: string;
    role: string;
    timestamp: Date;
    metadata: any;
  }>> {
    await this.initialize();

    const history = await this.memoryManager.getConversationHistory(
      args.conversationId,
      args.limit
    );

    return history.map((h) => ({
      content: h.content,
      role: h.role,
      timestamp: h.timestamp,
      metadata: h.metadata,
    }));
  }

  /**
   * Get memories by agent
   */
  async getMemoriesByAgent(args: {
    agentName: string;
    limit?: number;
  }): Promise<Array<{
    content: string;
    conversationId: string;
    role: string;
    timestamp: Date;
  }>> {
    await this.initialize();

    const memories = await this.memoryManager.getMemoriesByAgent(
      args.agentName,
      args.limit || 20
    );

    return memories.map((m) => ({
      content: m.content,
      conversationId: m.conversationId,
      role: m.role,
      timestamp: m.timestamp,
    }));
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<{
    totalMemories: number;
    uniqueConversations: number;
    uniqueAgents: number;
    memoryUsage: number;
    oldestMemory: Date | null;
    newestMemory: Date | null;
  }> {
    await this.initialize();
    return this.memoryManager.getStats();
  }

  /**
   * Add a memory (used internally by the system)
   */
  async addMemory(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    agentName?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    await this.initialize();

    return this.memoryManager.addMemory({
      conversationId,
      role,
      content,
      agentName,
      timestamp: new Date(),
      metadata: metadata || {},
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let memoryTools: MemoryTools | null = null;

export function getMemoryTools(): MemoryTools {
  if (!memoryTools) {
    memoryTools = new MemoryTools();
  }
  return memoryTools;
}
