/**
 * Compact Status Bar Component
 * Always-visible bottom status bar showing key metrics
 */

import React from 'react';
import { Box, Text } from 'ink';
import { StatusInfo } from '../../lib/status';

interface CompactStatusBarProps {
  status?: StatusInfo;
}

export const CompactStatusBar: React.FC<CompactStatusBarProps> = ({ status }) => {
  if (!status) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Initializing...
        </Text>
      </Box>
    );
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  const getTokenColor = (percentage?: number): string => {
    if (!percentage) return 'white';
    if (percentage >= 90) return 'red';
    if (percentage >= 70) return 'yellow';
    return 'green';
  };

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      {/* Provider indicator */}
      <Text color="cyan">⚡ </Text>
      <Text dimColor>{status.provider}</Text>

      <Text color="gray"> • </Text>

      {/* Token usage */}
      <Text color={getTokenColor(status.tokenUsage.percentageUsed) as any}>
        ↓ {formatTokens(status.tokenUsage.totalTokens)}
      </Text>
      {status.tokenUsage.limit && (
        <Text color="gray"> / {formatTokens(status.tokenUsage.limit)}</Text>
      )}

      {/* Cost (if applicable) */}
      {status.costEstimate && status.costEstimate.totalCost > 0 && (
        <>
          <Text color="gray"> • </Text>
          <Text color="yellow">
            ${status.costEstimate.totalCost < 0.01 ? '<0.01' : status.costEstimate.totalCost.toFixed(2)}
          </Text>
        </>
      )}

      <Text color="gray"> • </Text>

      {/* Session duration */}
      <Text>{formatDuration(status.sessionDurationMs)}</Text>

      {/* Cache hit rate (if available) */}
      {status.performance.cacheHitRate > 0 && (
        <>
          <Text color="gray"> • </Text>
          <Text color="green">⚡ {status.performance.cacheHitRate.toFixed(0)}%</Text>
        </>
      )}

      {/* Current operation */}
      {status.operation && (
        <>
          <Text color="gray"> • </Text>
          <Text color="yellow">
            {status.operation.currentOperation} ({formatDuration(status.operation.elapsedMs)})
          </Text>
        </>
      )}

      {/* Help hint */}
      <Text color="gray" dimColor>
        {' '}
        • Ctrl+S for details
      </Text>
    </Box>
  );
};
