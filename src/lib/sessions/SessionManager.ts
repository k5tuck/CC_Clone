/**
 * Session Manager
 * Manages multiple conversation sessions with metadata and switching
 */

/**
 * Session metadata
 */
export interface SessionMetadata {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
  model?: string;
  provider?: string;
  starred: boolean;
}

/**
 * Session template
 */
export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tags: string[];
  icon: string;
}

/**
 * Session Manager Class
 */
export class SessionManager {
  private sessions: Map<string, SessionMetadata> = new Map();
  private currentSessionId: string | null = null;
  private listeners: Set<(sessions: SessionMetadata[]) => void> = new Set();

  /**
   * Gets all sessions
   */
  getAllSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  /**
   * Gets a session by ID
   */
  getSession(sessionId: string): SessionMetadata | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Creates a new session
   */
  createSession(name: string, options?: {
    description?: string;
    tags?: string[];
    model?: string;
    provider?: string;
  }): SessionMetadata {
    const session: SessionMetadata = {
      id: this.generateSessionId(),
      name,
      description: options?.description,
      tags: options?.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
      model: options?.model,
      provider: options?.provider,
      starred: false,
    };

    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;
    this.notifyListeners();

    return session;
  }

  /**
   * Updates session metadata
   */
  updateSession(
    sessionId: string,
    updates: Partial<Omit<SessionMetadata, 'id' | 'createdAt'>>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    Object.assign(session, updates, {
      updatedAt: new Date(),
    });

    this.notifyListeners();
  }

  /**
   * Increments the message count for a session
   */
  incrementMessageCount(sessionId: string, lastMessage?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messageCount++;
    session.updatedAt = new Date();
    if (lastMessage) {
      session.lastMessage = lastMessage.substring(0, 100);
    }

    this.notifyListeners();
  }

  /**
   * Deletes a session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);

    // If we deleted the current session, switch to another
    if (this.currentSessionId === sessionId) {
      const sessions = this.getAllSessions();
      this.currentSessionId = sessions.length > 0 ? sessions[0].id : null;
    }

    this.notifyListeners();
  }

  /**
   * Switches to a different session
   */
  switchSession(sessionId: string): SessionMetadata | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    this.currentSessionId = sessionId;
    session.updatedAt = new Date();
    this.notifyListeners();

    return session;
  }

  /**
   * Gets the current session
   */
  getCurrentSession(): SessionMetadata | undefined {
    return this.currentSessionId
      ? this.sessions.get(this.currentSessionId)
      : undefined;
  }

  /**
   * Gets current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Toggles starred status
   */
  toggleStar(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.starred = !session.starred;
    this.notifyListeners();
  }

  /**
   * Adds a tag to a session
   */
  addTag(sessionId: string, tag: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (!session.tags.includes(tag)) {
      session.tags.push(tag);
      this.notifyListeners();
    }
  }

  /**
   * Removes a tag from a session
   */
  removeTag(sessionId: string, tag: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.tags = session.tags.filter(t => t !== tag);
    this.notifyListeners();
  }

  /**
   * Searches sessions by name or tags
   */
  searchSessions(query: string): SessionMetadata[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSessions().filter(
      session =>
        session.name.toLowerCase().includes(lowerQuery) ||
        session.description?.toLowerCase().includes(lowerQuery) ||
        session.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        session.lastMessage?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Gets sessions by tag
   */
  getSessionsByTag(tag: string): SessionMetadata[] {
    return this.getAllSessions().filter(session =>
      session.tags.includes(tag)
    );
  }

  /**
   * Gets starred sessions
   */
  getStarredSessions(): SessionMetadata[] {
    return this.getAllSessions().filter(session => session.starred);
  }

  /**
   * Gets recent sessions (last N)
   */
  getRecentSessions(count: number = 5): SessionMetadata[] {
    return this.getAllSessions().slice(0, count);
  }

  /**
   * Subscribes to session changes
   */
  subscribe(listener: (sessions: SessionMetadata[]) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current sessions
    listener(this.getAllSessions());
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifies all listeners
   */
  private notifyListeners(): void {
    const sessions = this.getAllSessions();
    this.listeners.forEach(listener => {
      try {
        listener(sessions);
      } catch (error) {
        console.error('Error in session manager listener:', error);
      }
    });
  }

  /**
   * Generates a unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Loads sessions from an array (for persistence)
   */
  loadSessions(sessions: SessionMetadata[]): void {
    this.sessions.clear();
    sessions.forEach(session => {
      // Convert date strings back to Date objects
      session.createdAt = new Date(session.createdAt);
      session.updatedAt = new Date(session.updatedAt);
      this.sessions.set(session.id, session);
    });

    // Set current session to most recent if not set
    if (!this.currentSessionId && sessions.length > 0) {
      this.currentSessionId = this.getAllSessions()[0].id;
    }

    this.notifyListeners();
  }

  /**
   * Exports sessions for persistence
   */
  exportSessions(): SessionMetadata[] {
    return this.getAllSessions();
  }
}

// Global instance
let globalManager: SessionManager | null = null;

/**
 * Gets the global session manager instance
 */
export function getSessionManager(): SessionManager {
  if (!globalManager) {
    globalManager = new SessionManager();
  }
  return globalManager;
}

/**
 * Default session templates
 */
export const DEFAULT_TEMPLATES: SessionTemplate[] = [
  {
    id: 'general',
    name: 'General Chat',
    description: 'General purpose conversation',
    systemPrompt: 'You are a helpful AI assistant.',
    tags: ['general'],
    icon: '💬',
  },
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    description: 'Debug and fix code issues',
    systemPrompt: 'You are an expert debugging assistant. Help identify and fix bugs in code.',
    tags: ['debugging', 'code'],
    icon: '🐛',
  },
  {
    id: 'feature',
    name: 'New Feature',
    description: 'Implement new features',
    systemPrompt: 'You are a feature implementation specialist. Help design and implement new features.',
    tags: ['feature', 'code'],
    icon: '✨',
  },
  {
    id: 'refactor',
    name: 'Refactoring',
    description: 'Improve code quality',
    systemPrompt: 'You are a code refactoring expert. Help improve code quality and maintainability.',
    tags: ['refactor', 'code'],
    icon: '♻️',
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Write or improve documentation',
    systemPrompt: 'You are a technical documentation specialist. Help create clear, comprehensive documentation.',
    tags: ['docs'],
    icon: '📚',
  },
  {
    id: 'testing',
    name: 'Testing',
    description: 'Write and improve tests',
    systemPrompt: 'You are a testing specialist. Help write comprehensive test suites.',
    tags: ['testing', 'code'],
    icon: '🧪',
  },
];
