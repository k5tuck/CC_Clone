// src/lib/providers/AnthropicProvider.ts
// Note: Install with: npm install @anthropic-ai/sdk
import Anthropic from '@anthropic-ai/sdk';
import {
  Message,
  StreamEvent,
  StreamOptions,
  ModelInfo,
  ProviderConfig,
  AuthenticationError,
  RateLimitError,
  ModelNotFoundError,
} from './types';
import { AbstractBaseProvider } from './BaseProvider'


export class AnthropicProvider extends AbstractBaseProvider {
  readonly name = 'Anthropic';
  readonly models = [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ];
  
  private client: Anthropic;
  
  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new AuthenticationError(
        this.name,
        new Error('API key is required')
      );
    }
    
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
    });
    
    // Initialize the model after abstract properties are available
    this.initializeModel(config.defaultModel);
  }
  
  async *stream(
    messages: Message[],
    options?: StreamOptions
  ): AsyncIterableIterator<StreamEvent> {
    try {
      // Separate system message from conversation
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');
      
      const stream = await this.client.messages.stream({
        model: this.currentModel,
        max_tokens: options?.maxTokens || 8096,
        temperature: options?.temperature,
        top_p: options?.topP,
        stop_sequences: options?.stopSequences,
        system: systemMessage?.content,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });
      
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          yield {
            type: 'token',
            data: '',
            metadata: { contentType: 'text' },
          };
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield {
              type: 'token',
              data: event.delta.text,
            };
          }
        } else if (event.type === 'message_stop') {
          yield { type: 'done' };
        }
      }
    } catch (error: any) {
      // Handle Anthropic-specific errors
      if (error.status === 401) {
        throw new AuthenticationError(this.name, error);
      } else if (error.status === 429) {
        const retryAfter = error.headers?.['retry-after'];
        throw new RateLimitError(
          this.name,
          retryAfter ? parseInt(retryAfter) : undefined,
          error
        );
      } else if (error.status === 404) {
        throw new ModelNotFoundError(this.name, this.currentModel, error);
      }
      
      yield {
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
      
      this.handleError(error, 'stream');
    }
  }
  
  async listModels(): Promise<string[]> {
    // Anthropic doesn't have a models endpoint, return static list
    return this.models;
  }
  
  async getModelInfo(modelId: string): Promise<ModelInfo> {
    if (!this.models.includes(modelId)) {
      throw new ModelNotFoundError(this.name, modelId);
    }
    
    // Static model information
    const modelInfoMap: Record<string, Partial<ModelInfo>> = {
      'claude-sonnet-4-20250514': {
        name: 'Claude Sonnet 4',
        contextWindow: 200000,
        maxTokens: 8096,
        pricing: { input: 3.0, output: 15.0 },
        capabilities: ['vision', 'tools', 'streaming'],
      },
      'claude-opus-4-20250514': {
        name: 'Claude Opus 4',
        contextWindow: 200000,
        maxTokens: 8096,
        pricing: { input: 15.0, output: 75.0 },
        capabilities: ['vision', 'tools', 'streaming', 'advanced-reasoning'],
      },
      'claude-3-5-sonnet-20241022': {
        name: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        maxTokens: 8096,
        pricing: { input: 3.0, output: 15.0 },
        capabilities: ['vision', 'tools', 'streaming'],
      },
      'claude-3-5-haiku-20241022': {
        name: 'Claude 3.5 Haiku',
        contextWindow: 200000,
        maxTokens: 8096,
        pricing: { input: 0.8, output: 4.0 },
        capabilities: ['vision', 'tools', 'streaming', 'fast'],
      },
    };
    
    return {
      id: modelId,
      provider: this.name,
      ...modelInfoMap[modelId],
    } as ModelInfo;
  }
  
  async validateConfig(): Promise<boolean> {
    try {
      // Try to make a minimal request to validate credentials
      const stream = await this.client.messages.stream({
        model: this.currentModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      
      // Consume and discard the stream
      for await (const _ of stream) {
        // Just validate we can connect
        break;
      }
      
      return true;
    } catch (error: any) {
      if (error.status === 401) {
        throw new AuthenticationError(this.name, error);
      }
      return false;
    }
  }
}