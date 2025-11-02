/**
 * Keyboard Shortcuts Panel
 * Quick reference for all keyboard shortcuts
 */

import React from 'react';
import { Box, Text } from 'ink';

interface ShortcutsPanelProps {
  onClose?: () => void;
}

interface ShortcutGroup {
  title: string;
  color: string;
  shortcuts: Array<{
    keys: string;
    description: string;
  }>;
}

export const ShortcutsPanel: React.FC<ShortcutsPanelProps> = ({ onClose }) => {
  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Phase 1 - Core UX',
      color: 'cyan',
      shortcuts: [
        { keys: 'Ctrl+F', description: 'Universal Search (files, agents, commands)' },
        { keys: 'Ctrl+U', description: 'Tool Usage Panel' },
        { keys: 'Ctrl+Shift+U', description: 'Tool Statistics' },
        { keys: 'Ctrl+S', description: 'Detailed Status Line' },
        { keys: 'Ctrl+Shift+S', description: 'Compact Status Bar' },
        { keys: 'Ctrl+E', description: 'Session Switcher' },
        { keys: 'Ctrl+I', description: 'Context Inspector' },
        { keys: 'Ctrl+Shift+I', description: 'Context Details' },
        { keys: 'Ctrl+V', description: 'Paste from Clipboard (images supported)' },
      ],
    },
    {
      title: 'Phase 2 - Advanced Visualization',
      color: 'green',
      shortcuts: [
        { keys: 'Ctrl+G', description: 'Knowledge Graph Visualization' },
        { keys: 'Ctrl+P', description: 'Agent Pipeline View' },
        { keys: 'Ctrl+Shift+P', description: 'Pipeline Statistics' },
        { keys: 'Ctrl+R', description: 'Error Recovery Panel' },
      ],
    },
    {
      title: 'Phase 3 - Productivity Features',
      color: 'magenta',
      shortcuts: [
        { keys: 'Ctrl+M', description: 'Agent Communication Log' },
        { keys: 'Ctrl+Shift+M', description: 'Toggle Messages/Threads' },
        { keys: 'Ctrl+T', description: 'Template Browser' },
        { keys: 'Ctrl+Shift+T', description: 'Theme Selector' },
        { keys: 'Ctrl+Z', description: 'Rollback History' },
      ],
    },
    {
      title: 'System & Navigation',
      color: 'yellow',
      shortcuts: [
        { keys: 'Ctrl+?', description: 'Show this shortcuts panel' },
        { keys: 'Tab', description: 'Accept autocomplete suggestion' },
        { keys: 'Up/Down', description: 'Navigate autocomplete suggestions' },
        { keys: 'Ctrl+C / Ctrl+D', description: 'Exit application' },
        { keys: 'Enter', description: 'Send message' },
        { keys: 'ESC', description: 'Close current panel' },
      ],
    },
  ];

  const totalShortcuts = shortcutGroups.reduce((sum, group) => sum + group.shortcuts.length, 0);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ⌨️  Keyboard Shortcuts Reference
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          {totalShortcuts} shortcuts • Ctrl+? to toggle
        </Text>
      </Box>

      {/* Shortcuts Groups */}
      {shortcutGroups.map((group, groupIndex) => (
        <Box key={group.title} flexDirection="column" marginBottom={1}>
          <Text bold color={group.color}>
            {group.title}:
          </Text>
          <Box flexDirection="column" paddingLeft={2}>
            {group.shortcuts.map((shortcut, index) => (
              <Box key={index} marginBottom={index < group.shortcuts.length - 1 ? 0 : 0}>
                <Box width={20}>
                  <Text color="white" bold>
                    {shortcut.keys}
                  </Text>
                </Box>
                <Text color="gray">→ {shortcut.description}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      ))}

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Press Ctrl+? to close • Type /help for command list
        </Text>
      </Box>
    </Box>
  );
};
