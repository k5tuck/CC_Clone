/**
 * Permission Manager
 * Main interface for the permission system
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PermissionRequest,
  PermissionDecision,
  PermissionResponse,
  PermissionValidationResult,
  PermissionRule,
  ProjectTrust,
  PermissionHistoryEntry,
  OperationType,
  TrustLevel,
} from './PermissionTypes';
import {
  addPermissionRule,
  removePermissionRule,
  setProjectTrust,
  getProjectTrust,
  addHistoryEntry,
  getProjectHistory,
  clearSessionRules,
} from './PermissionStorage';
import {
  validatePermission,
  calculateRiskLevel,
  getRequestDescription,
  getRiskIndicator,
} from './PermissionValidator';

/**
 * Session-scoped permission rules (cleared on app restart)
 */
let sessionRules: PermissionRule[] = [];

/**
 * Permission Manager Class
 */
export class PermissionManager {
  private projectPath: string;
  private onPermissionRequest?: (request: PermissionRequest) => Promise<PermissionDecision>;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Sets the callback for handling permission requests that require user input
   */
  setPermissionRequestHandler(
    handler: (request: PermissionRequest) => Promise<PermissionDecision>
  ): void {
    this.onPermissionRequest = handler;
  }

  /**
   * Requests permission for an operation
   * Returns true if allowed, false if denied
   */
  async requestPermission(
    operationType: OperationType,
    details: PermissionRequest['details'],
    requestedBy: string
  ): Promise<boolean> {
    // Create permission request
    const request: PermissionRequest = {
      id: uuidv4(),
      operationType,
      riskLevel: calculateRiskLevel({
        id: '',
        operationType,
        riskLevel: 'safe' as any,
        description: '',
        details,
        requestedBy,
        timestamp: new Date(),
        projectPath: this.projectPath,
      }),
      description: getRequestDescription({
        id: '',
        operationType,
        riskLevel: 'safe' as any,
        description: '',
        details,
        requestedBy,
        timestamp: new Date(),
        projectPath: this.projectPath,
      }),
      details,
      requestedBy,
      timestamp: new Date(),
      projectPath: this.projectPath,
    };

    // Validate permission
    const validation = validatePermission(request);

    // If allowed without prompt, record and return
    if (validation.allowed && !validation.requiresPrompt) {
      this.recordHistory(request, {
        requestId: request.id,
        response: PermissionResponse.ALLOW_ONCE,
        timestamp: new Date(),
      }, 'executed');
      return true;
    }

    // If denied and no prompt needed, record and return
    if (!validation.requiresPrompt) {
      this.recordHistory(request, {
        requestId: request.id,
        response: PermissionResponse.DENY,
        timestamp: new Date(),
      }, 'blocked');
      return false;
    }

    // Prompt user for decision
    if (!this.onPermissionRequest) {
      console.warn('No permission request handler set, denying operation');
      return false;
    }

    try {
      const decision = await this.onPermissionRequest(request);

      // Handle decision
      const allowed = await this.handlePermissionDecision(request, decision);

      // Record history
      this.recordHistory(
        request,
        decision,
        allowed ? 'executed' : 'blocked'
      );

      return allowed;
    } catch (error) {
      console.error('Error handling permission request:', error);
      this.recordHistory(request, {
        requestId: request.id,
        response: PermissionResponse.DENY,
        timestamp: new Date(),
      }, 'failed', String(error));
      return false;
    }
  }

  /**
   * Handles a permission decision from the user
   */
  private async handlePermissionDecision(
    request: PermissionRequest,
    decision: PermissionDecision
  ): Promise<boolean> {
    switch (decision.response) {
      case PermissionResponse.ALLOW_ONCE:
        return true;

      case PermissionResponse.ALLOW_SESSION:
        // Create session-scoped rule
        this.addSessionRule(request);
        return true;

      case PermissionResponse.ALLOW_PROJECT:
        // Create project-scoped rule
        this.addProjectRule(request);
        return true;

      case PermissionResponse.DENY:
        return false;

      case PermissionResponse.EDIT:
        // If user edited the command, update the request
        if (decision.editedCommand) {
          request.details.command = decision.editedCommand;
          request.description = getRequestDescription(request);
        }
        // Re-validate and allow
        return true;

      default:
        return false;
    }
  }

  /**
   * Adds a session-scoped permission rule
   */
  private addSessionRule(request: PermissionRequest): void {
    const rule: PermissionRule = {
      id: uuidv4(),
      operationType: request.operationType,
      scope: 'session',
      createdAt: new Date(),
      createdBy: request.requestedBy,
    };

    // Add pattern matching for specific operations
    if (request.details.command) {
      rule.pattern = `^${this.escapeRegex(request.details.command)}$`;
    } else if (request.details.filePath) {
      rule.pattern = `^${this.escapeRegex(request.details.filePath)}$`;
    } else if (request.details.packageName) {
      rule.pattern = `^${this.escapeRegex(request.details.packageName)}$`;
    }

    sessionRules.push(rule);
    addPermissionRule(rule);
  }

  /**
   * Adds a project-scoped permission rule
   */
  private addProjectRule(request: PermissionRequest): void {
    const rule: PermissionRule = {
      id: uuidv4(),
      operationType: request.operationType,
      scope: 'project',
      projectPath: this.projectPath,
      createdAt: new Date(),
      createdBy: request.requestedBy,
    };

    // Add pattern matching for specific operations
    if (request.details.command) {
      rule.pattern = `^${this.escapeRegex(request.details.command)}$`;
    } else if (request.details.filePath) {
      rule.pattern = `^${this.escapeRegex(request.details.filePath)}$`;
    } else if (request.details.packageName) {
      rule.pattern = `^${this.escapeRegex(request.details.packageName)}$`;
    }

    addPermissionRule(rule);
  }

  /**
   * Escapes regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Records a permission history entry
   */
  private recordHistory(
    request: PermissionRequest,
    decision: PermissionDecision,
    outcome: 'executed' | 'blocked' | 'failed',
    error?: string
  ): void {
    const entry: PermissionHistoryEntry = {
      id: uuidv4(),
      request,
      decision,
      outcome,
      error,
    };

    addHistoryEntry(entry);
  }

  /**
   * Sets trust level for current project
   */
  setTrustLevel(trustLevel: TrustLevel, notes?: string): void {
    const trust: ProjectTrust = {
      projectPath: this.projectPath,
      trustLevel,
      setAt: new Date(),
      setBy: 'user',
      notes,
    };

    setProjectTrust(trust);
  }

  /**
   * Gets trust level for current project
   */
  getTrustLevel(): TrustLevel | null {
    const trust = getProjectTrust(this.projectPath);
    return trust?.trustLevel || null;
  }

  /**
   * Gets permission history for current project
   */
  getHistory(): PermissionHistoryEntry[] {
    return getProjectHistory(this.projectPath);
  }

  /**
   * Clears session rules (call on app exit)
   */
  static clearSession(): void {
    sessionRules = [];
    clearSessionRules();
  }

  /**
   * Gets current project trust info
   */
  getProjectTrustInfo(): ProjectTrust | null {
    return getProjectTrust(this.projectPath);
  }

  /**
   * Validates a potential operation without executing
   */
  validateOperation(
    operationType: OperationType,
    details: PermissionRequest['details']
  ): PermissionValidationResult {
    const request: PermissionRequest = {
      id: uuidv4(),
      operationType,
      riskLevel: calculateRiskLevel({
        id: '',
        operationType,
        riskLevel: 'safe' as any,
        description: '',
        details,
        requestedBy: 'validator',
        timestamp: new Date(),
        projectPath: this.projectPath,
      }),
      description: getRequestDescription({
        id: '',
        operationType,
        riskLevel: 'safe' as any,
        description: '',
        details,
        requestedBy: 'validator',
        timestamp: new Date(),
        projectPath: this.projectPath,
      }),
      details,
      requestedBy: 'validator',
      timestamp: new Date(),
      projectPath: this.projectPath,
    };

    return validatePermission(request);
  }
}

/**
 * Export utility functions
 */
export { getRiskIndicator, getRequestDescription };
