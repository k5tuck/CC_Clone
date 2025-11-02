/**
 * Context Inspector Panel Component
 * Shows what context the AI has access to
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ContextItem, ContextStats, ContextType } from '../../lib/context';

interface ContextInspectorPanelProps {
  stats: ContextStats;
  items: ContextItem[];
  showDetails?: boolean;
}

export const ContextInspectorPanel: React.FC<ContextInspectorPanelProps> = ({
  stats,
  items,
  showDetails = false,
}) => {
  const formatSize = (size: number): string => {
    if (size < 1000) return `${size}ch`;
    if (size < 1000000) return `${(size / 1000).toFixed(1)}k`;
    return `${(size / 1000000).toFixed(1)}M`;
  };

  const getTypeIcon = (type: ContextType): string => {
    switch (type) {
      case ContextType.FILE:
        return '📄';
      case ContextType.CONVERSATION:
        return '💬';
      case ContextType.SYSTEM:
        return '⚙️';
      case ContextType.KNOWLEDGE_GRAPH:
        return '🧠';
      case ContextType.TOOL_RESULT:
        return '🔧';
      case ContextType.AGENT_OUTPUT:
        return '🤖';
      default:
        return '📋';
    }
  };

  const getImportanceColor = (importance: ContextItem['importance']): string => {
    switch (importance) {
      case 'critical':
        return 'red';
      case 'high':
        return 'yellow';
      case 'medium':
        return 'cyan';
      case 'low':
        return 'gray';
      default:
        return 'white';
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      padding={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="magenta">
          🔍 Context Inspector
        </Text>
        <Text color="gray"> - Press Ctrl+I to toggle</Text>
      </Box>

      {/* Summary */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text>Total Items: </Text>
          <Text bold>{stats.totalItems}</Text>
          <Text color="gray"> • </Text>
          <Text>Size: </Text>
          <Text bold>{formatSize(stats.totalSize)}</Text>
          <Text color="gray"> • </Text>
          <Text>Est. Tokens: </Text>
          <Text bold color={stats.tokenEstimate > 80000 ? 'yellow' : 'green'}>
            {(stats.tokenEstimate / 1000).toFixed(1)}k
          </Text>
        </Box>
      </Box>

      {/* By Type */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">
          By Type:
        </Text>
        <Box paddingLeft={2}>
          {Object.entries(stats.byType).map(([type, count]) =>
            count > 0 ? (
              <Box key={type} marginRight={2}>
                <Text>
                  {getTypeIcon(type as ContextType)} {count}
                </Text>
              </Box>
            ) : null
          )}
        </Box>
      </Box>

      {showDetails && (
        <>
          {/* Top Items */}
          {stats.topItems.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text bold color="yellow">
                Most Accessed:
              </Text>
              {stats.topItems.slice(0, 5).map(item => (
                <Box key={item.id} paddingLeft={2}>
                  <Text color={getImportanceColor(item.importance) as any}>
                    {getTypeIcon(item.type)}{' '}
                  </Text>
                  <Text>{item.name.substring(0, 40)}</Text>
                  <Text color="gray"> ({item.accessCount}x)</Text>
                </Box>
              ))}
            </Box>
          )}

          {/* Recent Items */}
          {stats.recentItems.length > 0 && (
            <Box flexDirection="column">
              <Text bold color="green">
                Recently Added:
              </Text>
              {stats.recentItems.slice(0, 5).map(item => (
                <Box key={item.id} paddingLeft={2}>
                  <Text color={getImportanceColor(item.importance) as any}>
                    {getTypeIcon(item.type)}{' '}
                  </Text>
                  <Text>{item.name.substring(0, 40)}</Text>
                  <Text color="gray" dimColor>
                    {' '}
                    {formatSize(item.size)}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}

      {!showDetails && (
        <Box>
          <Text color="gray" dimColor>
            Press Ctrl+Shift+I for details
          </Text>
        </Box>
      )}
    </Box>
  );
};
