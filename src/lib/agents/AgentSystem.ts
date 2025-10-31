// src/lib/agents/AgentSystem.ts
// Complete multi-agent orchestration system with real-time progress tracking

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { getAgentSystemPrompt } from './SystematicAgentPrompts';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  avatar?: string; // Emoji or icon
  color?: string; // For UI display
  capabilities: string[];
  activation_keywords?: string[];
  requires_approval?: boolean;
  max_iterations?: number;
}

export interface AgentConfig {
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
}

export interface Agent {
  metadata: AgentMetadata;
  config: AgentConfig;
  path: string;
}

export interface AgentStatus {
  agentId: string;
  status: 'idle' | 'thinking' | 'working' | 'waiting' | 'completed' | 'error';
  currentStep: string;
  progress: number; // 0-100
  startTime: Date;
  lastUpdate: Date;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface AgentMessage {
  agentId: string;
  agentName: string;
  timestamp: Date;
  type: 'thought' | 'action' | 'result' | 'error' | 'progress';
  content: string;
  metadata?: Record<string, any>;
}

export interface TaskResult {
  success: boolean;
  agentId: string;
  output: string;
  duration: number;
  error?: Error;
}

// Custom Exceptions
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly agentId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class AgentNotFoundError extends AgentError {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`, agentId);
    this.name = 'AgentNotFoundError';
  }
}

export class AgentExecutionError extends AgentError {
  constructor(agentId: string, message: string, cause?: Error) {
    super(message, agentId, cause);
    this.name = 'AgentExecutionError';
  }
}

// ============================================================================
// AGENT EVENT EMITTER
// ============================================================================

export class AgentEventBus extends EventEmitter {
  emitStatusUpdate(status: AgentStatus): void {
    this.emit('status_update', status);
  }

  emitMessage(message: AgentMessage): void {
    this.emit('agent_message', message);
  }

  emitTaskComplete(result: TaskResult): void {
    this.emit('task_complete', result);
  }

  onStatusUpdate(callback: (status: AgentStatus) => void): () => void {
    this.on('status_update', callback);
    return () => this.off('status_update', callback);
  }

  onMessage(callback: (message: AgentMessage) => void): () => void {
    this.on('agent_message', callback);
    return () => this.off('agent_message', callback);
  }

  onTaskComplete(callback: (result: TaskResult) => void): () => void {
    this.on('task_complete', callback);
    return () => this.off('task_complete', callback);
  }
}

// ============================================================================
// AGENT LOADER
// ============================================================================

export class AgentLoader {
  private agentsDirectory: string;
  private loadedAgents: Map<string, Agent> = new Map();

  constructor(agentsDirectory: string = './agents') {
    this.agentsDirectory = path.resolve(agentsDirectory);
  }

  async loadAll(): Promise<Agent[]> {
    try {
      await fs.access(this.agentsDirectory);
    } catch (error) {
      console.warn(`Agents directory does not exist: ${this.agentsDirectory}`);
      await fs.mkdir(this.agentsDirectory, { recursive: true });
      await this.createDefaultAgents();
    }

    const entries = await fs.readdir(this.agentsDirectory, { withFileTypes: true });
    const agentDirs = entries.filter(e => e.isDirectory());

    const agents: Agent[] = [];
    for (const dir of agentDirs) {
      try {
        const agent = await this.loadAgent(dir.name);
        agents.push(agent);
        this.loadedAgents.set(agent.metadata.id, agent);
      } catch (error) {
        console.error(`Failed to load agent ${dir.name}:`, error);
      }
    }

    console.log(`✓ Loaded ${agents.length} agents`);
    return agents;
  }

  async loadAgent(agentId: string): Promise<Agent> {
    const agentPath = path.join(this.agentsDirectory, agentId);
    const agentFile = path.join(agentPath, 'AGENT.md');

    try {
      await fs.access(agentFile);
    } catch (error) {
      throw new AgentNotFoundError(agentId);
    }

    const content = await fs.readFile(agentFile, 'utf-8');
    const { data, content: systemPrompt } = matter(content);

    // Validate required fields
    if (!data.id || !data.name || !data.description) {
      throw new AgentError(
        'Agent missing required fields: id, name, description',
        agentId
      );
    }

    const metadata: AgentMetadata = {
      id: data.id,
      name: data.name,
      description: data.description,
      version: data.version || '1.0.0',
      author: data.author,
      avatar: data.avatar || '🤖',
      color: data.color || 'blue',
      capabilities: data.capabilities || [],
      activation_keywords: data.activation_keywords || [],
      requires_approval: data.requires_approval || false,
      max_iterations: data.max_iterations || 10,
    };

    const config: AgentConfig = {
      systemPrompt: systemPrompt.trim(),
      temperature: data.temperature || 0.7,
      maxTokens: data.max_tokens || 2000,
      tools: data.tools || [],
    };

    return {
      metadata,
      config,
      path: agentPath,
    };
  }

  async createDefaultAgents(): Promise<void> {
    const defaultAgents = [
      {
        id: 'research-agent',
        name: 'Research Agent',
        description: 'Systematically searches and synthesizes information, analyzes codebases, and provides detailed findings',
        avatar: '🔍',
        color: 'cyan',
        capabilities: ['codebase_analysis', 'information_synthesis', 'pattern_recognition'],
        activation_keywords: ['research', 'find', 'analyze', 'how does', 'explain'],
        systemPrompt: getAgentSystemPrompt('research'),
      },
      {
        id: 'code-agent',
        name: 'Code Implementation Agent',
        description: 'Systematically implements features with planning, todo tracking, and validation',
        avatar: '💻',
        color: 'green',
        capabilities: ['code_generation', 'systematic_planning', 'testing'],
        activation_keywords: ['implement', 'create', 'build', 'add feature', 'write code'],
        systemPrompt: getAgentSystemPrompt('implementation'),
      },
      {
        id: 'debug-agent',
        name: 'Debugging Agent',
        description: 'Systematically identifies and fixes bugs through methodical analysis',
        avatar: '🐛',
        color: 'red',
        capabilities: ['debugging', 'error_analysis', 'root_cause_identification'],
        activation_keywords: ['debug', 'fix', 'error', 'bug', 'not working'],
        systemPrompt: getAgentSystemPrompt('debugging'),
      },
      {
        id: 'coordinator-agent',
        name: 'Coordinator Agent',
        description: 'Systematically breaks down complex tasks, creates execution plans, and coordinates other agents',
        avatar: '🎯',
        color: 'yellow',
        capabilities: ['task_decomposition', 'agent_orchestration', 'systematic_planning'],
        activation_keywords: ['plan', 'coordinate', 'organize', 'break down', 'orchestrate'],
        systemPrompt: `${getAgentSystemPrompt('general')}

# TASK COORDINATOR SPECIALIST

You are a task coordinator. Your specific responsibilities:

1. **Analyze Complex Tasks**
   - Break down into atomic subtasks
   - Identify dependencies between tasks
   - Estimate complexity and effort

2. **Plan Agent Coordination**
   - Determine which agents are needed
   - Define the sequence of operations
   - Plan parallel vs sequential execution

3. **Create Execution Plans**
   - Clear step-by-step breakdown
   - Agent assignments for each step
   - Expected outputs and validation points

4. **Coordinate Execution**
   - Track progress across agents
   - Handle inter-agent dependencies
   - Synthesize results

EXAMPLE WORKFLOW:
\`\`\`
User: "Build a user authentication system"

ANALYSIS:
This requires multiple specialized tasks:
- Database schema design
- API endpoint implementation
- Security implementation (hashing, JWT)
- Testing

COORDINATION PLAN:
☐ 1. Research Agent: Analyze existing auth patterns in codebase
☐ 2. Code Agent: Implement database schema
☐ 3. Code Agent: Create auth service (hashing, JWT)
☐ 4. Code Agent: Build API endpoints
☐ 5. Debug Agent: Test and validate
☐ 6. Coordinator: Final integration check

DEPENDENCIES:
- Step 2 depends on Step 1 (need to know existing patterns)
- Steps 3-4 can run in parallel
- Step 5 depends on Steps 2-4 completion

EXECUTION:
Starting with Research Agent...
[Coordinates each step]
\`\`\`

Always work systematically and coordinate agents effectively.`,
      },
    ];

    for (const agentDef of defaultAgents) {
      const agentPath = path.join(this.agentsDirectory, agentDef.id);
      await fs.mkdir(agentPath, { recursive: true });

      const agentMd = `---
id: ${agentDef.id}
name: ${agentDef.name}
description: ${agentDef.description}
version: 1.0.0
avatar: ${agentDef.avatar}
color: ${agentDef.color}
capabilities: ${JSON.stringify(agentDef.capabilities)}
activation_keywords: ${JSON.stringify(agentDef.activation_keywords)}
requires_approval: false
max_iterations: 10
temperature: 0.7
max_tokens: 2000
---

${agentDef.systemPrompt}
`;

      await fs.writeFile(path.join(agentPath, 'AGENT.md'), agentMd, 'utf-8');
    }

    console.log(`✓ Created ${defaultAgents.length} default agents`);
  }

  getAgent(id: string): Agent | undefined {
    return this.loadedAgents.get(id);
  }

  listAgents(): Array<{ id: string; name: string; description: string }> {
    return Array.from(this.loadedAgents.values()).map(agent => ({
      id: agent.metadata.id,
      name: agent.metadata.name,
      description: agent.metadata.description,
    }));
  }
}

// ============================================================================
// AGENT EXECUTOR
// ============================================================================

export class AgentExecutor {
  private agent: Agent;
  private eventBus: AgentEventBus;
  private provider: any; // BaseProvider from your provider system
  private currentStatus: AgentStatus;

  constructor(agent: Agent, provider: any, eventBus: AgentEventBus) {
    this.agent = agent;
    this.provider = provider;
    this.eventBus = eventBus;

    this.currentStatus = {
      agentId: agent.metadata.id,
      status: 'idle',
      currentStep: 'Initialized',
      progress: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
    };
  }

  private updateStatus(
    status: AgentStatus['status'],
    currentStep: string,
    progress: number,
    metadata?: Record<string, any>
  ): void {
    this.currentStatus = {
      ...this.currentStatus,
      status,
      currentStep,
      progress,
      lastUpdate: new Date(),
      metadata,
    };

    this.eventBus.emitStatusUpdate(this.currentStatus);
  }

  private emitMessage(
    type: AgentMessage['type'],
    content: string,
    metadata?: Record<string, any>
  ): void {
    this.eventBus.emitMessage({
      agentId: this.agent.metadata.id,
      agentName: this.agent.metadata.name,
      timestamp: new Date(),
      type,
      content,
      metadata,
    });
  }

  async execute(task: string, context?: any): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      this.updateStatus('thinking', 'Analyzing task...', 10);
      this.emitMessage('thought', `Starting task: ${task}`);

      // Build messages
      const messages = [
        {
          role: 'system' as const,
          content: this.agent.config.systemPrompt,
        },
        {
          role: 'user' as const,
          content: this.buildTaskPrompt(task, context),
        },
      ];

      this.updateStatus('working', 'Processing with LLM...', 30);

      let fullResponse = '';
      let lastProgressUpdate = Date.now();

      // Stream response
      for await (const event of this.provider.stream(messages, {
        temperature: this.agent.config.temperature,
        maxTokens: this.agent.config.maxTokens,
      })) {
        if (event.type === 'token') {
          fullResponse += event.data;

          // Update progress every 500ms
          const now = Date.now();
          if (now - lastProgressUpdate > 500) {
            const progress = Math.min(90, 30 + (fullResponse.length / 10));
            this.updateStatus('working', 'Generating response...', progress);
            lastProgressUpdate = now;
          }
        } else if (event.type === 'done') {
          this.updateStatus('completed', 'Task completed', 100);
          this.emitMessage('result', fullResponse);

          const duration = Date.now() - startTime;
          const result: TaskResult = {
            success: true,
            agentId: this.agent.metadata.id,
            output: fullResponse,
            duration,
          };

          this.eventBus.emitTaskComplete(result);
          return result;
        } else if (event.type === 'error') {
          throw event.error;
        }
      }

      // Fallback if stream doesn't emit 'done'
      const duration = Date.now() - startTime;
      return {
        success: true,
        agentId: this.agent.metadata.id,
        output: fullResponse,
        duration,
      };
    } catch (error) {
      this.updateStatus('error', 'Task failed', 0);
      this.emitMessage('error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      const duration = Date.now() - startTime;
      const result: TaskResult = {
        success: false,
        agentId: this.agent.metadata.id,
        output: '',
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
      };

      this.eventBus.emitTaskComplete(result);

      throw new AgentExecutionError(
        this.agent.metadata.id,
        'Agent execution failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  private buildTaskPrompt(task: string, context?: any): string {
    let prompt = `Task: ${task}\n\n`;

    if (context) {
      prompt += `Context:\n${JSON.stringify(context, null, 2)}\n\n`;
    }

    prompt += `Please report your progress as you work through this task. Use phrases like:
- "Step 1: [description]"
- "Now analyzing..."
- "Processing..."
- "Completed [subtask]"

This helps the user understand what you're doing in real-time.`;

    return prompt;
  }

  getStatus(): AgentStatus {
    return { ...this.currentStatus };
  }
}

// ============================================================================
// AGENT ORCHESTRATOR
// ============================================================================

export class AgentOrchestrator {
  private loader: AgentLoader;
  private eventBus: AgentEventBus;
  private provider: any;
  private agents: Map<string, Agent> = new Map();
  private executors: Map<string, AgentExecutor> = new Map();
  private activeStatuses: Map<string, AgentStatus> = new Map();

  constructor(provider: any, agentsDirectory?: string) {
    this.provider = provider;
    this.loader = new AgentLoader(agentsDirectory);
    this.eventBus = new AgentEventBus();

    // Listen to status updates
    this.eventBus.onStatusUpdate((status) => {
      this.activeStatuses.set(status.agentId, status);
    });
  }

  async initialize(): Promise<void> {
    const agents = await this.loader.loadAll();
    for (const agent of agents) {
      this.agents.set(agent.metadata.id, agent);
    }

    console.log(`✓ AgentOrchestrator initialized with ${agents.length} agents`);
  }

  async executeAgent(
    agentId: string,
    task: string,
    context?: any
  ): Promise<TaskResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }

    // Create or reuse executor
    let executor = this.executors.get(agentId);
    if (!executor) {
      executor = new AgentExecutor(agent, this.provider, this.eventBus);
      this.executors.set(agentId, executor);
    }

    return await executor.execute(task, context);
  }

  async executeMultiple(
    tasks: Array<{ agentId: string; task: string; context?: any }>
  ): Promise<TaskResult[]> {
    const results = await Promise.allSettled(
      tasks.map(({ agentId, task, context }) =>
        this.executeAgent(agentId, task, context)
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          agentId: tasks[index].agentId,
          output: '',
          duration: 0,
          error: result.reason,
        };
      }
    });
  }

  async executeSequential(
    tasks: Array<{ agentId: string; task: string; context?: any }>
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    for (const { agentId, task, context } of tasks) {
      try {
        const result = await this.executeAgent(agentId, task, context);
        results.push(result);

        // Pass result as context to next task if needed
        if (context?.usesPreviousResult) {
          context.previousResult = result.output;
        }
      } catch (error) {
        results.push({
          success: false,
          agentId,
          output: '',
          duration: 0,
          error: error instanceof Error ? error : new Error(String(error)),
        });

        // Stop on error if configured
        if (context?.stopOnError) {
          break;
        }
      }
    }

    return results;
  }

  listAgents(): Array<{
    id: string;
    name: string;
    description: string;
    avatar: string;
    status: AgentStatus['status'];
  }> {
    return Array.from(this.agents.values()).map(agent => {
      const status = this.activeStatuses.get(agent.metadata.id);
      return {
        id: agent.metadata.id,
        name: agent.metadata.name,
        description: agent.metadata.description,
        avatar: agent.metadata.avatar || '🤖',
        status: status?.status || 'idle',
      };
    });
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.activeStatuses.get(agentId);
  }

  getAllStatuses(): AgentStatus[] {
    return Array.from(this.activeStatuses.values());
  }

  getActiveAgents(): AgentStatus[] {
    return this.getAllStatuses().filter(
      s => s.status !== 'idle' && s.status !== 'completed' && s.status !== 'error'
    );
  }

  onStatusUpdate(callback: (status: AgentStatus) => void): () => void {
    return this.eventBus.onStatusUpdate(callback);
  }

  onMessage(callback: (message: AgentMessage) => void): () => void {
    return this.eventBus.onMessage(callback);
  }

  onTaskComplete(callback: (result: TaskResult) => void): () => void {
    return this.eventBus.onTaskComplete(callback);
  }

  async reloadAgents(): Promise<void> {
    const agents = await this.loader.loadAll();
    this.agents.clear();
    for (const agent of agents) {
      this.agents.set(agent.metadata.id, agent);
    }
    console.log(`✓ Reloaded ${agents.length} agents`);
  }
}

// ============================================================================
// AGENT CREATOR (TUI Helper)
// ============================================================================

export class AgentCreator {
  private agentsDirectory: string;

  constructor(agentsDirectory: string = './agents') {
    this.agentsDirectory = path.resolve(agentsDirectory);
  }

  async createAgent(params: {
    id: string;
    name: string;
    description: string;
    avatar?: string;
    color?: string;
    capabilities?: string[];
    activation_keywords?: string[];
    systemPrompt: string;
  }): Promise<Agent> {
    const agentPath = path.join(this.agentsDirectory, params.id);

    // Check if agent already exists
    try {
      await fs.access(agentPath);
      throw new AgentError(`Agent already exists: ${params.id}`, params.id);
    } catch (error: any) {
      if (error.code !== 'ENOENT' && !(error instanceof AgentError)) {
        throw error;
      }
    }

    // Create directory
    await fs.mkdir(agentPath, { recursive: true });

    // Create AGENT.md
    const agentMd = `---
id: ${params.id}
name: ${params.name}
description: ${params.description}
version: 1.0.0
avatar: ${params.avatar || '🤖'}
color: ${params.color || 'blue'}
capabilities: ${JSON.stringify(params.capabilities || [])}
activation_keywords: ${JSON.stringify(params.activation_keywords || [])}
requires_approval: false
max_iterations: 10
temperature: 0.7
max_tokens: 2000
---

${params.systemPrompt}
`;

    await fs.writeFile(path.join(agentPath, 'AGENT.md'), agentMd, 'utf-8');

    console.log(`✓ Created agent: ${params.name} at ${agentPath}`);

    // Load and return the agent
    const loader = new AgentLoader(this.agentsDirectory);
    return await loader.loadAgent(params.id);
  }

  async deleteAgent(agentId: string): Promise<void> {
    const agentPath = path.join(this.agentsDirectory, agentId);

    try {
      await fs.access(agentPath);
      await fs.rm(agentPath, { recursive: true, force: true });
      console.log(`✓ Deleted agent: ${agentId}`);
    } catch (error) {
      throw new AgentNotFoundError(agentId);
    }
  }

  getAgentTemplate(): string {
    return `Create a new agent by providing:

1. **ID**: Unique identifier (e.g., 'my-agent')
2. **Name**: Display name (e.g., 'My Custom Agent')
3. **Description**: What does this agent do?
4. **Avatar**: Emoji or icon (e.g., '🎨')
5. **Capabilities**: What can it do? (e.g., ['image_generation', 'style_transfer'])
6. **Keywords**: When should it activate? (e.g., ['create image', 'generate art'])
7. **System Prompt**: Detailed instructions for the agent

Example:
/agent create
ID: art-agent
Name: Art Generator
Description: Creates and describes artwork
Avatar: 🎨
Capabilities: image_generation, art_description
Keywords: create art, generate image, make picture
System Prompt: You are an art specialist...`;
  }
}

// Singleton instance
let orchestratorInstance: AgentOrchestrator | null = null;

export function getAgentOrchestrator(provider: any, agentsDirectory?: string): AgentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestrator(provider, agentsDirectory);
  }
  return orchestratorInstance;
}

export function resetAgentOrchestrator(): void {
  orchestratorInstance = null;
}