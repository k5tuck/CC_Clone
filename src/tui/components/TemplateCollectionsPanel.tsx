/**
 * Template Collections Panel
 * Browse and use curated template collections
 */

import React from 'react';
import { Box, Text } from 'ink';
import { TemplateCollection, CollectionType } from '../../lib/templates/TemplateCollections';

interface TemplateCollectionsPanelProps {
  collections: TemplateCollection[];
  selectedCollection?: TemplateCollection;
  onSelectCollection?: (collectionId: string) => void;
  onUseCollection?: (collectionId: string) => void;
  onClose?: () => void;
}

export const TemplateCollectionsPanel: React.FC<TemplateCollectionsPanelProps> = ({
  collections,
  selectedCollection,
  onSelectCollection,
  onUseCollection,
  onClose,
}) => {
  const getTypeColor = (type: CollectionType): string => {
    switch (type) {
      case CollectionType.WORKFLOW:
        return 'blue';
      case CollectionType.QUICKSTART:
        return 'green';
      case CollectionType.BEST_PRACTICES:
        return 'purple';
      case CollectionType.SPECIALIZED:
        return 'red';
      case CollectionType.CUSTOM:
        return 'yellow';
      default:
        return 'white';
    }
  };

  const getDifficultyColor = (difficulty?: string): string => {
    switch (difficulty) {
      case 'beginner':
        return 'green';
      case 'intermediate':
        return 'yellow';
      case 'advanced':
        return 'red';
      default:
        return 'white';
    }
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  // Group collections by type
  const collectionsByType = new Map<CollectionType, TemplateCollection[]>();
  for (const collection of collections) {
    const existing = collectionsByType.get(collection.type) || [];
    existing.push(collection);
    collectionsByType.set(collection.type, existing);
  }

  const featured = collections.filter(c => c.featured);

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
          📚 Template Collections
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          Ctrl+Shift+C
        </Text>
      </Box>

      {/* Featured Collections */}
      {featured.length > 0 && !selectedCollection && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            ⭐ Featured Collections:
          </Text>

          {featured.map((collection, index) => (
            <Box
              key={collection.id}
              flexDirection="column"
              marginTop={1}
              paddingLeft={2}
              borderStyle="single"
              borderColor={getTypeColor(collection.type)}
              paddingX={1}
            >
              <Box>
                <Text color="white">
                  {collection.icon || '📦'} {collection.name}
                </Text>
                {collection.favorite && (
                  <Text color="yellow"> ♥</Text>
                )}
              </Box>

              <Box paddingLeft={2}>
                <Text color="gray" dimColor>
                  {collection.description}
                </Text>
              </Box>

              <Box paddingLeft={2} marginTop={1}>
                <Text color={getTypeColor(collection.type)}>
                  {collection.type}
                </Text>
                {collection.metadata?.difficulty && (
                  <>
                    <Text color="gray"> | </Text>
                    <Text color={getDifficultyColor(collection.metadata.difficulty)}>
                      {collection.metadata.difficulty}
                    </Text>
                  </>
                )}
                {collection.metadata?.estimatedTime && (
                  <>
                    <Text color="gray"> | </Text>
                    <Text color="cyan">
                      ⏱️ {formatTime(collection.metadata.estimatedTime)}
                    </Text>
                  </>
                )}
              </Box>

              <Box paddingLeft={2}>
                <Text color="gray">
                  {collection.templates.length} templates | Used {collection.usageCount} times
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Selected Collection Details */}
      {selectedCollection && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            📋 Collection Details:
          </Text>

          <Box
            flexDirection="column"
            marginTop={1}
            paddingLeft={2}
            borderStyle="double"
            borderColor={getTypeColor(selectedCollection.type)}
            paddingX={1}
          >
            <Box>
              <Text bold color={getTypeColor(selectedCollection.type)}>
                {selectedCollection.icon || '📦'} {selectedCollection.name}
              </Text>
            </Box>

            <Box paddingLeft={2} marginTop={1}>
              <Text color="white">{selectedCollection.description}</Text>
            </Box>

            {/* Metadata */}
            {selectedCollection.metadata && (
              <Box flexDirection="column" paddingLeft={2} marginTop={1}>
                {selectedCollection.metadata.difficulty && (
                  <Box>
                    <Text color="white">Difficulty: </Text>
                    <Text color={getDifficultyColor(selectedCollection.metadata.difficulty)}>
                      {selectedCollection.metadata.difficulty}
                    </Text>
                  </Box>
                )}

                {selectedCollection.metadata.estimatedTime && (
                  <Box>
                    <Text color="white">Est. Time: </Text>
                    <Text color="cyan">
                      {formatTime(selectedCollection.metadata.estimatedTime)}
                    </Text>
                  </Box>
                )}

                {selectedCollection.metadata.prerequisites && selectedCollection.metadata.prerequisites.length > 0 && (
                  <Box flexDirection="column" marginTop={1}>
                    <Text color="yellow">Prerequisites:</Text>
                    {selectedCollection.metadata.prerequisites.map((prereq, i) => (
                      <Box key={i} paddingLeft={2}>
                        <Text color="gray">• {prereq}</Text>
                      </Box>
                    ))}
                  </Box>
                )}

                {selectedCollection.metadata.outcomes && selectedCollection.metadata.outcomes.length > 0 && (
                  <Box flexDirection="column" marginTop={1}>
                    <Text color="green">Outcomes:</Text>
                    {selectedCollection.metadata.outcomes.map((outcome, i) => (
                      <Box key={i} paddingLeft={2}>
                        <Text color="gray">✓ {outcome}</Text>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Templates */}
            <Box paddingLeft={2} marginTop={1}>
              <Text color="white">
                Contains {selectedCollection.templates.length} templates
              </Text>
            </Box>

            {/* Tags */}
            {selectedCollection.tags.length > 0 && (
              <Box paddingLeft={2} marginTop={1}>
                <Text color="white">Tags: </Text>
                {selectedCollection.tags.map((tag, i) => (
                  <Text key={i} color="magenta">
                    #{tag}{i < selectedCollection.tags.length - 1 ? ' ' : ''}
                  </Text>
                ))}
              </Box>
            )}

            {/* Usage Stats */}
            <Box paddingLeft={2} marginTop={1}>
              <Text color="gray" dimColor>
                Used {selectedCollection.usageCount} times
                {selectedCollection.author && ` • by ${selectedCollection.author}`}
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Collections by Type */}
      {!selectedCollection && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            📂 Browse by Type:
          </Text>

          {Array.from(collectionsByType.entries()).map(([type, typeCollections]) => (
            <Box key={type} flexDirection="column" marginTop={1} paddingLeft={2}>
              <Text bold color={getTypeColor(type)}>
                {type.replace('_', ' ').toUpperCase()} ({typeCollections.length})
              </Text>

              {typeCollections.slice(0, 3).map((collection, index) => (
                <Box key={collection.id} paddingLeft={2}>
                  <Text color="white">
                    {collection.icon || '•'} {collection.name}
                  </Text>
                  <Text color="gray" dimColor>
                    {' '}({collection.templates.length} templates)
                  </Text>
                </Box>
              ))}

              {typeCollections.length > 3 && (
                <Box paddingLeft={2}>
                  <Text color="gray" dimColor>
                    ... and {typeCollections.length - 3} more
                  </Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Statistics */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">
          📊 Statistics:
        </Text>
        <Box paddingLeft={2}>
          <Text color="cyan">
            Total Collections: {collections.length}
          </Text>
        </Box>
        <Box paddingLeft={2}>
          <Text color="yellow">
            Featured: {featured.length}
          </Text>
        </Box>
        <Box paddingLeft={2}>
          <Text color="green">
            Total Templates: {collections.reduce((sum, c) => sum + c.templates.length, 0)}
          </Text>
        </Box>
      </Box>

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Collections are curated groups of templates for specific workflows and use cases
        </Text>
      </Box>
    </Box>
  );
};
