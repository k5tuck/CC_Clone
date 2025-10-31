// src/lib/providers/OpenAIProvider.ts
// Note: Install with: npm install openai
import OpenAI from 'openai';
import { AbstractBaseProvider } from './BaseProvider'; 
import { Message,
  StreamEvent,
  StreamOptions,
  ModelInfo,
  ProviderConfig,
  AuthenticationError,
  RateLimitError,
  ModelNotFoundError,
} from './types';

export class OpenAIProvider extends AbstractBaseProvider {
  readonly name = 'OpenAI';
  readonly models = [
    'gpt-4-turbo',
    'gpt-4',
    'gpt-4-32k',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
  ];
  
  private client: OpenAI;
  
  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new AuthenticationError(
        this.name,
        new Error('API key is required')
      );
    }
    
    this.client = new OpenAI({
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
      const stream = await this.client.chat.completions.create({
        model: this.currentModel,
        messages: messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        stream: true,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        top_p: options?.topP,
        stop: options?.stopSequences,
        presence_penalty: options?.presencePenalty,
        frequency_penalty: options?.frequencyPenalty,
      });
      
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          yield {
            type: 'token',
            data: delta.content,
          };
        }
        
        if (chunk.choices[0]?.finish_reason) {
          yield {
            type: 'done',
            metadata: {
              finishReason: chunk.choices[0].finish_reason,
            },
          };
        }
      }
    } catch (error: any) {
      // Handle OpenAI-specific errors
      if (error.status === 401) {
        throw new AuthenticationError(this.name, error);
      } else if (error.status === 429) {
        throw new RateLimitError(this.name, undefined, error);
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
    try {
      const response = await this.client.models.list();
      return response.data
        .filter((model: any) => model.id.startsWith('gpt-'))
        .map((model: any) => model.id);
    } catch (error) {
      this.handleError(error, 'listModels');
    }
  }
  
  async getModelInfo(modelId: string): Promise<ModelInfo> {
    try {
      const model = await this.client.models.retrieve(modelId);
      
      // Static pricing info (as of latest knowledge)
      const pricingMap: Record<string, { input: number; output: number }> = {
        'gpt-4-turbo': { input: 10.0, output: 30.0 },
        'gpt-4': { input: 30.0, output: 60.0 },
        'gpt-4-32k': { input: 60.0, output: 120.0 },
        'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
        'gpt-3.5-turbo-16k': { input: 3.0, output: 4.0 },
      };
      
      const contextWindowMap: Record<string, number> = {
        'gpt-4-turbo': 128000,
        'gpt-4': 8192,
        'gpt-4-32k': 32768,
        'gpt-3.5-turbo': 16384,
        'gpt-3.5-turbo-16k': 16384,
      };
      
      return {
        id: model.id,
        name: model.id,
        contextWindow: contextWindowMap[modelId] || 8192,
        pricing: pricingMap[modelId],
        provider: this.name,
        capabilities: ['streaming', 'functions'],
      };
    } catch (error) {
      if (error instanceof OpenAI.NotFoundError) {
        throw new ModelNotFoundError(this.name, modelId, new Error());
      }
      this.handleError(error, 'getModelInfo');
    }
  }
  
  async validateConfig(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error: any) {
      if (error.status === 401) {
        throw new AuthenticationError(this.name, error);
      }
      return false;
    }
  }
}