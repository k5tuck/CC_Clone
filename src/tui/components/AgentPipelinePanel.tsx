/**
 * Agent Pipeline Panel Component
 * Displays agent collaboration and task pipelines
 */

import React from 'react';
import { Box, Text } from 'ink';
import {
  AgentPipelineTracker,
  PipelineExecution,
  StageStatus,
  PipelineStats,
} from '../../lib/agents/AgentPipeline';

interface AgentPipelinePanelProps {
  tracker: AgentPipelineTracker;
  showStats?: boolean;
  maxDisplay?: number;
}

export const AgentPipelinePanel: React.FC<AgentPipelinePanelProps> = ({
  tracker,
  showStats = false,
  maxDisplay = 5,
}) => {
  const activePipelines = tracker.getActivePipelines();
  const history = tracker.getHistory(maxDisplay);
  const stats = tracker.getStats();

  const getStatusIcon = (status: StageStatus): string => {
    switch (status) {
      case StageStatus.PENDING:
        return '⏸️';
      case StageStatus.IN_PROGRESS:
        return '🔄';
      case StageStatus.COMPLETED:
        return '✅';
      case StageStatus.FAILED:
        return '❌';
      case StageStatus.SKIPPED:
        return '⏭️';
      default:
        return '•';
    }
  };

  const getStatusColor = (status: StageStatus): string => {
    switch (status) {
      case StageStatus.PENDING:
        return 'gray';
      case StageStatus.IN_PROGRESS:
        return 'cyan';
      case StageStatus.COMPLETED:
        return 'green';
      case StageStatus.FAILED:
        return 'red';
      case StageStatus.SKIPPED:
        return 'yellow';
      default:
        return 'white';
    }
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const renderPipeline = (pipeline: PipelineExecution): JSX.Element => {
    const isActive = pipeline.status === 'running';

    return (
      <Box key={pipeline.id} flexDirection="column" marginBottom={1}>
        {/* Pipeline Header */}
        <Box>
          <Text bold color={isActive ? 'cyan' : 'white'}>
            {isActive ? '🔄' : pipeline.status === 'completed' ? '✅' : '❌'} {pipeline.name}
          </Text>
          {pipeline.totalDuration && (
            <Text color="gray"> ({formatDuration(pipeline.totalDuration)})</Text>
          )}
        </Box>

        {/* Description */}
        {pipeline.description && (
          <Box paddingLeft={2}>
            <Text color="gray" dimColor>
              {pipeline.description}
            </Text>
          </Box>
        )}

        {/* Stages */}
        <Box flexDirection="column" paddingLeft={2} marginTop={1}>
          {pipeline.stages.slice(0, 5).map((stage, index) => {
            const isCurrent = isActive && index === pipeline.currentStageIndex;

            return (
              <Box key={stage.id} marginBottom={0}>
                <Text color={getStatusColor(stage.status)}>
                  {getStatusIcon(stage.status)}{' '}
                </Text>
                <Text bold={isCurrent} color={isCurrent ? 'cyan' : 'white'}>
                  {stage.agentName}
                </Text>
                <Text color="gray">: {stage.task}</Text>
                {stage.duration && (
                  <Text color="gray"> ({formatDuration(stage.duration)})</Text>
                )}
              </Box>
            );
          })}

          {pipeline.stages.length > 5 && (
            <Box paddingLeft={2}>
              <Text color="gray" dimColor>
                ... and {pipeline.stages.length - 5} more stages
              </Text>
            </Box>
          )}
        </Box>

        {/* Handoffs */}
        {pipeline.handoffs.length > 0 && (
          <Box flexDirection="column" paddingLeft={2} marginTop={1}>
            <Text color="yellow">🔀 Handoffs ({pipeline.handoffs.length}):</Text>
            {pipeline.handoffs.slice(0, 3).map((handoff, index) => (
              <Box key={index} paddingLeft={2}>
                <Text color="gray">
                  {handoff.from} → {handoff.to}: {handoff.task}
                </Text>
              </Box>
            ))}
            {pipeline.handoffs.length > 3 && (
              <Box paddingLeft={4}>
                <Text color="gray" dimColor>
                  ... and {pipeline.handoffs.length - 3} more
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  };

  const renderStats = (): JSX.Element => {
    return (
      <Box flexDirection="column" marginTop={1} paddingX={1}>
        <Text bold color="cyan">
          📊 Pipeline Statistics
        </Text>
        <Box paddingLeft={2} flexDirection="column" marginTop={1}>
          <Text>
            Total Executions: <Text color="cyan">{stats.totalExecutions}</Text>
          </Text>
          <Text>
            Completed: <Text color="green">{stats.completedExecutions}</Text> | Failed:{' '}
            <Text color="red">{stats.failedExecutions}</Text>
          </Text>
          <Text>
            Total Stages: <Text color="cyan">{stats.totalStages}</Text>
          </Text>
          <Text>
            Total Handoffs: <Text color="yellow">{stats.totalHandoffs}</Text>
          </Text>
          <Text>
            Avg Duration: <Text color="cyan">{formatDuration(stats.averageDuration)}</Text>
          </Text>
          {stats.mostActiveAgent && (
            <Text>
              Most Active Agent: <Text color="magenta">{stats.mostActiveAgent}</Text>
            </Text>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginBottom={1}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔗 Agent Pipeline View
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          Ctrl+Shift+P
        </Text>
      </Box>

      {/* Active Pipelines */}
      {activePipelines.length > 0 && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            Active Pipelines ({activePipelines.length}):
          </Text>
          {activePipelines.map(renderPipeline)}
        </Box>
      )}

      {/* Recent History */}
      {history.length > 0 && (
        <Box flexDirection="column" marginTop={activePipelines.length > 0 ? 1 : 0}>
          <Text bold color="white">
            Recent Pipelines:
          </Text>
          {history.map(renderPipeline)}
        </Box>
      )}

      {/* Empty State */}
      {activePipelines.length === 0 && history.length === 0 && (
        <Box paddingLeft={2}>
          <Text color="gray" dimColor>
            No pipeline executions yet
          </Text>
        </Box>
      )}

      {/* Statistics */}
      {showStats && stats.totalExecutions > 0 && renderStats()}

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Press Ctrl+Shift+P to toggle statistics
        </Text>
      </Box>
    </Box>
  );
};
