// src/lib/providers/StreamingClientAdapter.ts
import { BaseProvider } from './provider-base';
import { 
  Message, 
  StreamEvent, 
  StreamOptions, 
  ModelInfo,
  ProviderError 
} from './types';
import { StreamingClient } from '../streaming/StreamingClient';

/**
 * Adapter to make StreamingClient compatible with BaseProvider interface
 * This allows StreamingClient to be used with SkillAwareAgent
 */
export class StreamingClientAdapter implements BaseProvider {
  readonly name = 'Ollama';
  readonly models: string[] = [];
  
  private client: StreamingClient;
  private currentModel: string;

  constructor(client: StreamingClient) {
    this.client = client;
    // Get model from StreamingClient if available
    this.currentModel = (client as any).model || 'llama3.1:latest';
    this.models = [this.currentModel];
  }

  async *stream(
    messages: Message[],
    options?: StreamOptions
  ): AsyncIterableIterator<StreamEvent> {
    try {
      // StreamingClient expects messages in the same format
      for await (const event of this.client.stream(messages, options)) {
        // Filter out StreamingClient-specific event types that aren't in BaseProvider
        if (event.type === 'token' || event.type === 'done' || event.type === 'error') {
          yield event as StreamEvent;
        }
        // Ignore tool_call and other StreamingClient-specific events
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async listModels(): Promise<string[]> {
    // StreamingClient doesn't have a listModels method
    // Return the current model
    return this.models;
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    // Return basic info for Ollama models
    return {
      id: modelId,
      name: modelId,
      contextWindow: 8192, // Default for most Ollama models
      provider: this.name,
      capabilities: ['streaming', 'chat'],
    };
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Try a minimal request to validate
      const testStream = this.client.stream([
        { role: 'user', content: 'test' }
      ]);
      
      for await (const _ of testStream) {
        break; // Just test connection
      }
      
      return true;
    } catch (error) {
      console.error('StreamingClient validation failed:', error);
      return false;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const isValid = await this.validateConfig();
      return isValid 
        ? { healthy: true }
        : { healthy: false, message: 'Connection failed' };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the underlying StreamingClient
   */
  getClient(): StreamingClient {
    return this.client;
  }
}

/**
 * Factory function to create adapter
 */
export function createStreamingProviderAdapter(
  client: StreamingClient
): BaseProvider {
  return new StreamingClientAdapter(client);
}

/**
 * Helper to create both client and adapter
 */
export function createStreamingProvider(
  endpoint: string,
  model: string
): { client: StreamingClient; provider: BaseProvider } {
  const client = new StreamingClient(endpoint, model);
  const provider = new StreamingClientAdapter(client);
  
  return { client, provider };
}