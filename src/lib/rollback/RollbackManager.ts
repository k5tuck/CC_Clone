/**
 * Rollback Manager
 * Tracks file changes and allows undoing modifications
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * File change action
 */
export enum ChangeAction {
  CREATE = 'create',
  MODIFY = 'modify',
  DELETE = 'delete',
}

/**
 * File change record
 */
export interface FileChange {
  id: string;
  timestamp: Date;
  action: ChangeAction;
  filePath: string;
  previousContent?: string;
  newContent?: string;
  description?: string;
  agent?: string;
}

/**
 * Checkpoint
 */
export interface Checkpoint {
  id: string;
  name: string;
  description?: string;
  timestamp: Date;
  changes: FileChange[];
}

/**
 * Rollback statistics
 */
export interface RollbackStats {
  totalChanges: number;
  changesByAction: Map<ChangeAction, number>;
  checkpointCount: number;
  oldestChange: Date | null;
  newestChange: Date | null;
}

/**
 * Rollback Manager
 */
export class RollbackManager extends EventEmitter {
  private changes: Map<string, FileChange> = new Map();
  private changeHistory: FileChange[] = [];
  private checkpoints: Map<string, Checkpoint> = new Map();
  private maxHistorySize = 100;
  private backupDir: string;

  constructor(customBackupDir?: string) {
    super();
    this.backupDir = customBackupDir || path.join(os.homedir(), '.selek', 'rollback');
  }

  /**
   * Initialize the rollback manager
   */
  async initialize(): Promise<void> {
    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true });
    this.emit('initialized');
  }

  /**
   * Record a file change
   */
  async recordChange(
    filePath: string,
    action: ChangeAction,
    options: {
      description?: string;
      agent?: string;
      captureContent?: boolean;
    } = {}
  ): Promise<string> {
    const id = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let previousContent: string | undefined;
    let newContent: string | undefined;

    // Capture file content for rollback
    if (options.captureContent !== false) {
      try {
        if (action === ChangeAction.DELETE || action === ChangeAction.MODIFY) {
          // Save previous content before deletion/modification
          previousContent = await fs.readFile(filePath, 'utf-8');

          // Backup the file
          await this.backupFile(id, filePath, previousContent);
        }

        if (action === ChangeAction.CREATE || action === ChangeAction.MODIFY) {
          // Capture new content after creation/modification
          try {
            newContent = await fs.readFile(filePath, 'utf-8');
          } catch {
            // File might not exist yet
          }
        }
      } catch (error) {
        // File might not exist, which is fine for CREATE action
        if (action !== ChangeAction.CREATE) {
          console.error(`Error capturing file content for ${filePath}:`, error);
        }
      }
    }

    const change: FileChange = {
      id,
      timestamp: new Date(),
      action,
      filePath,
      previousContent,
      newContent,
      description: options.description,
      agent: options.agent,
    };

    this.changes.set(id, change);
    this.changeHistory.unshift(change);

    // Limit history size
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory = this.changeHistory.slice(0, this.maxHistorySize);
    }

    this.emit('change:recorded', change);
    return id;
  }

  /**
   * Backup a file
   */
  private async backupFile(changeId: string, filePath: string, content: string): Promise<void> {
    const backupPath = path.join(this.backupDir, `${changeId}_${path.basename(filePath)}`);
    await fs.writeFile(backupPath, content, 'utf-8');
  }

  /**
   * Restore a file from backup
   */
  private async restoreFromBackup(changeId: string, filePath: string): Promise<string | null> {
    try {
      const backupPath = path.join(this.backupDir, `${changeId}_${path.basename(filePath)}`);
      return await fs.readFile(backupPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Undo a specific change
   */
  async undoChange(changeId: string): Promise<boolean> {
    const change = this.changes.get(changeId);
    if (!change) return false;

    try {
      switch (change.action) {
        case ChangeAction.CREATE:
          // Undo creation by deleting the file
          try {
            await fs.unlink(change.filePath);
            this.emit('change:undone', { change, action: 'deleted' });
          } catch {
            // File might already be deleted
          }
          break;

        case ChangeAction.DELETE:
          // Undo deletion by restoring the file
          if (change.previousContent) {
            await fs.writeFile(change.filePath, change.previousContent, 'utf-8');
            this.emit('change:undone', { change, action: 'restored' });
          } else {
            // Try to restore from backup
            const content = await this.restoreFromBackup(change.id, change.filePath);
            if (content) {
              await fs.writeFile(change.filePath, content, 'utf-8');
              this.emit('change:undone', { change, action: 'restored' });
            } else {
              return false;
            }
          }
          break;

        case ChangeAction.MODIFY:
          // Undo modification by restoring previous content
          if (change.previousContent) {
            await fs.writeFile(change.filePath, change.previousContent, 'utf-8');
            this.emit('change:undone', { change, action: 'reverted' });
          } else {
            // Try to restore from backup
            const content = await this.restoreFromBackup(change.id, change.filePath);
            if (content) {
              await fs.writeFile(change.filePath, content, 'utf-8');
              this.emit('change:undone', { change, action: 'reverted' });
            } else {
              return false;
            }
          }
          break;
      }

      return true;
    } catch (error) {
      this.emit('change:undo-failed', { change, error });
      return false;
    }
  }

  /**
   * Undo the last N changes
   */
  async undoLast(count: number = 1): Promise<number> {
    let undoneCount = 0;
    const changesToUndo = this.changeHistory.slice(0, count);

    for (const change of changesToUndo) {
      const success = await this.undoChange(change.id);
      if (success) undoneCount++;
    }

    return undoneCount;
  }

  /**
   * Create a checkpoint
   */
  createCheckpoint(name: string, description?: string): string {
    const id = `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const checkpoint: Checkpoint = {
      id,
      name,
      description,
      timestamp: new Date(),
      changes: [...this.changeHistory],
    };

    this.checkpoints.set(id, checkpoint);
    this.emit('checkpoint:created', checkpoint);

    return id;
  }

  /**
   * Rollback to a checkpoint
   */
  async rollbackToCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return false;

    try {
      // Find changes that happened after the checkpoint
      const changesToUndo = this.changeHistory.filter(
        change => change.timestamp > checkpoint.timestamp
      );

      // Undo changes in reverse order
      for (const change of changesToUndo.reverse()) {
        await this.undoChange(change.id);
      }

      this.emit('checkpoint:restored', { checkpoint, changesUndone: changesToUndo.length });
      return true;
    } catch (error) {
      this.emit('checkpoint:restore-failed', { checkpoint, error });
      return false;
    }
  }

  /**
   * Get change history
   */
  getHistory(limit: number = 20): FileChange[] {
    return this.changeHistory.slice(0, limit);
  }

  /**
   * Get changes for a specific file
   */
  getFileHistory(filePath: string, limit: number = 10): FileChange[] {
    return this.changeHistory
      .filter(change => change.filePath === filePath)
      .slice(0, limit);
  }

  /**
   * Get all checkpoints
   */
  getCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Delete a checkpoint
   */
  deleteCheckpoint(checkpointId: string): boolean {
    const deleted = this.checkpoints.delete(checkpointId);
    if (deleted) {
      this.emit('checkpoint:deleted', checkpointId);
    }
    return deleted;
  }

  /**
   * Get statistics
   */
  getStats(): RollbackStats {
    const changesByAction = new Map<ChangeAction, number>();

    for (const change of this.changeHistory) {
      changesByAction.set(
        change.action,
        (changesByAction.get(change.action) || 0) + 1
      );
    }

    const timestamps = this.changeHistory.map(c => c.timestamp.getTime());

    return {
      totalChanges: this.changeHistory.length,
      changesByAction,
      checkpointCount: this.checkpoints.size,
      oldestChange: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
      newestChange: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
    };
  }

  /**
   * Clear history
   */
  async clearHistory(): Promise<void> {
    this.changes.clear();
    this.changeHistory = [];

    // Clear backup files
    try {
      const files = await fs.readdir(this.backupDir);
      for (const file of files) {
        await fs.unlink(path.join(this.backupDir, file));
      }
    } catch {
      // Backup dir might not exist
    }

    this.emit('history:cleared');
  }

  /**
   * Clear checkpoints
   */
  clearCheckpoints(): void {
    this.checkpoints.clear();
    this.emit('checkpoints:cleared');
  }
}

// Singleton instance
let rollbackManagerInstance: RollbackManager | null = null;

/**
 * Get the global rollback manager
 */
export function getRollbackManager(customBackupDir?: string): RollbackManager {
  if (!rollbackManagerInstance) {
    rollbackManagerInstance = new RollbackManager(customBackupDir);
  }
  return rollbackManagerInstance;
}
