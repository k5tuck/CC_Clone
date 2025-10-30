import axios, { AxiosInstance } from 'axios';

/**
 * Custom exception for LLM-related errors
 */
export class LLMConnectionError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly originalError: Error,
    public readonly context: Record<string, any>
  ) {
    super(`Failed to connect to LLM at ${endpoint}: ${originalError.message}`);
    this.name = 'LLMConnectionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class LLMResponseError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly responseData: any,
    public readonly context: Record<string, any>
  ) {
    super(`LLM returned error status ${statusCode}`);
    this.name = 'LLMResponseError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class LLMTimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly context: Record<string, any>
  ) {
    super(`LLM request timed out after ${timeoutMs}ms`);
    this.name = 'LLMTimeoutError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class InvalidToolCallError extends Error {
  constructor(
    public readonly toolCallData: any,
    public readonly reason: string
  ) {
    super(`Invalid tool call: ${reason}`);
    this.name = 'InvalidToolCallError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Message structure for chat conversations
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Tool definition for function calling
 */
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

/**
 * Tool call response from LLM
 */
export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

/**
 * Configuration for Ollama client
 */
export interface OllamaConfig {
  endpoint: string;
  model: string;
  temperature?: number;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Response from Ollama chat endpoint
 */
interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Client for interacting with local Ollama LLM
 */
export class OllamaClient {
  private readonly client: AxiosInstance;
  private readonly config: Required<OllamaConfig>;

  constructor(config: OllamaConfig) {
    this.config = {
      temperature: 0.7,
      timeout: 120000,
      maxRetries: 3,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Simple chat completion without tools
   */
  async chat(messages: Message[]): Promise<string> {
    this.validateMessages(messages);

    const context = {
      messageCount: messages.length,
      model: this.config.model,
      timestamp: new Date().toISOString(),
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.client.post<OllamaResponse>('/api/chat', {
          model: this.config.model,
          messages: messages,
          stream: false,
          options: {
            temperature: this.config.temperature,
          },
        });

        if (!response.data?.message?.content) {
          throw new LLMResponseError(
            response.status,
            response.data,
            { ...context, attempt }
          );
        }

        return response.data.message.content;

      } catch (error: any) {
        lastError = error;

        if (error.code === 'ECONNREFUSED') {
          throw new LLMConnectionError(
            this.config.endpoint,
            error,
            { ...context, attempt }
          );
        }

        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          throw new LLMTimeoutError(this.config.timeout, { ...context, attempt });
        }

        if (error.response?.status >= 500 && attempt < this.config.maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }

        throw new LLMResponseError(
          error.response?.status || 0,
          error.response?.data || error.message,
          { ...context, attempt }
        );
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Chat with tool calling support
   * Note: Ollama doesn't natively support function calling like OpenAI,
   * so we'll use prompt engineering to simulate it
   */
  async chatWithTools(
    messages: Message[],
    tools: Tool[]
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    this.validateMessages(messages);
    this.validateTools(tools);

    const toolPrompt = this.buildToolPrompt(tools);
    const enhancedMessages: Message[] = [
      {
        role: 'system',
        content: toolPrompt,
      },
      ...messages,
    ];

    const response = await this.chat(enhancedMessages);
    const toolCalls = this.parseToolCalls(response);

    return {
      content: response,
      toolCalls,
    };
  }

  /**
   * Build a prompt that instructs the LLM how to call tools
   */
  private buildToolPrompt(tools: Tool[]): string {
    const toolDescriptions = tools.map(tool => {
      const params = Object.entries(tool.parameters.properties)
        .map(([name, schema]) => `  - ${name} (${schema.type}): ${schema.description}`)
        .join('\n');

      return `
Tool: ${tool.name}
Description: ${tool.description}
Parameters:
${params}
Required: ${tool.parameters.required?.join(', ') || 'none'}
`;
    }).join('\n---\n');

    return `You are an AI assistant with access to tools. When you need to use a tool, respond with a JSON block in this format:

\`\`\`json
{
  "tool": "toolName",
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  }
}
\`\`\`

Available tools:
${toolDescriptions}

You can use multiple tools by including multiple JSON blocks. Always explain what you're doing before calling a tool.`;
  }

  /**
   * Parse tool calls from LLM response
   */
  private parseToolCalls(response: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
    
    let match: RegExpExecArray | null;
    while ((match = jsonBlockRegex.exec(response)) !== null) {
      try {
        const jsonContent = match[1].trim();
        const parsed = JSON.parse(jsonContent);

        if (!parsed.tool || typeof parsed.tool !== 'string') {
          throw new InvalidToolCallError(
            parsed,
            'Missing or invalid "tool" field'
          );
        }

        if (!parsed.arguments || typeof parsed.arguments !== 'object') {
          throw new InvalidToolCallError(
            parsed,
            'Missing or invalid "arguments" field'
          );
        }

        toolCalls.push({
          name: parsed.tool,
          arguments: parsed.arguments,
        });
      } catch (error) {
        if (error instanceof InvalidToolCallError) {
          throw error;
        }
        console.warn('Failed to parse tool call JSON:', match[1], error);
      }
    }

    return toolCalls;
  }

  /**
   * Validate messages array
   */
  private validateMessages(messages: Message[]): void {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages must be a non-empty array');
    }

    for (const msg of messages) {
      if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
        throw new Error(`Invalid message role: ${msg.role}`);
      }
      if (typeof msg.content !== 'string') {
        throw new Error('Message content must be a string');
      }
    }
  }

  /**
   * Validate tools array
   */
  private validateTools(tools: Tool[]): void {
    if (!Array.isArray(tools)) {
      throw new Error('Tools must be an array');
    }

    for (const tool of tools) {
      if (!tool.name || typeof tool.name !== 'string') {
        throw new Error('Tool must have a valid name');
      }
      if (!tool.description || typeof tool.description !== 'string') {
        throw new Error(`Tool ${tool.name} must have a description`);
      }
      if (!tool.parameters || typeof tool.parameters !== 'object') {
        throw new Error(`Tool ${tool.name} must have parameters schema`);
      }
    }
  }

  /**
   * Sleep helper for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if Ollama is running and model is available
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data?.models || [];
      const modelExists = models.some((m: any) => m.name === this.config.model);

      if (!modelExists) {
        return {
          healthy: false,
          error: `Model ${this.config.model} not found. Available models: ${models.map((m: any) => m.name).join(', ')}`,
        };
      }

      return { healthy: true };
    } catch (error: any) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<OllamaConfig>> {
    return { ...this.config };
  }
}
