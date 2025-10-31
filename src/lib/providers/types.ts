// src/lib/providers/types.ts
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamEvent {
  type: 'token' | 'done' | 'error';
  data?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface StreamOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens?: number;
  pricing?: {
    input: number;  // per 1M tokens
    output: number; // per 1M tokens
  };
  capabilities?: string[];
  provider: string;
}

export interface ProviderConfig {
  apiKey?: string;
  endpoint?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  [key: string]: any;
}

// Custom Exceptions
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class AuthenticationError extends ProviderError {
  constructor(provider: string, cause?: Error) {
    super(`Authentication failed for provider: ${provider}`, provider, cause);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(
    provider: string,
    public readonly retryAfter?: number,
    cause?: Error
  ) {
    super(
      `Rate limit exceeded for provider: ${provider}${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
      provider,
      cause
    );
    this.name = 'RateLimitError';
  }
}

export class ModelNotFoundError extends ProviderError {
  constructor(provider: string, modelId: string, cause?: Error) {
    super(`Model not found: ${modelId} in provider: ${provider}`, provider, cause);
    this.name = 'ModelNotFoundError';
  }
}