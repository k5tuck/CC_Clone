import { Tool, ToolCall } from '../llm/ollama-client';

/**
 * Custom exception for streaming tool operations
 */
export class StreamingToolError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StreamingToolError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Message type for streaming
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

/**
 * Tool function type - accepts any params as Record
 */
export type ToolFunction = (params: Record<string, any>) => Promise<any>;

/**
 * Streaming event types with tool support
 */
export type StreamingToolEvent = 
  | { type: 'token'; data: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'tool_result'; toolName: string; result: any }
  | { type: 'done' }
  | { type: 'error'; error: Error };

/**
 * Interface for any streaming client
 */
export interface IStreamingClient {
  stream(messages: Message[]): Promise<string>;
  chatWithTools?(messages: Message[], tools: Tool[]): Promise<{ content: string; toolCalls?: ToolCall[] }>;
}

/**
 * Enhanced Streaming Client with automatic tool calling
 * 
 * This wraps your existing StreamingClient and adds tool-calling capability
 */
export class StreamingClientWithTools {
  private tools: Map<string, ToolFunction>;
  private toolSchemas: Tool[];
  private maxIterations: number;

  constructor(
    private readonly streamingClient: IStreamingClient,
    maxIterations: number = 10
  ) {
    this.tools = new Map();
    this.toolSchemas = [];
    this.maxIterations = maxIterations;
  }

  /**
   * Register a tool that can be called automatically
   */
  registerTool(name: string, func: ToolFunction, schema: Tool): void {
    this.tools.set(name, func);
    this.toolSchemas.push(schema);
  }

  /**
   * Execute a tool
   */
  private async executeTool(toolCall: ToolCall): Promise<any> {
    const func = this.tools.get(toolCall.name);
    
    if (!func) {
      throw new StreamingToolError(
        `Tool not found: ${toolCall.name}`,
        toolCall.name,
        { availableTools: Array.from(this.tools.keys()) }
      );
    }

    try {
      return await func(toolCall.arguments);
    } catch (error) {
      throw new StreamingToolError(
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        toolCall.name,
        { arguments: toolCall.arguments, error }
      );
    }
  }

  /**
   * Stream chat with automatic tool calling
   * 
   * This implements the agentic loop with streaming
   */
  async *streamChatWithTools(
    messages: Message[],
    onToolCall?: (toolCall: ToolCall) => void,
    onToolResult?: (toolName: string, result: any) => void
  ): AsyncGenerator<StreamingToolEvent> {
    let iteration = 0;
    const conversationMessages = [...messages];

    const streamToString = async (stream: AsyncGenerator<any>): Promise<string> => {
        let fullContent = '';
        for await (const event of stream) {
            if (event.type === 'token') fullContent += event.data;
        }
        return fullContent;
    };

    while (iteration < this.maxIterations) {
      iteration++;

      // Check if model supports tool calling
      let response: { content: string; toolCalls?: ToolCall[] };
      
      if (this.toolSchemas.length > 0 && this.streamingClient.chatWithTools) {
        // Try to get tool calls from the model
        try {
          response = await this.streamingClient.chatWithTools(
            conversationMessages,
            this.toolSchemas
          );
        } catch (error) {
          // Fallback to regular chat if tool calling not supported
          console.warn('[StreamingTools] Tool calling not supported, falling back to regular chat');
        //   const stream = this.streamingClient.stream(conversationMessages);
        //     response = {
        //     content: await streamToString(stream),
        //     toolCalls: []
        //     };
          response = {
            content: await this.streamingClient.stream(conversationMessages),
            toolCalls: []
          };
        }
      } else {
        // No tools registered or chatWithTools not available, use regular chat
        response = {
          content: await this.streamingClient.stream(conversationMessages),
          toolCalls: []
        };
      }

      // Stream the response content token by token
    //   const tokens = response.content.split(/(\s+)/);

    //   for (const token of tokens) {
    //     if (token) {
    //       yield { type: 'token', data: token };
    //       // Small delay to simulate streaming
    //       await new Promise(resolve => setTimeout(resolve, 10));
    //     }
    //   }

    const stream = this.streamingClient.stream(conversationMessages);

    // Correct: iterate over streaming events
    for await (const event of stream) {
        if (event.type === 'token') {
            yield { type: 'token', data: event.data };
        } else if (event.type === 'tool_call') {
            yield { type: 'tool_call', toolCall: event.toolCall };
        } else if (event.type === 'tool_result') {
            yield { type: 'tool_result', toolName: event.toolName, result: event.result };
        }
    }


      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        yield { type: 'done' };
        return;
      }

      // Execute tool calls automatically
      const toolResults: Record<string, any> = {};
      
      for (const toolCall of response.toolCalls) {
        // Notify about tool call
        yield { type: 'tool_call', toolCall };
        onToolCall?.(toolCall);

        try {
          const result = await this.executeTool(toolCall);
          toolResults[toolCall.name] = result;
          
          // Notify about tool result
          yield { type: 'tool_result', toolName: toolCall.name, result };
          onToolResult?.(toolCall.name, result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          toolResults[toolCall.name] = { error: errorMessage };
          
          yield { 
            type: 'tool_result', 
            toolName: toolCall.name, 
            result: { error: errorMessage } 
          };
        }
      }

      // Add assistant response to conversation
      conversationMessages.push({
        role: 'assistant',
        content: response.content,
      });

      // Add tool results to conversation
      const toolResultsText = Object.entries(toolResults)
        .map(([tool, result]) => `Tool "${tool}" result:\n${JSON.stringify(result, null, 2)}`)
        .join('\n\n');

      conversationMessages.push({
        role: 'user',
        content: `Tool execution results:\n\n${toolResultsText}\n\nPlease continue with your response based on these results.`,
      });

      // Continue loop for next iteration
    }

    // Max iterations reached
    yield { 
      type: 'error', 
      error: new Error(`Maximum iterations (${this.maxIterations}) exceeded`) 
    };
  }

  /**
   * Get list of registered tools
   */
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }
}

/**
 * Helper to register all standard tools
 */
export function registerStandardTools(client: StreamingClientWithTools): void {
  // Import tool functions
  const { 
    readFile, 
    writeFile, 
    searchFiles, 
    blobSearch, 
    bashExec 
  } = require('../tools/toolFunctions');

  // Register readFile
  client.registerTool(
    'readFile',
    (params: Record<string, any>) => readFile(params),
    {
      name: 'readFile',
      description: 'Read the contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read',
          },
        },
        required: ['path'],
      },
    }
  );

  // Register writeFile
  client.registerTool(
    'writeFile',
    (params: Record<string, any>) => writeFile(params),
    {
      name: 'writeFile',
      description: 'Write content to a file',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file',
          },
          content: {
            type: 'string',
            description: 'Content to write',
          },
        },
        required: ['path', 'content'],
      },
    }
  );

  // Register searchFiles
  client.registerTool(
    'searchFiles',
    (params: Record<string, any>) => searchFiles(params),
    {
      name: 'searchFiles',
      description: 'Search for files matching a pattern',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Directory to search' },
          pattern: { type: 'string', description: 'Regex pattern' },
          max: { type: 'number', description: 'Max results' },
        },
      },
    }
  );

  // Register blobSearch
  client.registerTool(
    'blobSearch',
    (params: Record<string, any>) => blobSearch(params),
    {
      name: 'blobSearch',
      description: 'Search for text content within files',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Directory to search' },
          q: { type: 'string', description: 'Search query' },
          maxFiles: { type: 'number', description: 'Max files' },
        },
        required: ['q'],
      },
    }
  );

  // Register bashExec
  client.registerTool(
    'bashExec',
    (params: Record<string, any>) => bashExec(params),
    {
      name: 'bashExec',
      description: 'Execute a bash command',
      parameters: {
        type: 'object',
        properties: {
          cmd: { type: 'string', description: 'Command to execute' },
          cwd: { type: 'string', description: 'Working directory' },
        },
        required: ['cmd'],
      },
    }
  );
}