import { Message, Tool, ToolCall, OllamaClient } from './llm/ollama-client';
import path from 'path';
import fs from 'fs/promises';

/**
 * Custom exceptions for agent operations
 */
export class ToolNotFoundError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly availableTools: string[]
  ) {
    super(`Tool "${toolName}" not found. Available tools: ${availableTools.join(', ')}`);
    this.name = 'ToolNotFoundError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ToolExecutionError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly args: Record<string, any>,
    public readonly originalError: Error
  ) {
    super(`Failed to execute tool "${toolName}": ${originalError.message}`);
    this.name = 'ToolExecutionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AgentContextError extends Error {
  constructor(
    public readonly agentName: string,
    public readonly contextFile: string,
    public readonly reason: string
  ) {
    super(`Agent "${agentName}" failed to load context from "${contextFile}": ${reason}`);
    this.name = 'AgentContextError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class MaxIterationsExceededError extends Error {
  constructor(
    public readonly agentName: string,
    public readonly maxIterations: number
  ) {
    super(`Agent "${agentName}" exceeded maximum iterations (${maxIterations})`);
    this.name = 'MaxIterationsExceededError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Agent role types
 */
export type Role = 'admin' | 'writer' | 'analyst' | 'sub-agent' | 'implementation' | 'security' | 'performance';

/**
 * Agent metadata
 */
export interface AgentMeta {
  name: string;
  role: Role;
  allowedTools?: string[];
  systemPrompt?: string;
}

/**
 * Tool function signature
 */
export type ToolFunction = (params: Record<string, any>) => Promise<any>;

/**
 * Conversation turn tracking
 */
export interface ConversationTurn {
  messages: Message[];
  toolCalls: ToolCall[];
  toolResults: Record<string, any>;
  timestamp: Date;
}

/**
 * Base Agent class with LLM and tool integration
 */
export class Agent {
  meta: AgentMeta;
  private llm: OllamaClient;
  private tools: Map<string, ToolFunction>;
  private toolSchemas: Tool[];
  private conversationHistory: ConversationTurn[];
  private maxIterations: number;

  constructor(
    meta: AgentMeta,
    llm: OllamaClient,
    maxIterations: number = 10
  ) {
    this.meta = meta;
    this.llm = llm;
    this.tools = new Map();
    this.toolSchemas = [];
    this.conversationHistory = [];
    this.maxIterations = maxIterations;
  }

  /**
   * Register a tool that the agent can use
   */
  registerTool(
    name: string,
    func: ToolFunction,
    schema: Tool
  ): void {
    if (this.meta.allowedTools && !this.meta.allowedTools.includes(name)) {
      console.warn(`Tool "${name}" not in allowed tools for agent "${this.meta.name}"`);
      return;
    }

    this.tools.set(name, func);
    this.toolSchemas.push(schema);
  }

  /**
   * Execute a registered tool
   */
  private async executeTool(toolCall: ToolCall): Promise<any> {
    const func = this.tools.get(toolCall.name);
    
    if (!func) {
      throw new ToolNotFoundError(
        toolCall.name,
        Array.from(this.tools.keys())
      );
    }

    try {
      const result = await func(toolCall.arguments);
      return result;
    } catch (error: any) {
      throw new ToolExecutionError(
        toolCall.name,
        toolCall.arguments,
        error
      );
    }
  }

  /**
   * Read context from a file (typically claude.md or orchestrator file)
   */
  async loadContext(filePath: string): Promise<string> {
    try {
      const resolvedPath = path.resolve(filePath);
      await fs.access(resolvedPath);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      return content;
    } catch (error: any) {
      throw new AgentContextError(
        this.meta.name,
        filePath,
        error.code === 'ENOENT' ? 'File not found' : error.message
      );
    }
  }

  /**
   * Run the agent with a user prompt, potentially using tools
   */
  async run(
    userPrompt: string,
    contextFiles: string[] = []
  ): Promise<string> {
    const messages: Message[] = [];

    // Add system prompt
    if (this.meta.systemPrompt) {
      messages.push({
        role: 'system',
        content: this.meta.systemPrompt,
      });
    }

    // Load and add context from files
    for (const contextFile of contextFiles) {
      try {
        const context = await this.loadContext(contextFile);
        messages.push({
          role: 'system',
          content: `Context from ${path.basename(contextFile)}:\n\n${context}`,
        });
      } catch (error) {
        console.warn(`Failed to load context from ${contextFile}:`, error);
      }
    }

    // Add user prompt
    messages.push({
      role: 'user',
      content: userPrompt,
    });

    let iteration = 0;
    let finalResponse = '';

    // Agentic loop: LLM may call tools multiple times
    while (iteration < this.maxIterations) {
      iteration++;

      const response = await this.llm.chatWithTools(messages, this.toolSchemas);
      
      // If no tool calls, we're done
      if (response.toolCalls.length === 0) {
        finalResponse = response.content;
        
        this.conversationHistory.push({
          messages: [...messages],
          toolCalls: [],
          toolResults: {},
          timestamp: new Date(),
        });
        
        break;
      }

      // Execute all tool calls
      const toolResults: Record<string, any> = {};
      
      for (const toolCall of response.toolCalls) {
        try {
          const result = await this.executeTool(toolCall);
          toolResults[toolCall.name] = result;
        } catch (error) {
          toolResults[toolCall.name] = { error: error instanceof Error ? error.message : String(error) };
        }
      }

      // Add assistant response and tool results to conversation
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      const toolResultsText = Object.entries(toolResults)
        .map(([tool, result]) => `Tool "${tool}" result:\n${JSON.stringify(result, null, 2)}`)
        .join('\n\n');

      messages.push({
        role: 'user',
        content: `Tool execution results:\n\n${toolResultsText}\n\nPlease continue or provide your final response.`,
      });

      this.conversationHistory.push({
        messages: [...messages],
        toolCalls: response.toolCalls,
        toolResults,
        timestamp: new Date(),
      });
    }

    if (iteration >= this.maxIterations) {
      throw new MaxIterationsExceededError(this.meta.name, this.maxIterations);
    }

    return finalResponse;
  }

  /**
   * Simple chat without tools
   */
  async chat(userPrompt: string): Promise<string> {
    const messages: Message[] = [];

    if (this.meta.systemPrompt) {
      messages.push({
        role: 'system',
        content: this.meta.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: userPrompt,
    });

    return await this.llm.chat(messages);
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationTurn[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get list of registered tools
   */
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if agent has a specific tool
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }
}
