import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    agentId?: string;
    toolName?: string;
    toolArgs?: any;
    toolResult?: any;
    streamComplete?: boolean;
    tokenCount?: number;
    error?: Error;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  metadata?: {
    agents?: string[];
    tags?: string[];
    archived?: boolean;
  };
}

export interface SearchOptions {
  conversationId?: string;
  role?: Message['role'];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

export interface SearchResult {
  message: Message;
  score: number;
  highlights: string[];
}

export interface ConversationStats {
  totalConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  oldestConversation?: Date;
  newestConversation?: Date;
}

export class ConversationHistoryManager {
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private maxMessagesPerConversation: number = 1000;

  async initialize(): Promise<void> {
    // In-memory implementation for now
    // Can be extended to use SQLite/Postgres later
    console.log('ConversationHistoryManager initialized');
  }

  async createConversation(title: string, metadata?: Conversation['metadata']): Promise<string> {
    const id = uuidv4();
    const conversation: Conversation = {
      id,
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
      metadata,
    };

    this.conversations.set(id, conversation);
    this.messages.set(id, []);

    return id;
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversations.get(conversationId) || null;
  }

  async conversationExists(conversationId: string): Promise<boolean> {
    return this.conversations.has(conversationId);
  }

  async saveMessage(conversationId: string, message: Omit<Message, 'id' | 'conversationId' | 'timestamp'>): Promise<string> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const fullMessage: Message = {
      id: uuidv4(),
      conversationId,
      timestamp: new Date(),
      ...message,
    };

    const messages = this.messages.get(conversationId) || [];
    messages.push(fullMessage);

    // Limit message history
    if (messages.length > this.maxMessagesPerConversation) {
      messages.shift();
    }

    this.messages.set(conversationId, messages);

    // Update conversation
    conversation.messageCount = messages.length;
    conversation.updatedAt = new Date();

    return fullMessage.id;
  }

  async getHistory(conversationId: string, limit?: number): Promise<Message[]> {
    const messages = this.messages.get(conversationId) || [];
    
    if (limit && limit > 0) {
      return messages.slice(-limit);
    }

    return messages;
  }

  async getContext(conversationId: string, maxTokens: number = 8000): Promise<Message[]> {
    const history = await this.getHistory(conversationId);
    
    // Simple token estimation: ~4 chars per token
    let tokenCount = 0;
    const contextMessages: Message[] = [];
    
    // Always include system message if present
    const systemMsg = history.find(m => m.role === 'system');
    if (systemMsg) {
      contextMessages.push(systemMsg);
      tokenCount += Math.ceil(systemMsg.content.length / 4);
    }
    
    // Add recent messages until token limit
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'system') continue;
      
      const msgTokens = Math.ceil(msg.content.length / 4);
      if (tokenCount + msgTokens > maxTokens) break;
      
      contextMessages.unshift(msg);
      tokenCount += msgTokens;
    }
    
    return contextMessages;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.conversations.delete(conversationId);
    this.messages.delete(conversationId);
  }

  async listConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const [convId, messages] of this.messages.entries()) {
      if (options.conversationId && convId !== options.conversationId) {
        continue;
      }

      for (const message of messages) {
        // Apply filters
        if (options.role && message.role !== options.role) continue;
        if (options.dateFrom && message.timestamp < options.dateFrom) continue;
        if (options.dateTo && message.timestamp > options.dateTo) continue;

        // Simple text search
        const contentLower = message.content.toLowerCase();
        if (contentLower.includes(queryLower)) {
          results.push({
            message,
            score: this.calculateScore(message, queryLower),
            highlights: this.extractHighlights(message.content, query),
          });
        }
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    if (options.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  private calculateScore(message: Message, query: string): number {
    const content = message.content.toLowerCase();
    const occurrences = (content.match(new RegExp(query, 'gi')) || []).length;
    const recency = Date.now() - message.timestamp.getTime();
    const recencyScore = 1 / (1 + recency / (1000 * 60 * 60 * 24)); // Decay over days

    return occurrences * 10 + recencyScore;
  }

  private extractHighlights(content: string, query: string): string[] {
    const words = query.toLowerCase().split(' ');
    const sentences = content.split(/[.!?]+/);
    
    return sentences
      .filter(s => words.some(w => s.toLowerCase().includes(w)))
      .map(s => s.trim())
      .slice(0, 3);
  }

  async export(conversationId: string, format: 'json' | 'markdown' | 'txt'): Promise<string> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const messages = await this.getHistory(conversationId);

    switch (format) {
      case 'json':
        return JSON.stringify({
          version: '1.0',
          conversation,
          messages,
          exportedAt: new Date().toISOString(),
        }, null, 2);

      case 'markdown':
        return this.exportMarkdown(conversation, messages);

      case 'txt':
        return this.exportText(conversation, messages);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private exportMarkdown(conversation: Conversation, messages: Message[]): string {
    let md = `# ${conversation.title}\n\n`;
    md += `*Created: ${conversation.createdAt.toLocaleString()}*\n\n`;
    md += `---\n\n`;
    
    for (const msg of messages) {
      const icon = msg.role === 'user' ? '👤' : 
                   msg.role === 'assistant' ? '🤖' : 
                   msg.role === 'tool' ? '🔧' : '⚙️';
      
      md += `## ${icon} ${msg.role.toUpperCase()}\n`;
      md += `*${msg.timestamp.toLocaleString()}*\n\n`;
      md += `${msg.content}\n\n`;
      md += `---\n\n`;
    }
    
    return md;
  }

  private exportText(conversation: Conversation, messages: Message[]): string {
    let txt = `${conversation.title}\n`;
    txt += `${'='.repeat(conversation.title.length)}\n\n`;
    
    for (const msg of messages) {
      txt += `[${msg.timestamp.toLocaleString()}] ${msg.role}:\n`;
      txt += `${msg.content}\n\n`;
    }
    
    return txt;
  }

  async import(data: string): Promise<string> {
    const imported = JSON.parse(data);
    
    // Create new conversation with imported title
    const newId = await this.createConversation(
      imported.conversation.title + ' (imported)',
      imported.conversation.metadata
    );
    
    // Import messages
    for (const msg of imported.messages) {
      await this.saveMessage(newId, {
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata,
      });
    }
    
    return newId;
  }

  async getStatistics(conversationId?: string): Promise<ConversationStats> {
    if (conversationId) {
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      return {
        totalConversations: 1,
        totalMessages: conversation.messageCount,
        averageMessagesPerConversation: conversation.messageCount,
        oldestConversation: conversation.createdAt,
        newestConversation: conversation.updatedAt,
      };
    }

    const conversations = Array.from(this.conversations.values());
    const totalMessages = conversations.reduce((sum, c) => sum + c.messageCount, 0);
    
    return {
      totalConversations: conversations.length,
      totalMessages,
      averageMessagesPerConversation: conversations.length > 0 
        ? totalMessages / conversations.length 
        : 0,
      oldestConversation: conversations.length > 0
        ? new Date(Math.min(...conversations.map(c => c.createdAt.getTime())))
        : undefined,
      newestConversation: conversations.length > 0
        ? new Date(Math.max(...conversations.map(c => c.updatedAt.getTime())))
        : undefined,
    };
  }

  async close(): Promise<void> {
    // Clean up resources
    this.conversations.clear();
    this.messages.clear();
  }
}