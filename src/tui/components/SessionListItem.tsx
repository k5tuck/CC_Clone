/**
 * Session List Item Component
 * Displays a single session in the session list
 */

import React from 'react';
import { Box, Text } from 'ink';
import { SessionMetadata } from '../../lib/sessions';

interface SessionListItemProps {
  session: SessionMetadata;
  isActive: boolean;
  isSelected: boolean;
}

export const SessionListItem: React.FC<SessionListItemProps> = ({
  session,
  isActive,
  isSelected,
}) => {
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  const truncate = (text: string, length: number): string => {
    if (text.length <= length) return text;
    return text.substring(0, length - 3) + '...';
  };

  return (
    <Box
      borderStyle={isSelected ? 'round' : undefined}
      borderColor={isSelected ? 'cyan' : undefined}
      paddingX={1}
    >
      <Box width={40}>
        {/* Selection indicator */}
        <Text color={isSelected ? 'cyan' : 'gray'}>
          {isSelected ? '▶ ' : '  '}
        </Text>

        {/* Star indicator */}
        {session.starred && <Text color="yellow">★ </Text>}

        {/* Active indicator */}
        {isActive && <Text color="green">● </Text>}

        {/* Session name */}
        <Text bold={isActive} color={isActive ? 'green' : 'white'}>
          {truncate(session.name, 25)}
        </Text>
      </Box>

      {/* Message count */}
      <Box width={10}>
        <Text color="gray">{session.messageCount} msgs</Text>
      </Box>

      {/* Last updated */}
      <Box width={12}>
        <Text color="gray" dimColor>
          {formatTimestamp(session.updatedAt)}
        </Text>
      </Box>

      {/* Tags */}
      {session.tags.length > 0 && (
        <Box marginLeft={1}>
          {session.tags.slice(0, 2).map(tag => (
            <Text key={tag} color="cyan" dimColor>
              #{tag}{' '}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};
