/**
 * Pattern Recognition Panel
 * Displays detected patterns and allows pattern management
 */

import React from 'react';
import { Box, Text } from 'ink';
import {
  DetectedPattern,
  PatternType,
  ConfidenceLevel,
} from '../../lib/patterns';

interface PatternRecognitionPanelProps {
  patterns: DetectedPattern[];
  selectedType?: PatternType;
  onClose?: () => void;
}

export const PatternRecognitionPanel: React.FC<PatternRecognitionPanelProps> = ({
  patterns,
  selectedType,
  onClose,
}) => {
  const getConfidenceColor = (confidence: ConfidenceLevel): string => {
    switch (confidence) {
      case ConfidenceLevel.VERY_HIGH:
        return 'green';
      case ConfidenceLevel.HIGH:
        return 'cyan';
      case ConfidenceLevel.MEDIUM:
        return 'yellow';
      case ConfidenceLevel.LOW:
        return 'red';
      default:
        return 'white';
    }
  };

  const getTypeIcon = (type: PatternType): string => {
    switch (type) {
      case PatternType.CODE_STRUCTURE:
        return '📝';
      case PatternType.USER_WORKFLOW:
        return '🔄';
      case PatternType.ERROR_SEQUENCE:
        return '⚠️';
      case PatternType.CONVERSATION_FLOW:
        return '💬';
      case PatternType.FILE_ACCESS:
        return '📁';
      case PatternType.TOOL_USAGE:
        return '🔧';
      case PatternType.NAMING_CONVENTION:
        return '🏷️';
      default:
        return '🔍';
    }
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const filteredPatterns = selectedType
    ? patterns.filter(p => p.type === selectedType)
    : patterns;

  const sortedPatterns = [...filteredPatterns].sort((a, b) => {
    // Sort by confidence score first, then by occurrences
    if (b.confidenceScore !== a.confidenceScore) {
      return b.confidenceScore - a.confidenceScore;
    }
    return b.occurrences - a.occurrences;
  });

  const patternsByType = new Map<PatternType, number>();
  for (const pattern of patterns) {
    patternsByType.set(
      pattern.type,
      (patternsByType.get(pattern.type) || 0) + 1
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="magenta">
          🔍 Pattern Recognition
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          Ctrl+Shift+P
        </Text>
      </Box>

      {/* Statistics */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">
          📊 Statistics:
        </Text>
        <Box paddingLeft={2}>
          <Text color="cyan">Total Patterns: {patterns.length}</Text>
        </Box>
        <Box paddingLeft={2} flexDirection="column">
          {Array.from(patternsByType.entries()).map(([type, count]) => (
            <Box key={type}>
              <Text color="gray">
                {getTypeIcon(type)} {type}: {' '}
              </Text>
              <Text color="cyan">{count}</Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Filter Info */}
      {selectedType && (
        <Box marginBottom={1} paddingLeft={2}>
          <Text color="yellow">
            Filtered by: {getTypeIcon(selectedType)} {selectedType}
          </Text>
        </Box>
      )}

      {/* Patterns List */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">
          📋 Detected Patterns:
        </Text>

        {sortedPatterns.length === 0 ? (
          <Box paddingLeft={2} marginTop={1}>
            <Text color="gray" dimColor>
              No patterns detected yet. Patterns emerge after 3+ similar occurrences.
            </Text>
          </Box>
        ) : (
          sortedPatterns.slice(0, 10).map((pattern, index) => (
            <Box
              key={pattern.id}
              flexDirection="column"
              marginTop={1}
              paddingLeft={2}
              borderStyle="single"
              borderColor="gray"
              paddingX={1}
            >
              {/* Pattern Header */}
              <Box>
                <Text color="white">
                  {getTypeIcon(pattern.type)} {pattern.name}
                </Text>
              </Box>

              {/* Pattern Info */}
              <Box paddingLeft={2} flexDirection="column">
                <Text color="gray" dimColor>
                  {pattern.description}
                </Text>

                <Box marginTop={1}>
                  <Text color="white">Occurrences: </Text>
                  <Text color="cyan">{pattern.occurrences}</Text>
                  <Text color="gray"> | </Text>
                  <Text color="white">Confidence: </Text>
                  <Text color={getConfidenceColor(pattern.confidence)}>
                    {pattern.confidence} ({Math.round(pattern.confidenceScore * 100)}%)
                  </Text>
                </Box>

                <Box>
                  <Text color="white">First seen: </Text>
                  <Text color="gray">{formatDate(pattern.firstSeen)}</Text>
                  <Text color="gray"> | </Text>
                  <Text color="white">Last seen: </Text>
                  <Text color="yellow">{formatDate(pattern.lastSeen)}</Text>
                </Box>

                {/* Tags */}
                {pattern.tags.length > 0 && (
                  <Box marginTop={1}>
                    <Text color="white">Tags: </Text>
                    {pattern.tags.map((tag, i) => (
                      <Text key={i} color="magenta">
                        #{tag}{i < pattern.tags.length - 1 ? ' ' : ''}
                      </Text>
                    ))}
                  </Box>
                )}

                {/* Example */}
                {pattern.examples.length > 0 && (
                  <Box flexDirection="column" marginTop={1}>
                    <Text color="cyan">Example:</Text>
                    <Box paddingLeft={2}>
                      <Text color="gray" dimColor>
                        {pattern.examples[0].excerpt}
                      </Text>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          ))
        )}

        {sortedPatterns.length > 10 && (
          <Box paddingLeft={2} marginTop={1}>
            <Text color="gray" dimColor>
              ... and {sortedPatterns.length - 10} more patterns
            </Text>
          </Box>
        )}
      </Box>

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Patterns are automatically detected from your workflow and code changes
        </Text>
      </Box>
    </Box>
  );
};
