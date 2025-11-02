/**
 * Permission Storage
 * Handles reading/writing permissions to ~/.selek/permissions.json
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  PermissionStorage,
  PermissionRule,
  ProjectTrust,
  PermissionHistoryEntry,
  TrustLevel,
} from './PermissionTypes';

const SELEK_DIR = path.join(os.homedir(), '.selek');
const PERMISSIONS_FILE = path.join(SELEK_DIR, 'permissions.json');

/**
 * Default permission storage structure
 */
const DEFAULT_STORAGE: PermissionStorage = {
  version: '1.0.0',
  rules: [],
  trustedProjects: [],
  history: [],
  settings: {
    defaultTrustLevel: TrustLevel.PARTIAL_TRUST,
    autoTrustOwnProjects: false,
    historyRetentionDays: 30,
    requireConfirmForHighRisk: true,
  },
};

/**
 * Ensures ~/.selek directory exists
 */
function ensureSelekDir(): void {
  if (!fs.existsSync(SELEK_DIR)) {
    fs.mkdirSync(SELEK_DIR, { recursive: true });
  }
}

/**
 * Loads permissions from disk
 */
export function loadPermissions(): PermissionStorage {
  ensureSelekDir();

  if (!fs.existsSync(PERMISSIONS_FILE)) {
    savePermissions(DEFAULT_STORAGE);
    return DEFAULT_STORAGE;
  }

  try {
    const content = fs.readFileSync(PERMISSIONS_FILE, 'utf-8');
    const storage = JSON.parse(content) as PermissionStorage;

    // Convert date strings back to Date objects
    storage.rules = storage.rules.map(rule => ({
      ...rule,
      createdAt: new Date(rule.createdAt),
      expiresAt: rule.expiresAt ? new Date(rule.expiresAt) : undefined,
    }));

    storage.trustedProjects = storage.trustedProjects.map(project => ({
      ...project,
      setAt: new Date(project.setAt),
    }));

    storage.history = storage.history.map(entry => ({
      ...entry,
      request: {
        ...entry.request,
        timestamp: new Date(entry.request.timestamp),
      },
      decision: {
        ...entry.decision,
        timestamp: new Date(entry.decision.timestamp),
      },
    }));

    return storage;
  } catch (error) {
    console.error('Error loading permissions:', error);
    return DEFAULT_STORAGE;
  }
}

/**
 * Saves permissions to disk
 */
export function savePermissions(storage: PermissionStorage): void {
  ensureSelekDir();

  try {
    const content = JSON.stringify(storage, null, 2);
    fs.writeFileSync(PERMISSIONS_FILE, content, 'utf-8');
  } catch (error) {
    console.error('Error saving permissions:', error);
    throw error;
  }
}

/**
 * Adds a permission rule
 */
export function addPermissionRule(rule: PermissionRule): void {
  const storage = loadPermissions();
  storage.rules.push(rule);
  savePermissions(storage);
}

/**
 * Removes a permission rule by ID
 */
export function removePermissionRule(ruleId: string): void {
  const storage = loadPermissions();
  storage.rules = storage.rules.filter(rule => rule.id !== ruleId);
  savePermissions(storage);
}

/**
 * Sets project trust level
 */
export function setProjectTrust(trust: ProjectTrust): void {
  const storage = loadPermissions();

  // Remove existing trust for this project
  storage.trustedProjects = storage.trustedProjects.filter(
    p => p.projectPath !== trust.projectPath
  );

  // Add new trust
  storage.trustedProjects.push(trust);
  savePermissions(storage);
}

/**
 * Gets project trust level
 */
export function getProjectTrust(projectPath: string): ProjectTrust | null {
  const storage = loadPermissions();
  return storage.trustedProjects.find(p => p.projectPath === projectPath) || null;
}

/**
 * Adds a permission history entry
 */
export function addHistoryEntry(entry: PermissionHistoryEntry): void {
  const storage = loadPermissions();
  storage.history.push(entry);

  // Clean up old history based on retention settings
  const retentionMs = storage.settings.historyRetentionDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - retentionMs);

  storage.history = storage.history.filter(
    e => e.decision.timestamp > cutoffDate
  );

  savePermissions(storage);
}

/**
 * Gets permission history for a project
 */
export function getProjectHistory(projectPath: string): PermissionHistoryEntry[] {
  const storage = loadPermissions();
  return storage.history.filter(e => e.request.projectPath === projectPath);
}

/**
 * Gets all permission rules for a scope
 */
export function getRulesForScope(scope: 'session' | 'project' | 'global', projectPath?: string): PermissionRule[] {
  const storage = loadPermissions();

  return storage.rules.filter(rule => {
    if (rule.scope !== scope) return false;
    if (scope === 'project' && rule.projectPath !== projectPath) return false;

    // Check if rule has expired
    if (rule.expiresAt && rule.expiresAt < new Date()) return false;

    return true;
  });
}

/**
 * Clears session-scoped rules
 */
export function clearSessionRules(): void {
  const storage = loadPermissions();
  storage.rules = storage.rules.filter(rule => rule.scope !== 'session');
  savePermissions(storage);
}

/**
 * Gets permission settings
 */
export function getPermissionSettings(): PermissionStorage['settings'] {
  const storage = loadPermissions();
  return storage.settings;
}

/**
 * Updates permission settings
 */
export function updatePermissionSettings(settings: Partial<PermissionStorage['settings']>): void {
  const storage = loadPermissions();
  storage.settings = { ...storage.settings, ...settings };
  savePermissions(storage);
}
