/**
 * Progress Estimation Panel
 * Shows task progress and estimates
 */

import React from 'react';
import { Box, Text } from 'ink';
import {
  TaskProgress,
  TaskEstimate,
  TaskComplexity,
  TaskType,
} from '../../lib/progress';

interface ProgressPanelProps {
  currentProgress?: TaskProgress;
  currentEstimate?: TaskEstimate;
  onClose?: () => void;
}

export const ProgressPanel: React.FC<ProgressPanelProps> = ({
  currentProgress,
  currentEstimate,
  onClose,
}) => {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const getComplexityColor = (complexity: TaskComplexity): string => {
    switch (complexity) {
      case TaskComplexity.TRIVIAL:
        return 'green';
      case TaskComplexity.SIMPLE:
        return 'cyan';
      case TaskComplexity.MODERATE:
        return 'yellow';
      case TaskComplexity.COMPLEX:
        return 'magenta';
      case TaskComplexity.VERY_COMPLEX:
        return 'red';
      default:
        return 'white';
    }
  };

  const getComplexityIcon = (complexity: TaskComplexity): string => {
    switch (complexity) {
      case TaskComplexity.TRIVIAL:
        return '⚪';
      case TaskComplexity.SIMPLE:
        return '🔵';
      case TaskComplexity.MODERATE:
        return '🟡';
      case TaskComplexity.COMPLEX:
        return '🟠';
      case TaskComplexity.VERY_COMPLEX:
        return '🔴';
      default:
        return '⚫';
    }
  };

  const renderProgressBar = (percent: number, width: number = 30): string => {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="yellow">
          ⏱️  Task Progress & Estimation
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          Ctrl+Shift+P
        </Text>
      </Box>

      {/* Current Task Estimate */}
      {currentEstimate && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            📋 Current Task:
          </Text>
          <Box paddingLeft={2} flexDirection="column">
            <Text color="gray">{currentEstimate.description}</Text>

            <Box marginTop={1}>
              <Text color="white">
                Complexity: {' '}
              </Text>
              <Text color={getComplexityColor(currentEstimate.complexity)}>
                {getComplexityIcon(currentEstimate.complexity)} {currentEstimate.complexity}
              </Text>
            </Box>

            <Box>
              <Text color="white">
                Estimated Time: {' '}
              </Text>
              <Text color="cyan">
                {formatTime(currentEstimate.estimatedDuration)}
              </Text>
            </Box>

            <Box>
              <Text color="white">
                Steps: {' '}
              </Text>
              <Text color="cyan">
                {currentEstimate.estimatedSteps}
              </Text>
            </Box>

            <Box>
              <Text color="white">
                Confidence: {' '}
              </Text>
              <Text color={currentEstimate.confidence > 0.7 ? 'green' : currentEstimate.confidence > 0.5 ? 'yellow' : 'red'}>
                {Math.round(currentEstimate.confidence * 100)}%
              </Text>
            </Box>

            {/* Estimation Factors */}
            {currentEstimate.factors.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text color="cyan">Factors:</Text>
                {currentEstimate.factors.map((factor, index) => (
                  <Box key={index} paddingLeft={2}>
                    <Text color={factor.impact === 'increase' ? 'red' : 'green'}>
                      {factor.impact === 'increase' ? '↑' : '↓'} {factor.name} ({factor.multiplier.toFixed(1)}x)
                    </Text>
                  </Box>
                ))}
              </Box>
            )}

            {/* Breakdown */}
            {currentEstimate.breakdown && currentEstimate.breakdown.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text color="cyan">Breakdown:</Text>
                {currentEstimate.breakdown.map((step, index) => (
                  <Box key={index} paddingLeft={2}>
                    <Text color={step.completed ? 'green' : 'gray'}>
                      {step.completed ? '✓' : '○'} {step.step} ({formatTime(step.estimatedDuration)})
                    </Text>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Active Progress */}
      {currentProgress && currentProgress.status === 'in_progress' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            🔄 Active Progress:
          </Text>
          <Box paddingLeft={2} flexDirection="column">
            <Box>
              <Text color="white">Status: </Text>
              <Text color="cyan">In Progress</Text>
            </Box>

            <Box marginTop={1}>
              <Text color="white">
                {renderProgressBar(currentProgress.percentComplete)}
              </Text>
              <Text color="cyan"> {Math.round(currentProgress.percentComplete)}%</Text>
            </Box>

            <Box>
              <Text color="white">Step: </Text>
              <Text color="cyan">
                {currentProgress.currentStep}/{currentProgress.totalSteps}
              </Text>
            </Box>

            <Box>
              <Text color="white">Elapsed: </Text>
              <Text color="yellow">{formatTime(currentProgress.elapsedTime)}</Text>
            </Box>

            <Box>
              <Text color="white">Remaining: </Text>
              <Text color="green">{formatTime(currentProgress.remainingTime)}</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* No active task */}
      {!currentProgress && !currentEstimate && (
        <Box paddingLeft={2}>
          <Text color="gray" dimColor>
            No active task. Start a task to see progress estimation.
          </Text>
        </Box>
      )}

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Progress is estimated based on task complexity and historical data
        </Text>
      </Box>
    </Box>
  );
};
