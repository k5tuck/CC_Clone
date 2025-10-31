import { Message, StreamEvent, StreamOptions, ModelInfo } from "./types";

// Base Provider Interface
export interface BaseProvider {
  readonly name: string;
  readonly models: string[];
  
  /**
   * Stream chat completions
   * @throws {AuthenticationError} If API credentials are invalid
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {ModelNotFoundError} If model is not found
   * @throws {ProviderError} For other provider-specific errors
   */
  stream(
    messages: Message[],
    options?: StreamOptions
  ): AsyncIterableIterator<StreamEvent>;
  
  /**
   * List available models
   * @throws {ProviderError} If unable to fetch models
   */
  listModels(): Promise<string[]>;
  
  /**
   * Get model information
   * @throws {ModelNotFoundError} If model doesn't exist
   */
  getModelInfo(modelId: string): Promise<ModelInfo>;
  
  /**
   * Validate provider configuration
   * @returns true if valid, false otherwise
   */
  validateConfig(): Promise<boolean>;
  
  /**
   * Get provider health status
   */
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
