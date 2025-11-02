/**
 * Search Result Item Component
 * Displays individual search result
 */

import React from 'react';
import { Box, Text } from 'ink';
import { SearchResult, SearchResultType } from '../../lib/search';

interface SearchResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  index: number;
}

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  isSelected,
  index,
}) => {
  const getIcon = (): string => {
    switch (result.type) {
      case SearchResultType.FILE:
        return '📄';
      case SearchResultType.CONVERSATION:
        return '💬';
      case SearchResultType.AGENT:
        return '🤖';
      case SearchResultType.KNOWLEDGE:
        return '🧠';
      case SearchResultType.COMMAND:
        return '⌨️';
      default:
        return '📌';
    }
  };

  const getTypeColor = (): string => {
    switch (result.type) {
      case SearchResultType.FILE:
        return 'blue';
      case SearchResultType.CONVERSATION:
        return 'green';
      case SearchResultType.AGENT:
        return 'magenta';
      case SearchResultType.KNOWLEDGE:
        return 'cyan';
      case SearchResultType.COMMAND:
        return 'yellow';
      default:
        return 'white';
    }
  };

  return (
    <Box
      paddingLeft={1}
      paddingRight={1}
      borderStyle={isSelected ? 'single' : undefined}
      borderColor={isSelected ? 'blue' : undefined}
    >
      <Box width={60}>
        <Box width={3}>
          <Text color={getTypeColor()}>{isSelected ? '▸' : ' '}{getIcon()}</Text>
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          {/* Title */}
          <Box>
            <Text bold color={isSelected ? 'white' : getTypeColor()}>
              {result.title}
            </Text>
            {result.lineNumber && (
              <Text color={isSelected ? 'white' : 'gray'}>
                :{result.lineNumber}
              </Text>
            )}
          </Box>

          {/* Description */}
          {result.description && (
            <Box>
              <Text color={isSelected ? 'white' : 'gray'} dimColor={!isSelected}>
                {result.description}
              </Text>
            </Box>
          )}

          {/* Preview */}
          {result.preview && (
            <Box>
              <Text color={isSelected ? 'white' : 'gray'} dimColor={!isSelected}>
                {result.preview}
              </Text>
            </Box>
          )}
        </Box>

        {/* Score (for debugging, can be hidden) */}
        {/* <Box width={6} justifyContent="flex-end">
          <Text color="gray" dimColor>
            {result.score.toFixed(0)}
          </Text>
        </Box> */}
      </Box>
    </Box>
  );
};
