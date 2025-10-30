import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Message } from '../llm/ollama-client';
import { ConversationTurn } from '../agent';

/**
 * Custom exceptions for conversation persistence
 */
export class ConversationLoadError extends Error {
  constructor(
    public readonly conversationId: string,
    public readonly originalError: Error
  ) {
    super(`Failed to load conversation ${conversationId}: ${originalError.message}`);
    this.name = 'ConversationLoadError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConversationSaveError extends Error {
  constructor(
    public readonly conversationId: string,
    public readonly originalError: Error
  ) {
    super(`Failed to save conversation ${conversationId}: ${originalError.message}`);
    this.name = 'ConversationSaveError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Conversation metadata
 */
export interface ConversationMetadata {
  id: string;
  agentName: string;
  agentRole: string;
  created: string;
  updated: string;
  turnCount: number;
  tags: string[];
  summary?: string;
}

/**
 * Complete conversation data
 */
export interface ConversationData {
  metadata: ConversationMetadata;
  turns: ConversationTurn[];
  messages: Message[];
}

/**
 * Manages conversation persistence to disk
 */
export class ConversationStore {
  private baseDir: string;
  private conversationsDir: string;
  private indexFile: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(
      process.env.AGENT_HOME || os.homedir() + '/.local-agent',
      'conversations'
    );
    this.conversationsDir = path.join(this.baseDir, 'data');
    this.indexFile = path.join(this.baseDir, 'index.json');
  }

  /**
   * Initialize the conversation store
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.conversationsDir, { recursive: true });
    
    try {
      await fs.access(this.indexFile);
    } catch {
      await this.saveIndex([]);
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    agentName: string,
    agentRole: string,
    tags: string[] = []
  ): Promise<string> {
    const conversationId = this.generateId();
    const now = new Date().toISOString();

    const metadata: ConversationMetadata = {
      id: conversationId,
      agentName,
      agentRole,
      created: now,
      updated: now,
      turnCount: 0,
      tags,
    };

    const data: ConversationData = {
      metadata,
      turns: [],
      messages: [],
    };

    await this.saveConversation(data);
    await this.addToIndex(metadata);

    return conversationId;
  }

  /**
   * Load a conversation by ID
   */
  async loadConversation(conversationId: string): Promise<ConversationData> {
    try {
      const filePath = this.getConversationPath(conversationId);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      throw new ConversationLoadError(conversationId, error);
    }
  }

  /**
   * Save a conversation
   */
  async saveConversation(data: ConversationData): Promise<void> {
    try {
      data.metadata.updated = new Date().toISOString();
      data.metadata.turnCount = data.turns.length;

      const filePath = this.getConversationPath(data.metadata.id);
      await fs.writeFile(
        filePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );

      // Update index
      await this.updateIndexMetadata(data.metadata);
    } catch (error: any) {
      throw new ConversationSaveError(data.metadata.id, error);
    }
  }

  /**
   * Append a turn to a conversation
   */
  async appendTurn(
    conversationId: string,
    turn: ConversationTurn
  ): Promise<void> {
    const data = await this.loadConversation(conversationId);
    data.turns.push(turn);
    data.messages.push(...turn.messages);
    await this.saveConversation(data);
  }

  /**
   * Add messages to a conversation
   */
  async appendMessages(
    conversationId: string,
    messages: Message[]
  ): Promise<void> {
    const data = await this.loadConversation(conversationId);
    data.messages.push(...messages);
    await this.saveConversation(data);
  }

  /**
   * List all conversations
   */
  async listConversations(filter?: {
    agentName?: string;
    agentRole?: string;
    tags?: string[];
  }): Promise<ConversationMetadata[]> {
    const index = await this.loadIndex();
    
    if (!filter) {
      return index;
    }

    return index.filter(meta => {
      if (filter.agentName && meta.agentName !== filter.agentName) {
        return false;
      }
      if (filter.agentRole && meta.agentRole !== filter.agentRole) {
        return false;
      }
      if (filter.tags && !filter.tags.every(tag => meta.tags.includes(tag))) {
        return false;
      }
      return true;
    });
  }

  /**
   * Search conversations by content
   */
  async searchConversations(query: string): Promise<ConversationMetadata[]> {
    const index = await this.loadIndex();
    const results: ConversationMetadata[] = [];

    for (const meta of index) {
      try {
        const data = await this.loadConversation(meta.id);
        const searchable = JSON.stringify(data.messages).toLowerCase();
        
        if (searchable.includes(query.toLowerCase())) {
          results.push(meta);
        }
      } catch {
        // Skip conversations that can't be loaded
        continue;
      }
    }

    return results;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const filePath = this.getConversationPath(conversationId);
      await fs.unlink(filePath);
      await this.removeFromIndex(conversationId);
    } catch (error: any) {
      throw new Error(`Failed to delete conversation ${conversationId}: ${error.message}`);
    }
  }

  /**
   * Update conversation summary
   */
  async updateSummary(
    conversationId: string,
    summary: string
  ): Promise<void> {
    const data = await this.loadConversation(conversationId);
    data.metadata.summary = summary;
    await this.saveConversation(data);
  }

  /**
   * Add tags to a conversation
   */
  async addTags(conversationId: string, tags: string[]): Promise<void> {
    const data = await this.loadConversation(conversationId);
    const newTags = [...new Set([...data.metadata.tags, ...tags])];
    data.metadata.tags = newTags;
    await this.saveConversation(data);
  }

  /**
   * Get conversation statistics
   */
  async getStatistics(): Promise<{
    totalConversations: number;
    totalTurns: number;
    totalMessages: number;
    byAgent: Record<string, number>;
    byRole: Record<string, number>;
  }> {
    const index = await this.loadIndex();

    const stats = {
      totalConversations: index.length,
      totalTurns: 0,
      totalMessages: 0,
      byAgent: {} as Record<string, number>,
      byRole: {} as Record<string, number>,
    };

    for (const meta of index) {
      stats.totalTurns += meta.turnCount;
      stats.byAgent[meta.agentName] = (stats.byAgent[meta.agentName] || 0) + 1;
      stats.byRole[meta.agentRole] = (stats.byRole[meta.agentRole] || 0) + 1;

      try {
        const data = await this.loadConversation(meta.id);
        stats.totalMessages += data.messages.length;
      } catch {
        // Skip if can't load
      }
    }

    return stats;
  }

  /**
   * Generate a unique conversation ID
   */
  private generateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `conv-${timestamp}-${random}`;
  }

  /**
   * Get file path for a conversation
   */
  private getConversationPath(conversationId: string): string {
    return path.join(this.conversationsDir, `${conversationId}.json`);
  }

  /**
   * Load the conversation index
   */
  private async loadIndex(): Promise<ConversationMetadata[]> {
    try {
      const content = await fs.readFile(this.indexFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  /**
   * Save the conversation index
   */
  private async saveIndex(index: ConversationMetadata[]): Promise<void> {
    await fs.writeFile(
      this.indexFile,
      JSON.stringify(index, null, 2),
      'utf-8'
    );
  }

  /**
   * Add conversation metadata to index
   */
  private async addToIndex(metadata: ConversationMetadata): Promise<void> {
    const index = await this.loadIndex();
    index.push(metadata);
    await this.saveIndex(index);
  }

  /**
   * Update conversation metadata in index
   */
  private async updateIndexMetadata(metadata: ConversationMetadata): Promise<void> {
    const index = await this.loadIndex();
    const i = index.findIndex(m => m.id === metadata.id);
    
    if (i >= 0) {
      index[i] = metadata;
      await this.saveIndex(index);
    }
  }

  /**
   * Remove conversation from index
   */
  private async removeFromIndex(conversationId: string): Promise<void> {
    const index = await this.loadIndex();
    const filtered = index.filter(m => m.id !== conversationId);
    await this.saveIndex(filtered);
  }
}
