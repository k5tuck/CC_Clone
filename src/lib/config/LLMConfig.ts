/**
 * LLM Configuration Management
 *
 * Manages API keys, provider settings, and model configurations
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  endpoint?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  models?: string[];
}

export interface LLMConfiguration {
  version: string;
  defaultProvider: string;
  providers: {
    anthropic?: ProviderConfig;
    openai?: ProviderConfig;
    ollama?: ProviderConfig;
  };
  preferences: {
    temperature?: number;
    maxTokens?: number;
    streamingEnabled?: boolean;
  };
}

// ============================================================================
// Configuration Manager
// ============================================================================

export class LLMConfigManager {
  private configPath: string;
  private config: LLMConfiguration | null = null;
  private encryptionKey: string;

  constructor(configDir?: string) {
    const baseDir =
      configDir ||
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.local-agent');
    this.configPath = path.join(baseDir, 'llm-config.json');

    // Simple encryption key (in production, use a more secure method)
    this.encryptionKey = process.env.LLM_CONFIG_KEY || 'selek-llm-config-key';
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<LLMConfiguration> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const decrypted = this.decrypt(data);
      this.config = JSON.parse(decrypted);
      return this.config!;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create default config
        this.config = this.getDefaultConfig();
        await this.save();
        return this.config;
      }
      throw error;
    }
  }

  /**
   * Save configuration to disk
   */
  async save(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration to save');
    }

    const json = JSON.stringify(this.config, null, 2);
    const encrypted = this.encrypt(json);

    // Ensure directory exists
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });

    // Write to temp file first
    const tempPath = `${this.configPath}.tmp`;
    await fs.writeFile(tempPath, encrypted, 'utf-8');

    // Atomic rename
    await fs.rename(tempPath, this.configPath);
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMConfiguration {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): LLMConfiguration {
    return {
      version: '1.0',
      defaultProvider: 'ollama',
      providers: {
        anthropic: {
          name: 'Anthropic',
          enabled: false,
          apiKey: process.env.ANTHROPIC_API_KEY,
          defaultModel: 'claude-sonnet-4-20250514',
          timeout: 60000,
          models: [
            'claude-sonnet-4-20250514',
            'claude-opus-4-20250514',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
          ],
        },
        openai: {
          name: 'OpenAI',
          enabled: false,
          apiKey: process.env.OPENAI_API_KEY,
          defaultModel: 'gpt-4-turbo',
          timeout: 60000,
          models: [
            'gpt-4-turbo',
            'gpt-4',
            'gpt-4-32k',
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k',
          ],
        },
        ollama: {
          name: 'Ollama (Local)',
          enabled: true,
          endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
          defaultModel: process.env.OLLAMA_MODEL || 'llama3.1:latest',
          timeout: 120000,
          models: [], // Will be fetched from Ollama
        },
      },
      preferences: {
        temperature: 0.7,
        maxTokens: 2000,
        streamingEnabled: true,
      },
    };
  }

  // ==========================================================================
  // Provider Management
  // ==========================================================================

  /**
   * Set API key for a provider
   */
  async setApiKey(provider: 'anthropic' | 'openai', apiKey: string): Promise<void> {
    const config = this.getConfig();

    if (!config.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    config.providers[provider]!.apiKey = apiKey;
    await this.save();
  }

  /**
   * Enable a provider
   */
  async enableProvider(provider: 'anthropic' | 'openai' | 'ollama'): Promise<void> {
    const config = this.getConfig();

    if (!config.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    config.providers[provider]!.enabled = true;
    await this.save();
  }

  /**
   * Disable a provider
   */
  async disableProvider(provider: 'anthropic' | 'openai' | 'ollama'): Promise<void> {
    const config = this.getConfig();

    if (!config.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    config.providers[provider]!.enabled = false;
    await this.save();
  }

  /**
   * Set default provider
   */
  async setDefaultProvider(provider: 'anthropic' | 'openai' | 'ollama'): Promise<void> {
    const config = this.getConfig();

    if (!config.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    if (!config.providers[provider]!.enabled) {
      throw new Error(`Provider ${provider} is not enabled`);
    }

    config.defaultProvider = provider;
    await this.save();
  }

  /**
   * Set default model for a provider
   */
  async setDefaultModel(
    provider: 'anthropic' | 'openai' | 'ollama',
    model: string
  ): Promise<void> {
    const config = this.getConfig();

    if (!config.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    config.providers[provider]!.defaultModel = model;
    await this.save();
  }

  /**
   * Update provider endpoint (for Ollama)
   */
  async setProviderEndpoint(provider: string, endpoint: string): Promise<void> {
    const config = this.getConfig();

    if (!config.providers[provider as keyof typeof config.providers]) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    (config.providers as any)[provider].endpoint = endpoint;
    await this.save();
  }

  /**
   * Get available providers
   */
  getProviders(): Array<{ name: string; enabled: boolean; hasApiKey: boolean }> {
    const config = this.getConfig();

    return Object.entries(config.providers).map(([key, provider]) => ({
      name: key,
      enabled: provider?.enabled || false,
      hasApiKey: !!provider?.apiKey,
    }));
  }

  /**
   * Validate provider configuration
   */
  async validateProvider(provider: 'anthropic' | 'openai' | 'ollama'): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const config = this.getConfig();
    const providerConfig = config.providers[provider];

    if (!providerConfig) {
      return { valid: false, errors: [`Provider ${provider} not found`] };
    }

    const errors: string[] = [];

    // Check API key for cloud providers
    if (provider !== 'ollama' && !providerConfig.apiKey) {
      errors.push(`API key not set for ${provider}`);
    }

    // Check endpoint for Ollama
    if (provider === 'ollama' && !providerConfig.endpoint) {
      errors.push('Ollama endpoint not set');
    }

    // Check default model
    if (!providerConfig.defaultModel) {
      errors.push(`Default model not set for ${provider}`);
    }

    return { valid: errors.length === 0, errors };
  }

  // ==========================================================================
  // Preferences
  // ==========================================================================

  /**
   * Update preferences
   */
  async updatePreferences(preferences: Partial<LLMConfiguration['preferences']>): Promise<void> {
    const config = this.getConfig();
    config.preferences = { ...config.preferences, ...preferences };
    await this.save();
  }

  // ==========================================================================
  // Export/Import
  // ==========================================================================

  /**
   * Export configuration (without sensitive data)
   */
  exportConfig(): Partial<LLMConfiguration> {
    const config = this.getConfig();

    return {
      version: config.version,
      defaultProvider: config.defaultProvider,
      providers: {
        anthropic: {
          ...config.providers.anthropic,
          apiKey: config.providers.anthropic?.apiKey ? '***REDACTED***' : undefined,
        } as ProviderConfig,
        openai: {
          ...config.providers.openai,
          apiKey: config.providers.openai?.apiKey ? '***REDACTED***' : undefined,
        } as ProviderConfig,
        ollama: config.providers.ollama,
      },
      preferences: config.preferences,
    };
  }

  /**
   * Import configuration
   */
  async importConfig(config: Partial<LLMConfiguration>): Promise<void> {
    const currentConfig = this.getConfig();

    this.config = {
      ...currentConfig,
      ...config,
      providers: {
        ...currentConfig.providers,
        ...config.providers,
      },
      preferences: {
        ...currentConfig.preferences,
        ...config.preferences,
      },
    } as LLMConfiguration;

    await this.save();
  }

  // ==========================================================================
  // Encryption (Simple - use better encryption in production)
  // ==========================================================================

  private encrypt(text: string): string {
    try {
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(this.encryptionKey.padEnd(32, '0').substring(0, 32)),
        Buffer.alloc(16, 0)
      );
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      // If encryption fails, return plain text (for compatibility)
      return text;
    }
  }

  private decrypt(encrypted: string): string {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(this.encryptionKey.padEnd(32, '0').substring(0, 32)),
        Buffer.alloc(16, 0)
      );
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      // If decryption fails, assume it's plain text
      return encrypted;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let configManager: LLMConfigManager | null = null;

export function getLLMConfigManager(configDir?: string): LLMConfigManager {
  if (!configManager) {
    configManager = new LLMConfigManager(configDir);
  }
  return configManager;
}
