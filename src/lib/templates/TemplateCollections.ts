/**
 * Template Collections
 * Organize templates into curated collections for different workflows
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConversationTemplate, TemplateCategory } from './TemplateManager';

/**
 * Collection type
 */
export enum CollectionType {
  WORKFLOW = 'workflow',         // Step-by-step workflows
  QUICKSTART = 'quickstart',     // Getting started guides
  BEST_PRACTICES = 'best_practices', // Recommended approaches
  SPECIALIZED = 'specialized',    // Domain-specific collections
  CUSTOM = 'custom',             // User-created collections
}

/**
 * Template collection
 */
export interface TemplateCollection {
  id: string;
  name: string;
  description: string;
  type: CollectionType;
  author?: string;
  icon?: string;
  color?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  favorite: boolean;
  featured: boolean;

  // Templates in this collection
  templates: string[]; // Template IDs
  templateOrder?: Record<string, number>; // Optional ordering

  // Metadata
  metadata?: {
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime?: number; // minutes
    prerequisites?: string[];
    outcomes?: string[];
  };
}

/**
 * Collection filters
 */
export interface CollectionFilters {
  type?: CollectionType;
  tags?: string[];
  searchQuery?: string;
  favoritesOnly?: boolean;
  difficulty?: string;
}

/**
 * Template Collections Manager
 */
export class TemplateCollections extends EventEmitter {
  private collections: Map<string, TemplateCollection> = new Map();
  private collectionsFile: string;

  constructor(customFile?: string) {
    super();
    this.collectionsFile = customFile || path.join(os.homedir(), '.selek', 'template-collections.json');
  }

  /**
   * Initialize template collections
   */
  async initialize(): Promise<void> {
    await this.loadCollections();
    this.createDefaultCollections();
    this.emit('initialized');
  }

  /**
   * Create a new collection
   */
  createCollection(
    name: string,
    description: string,
    type: CollectionType,
    templates: string[] = []
  ): string {
    const id = `collection_${Date.now()}`;
    const collection: TemplateCollection = {
      id,
      name,
      description,
      type,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      favorite: false,
      featured: false,
      templates,
    };

    this.collections.set(id, collection);
    this.emit('collection:created', collection);
    this.saveCollections();

    return id;
  }

  /**
   * Get collection by ID
   */
  getCollection(id: string): TemplateCollection | undefined {
    return this.collections.get(id);
  }

  /**
   * Get all collections
   */
  getAllCollections(): TemplateCollection[] {
    return Array.from(this.collections.values());
  }

  /**
   * Search collections
   */
  searchCollections(filters: CollectionFilters): TemplateCollection[] {
    let results = Array.from(this.collections.values());

    // Filter by type
    if (filters.type) {
      results = results.filter(c => c.type === filters.type);
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(c =>
        filters.tags!.some(tag => c.tags.includes(tag))
      );
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      results = results.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query)
      );
    }

    // Filter favorites
    if (filters.favoritesOnly) {
      results = results.filter(c => c.favorite);
    }

    // Filter by difficulty
    if (filters.difficulty) {
      results = results.filter(c => c.metadata?.difficulty === filters.difficulty);
    }

    // Sort: featured first, then by usage, then by name
    return results.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Add template to collection
   */
  addTemplateToCollection(collectionId: string, templateId: string): void {
    const collection = this.collections.get(collectionId);
    if (!collection) return;

    if (!collection.templates.includes(templateId)) {
      collection.templates.push(templateId);
      collection.updatedAt = new Date();
      this.emit('collection:updated', collection);
      this.saveCollections();
    }
  }

  /**
   * Remove template from collection
   */
  removeTemplateFromCollection(collectionId: string, templateId: string): void {
    const collection = this.collections.get(collectionId);
    if (!collection) return;

    const index = collection.templates.indexOf(templateId);
    if (index > -1) {
      collection.templates.splice(index, 1);
      collection.updatedAt = new Date();
      this.emit('collection:updated', collection);
      this.saveCollections();
    }
  }

  /**
   * Reorder templates in collection
   */
  reorderTemplates(collectionId: string, templateOrder: string[]): void {
    const collection = this.collections.get(collectionId);
    if (!collection) return;

    collection.templates = templateOrder;
    collection.updatedAt = new Date();
    this.emit('collection:updated', collection);
    this.saveCollections();
  }

  /**
   * Toggle collection favorite
   */
  toggleFavorite(collectionId: string): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;

    collection.favorite = !collection.favorite;
    this.emit('collection:updated', collection);
    this.saveCollections();

    return collection.favorite;
  }

  /**
   * Update collection metadata
   */
  updateCollection(collectionId: string, updates: Partial<TemplateCollection>): void {
    const collection = this.collections.get(collectionId);
    if (!collection) return;

    Object.assign(collection, updates);
    collection.updatedAt = new Date();
    this.emit('collection:updated', collection);
    this.saveCollections();
  }

  /**
   * Delete collection
   */
  deleteCollection(collectionId: string): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection || collection.type !== CollectionType.CUSTOM) {
      return false;
    }

    this.collections.delete(collectionId);
    this.emit('collection:deleted', collectionId);
    this.saveCollections();

    return true;
  }

  /**
   * Track collection usage
   */
  trackUsage(collectionId: string): void {
    const collection = this.collections.get(collectionId);
    if (!collection) return;

    collection.usageCount++;
    this.saveCollections();
  }

  /**
   * Get featured collections
   */
  getFeaturedCollections(): TemplateCollection[] {
    return Array.from(this.collections.values())
      .filter(c => c.featured)
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Get collections by type
   */
  getCollectionsByType(type: CollectionType): TemplateCollection[] {
    return Array.from(this.collections.values())
      .filter(c => c.type === type)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const collections = Array.from(this.collections.values());

    const byType = new Map<CollectionType, number>();
    for (const collection of collections) {
      byType.set(collection.type, (byType.get(collection.type) || 0) + 1);
    }

    return {
      totalCollections: collections.length,
      byType,
      favoriteCount: collections.filter(c => c.favorite).length,
      featuredCount: collections.filter(c => c.featured).length,
      totalTemplates: collections.reduce((sum, c) => sum + c.templates.length, 0),
      mostUsed: collections.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5),
    };
  }

  /**
   * Create default collections
   */
  private createDefaultCollections(): void {
    if (this.collections.size > 0) return;

    // Code Development Workflow
    const codeDev: TemplateCollection = {
      id: 'code-dev-workflow',
      name: 'Code Development Workflow',
      description: 'Complete workflow for developing new features from scratch',
      type: CollectionType.WORKFLOW,
      icon: '💻',
      color: 'blue',
      tags: ['development', 'workflow', 'beginner-friendly'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      favorite: false,
      featured: true,
      templates: [], // Would be populated with actual template IDs
      metadata: {
        difficulty: 'intermediate',
        estimatedTime: 60,
        prerequisites: ['Basic TypeScript knowledge'],
        outcomes: ['Fully tested feature', 'Documentation', 'Code review ready'],
      },
    };
    this.collections.set(codeDev.id, codeDev);

    // Debugging Workflow
    const debugging: TemplateCollection = {
      id: 'debugging-workflow',
      name: 'Systematic Debugging',
      description: 'Step-by-step approach to finding and fixing bugs',
      type: CollectionType.WORKFLOW,
      icon: '🐛',
      color: 'red',
      tags: ['debugging', 'troubleshooting', 'workflow'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      favorite: false,
      featured: true,
      templates: [],
      metadata: {
        difficulty: 'intermediate',
        estimatedTime: 30,
        prerequisites: ['Understanding of error messages'],
        outcomes: ['Bug identified', 'Root cause understood', 'Fix implemented'],
      },
    };
    this.collections.set(debugging.id, debugging);

    // Quick Start Collection
    const quickstart: TemplateCollection = {
      id: 'quickstart',
      name: 'Quick Start Templates',
      description: 'Get started quickly with common tasks',
      type: CollectionType.QUICKSTART,
      icon: '🚀',
      color: 'green',
      tags: ['quickstart', 'beginner', 'common-tasks'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      favorite: false,
      featured: true,
      templates: [],
      metadata: {
        difficulty: 'beginner',
        estimatedTime: 15,
        prerequisites: [],
        outcomes: ['Task completed quickly'],
      },
    };
    this.collections.set(quickstart.id, quickstart);

    // Code Review Collection
    const codeReview: TemplateCollection = {
      id: 'code-review',
      name: 'Code Review Best Practices',
      description: 'Templates for thorough and constructive code reviews',
      type: CollectionType.BEST_PRACTICES,
      icon: '👀',
      color: 'purple',
      tags: ['code-review', 'best-practices', 'quality'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      favorite: false,
      featured: true,
      templates: [],
      metadata: {
        difficulty: 'intermediate',
        estimatedTime: 45,
        prerequisites: ['Code to review'],
        outcomes: ['Comprehensive review', 'Actionable feedback'],
      },
    };
    this.collections.set(codeReview.id, codeReview);

    // Security Audit Collection
    const security: TemplateCollection = {
      id: 'security-audit',
      name: 'Security Audit Templates',
      description: 'Security-focused templates for identifying vulnerabilities',
      type: CollectionType.SPECIALIZED,
      icon: '🔒',
      color: 'red',
      tags: ['security', 'audit', 'specialized'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      favorite: false,
      featured: true,
      templates: [],
      metadata: {
        difficulty: 'advanced',
        estimatedTime: 90,
        prerequisites: ['Security knowledge', 'OWASP familiarity'],
        outcomes: ['Security assessment', 'Vulnerability report', 'Remediation plan'],
      },
    };
    this.collections.set(security.id, security);

    // Performance Optimization Collection
    const performance: TemplateCollection = {
      id: 'performance-optimization',
      name: 'Performance Optimization',
      description: 'Templates for analyzing and improving code performance',
      type: CollectionType.SPECIALIZED,
      icon: '⚡',
      color: 'yellow',
      tags: ['performance', 'optimization', 'specialized'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      favorite: false,
      featured: true,
      templates: [],
      metadata: {
        difficulty: 'advanced',
        estimatedTime: 120,
        prerequisites: ['Profiling tools', 'Performance metrics'],
        outcomes: ['Performance baseline', 'Optimization plan', 'Benchmarks'],
      },
    };
    this.collections.set(performance.id, performance);

    // Testing Strategies Collection
    const testing: TemplateCollection = {
      id: 'testing-strategies',
      name: 'Testing Strategies',
      description: 'Comprehensive testing templates for different scenarios',
      type: CollectionType.BEST_PRACTICES,
      icon: '🧪',
      color: 'cyan',
      tags: ['testing', 'quality', 'best-practices'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      favorite: false,
      featured: true,
      templates: [],
      metadata: {
        difficulty: 'intermediate',
        estimatedTime: 60,
        prerequisites: ['Testing framework knowledge'],
        outcomes: ['Test plan', 'Test coverage', 'CI/CD integration'],
      },
    };
    this.collections.set(testing.id, testing);

    // Refactoring Collection
    const refactoring: TemplateCollection = {
      id: 'refactoring-guide',
      name: 'Refactoring Guide',
      description: 'Safe and systematic code refactoring templates',
      type: CollectionType.BEST_PRACTICES,
      icon: '♻️',
      color: 'green',
      tags: ['refactoring', 'code-quality', 'best-practices'],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      favorite: false,
      featured: true,
      templates: [],
      metadata: {
        difficulty: 'intermediate',
        estimatedTime: 90,
        prerequisites: ['Existing tests', 'Version control'],
        outcomes: ['Cleaner code', 'Better architecture', 'Maintained functionality'],
      },
    };
    this.collections.set(refactoring.id, refactoring);
  }

  /**
   * Load collections from disk
   */
  private async loadCollections(): Promise<void> {
    try {
      const dir = path.dirname(this.collectionsFile);
      await fs.mkdir(dir, { recursive: true });

      const content = await fs.readFile(this.collectionsFile, 'utf-8');
      const data = JSON.parse(content);

      for (const collectionData of data) {
        const collection: TemplateCollection = {
          ...collectionData,
          createdAt: new Date(collectionData.createdAt),
          updatedAt: new Date(collectionData.updatedAt),
        };
        this.collections.set(collection.id, collection);
      }
    } catch {
      // File doesn't exist yet
      this.collections.clear();
    }
  }

  /**
   * Save collections to disk
   */
  async saveCollections(): Promise<void> {
    const dir = path.dirname(this.collectionsFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.collectionsFile,
      JSON.stringify(Array.from(this.collections.values()), null, 2)
    );
  }
}

// Singleton instance
let templateCollectionsInstance: TemplateCollections | null = null;

/**
 * Get the global template collections manager
 */
export function getTemplateCollections(): TemplateCollections {
  if (!templateCollectionsInstance) {
    templateCollectionsInstance = new TemplateCollections();
  }
  return templateCollectionsInstance;
}
