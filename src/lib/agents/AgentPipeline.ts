/**
 * Agent Pipeline Tracker
 * Tracks agent collaboration, handoffs, and task pipelines
 */

import { EventEmitter } from 'events';

/**
 * Pipeline stage status
 */
export enum StageStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * Pipeline stage
 */
export interface PipelineStage {
  id: string;
  agentId: string;
  agentName: string;
  task: string;
  status: StageStatus;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Agent handoff
 */
export interface AgentHandoff {
  from: string;
  to: string;
  task: string;
  context: any;
  timestamp: Date;
  reason?: string;
}

/**
 * Pipeline execution
 */
export interface PipelineExecution {
  id: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  handoffs: AgentHandoff[];
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  currentStageIndex: number;
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  totalStages: number;
  totalHandoffs: number;
  agentParticipation: Map<string, number>;
  mostActiveAgent: string | null;
}

/**
 * Agent Pipeline Tracker
 */
export class AgentPipelineTracker extends EventEmitter {
  private pipelines: Map<string, PipelineExecution> = new Map();
  private pipelineHistory: PipelineExecution[] = [];
  private maxHistory = 100;

  /**
   * Start a new pipeline execution
   */
  startPipeline(name: string, description?: string): string {
    const id = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const pipeline: PipelineExecution = {
      id,
      name,
      description,
      stages: [],
      handoffs: [],
      status: 'running',
      startTime: new Date(),
      currentStageIndex: 0,
    };

    this.pipelines.set(id, pipeline);
    this.emit('pipeline:started', pipeline);

    return id;
  }

  /**
   * Add a stage to a pipeline
   */
  addStage(
    pipelineId: string,
    agentId: string,
    agentName: string,
    task: string,
    metadata?: Record<string, any>
  ): string {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const stageId = `stage_${pipeline.stages.length}`;
    const stage: PipelineStage = {
      id: stageId,
      agentId,
      agentName,
      task,
      status: StageStatus.PENDING,
      metadata,
    };

    pipeline.stages.push(stage);
    this.emit('stage:added', { pipelineId, stage });

    return stageId;
  }

  /**
   * Start a pipeline stage
   */
  startStage(pipelineId: string, stageId: string, input?: any): void {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const stage = pipeline.stages.find(s => s.id === stageId);
    if (!stage) {
      throw new Error(`Stage ${stageId} not found in pipeline ${pipelineId}`);
    }

    stage.status = StageStatus.IN_PROGRESS;
    stage.startTime = new Date();
    stage.input = input;

    this.emit('stage:started', { pipelineId, stage });
  }

  /**
   * Complete a pipeline stage
   */
  completeStage(pipelineId: string, stageId: string, output?: any): void {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const stage = pipeline.stages.find(s => s.id === stageId);
    if (!stage) {
      throw new Error(`Stage ${stageId} not found in pipeline ${pipelineId}`);
    }

    stage.status = StageStatus.COMPLETED;
    stage.endTime = new Date();
    stage.output = output;

    if (stage.startTime) {
      stage.duration = stage.endTime.getTime() - stage.startTime.getTime();
    }

    pipeline.currentStageIndex++;

    this.emit('stage:completed', { pipelineId, stage });

    // Check if pipeline is complete
    if (pipeline.stages.every(s => s.status === StageStatus.COMPLETED || s.status === StageStatus.SKIPPED)) {
      this.completePipeline(pipelineId);
    }
  }

  /**
   * Fail a pipeline stage
   */
  failStage(pipelineId: string, stageId: string, error: string): void {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const stage = pipeline.stages.find(s => s.id === stageId);
    if (!stage) {
      throw new Error(`Stage ${stageId} not found in pipeline ${pipelineId}`);
    }

    stage.status = StageStatus.FAILED;
    stage.endTime = new Date();
    stage.error = error;

    if (stage.startTime) {
      stage.duration = stage.endTime.getTime() - stage.startTime.getTime();
    }

    this.emit('stage:failed', { pipelineId, stage });

    // Fail the pipeline
    this.failPipeline(pipelineId, `Stage ${stageId} failed: ${error}`);
  }

  /**
   * Record an agent handoff
   */
  recordHandoff(
    pipelineId: string,
    from: string,
    to: string,
    task: string,
    context: any,
    reason?: string
  ): void {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const handoff: AgentHandoff = {
      from,
      to,
      task,
      context,
      timestamp: new Date(),
      reason,
    };

    pipeline.handoffs.push(handoff);
    this.emit('handoff:recorded', { pipelineId, handoff });
  }

  /**
   * Complete a pipeline
   */
  private completePipeline(pipelineId: string): void {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    pipeline.status = 'completed';
    pipeline.endTime = new Date();
    pipeline.totalDuration = pipeline.endTime.getTime() - pipeline.startTime.getTime();

    this.emit('pipeline:completed', pipeline);

    // Move to history
    this.pipelineHistory.unshift(pipeline);
    if (this.pipelineHistory.length > this.maxHistory) {
      this.pipelineHistory = this.pipelineHistory.slice(0, this.maxHistory);
    }

    this.pipelines.delete(pipelineId);
  }

  /**
   * Fail a pipeline
   */
  private failPipeline(pipelineId: string, reason: string): void {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    pipeline.status = 'failed';
    pipeline.endTime = new Date();
    pipeline.totalDuration = pipeline.endTime.getTime() - pipeline.startTime.getTime();

    this.emit('pipeline:failed', { pipeline, reason });

    // Move to history
    this.pipelineHistory.unshift(pipeline);
    if (this.pipelineHistory.length > this.maxHistory) {
      this.pipelineHistory = this.pipelineHistory.slice(0, this.maxHistory);
    }

    this.pipelines.delete(pipelineId);
  }

  /**
   * Get a pipeline by ID
   */
  getPipeline(pipelineId: string): PipelineExecution | undefined {
    return this.pipelines.get(pipelineId) || this.pipelineHistory.find(p => p.id === pipelineId);
  }

  /**
   * Get all active pipelines
   */
  getActivePipelines(): PipelineExecution[] {
    return Array.from(this.pipelines.values());
  }

  /**
   * Get pipeline history
   */
  getHistory(limit: number = 10): PipelineExecution[] {
    return this.pipelineHistory.slice(0, limit);
  }

  /**
   * Get pipeline statistics
   */
  getStats(): PipelineStats {
    const allPipelines = [...this.pipelineHistory];
    const completedPipelines = allPipelines.filter(p => p.status === 'completed');
    const failedPipelines = allPipelines.filter(p => p.status === 'failed');

    const totalDuration = completedPipelines.reduce((sum, p) => sum + (p.totalDuration || 0), 0);
    const averageDuration = completedPipelines.length > 0 ? totalDuration / completedPipelines.length : 0;

    const totalStages = allPipelines.reduce((sum, p) => sum + p.stages.length, 0);
    const totalHandoffs = allPipelines.reduce((sum, p) => sum + p.handoffs.length, 0);

    // Agent participation
    const agentParticipation = new Map<string, number>();
    for (const pipeline of allPipelines) {
      for (const stage of pipeline.stages) {
        agentParticipation.set(stage.agentId, (agentParticipation.get(stage.agentId) || 0) + 1);
      }
    }

    // Most active agent
    let mostActiveAgent: string | null = null;
    let maxParticipation = 0;
    for (const [agentId, count] of agentParticipation) {
      if (count > maxParticipation) {
        maxParticipation = count;
        mostActiveAgent = agentId;
      }
    }

    return {
      totalExecutions: allPipelines.length,
      completedExecutions: completedPipelines.length,
      failedExecutions: failedPipelines.length,
      averageDuration,
      totalStages,
      totalHandoffs,
      agentParticipation,
      mostActiveAgent,
    };
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.pipelineHistory = [];
    this.emit('history:cleared');
  }
}

// Singleton instance
let pipelineTrackerInstance: AgentPipelineTracker | null = null;

/**
 * Get the global pipeline tracker instance
 */
export function getAgentPipelineTracker(): AgentPipelineTracker {
  if (!pipelineTrackerInstance) {
    pipelineTrackerInstance = new AgentPipelineTracker();
  }
  return pipelineTrackerInstance;
}
