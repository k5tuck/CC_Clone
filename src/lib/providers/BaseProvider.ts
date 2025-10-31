import { BaseProvider } from "./provider-base"
import {
  Message,
  StreamEvent,
  StreamOptions,
  ModelInfo,
  ProviderConfig,
  ModelNotFoundError,
  ProviderError,
} from './types';

// src/lib/providers/BaseProvider.ts

export abstract class AbstractBaseProvider implements BaseProvider {
  abstract readonly name: string;
  abstract readonly models: string[];
  
  protected config: ProviderConfig;
  protected currentModel: string;
  
  constructor(config: ProviderConfig) {
    this.config = config;
    // Don't access abstract properties in constructor - initialize in subclass
    this.currentModel = config.defaultModel || '';
  }
  
  // Add protected method for subclasses to initialize currentModel
  protected initializeModel(defaultModel?: string): void {
    if (!defaultModel && (!this.models || this.models.length === 0)) {
      throw new ProviderError(
        'No default model specified and no models available',
        this.name
      );
    }
    this.currentModel = defaultModel || this.models[0];
  }
  
  abstract stream(
    messages: Message[],
    options?: StreamOptions
  ): AsyncIterableIterator<StreamEvent>;
  
  abstract listModels(): Promise<string[]>;
  abstract getModelInfo(modelId: string): Promise<ModelInfo>;
  
  async validateConfig(): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      return health.healthy;
    } catch (error) {
      console.error(`Config validation failed for ${this.name}:`, error);
      return false;
    }
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.listModels();
      return { healthy: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { healthy: false, message };
    }
  }
  
  protected handleError(error: unknown, context: string): never {
    console.error(`${this.name} error in ${context}:`, {
      error,
      timestamp: new Date().toISOString(),
      provider: this.name,
      model: this.currentModel,
    });
    
    if (error instanceof ProviderError) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new ProviderError(
      `${context} failed: ${errorMessage}`,
      this.name,
      error instanceof Error ? error : undefined
    );
  }
  
  setModel(modelId: string): void {
    if (!this.models.includes(modelId)) {
      throw new ModelNotFoundError(this.name, modelId);
    }
    this.currentModel = modelId;
  }
  
  getCurrentModel(): string {
    return this.currentModel;
  }
}

// src/lib/providers/ProviderManager.ts
export class ProviderManager {
  private providers: Map<string, BaseProvider> = new Map();
  private activeProviderId: string | null = null;
  
  /**
   * Register a provider
   * @throws {ProviderError} If provider with same name already exists
   */
  register(provider: BaseProvider): void {
    if (this.providers.has(provider.name)) {
      throw new ProviderError(
        `Provider ${provider.name} is already registered`,
        provider.name
      );
    }
    
    this.providers.set(provider.name, provider);
    
    // Set as active if it's the first provider
    if (!this.activeProviderId) {
      this.activeProviderId = provider.name;
    }
    
    console.log(`Registered provider: ${provider.name}`);
  }
  
  /**
   * Set active provider
   * @throws {ProviderError} If provider not found
   */
  setActive(providerName: string): void {
    if (!this.providers.has(providerName)) {
      throw new ProviderError(
        `Provider ${providerName} not found. Available: ${Array.from(this.providers.keys()).join(', ')}`,
        providerName
      );
    }
    
    this.activeProviderId = providerName;
    console.log(`Switched to provider: ${providerName}`);
  }
  
  /**
   * Get active provider
   * @throws {ProviderError} If no provider is active
   */
  getActive(): BaseProvider {
    if (!this.activeProviderId) {
      throw new ProviderError(
        'No active provider set',
        'unknown'
      );
    }
    
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) {
      throw new ProviderError(
        `Active provider ${this.activeProviderId} not found`,
        this.activeProviderId
      );
    }
    
    return provider;
  }
  
  /**
   * Get provider by name
   */
  get(name: string): BaseProvider | null {
    return this.providers.get(name) || null;
  }
  
  /**
   * List all registered providers
   */
  listProviders(): Array<{ name: string; models: string[] }> {
    return Array.from(this.providers.values()).map(p => ({
      name: p.name,
      models: p.models,
    }));
  }
  
  /**
   * List models for a specific provider or all providers
   */
  async listModels(providerName?: string): Promise<Record<string, string[]>> {
    if (providerName) {
      const provider = this.providers.get(providerName);
      if (!provider) {
        throw new ProviderError(
          `Provider ${providerName} not found`,
          providerName
        );
      }
      const models = await provider.listModels();
      return { [providerName]: models };
    }
    
    const result: Record<string, string[]> = {};
    for (const [name, provider] of this.providers) {
      try {
        result[name] = await provider.listModels();
      } catch (error) {
        console.error(`Failed to list models for ${name}:`, error);
        result[name] = [];
      }
    }
    return result;
  }
  
  /**
   * Get current active provider name
   */
  getActiveProviderName(): string | null {
    return this.activeProviderId;
  }
  
  /**
   * Check if a provider is registered
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }
  
  /**
   * Unregister a provider
   */
  unregister(name: string): boolean {
    const success = this.providers.delete(name);
    
    if (success && this.activeProviderId === name) {
      // Set first available provider as active
      const firstProvider = this.providers.keys().next().value;
      this.activeProviderId = firstProvider || null;
    }
    
    return success;
  }
  
  /**
   * Health check for all providers
   */
  async healthCheckAll(): Promise<Record<string, { healthy: boolean; message?: string }>> {
    const results: Record<string, { healthy: boolean; message?: string }> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        results[name] = await provider.healthCheck();
      } catch (error) {
        results[name] = {
          healthy: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
    
    return results;
  }
}

// Singleton instance
let providerManagerInstance: ProviderManager | null = null;

export function getProviderManager(): ProviderManager {
  if (!providerManagerInstance) {
    providerManagerInstance = new ProviderManager();
  }
  return providerManagerInstance;
}