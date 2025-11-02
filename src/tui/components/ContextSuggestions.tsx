/**
 * Context Suggestions Component
 * Shows suggestions for optimizing context
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ContextSuggestion } from '../../lib/context';

interface ContextSuggestionsProps {
  suggestions: ContextSuggestion[];
  onAccept?: (suggestionId: string) => void;
  onDismiss?: (suggestionId: string) => void;
}

export const ContextSuggestions: React.FC<ContextSuggestionsProps> = ({
  suggestions,
  onAccept,
  onDismiss,
}) => {
  if (suggestions.length === 0) {
    return null;
  }

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high':
        return 'red';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'gray';
      default:
        return 'white';
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'add':
        return '➕';
      case 'remove':
        return '➖';
      case 'update':
        return '🔄';
      default:
        return '💡';
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      padding={1}
      marginBottom={1}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">
          💡 Context Suggestions
        </Text>
        <Text color="gray">
          {' '}
          - {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
        </Text>
      </Box>

      {suggestions.slice(0, 3).map(suggestion => (
        <Box
          key={suggestion.id}
          flexDirection="column"
          borderStyle="single"
          borderColor={getPriorityColor(suggestion.priority)}
          padding={1}
          marginBottom={1}
        >
          <Box>
            <Text color={getPriorityColor(suggestion.priority) as any}>
              {getTypeIcon(suggestion.type)}{' '}
            </Text>
            <Text bold>{suggestion.item.name}</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">{suggestion.reason}</Text>
          </Box>
          {(onAccept || onDismiss) && (
            <Box paddingLeft={2} marginTop={1}>
              <Text color="gray" dimColor>
                A: Accept • D: Dismiss
              </Text>
            </Box>
          )}
        </Box>
      ))}

      {suggestions.length > 3 && (
        <Box>
          <Text color="gray" dimColor>
            ... and {suggestions.length - 3} more suggestions
          </Text>
        </Box>
      )}
    </Box>
  );
};
