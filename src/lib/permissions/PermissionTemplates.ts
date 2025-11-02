/**
 * Permission Templates
 * Pre-configured permission sets for different use cases
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Permission scope
 */
export enum PermissionScope {
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  FILE_DELETE = 'file:delete',
  BASH_EXEC = 'bash:exec',
  NETWORK_FETCH = 'network:fetch',
  AGENT_CREATE = 'agent:create',
  AGENT_DELEGATE = 'agent:delegate',
  CONTEXT_MODIFY = 'context:modify',
  KNOWLEDGE_GRAPH = 'knowledge:graph',
  ALL = '*',
}

/**
 * Permission level
 */
export enum PermissionLevel {
  NONE = 'none',
  ASK = 'ask',
  ALLOW = 'allow',
  DENY = 'deny',
}

/**
 * Permission rule
 */
export interface PermissionRule {
  scope: PermissionScope;
  level: PermissionLevel;
  conditions?: {
    paths?: string[]; // Allowed/denied paths
    patterns?: string[]; // Glob patterns
    maxSize?: number; // For file operations
    timeout?: number; // For network/bash
  };
}

/**
 * Permission template
 */
export interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  rules: PermissionRule[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  builtin: boolean;
}

/**
 * Permission Templates Manager
 */
export class PermissionTemplates extends EventEmitter {
  private templates: Map<string, PermissionTemplate> = new Map();
  private templatesFile: string;

  constructor(customFile?: string) {
    super();
    this.templatesFile = customFile || path.join(os.homedir(), '.selek', 'permission-templates.json');
  }

  /**
   * Initialize permission templates
   */
  async initialize(): Promise<void> {
    await this.loadTemplates();
    this.createBuiltinTemplates();
    this.emit('initialized');
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): PermissionTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): PermissionTemplate[] {
    return Array.from(this.templates.values())
      .sort((a, b) => {
        // Builtin templates first
        if (a.builtin !== b.builtin) return a.builtin ? -1 : 1;
        // Then by usage
        if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
        // Then by name
        return a.name.localeCompare(b.name);
      });
  }

  /**
   * Create custom template
   */
  createTemplate(
    name: string,
    description: string,
    rules: PermissionRule[]
  ): string {
    const id = `template_${Date.now()}`;
    const template: PermissionTemplate = {
      id,
      name,
      description,
      rules,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      builtin: false,
    };

    this.templates.set(id, template);
    this.emit('template:created', template);
    this.saveTemplates();

    return id;
  }

  /**
   * Update template
   */
  updateTemplate(id: string, updates: Partial<PermissionTemplate>): void {
    const template = this.templates.get(id);
    if (!template || template.builtin) return;

    Object.assign(template, updates);
    template.updatedAt = new Date();
    this.emit('template:updated', template);
    this.saveTemplates();
  }

  /**
   * Delete template
   */
  deleteTemplate(id: string): boolean {
    const template = this.templates.get(id);
    if (!template || template.builtin) return false;

    this.templates.delete(id);
    this.emit('template:deleted', id);
    this.saveTemplates();

    return true;
  }

  /**
   * Track template usage
   */
  trackUsage(id: string): void {
    const template = this.templates.get(id);
    if (!template) return;

    template.usageCount++;
    this.saveTemplates();
  }

  /**
   * Apply template to get permission rules
   */
  applyTemplate(id: string): PermissionRule[] {
    const template = this.templates.get(id);
    if (!template) return [];

    this.trackUsage(id);
    return [...template.rules];
  }

  /**
   * Create builtin templates
   */
  private createBuiltinTemplates(): void {
    // Check if builtin templates already exist
    const hasBuiltin = Array.from(this.templates.values()).some(t => t.builtin);
    if (hasBuiltin) return;

    // Read-Only Mode
    this.templates.set('readonly', {
      id: 'readonly',
      name: 'Read-Only Mode',
      description: 'Only allow reading files and viewing data',
      icon: '📖',
      rules: [
        { scope: PermissionScope.FILE_READ, level: PermissionLevel.ALLOW },
        { scope: PermissionScope.FILE_WRITE, level: PermissionLevel.DENY },
        { scope: PermissionScope.FILE_DELETE, level: PermissionLevel.DENY },
        { scope: PermissionScope.BASH_EXEC, level: PermissionLevel.DENY },
        { scope: PermissionScope.NETWORK_FETCH, level: PermissionLevel.ASK },
      ],
      tags: ['safe', 'readonly', 'beginner'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      builtin: true,
    });

    // Safe Development Mode
    this.templates.set('safe-dev', {
      id: 'safe-dev',
      name: 'Safe Development',
      description: 'Allow file operations in project directory only',
      icon: '🛡️',
      rules: [
        { scope: PermissionScope.FILE_READ, level: PermissionLevel.ALLOW },
        {
          scope: PermissionScope.FILE_WRITE,
          level: PermissionLevel.ASK,
          conditions: { paths: [process.cwd()] },
        },
        { scope: PermissionScope.FILE_DELETE, level: PermissionLevel.ASK },
        { scope: PermissionScope.BASH_EXEC, level: PermissionLevel.ASK },
        { scope: PermissionScope.NETWORK_FETCH, level: PermissionLevel.ASK },
      ],
      tags: ['safe', 'development', 'recommended'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      builtin: true,
    });

    // Full Access Mode
    this.templates.set('full-access', {
      id: 'full-access',
      name: 'Full Access',
      description: 'Allow all operations (use with caution)',
      icon: '⚠️',
      rules: [
        { scope: PermissionScope.ALL, level: PermissionLevel.ALLOW },
      ],
      tags: ['dangerous', 'full-access', 'advanced'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      builtin: true,
    });

    // Restricted Mode
    this.templates.set('restricted', {
      id: 'restricted',
      name: 'Restricted Mode',
      description: 'Ask for permission on all operations',
      icon: '🔒',
      rules: [
        { scope: PermissionScope.ALL, level: PermissionLevel.ASK },
      ],
      tags: ['safe', 'restricted', 'beginner'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      builtin: true,
    });

    // Code Review Mode
    this.templates.set('code-review', {
      id: 'code-review',
      name: 'Code Review',
      description: 'Read code and run safe analysis commands',
      icon: '👀',
      rules: [
        { scope: PermissionScope.FILE_READ, level: PermissionLevel.ALLOW },
        { scope: PermissionScope.FILE_WRITE, level: PermissionLevel.DENY },
        { scope: PermissionScope.FILE_DELETE, level: PermissionLevel.DENY },
        { scope: PermissionScope.BASH_EXEC, level: PermissionLevel.ASK },
        { scope: PermissionScope.KNOWLEDGE_GRAPH, level: PermissionLevel.ALLOW },
      ],
      tags: ['safe', 'code-review', 'readonly'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      builtin: true,
    });

    // Testing Mode
    this.templates.set('testing', {
      id: 'testing',
      name: 'Testing Mode',
      description: 'Run tests and modify test files only',
      icon: '🧪',
      rules: [
        { scope: PermissionScope.FILE_READ, level: PermissionLevel.ALLOW },
        {
          scope: PermissionScope.FILE_WRITE,
          level: PermissionLevel.ALLOW,
          conditions: {
            patterns: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
          },
        },
        { scope: PermissionScope.FILE_DELETE, level: PermissionLevel.DENY },
        { scope: PermissionScope.BASH_EXEC, level: PermissionLevel.ALLOW },
      ],
      tags: ['testing', 'safe', 'development'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      builtin: true,
    });

    // Documentation Mode
    this.templates.set('documentation', {
      id: 'documentation',
      name: 'Documentation',
      description: 'Read code and modify documentation files',
      icon: '📝',
      rules: [
        { scope: PermissionScope.FILE_READ, level: PermissionLevel.ALLOW },
        {
          scope: PermissionScope.FILE_WRITE,
          level: PermissionLevel.ALLOW,
          conditions: {
            patterns: ['**/*.md', '**/docs/**', '**/*.mdx'],
          },
        },
        { scope: PermissionScope.FILE_DELETE, level: PermissionLevel.DENY },
        { scope: PermissionScope.BASH_EXEC, level: PermissionLevel.DENY },
      ],
      tags: ['documentation', 'safe', 'writing'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      builtin: true,
    });
  }

  /**
   * Load templates from disk
   */
  private async loadTemplates(): Promise<void> {
    try {
      const dir = path.dirname(this.templatesFile);
      await fs.mkdir(dir, { recursive: true });

      const content = await fs.readFile(this.templatesFile, 'utf-8');
      const data = JSON.parse(content);

      for (const templateData of data) {
        const template: PermissionTemplate = {
          ...templateData,
          createdAt: new Date(templateData.createdAt),
          updatedAt: new Date(templateData.updatedAt),
        };
        this.templates.set(template.id, template);
      }
    } catch {
      // File doesn't exist yet
    }
  }

  /**
   * Save templates to disk
   */
  async saveTemplates(): Promise<void> {
    const dir = path.dirname(this.templatesFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.templatesFile,
      JSON.stringify(Array.from(this.templates.values()), null, 2)
    );
  }
}

// Singleton instance
let permissionTemplatesInstance: PermissionTemplates | null = null;

/**
 * Get the global permission templates manager
 */
export function getPermissionTemplates(): PermissionTemplates {
  if (!permissionTemplatesInstance) {
    permissionTemplatesInstance = new PermissionTemplates();
  }
  return permissionTemplatesInstance;
}
