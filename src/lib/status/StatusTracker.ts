/**
 * Status Tracker
 * Tracks session status, token usage, timing, and performance metrics
 */

/**
 * Token usage information
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  limit?: number;
  percentageUsed?: number;
}

/**
 * Cost estimate information
 */
export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  averageResponseTimeMs: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
}

/**
 * Current operation status
 */
export interface OperationStatus {
  currentOperation: string;
  nextOperation?: string;
  startTime: Date;
  elapsedMs: number;
  canInterrupt: boolean;
}

/**
 * Complete status information
 */
export interface StatusInfo {
  sessionId: string;
  sessionStartTime: Date;
  sessionDurationMs: number;
  tokenUsage: TokenUsage;
  costEstimate?: CostEstimate;
  performance: PerformanceMetrics;
  operation?: OperationStatus;
  provider: string;
  model: string;
}

/**
 * Provider pricing (per 1M tokens)
 */
const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic': {
    input: 3.00,  // $3 per 1M input tokens (Claude 3 Sonnet)
    output: 15.00, // $15 per 1M output tokens
  },
  'openai': {
    input: 0.50,   // $0.50 per 1M input tokens (GPT-4o-mini)
    output: 1.50,  // $1.50 per 1M output tokens
  },
  'ollama': {
    input: 0,      // Free (local)
    output: 0,
  },
};

/**
 * Status Tracker Class
 */
export class StatusTracker {
  private sessionId: string;
  private sessionStartTime: Date;
  private provider: string;
  private model: string;

  // Token tracking
  private inputTokens: number = 0;
  private outputTokens: number = 0;
  private tokenLimit?: number;

  // Performance tracking
  private requestStartTimes: Map<string, number> = new Map();
  private responseTimes: number[] = [];
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  // Operation tracking
  private currentOperation?: OperationStatus;

  // Listeners
  private listeners: Set<(status: StatusInfo) => void> = new Set();

  constructor(
    sessionId: string,
    provider: string,
    model: string,
    tokenLimit?: number
  ) {
    this.sessionId = sessionId;
    this.sessionStartTime = new Date();
    this.provider = provider;
    this.model = model;
    this.tokenLimit = tokenLimit;
  }

  /**
   * Adds tokens to the usage count
   */
  addTokens(inputTokens: number, outputTokens: number): void {
    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;
    this.notifyListeners();
  }

  /**
   * Starts tracking a request
   */
  startRequest(requestId: string): void {
    this.requestStartTimes.set(requestId, Date.now());
    this.totalRequests++;
  }

  /**
   * Completes a request successfully
   */
  completeRequest(requestId: string, cacheHit: boolean = false): void {
    const startTime = this.requestStartTimes.get(requestId);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.responseTimes.push(duration);
      this.requestStartTimes.delete(requestId);

      // Keep only last 100 response times
      if (this.responseTimes.length > 100) {
        this.responseTimes.shift();
      }
    }

    this.successfulRequests++;

    if (cacheHit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    this.notifyListeners();
  }

  /**
   * Marks a request as failed
   */
  failRequest(requestId: string): void {
    this.requestStartTimes.delete(requestId);
    this.failedRequests++;
    this.notifyListeners();
  }

  /**
   * Sets the current operation
   */
  setOperation(
    operation: string,
    nextOperation?: string,
    canInterrupt: boolean = false
  ): void {
    this.currentOperation = {
      currentOperation: operation,
      nextOperation,
      startTime: new Date(),
      elapsedMs: 0,
      canInterrupt,
    };
    this.notifyListeners();
  }

  /**
   * Updates the elapsed time for current operation
   */
  updateOperationTime(): void {
    if (this.currentOperation) {
      this.currentOperation.elapsedMs =
        Date.now() - this.currentOperation.startTime.getTime();
      this.notifyListeners();
    }
  }

  /**
   * Clears the current operation
   */
  clearOperation(): void {
    this.currentOperation = undefined;
    this.notifyListeners();
  }

  /**
   * Gets the current status
   */
  getStatus(): StatusInfo {
    const totalTokens = this.inputTokens + this.outputTokens;
    const sessionDuration = Date.now() - this.sessionStartTime.getTime();

    // Calculate token usage
    const tokenUsage: TokenUsage = {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens,
      limit: this.tokenLimit,
      percentageUsed: this.tokenLimit
        ? (totalTokens / this.tokenLimit) * 100
        : undefined,
    };

    // Calculate cost estimate
    const pricing = PROVIDER_PRICING[this.provider] || PROVIDER_PRICING['ollama'];
    const costEstimate: CostEstimate = {
      inputCost: (this.inputTokens / 1_000_000) * pricing.input,
      outputCost: (this.outputTokens / 1_000_000) * pricing.output,
      totalCost:
        (this.inputTokens / 1_000_000) * pricing.input +
        (this.outputTokens / 1_000_000) * pricing.output,
      currency: 'USD',
    };

    // Calculate performance metrics
    const averageResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((sum, t) => sum + t, 0) / this.responseTimes.length
        : 0;

    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate =
      totalCacheRequests > 0 ? (this.cacheHits / totalCacheRequests) * 100 : 0;

    const performance: PerformanceMetrics = {
      averageResponseTimeMs: averageResponseTime,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate,
    };

    return {
      sessionId: this.sessionId,
      sessionStartTime: this.sessionStartTime,
      sessionDurationMs: sessionDuration,
      tokenUsage,
      costEstimate,
      performance,
      operation: this.currentOperation,
      provider: this.provider,
      model: this.model,
    };
  }

  /**
   * Subscribes to status updates
   */
  subscribe(listener: (status: StatusInfo) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifies all listeners
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in status tracker listener:', error);
      }
    });
  }

  /**
   * Resets all statistics (keeps session ID and start time)
   */
  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.requestStartTimes.clear();
    this.responseTimes = [];
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.currentOperation = undefined;
    this.notifyListeners();
  }

  /**
   * Updates the provider and model
   */
  updateProvider(provider: string, model: string): void {
    this.provider = provider;
    this.model = model;
    this.notifyListeners();
  }
}

// Global instance
let globalTracker: StatusTracker | null = null;

/**
 * Initializes the global status tracker
 */
export function initializeStatusTracker(
  sessionId: string,
  provider: string,
  model: string,
  tokenLimit?: number
): StatusTracker {
  globalTracker = new StatusTracker(sessionId, provider, model, tokenLimit);
  return globalTracker;
}

/**
 * Gets the global status tracker instance
 */
export function getStatusTracker(): StatusTracker | null {
  return globalTracker;
}
