/**
 * Tool Tracker
 * Tracks and monitors tool usage for transparency and statistics
 */

/**
 * Tool execution status
 */
export enum ToolExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Tool execution event
 */
export interface ToolExecutionEvent {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  status: ToolExecutionStatus;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  result?: any;
  error?: string;
  calledBy?: string; // Which agent/component called this tool
}

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
  toolName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageDurationMs: number;
  lastUsed: Date;
}

/**
 * Tool Tracker Class
 */
export class ToolTracker {
  private events: Map<string, ToolExecutionEvent> = new Map();
  private eventHistory: ToolExecutionEvent[] = [];
  private maxHistorySize: number = 100;
  private listeners: Set<(event: ToolExecutionEvent) => void> = new Set();

  /**
   * Starts tracking a tool call
   */
  startToolCall(
    id: string,
    toolName: string,
    parameters: Record<string, any>,
    calledBy?: string
  ): void {
    const event: ToolExecutionEvent = {
      id,
      toolName,
      parameters,
      status: ToolExecutionStatus.RUNNING,
      startTime: new Date(),
      calledBy,
    };

    this.events.set(id, event);
    this.notifyListeners(event);
  }

  /**
   * Completes a tool call with success
   */
  completeToolCall(id: string, result?: any): void {
    const event = this.events.get(id);
    if (!event) return;

    const now = new Date();
    event.status = ToolExecutionStatus.SUCCESS;
    event.endTime = now;
    event.durationMs = now.getTime() - event.startTime.getTime();
    event.result = result;

    this.addToHistory(event);
    this.events.delete(id);
    this.notifyListeners(event);
  }

  /**
   * Marks a tool call as failed
   */
  failToolCall(id: string, error: string): void {
    const event = this.events.get(id);
    if (!event) return;

    const now = new Date();
    event.status = ToolExecutionStatus.FAILED;
    event.endTime = now;
    event.durationMs = now.getTime() - event.startTime.getTime();
    event.error = error;

    this.addToHistory(event);
    this.events.delete(id);
    this.notifyListeners(event);
  }

  /**
   * Cancels a tool call
   */
  cancelToolCall(id: string): void {
    const event = this.events.get(id);
    if (!event) return;

    const now = new Date();
    event.status = ToolExecutionStatus.CANCELLED;
    event.endTime = now;
    event.durationMs = now.getTime() - event.startTime.getTime();

    this.addToHistory(event);
    this.events.delete(id);
    this.notifyListeners(event);
  }

  /**
   * Gets all active tool calls
   */
  getActiveToolCalls(): ToolExecutionEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Gets recent tool call history
   */
  getHistory(limit?: number): ToolExecutionEvent[] {
    const history = [...this.eventHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Gets statistics for a specific tool
   */
  getToolStats(toolName: string): ToolUsageStats | null {
    const toolEvents = this.eventHistory.filter(e => e.toolName === toolName);
    if (toolEvents.length === 0) return null;

    const successfulCalls = toolEvents.filter(e => e.status === ToolExecutionStatus.SUCCESS);
    const failedCalls = toolEvents.filter(e => e.status === ToolExecutionStatus.FAILED);

    const totalDuration = successfulCalls.reduce((sum, e) => sum + (e.durationMs || 0), 0);
    const averageDuration = successfulCalls.length > 0 ? totalDuration / successfulCalls.length : 0;

    const lastUsed = toolEvents.reduce((latest, e) =>
      e.startTime > latest ? e.startTime : latest,
      toolEvents[0].startTime
    );

    return {
      toolName,
      totalCalls: toolEvents.length,
      successfulCalls: successfulCalls.length,
      failedCalls: failedCalls.length,
      averageDurationMs: averageDuration,
      lastUsed,
    };
  }

  /**
   * Gets overall statistics for all tools
   */
  getAllStats(): ToolUsageStats[] {
    const toolNames = new Set(this.eventHistory.map(e => e.toolName));
    return Array.from(toolNames)
      .map(name => this.getToolStats(name))
      .filter(stats => stats !== null) as ToolUsageStats[];
  }

  /**
   * Subscribes to tool execution events
   */
  subscribe(listener: (event: ToolExecutionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clears all history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Gets a specific tool event by ID
   */
  getEvent(id: string): ToolExecutionEvent | undefined {
    return this.events.get(id) || this.eventHistory.find(e => e.id === id);
  }

  /**
   * Adds event to history
   */
  private addToHistory(event: ToolExecutionEvent): void {
    this.eventHistory.push(event);

    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Notifies all listeners
   */
  private notifyListeners(event: ToolExecutionEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in tool tracker listener:', error);
      }
    });
  }

  /**
   * Sets maximum history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    if (this.eventHistory.length > size) {
      this.eventHistory = this.eventHistory.slice(-size);
    }
  }
}

// Global instance
let globalTracker: ToolTracker | null = null;

/**
 * Gets the global tool tracker instance
 */
export function getToolTracker(): ToolTracker {
  if (!globalTracker) {
    globalTracker = new ToolTracker();
  }
  return globalTracker;
}

/**
 * Wraps a tool function with tracking
 */
export function trackTool<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  toolFn: T,
  calledBy?: string
): T {
  return (async (...args: any[]) => {
    const tracker = getToolTracker();
    const id = `${toolName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Extract parameters from args
    const parameters = args.length === 1 && typeof args[0] === 'object' ? args[0] : { args };

    tracker.startToolCall(id, toolName, parameters, calledBy);

    try {
      const result = await toolFn(...args);
      tracker.completeToolCall(id, result);
      return result;
    } catch (error) {
      tracker.failToolCall(id, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }) as T;
}
