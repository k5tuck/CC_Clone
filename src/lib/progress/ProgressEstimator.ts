/**
 * Progress Estimation System
 * Estimates time and complexity for tasks based on historical data
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Task complexity level
 */
export enum TaskComplexity {
  TRIVIAL = 'trivial',      // < 1 min
  SIMPLE = 'simple',        // 1-5 min
  MODERATE = 'moderate',    // 5-15 min
  COMPLEX = 'complex',      // 15-30 min
  VERY_COMPLEX = 'very_complex', // 30+ min
}

/**
 * Task type
 */
export enum TaskType {
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  DEBUGGING = 'debugging',
  REFACTORING = 'refactoring',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  RESEARCH = 'research',
  PLANNING = 'planning',
  OTHER = 'other',
}

/**
 * Task estimate
 */
export interface TaskEstimate {
  taskId: string;
  description: string;
  type: TaskType;
  complexity: TaskComplexity;
  estimatedDuration: number; // seconds
  estimatedSteps: number;
  confidence: number; // 0-1
  factors: EstimationFactor[];
  breakdown?: TaskBreakdown[];
}

/**
 * Estimation factor
 */
export interface EstimationFactor {
  name: string;
  impact: 'increase' | 'decrease';
  multiplier: number;
  description: string;
}

/**
 * Task breakdown
 */
export interface TaskBreakdown {
  step: string;
  estimatedDuration: number;
  completed: boolean;
}

/**
 * Historical task record
 */
export interface TaskRecord {
  id: string;
  description: string;
  type: TaskType;
  complexity: TaskComplexity;
  estimatedDuration: number;
  actualDuration: number;
  stepsCompleted: number;
  timestamp: Date;
  successful: boolean;
}

/**
 * Progress tracking
 */
export interface TaskProgress {
  taskId: string;
  currentStep: number;
  totalSteps: number;
  elapsedTime: number;
  remainingTime: number;
  percentComplete: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Progress Estimation System
 */
export class ProgressEstimator extends EventEmitter {
  private history: TaskRecord[] = [];
  private activeTask: TaskProgress | null = null;
  private historyFile: string;
  private maxHistorySize = 500;

  constructor(customHistoryFile?: string) {
    super();
    this.historyFile = customHistoryFile || path.join(os.homedir(), '.selek', 'progress-history.json');
  }

  /**
   * Initialize the estimator
   */
  async initialize(): Promise<void> {
    await this.loadHistory();
    this.emit('initialized');
  }

  /**
   * Estimate a task
   */
  estimateTask(description: string, type?: TaskType): TaskEstimate {
    const detectedType = type || this.detectTaskType(description);
    const complexity = this.analyzeComplexity(description, detectedType);
    const baseEstimate = this.getBaseEstimate(complexity);
    const factors = this.getEstimationFactors(description, detectedType);

    // Apply factors
    let duration = baseEstimate;
    for (const factor of factors) {
      if (factor.impact === 'increase') {
        duration *= factor.multiplier;
      } else {
        duration /= factor.multiplier;
      }
    }

    // Get historical adjustment
    const historicalMultiplier = this.getHistoricalMultiplier(detectedType, complexity);
    duration *= historicalMultiplier;

    const steps = this.estimateSteps(complexity);
    const confidence = this.calculateConfidence(detectedType, complexity);

    const breakdown = this.createBreakdown(description, detectedType, steps);

    return {
      taskId: `task_${Date.now()}`,
      description,
      type: detectedType,
      complexity,
      estimatedDuration: Math.round(duration),
      estimatedSteps: steps,
      confidence,
      factors,
      breakdown,
    };
  }

  /**
   * Detect task type from description
   */
  private detectTaskType(description: string): TaskType {
    const lower = description.toLowerCase();

    if (lower.includes('write') || lower.includes('create') || lower.includes('implement') || lower.includes('add')) {
      return TaskType.CODE_GENERATION;
    }
    if (lower.includes('review') || lower.includes('check') || lower.includes('audit')) {
      return TaskType.CODE_REVIEW;
    }
    if (lower.includes('fix') || lower.includes('bug') || lower.includes('debug') || lower.includes('error')) {
      return TaskType.DEBUGGING;
    }
    if (lower.includes('refactor') || lower.includes('reorganize') || lower.includes('restructure')) {
      return TaskType.REFACTORING;
    }
    if (lower.includes('document') || lower.includes('readme') || lower.includes('comment')) {
      return TaskType.DOCUMENTATION;
    }
    if (lower.includes('test') || lower.includes('coverage')) {
      return TaskType.TESTING;
    }
    if (lower.includes('research') || lower.includes('investigate') || lower.includes('explore')) {
      return TaskType.RESEARCH;
    }
    if (lower.includes('plan') || lower.includes('design') || lower.includes('architect')) {
      return TaskType.PLANNING;
    }

    return TaskType.OTHER;
  }

  /**
   * Analyze task complexity
   */
  private analyzeComplexity(description: string, type: TaskType): TaskComplexity {
    let score = 0;

    // Length of description
    if (description.length > 200) score += 2;
    else if (description.length > 100) score += 1;

    // Keywords indicating complexity
    const complexKeywords = ['complex', 'advanced', 'sophisticated', 'comprehensive', 'multiple', 'several', 'entire'];
    const simpleKeywords = ['simple', 'basic', 'quick', 'small', 'minor'];

    for (const keyword of complexKeywords) {
      if (description.toLowerCase().includes(keyword)) {
        score += 1;
      }
    }

    for (const keyword of simpleKeywords) {
      if (description.toLowerCase().includes(keyword)) {
        score -= 1;
      }
    }

    // Type-specific complexity
    if ([TaskType.CODE_GENERATION, TaskType.REFACTORING].includes(type)) {
      score += 1;
    }

    // Determine complexity
    if (score <= 0) return TaskComplexity.TRIVIAL;
    if (score === 1) return TaskComplexity.SIMPLE;
    if (score === 2) return TaskComplexity.MODERATE;
    if (score === 3) return TaskComplexity.COMPLEX;
    return TaskComplexity.VERY_COMPLEX;
  }

  /**
   * Get base estimate for complexity
   */
  private getBaseEstimate(complexity: TaskComplexity): number {
    switch (complexity) {
      case TaskComplexity.TRIVIAL:
        return 30; // 30 seconds
      case TaskComplexity.SIMPLE:
        return 180; // 3 minutes
      case TaskComplexity.MODERATE:
        return 600; // 10 minutes
      case TaskComplexity.COMPLEX:
        return 1350; // 22.5 minutes
      case TaskComplexity.VERY_COMPLEX:
        return 2400; // 40 minutes
      default:
        return 600;
    }
  }

  /**
   * Get estimation factors
   */
  private getEstimationFactors(description: string, type: TaskType): EstimationFactor[] {
    const factors: EstimationFactor[] = [];
    const lower = description.toLowerCase();

    // File operations
    if (lower.includes('file') || lower.includes('directory')) {
      factors.push({
        name: 'File Operations',
        impact: 'increase',
        multiplier: 1.2,
        description: 'File I/O adds overhead',
      });
    }

    // Multiple files/components
    const numberMatch = description.match(/(\d+)\s+(files?|components?|modules?)/i);
    if (numberMatch) {
      const count = parseInt(numberMatch[1]);
      if (count > 3) {
        factors.push({
          name: 'Multiple Files',
          impact: 'increase',
          multiplier: 1 + (count * 0.1),
          description: `Working with ${count} files increases complexity`,
        });
      }
    }

    // API/Network operations
    if (lower.includes('api') || lower.includes('request') || lower.includes('fetch')) {
      factors.push({
        name: 'Network Operations',
        impact: 'increase',
        multiplier: 1.3,
        description: 'Network latency and error handling',
      });
    }

    // Testing mentioned
    if (lower.includes('test')) {
      factors.push({
        name: 'Testing Required',
        impact: 'increase',
        multiplier: 1.5,
        description: 'Writing tests adds time',
      });
    }

    // Simple/quick task
    if (lower.includes('quick') || lower.includes('simple')) {
      factors.push({
        name: 'Simple Task',
        impact: 'decrease',
        multiplier: 1.3,
        description: 'Task explicitly marked as simple',
      });
    }

    return factors;
  }

  /**
   * Get historical multiplier
   */
  private getHistoricalMultiplier(type: TaskType, complexity: TaskComplexity): number {
    const relevantHistory = this.history.filter(
      record => record.type === type && record.complexity === complexity
    );

    if (relevantHistory.length === 0) {
      return 1.0; // No historical data
    }

    // Calculate average accuracy
    let totalMultiplier = 0;
    for (const record of relevantHistory) {
      if (record.estimatedDuration > 0) {
        totalMultiplier += record.actualDuration / record.estimatedDuration;
      }
    }

    return totalMultiplier / relevantHistory.length;
  }

  /**
   * Estimate number of steps
   */
  private estimateSteps(complexity: TaskComplexity): number {
    switch (complexity) {
      case TaskComplexity.TRIVIAL:
        return 1;
      case TaskComplexity.SIMPLE:
        return 3;
      case TaskComplexity.MODERATE:
        return 5;
      case TaskComplexity.COMPLEX:
        return 8;
      case TaskComplexity.VERY_COMPLEX:
        return 12;
      default:
        return 5;
    }
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(type: TaskType, complexity: TaskComplexity): number {
    const relevantHistory = this.history.filter(
      record => record.type === type && record.complexity === complexity
    );

    if (relevantHistory.length === 0) {
      return 0.5; // Low confidence with no history
    }

    // More history = higher confidence, up to 0.95
    const historyFactor = Math.min(relevantHistory.length / 20, 0.45);

    // Success rate
    const successful = relevantHistory.filter(r => r.successful).length;
    const successRate = successful / relevantHistory.length;

    return Math.min(0.5 + historyFactor + (successRate * 0.3), 0.95);
  }

  /**
   * Create task breakdown
   */
  private createBreakdown(description: string, type: TaskType, steps: number): TaskBreakdown[] {
    const breakdown: TaskBreakdown[] = [];

    // Generic breakdown based on type
    switch (type) {
      case TaskType.CODE_GENERATION:
        breakdown.push(
          { step: 'Plan implementation', estimatedDuration: 60, completed: false },
          { step: 'Write code', estimatedDuration: 180, completed: false },
          { step: 'Test functionality', estimatedDuration: 120, completed: false },
          { step: 'Review and refine', estimatedDuration: 60, completed: false }
        );
        break;

      case TaskType.DEBUGGING:
        breakdown.push(
          { step: 'Reproduce issue', estimatedDuration: 120, completed: false },
          { step: 'Identify root cause', estimatedDuration: 180, completed: false },
          { step: 'Implement fix', estimatedDuration: 120, completed: false },
          { step: 'Verify fix', estimatedDuration: 60, completed: false }
        );
        break;

      default:
        // Generic breakdown
        for (let i = 1; i <= steps; i++) {
          breakdown.push({
            step: `Step ${i}`,
            estimatedDuration: 120,
            completed: false,
          });
        }
    }

    return breakdown.slice(0, steps);
  }

  /**
   * Start tracking a task
   */
  startTask(estimate: TaskEstimate): void {
    this.activeTask = {
      taskId: estimate.taskId,
      currentStep: 0,
      totalSteps: estimate.estimatedSteps,
      elapsedTime: 0,
      remainingTime: estimate.estimatedDuration,
      percentComplete: 0,
      status: 'in_progress',
    };

    this.emit('task:started', this.activeTask);
  }

  /**
   * Update task progress
   */
  updateProgress(step: number): void {
    if (!this.activeTask) return;

    this.activeTask.currentStep = step;
    this.activeTask.percentComplete = (step / this.activeTask.totalSteps) * 100;

    this.emit('task:progress', this.activeTask);
  }

  /**
   * Complete a task
   */
  async completeTask(successful: boolean, actualDuration: number): Promise<void> {
    if (!this.activeTask) return;

    this.activeTask.status = successful ? 'completed' : 'failed';
    this.activeTask.elapsedTime = actualDuration;

    this.emit('task:completed', this.activeTask);

    // Save to history
    // Note: We need the original estimate to save properly
    // This would be stored when starting the task

    this.activeTask = null;
  }

  /**
   * Get current task progress
   */
  getCurrentProgress(): TaskProgress | null {
    return this.activeTask;
  }

  /**
   * Load history from disk
   */
  private async loadHistory(): Promise<void> {
    try {
      const dir = path.dirname(this.historyFile);
      await fs.mkdir(dir, { recursive: true });

      const content = await fs.readFile(this.historyFile, 'utf-8');
      const data = JSON.parse(content);

      this.history = data.map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp),
      }));
    } catch {
      // File doesn't exist yet
      this.history = [];
    }
  }

  /**
   * Save history to disk
   */
  private async saveHistory(): Promise<void> {
    const dir = path.dirname(this.historyFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.historyFile, JSON.stringify(this.history, null, 2));
  }

  /**
   * Get estimation statistics
   */
  getStatistics() {
    const total = this.history.length;
    if (total === 0) {
      return {
        totalTasks: 0,
        averageAccuracy: 0,
        byType: new Map(),
        byComplexity: new Map(),
      };
    }

    const byType = new Map<TaskType, number>();
    const byComplexity = new Map<TaskComplexity, number>();
    let totalAccuracy = 0;

    for (const record of this.history) {
      byType.set(record.type, (byType.get(record.type) || 0) + 1);
      byComplexity.set(record.complexity, (byComplexity.get(record.complexity) || 0) + 1);

      if (record.estimatedDuration > 0) {
        const accuracy = 1 - Math.abs(record.actualDuration - record.estimatedDuration) / record.estimatedDuration;
        totalAccuracy += Math.max(0, accuracy);
      }
    }

    return {
      totalTasks: total,
      averageAccuracy: totalAccuracy / total,
      byType,
      byComplexity,
    };
  }
}

// Singleton instance
let progressEstimatorInstance: ProgressEstimator | null = null;

/**
 * Get the global progress estimator
 */
export function getProgressEstimator(): ProgressEstimator {
  if (!progressEstimatorInstance) {
    progressEstimatorInstance = new ProgressEstimator();
  }
  return progressEstimatorInstance;
}
