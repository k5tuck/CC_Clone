// src/lib/agents/SkillAwareAgent.ts
import { getSkillManager } from '../skills/SkillManager';
import { BaseProvider } from '../providers/provider-base';
import { Message, StreamEvent } from '../providers/types';

/**
 * SkillAwareAgent - Integrates skill management with LLM providers
 * Automatically detects and injects relevant skills into the conversation context
 */
export class SkillAwareAgent {
  private provider: BaseProvider;
  private skillManager: ReturnType<typeof getSkillManager>;
  private initialized: boolean = false;

  constructor(provider: BaseProvider, skillsDirectory?: string) {
    this.provider = provider;
    this.skillManager = getSkillManager(skillsDirectory);
  }

  /**
   * Initialize the skill manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('SkillAwareAgent already initialized');
      return;
    }

    await this.skillManager.initialize();
    const skills = this.skillManager.listSkills();
    console.log(`SkillAwareAgent initialized with ${skills.length} skills`);
    this.initialized = true;
  }

  /**
   * Ensure initialization before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Process a message with skill awareness
   * Automatically detects relevant skills and includes them in context
   */
  async *processWithSkills(
    conversationHistory: Message[],
    userMessage: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      includeAllSkills?: boolean;
    }
  ): AsyncIterableIterator<StreamEvent & { metadata?: any }> {
    await this.ensureInitialized();

    try {
      // Find relevant skills based on user message
      const { systemPrompt, skillsInvoked } = 
        await this.skillManager.buildContextWithSkills(userMessage);

      // Build messages with skill-aware system prompt
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      // Yield metadata about invoked skills
      if (skillsInvoked.length > 0) {
        yield {
          type: 'token' as const,
          data: '',
          metadata: { 
            type: 'skills_invoked',
            skills: skillsInvoked,
            skillDetails: skillsInvoked.map(name => 
              this.skillManager.getSkill(name)
            ).filter(Boolean)
          },
        };
      }

      // Stream response from provider
      for await (const event of this.provider.stream(messages, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      })) {
        yield event;
      }
    } catch (error) {
      console.error('SkillAwareAgent error:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Process a message and return complete response
   * Non-streaming version for simpler use cases
   */
  async processMessage(
    conversationHistory: Message[],
    userMessage: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<{
    response: string;
    skillsUsed: string[];
    metadata?: any;
  }> {
    await this.ensureInitialized();

    let response = '';
    const skillsUsed: string[] = [];

    for await (const event of this.processWithSkills(
      conversationHistory,
      userMessage,
      options
    )) {
      if (event.type === 'token') {
        if (event.metadata?.type === 'skills_invoked') {
          skillsUsed.push(...(event.metadata.skills || []));
        } else if (event.data) {
          response += event.data;
        }
      } else if (event.type === 'error') {
        throw event.error || new Error('Unknown error occurred');
      }
    }

    return { response, skillsUsed };
  }

  /**
   * List all available skills
   */
  listAvailableSkills() {
    return this.skillManager.listSkills();
  }

  /**
   * Get skill count
   */
  getSkillCount(): number {
    return this.skillManager.getSkillCount();
  }

  /**
   * Get a specific skill by name
   */
  getSkill(name: string) {
    return this.skillManager.getSkill(name);
  }

  /**
   * Reload skills from disk
   */
  async reloadSkills(): Promise<void> {
    await this.skillManager.reload();
    console.log('Skills reloaded');
  }

  /**
   * Search for skills matching a query
   */
  searchSkills(query: string) {
    const allSkills = this.skillManager.listSkills();
    const queryLower = query.toLowerCase();
    
    return allSkills.filter(skill => 
      skill.name.toLowerCase().includes(queryLower) ||
      skill.description.toLowerCase().includes(queryLower)
    );
  }

  /**
   * Get the current provider
   */
  getProvider(): BaseProvider {
    return this.provider;
  }

  /**
   * Switch to a different provider
   */
  setProvider(provider: BaseProvider): void {
    this.provider = provider;
    console.log(`Switched to provider: ${provider.name}`);
  }
}

/**
 * Factory function to create a SkillAwareAgent
 */
export function createSkillAwareAgent(
  provider: BaseProvider,
  skillsDirectory?: string
): SkillAwareAgent {
  return new SkillAwareAgent(provider, skillsDirectory);
}

/**
 * Singleton instance for global access
 */
let globalSkillAwareAgent: SkillAwareAgent | null = null;

/**
 * Get or create the global SkillAwareAgent instance
 */
export function getSkillAwareAgent(
  provider?: BaseProvider,
  skillsDirectory?: string
): SkillAwareAgent {
  if (!globalSkillAwareAgent) {
    if (!provider) {
      throw new Error('Provider required for first initialization of SkillAwareAgent');
    }
    globalSkillAwareAgent = new SkillAwareAgent(provider, skillsDirectory);
  } else if (provider) {
    // Update provider if provided
    globalSkillAwareAgent.setProvider(provider);
  }
  
  return globalSkillAwareAgent;
}

/**
 * Reset the global SkillAwareAgent instance
 */
export function resetSkillAwareAgent(): void {
  globalSkillAwareAgent = null;
}