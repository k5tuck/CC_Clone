/**
 * Error Recovery Panel Component
 * Displays errors with recovery suggestions and actions
 */

import React from 'react';
import { Box, Text } from 'ink';
import {
  ErrorRecoverySystem,
  ErrorOccurrence,
  ErrorSeverity,
  ErrorCategory,
  RecoveryStrategy,
} from '../../lib/errors';

interface ErrorRecoveryPanelProps {
  errorSystem: ErrorRecoverySystem;
  onExecuteStrategy?: (occurrenceId: string, strategyId: string) => void;
  onDismiss?: (occurrenceId: string) => void;
  maxDisplay?: number;
}

export const ErrorRecoveryPanel: React.FC<ErrorRecoveryPanelProps> = ({
  errorSystem,
  onExecuteStrategy,
  onDismiss,
  maxDisplay = 5,
}) => {
  const unrecoveredErrors = errorSystem.getUnrecoveredErrors().slice(0, maxDisplay);

  const getSeverityIcon = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'ℹ️';
      case ErrorSeverity.WARNING:
        return '⚠️';
      case ErrorSeverity.ERROR:
        return '❌';
      case ErrorSeverity.CRITICAL:
        return '🔥';
      default:
        return '•';
    }
  };

  const getSeverityColor = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'cyan';
      case ErrorSeverity.WARNING:
        return 'yellow';
      case ErrorSeverity.ERROR:
        return 'red';
      case ErrorSeverity.CRITICAL:
        return 'red';
      default:
        return 'white';
    }
  };

  const getCategoryIcon = (category: ErrorCategory): string => {
    switch (category) {
      case ErrorCategory.NETWORK:
        return '🌐';
      case ErrorCategory.FILE_SYSTEM:
        return '📁';
      case ErrorCategory.PERMISSION:
        return '🔒';
      case ErrorCategory.VALIDATION:
        return '✓';
      case ErrorCategory.EXECUTION:
        return '⚙️';
      case ErrorCategory.TIMEOUT:
        return '⏱️';
      case ErrorCategory.RATE_LIMIT:
        return '🚦';
      case ErrorCategory.AUTHENTICATION:
        return '🔑';
      default:
        return '❓';
    }
  };

  const formatTime = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  const renderError = (error: ErrorOccurrence): JSX.Element => {
    return (
      <Box key={error.id} flexDirection="column" marginBottom={1}>
        {/* Error Header */}
        <Box>
          <Text color={getSeverityColor(error.severity)}>
            {getSeverityIcon(error.severity)}{' '}
          </Text>
          <Text color={getSeverityColor(error.severity)} bold>
            {error.error.name || 'Error'}
          </Text>
          <Text color="gray"> {getCategoryIcon(error.category)} {error.category}</Text>
          <Box flexGrow={1} />
          <Text color="gray" dimColor>
            {formatTime(error.timestamp)}
          </Text>
        </Box>

        {/* Error Message */}
        <Box paddingLeft={2}>
          <Text color="gray">{error.error.message}</Text>
        </Box>

        {/* Retry Info */}
        {error.retryCount > 0 && (
          <Box paddingLeft={2}>
            <Text color="yellow">
              Retried {error.retryCount}/{error.maxRetries} times
            </Text>
          </Box>
        )}

        {/* Recovery Strategies */}
        {error.recoveryStrategies.length > 0 && (
          <Box flexDirection="column" paddingLeft={2} marginTop={1}>
            <Text color="cyan">Recovery Options:</Text>
            {error.recoveryStrategies.slice(0, 3).map((strategy, index) => {
              const attempted = error.attemptedStrategies.includes(strategy.id);
              return (
                <Box key={strategy.id} paddingLeft={2}>
                  <Text color={attempted ? 'gray' : 'green'}>
                    {attempted ? '✗' : '•'} {strategy.name}
                    {strategy.automatic && ' (auto)'}
                  </Text>
                </Box>
              );
            })}
            {error.recoveryStrategies.length > 3 && (
              <Box paddingLeft={4}>
                <Text color="gray" dimColor>
                  ... and {error.recoveryStrategies.length - 3} more
                </Text>
              </Box>
            )}
          </Box>
        )}

        {/* Context Info (if available) */}
        {Object.keys(error.context).length > 0 && (
          <Box paddingLeft={2} marginTop={1}>
            <Text color="gray" dimColor>
              Context: {JSON.stringify(error.context).slice(0, 50)}...
            </Text>
          </Box>
        )}
      </Box>
    );
  };

  if (unrecoveredErrors.length === 0) {
    return null; // Don't show panel if no errors
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      paddingX={1}
      marginBottom={1}
    >
      <Box marginBottom={1}>
        <Text bold color="red">
          🔧 Error Recovery
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          {unrecoveredErrors.length} unrecovered
        </Text>
      </Box>

      {/* Errors List */}
      {unrecoveredErrors.map(renderError)}

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Errors will auto-recover when possible • Check logs for details
        </Text>
      </Box>
    </Box>
  );
};
