/**
 * Permission Types for Selek
 * Defines all permission-related types and enums for the smart permission system
 */

/**
 * Types of operations that require permissions
 */
export enum OperationType {
  FILE_READ = 'file_read',
  FILE_WRITE = 'file_write',
  FILE_DELETE = 'file_delete',
  COMMAND_EXEC = 'command_exec',
  NETWORK_REQUEST = 'network_request',
  INSTALL_PACKAGE = 'install_package',
  GIT_OPERATION = 'git_operation',
  ENV_ACCESS = 'env_access',
  SYSTEM_INFO = 'system_info',
}

/**
 * Risk levels for operations
 */
export enum RiskLevel {
  SAFE = 'safe',           // Read operations, info queries
  LOW = 'low',             // Non-destructive writes
  MEDIUM = 'medium',       // Package installs, git commits
  HIGH = 'high',           // File deletions, system commands
  CRITICAL = 'critical',   // Env var access, network requests to unknown hosts
}

/**
 * Permission responses from user
 */
export enum PermissionResponse {
  ALLOW_ONCE = 'allow_once',
  ALLOW_SESSION = 'allow_session',
  ALLOW_PROJECT = 'allow_project',
  DENY = 'deny',
  EDIT = 'edit',
}

/**
 * Trust levels for projects
 */
export enum TrustLevel {
  FULL_TRUST = 'full_trust',       // Own projects, minimal prompts
  PARTIAL_TRUST = 'partial_trust', // Confirm dangerous ops only
  READ_ONLY = 'read_only',         // No modifications allowed
  UNTRUSTED = 'untrusted',         // Prompt for everything
}

/**
 * A permission request from an agent/tool
 */
export interface PermissionRequest {
  id: string;
  operationType: OperationType;
  riskLevel: RiskLevel;
  description: string;
  details: {
    command?: string;
    filePath?: string;
    packageName?: string;
    url?: string;
    args?: string[];
    [key: string]: any;
  };
  requestedBy: string; // Agent/tool name
  timestamp: Date;
  projectPath: string;
}

/**
 * A permission decision made by the user
 */
export interface PermissionDecision {
  requestId: string;
  response: PermissionResponse;
  timestamp: Date;
  editedCommand?: string;
}

/**
 * A permission rule stored in ~/.selek/permissions.json
 */
export interface PermissionRule {
  id: string;
  operationType: OperationType;
  pattern?: string; // Regex pattern for matching operations
  scope: 'session' | 'project' | 'global';
  projectPath?: string;
  allowedValues?: string[]; // Specific allowed values (e.g., specific commands)
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string; // Which agent/tool created this rule
}

/**
 * Project trust configuration
 */
export interface ProjectTrust {
  projectPath: string;
  trustLevel: TrustLevel;
  setAt: Date;
  setBy: string; // User identifier
  notes?: string;
}

/**
 * Permission history entry
 */
export interface PermissionHistoryEntry {
  id: string;
  request: PermissionRequest;
  decision: PermissionDecision;
  outcome: 'executed' | 'blocked' | 'failed';
  error?: string;
}

/**
 * Persistent permission storage structure
 */
export interface PermissionStorage {
  version: string;
  rules: PermissionRule[];
  trustedProjects: ProjectTrust[];
  history: PermissionHistoryEntry[];
  settings: {
    defaultTrustLevel: TrustLevel;
    autoTrustOwnProjects: boolean;
    historyRetentionDays: number;
    requireConfirmForHighRisk: boolean;
  };
}

/**
 * Permission validation result
 */
export interface PermissionValidationResult {
  allowed: boolean;
  requiresPrompt: boolean;
  matchingRule?: PermissionRule;
  reason: string;
  suggestedResponse?: PermissionResponse;
}
