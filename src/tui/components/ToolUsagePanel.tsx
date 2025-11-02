/**
 * Tool Usage Panel Component
 * Shows all active and recent tool calls with statistics
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { ToolExecutionEvent, ToolUsageStats } from '../../lib/tool-tracking';
import { ToolCallDisplay } from './ToolCallDisplay';

interface ToolUsagePanelProps {
  activeTools: ToolExecutionEvent[];
  recentTools: ToolExecutionEvent[];
  stats?: ToolUsageStats[];
  showStats?: boolean;
  maxDisplay?: number;
}

export const ToolUsagePanel: React.FC<ToolUsagePanelProps> = ({
  activeTools,
  recentTools,
  stats = [],
  showStats = false,
  maxDisplay = 5,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (activeTools.length === 0 && recentTools.length === 0) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔧 Tool Activity
        </Text>
        <Text color="gray" dimColor>
          {' '}
          ({activeTools.length} active, {recentTools.length} recent)
        </Text>
        <Text color="gray" dimColor>
          {' '}
          - Press Ctrl+U to toggle
        </Text>
      </Box>

      {!collapsed && (
        <>
          {/* Active Tools */}
          {activeTools.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="yellow" bold>
                ⚡ Active:
              </Text>
              {activeTools.map(event => (
                <ToolCallDisplay key={event.id} event={event} collapsed={false} />
              ))}
            </Box>
          )}

          {/* Recent Tools */}
          {recentTools.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="gray" bold>
                📝 Recent (last {Math.min(maxDisplay, recentTools.length)}):
              </Text>
              {recentTools.slice(0, maxDisplay).map(event => (
                <ToolCallDisplay key={event.id} event={event} collapsed={true} />
              ))}
            </Box>
          )}

          {/* Statistics */}
          {showStats && stats.length > 0 && (
            <Box flexDirection="column">
              <Text bold color="cyan">
                📊 Statistics:
              </Text>
              {stats.map(stat => (
                <Box key={stat.toolName} paddingLeft={2}>
                  <Text>
                    <Text bold>{stat.toolName}</Text>
                    <Text color="gray">
                      {' '}
                      - {stat.totalCalls} calls ({stat.successfulCalls} ✓,{' '}
                      {stat.failedCalls} ✗)
                    </Text>
                    {stat.averageDurationMs > 0 && (
                      <Text color="gray">
                        {' '}
                        • avg {stat.averageDurationMs.toFixed(0)}ms
                      </Text>
                    )}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}

      {collapsed && (
        <Box>
          <Text color="gray" dimColor>
            (Tool activity hidden - Press Ctrl+U to show)
          </Text>
        </Box>
      )}
    </Box>
  );
};
