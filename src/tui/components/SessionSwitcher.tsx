/**
 * Session Switcher Component
 * Interactive session selector and manager
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { SessionMetadata, SessionTemplate, DEFAULT_TEMPLATES } from '../../lib/sessions';
import { SessionListItem } from './SessionListItem';

interface SessionSwitcherProps {
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  onSwitch: (sessionId: string) => void;
  onNew: (name: string, template?: SessionTemplate) => void;
  onDelete?: (sessionId: string) => void;
  onClose: () => void;
}

export const SessionSwitcher: React.FC<SessionSwitcherProps> = ({
  sessions,
  currentSessionId,
  onSwitch,
  onNew,
  onDelete,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'list' | 'templates'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = searchQuery
    ? sessions.filter(
        s =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sessions;

  const handleSelect = () => {
    if (mode === 'list' && filteredSessions.length > 0) {
      const selected = filteredSessions[selectedIndex];
      onSwitch(selected.id);
      onClose();
    } else if (mode === 'templates') {
      const template = DEFAULT_TEMPLATES[selectedIndex];
      onNew(template.name, template);
      onClose();
    }
  };

  if (mode === 'templates') {
    return (
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="cyan"
        padding={1}
      >
        {/* Header */}
        <Box marginBottom={1}>
          <Text bold color="cyan">
            📋 New Session from Template
          </Text>
          <Text color="gray"> - Select a template or press Esc to cancel</Text>
        </Box>

        {/* Templates */}
        {DEFAULT_TEMPLATES.map((template, idx) => (
          <Box
            key={template.id}
            borderStyle={idx === selectedIndex ? 'round' : undefined}
            borderColor={idx === selectedIndex ? 'cyan' : undefined}
            paddingX={1}
            marginBottom={1}
          >
            <Box width={50}>
              <Text color={idx === selectedIndex ? 'cyan' : 'gray'}>
                {idx === selectedIndex ? '▶ ' : '  '}
              </Text>
              <Text>{template.icon} </Text>
              <Text bold={idx === selectedIndex}>{template.name}</Text>
            </Box>
            <Box>
              <Text color="gray" dimColor>
                {template.description}
              </Text>
            </Box>
          </Box>
        ))}

        {/* Instructions */}
        <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text color="gray">
            ↑/↓: Navigate • Enter: Select • Esc: Cancel • B: Back to list
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      padding={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔀 Session Switcher
        </Text>
        <Text color="gray">
          {' '}
          - {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </Text>
      </Box>

      {/* Search */}
      {searchQuery && (
        <Box marginBottom={1}>
          <Text color="yellow">🔍 Search: {searchQuery}</Text>
          <Text color="gray">
            {' '}
            ({filteredSessions.length} result
            {filteredSessions.length !== 1 ? 's' : ''})
          </Text>
        </Box>
      )}

      {/* Session list */}
      {filteredSessions.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          {filteredSessions.slice(0, 10).map((session, idx) => (
            <SessionListItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              isSelected={idx === selectedIndex}
            />
          ))}
          {filteredSessions.length > 10 && (
            <Box paddingLeft={2}>
              <Text color="gray" dimColor>
                ... and {filteredSessions.length - 10} more
              </Text>
            </Box>
          )}
        </Box>
      ) : (
        <Box marginBottom={1}>
          <Text color="gray">No sessions found</Text>
        </Box>
      )}

      {/* Instructions */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">
          ↑/↓: Navigate • Enter: Switch • N: New from template • D: Delete • Esc: Close
        </Text>
      </Box>
    </Box>
  );
};
