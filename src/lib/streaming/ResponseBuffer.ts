export type FlushCallback = (text: string) => void;

export class ResponseBuffer {
  private buffer: string[] = [];
  private flushInterval: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private listeners: FlushCallback[] = [];
  private minChunkSize: number;
  private maxDelay: number;
  private lastFlushTime: number = Date.now();

  constructor(options: {
    flushInterval?: number;
    minChunkSize?: number;
    maxDelay?: number;
  } = {}) {
    this.flushInterval = options.flushInterval ?? 50; // ms
    this.minChunkSize = options.minChunkSize ?? 10; // characters
    this.maxDelay = options.maxDelay ?? 100; // ms
  }

  /**
   * Add a chunk to the buffer
   */
  append(chunk: string): void {
    if (!chunk) return;
    
    this.buffer.push(chunk);
    this.scheduleFlush();
  }

  /**
   * Register a callback to be called when buffer flushes
   */
  onFlush(callback: FlushCallback): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Force immediate flush
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    if (this.buffer.length === 0) return;

    const accumulated = this.buffer.join('');
    this.buffer = [];
    this.lastFlushTime = Date.now();
    
    this.listeners.forEach(fn => {
      try {
        fn(accumulated);
      } catch (error) {
        console.error('Error in flush callback:', error);
      }
    });
  }

  /**
   * Schedule a flush with adaptive timing
   */
  private scheduleFlush(): void {
    // If timer already scheduled, check if we should flush early
    if (this.flushTimer) {
      const bufferSize = this.buffer.join('').length;
      const timeSinceLastFlush = Date.now() - this.lastFlushTime;
      
      // Flush early if buffer is getting large or max delay reached
      if (bufferSize > this.minChunkSize * 5 || timeSinceLastFlush >= this.maxDelay) {
        this.flush();
        this.scheduleFlush(); // Reschedule for next batch
      }
      return;
    }

    const bufferSize = this.buffer.join('').length;
    
    // Determine delay based on buffer size
    let delay = this.flushInterval;
    if (bufferSize >= this.minChunkSize) {
      // Flush sooner if we have enough content
      delay = Math.min(this.flushInterval, 20);
    }
    
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, delay);
  }

  /**
   * Clear buffer and cancel pending flush
   */
  clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = [];
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.buffer.join('').length;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.clear();
    this.listeners = [];
  }
}