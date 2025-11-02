/**
 * Permission Validator
 * Determines if operations are allowed and calculates risk levels
 */

import path from 'path';
import {
  OperationType,
  RiskLevel,
  PermissionRequest,
  PermissionValidationResult,
  PermissionResponse,
  TrustLevel,
} from './PermissionTypes';
import {
  getRulesForScope,
  getProjectTrust,
  getPermissionSettings,
} from './PermissionStorage';

/**
 * Calculates risk level for an operation
 */
export function calculateRiskLevel(request: PermissionRequest): RiskLevel {
  const { operationType, details } = request;

  switch (operationType) {
    case OperationType.FILE_READ:
    case OperationType.SYSTEM_INFO:
      return RiskLevel.SAFE;

    case OperationType.FILE_WRITE:
      // Check if writing to sensitive files
      if (details.filePath) {
        const fileName = path.basename(details.filePath);
        const sensitivePatterns = [
          /\.env/i,
          /credentials/i,
          /secrets/i,
          /password/i,
          /token/i,
          /config\.json$/i,
        ];

        if (sensitivePatterns.some(pattern => pattern.test(fileName))) {
          return RiskLevel.HIGH;
        }
      }
      return RiskLevel.LOW;

    case OperationType.FILE_DELETE:
      return RiskLevel.HIGH;

    case OperationType.COMMAND_EXEC:
      // Analyze command for risk
      if (details.command) {
        const cmd = details.command.toLowerCase();
        const dangerousCommands = [
          'rm -rf',
          'sudo',
          'chmod',
          'curl',
          'wget',
          'dd',
          'mkfs',
          'format',
        ];

        if (dangerousCommands.some(dangerous => cmd.includes(dangerous))) {
          return RiskLevel.CRITICAL;
        }
      }
      return RiskLevel.MEDIUM;

    case OperationType.INSTALL_PACKAGE:
      return RiskLevel.MEDIUM;

    case OperationType.GIT_OPERATION:
      // Git push/force push are higher risk
      if (details.command?.includes('push --force')) {
        return RiskLevel.HIGH;
      }
      return RiskLevel.LOW;

    case OperationType.NETWORK_REQUEST:
      // Unknown hosts are critical risk
      if (details.url) {
        const trustedDomains = [
          'github.com',
          'npmjs.com',
          'anthropic.com',
          'openai.com',
          'localhost',
        ];

        const url = new URL(details.url);
        if (!trustedDomains.some(domain => url.hostname.includes(domain))) {
          return RiskLevel.CRITICAL;
        }
      }
      return RiskLevel.MEDIUM;

    case OperationType.ENV_ACCESS:
      return RiskLevel.CRITICAL;

    default:
      return RiskLevel.MEDIUM;
  }
}

/**
 * Checks if a request matches a permission rule
 */
function matchesRule(
  request: PermissionRequest,
  rule: any // PermissionRule from storage
): boolean {
  // Type must match
  if (rule.operationType !== request.operationType) {
    return false;
  }

  // Check pattern matching if specified
  if (rule.pattern) {
    const regex = new RegExp(rule.pattern);
    const testString =
      request.details.command ||
      request.details.filePath ||
      request.details.packageName ||
      request.details.url ||
      '';

    if (!regex.test(testString)) {
      return false;
    }
  }

  // Check allowed values if specified
  if (rule.allowedValues) {
    const value =
      request.details.command ||
      request.details.filePath ||
      request.details.packageName ||
      request.details.url;

    if (!rule.allowedValues.includes(value)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates a permission request
 */
export function validatePermission(request: PermissionRequest): PermissionValidationResult {
  const settings = getPermissionSettings();
  const projectTrust = getProjectTrust(request.projectPath);
  const trustLevel = projectTrust?.trustLevel || settings.defaultTrustLevel;

  // Calculate risk level
  request.riskLevel = calculateRiskLevel(request);

  // Check for matching rules (session, project, global)
  const sessionRules = getRulesForScope('session');
  const projectRules = getRulesForScope('project', request.projectPath);
  const globalRules = getRulesForScope('global');

  const allRules = [...sessionRules, ...projectRules, ...globalRules];
  const matchingRule = allRules.find(rule => matchesRule(request, rule));

  // If there's a matching rule, allow without prompting
  if (matchingRule) {
    return {
      allowed: true,
      requiresPrompt: false,
      matchingRule,
      reason: `Allowed by ${matchingRule.scope} rule`,
    };
  }

  // Apply trust level logic
  switch (trustLevel) {
    case TrustLevel.FULL_TRUST:
      // Only prompt for critical operations
      if (request.riskLevel === RiskLevel.CRITICAL) {
        return {
          allowed: false,
          requiresPrompt: true,
          reason: 'Critical operation requires confirmation even in fully trusted projects',
          suggestedResponse: PermissionResponse.ALLOW_SESSION,
        };
      }
      return {
        allowed: true,
        requiresPrompt: false,
        reason: 'Allowed by full trust level',
      };

    case TrustLevel.PARTIAL_TRUST:
      // Prompt for medium risk and above
      if (request.riskLevel === RiskLevel.SAFE || request.riskLevel === RiskLevel.LOW) {
        return {
          allowed: true,
          requiresPrompt: false,
          reason: 'Low-risk operation in partially trusted project',
        };
      }
      return {
        allowed: false,
        requiresPrompt: true,
        reason: 'Medium/high risk operation requires confirmation',
        suggestedResponse: PermissionResponse.ALLOW_SESSION,
      };

    case TrustLevel.READ_ONLY:
      // Only allow read operations
      if (request.operationType === OperationType.FILE_READ ||
          request.operationType === OperationType.SYSTEM_INFO) {
        return {
          allowed: true,
          requiresPrompt: false,
          reason: 'Read operation allowed in read-only mode',
        };
      }
      return {
        allowed: false,
        requiresPrompt: true,
        reason: 'Write operations blocked in read-only mode',
        suggestedResponse: PermissionResponse.DENY,
      };

    case TrustLevel.UNTRUSTED:
      // Prompt for everything except safe reads
      if (request.riskLevel === RiskLevel.SAFE) {
        return {
          allowed: true,
          requiresPrompt: false,
          reason: 'Safe operation',
        };
      }
      return {
        allowed: false,
        requiresPrompt: true,
        reason: 'Untrusted project requires confirmation for all operations',
        suggestedResponse: PermissionResponse.ALLOW_ONCE,
      };

    default:
      return {
        allowed: false,
        requiresPrompt: true,
        reason: 'Unknown trust level',
      };
  }
}

/**
 * Gets a human-readable description for a permission request
 */
export function getRequestDescription(request: PermissionRequest): string {
  const { operationType, details } = request;

  switch (operationType) {
    case OperationType.FILE_READ:
      return `Read file: ${details.filePath}`;

    case OperationType.FILE_WRITE:
      return `Write to file: ${details.filePath}`;

    case OperationType.FILE_DELETE:
      return `Delete file: ${details.filePath}`;

    case OperationType.COMMAND_EXEC:
      return `Execute command: ${details.command}`;

    case OperationType.INSTALL_PACKAGE:
      return `Install package: ${details.packageName}`;

    case OperationType.GIT_OPERATION:
      return `Git operation: ${details.command}`;

    case OperationType.NETWORK_REQUEST:
      return `Network request to: ${details.url}`;

    case OperationType.ENV_ACCESS:
      return `Access environment variable: ${details.varName}`;

    case OperationType.SYSTEM_INFO:
      return `Access system information`;

    default:
      return `Unknown operation: ${operationType}`;
  }
}

/**
 * Gets risk level emoji/color indicator
 */
export function getRiskIndicator(riskLevel: RiskLevel): { emoji: string; color: string } {
  switch (riskLevel) {
    case RiskLevel.SAFE:
      return { emoji: '✅', color: 'green' };
    case RiskLevel.LOW:
      return { emoji: '🟢', color: 'green' };
    case RiskLevel.MEDIUM:
      return { emoji: '🟡', color: 'yellow' };
    case RiskLevel.HIGH:
      return { emoji: '🟠', color: 'orange' };
    case RiskLevel.CRITICAL:
      return { emoji: '🔴', color: 'red' };
    default:
      return { emoji: '❓', color: 'gray' };
  }
}
