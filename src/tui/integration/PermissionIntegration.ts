/**
 * Permission System Integration
 * Integrates the permission system with the TUI
 */

import { PermissionManager, PermissionRequest, PermissionDecision } from '../../lib/permissions';

/**
 * Permission state for TUI
 */
export interface PermissionState {
  permissionManager: PermissionManager | null;
  pendingPermissionRequest: PermissionRequest | null;
  showPermissionPrompt: boolean;
  recentPermissions: number;
}

/**
 * Initialize permission manager
 */
export function initializePermissionManager(projectPath: string): PermissionManager {
  const manager = new PermissionManager(projectPath);
  return manager;
}

/**
 * Create permission request handler that updates TUI state
 */
export function createPermissionRequestHandler(
  setState: (updater: (prev: any) => any) => void
): (request: PermissionRequest) => Promise<PermissionDecision> {
  return (request: PermissionRequest): Promise<PermissionDecision> => {
    return new Promise((resolve) => {
      // Show the permission prompt and store the resolve function
      setState((prev: any) => ({
        ...prev,
        pendingPermissionRequest: request,
        showPermissionPrompt: true,
        permissionResolver: resolve,
      }));
    });
  };
}

/**
 * Handle permission decision from user
 */
export function handlePermissionDecision(
  decision: PermissionDecision,
  setState: (updater: (prev: any) => any) => void,
  resolver: ((decision: PermissionDecision) => void) | undefined
): void {
  // Hide the prompt
  setState((prev: any) => ({
    ...prev,
    pendingPermissionRequest: null,
    showPermissionPrompt: false,
    permissionResolver: undefined,
    recentPermissions: prev.recentPermissions + 1,
  }));

  // Resolve the promise with the decision
  if (resolver) {
    resolver(decision);
  }
}

/**
 * Get current project path
 */
export function getCurrentProjectPath(): string {
  return process.cwd();
}
