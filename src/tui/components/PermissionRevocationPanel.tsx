/**
 * Permission Revocation Panel
 * Manage and revoke granted permissions
 */

import React from 'react';
import { Box, Text } from 'ink';
import {
  PermissionTemplate,
  PermissionScope,
  PermissionLevel,
  PermissionRule,
} from '../../lib/permissions/PermissionTemplates';

interface GrantedPermission {
  id: string;
  scope: PermissionScope;
  level: PermissionLevel;
  grantedAt: Date;
  grantedBy: 'user' | 'template' | 'default';
  templateId?: string;
  usageCount: number;
  lastUsed?: Date;
}

interface PermissionRevocationPanelProps {
  grantedPermissions: GrantedPermission[];
  templates?: PermissionTemplate[];
  onRevokePermission?: (id: string) => void;
  onRevokeAll?: () => void;
  onApplyTemplate?: (templateId: string) => void;
  onClose?: () => void;
}

export const PermissionRevocationPanel: React.FC<PermissionRevocationPanelProps> = ({
  grantedPermissions,
  templates = [],
  onRevokePermission,
  onRevokeAll,
  onApplyTemplate,
  onClose,
}) => {
  const getLevelColor = (level: PermissionLevel): string => {
    switch (level) {
      case PermissionLevel.ALLOW:
        return 'green';
      case PermissionLevel.ASK:
        return 'yellow';
      case PermissionLevel.DENY:
        return 'red';
      case PermissionLevel.NONE:
        return 'gray';
      default:
        return 'white';
    }
  };

  const getScopeIcon = (scope: PermissionScope): string => {
    if (scope === PermissionScope.ALL) return '🌐';
    if (scope.startsWith('file:')) return '📁';
    if (scope.startsWith('bash:')) return '⚙️';
    if (scope.startsWith('network:')) return '🌐';
    if (scope.startsWith('agent:')) return '🤖';
    if (scope.startsWith('context:')) return '📝';
    if (scope.startsWith('knowledge:')) return '🧠';
    return '🔧';
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Group permissions by scope category
  const groupedPermissions = new Map<string, GrantedPermission[]>();
  for (const perm of grantedPermissions) {
    const category = perm.scope.split(':')[0] || 'other';
    const existing = groupedPermissions.get(category) || [];
    existing.push(perm);
    groupedPermissions.set(category, existing);
  }

  // Count permissions by level
  const byLevel = new Map<PermissionLevel, number>();
  for (const perm of grantedPermissions) {
    byLevel.set(perm.level, (byLevel.get(perm.level) || 0) + 1);
  }

  // Find high-risk permissions
  const highRisk = grantedPermissions.filter(
    p => p.level === PermissionLevel.ALLOW &&
      (p.scope === PermissionScope.ALL ||
       p.scope === PermissionScope.FILE_DELETE ||
       p.scope === PermissionScope.BASH_EXEC)
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      paddingX={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="red">
          🔐 Permission Management
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          Ctrl+Shift+R
        </Text>
      </Box>

      {/* Statistics */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">
          📊 Overview:
        </Text>
        <Box paddingLeft={2}>
          <Text color="cyan">Total Permissions: {grantedPermissions.length}</Text>
        </Box>
        <Box paddingLeft={2} flexDirection="column">
          {Array.from(byLevel.entries()).map(([level, count]) => (
            <Box key={level}>
              <Text color={getLevelColor(level)}>
                {level}: {count}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* High-Risk Permissions Warning */}
      {highRisk.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="red">
            ⚠️  High-Risk Permissions:
          </Text>
          <Box paddingLeft={2} flexDirection="column">
            <Text color="red">
              {highRisk.length} permission(s) have full access
            </Text>
            {highRisk.map(perm => (
              <Box key={perm.id} paddingLeft={2}>
                <Text color="yellow">
                  • {getScopeIcon(perm.scope)} {perm.scope}
                </Text>
                <Text color="gray" dimColor>
                  {' '}granted {formatDate(perm.grantedAt)}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Grouped Permissions */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">
          📋 Granted Permissions:
        </Text>

        {Array.from(groupedPermissions.entries()).map(([category, perms]) => (
          <Box key={category} flexDirection="column" marginTop={1} paddingLeft={2}>
            <Text bold color="cyan">
              {category.toUpperCase()} ({perms.length})
            </Text>

            {perms.map(perm => (
              <Box
                key={perm.id}
                flexDirection="column"
                paddingLeft={2}
                marginTop={1}
                borderStyle="single"
                borderColor={getLevelColor(perm.level)}
                paddingX={1}
              >
                <Box>
                  <Text color="white">
                    {getScopeIcon(perm.scope)} {perm.scope}
                  </Text>
                </Box>

                <Box paddingLeft={2} flexDirection="column">
                  <Box>
                    <Text color="white">Level: </Text>
                    <Text color={getLevelColor(perm.level)}>
                      {perm.level}
                    </Text>
                  </Box>

                  <Box>
                    <Text color="white">Granted: </Text>
                    <Text color="gray">{formatDate(perm.grantedAt)}</Text>
                    <Text color="gray"> by {perm.grantedBy}</Text>
                  </Box>

                  {perm.templateId && (
                    <Box>
                      <Text color="white">Template: </Text>
                      <Text color="magenta">{perm.templateId}</Text>
                    </Box>
                  )}

                  <Box>
                    <Text color="white">Usage: </Text>
                    <Text color="cyan">{perm.usageCount} times</Text>
                    {perm.lastUsed && (
                      <Text color="gray"> (last: {formatDate(perm.lastUsed)})</Text>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        ))}

        {grantedPermissions.length === 0 && (
          <Box paddingLeft={2} marginTop={1}>
            <Text color="gray" dimColor>
              No permissions granted. All actions will require explicit approval.
            </Text>
          </Box>
        )}
      </Box>

      {/* Quick Actions */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">
          ⚡ Quick Actions:
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text color="yellow">• Revoke All - Remove all granted permissions</Text>
          <Text color="green">• Apply Template - Use a permission template</Text>
          <Text color="cyan">• Revoke by Scope - Remove specific permission types</Text>
        </Box>
      </Box>

      {/* Available Templates */}
      {templates.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            📝 Available Templates:
          </Text>

          {templates.slice(0, 5).map(template => (
            <Box key={template.id} paddingLeft={2}>
              <Text color="white">
                {template.icon || '•'} {template.name}
              </Text>
              <Text color="gray" dimColor>
                {' '}({template.rules.length} rules)
              </Text>
            </Box>
          ))}

          {templates.length > 5 && (
            <Box paddingLeft={2}>
              <Text color="gray" dimColor>
                ... and {templates.length - 5} more templates
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Review and manage all granted permissions. Revoke permissions to increase security.
        </Text>
      </Box>
    </Box>
  );
};
