/**
 * Permission Indicator Component
 * Shows current trust level and permission status
 */

import React from 'react';
import { Box, Text } from 'ink';
import { TrustLevel, ProjectTrust } from '../../lib/permissions';

interface PermissionIndicatorProps {
  projectTrust?: ProjectTrust | null;
  recentPermissions?: number;
  showDetails?: boolean;
}

export const PermissionIndicator: React.FC<PermissionIndicatorProps> = ({
  projectTrust,
  recentPermissions = 0,
  showDetails = false,
}) => {
  const getTrustEmoji = (trustLevel?: TrustLevel): string => {
    if (!trustLevel) return '❓';

    switch (trustLevel) {
      case TrustLevel.FULL_TRUST:
        return '✅';
      case TrustLevel.PARTIAL_TRUST:
        return '🟡';
      case TrustLevel.READ_ONLY:
        return '👁️';
      case TrustLevel.UNTRUSTED:
        return '🔒';
      default:
        return '❓';
    }
  };

  const getTrustColor = (trustLevel?: TrustLevel): string => {
    if (!trustLevel) return 'gray';

    switch (trustLevel) {
      case TrustLevel.FULL_TRUST:
        return 'green';
      case TrustLevel.PARTIAL_TRUST:
        return 'yellow';
      case TrustLevel.READ_ONLY:
        return 'cyan';
      case TrustLevel.UNTRUSTED:
        return 'red';
      default:
        return 'gray';
    }
  };

  const getTrustLabel = (trustLevel?: TrustLevel): string => {
    if (!trustLevel) return 'Not Set';

    return trustLevel
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!showDetails) {
    // Compact mode - just show icon and label
    return (
      <Box>
        <Text>
          {getTrustEmoji(projectTrust?.trustLevel)}
        </Text>
        <Text color={getTrustColor(projectTrust?.trustLevel) as any}>
          {getTrustLabel(projectTrust?.trustLevel)}
        </Text>
        {recentPermissions > 0 && (
          <Text dimColor> ({recentPermissions} recent)</Text>
        )}
      </Box>
    );
  }

  // Detailed mode
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      <Box marginBottom={1}>
        <Text bold>Permission Status</Text>
      </Box>

      <Box>
        <Text>Trust Level: </Text>
        <Text color={getTrustColor(projectTrust?.trustLevel) as any}>
          {getTrustEmoji(projectTrust?.trustLevel)} {getTrustLabel(projectTrust?.trustLevel)}
        </Text>
      </Box>

      {projectTrust?.setAt && (
        <Box marginTop={1}>
          <Text dimColor>
            Set {new Date(projectTrust.setAt).toLocaleDateString()} by {projectTrust.setBy}
          </Text>
        </Box>
      )}

      {projectTrust?.notes && (
        <Box marginTop={1}>
          <Text dimColor>Note: {projectTrust.notes}</Text>
        </Box>
      )}

      {recentPermissions > 0 && (
        <Box marginTop={1}>
          <Text dimColor>
            {recentPermissions} permission{recentPermissions !== 1 ? 's' : ''} granted this session
          </Text>
        </Box>
      )}
    </Box>
  );
};
