/**
 * Context Inspector
 * Tracks and analyzes what context the AI has access to
 */

/**
 * Types of context
 */
export enum ContextType {
  FILE = 'file',
  CONVERSATION = 'conversation',
  SYSTEM = 'system',
  KNOWLEDGE_GRAPH = 'knowledge_graph',
  TOOL_RESULT = 'tool_result',
  AGENT_OUTPUT = 'agent_output',
}

/**
 * Context item
 */
export interface ContextItem {
  id: string;
  type: ContextType;
  name: string;
  description?: string;
  size: number; // Size in characters/tokens
  addedAt: Date;
  lastAccessedAt?: Date;
  accessCount: number;
  metadata?: Record<string, any>;
  content?: string; // Preview or full content
  importance: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Context statistics
 */
export interface ContextStats {
  totalItems: number;
  totalSize: number;
  byType: Record<ContextType, number>;
  topItems: ContextItem[];
  recentItems: ContextItem[];
  tokenEstimate: number;
}

/**
 * Context suggestion
 */
export interface ContextSuggestion {
  id: string;
  type: 'add' | 'remove' | 'update';
  item: ContextItem;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Context Inspector Class
 */
export class ContextInspector {
  private items: Map<string, ContextItem> = new Map();
  private maxContextSize: number;
  private listeners: Set<(stats: ContextStats) => void> = new Set();

  constructor(maxContextSize: number = 100000) {
    this.maxContextSize = maxContextSize;
  }

  /**
   * Adds a context item
   */
  addItem(item: Omit<ContextItem, 'id' | 'addedAt' | 'accessCount'>): ContextItem {
    const contextItem: ContextItem = {
      ...item,
      id: this.generateId(),
      addedAt: new Date(),
      accessCount: 0,
    };

    this.items.set(contextItem.id, contextItem);
    this.notifyListeners();
    this.pruneIfNeeded();

    return contextItem;
  }

  /**
   * Updates a context item
   */
  updateItem(id: string, updates: Partial<ContextItem>): void {
    const item = this.items.get(id);
    if (!item) return;

    Object.assign(item, updates);
    this.notifyListeners();
  }

  /**
   * Removes a context item
   */
  removeItem(id: string): void {
    this.items.delete(id);
    this.notifyListeners();
  }

  /**
   * Records an access to a context item
   */
  recordAccess(id: string): void {
    const item = this.items.get(id);
    if (!item) return;

    item.accessCount++;
    item.lastAccessedAt = new Date();
    this.notifyListeners();
  }

  /**
   * Gets all context items
   */
  getAllItems(): ContextItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Gets items by type
   */
  getItemsByType(type: ContextType): ContextItem[] {
    return this.getAllItems().filter(item => item.type === type);
  }

  /**
   * Gets context statistics
   */
  getStats(): ContextStats {
    const items = this.getAllItems();
    const totalSize = items.reduce((sum, item) => sum + item.size, 0);

    // Count by type
    const byType: Record<ContextType, number> = {
      [ContextType.FILE]: 0,
      [ContextType.CONVERSATION]: 0,
      [ContextType.SYSTEM]: 0,
      [ContextType.KNOWLEDGE_GRAPH]: 0,
      [ContextType.TOOL_RESULT]: 0,
      [ContextType.AGENT_OUTPUT]: 0,
    };

    items.forEach(item => {
      byType[item.type]++;
    });

    // Top items by access count
    const topItems = [...items]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    // Recent items
    const recentItems = [...items]
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
      .slice(0, 10);

    // Rough token estimate (1 token ≈ 4 characters)
    const tokenEstimate = Math.ceil(totalSize / 4);

    return {
      totalItems: items.length,
      totalSize,
      byType,
      topItems,
      recentItems,
      tokenEstimate,
    };
  }

  /**
   * Gets context suggestions
   */
  getSuggestions(): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];
    const stats = this.getStats();

    // Suggest removing unused items if context is large
    if (stats.tokenEstimate > this.maxContextSize * 0.8) {
      const unusedItems = this.getAllItems()
        .filter(item => item.accessCount === 0)
        .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());

      unusedItems.slice(0, 5).forEach(item => {
        suggestions.push({
          id: `remove-${item.id}`,
          type: 'remove',
          item,
          reason: 'Never accessed and context is getting large',
          priority: 'medium',
        });
      });
    }

    // Suggest removing old items with low access
    const oldLowAccessItems = this.getAllItems()
      .filter(item => {
        const age = Date.now() - item.addedAt.getTime();
        const isOld = age > 60 * 60 * 1000; // 1 hour
        const lowAccess = item.accessCount < 2;
        return isOld && lowAccess;
      })
      .sort((a, b) => a.accessCount - b.accessCount);

    oldLowAccessItems.slice(0, 3).forEach(item => {
      suggestions.push({
        id: `remove-old-${item.id}`,
        type: 'remove',
        item,
        reason: 'Old and rarely accessed',
        priority: 'low',
      });
    });

    return suggestions;
  }

  /**
   * Searches context items
   */
  searchItems(query: string): ContextItem[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllItems().filter(
      item =>
        item.name.toLowerCase().includes(lowerQuery) ||
        item.description?.toLowerCase().includes(lowerQuery) ||
        item.content?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Gets most important items
   */
  getImportantItems(limit: number = 10): ContextItem[] {
    const importanceScore = (item: ContextItem): number => {
      let score = 0;

      // Importance level
      switch (item.importance) {
        case 'critical':
          score += 1000;
          break;
        case 'high':
          score += 100;
          break;
        case 'medium':
          score += 10;
          break;
        case 'low':
          score += 1;
          break;
      }

      // Access count
      score += item.accessCount * 10;

      // Recency bonus
      const age = Date.now() - item.addedAt.getTime();
      const hourAge = age / (1000 * 60 * 60);
      if (hourAge < 1) score += 50;
      else if (hourAge < 24) score += 20;

      return score;
    };

    return [...this.getAllItems()]
      .sort((a, b) => importanceScore(b) - importanceScore(a))
      .slice(0, limit);
  }

  /**
   * Clears all context
   */
  clearAll(): void {
    this.items.clear();
    this.notifyListeners();
  }

  /**
   * Clears items by type
   */
  clearByType(type: ContextType): void {
    const toRemove = this.getItemsByType(type);
    toRemove.forEach(item => this.items.delete(item.id));
    this.notifyListeners();
  }

  /**
   * Subscribes to context changes
   */
  subscribe(listener: (stats: ContextStats) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current stats
    listener(this.getStats());
    return () => this.listeners.delete(listener);
  }

  /**
   * Prunes context if it exceeds max size
   */
  private pruneIfNeeded(): void {
    const stats = this.getStats();

    if (stats.tokenEstimate > this.maxContextSize) {
      // Remove least important items
      const items = [...this.getAllItems()].sort((a, b) => {
        // Sort by importance and access count
        const scoreA = a.accessCount + (a.importance === 'critical' ? 1000 : 0);
        const scoreB = b.accessCount + (b.importance === 'critical' ? 1000 : 0);
        return scoreA - scoreB;
      });

      // Remove bottom 20%
      const toRemove = Math.ceil(items.length * 0.2);
      items.slice(0, toRemove).forEach(item => this.items.delete(item.id));

      console.log(`[Context] Pruned ${toRemove} items to stay within limit`);
      this.notifyListeners();
    }
  }

  /**
   * Notifies all listeners
   */
  private notifyListeners(): void {
    const stats = this.getStats();
    this.listeners.forEach(listener => {
      try {
        listener(stats);
      } catch (error) {
        console.error('Error in context inspector listener:', error);
      }
    });
  }

  /**
   * Generates a unique ID
   */
  private generateId(): string {
    return `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global instance
let globalInspector: ContextInspector | null = null;

/**
 * Gets the global context inspector instance
 */
export function getContextInspector(): ContextInspector {
  if (!globalInspector) {
    globalInspector = new ContextInspector();
  }
  return globalInspector;
}
