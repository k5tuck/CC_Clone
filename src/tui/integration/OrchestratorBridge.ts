import { v4 as uuidv4 } from 'uuid';
import { MultiAgentOrchestrator, TaskRequest } from '../../lib/orchestrator/multi-agent-orchestrator';
import { StreamingClient, StreamEvent } from '../../lib/streaming/StreamingClient';
import { ConversationHistoryManager, Message } from '../../lib/history/ConversationHistoryManager';
import fs from 'fs/promises';

export type IntentType = 'task' | 'query' | 'command';

export interface BaseIntent {
  type: IntentType;
  data: any;
}

export interface TaskIntent extends BaseIntent {
  type: 'task';
  data: {
    description: string;
    domain: string;
    requiredAgents: string[];
  };
}

export interface QueryIntent extends BaseIntent {
  type: 'query';
  data: {
    question: string;
  };
}

export interface CommandIntent extends BaseIntent {
  type: 'command';
  data: {
    command: string;
    args: string[];
  };
}

export type Intent = TaskIntent | QueryIntent | CommandIntent;

export class OrchestratorBridge {
  constructor(
    private orchestrator: MultiAgentOrchestrator,
    private streamingClient: StreamingClient,
    private historyManager: ConversationHistoryManager
  ) {}

  /**
   * Process a user message through the appropriate handler
   */
  async *processMessage(
    conversationId: string,
    userMessage: string
  ): AsyncGenerator<StreamEvent> {
    // Save user message first
    await this.historyManager.saveMessage(conversationId, {
      role: 'user',
      content: userMessage,
    });

    // Detect intent
    const intent = this.detectIntent(userMessage);

    // Route to appropriate handler
    switch (intent.type) {
      case 'command':
        yield* this.handleCommand(conversationId, intent as CommandIntent);
        break;
      case 'task':
        yield* this.executeTask(conversationId, intent as TaskIntent);
        break;
      case 'query':
      default:
        yield* this.streamResponse(conversationId, userMessage);
        break;
    }
  }

  /**
   * Detect user intent from message
   */
  private detectIntent(message: string): Intent {
    const trimmed = message.trim();

    // Command detection
    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(' ');
      return {
        type: 'command',
        data: {
          command: parts[0],
          args: parts.slice(1),
        },
      } as CommandIntent;
    }

    // Task detection - look for action keywords
    const taskKeywords = [
      'implement', 'create', 'build', 'develop', 'write',
      'optimize', 'refactor', 'test', 'deploy', 'fix',
      'add', 'remove', 'update', 'modify', 'generate'
    ];

    const hasTaskKeyword = taskKeywords.some(keyword => 
      trimmed.toLowerCase().includes(keyword)
    );

    if (hasTaskKeyword) {
      return {
        type: 'task',
        data: {
          description: message,
          domain: this.inferDomain(message),
          requiredAgents: this.inferAgents(message),
        },
      } as TaskIntent;
    }

    // Default to query
    return {
      type: 'query',
      data: { question: message },
    } as QueryIntent;
  }

  /**
   * Infer domain from message content
   */
  private inferDomain(message: string): string {
    const lower = message.toLowerCase();
    
    if (lower.includes('security') || lower.includes('auth') || lower.includes('permission')) {
      return 'Application Security';
    }
    if (lower.includes('performance') || lower.includes('optimize') || lower.includes('speed')) {
      return 'Performance Optimization';
    }
    if (lower.includes('test') || lower.includes('testing')) {
      return 'Testing';
    }
    
    return 'TypeScript Development';
  }

  /**
   * Infer required agents from message
   */
  private inferAgents(message: string): string[] {
    const agents: string[] = ['implementation']; // Always include implementation
    const lower = message.toLowerCase();

    if (lower.includes('security') || lower.includes('auth')) {
      agents.push('security');
    }
    if (lower.includes('performance') || lower.includes('optimize')) {
      agents.push('performance');
    }

    return agents;
  }

  /**
   * Execute a task through the orchestrator
   */
  private async *executeTask(
    conversationId: string,
    intent: TaskIntent
  ): AsyncGenerator<StreamEvent> {
    yield {
      type: 'token',
      data: '🤖 Analyzing task and coordinating agents...\n\n',
    };

    try {
      const taskRequest: TaskRequest = {
        description: intent.data.description,
        domain: intent.data.domain,
        requiredAgents: intent.data.requiredAgents,
        autoExecute: false,
        parallel: false,
      };

      // Execute through orchestrator
      const result = await this.orchestrator.executeTask(taskRequest);

      // Build response
      let response = `✅ Task analysis complete!\n\n`;
      response += `**Agents Assigned:**\n`;

      for (const [agentId, planFile] of Object.entries(result.plans)) {
        response += `\n🤖 **${agentId}**\n`;
        response += `📄 Plan file: \`${planFile}\`\n\n`;

        // Read and display plan content
        try {
          const planContent = await fs.readFile(planFile, 'utf-8');

          // Extract implementation steps section
          const lines = planContent.split('\n');
          const stepsStartIdx = lines.findIndex(l =>
            l.toLowerCase().includes('## implementation') ||
            l.toLowerCase().includes('## steps') ||
            l.toLowerCase().includes('## plan')
          );

          if (stepsStartIdx >= 0) {
            // Find next section or take next 30 lines
            let stepsEndIdx = lines.findIndex((l, i) =>
              i > stepsStartIdx + 1 && l.startsWith('##')
            );
            if (stepsEndIdx === -1) stepsEndIdx = Math.min(lines.length, stepsStartIdx + 30);

            const stepsContent = lines.slice(stepsStartIdx, stepsEndIdx).join('\n');
            response += `**Plan Preview:**\n${stepsContent}\n\n`;
          } else {
            // No clear steps section, show first 500 chars
            response += `**Plan Preview:**\n${planContent.substring(0, 500)}...\n\n`;
          }

          response += `*Type \`/view-plan ${agentId}\` to see full plan*\n`;
        } catch (error: any) {
          response += `⚠️  Could not read plan file: ${error.message}\n`;
        }
      }

      yield { type: 'token', data: response };
      
      // Save response
      await this.historyManager.saveMessage(conversationId, {
        role: 'assistant',
        content: response,
        metadata: {
          agentId: 'orchestrator',
        },
      });

      yield { type: 'done', final: response };

    } catch (error: any) {
      const errorMsg = `❌ Task execution failed: ${error.message}`;
      yield { type: 'error', error: new Error(errorMsg) };
      
      await this.historyManager.saveMessage(conversationId, {
        role: 'assistant',
        content: errorMsg,
        metadata: { error: new Error(error.message) },
      });
    }
  }

  /**
   * Stream a direct LLM response
   */
private async *streamResponse(
  conversationId: string,
  userMessage: string
): AsyncGenerator<StreamEvent> {
  // Get conversation context
  const context = await this.historyManager.getContext(conversationId);
  
  // Convert to LLM format
  const messages = context.map(msg => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }));

  let fullResponse = '';

  // Stream from LLM
  for await (const event of this.streamingClient.stream(messages)) {
    if (event.type === 'token') {
      fullResponse += event.data;
      yield event;
    } 
    else if (event.type === 'done') {
      // IMPORTANT: Save BEFORE yielding done
      await this.historyManager.saveMessage(conversationId, {
        role: 'assistant',
        content: fullResponse,
      });
      
      // Now yield done
      yield event;
    } 
    else {
      yield event;
    }
  }
}

  /**
   * Handle system commands
   */
 private async *handleCommand(
  conversationId: string,
  intent: CommandIntent
): AsyncGenerator<StreamEvent> {
  const { command, args } = intent.data;

  switch (command.toLowerCase()) {
    case 'help':
      yield {
        type: 'token',
        data: this.getHelpText(),
      };
      break;

    case 'agents':
      const agents = this.orchestrator.getAgentRegistry();
      let agentList = '🤖 **Active Agents:**\n\n';
      
      if (agents.length === 0) {
        agentList += 'No agents currently active.\n';
      } else {
        agents.forEach(agent => {
          agentList += `• **${agent.agentId}** [${agent.status}]\n`;
          agentList += `  Task: ${agent.task}\n`;
          agentList += `  Created: ${new Date(agent.timestamp || Date.now()).toLocaleString()}\n\n`;
        });
      }
      
      yield { type: 'token', data: agentList };
      break;

    case 'spawn':
      yield* this.handleSpawnCommand(conversationId, args);
      break;

    case 'kill':
      yield* this.handleKillCommand(conversationId, args);
      break;

    case 'clear':
      await this.historyManager.deleteConversation(conversationId);
      
      const newId = await this.historyManager.createConversation(
        `Chat ${new Date().toLocaleString()}`
      );
      
      yield {
        type: 'token',
        data: '✅ Conversation cleared. Starting fresh!\n',
      };
      break;

    case 'stats':
      const stats = await this.historyManager.getStatistics(conversationId);
      const agentStats = {
        total: this.orchestrator.getAgentRegistry().length,
        active: this.orchestrator.getAgentsByStatus('active').length,
        completed: this.orchestrator.getAgentsByStatus('completed').length,
        failed: this.orchestrator.getAgentsByStatus('failed').length,
      };

      let statsText = '📊 **System Statistics:**\n\n';
      statsText += '**Agents:**\n';
      statsText += `  • Total: ${agentStats.total}\n`;
      statsText += `  • Active: ${agentStats.active}\n`;
      statsText += `  • Completed: ${agentStats.completed}\n`;
      statsText += `  • Failed: ${agentStats.failed}\n\n`;
      statsText += '**Conversations:**\n';
      statsText += `  • Total Messages: ${stats.totalMessages}\n`;
      statsText += `  • Total Conversations: ${stats.totalConversations}\n`;
      statsText += `  • Average: ${stats.averageMessagesPerConversation.toFixed(1)} msgs/conv\n`;
      
      yield { type: 'token', data: statsText };
      break;

    case 'export':
      const format = (args[0] || 'markdown') as 'json' | 'markdown' | 'txt';
      const exported = await this.historyManager.export(conversationId, format);
      const filename = `conversation-${Date.now()}.${format}`;
      
      yield {
        type: 'token',
        data: `✅ Conversation exported to ${filename}\n\n${exported.slice(0, 500)}...\n`,
      };
      break;

    default:
      yield {
        type: 'error',
        error: new Error(`Unknown command: /${command}. Type /help for available commands.`),
      };
  }

  yield { type: 'done', final: '' };
}

/**
 * Handle /spawn command
 */
private async *handleSpawnCommand(
  conversationId: string,
  args: string[]
): AsyncGenerator<StreamEvent> {
  if (args.length < 2) {
    yield {
      type: 'error',
      error: new Error('Usage: /spawn <type> <task description>\nTypes: implementation, security, performance'),
    };
    return;
  }

  const agentType = args[0].toLowerCase();
  const task = args.slice(1).join(' ');

  const validTypes = ['implementation', 'security', 'performance'];
  if (!validTypes.includes(agentType)) {
    yield {
      type: 'error',
      error: new Error(`Invalid agent type: ${agentType}.\nValid types: ${validTypes.join(', ')}`),
    };
    return;
  }

  yield {
    type: 'token',
    data: `🚀 Spawning ${agentType} agent...\n\n`,
  };

  try {
    const domain = this.inferDomainFromType(agentType);
    
    const taskRequest: TaskRequest = {
      description: task,
      domain,
      requiredAgents: [agentType],
      autoExecute: false,
      parallel: false,
    };

    const result = await this.orchestrator.executeTask(taskRequest);

    let response = `✅ Agent spawned successfully!\n\n`;
    response += `**Agent:** ${agentType}\n`;
    response += `**Task:** ${task}\n\n`;

    for (const [agentId, planFile] of Object.entries(result.plans)) {
      response += `\n🤖 **${agentId}**\n`;
      response += `📄 Plan file: \`${planFile}\`\n\n`;

      // Read and display plan content
      try {
        const planContent = await fs.readFile(planFile, 'utf-8');

        // Extract key sections
        const lines = planContent.split('\n');
        const stepsStartIdx = lines.findIndex(l =>
          l.toLowerCase().includes('## implementation') ||
          l.toLowerCase().includes('## steps') ||
          l.toLowerCase().includes('## plan')
        );

        if (stepsStartIdx >= 0) {
          let stepsEndIdx = lines.findIndex((l, i) =>
            i > stepsStartIdx + 1 && l.startsWith('##')
          );
          if (stepsEndIdx === -1) stepsEndIdx = Math.min(lines.length, stepsStartIdx + 25);

          const stepsContent = lines.slice(stepsStartIdx, stepsEndIdx).join('\n');
          response += `**Plan:**\n${stepsContent}\n\n`;
        } else {
          response += `**Plan:**\n${planContent.substring(0, 400)}...\n\n`;
        }
      } catch (error: any) {
        response += `⚠️  Could not read plan: ${error.message}\n`;
      }
    }

    yield { type: 'token', data: response };
    
    await this.historyManager.saveMessage(conversationId, {
      role: 'assistant',
      content: response,
      metadata: {
        agentId: 'orchestrator',
        command: 'spawn',
      },
    });

  } catch (error: any) {
    const errorMsg = `❌ Failed to spawn agent: ${error.message}`;
    yield { type: 'error', error: new Error(errorMsg) };
    
    await this.historyManager.saveMessage(conversationId, {
      role: 'assistant',
      content: errorMsg,
      metadata: { error: new Error(error.message) },
    });
  }
}

/**
 * Handle /kill command
 */
private async *handleKillCommand(
  conversationId: string,
  args: string[]
): AsyncGenerator<StreamEvent> {
  if (args.length === 0) {
    yield {
      type: 'error',
      error: new Error('Usage: /kill <agent-id>\nUse /agents to see active agents'),
    };
    return;
  }

  const agentId = args[0];
  
  try {
    // Check if agent exists
    const agents = this.orchestrator.getAgentRegistry();
    const agent = agents.find(a => a.agentId === agentId);

    if (!agent) {
      yield {
        type: 'error',
        error: new Error(`Agent not found: ${agentId}\nUse /agents to see active agents`),
      };
      return;
    }

    // Kill the agent (you'll need to implement this in orchestrator)
    // For now, just acknowledge
    const response = `⚠️ Terminated agent: ${agentId}\n\nNote: Agent termination is not yet implemented. This is a placeholder.`;
    
    yield { type: 'token', data: response };
    
    await this.historyManager.saveMessage(conversationId, {
      role: 'assistant',
      content: response,
      metadata: {
        agentId: 'orchestrator',
        command: 'kill',
      },
    });

  } catch (error: any) {
    const errorMsg = `❌ Failed to kill agent: ${error.message}`;
    yield { type: 'error', error: new Error(errorMsg) };
  }
}

/**
 * Infer domain from agent type
 */
private inferDomainFromType(agentType: string): string {
  switch (agentType) {
    case 'security':
      return 'Application Security';
    case 'performance':
      return 'Performance Optimization';
    case 'implementation':
    default:
      return 'TypeScript Development';
  }
}

/**
 * Get help text with spawn/kill commands
 */
private getHelpText(): string {
  return `
📖 **Selek Help**

**Available Commands:**
- /help - Show this help message
- /agents - List active agents and their status
- /spawn <type> <task> - Manually spawn an agent
  Types: implementation, security, performance
  Example: /spawn implementation Create a login API
- /kill <agent-id> - Terminate a specific agent
- /clear - Clear conversation history
- /stats - Show conversation and system statistics
- /export [format] - Export conversation (json|markdown|txt)
- /exit - Exit application (or use Ctrl+C)

**Usage:**
- Just type naturally to chat with the AI
- Mention tasks like "implement X" to auto-spawn agents
- Use /spawn for manual agent control
- Use /agents to monitor active agents
- Use /kill to stop agents

**Examples:**
- "Implement a user authentication system" (auto-spawns agent)
- "/spawn security Audit the login flow" (manual spawn)
- "/agents" (list all agents)
- "/kill agent-123" (terminate agent)
- "/stats" (show statistics)

Type your message and press Enter to send.
`;
}
}