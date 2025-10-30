import { v4 as uuidv4 } from 'uuid';
import { MultiAgentOrchestrator, TaskRequest } from '../../lib/orchestrator/multi-agent-orchestrator';
import { StreamingClient, StreamEvent } from '../../lib/streaming/StreamingClient';
import { ConversationHistoryManager, Message } from '../../lib/history/ConversationHistoryManager';

export type IntentType = 'task' | 'query' | 'command';

export interface Intent {
  type: IntentType;
  data: any;
}

export interface TaskIntent {
  type: 'task';
  description: string;
  domain: string;
  requiredAgents: string[];
}

export interface QueryIntent {
  type: 'query';
  question: string;
}

export interface CommandIntent {
  type: 'command';
  command: string;
  args: string[];
}

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
        description: intent.description,
        domain: intent.domain,
        requiredAgents: intent.requiredAgents,
        autoExecute: false,
        parallel: false,
      };

      // Execute through orchestrator
      const result = await this.orchestrator.executeTask(taskRequest);

      // Build response
      let response = `✅ Task analysis complete!\n\n`;
      response += `**Agents Assigned:**\n`;
      
      for (const [agentId, plan] of Object.entries(result.plans)) {
        response += `\n🤖 **${agentId}**\n`;
        response += `${plan}\n`;
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
        metadata: { error: true },
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
      }
      yield event;
    }

    // Save assistant response
    await this.historyManager.saveMessage(conversationId, {
      role: 'assistant',
      content: fullResponse,
    });
  }

  /**
   * Handle system commands
   */
  private async *handleCommand(
    conversationId: string,
    intent: CommandIntent
  ): AsyncGenerator<StreamEvent> {
    const { command, args } = intent;

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
            agentList += `• ${agent.agentId} [${agent.status}]\n`;
            agentList += `  Task: ${agent.task}\n\n`;
          });
        }
        
        yield { type: 'token', data: agentList };
        break;

      case 'clear':
        await this.historyManager.deleteConversation(conversationId);
        
        // Create new conversation
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
        let statsText = '📊 **Conversation Statistics:**\n\n';
        statsText += `• Total Messages: ${stats.totalMessages}\n`;
        statsText += `• Conversations: ${stats.totalConversations}\n`;
        statsText += `• Average: ${stats.averageMessagesPerConversation.toFixed(1)} msgs/conv\n`;
        
        yield { type: 'token', data: statsText };
        break;

      case 'export':
        const format = (args[0] || 'markdown') as 'json' | 'markdown' | 'txt';
        const exported = await this.historyManager.export(conversationId, format);
        const filename = `conversation-${Date.now()}.${format}`;
        
        // In a real implementation, write to file
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
   * Get help text
   */
  private getHelpText(): string {
    return `
📖 **CC_Clone Help**

**Available Commands:**
• /help - Show this help message
• /agents - List active agents
• /clear - Clear conversation history
• /stats - Show conversation statistics
• /export [format] - Export conversation (json|markdown|txt)
• /exit - Exit application (or use Ctrl+C)

**Usage:**
• Just type naturally to chat with the AI
• Mention tasks like "implement X" to spawn agents
• Use commands starting with / for system actions

**Examples:**
• "Implement a user authentication system"
• "What is TypeScript?"
• "/agents" to see active agents
• "/export markdown" to save conversation

Type your message and press Enter to send.
`;
  }
}