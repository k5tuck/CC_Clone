/**
 * Image Paste Indicator Component
 * Shows when an image has been pasted from clipboard
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ImagePasteResult } from '../../lib/clipboard';

interface ImagePasteIndicatorProps {
  result: ImagePasteResult;
  onDismiss?: () => void;
}

export const ImagePasteIndicator: React.FC<ImagePasteIndicatorProps> = ({
  result,
  onDismiss,
}) => {
  const formatSize = (bytes?: number): string => {
    if (!bytes) return 'unknown size';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (!result.success) {
    return (
      <Box
        borderStyle="round"
        borderColor="red"
        padding={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text bold color="red">
            ❌ Image Paste Failed
          </Text>
          <Box paddingLeft={2} marginTop={1}>
            <Text color="red">{result.error || 'Unknown error'}</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor="green"
      padding={1}
      marginBottom={1}
    >
      <Box flexDirection="column">
        <Text bold color="green">
          📷 Image Pasted from Clipboard
        </Text>

        <Box paddingLeft={2} marginTop={1}>
          <Text>Type: </Text>
          <Text color="cyan">{result.mimeType || 'image/png'}</Text>
        </Box>

        {result.width && result.height && (
          <Box paddingLeft={2}>
            <Text>Dimensions: </Text>
            <Text color="cyan">
              {result.width} × {result.height} px
            </Text>
          </Box>
        )}

        {result.size && (
          <Box paddingLeft={2}>
            <Text>Size: </Text>
            <Text color="cyan">{formatSize(result.size)}</Text>
          </Box>
        )}

        <Box paddingLeft={2} marginTop={1}>
          <Text color="gray" dimColor>
            Image will be sent to vision-capable LLM (Claude 3.5, GPT-4V)
          </Text>
        </Box>

        {onDismiss && (
          <Box paddingLeft={2} marginTop={1}>
            <Text color="yellow">
              Press Enter to send, or type a message to add context
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
