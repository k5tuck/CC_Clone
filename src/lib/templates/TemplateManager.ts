/**
 * Template Manager
 * Manages conversation templates and workflows
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Template category
 */
export enum TemplateCategory {
  CODE_REVIEW = 'code_review',
  DEBUGGING = 'debugging',
  IMPLEMENTATION = 'implementation',
  REFACTORING = 'refactoring',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  OPTIMIZATION = 'optimization',
  SECURITY = 'security',
  CUSTOM = 'custom',
}

/**
 * Conversation template
 */
export interface ConversationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  author?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  favorite: boolean;

  // Template content
  prompt: string;
  context?: string;
  agentPreferences?: {
    preferredAgents?: string[];
    maxAgents?: number;
    collaboration?: boolean;
  };

  // Variables that can be filled in
  variables?: TemplateVariable[];
}

/**
 * Template variable
 */
export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'directory';
  required: boolean;
  defaultValue?: any;
  placeholder?: string;
}

/**
 * Template search filters
 */
export interface TemplateFilters {
  category?: TemplateCategory;
  tags?: string[];
  searchQuery?: string;
  favoritesOnly?: boolean;
}

/**
 * Template Manager
 */
export class TemplateManager extends EventEmitter {
  private templates: Map<string, ConversationTemplate> = new Map();
  private templatesDir: string;
  private loaded: boolean = false;

  constructor(customDir?: string) {
    super();
    this.templatesDir = customDir || path.join(os.homedir(), '.selek', 'templates');
  }

  /**
   * Initialize the template manager
   */
  async initialize(): Promise<void> {
    if (this.loaded) return;

    // Ensure templates directory exists
    await fs.mkdir(this.templatesDir, { recursive: true });

    // Load templates from disk
    await this.loadTemplates();

    // Create default templates if none exist
    if (this.templates.size === 0) {
      await this.createDefaultTemplates();
    }

    this.loaded = true;
    this.emit('initialized');
  }

  /**
   * Load templates from disk
   */
  private async loadTemplates(): Promise<void> {
    try {
      const files = await fs.readdir(this.templatesDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.templatesDir, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const template = JSON.parse(content) as ConversationTemplate;

            // Convert date strings back to Date objects
            template.createdAt = new Date(template.createdAt);
            template.updatedAt = new Date(template.updatedAt);

            this.templates.set(template.id, template);
          } catch (error) {
            console.error(`Error loading template ${file}:`, error);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist yet - will be created
    }
  }

  /**
   * Create default templates
   */
  private async createDefaultTemplates(): Promise<void> {
    const defaults: Omit<ConversationTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'favorite'>[] = [
      {
        name: 'Code Review',
        description: 'Perform a comprehensive code review',
        category: TemplateCategory.CODE_REVIEW,
        author: 'Selek',
        tags: ['review', 'quality', 'best-practices'],
        prompt: 'Please review the code in {{file_path}} and provide feedback on:\n- Code quality and readability\n- Potential bugs or issues\n- Performance considerations\n- Best practices\n- Security concerns',
        variables: [
          {
            name: 'file_path',
            description: 'Path to the file to review',
            type: 'file',
            required: true,
            placeholder: 'src/example.ts',
          },
        ],
      },
      {
        name: 'Debug Issue',
        description: 'Debug and fix a specific issue',
        category: TemplateCategory.DEBUGGING,
        author: 'Selek',
        tags: ['debug', 'fix', 'troubleshoot'],
        prompt: 'I\'m experiencing the following issue:\n{{issue_description}}\n\nPlease help me:\n1. Identify the root cause\n2. Suggest fixes\n3. Implement the solution\n4. Test the fix',
        variables: [
          {
            name: 'issue_description',
            description: 'Description of the issue',
            type: 'string',
            required: true,
            placeholder: 'Error message or behavior description',
          },
        ],
      },
      {
        name: 'Implement Feature',
        description: 'Implement a new feature with best practices',
        category: TemplateCategory.IMPLEMENTATION,
        author: 'Selek',
        tags: ['feature', 'implement', 'build'],
        prompt: 'Please implement the following feature:\n{{feature_description}}\n\nRequirements:\n- Follow existing code patterns\n- Include error handling\n- Add tests\n- Update documentation',
        agentPreferences: {
          preferredAgents: ['implementation-agent', 'testing-agent'],
          collaboration: true,
        },
        variables: [
          {
            name: 'feature_description',
            description: 'Description of the feature to implement',
            type: 'string',
            required: true,
            placeholder: 'Feature requirements and specifications',
          },
        ],
      },
      {
        name: 'Refactor Code',
        description: 'Refactor code for better maintainability',
        category: TemplateCategory.REFACTORING,
        author: 'Selek',
        tags: ['refactor', 'cleanup', 'improve'],
        prompt: 'Please refactor {{file_or_directory}} to improve:\n- Code organization\n- Readability\n- Maintainability\n- Performance\n\nEnsure all existing functionality is preserved and add tests.',
        variables: [
          {
            name: 'file_or_directory',
            description: 'Path to refactor',
            type: 'string',
            required: true,
            placeholder: 'src/components',
          },
        ],
      },
      {
        name: 'Generate Documentation',
        description: 'Generate comprehensive documentation',
        category: TemplateCategory.DOCUMENTATION,
        author: 'Selek',
        tags: ['docs', 'documentation', 'readme'],
        prompt: 'Please generate documentation for {{target}}:\n- API documentation\n- Usage examples\n- Architecture overview\n- Setup instructions\n\nUse clear language and provide code examples.',
        variables: [
          {
            name: 'target',
            description: 'What to document',
            type: 'string',
            required: true,
            placeholder: 'component, API, or entire project',
          },
        ],
      },
      {
        name: 'Write Tests',
        description: 'Write comprehensive test coverage',
        category: TemplateCategory.TESTING,
        author: 'Selek',
        tags: ['test', 'coverage', 'quality'],
        prompt: 'Please write comprehensive tests for {{file_path}}:\n- Unit tests\n- Integration tests\n- Edge cases\n- Error scenarios\n\nAim for {{coverage}}% coverage.',
        agentPreferences: {
          preferredAgents: ['testing-agent'],
        },
        variables: [
          {
            name: 'file_path',
            description: 'Path to the code to test',
            type: 'file',
            required: true,
            placeholder: 'src/utils/helper.ts',
          },
          {
            name: 'coverage',
            description: 'Target coverage percentage',
            type: 'number',
            required: false,
            defaultValue: 80,
            placeholder: '80',
          },
        ],
      },
      {
        name: 'Performance Optimization',
        description: 'Optimize code for better performance',
        category: TemplateCategory.OPTIMIZATION,
        author: 'Selek',
        tags: ['performance', 'optimize', 'speed'],
        prompt: 'Please analyze and optimize {{target}} for performance:\n- Identify bottlenecks\n- Suggest optimizations\n- Implement improvements\n- Measure impact\n\nFocus on: {{focus_areas}}',
        agentPreferences: {
          preferredAgents: ['performance-agent'],
        },
        variables: [
          {
            name: 'target',
            description: 'What to optimize',
            type: 'string',
            required: true,
            placeholder: 'function, component, or module',
          },
          {
            name: 'focus_areas',
            description: 'Areas to focus on',
            type: 'string',
            required: false,
            defaultValue: 'execution time, memory usage',
            placeholder: 'execution time, memory usage, bundle size',
          },
        ],
      },
      {
        name: 'Security Audit',
        description: 'Perform a security audit and fix vulnerabilities',
        category: TemplateCategory.SECURITY,
        author: 'Selek',
        tags: ['security', 'audit', 'vulnerabilities'],
        prompt: 'Please perform a security audit of {{target}}:\n- Identify vulnerabilities\n- Check for common security issues (OWASP Top 10)\n- Review authentication/authorization\n- Suggest fixes\n- Implement security improvements',
        agentPreferences: {
          preferredAgents: ['security-agent'],
        },
        variables: [
          {
            name: 'target',
            description: 'What to audit',
            type: 'string',
            required: true,
            placeholder: 'file, directory, or entire project',
          },
        ],
      },
    ];

    for (const templateData of defaults) {
      await this.createTemplate(templateData);
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(
    data: Omit<ConversationTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'favorite'>
  ): Promise<ConversationTemplate> {
    const id = `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const template: ConversationTemplate = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      favorite: false,
    };

    this.templates.set(id, template);
    await this.saveTemplate(template);

    this.emit('template:created', template);
    return template;
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, updates: Partial<ConversationTemplate>): Promise<ConversationTemplate | null> {
    const template = this.templates.get(id);
    if (!template) return null;

    const updated = {
      ...template,
      ...updates,
      id: template.id, // Prevent ID change
      updatedAt: new Date(),
    };

    this.templates.set(id, updated);
    await this.saveTemplate(updated);

    this.emit('template:updated', updated);
    return updated;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const template = this.templates.get(id);
    if (!template) return false;

    this.templates.delete(id);

    // Delete from disk
    const filePath = path.join(this.templatesDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist
    }

    this.emit('template:deleted', template);
    return true;
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): ConversationTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): ConversationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Search templates
   */
  searchTemplates(filters: TemplateFilters): ConversationTemplate[] {
    let results = this.getAllTemplates();

    // Filter by category
    if (filters.category) {
      results = results.filter(t => t.category === filters.category);
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(t =>
        filters.tags!.some(tag => t.tags.includes(tag))
      );
    }

    // Filter by favorites
    if (filters.favoritesOnly) {
      results = results.filter(t => t.favorite);
    }

    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort by usage count and favorites
    results.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return b.usageCount - a.usageCount;
    });

    return results;
  }

  /**
   * Use a template (increment usage count)
   */
  async useTemplate(id: string, variables?: Record<string, any>): Promise<string | null> {
    const template = this.templates.get(id);
    if (!template) return null;

    // Increment usage count
    template.usageCount++;
    await this.saveTemplate(template);

    // Fill in variables
    let prompt = template.prompt;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }

    this.emit('template:used', { template, variables, prompt });
    return prompt;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(id: string): Promise<boolean> {
    const template = this.templates.get(id);
    if (!template) return false;

    template.favorite = !template.favorite;
    await this.saveTemplate(template);

    this.emit('template:favorite-toggled', template);
    return template.favorite;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: TemplateCategory): ConversationTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  /**
   * Get favorite templates
   */
  getFavoriteTemplates(): ConversationTemplate[] {
    return this.getAllTemplates().filter(t => t.favorite);
  }

  /**
   * Get most used templates
   */
  getMostUsedTemplates(limit: number = 5): ConversationTemplate[] {
    return this.getAllTemplates()
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Save template to disk
   */
  private async saveTemplate(template: ConversationTemplate): Promise<void> {
    const filePath = path.join(this.templatesDir, `${template.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf-8');
  }

  /**
   * Export template
   */
  async exportTemplate(id: string, exportPath: string): Promise<boolean> {
    const template = this.templates.get(id);
    if (!template) return false;

    await fs.writeFile(exportPath, JSON.stringify(template, null, 2), 'utf-8');
    return true;
  }

  /**
   * Import template
   */
  async importTemplate(importPath: string): Promise<ConversationTemplate | null> {
    try {
      const content = await fs.readFile(importPath, 'utf-8');
      const data = JSON.parse(content);

      // Create new template with imported data (new ID)
      return await this.createTemplate({
        name: data.name,
        description: data.description,
        category: data.category,
        author: data.author,
        tags: data.tags,
        prompt: data.prompt,
        context: data.context,
        agentPreferences: data.agentPreferences,
        variables: data.variables,
      });
    } catch (error) {
      console.error('Error importing template:', error);
      return null;
    }
  }
}

// Singleton instance
let templateManagerInstance: TemplateManager | null = null;

/**
 * Get the global template manager
 */
export function getTemplateManager(customDir?: string): TemplateManager {
  if (!templateManagerInstance) {
    templateManagerInstance = new TemplateManager(customDir);
  }
  return templateManagerInstance;
}
