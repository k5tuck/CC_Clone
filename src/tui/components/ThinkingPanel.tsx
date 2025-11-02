/**
 * Thinking Panel
 * Displays agent's systematic thinking process
 */

import React from 'react';
import { Box, Text } from 'ink';
import {
  StructuredResponse,
  ThinkingBlock,
  ThinkingPhase,
  ActionStep,
  ToolUsageExplanation,
  ProgressUpdate,
} from '../../lib/agents/SystematicThinking';

interface ThinkingPanelProps {
  structuredResponse: StructuredResponse;
  showThinking?: boolean;
  showActions?: boolean;
  showTools?: boolean;
  showProgress?: boolean;
  onClose?: () => void;
}

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
  structuredResponse,
  showThinking = true,
  showActions = true,
  showTools = true,
  showProgress = true,
  onClose,
}) => {
  const getPhaseIcon = (phase: ThinkingPhase): string => {
    switch (phase) {
      case ThinkingPhase.ANALYSIS:
        return '🔍';
      case ThinkingPhase.PLANNING:
        return '📋';
      case ThinkingPhase.EXECUTION:
        return '⚙️';
      case ThinkingPhase.VERIFICATION:
        return '✅';
      case ThinkingPhase.REFLECTION:
        return '💭';
      default:
        return '🤔';
    }
  };

  const getPhaseColor = (phase: ThinkingPhase): string => {
    switch (phase) {
      case ThinkingPhase.ANALYSIS:
        return 'cyan';
      case ThinkingPhase.PLANNING:
        return 'yellow';
      case ThinkingPhase.EXECUTION:
        return 'blue';
      case ThinkingPhase.VERIFICATION:
        return 'green';
      case ThinkingPhase.REFLECTION:
        return 'magenta';
      default:
        return 'white';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'pending':
        return '⭕';
      case 'in_progress':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⭕';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'gray';
      case 'in_progress':
        return 'yellow';
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      default:
        return 'white';
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="blue"
      paddingX={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="blue">
          🤔 Systematic Thinking
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          Ctrl+Shift+K
        </Text>
      </Box>

      {/* Thinking Blocks */}
      {showThinking && structuredResponse.thinking.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            💭 Thinking Process:
          </Text>

          {structuredResponse.thinking.map((block, index) => (
            <Box
              key={index}
              flexDirection="column"
              marginTop={1}
              paddingLeft={2}
              borderStyle="single"
              borderColor={getPhaseColor(block.phase)}
              paddingX={1}
            >
              <Box>
                <Text bold color={getPhaseColor(block.phase)}>
                  {getPhaseIcon(block.phase)} {block.phase.toUpperCase()}
                </Text>
              </Box>

              <Box paddingLeft={2} marginTop={1}>
                <Text color="white">{block.content}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Actions */}
      {showActions && structuredResponse.actions.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            📋 Action Steps:
          </Text>

          {structuredResponse.actions.map((action, index) => (
            <Box key={index} paddingLeft={2} marginTop={1}>
              <Text color={getStatusColor(action.status)}>
                {getStatusIcon(action.status)} Step {action.step}:{' '}
              </Text>
              <Text color="white">{action.description}</Text>
            </Box>
          ))}

          {/* Progress indicator */}
          <Box paddingLeft={2} marginTop={1}>
            <Text color="cyan">
              Progress: {structuredResponse.actions.filter(a => a.status === 'completed').length}/
              {structuredResponse.actions.length} steps completed
            </Text>
          </Box>
        </Box>
      )}

      {/* Tool Usage */}
      {showTools && structuredResponse.toolUsage.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            🔧 Tool Usage:
          </Text>

          {structuredResponse.toolUsage.map((tool, index) => (
            <Box
              key={index}
              flexDirection="column"
              marginTop={1}
              paddingLeft={2}
              borderStyle="single"
              borderColor="yellow"
              paddingX={1}
            >
              <Box>
                <Text bold color="yellow">
                  Tool: {tool.tool}
                </Text>
              </Box>

              <Box paddingLeft={2} flexDirection="column">
                <Box>
                  <Text color="white">Purpose: </Text>
                  <Text color="gray">{tool.purpose}</Text>
                </Box>

                <Box>
                  <Text color="white">Expected: </Text>
                  <Text color="cyan">{tool.expectedOutcome}</Text>
                </Box>

                {tool.actualOutcome && (
                  <Box>
                    <Text color="white">Actual: </Text>
                    <Text color="green">{tool.actualOutcome}</Text>
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Progress Updates */}
      {showProgress && structuredResponse.progress.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            📊 Progress Updates:
          </Text>

          {structuredResponse.progress.map((update, index) => (
            <Box key={index} paddingLeft={2} marginTop={1}>
              <Text color="cyan">[{update.percentComplete}%] </Text>
              <Text color="white">{update.message}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Final Response */}
      {structuredResponse.finalResponse && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            💬 Response:
          </Text>
          <Box paddingLeft={2} marginTop={1}>
            <Text color="white">{structuredResponse.finalResponse}</Text>
          </Box>
        </Box>
      )}

      {/* Empty State */}
      {structuredResponse.thinking.length === 0 &&
        structuredResponse.actions.length === 0 &&
        structuredResponse.toolUsage.length === 0 && (
          <Box paddingLeft={2}>
            <Text color="gray" dimColor>
              No thinking process detected. The agent may not be using systematic thinking yet.
            </Text>
          </Box>
        )}

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Shows the agent's systematic thinking process, including analysis, planning, and execution
        </Text>
      </Box>
    </Box>
  );
};
