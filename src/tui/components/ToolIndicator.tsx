/**
 * Tool Indicator Component
 * Compact inline indicator for current tool usage
 */

import React from 'react';
import { Box, Text } from 'ink';

interface ToolIndicatorProps {
  toolName: string;
  status: 'running' | 'success' | 'failed';
  durationMs?: number;
}

export const ToolIndicator: React.FC<ToolIndicatorProps> = ({
  toolName,
  status,
  durationMs,
}) => {
  const getIcon = (): string => {
    switch (status) {
      case 'running':
        return '🔄';
      case 'success':
        return '✓';
      case 'failed':
        return '✗';
    }
  };

  const getColor = (): string => {
    switch (status) {
      case 'running':
        return 'cyan';
      case 'success':
        return 'green';
      case 'failed':
        return 'red';
    }
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return '';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Box>
      <Text color={getColor() as any}>
        {getIcon()} {toolName}
      </Text>
      {durationMs !== undefined && (
        <Text color="gray"> ({formatDuration(durationMs)})</Text>
      )}
    </Box>
  );
};
