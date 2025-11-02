/**
 * Smart Error Recovery System
 * Provides intelligent error handling, suggestions, and recovery options
 */

import { EventEmitter } from 'events';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Error category
 */
export enum ErrorCategory {
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  EXECUTION = 'execution',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  UNKNOWN = 'unknown',
}

/**
 * Recovery strategy
 */
export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  action: () => Promise<void>;
  automatic?: boolean;
  estimatedTime?: number;
}

/**
 * Error occurrence
 */
export interface ErrorOccurrence {
  id: string;
  error: Error;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: Record<string, any>;
  timestamp: Date;
  recoveryStrategies: RecoveryStrategy[];
  attemptedStrategies: string[];
  recovered: boolean;
  retryCount: number;
  maxRetries: number;
}

/**
 * Error pattern
 */
export interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
  suggestions: string[];
  recoveryStrategies: (error: Error, context: Record<string, any>) => RecoveryStrategy[];
}

/**
 * Error Recovery System
 */
export class ErrorRecoverySystem extends EventEmitter {
  private errorHistory: ErrorOccurrence[] = [];
  private errorPatterns: ErrorPattern[] = [];
  private maxHistorySize = 100;
  private autoRecoveryEnabled = true;

  constructor() {
    super();
    this.initializePatterns();
  }

  /**
   * Initialize common error patterns
   */
  private initializePatterns(): void {
    // Network errors
    this.addPattern({
      pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Network request failed/i,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.ERROR,
      suggestions: [
        'Check your internet connection',
        'Verify the service is running',
        'Check firewall settings',
      ],
      recoveryStrategies: (error, context) => [
        {
          id: 'retry-network',
          name: 'Retry Connection',
          description: 'Wait and retry the network request',
          action: async () => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (context.retryCallback) {
              await context.retryCallback();
            }
          },
          automatic: true,
          estimatedTime: 2000,
        },
        {
          id: 'check-service',
          name: 'Check Service',
          description: 'Verify the service is running',
          action: async () => {
            // User would manually check
          },
        },
      ],
    });

    // File system errors
    this.addPattern({
      pattern: /ENOENT|EACCES|EPERM|File not found/i,
      category: ErrorCategory.FILE_SYSTEM,
      severity: ErrorSeverity.ERROR,
      suggestions: [
        'Check if the file exists',
        'Verify file permissions',
        'Check the file path is correct',
      ],
      recoveryStrategies: (error, context) => [
        {
          id: 'create-file',
          name: 'Create File',
          description: 'Create the missing file',
          action: async () => {
            if (context.createCallback) {
              await context.createCallback();
            }
          },
        },
        {
          id: 'fix-permissions',
          name: 'Fix Permissions',
          description: 'Update file permissions',
          action: async () => {
            // User would manually fix permissions
          },
        },
      ],
    });

    // Permission errors
    this.addPattern({
      pattern: /Permission denied|Unauthorized|Forbidden/i,
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.ERROR,
      suggestions: [
        'Check your permissions',
        'Verify you have access to this resource',
        'Contact an administrator',
      ],
      recoveryStrategies: (error, context) => [
        {
          id: 'request-permission',
          name: 'Request Permission',
          description: 'Request access to the resource',
          action: async () => {
            if (context.requestCallback) {
              await context.requestCallback();
            }
          },
        },
      ],
    });

    // Rate limit errors
    this.addPattern({
      pattern: /Rate limit|Too many requests|429/i,
      category: ErrorCategory.RATE_LIMIT,
      severity: ErrorSeverity.WARNING,
      suggestions: [
        'Wait before retrying',
        'Reduce request frequency',
        'Check rate limit quotas',
      ],
      recoveryStrategies: (error, context) => [
        {
          id: 'exponential-backoff',
          name: 'Wait and Retry',
          description: 'Wait with exponential backoff',
          action: async () => {
            const waitTime = Math.min(30000, 1000 * Math.pow(2, context.retryCount || 0));
            await new Promise(resolve => setTimeout(resolve, waitTime));
            if (context.retryCallback) {
              await context.retryCallback();
            }
          },
          automatic: true,
          estimatedTime: 2000,
        },
      ],
    });

    // Timeout errors
    this.addPattern({
      pattern: /Timeout|ETIMEDOUT|Request timeout/i,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.WARNING,
      suggestions: [
        'Retry the operation',
        'Increase timeout duration',
        'Check for slow network',
      ],
      recoveryStrategies: (error, context) => [
        {
          id: 'retry-timeout',
          name: 'Retry with Longer Timeout',
          description: 'Retry with increased timeout',
          action: async () => {
            if (context.retryCallback) {
              await context.retryCallback({ timeout: (context.timeout || 5000) * 2 });
            }
          },
          automatic: true,
        },
      ],
    });
  }

  /**
   * Add a custom error pattern
   */
  addPattern(pattern: ErrorPattern): void {
    this.errorPatterns.push(pattern);
  }

  /**
   * Handle an error and create recovery strategies
   */
  async handleError(
    error: Error,
    context: Record<string, any> = {},
    maxRetries: number = 3
  ): Promise<ErrorOccurrence> {
    const id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Match error against patterns
    const matchedPattern = this.matchPattern(error);
    const category = matchedPattern?.category || ErrorCategory.UNKNOWN;
    const severity = matchedPattern?.severity || ErrorSeverity.ERROR;

    // Generate recovery strategies
    const recoveryStrategies = matchedPattern
      ? matchedPattern.recoveryStrategies(error, context)
      : this.getDefaultStrategies(error, context);

    const occurrence: ErrorOccurrence = {
      id,
      error,
      severity,
      category,
      context,
      timestamp: new Date(),
      recoveryStrategies,
      attemptedStrategies: [],
      recovered: false,
      retryCount: 0,
      maxRetries,
    };

    // Add to history
    this.errorHistory.unshift(occurrence);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }

    // Emit error event
    this.emit('error:occurred', occurrence);

    // Attempt automatic recovery
    if (this.autoRecoveryEnabled) {
      await this.attemptRecovery(occurrence);
    }

    return occurrence;
  }

  /**
   * Match error against patterns
   */
  private matchPattern(error: Error): ErrorPattern | null {
    const message = error.message;

    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(message)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Get default recovery strategies
   */
  private getDefaultStrategies(error: Error, context: Record<string, any>): RecoveryStrategy[] {
    return [
      {
        id: 'retry-default',
        name: 'Retry Operation',
        description: 'Retry the failed operation',
        action: async () => {
          if (context.retryCallback) {
            await context.retryCallback();
          }
        },
      },
      {
        id: 'skip',
        name: 'Skip and Continue',
        description: 'Skip this operation and continue',
        action: async () => {
          if (context.skipCallback) {
            await context.skipCallback();
          }
        },
      },
    ];
  }

  /**
   * Attempt automatic recovery
   */
  private async attemptRecovery(occurrence: ErrorOccurrence): Promise<void> {
    const automaticStrategies = occurrence.recoveryStrategies.filter(s => s.automatic);

    for (const strategy of automaticStrategies) {
      if (occurrence.retryCount >= occurrence.maxRetries) {
        this.emit('error:max-retries', occurrence);
        break;
      }

      try {
        this.emit('recovery:attempting', { occurrence, strategy });
        occurrence.attemptedStrategies.push(strategy.id);
        occurrence.retryCount++;

        await strategy.action();

        occurrence.recovered = true;
        this.emit('recovery:success', { occurrence, strategy });
        break;
      } catch (recoveryError) {
        this.emit('recovery:failed', { occurrence, strategy, recoveryError });
      }
    }
  }

  /**
   * Manually execute a recovery strategy
   */
  async executeStrategy(occurrenceId: string, strategyId: string): Promise<void> {
    const occurrence = this.errorHistory.find(e => e.id === occurrenceId);
    if (!occurrence) {
      throw new Error(`Error occurrence ${occurrenceId} not found`);
    }

    const strategy = occurrence.recoveryStrategies.find(s => s.id === strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    occurrence.attemptedStrategies.push(strategy.id);
    occurrence.retryCount++;

    try {
      await strategy.action();
      occurrence.recovered = true;
      this.emit('recovery:success', { occurrence, strategy });
    } catch (error) {
      this.emit('recovery:failed', { occurrence, strategy, error });
      throw error;
    }
  }

  /**
   * Get error history
   */
  getHistory(limit: number = 20): ErrorOccurrence[] {
    return this.errorHistory.slice(0, limit);
  }

  /**
   * Get unrecovered errors
   */
  getUnrecoveredErrors(): ErrorOccurrence[] {
    return this.errorHistory.filter(e => !e.recovered);
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
    this.emit('history:cleared');
  }

  /**
   * Enable/disable automatic recovery
   */
  setAutoRecovery(enabled: boolean): void {
    this.autoRecoveryEnabled = enabled;
  }
}

// Singleton instance
let errorRecoveryInstance: ErrorRecoverySystem | null = null;

/**
 * Get the global error recovery system
 */
export function getErrorRecoverySystem(): ErrorRecoverySystem {
  if (!errorRecoveryInstance) {
    errorRecoveryInstance = new ErrorRecoverySystem();
  }
  return errorRecoveryInstance;
}
