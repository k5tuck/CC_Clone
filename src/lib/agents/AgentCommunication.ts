/**
 * Agent Communication Log
 * Tracks agent-to-agent messages and collaboration
 */

import { EventEmitter } from 'events';

/**
 * Message type
 */
export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  NOTIFICATION = 'notification',
  ERROR = 'error',
  HANDOFF = 'handoff',
  BROADCAST = 'broadcast',
}

/**
 * Message priority
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Inter-agent message
 */
export interface InterAgentMessage {
  id: string;
  from: string;
  to: string | string[];
  type: MessageType;
  priority: MessagePriority;
  subject: string;
  content: any;
  timestamp: Date;
  responseToId?: string;
  metadata?: Record<string, any>;
  read: boolean;
  archived: boolean;
}

/**
 * Conversation thread
 */
export interface ConversationThread {
  id: string;
  participants: string[];
  subject: string;
  messages: InterAgentMessage[];
  startTime: Date;
  lastActivity: Date;
  status: 'active' | 'completed' | 'archived';
}

/**
 * Communication statistics
 */
export interface CommunicationStats {
  totalMessages: number;
  messagesByType: Map<MessageType, number>;
  messagesByAgent: Map<string, number>;
  activeThreads: number;
  averageResponseTime: number;
  mostActiveAgent: string | null;
  peakHours: Map<number, number>;
}

/**
 * Agent Communication Log
 */
export class AgentCommunicationLog extends EventEmitter {
  private messages: Map<string, InterAgentMessage> = new Map();
  private threads: Map<string, ConversationThread> = new Map();
  private messageHistory: InterAgentMessage[] = [];
  private maxHistorySize = 1000;

  /**
   * Send a message from one agent to another
   */
  sendMessage(
    from: string,
    to: string | string[],
    subject: string,
    content: any,
    options: {
      type?: MessageType;
      priority?: MessagePriority;
      responseToId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): string {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const message: InterAgentMessage = {
      id,
      from,
      to,
      type: options.type || MessageType.REQUEST,
      priority: options.priority || MessagePriority.NORMAL,
      subject,
      content,
      timestamp: new Date(),
      responseToId: options.responseToId,
      metadata: options.metadata,
      read: false,
      archived: false,
    };

    // Store message
    this.messages.set(id, message);
    this.messageHistory.unshift(message);

    // Limit history size
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(0, this.maxHistorySize);
    }

    // Find or create thread
    const threadId = this.findOrCreateThread(message);

    // Emit event
    this.emit('message:sent', { message, threadId });

    return id;
  }

  /**
   * Find or create a conversation thread
   */
  private findOrCreateThread(message: InterAgentMessage): string {
    // If this is a response, add to existing thread
    if (message.responseToId) {
      const originalMessage = this.messages.get(message.responseToId);
      if (originalMessage) {
        const existingThread = this.findThreadByMessage(originalMessage);
        if (existingThread) {
          existingThread.messages.push(message);
          existingThread.lastActivity = new Date();
          this.emit('thread:updated', existingThread);
          return existingThread.id;
        }
      }
    }

    // Find thread by participants and subject
    const participants = [
      message.from,
      ...(Array.isArray(message.to) ? message.to : [message.to]),
    ].sort();

    for (const thread of this.threads.values()) {
      if (
        thread.subject === message.subject &&
        this.arraysEqual(thread.participants.sort(), participants) &&
        thread.status === 'active'
      ) {
        thread.messages.push(message);
        thread.lastActivity = new Date();
        this.emit('thread:updated', thread);
        return thread.id;
      }
    }

    // Create new thread
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const thread: ConversationThread = {
      id: threadId,
      participants,
      subject: message.subject,
      messages: [message],
      startTime: new Date(),
      lastActivity: new Date(),
      status: 'active',
    };

    this.threads.set(threadId, thread);
    this.emit('thread:created', thread);

    return threadId;
  }

  /**
   * Find thread by message
   */
  private findThreadByMessage(message: InterAgentMessage): ConversationThread | null {
    for (const thread of this.threads.values()) {
      if (thread.messages.some(m => m.id === message.id)) {
        return thread;
      }
    }
    return null;
  }

  /**
   * Check if arrays are equal
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Get messages for an agent
   */
  getMessagesForAgent(agentId: string, unreadOnly: boolean = false): InterAgentMessage[] {
    return this.messageHistory.filter(msg => {
      const isRecipient = Array.isArray(msg.to)
        ? msg.to.includes(agentId)
        : msg.to === agentId;
      const matchesRead = !unreadOnly || !msg.read;
      return isRecipient && matchesRead && !msg.archived;
    });
  }

  /**
   * Get messages sent by an agent
   */
  getMessagesSentBy(agentId: string): InterAgentMessage[] {
    return this.messageHistory.filter(msg => msg.from === agentId && !msg.archived);
  }

  /**
   * Get a conversation thread
   */
  getThread(threadId: string): ConversationThread | undefined {
    return this.threads.get(threadId);
  }

  /**
   * Get all threads involving an agent
   */
  getThreadsForAgent(agentId: string): ConversationThread[] {
    return Array.from(this.threads.values()).filter(thread =>
      thread.participants.includes(agentId)
    );
  }

  /**
   * Get active threads
   */
  getActiveThreads(): ConversationThread[] {
    return Array.from(this.threads.values()).filter(
      thread => thread.status === 'active'
    );
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId: string): void {
    const message = this.messages.get(messageId);
    if (message) {
      message.read = true;
      this.emit('message:read', message);
    }
  }

  /**
   * Archive a message
   */
  archiveMessage(messageId: string): void {
    const message = this.messages.get(messageId);
    if (message) {
      message.archived = true;
      this.emit('message:archived', message);
    }
  }

  /**
   * Complete a thread
   */
  completeThread(threadId: string): void {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.status = 'completed';
      this.emit('thread:completed', thread);
    }
  }

  /**
   * Archive a thread
   */
  archiveThread(threadId: string): void {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.status = 'archived';
      thread.messages.forEach(msg => (msg.archived = true));
      this.emit('thread:archived', thread);
    }
  }

  /**
   * Get communication statistics
   */
  getStats(): CommunicationStats {
    const messagesByType = new Map<MessageType, number>();
    const messagesByAgent = new Map<string, number>();
    const peakHours = new Map<number, number>();

    for (const message of this.messageHistory) {
      // Count by type
      messagesByType.set(
        message.type,
        (messagesByType.get(message.type) || 0) + 1
      );

      // Count by agent
      messagesByAgent.set(
        message.from,
        (messagesByAgent.get(message.from) || 0) + 1
      );

      // Count by hour
      const hour = message.timestamp.getHours();
      peakHours.set(hour, (peakHours.get(hour) || 0) + 1);
    }

    // Find most active agent
    let mostActiveAgent: string | null = null;
    let maxMessages = 0;
    for (const [agent, count] of messagesByAgent) {
      if (count > maxMessages) {
        maxMessages = count;
        mostActiveAgent = agent;
      }
    }

    // Calculate average response time
    let totalResponseTime = 0;
    let responseCount = 0;
    for (const message of this.messageHistory) {
      if (message.responseToId) {
        const original = this.messages.get(message.responseToId);
        if (original) {
          totalResponseTime +=
            message.timestamp.getTime() - original.timestamp.getTime();
          responseCount++;
        }
      }
    }
    const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    return {
      totalMessages: this.messageHistory.length,
      messagesByType,
      messagesByAgent,
      activeThreads: this.getActiveThreads().length,
      averageResponseTime,
      mostActiveAgent,
      peakHours,
    };
  }

  /**
   * Search messages
   */
  searchMessages(query: string): InterAgentMessage[] {
    const lowerQuery = query.toLowerCase();
    return this.messageHistory.filter(
      msg =>
        msg.subject.toLowerCase().includes(lowerQuery) ||
        JSON.stringify(msg.content).toLowerCase().includes(lowerQuery) ||
        msg.from.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Clear archived messages
   */
  clearArchived(): void {
    this.messageHistory = this.messageHistory.filter(msg => !msg.archived);
    for (const [id, thread] of this.threads) {
      if (thread.status === 'archived') {
        this.threads.delete(id);
      }
    }
    this.emit('archived:cleared');
  }
}

// Singleton instance
let communicationLogInstance: AgentCommunicationLog | null = null;

/**
 * Get the global agent communication log
 */
export function getAgentCommunicationLog(): AgentCommunicationLog {
  if (!communicationLogInstance) {
    communicationLogInstance = new AgentCommunicationLog();
  }
  return communicationLogInstance;
}
