import { OllamaClient } from '../llm/ollama-client';
import { ImplementationAgent } from '../agents/implementation-agent';
import { SpecializedAgentConfig } from '../agents/specialized-agent';
import { PlanExecutor, ExecutionResult } from '../executor/plan-executor';
import path from 'path';
import fs from 'fs/promises';

/**
 * Custom exceptions for orchestration
 */
export class OrchestratorInitError extends Error {
  constructor(
    public readonly reason: string,
    public readonly context: Record<string, any>
  ) {
    super(`Orchestrator initialization failed: ${reason}`);
    this.name = 'OrchestratorInitError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AgentSpawnError extends Error {
  constructor(
    public readonly agentType: string,
    public readonly originalError: Error
  ) {
    super(`Failed to spawn ${agentType} agent: ${originalError.message}`);
    this.name = 'AgentSpawnError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class TaskExecutionError extends Error {
  constructor(
    public readonly taskDescription: string,
    public readonly failedAgent: string,
    public readonly originalError: Error
  ) {
    super(`Task "${taskDescription}" failed at ${failedAgent} agent: ${originalError.message}`);
    this.name = 'TaskExecutionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Agent registry record
 */
export interface AgentRecord {
  agentId: string;
  agentType: string;
  domain: string;
  task: string;
  planFile: string;
  timestamp: string;
  status: 'active' | 'completed' | 'failed';
  metadata: Record<string, any>;
}

/**
 * Task request structure
 */
export interface TaskRequest {
  description: string;
  domain: string;
  requiredAgents: string[];
  autoExecute: boolean;
  parallel?: boolean;
}

/**
 * Task result structure
 */
export interface TaskResult {
  taskDescription: string;
  plans: Record<string, string>;
  execution?: ExecutionResult;
  summary: string;
}

/**
 * Orchestrates multiple specialized agents to complete complex tasks
 */
export class MultiAgentOrchestrator {
  private llm: OllamaClient;
  private executor: PlanExecutor;
  private baseOutputDir: string;
  private promptTemplatesDir: string;
  private agentRegistry: AgentRecord[];
  private agentCounter: number;

  constructor(
    ollamaEndpoint: string,
    model: string = 'llama3.1:latest',
    baseOutputDir: string = './plans',
    promptTemplatesDir: string = './.claude/prompts'
  ) {
    this.llm = new OllamaClient({
      baseUrl: ollamaEndpoint,
      model: model,
      temperature: 0.7,
      timeout: 120000,
    });

    this.executor = new PlanExecutor(this.llm);
    this.baseOutputDir = baseOutputDir;
    this.promptTemplatesDir = promptTemplatesDir;
    this.agentRegistry = [];
    this.agentCounter = 0;
  }

  /**
   * Initialize orchestrator - check health, load registry
   */
  async initialize(): Promise<void> {
    try {
      // Check Ollama health
      const health = await this.llm.healthCheck();
      if (!health.healthy) {
        throw new OrchestratorInitError(
          health.error || 'LLM health check failed',
          { endpoint: this.llm.getConfig().baseUrl }
        );
      }

      // Ensure directories exist
      await fs.mkdir(this.baseOutputDir, { recursive: true });
      await fs.mkdir(this.promptTemplatesDir, { recursive: true });

      // Load agent registry
      await this.loadRegistry();

      console.log('✅ Orchestrator initialized successfully');
      console.log(`   LLM: ${this.llm.getConfig().model} at ${this.llm.getConfig().baseUrl}`);
      console.log(`   Output: ${this.baseOutputDir}`);
      console.log(`   Templates: ${this.promptTemplatesDir}`);
    } catch (error: any) {
      throw new OrchestratorInitError(
        error.message,
        { error: error }
      );
    }
  }

  /**
   * Execute a complete task using multiple agents
   */
  async executeTask(request: TaskRequest): Promise<TaskResult> {
    console.log('\n🚀 Starting multi-agent task execution');
    console.log(`   Task: ${request.description}`);
    console.log(`   Domain: ${request.domain}`);
    console.log(`   Agents: ${request.requiredAgents.join(', ')}`);

    const plans: Record<string, string> = {};
    const dependencies: string[] = [];

    try {
      // Execute each agent sequentially
      for (const agentType of request.requiredAgents) {
        console.log(`\n🤖 Spawning ${agentType} agent...`);

        const agent = await this.spawnAgent(agentType, request.domain);
        const output = await agent.execute(request.description, dependencies);

        // Register agent execution
        await this.registerAgent({
          agentId: output.agentId,
          agentType: output.agentType,
          domain: output.domain,
          task: request.description,
          planFile: output.planFile,
          timestamp: output.timestamp.toISOString(),
          status: 'completed',
          metadata: output.metadata,
        });

        plans[agentType] = output.planFile;
        dependencies.push(output.planFile);

        console.log(`✅ ${agentType} agent completed`);
        console.log(`   Plan: ${output.planFile}`);
        console.log(`   Time: ${output.executionTime.toFixed(2)}s`);
      }

      // Auto-execute if requested
      let execution: ExecutionResult | undefined;
      if (request.autoExecute && plans.implementation) {
        console.log('\n⚙️ Auto-executing implementation plan...');
        execution = await this.executor.executePlan(plans.implementation);
        
        if (execution.success) {
          console.log('✅ Implementation executed successfully');
        } else {
          console.log(`❌ Implementation failed: ${execution.error?.message}`);
        }
      }

      const summary = this.generateSummary(request, plans, execution);

      return {
        taskDescription: request.description,
        plans,
        execution,
        summary,
      };

    } catch (error: any) {
      throw new TaskExecutionError(
        request.description,
        'unknown',
        error
      );
    }
  }

  /**
   * Spawn a specialized agent
   */
  private async spawnAgent(
    agentType: string,
    domain: string
  ): Promise<ImplementationAgent> {
    try {
      this.agentCounter++;
      const agentId = `${agentType}-${this.agentCounter.toString().padStart(3, '0')}`;

      const config: SpecializedAgentConfig = {
        agentId,
        domain,
        promptTemplatePath: path.join(this.promptTemplatesDir, `${agentType}-agent.md`),
        outputDir: path.join(this.baseOutputDir, agentType),
        llm: this.llm,
      };

      // For now, all agents use ImplementationAgent base
      // TODO: Create separate SecurityAgent, PerformanceAgent, etc.
      const agent = new ImplementationAgent(config);
      await agent.loadPromptTemplate();

      return agent;
    } catch (error: any) {
      throw new AgentSpawnError(agentType, error);
    }
  }

  /**
   * Generate execution summary
   */
  private generateSummary(
    request: TaskRequest,
    plans: Record<string, string>,
    execution?: ExecutionResult
  ): string {
    let summary = `# Multi-Agent Execution Summary\n\n`;
    summary += `**Task:** ${request.description}\n`;
    summary += `**Domain:** ${request.domain}\n`;
    summary += `**Date:** ${new Date().toISOString()}\n\n`;

    summary += `## Generated Plans\n\n`;
    for (const [agentType, planFile] of Object.entries(plans)) {
      summary += `- **${agentType}**: \`${planFile}\`\n`;
    }

    if (execution) {
      summary += `\n## Execution Results\n\n`;
      summary += `- **Status:** ${execution.success ? '✅ Success' : '❌ Failed'}\n`;
      summary += `- **Steps Completed:** ${execution.completedSteps.length}\n`;
      summary += `- **Checkpoints Reached:** ${execution.checkpointsReached.length}\n`;
      summary += `- **Execution Time:** ${execution.executionTime.toFixed(2)}s\n`;
      
      if (!execution.success) {
        summary += `- **Failed at:** ${execution.failedStep}\n`;
        summary += `- **Error:** ${execution.error?.message}\n`;
      }
    }

    summary += `\n## Next Steps\n\n`;
    if (!execution && plans.implementation) {
      summary += `1. Review the generated plans\n`;
      summary += `2. Execute the implementation plan:\n`;
      summary += `   \`\`\`\n`;
      summary += `   pnpm run execute-plan ${plans.implementation}\n`;
      summary += `   \`\`\`\n`;
    } else if (execution?.success) {
      summary += `1. Review the implemented code\n`;
      summary += `2. Run tests to verify functionality\n`;
      summary += `3. Commit changes to version control\n`;
    } else {
      summary += `1. Review the error logs\n`;
      summary += `2. Fix issues and retry execution\n`;
    }

    return summary;
  }

  /**
   * Load agent registry from disk
   */
  private async loadRegistry(): Promise<void> {
    const registryPath = path.join(this.baseOutputDir, 'agent-registry.json');
    
    try {
      await fs.access(registryPath);
      const content = await fs.readFile(registryPath, 'utf-8');
      const data = JSON.parse(content);
      this.agentRegistry = data.agents || [];
    } catch {
      // Registry doesn't exist, start fresh
      this.agentRegistry = [];
      await this.saveRegistry();
    }
  }

  /**
   * Save agent registry to disk
   */
  private async saveRegistry(): Promise<void> {
    const registryPath = path.join(this.baseOutputDir, 'agent-registry.json');
    await fs.writeFile(
      registryPath,
      JSON.stringify({
        agents: this.agentRegistry,
        lastUpdated: new Date().toISOString(),
      }, null, 2),
      'utf-8'
    );
  }

  /**
   * Register an agent execution
   */
  private async registerAgent(record: AgentRecord): Promise<void> {
    this.agentRegistry.push(record);
    await this.saveRegistry();
  }

  /**
   * Get all agent records
   */
  getAgentRegistry(): AgentRecord[] {
    return [...this.agentRegistry];
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status: 'active' | 'completed' | 'failed'): AgentRecord[] {
    return this.agentRegistry.filter(a => a.status === status);
  }

  /**
   * Get agents for a specific task
   */
  getAgentsForTask(taskKeywords: string): AgentRecord[] {
    const keywords = taskKeywords.toLowerCase();
    return this.agentRegistry.filter(a => 
      a.task.toLowerCase().includes(keywords)
    );
  }

  /**
   * Execute a plan directly (without agent spawning)
   */
  async executePlan(planFile: string, dryRun: boolean = false): Promise<ExecutionResult> {
    return await this.executor.executePlan(planFile, dryRun);
  }

  /**
   * Get the LLM client (for advanced usage)
   */
  getLLMClient(): OllamaClient {
    return this.llm;
  }

  /**
   * Get the plan executor (for advanced usage)
   */
  getPlanExecutor(): PlanExecutor {
    return this.executor;
  }
}
