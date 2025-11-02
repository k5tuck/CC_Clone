/**
 * Tool Call Display Component
 * Shows individual tool calls with parameters and results
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { ToolExecutionEvent, ToolExecutionStatus } from '../../lib/tool-tracking';

interface ToolCallDisplayProps {
  event: ToolExecutionEvent;
  collapsed?: boolean;
  onToggle?: () => void;
}

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({
  event,
  collapsed = false,
  onToggle,
}) => {
  const getStatusIcon = (status: ToolExecutionStatus): string => {
    switch (status) {
      case ToolExecutionStatus.RUNNING:
        return '🔄';
      case ToolExecutionStatus.SUCCESS:
        return '✓';
      case ToolExecutionStatus.FAILED:
        return '✗';
      case ToolExecutionStatus.CANCELLED:
        return '⊗';
      default:
        return '○';
    }
  };

  const getStatusColor = (status: ToolExecutionStatus): string => {
    switch (status) {
      case ToolExecutionStatus.RUNNING:
        return 'cyan';
      case ToolExecutionStatus.SUCCESS:
        return 'green';
      case ToolExecutionStatus.FAILED:
        return 'red';
      case ToolExecutionStatus.CANCELLED:
        return 'gray';
      default:
        return 'white';
    }
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return '...';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatParameterValue = (value: any): string => {
    if (typeof value === 'string') {
      return value.length > 50 ? `${value.substring(0, 50)}...` : value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value).length > 50
        ? `${JSON.stringify(value).substring(0, 50)}...`
        : JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Header line */}
      <Box>
        <Text color="cyan">🔧 Tool: </Text>
        <Text bold>{event.toolName}</Text>
        {event.calledBy && (
          <>
            <Text color="gray"> by </Text>
            <Text color="cyan">{event.calledBy}</Text>
          </>
        )}
      </Box>

      {/* Status and timing */}
      <Box paddingLeft={2}>
        <Text color={getStatusColor(event.status) as any}>
          └─ {getStatusIcon(event.status)}{' '}
          {event.status === ToolExecutionStatus.RUNNING ? 'Running' : event.status}
        </Text>
        <Text color="gray"> ({formatDuration(event.durationMs)})</Text>
      </Box>

      {/* Parameters (if not collapsed) */}
      {!collapsed && Object.keys(event.parameters).length > 0 && (
        <Box flexDirection="column" paddingLeft={4}>
          {Object.entries(event.parameters).map(([key, value]) => (
            <Box key={key}>
              <Text color="gray">├─ {key}: </Text>
              <Text>{formatParameterValue(value)}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Error message */}
      {event.error && !collapsed && (
        <Box paddingLeft={4}>
          <Text color="red">└─ Error: {event.error}</Text>
        </Box>
      )}

      {/* Result preview (for successful calls) */}
      {event.status === ToolExecutionStatus.SUCCESS && event.result && !collapsed && (
        <Box paddingLeft={4}>
          <Text color="green">
            └─ Result: {formatParameterValue(event.result)}
          </Text>
        </Box>
      )}
    </Box>
  );
};
