// src/lib/skills/SkillManager.ts
import { SkillLoader } from './SkillLoader';
import { SkillMatcher } from './SkillMatcher';
import { Skill, SkillMatch, SkillError } from './types';

export class SkillManager {
  private loader: SkillLoader;
  private matcher: SkillMatcher;
  private skills: Skill[] = [];
  private initialized: boolean = false;

  constructor(skillsDirectory?: string) {
    this.loader = new SkillLoader(skillsDirectory);
    this.matcher = new SkillMatcher();
  }

  /**
   * Initialize the skill system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('SkillManager already initialized');
      return;
    }

    try {
      this.skills = await this.loader.loadAll();
      this.initialized = true;
      console.log(`SkillManager initialized with ${this.skills.length} skills`);
    } catch (error) {
      throw new SkillError(
        'Failed to initialize SkillManager',
        'system',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate a system prompt that includes all skill metadata
   * This is the "first level" of progressive disclosure
   */
  generateSkillsSystemPrompt(): string {
    if (!this.initialized) {
      throw new SkillError('SkillManager not initialized', 'system');
    }

    const skillDescriptions = this.skills.map(skill => {
      return `- **${skill.metadata.name}**: ${skill.metadata.description}`;
    }).join('\n');

        return `
    # Available Skills

    You have access to the following specialized skills. Only invoke a skill when the user's request clearly matches its purpose.

    ${skillDescriptions}

    To use a skill, first determine if one is relevant to the user's request. If so, internally note which skill to use and follow its instructions.
    `.trim();
  }

  /**
   * Find relevant skills for a user message
   */
  async findRelevantSkills(userMessage: string): Promise<SkillMatch[]> {
    if (!this.initialized) {
      throw new SkillError('SkillManager not initialized', 'system');
    }

    return this.matcher.findMatches(userMessage, this.skills);
  }

  /**
   * Get the full skill content (second level of disclosure)
   */
  getSkillContent(skillName: string): string | null {
    const skill = this.skills.find(s => s.metadata.name === skillName);
    return skill ? skill.content : null;
  }

  /**
   * Build context for the LLM including relevant skills
   */
  async buildContextWithSkills(userMessage: string): Promise<{
    systemPrompt: string;
    skillsInvoked: string[];
  }> {
    // Find relevant skills
    const matches = await this.findRelevantSkills(userMessage);
    const topMatches = matches.slice(0, 3); // Limit to top 3 skills

    if (topMatches.length === 0) {
      return {
        systemPrompt: this.generateSkillsSystemPrompt(),
        skillsInvoked: [],
      };
    }

    // Build enhanced system prompt with full skill content
    let enhancedPrompt = this.generateSkillsSystemPrompt();
    enhancedPrompt += '\n\n# Active Skills\n\n';
    enhancedPrompt += 'The following skills have been loaded for this task:\n\n';

    const invokedSkills: string[] = [];

    for (const match of topMatches) {
      enhancedPrompt += `## ${match.skill.metadata.name}\n\n`;
      enhancedPrompt += `${match.skill.content}\n\n`;
      enhancedPrompt += `*Match confidence: ${(match.confidence * 100).toFixed(0)}% - ${match.reason}*\n\n`;
      enhancedPrompt += '---\n\n';
      
      invokedSkills.push(match.skill.metadata.name);
    }

    return {
      systemPrompt: enhancedPrompt,
      skillsInvoked: invokedSkills,
    };
  }

  /**
   * List all available skills
   */
  listSkills(): Array<{ name: string; description: string; version: string }> {
    return this.skills.map(s => ({
      name: s.metadata.name,
      description: s.metadata.description,
      version: s.metadata.version,
    }));
  }

  getSkillCount(): number {
    return this.skills.length;
  }

  /**
   * Get a specific skill
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.find(s => s.metadata.name === name);
  }

  /**
   * Reload all skills
   */
  async reload(): Promise<void> {
    this.skills = await this.loader.loadAll();
    console.log(`Reloaded ${this.skills.length} skills`);
  }
}

// Singleton instance
let skillManagerInstance: SkillManager | null = null;

export function getSkillManager(skillsDirectory?: string): SkillManager {
  if (!skillManagerInstance) {
    skillManagerInstance = new SkillManager(skillsDirectory);
  }
  return skillManagerInstance;
}