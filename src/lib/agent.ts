import { Message, Tool, ToolCall, OllamaClient } from './llm/ollama-client';
import { MCPClientManager, MCPServerConfig } from '../mcp/mcp-client';
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
 * Conversation turn tracking with enhanced context
 */
export interface ConversationTurn {
  messages: Message[];
  toolCalls: ToolCall[];
  toolResults: Record<string, any>;
  timestamp: Date;
  summary?: string; // For context compression
}

/**
 * Context Manager for sliding window and summarization
 */
class ContextManager {
  private turns: ConversationTurn[] = [];
  private contextSummary: string = '';
  private readonly maxTurns = 10; // Keep last 10 turns
  private readonly summaryThreshold = 15; // Summarize after 15 turns

  addTurn(turn: ConversationTurn) {
    this.turns.push(turn);
    
    // Trigger summarization if needed
    if (this.turns.length > this.summaryThreshold && !this.contextSummary) {
      this.contextSummary = this.generateSummary();
      // Keep only recent turns after summarization
      this.turns = this.turns.slice(-this.maxTurns);
    }
  }

  getTurns(): ConversationTurn[] {
    return this.turns;
  }

  getContextSummary(): string {
    return this.contextSummary;
  }

  private generateSummary(): string {
    const oldTurns = this.turns.slice(0, -this.maxTurns);
    
    let summary = "# Previous Conversation Summary\n\n";
    
    // Summarize tool usage
    const toolsUsed = new Set<string>();
    oldTurns.forEach(turn => {
      turn.toolCalls.forEach(tc => toolsUsed.add(tc.name));
    });
    
    if (toolsUsed.size > 0) {
      summary += `Tools used: ${Array.from(toolsUsed).join(', ')}\n\n`;
    }
    
    // Key decisions/actions
    summary += "Key actions taken:\n";
    oldTurns.forEach((turn, i) => {
      if (turn.toolCalls.length > 0) {
        summary += `- Turn ${i + 1}: ${turn.toolCalls.map(tc => tc.name).join(', ')}\n`;
      }
    });
    
    return summary;
  }

  clear() {
    this.turns = [];
    this.contextSummary = '';
  }

  getStats() {
    return {
      totalTurns: this.turns.length,
      hasSummary: !!this.contextSummary,
      toolCallsCount: this.turns.reduce((sum, t) => sum + t.toolCalls.length, 0),
    };
  }
}

/**
 * Base Agent class with LLM, local tools, and MCP integration
 */
export class Agent {
  meta: AgentMeta;
  private llm: OllamaClient;
  private tools: Map<string, ToolFunction>;
  private toolSchemas: Tool[];
  private conversationHistory: ConversationTurn[];
  private maxIterations: number;
  
  // NEW: MCP Client Manager
  private mcpManager: MCPClientManager;
  
  // NEW: Context Manager
  private contextManager: ContextManager;

  constructor(
    meta: AgentMeta,
    llm: OllamaClient,
    maxIterations: number = 10,
    mcpServers?: MCPServerConfig[]
  ) {
    this.meta = meta;
    this.llm = llm;
    this.tools = new Map();
    this.toolSchemas = [];
    this.conversationHistory = [];
    this.maxIterations = maxIterations;
    
    // Initialize MCP Client Manager
    this.mcpManager = new MCPClientManager();
    
    // Initialize Context Manager
    this.contextManager = new ContextManager();
    
    // Connect to MCP servers if provided
    if (mcpServers && mcpServers.length > 0) {
      this.initializeMCPServers(mcpServers);
    }
  }

  /**
   * Initialize MCP server connections
   */
  private async initializeMCPServers(servers: MCPServerConfig[]): Promise<void> {
    console.log(`\n🔌 Connecting ${this.meta.name} to MCP servers...`);
    
    for (const server of servers) {
      try {
        await this.mcpManager.connectToServer(server);
      } catch (error: any) {
        console.error(`  ❌ Failed to connect to ${server.name}:`, error.message);
      }
    }
    
    const connectedCount = this.mcpManager.getConnectedServers().length;
    console.log(`  ✓ Connected to ${connectedCount} MCP server(s)\n`);
  }

  /**
   * Register a local tool that the agent can use
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
   * Execute a tool (local or MCP)
   */
  private async executeTool(toolCall: ToolCall): Promise<any> {
    // Check local tools first
    const localFunc = this.tools.get(toolCall.name);
    
    if (localFunc) {
      try {
        const result = await localFunc(toolCall.arguments);
        return result;
      } catch (error: any) {
        throw new ToolExecutionError(
          toolCall.name,
          toolCall.arguments,
          error
        );
      }
    }

    // Try MCP tools
    try {
      const result = await this.mcpManager.callTool(toolCall.name, toolCall.arguments);
      return result;
    } catch (error: any) {
      // If not found in MCP either, throw tool not found error
      throw new ToolNotFoundError(
        toolCall.name,
        this.getAvailableTools()
      );
    }
  }

  /**
   * Get all available tools (local + MCP)
   */
  private getAllToolSchemas(): Tool[] {
    // Local tools
    const localTools = [...this.toolSchemas];
    
    // MCP tools
    const mcpTools = this.mcpManager.getToolsForLLM();
    
    return [...localTools, ...mcpTools];
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
   * Build system message with context awareness
   */
  private buildSystemMessage(): string {
    let systemMessage = this.meta.systemPrompt || '';
    
    // Add context summary if available
    const contextSummary = this.contextManager.getContextSummary();
    if (contextSummary) {
      systemMessage += `\n\n${contextSummary}`;
    }
    
    // Add tool availability info
    const availableTools = this.getAvailableTools();
    const localTools = Array.from(this.tools.keys());
    const mcpTools = availableTools.filter(t => !localTools.includes(t));
    
    if (mcpTools.length > 0) {
      systemMessage += `\n\nNote: You have access to ${mcpTools.length} additional MCP tools from connected servers.`;
    }
    
    return systemMessage;
  }

  /**
   * Run the agent with a user prompt, using tools (local + MCP)
   */
  async run(
    userPrompt: string,
    contextFiles: string[] = []
  ): Promise<string> {
    const messages: Message[] = [];

    // Add enhanced system prompt
    const systemMessage = this.buildSystemMessage();
    if (systemMessage) {
      messages.push({
        role: 'system',
        content: systemMessage,
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
    const currentTurn: ConversationTurn = {
      messages: [],
      toolCalls: [],
      toolResults: {},
      timestamp: new Date(),
    };

    // Get ALL available tools (local + MCP)
    const allTools = this.getAllToolSchemas();

    // Agentic loop: LLM may call tools multiple times
    while (iteration < this.maxIterations) {
      iteration++;

      const response = await this.llm.chatWithTools(messages, allTools);
      
      // If no tool calls, we're done
      if (response.toolCalls.length === 0) {
        finalResponse = response.content;
        
        currentTurn.messages = [...messages];
        this.contextManager.addTurn(currentTurn);
        this.conversationHistory.push(currentTurn);
        
        break;
      }

      // Execute all tool calls (local + MCP)
      const toolResults: Record<string, any> = {};
      
      for (const toolCall of response.toolCalls) {
        try {
          const result = await this.executeTool(toolCall);
          toolResults[toolCall.name] = result;
          
          // Track tool calls
          currentTurn.toolCalls.push(toolCall);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          toolResults[toolCall.name] = { error: errorMsg };
          console.error(`Tool execution error for ${toolCall.name}:`, errorMsg);
        }
      }

      currentTurn.toolResults = toolResults;

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

    const systemMessage = this.buildSystemMessage();
    if (systemMessage) {
      messages.push({
        role: 'system',
        content: systemMessage,
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
    this.contextManager.clear();
  }

  /**
   * Get list of ALL available tools (local + MCP)
   */
  getAvailableTools(): string[] {
    const localTools = Array.from(this.tools.keys());
    const mcpTools = this.mcpManager.getAllTools().map(t => t.name);
    return [...localTools, ...mcpTools];
  }

  /**
   * Get detailed tool information
   */
  getToolInfo(): {
    local: string[];
    mcp: Array<{ name: string; server: string; description: string }>;
    total: number;
  } {
    const localTools = Array.from(this.tools.keys());
    const mcpTools = this.mcpManager.getAllTools().map(t => ({
      name: t.name,
      server: t.serverName,
      description: t.tool.description || 'No description',
    }));

    return {
      local: localTools,
      mcp: mcpTools,
      total: localTools.length + mcpTools.length,
    };
  }

  /**
   * Get context statistics
   */
  getContextStats() {
    return this.contextManager.getStats();
  }

  /**
   * Check if agent has a specific tool (local or MCP)
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName) || 
           this.mcpManager.getAllTools().some(t => t.name === toolName);
  }

  /**
   * Get connected MCP servers
   */
  getConnectedMCPServers(): string[] {
    return this.mcpManager.getConnectedServers();
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    await this.mcpManager.disconnectAll();
    console.log(`Agent ${this.meta.name} shut down successfully`);
  }
}