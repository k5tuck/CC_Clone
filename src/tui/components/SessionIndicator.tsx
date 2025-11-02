/**
 * Session Indicator Component
 * Shows current session info inline
 */

import React from 'react';
import { Box, Text } from 'ink';
import { SessionMetadata } from '../../lib/sessions';

interface SessionIndicatorProps {
  session?: SessionMetadata;
  compact?: boolean;
}

export const SessionIndicator: React.FC<SessionIndicatorProps> = ({
  session,
  compact = false,
}) => {
  if (!session) {
    return (
      <Box>
        <Text color="gray" dimColor>
          No active session
        </Text>
      </Box>
    );
  }

  if (compact) {
    return (
      <Box>
        <Text color="cyan">💬 </Text>
        <Text>{session.name}</Text>
        {session.starred && <Text color="yellow"> ★</Text>}
        {session.tags.length > 0 && (
          <Text color="gray" dimColor>
            {' '}
            #{session.tags[0]}
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box>
        <Text color="cyan">💬 Session: </Text>
        <Text bold>{session.name}</Text>
        {session.starred && <Text color="yellow"> ★</Text>}
      </Box>
      {session.description && (
        <Box paddingLeft={2}>
          <Text color="gray">{session.description}</Text>
        </Box>
      )}
      {session.tags.length > 0 && (
        <Box paddingLeft={2}>
          {session.tags.map(tag => (
            <Text key={tag} color="cyan" dimColor>
              #{tag}{' '}
            </Text>
          ))}
        </Box>
      )}
      <Box paddingLeft={2}>
        <Text color="gray" dimColor>
          {session.messageCount} messages • Created{' '}
          {session.createdAt.toLocaleDateString()}
        </Text>
      </Box>
    </Box>
  );
};
