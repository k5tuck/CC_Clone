/**
 * Clipboard Prompt Component
 * Prompts user when clipboard content is detected
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ClipboardContentType } from '../../lib/clipboard';

interface ClipboardPromptProps {
  contentType: ClipboardContentType;
  onAccept: () => void;
  onCancel: () => void;
}

export const ClipboardPrompt: React.FC<ClipboardPromptProps> = ({
  contentType,
  onAccept,
  onCancel,
}) => {
  const getPromptMessage = (): string => {
    switch (contentType) {
      case ClipboardContentType.IMAGE:
        return 'Image detected in clipboard';
      case ClipboardContentType.FILE:
        return 'File detected in clipboard';
      case ClipboardContentType.TEXT:
        return 'Text detected in clipboard';
      default:
        return 'Clipboard content detected';
    }
  };

  const getIcon = (): string => {
    switch (contentType) {
      case ClipboardContentType.IMAGE:
        return '📷';
      case ClipboardContentType.FILE:
        return '📎';
      case ClipboardContentType.TEXT:
        return '📋';
      default:
        return '📋';
    }
  };

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      marginBottom={1}
    >
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">{getIcon()} </Text>
          <Text bold>{getPromptMessage()}</Text>
        </Box>

        <Box paddingLeft={2} marginTop={1}>
          <Text color="yellow">
            Press Ctrl+V to paste, or continue typing
          </Text>
        </Box>

        {contentType === ClipboardContentType.IMAGE && (
          <Box paddingLeft={2}>
            <Text color="gray" dimColor>
              Image will be analyzed by vision-capable LLM
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
