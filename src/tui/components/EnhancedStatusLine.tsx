/**
 * Enhanced Status Line Component
 * Shows session status, tokens, costs, performance, and current operation
 */

import React from 'react';
import { Box, Text } from 'ink';
import { StatusInfo } from '../../lib/status';

interface EnhancedStatusLineProps {
  status: StatusInfo;
  compact?: boolean;
}

export const EnhancedStatusLine: React.FC<EnhancedStatusLineProps> = ({
  status,
  compact = false,
}) => {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
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

  const formatCost = (cost: number): string => {
    if (cost < 0.01) {
      return '<$0.01';
    }
    return `$${cost.toFixed(2)}`;
  };

  const getTokenColor = (percentage?: number): string => {
    if (!percentage) return 'gray';
    if (percentage >= 90) return 'red';
    if (percentage >= 70) return 'yellow';
    return 'green';
  };

  if (compact) {
    // Compact single-line status
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="cyan">⚡</Text>
        <Text> {status.provider}/{status.model}</Text>
        <Text color="gray"> • </Text>
        <Text color={getTokenColor(status.tokenUsage.percentageUsed) as any}>
          {formatTokens(status.tokenUsage.totalTokens)}
          {status.tokenUsage.limit && ` / ${formatTokens(status.tokenUsage.limit)}`}
        </Text>
        {status.costEstimate && status.costEstimate.totalCost > 0 && (
          <>
            <Text color="gray"> • </Text>
            <Text color="yellow">{formatCost(status.costEstimate.totalCost)}</Text>
          </>
        )}
        <Text color="gray"> • </Text>
        <Text>{formatDuration(status.sessionDurationMs)}</Text>
        {status.operation && (
          <>
            <Text color="gray"> • </Text>
            <Text color="yellow">⟳ {status.operation.currentOperation}</Text>
          </>
        )}
      </Box>
    );
  }

  // Full detailed status
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      padding={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📊 Session Status
        </Text>
        <Text color="gray"> - Press Ctrl+S to toggle</Text>
      </Box>

      {/* Provider & Model */}
      <Box marginBottom={1}>
        <Text color="gray">Provider: </Text>
        <Text bold>
          {status.provider} / {status.model}
        </Text>
      </Box>

      {/* Token Usage */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">
          🎯 Token Usage
        </Text>
        <Box paddingLeft={2}>
          <Text>Input: </Text>
          <Text color="green">{formatTokens(status.tokenUsage.inputTokens)}</Text>
          <Text color="gray"> • </Text>
          <Text>Output: </Text>
          <Text color="blue">{formatTokens(status.tokenUsage.outputTokens)}</Text>
          <Text color="gray"> • </Text>
          <Text>Total: </Text>
          <Text color={getTokenColor(status.tokenUsage.percentageUsed) as any}>
            {formatTokens(status.tokenUsage.totalTokens)}
          </Text>
          {status.tokenUsage.limit && (
            <>
              <Text color="gray"> / {formatTokens(status.tokenUsage.limit)}</Text>
              <Text color="gray">
                {' '}
                ({status.tokenUsage.percentageUsed?.toFixed(1)}%)
              </Text>
            </>
          )}
        </Box>
      </Box>

      {/* Cost Estimate */}
      {status.costEstimate && status.costEstimate.totalCost > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">
            💰 Cost Estimate
          </Text>
          <Box paddingLeft={2}>
            <Text>Input: </Text>
            <Text color="green">{formatCost(status.costEstimate.inputCost)}</Text>
            <Text color="gray"> • </Text>
            <Text>Output: </Text>
            <Text color="blue">{formatCost(status.costEstimate.outputCost)}</Text>
            <Text color="gray"> • </Text>
            <Text>Total: </Text>
            <Text bold color="yellow">
              {formatCost(status.costEstimate.totalCost)}
            </Text>
          </Box>
        </Box>
      )}

      {/* Performance */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="magenta">
          ⚡ Performance
        </Text>
        <Box paddingLeft={2}>
          <Text>Requests: </Text>
          <Text>
            {status.performance.successfulRequests} ✓ / {status.performance.failedRequests} ✗
          </Text>
          {status.performance.averageResponseTimeMs > 0 && (
            <>
              <Text color="gray"> • </Text>
              <Text>Avg: {(status.performance.averageResponseTimeMs / 1000).toFixed(1)}s</Text>
            </>
          )}
        </Box>
        {status.performance.cacheHitRate > 0 && (
          <Box paddingLeft={2}>
            <Text>Cache: </Text>
            <Text color="green">{status.performance.cacheHitRate.toFixed(0)}%</Text>
            <Text color="gray">
              {' '}
              ({status.performance.cacheHits} hits / {status.performance.cacheMisses} misses)
            </Text>
          </Box>
        )}
      </Box>

      {/* Session Duration */}
      <Box>
        <Text color="gray">Session: </Text>
        <Text>{formatDuration(status.sessionDurationMs)}</Text>
      </Box>

      {/* Current Operation */}
      {status.operation && (
        <Box marginTop={1} borderStyle="round" borderColor="yellow" padding={1}>
          <Box flexDirection="column">
            <Box>
              <Text color="yellow">✳ {status.operation.currentOperation}…</Text>
              {status.operation.canInterrupt && (
                <Text color="gray" dimColor>
                  {' '}
                  (esc to interrupt)
                </Text>
              )}
            </Box>
            {status.operation.nextOperation && (
              <Box paddingLeft={2}>
                <Text color="gray">⎿ Next: {status.operation.nextOperation}</Text>
              </Box>
            )}
            <Box paddingLeft={2}>
              <Text color="gray">
                {formatDuration(status.operation.elapsedMs)} elapsed
              </Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
