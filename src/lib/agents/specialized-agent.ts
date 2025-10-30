import { Agent, AgentMeta } from '../agent';
import { OllamaClient } from '../llm/ollama-client';
import path from 'path';
import fs from 'fs/promises';

/**
 * Custom exceptions for specialized agents
 */
export class PlanGenerationError extends Error {
  constructor(
    public readonly agentType: string,
    public readonly task: string,
    public readonly reason: string
  ) {
    super(`${agentType} agent failed to generate plan for task "${task}": ${reason}`);
    this.name = 'PlanGenerationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class PlanValidationError extends Error {
  constructor(
    public readonly planFile: string,
    public readonly missingSection: string[]
  ) {
    super(`Plan validation failed for ${planFile}. Missing sections: ${missingSection.join(', ')}`);
    this.name = 'PlanValidationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class PlanStorageError extends Error {
  constructor(
    public readonly planFile: string,
    public readonly originalError: Error
  ) {
    super(`Failed to save plan to ${planFile}: ${originalError.message}`);
    this.name = 'PlanStorageError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Plan metadata extracted from generated plans
 */
export interface PlanMetadata {
  planId: string;
  domain: string;
  complexity: 'Simple' | 'Standard' | 'Complex';
  estimatedEffort: string;
  planVersion: string;
  dependencies: string[];
  created: string;
}

/**
 * Agent output structure
 */
export interface AgentOutput {
  agentId: string;
  agentType: string;
  domain: string;
  planFile: string;
  planContent: string;
  metadata: PlanMetadata;
  executionTime: number;
  timestamp: Date;
}

/**
 * Configuration for specialized agents
 */
export interface SpecializedAgentConfig {
  agentId: string;
  domain: string;
  promptTemplatePath: string;
  outputDir: string;
  llm: OllamaClient;
}

/**
 * Base class for all specialized agents (Implementation, Security, Performance, etc.)
 */
export abstract class SpecializedAgent extends Agent {
  protected config: SpecializedAgentConfig;
  protected promptTemplate: string;

  constructor(config: SpecializedAgentConfig) {
    const meta: AgentMeta = {
      name: config.agentId,
      role: 'sub-agent',
      systemPrompt: '', // Will be loaded from template
    };

    super(meta, config.llm);
    this.config = config;
    this.promptTemplate = '';
  }

  /**
   * Load prompt template from file
   */
  async loadPromptTemplate(): Promise<void> {
    try {
      const templatePath = path.resolve(this.config.promptTemplatePath);
      await fs.access(templatePath);
      this.promptTemplate = await fs.readFile(templatePath, 'utf-8');
      
      // Inject domain into template
      this.promptTemplate = this.promptTemplate.replace(/{DOMAIN}/g, this.config.domain);
      
      // Set as system prompt
      this.meta.systemPrompt = this.promptTemplate;
    } catch (error: any) {
      throw new Error(
        `Failed to load prompt template from ${this.config.promptTemplatePath}: ${error.message}`
      );
    }
  }

  /**
   * Execute the specialized agent to generate a plan
   */
  async execute(
    task: string,
    dependencies: string[] = []
  ): Promise<AgentOutput> {
    const startTime = Date.now();

    try {
      // Load template if not already loaded
      if (!this.promptTemplate) {
        await this.loadPromptTemplate();
      }

      // Load context from claude.md if it exists
      const contextFiles: string[] = [];
      const claudeMdPath = path.resolve('claude.md');
      
      try {
        await fs.access(claudeMdPath);
        contextFiles.push(claudeMdPath);
      } catch {
        // claude.md doesn't exist, continue without it
      }

      // Add dependency files as context
      for (const depPath of dependencies) {
        try {
          await fs.access(depPath);
          contextFiles.push(depPath);
        } catch {
          console.warn(`Dependency file not found: ${depPath}`);
        }
      }

      // Build the task prompt
      const taskPrompt = this.buildTaskPrompt(task, dependencies);

      // Run the agent
      const planContent = await this.run(taskPrompt, contextFiles);

      // Validate the plan
      const validationErrors = this.validatePlan(planContent);
      if (validationErrors.length > 0) {
        throw new PlanValidationError('<generated>', validationErrors);
      }

      // Extract metadata from plan
      const metadata = this.extractMetadata(planContent);

      // Save the plan
      const planFile = await this.savePlan(planContent, task);

      const executionTime = (Date.now() - startTime) / 1000;

      return {
        agentId: this.config.agentId,
        agentType: this.getAgentType(),
        domain: this.config.domain,
        planFile,
        planContent,
        metadata,
        executionTime,
        timestamp: new Date(),
      };
    } catch (error: any) {
      throw new PlanGenerationError(
        this.getAgentType(),
        task,
        error.message
      );
    }
  }

  /**
   * Build the task prompt with context about dependencies
   */
  protected buildTaskPrompt(task: string, dependencies: string[]): string {
    let prompt = `TASK: ${task}\n\n`;

    if (dependencies.length > 0) {
      prompt += `## Dependencies from Other Agents\n\n`;
      prompt += `The following files contain outputs from other agents that you should consider:\n`;
      dependencies.forEach(dep => {
        prompt += `- ${path.basename(dep)}\n`;
      });
      prompt += '\n';
    }

    prompt += `Please create a comprehensive implementation plan following the template structure.\n`;
    prompt += `Remember to:\n`;
    prompt += `1. Read and reference claude.md context (if available)\n`;
    prompt += `2. Choose appropriate plan complexity (Minimal vs Standard)\n`;
    prompt += `3. Include all required sections\n`;
    prompt += `4. Define custom exception classes\n`;
    prompt += `5. Specify SOLID principles justification\n`;
    prompt += `6. Create incremental checkpoints\n`;
    prompt += `7. Define rollback strategy\n`;

    return prompt;
  }

  /**
   * Validate that the generated plan has required sections
   */
  protected validatePlan(planContent: string): string[] {
    const requiredSections = this.getRequiredSections();
    const missingSection: string[] = [];

    for (const section of requiredSections) {
      if (!planContent.includes(section)) {
        missingSection.push(section);
      }
    }

    return missingSection;
  }

  /**
   * Extract metadata from plan content
   */
  protected extractMetadata(planContent: string): PlanMetadata {
    const lines = planContent.split('\n');
    const metadata: Partial<PlanMetadata> = {
      planVersion: '1.0',
      complexity: 'Standard',
      estimatedEffort: 'Unknown',
      dependencies: [],
      created: new Date().toISOString(),
    };

    // Simple regex parsing for metadata
    for (const line of lines) {
      if (line.includes('**Plan ID:**')) {
        metadata.planId = line.split('**Plan ID:**')[1]?.trim() || `${this.config.agentId}-${Date.now()}`;
      }
      if (line.includes('**Domain:**')) {
        metadata.domain = line.split('**Domain:**')[1]?.trim() || this.config.domain;
      }
      if (line.includes('**Complexity:**')) {
        const comp = line.split('**Complexity:**')[1]?.trim();
        if (comp === 'Simple' || comp === 'Standard' || comp === 'Complex') {
          metadata.complexity = comp;
        }
      }
      if (line.includes('**Estimated Effort:**')) {
        metadata.estimatedEffort = line.split('**Estimated Effort:**')[1]?.trim() || 'Unknown';
      }
      if (line.includes('**Dependencies:**')) {
        const deps = line.split('**Dependencies:**')[1]?.trim();
        if (deps && deps !== 'None') {
          metadata.dependencies = deps.split(',').map(d => d.trim());
        }
      }
    }

    // Generate plan ID if not found
    if (!metadata.planId) {
      metadata.planId = `${this.config.agentId}-${Date.now()}`;
    }

    return metadata as PlanMetadata;
  }

  /**
   * Save the plan to a file
   */
  protected async savePlan(planContent: string, task: string): Promise<string> {
    try {
      const outputDir = path.resolve(this.config.outputDir);
      await fs.mkdir(outputDir, { recursive: true });

      const timestamp = new Date().toISOString().split('T')[0];
      const taskSlug = task
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 30);

      const filename = `${this.getAgentType()}-plan-${timestamp}-${taskSlug}.md`;
      const planPath = path.join(outputDir, filename);

      await fs.writeFile(planPath, planContent, 'utf-8');

      return planPath;
    } catch (error: any) {
      throw new PlanStorageError(
        this.config.outputDir,
        error
      );
    }
  }

  /**
   * Get required sections for this agent type (override in subclasses)
   */
  protected abstract getRequiredSections(): string[];

  /**
   * Get the agent type name (override in subclasses)
   */
  protected abstract getAgentType(): string;
}
