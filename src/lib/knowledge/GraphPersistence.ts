/**
 * Knowledge Graph Persistence
 *
 * Handles saving and loading knowledge graphs from disk with
 * automatic compression and incremental updates.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { KnowledgeGraph } from './KnowledgeGraph';

// ============================================================================
// Configuration
// ============================================================================

export interface PersistenceConfig {
  baseDir: string;
  autoSave: boolean;
  saveInterval: number; // milliseconds
  compress: boolean;
  maxBackups: number;
}

const DEFAULT_CONFIG: PersistenceConfig = {
  baseDir: path.join(process.env.HOME || process.env.USERPROFILE || '', '.local-agent', 'graphs'),
  autoSave: true,
  saveInterval: 60000, // 60 seconds
  compress: false,
  maxBackups: 5,
};

// ============================================================================
// Graph Persistence Manager
// ============================================================================

export class GraphPersistenceManager {
  private config: PersistenceConfig;
  private saveTimers: Map<string, NodeJS.Timeout>;
  private projectGraphs: Map<string, KnowledgeGraph>;

  constructor(config?: Partial<PersistenceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.saveTimers = new Map();
    this.projectGraphs = new Map();
    this.ensureBaseDir();
  }

  /**
   * Ensure the base directory exists
   */
  private async ensureBaseDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.baseDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create graphs directory:', error);
    }
  }

  /**
   * Generate a unique project ID from project path
   */
  static generateProjectId(projectPath: string): string {
    const hash = crypto.createHash('sha256').update(projectPath).digest('hex');
    return hash.substring(0, 16);
  }

  /**
   * Get the file path for a project graph
   */
  private getGraphPath(projectId: string): string {
    return path.join(this.config.baseDir, `${projectId}.json`);
  }

  /**
   * Get the backup path for a project graph
   */
  private getBackupPath(projectId: string, timestamp: number): string {
    return path.join(this.config.baseDir, 'backups', `${projectId}-${timestamp}.json`);
  }

  /**
   * Save a knowledge graph to disk
   */
  async save(projectId: string, graph: KnowledgeGraph): Promise<void> {
    try {
      const graphPath = this.getGraphPath(projectId);
      const data = graph.toJSON();
      const json = JSON.stringify(data, null, 2);

      // Create backup if file exists
      try {
        await fs.access(graphPath);
        await this.createBackup(projectId);
      } catch (error) {
        // File doesn't exist, no backup needed
      }

      // Write to temporary file first
      const tempPath = `${graphPath}.tmp`;
      await fs.writeFile(tempPath, json, 'utf-8');

      // Atomic rename
      await fs.rename(tempPath, graphPath);

      // Clean old backups
      await this.cleanOldBackups(projectId);
    } catch (error) {
      console.error(`Failed to save graph for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Load a knowledge graph from disk
   */
  async load(projectId: string): Promise<KnowledgeGraph | null> {
    try {
      const graphPath = this.getGraphPath(projectId);
      const json = await fs.readFile(graphPath, 'utf-8');
      const data = JSON.parse(json);
      const graph = KnowledgeGraph.fromJSON(data);

      // Cache the loaded graph
      this.projectGraphs.set(projectId, graph);

      // Setup auto-save if enabled
      if (this.config.autoSave) {
        this.setupAutoSave(projectId, graph);
      }

      return graph;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist - return null (will create new graph)
        return null;
      }
      console.error(`Failed to load graph for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Get or create a knowledge graph for a project
   */
  async getOrCreate(projectId: string, projectPath?: string): Promise<KnowledgeGraph> {
    // Check cache first
    if (this.projectGraphs.has(projectId)) {
      return this.projectGraphs.get(projectId)!;
    }

    // Try to load from disk
    const loaded = await this.load(projectId);
    if (loaded) {
      return loaded;
    }

    // Create new graph
    const graph = new KnowledgeGraph(projectId);
    this.projectGraphs.set(projectId, graph);

    // Setup auto-save
    if (this.config.autoSave) {
      this.setupAutoSave(projectId, graph);
    }

    // Save initial empty graph
    await this.save(projectId, graph);

    return graph;
  }

  /**
   * Setup auto-save for a graph
   */
  private setupAutoSave(projectId: string, graph: KnowledgeGraph): void {
    // Clear existing timer
    const existingTimer = this.saveTimers.get(projectId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Setup new timer
    const timer = setInterval(async () => {
      try {
        await this.save(projectId, graph);
      } catch (error) {
        console.error(`Auto-save failed for project ${projectId}:`, error);
      }
    }, this.config.saveInterval);

    this.saveTimers.set(projectId, timer);
  }

  /**
   * Create a backup of the current graph
   */
  private async createBackup(projectId: string): Promise<void> {
    try {
      const graphPath = this.getGraphPath(projectId);
      const backupDir = path.join(this.config.baseDir, 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const timestamp = Date.now();
      const backupPath = this.getBackupPath(projectId, timestamp);

      await fs.copyFile(graphPath, backupPath);
    } catch (error) {
      console.error(`Failed to create backup for project ${projectId}:`, error);
    }
  }

  /**
   * Clean old backups, keeping only the most recent ones
   */
  private async cleanOldBackups(projectId: string): Promise<void> {
    try {
      const backupDir = path.join(this.config.baseDir, 'backups');
      const files = await fs.readdir(backupDir);

      // Filter backups for this project
      const projectBackups = files
        .filter((file) => file.startsWith(projectId))
        .map((file) => ({
          file,
          path: path.join(backupDir, file),
          timestamp: parseInt(file.split('-').pop()!.replace('.json', '')),
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // Delete old backups
      for (let i = this.config.maxBackups; i < projectBackups.length; i++) {
        await fs.unlink(projectBackups[i].path);
      }
    } catch (error) {
      console.error(`Failed to clean old backups for project ${projectId}:`, error);
    }
  }

  /**
   * Delete a project's graph and backups
   */
  async delete(projectId: string): Promise<void> {
    try {
      // Clear auto-save timer
      const timer = this.saveTimers.get(projectId);
      if (timer) {
        clearInterval(timer);
        this.saveTimers.delete(projectId);
      }

      // Remove from cache
      this.projectGraphs.delete(projectId);

      // Delete main file
      const graphPath = this.getGraphPath(projectId);
      try {
        await fs.unlink(graphPath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Delete backups
      const backupDir = path.join(this.config.baseDir, 'backups');
      try {
        const files = await fs.readdir(backupDir);
        const projectBackups = files.filter((file) => file.startsWith(projectId));

        for (const file of projectBackups) {
          await fs.unlink(path.join(backupDir, file));
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.error(`Failed to delete backups for project ${projectId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to delete graph for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * List all project IDs with graphs
   */
  async listProjects(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.baseDir);
      return files
        .filter((file) => file.endsWith('.json') && !file.includes('.tmp'))
        .map((file) => file.replace('.json', ''));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      console.error('Failed to list projects:', error);
      throw error;
    }
  }

  /**
   * Get statistics for all graphs
   */
  async getGlobalStats(): Promise<{
    projectCount: number;
    totalNodes: number;
    totalEdges: number;
    totalSize: number;
  }> {
    const projects = await this.listProjects();
    let totalNodes = 0;
    let totalEdges = 0;
    let totalSize = 0;

    for (const projectId of projects) {
      try {
        const graphPath = this.getGraphPath(projectId);
        const stat = await fs.stat(graphPath);
        totalSize += stat.size;

        const graph = await this.load(projectId);
        if (graph) {
          const stats = graph.getStats();
          totalNodes += stats.nodeCount;
          totalEdges += stats.edgeCount;
        }
      } catch (error) {
        console.error(`Failed to get stats for project ${projectId}:`, error);
      }
    }

    return {
      projectCount: projects.length,
      totalNodes,
      totalEdges,
      totalSize,
    };
  }

  /**
   * Cleanup - stop all auto-save timers and save all graphs
   */
  async cleanup(): Promise<void> {
    // Save all cached graphs
    const savePromises: Promise<void>[] = [];
    for (const [projectId, graph] of this.projectGraphs.entries()) {
      savePromises.push(this.save(projectId, graph));
    }
    await Promise.all(savePromises);

    // Clear all timers
    for (const timer of this.saveTimers.values()) {
      clearInterval(timer);
    }
    this.saveTimers.clear();

    // Clear cache
    this.projectGraphs.clear();
  }

  /**
   * Export graph to portable format
   */
  async export(projectId: string, exportPath: string): Promise<void> {
    const graph = await this.load(projectId);
    if (!graph) {
      throw new Error(`Graph for project ${projectId} not found`);
    }

    const data = graph.toJSON();
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(exportPath, json, 'utf-8');
  }

  /**
   * Import graph from portable format
   */
  async import(projectId: string, importPath: string): Promise<KnowledgeGraph> {
    const json = await fs.readFile(importPath, 'utf-8');
    const data = JSON.parse(json);
    const graph = KnowledgeGraph.fromJSON(data);

    // Save to storage
    await this.save(projectId, graph);

    // Cache
    this.projectGraphs.set(projectId, graph);

    // Setup auto-save
    if (this.config.autoSave) {
      this.setupAutoSave(projectId, graph);
    }

    return graph;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let persistenceManager: GraphPersistenceManager | null = null;

export function getGraphPersistenceManager(
  config?: Partial<PersistenceConfig>
): GraphPersistenceManager {
  if (!persistenceManager) {
    persistenceManager = new GraphPersistenceManager(config);
  }
  return persistenceManager;
}

// Cleanup on process exit
process.on('exit', () => {
  if (persistenceManager) {
    persistenceManager.cleanup().catch(console.error);
  }
});

process.on('SIGINT', () => {
  if (persistenceManager) {
    persistenceManager.cleanup().then(() => process.exit(0)).catch(() => process.exit(1));
  } else {
    process.exit(0);
  }
});
