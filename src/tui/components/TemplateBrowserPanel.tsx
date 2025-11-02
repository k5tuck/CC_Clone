/**
 * Template Browser Panel Component
 * Browse and select conversation templates
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import {
  TemplateManager,
  ConversationTemplate,
  TemplateCategory,
  TemplateFilters,
} from '../../lib/templates';

interface TemplateBrowserPanelProps {
  templateManager: TemplateManager;
  onSelectTemplate?: (template: ConversationTemplate) => void;
  onClose?: () => void;
}

export const TemplateBrowserPanel: React.FC<TemplateBrowserPanelProps> = ({
  templateManager,
  onSelectTemplate,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | undefined>();
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const filters: TemplateFilters = {
    category: selectedCategory,
    favoritesOnly: showFavoritesOnly,
  };

  const templates = templateManager.searchTemplates(filters);
  const categories = Object.values(TemplateCategory);
  const favoriteTemplates = templateManager.getFavoriteTemplates();
  const mostUsed = templateManager.getMostUsedTemplates(3);

  const getCategoryIcon = (category: TemplateCategory): string => {
    switch (category) {
      case TemplateCategory.CODE_REVIEW:
        return '🔍';
      case TemplateCategory.DEBUGGING:
        return '🐛';
      case TemplateCategory.IMPLEMENTATION:
        return '⚙️';
      case TemplateCategory.REFACTORING:
        return '♻️';
      case TemplateCategory.DOCUMENTATION:
        return '📚';
      case TemplateCategory.TESTING:
        return '✅';
      case TemplateCategory.OPTIMIZATION:
        return '⚡';
      case TemplateCategory.SECURITY:
        return '🔒';
      case TemplateCategory.CUSTOM:
        return '✨';
      default:
        return '📄';
    }
  };

  const formatCategoryName = (category: TemplateCategory): string => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const renderTemplate = (template: ConversationTemplate, index: number): JSX.Element => {
    return (
      <Box key={template.id} flexDirection="column" marginBottom={1}>
        {/* Template Header */}
        <Box>
          <Text color="cyan" bold>
            {index + 1}. {template.name}
          </Text>
          {template.favorite && (
            <Text color="yellow"> </Text>
          )}
          <Box flexGrow={1} />
          <Text color="gray" dimColor>
            {getCategoryIcon(template.category)}
          </Text>
        </Box>

        {/* Description */}
        <Box paddingLeft={3}>
          <Text color="gray">{template.description}</Text>
        </Box>

        {/* Tags */}
        {template.tags.length > 0 && (
          <Box paddingLeft={3}>
            <Text color="blue" dimColor>
              {template.tags.map(tag => `#${tag}`).join(' ')}
            </Text>
          </Box>
        )}

        {/* Usage Stats */}
        <Box paddingLeft={3}>
          <Text color="gray" dimColor>
            Used {template.usageCount} times
          </Text>
          {template.variables && template.variables.length > 0 && (
            <>
              <Text color="gray" dimColor> • </Text>
              <Text color="gray" dimColor>
                {template.variables.length} variable{template.variables.length !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </Box>
      </Box>
    );
  };

  const renderCategoryFilter = (): JSX.Element => {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">
          Categories:
        </Text>
        <Box paddingLeft={2}>
          <Text
            color={selectedCategory === undefined ? 'cyan' : 'gray'}
            bold={selectedCategory === undefined}
          >
            All
          </Text>
          {categories.slice(0, 6).map(category => (
            <React.Fragment key={category}>
              <Text color="gray"> | </Text>
              <Text
                color={selectedCategory === category ? 'cyan' : 'gray'}
                bold={selectedCategory === category}
              >
                {getCategoryIcon(category)} {formatCategoryName(category)}
              </Text>
            </React.Fragment>
          ))}
        </Box>
      </Box>
    );
  };

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
          📋 Template Browser
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          Ctrl+T
        </Text>
      </Box>

      {/* Quick Stats */}
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text color="white">
            Total Templates: <Text color="cyan" bold>{templates.length}</Text>
          </Text>
          <Box marginLeft={2}>
            <Text color="white">
              Favorites: <Text color="yellow" bold>{favoriteTemplates.length}</Text>
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Most Used Templates */}
      {mostUsed.length > 0 && !showFavoritesOnly && !selectedCategory && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            ⭐ Most Used:
          </Text>
          {mostUsed.map((template, index) => (
            <Box key={template.id} paddingLeft={2}>
              <Text color="gray">
                {index + 1}. {template.name}
              </Text>
              <Text color="gray" dimColor> ({template.usageCount} uses)</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Category Filter */}
      {renderCategoryFilter()}

      {/* Templates List */}
      <Box flexDirection="column" marginTop={1}>
        <Box marginBottom={1}>
          <Text bold color="white">
            {showFavoritesOnly ? '⭐ Favorites' : 'Templates'}
            {selectedCategory && ` - ${formatCategoryName(selectedCategory)}`}:
          </Text>
        </Box>

        {templates.length > 0 ? (
          <Box flexDirection="column">
            {templates.slice(0, 8).map((template, index) => renderTemplate(template, index))}
            {templates.length > 8 && (
              <Box paddingLeft={2}>
                <Text color="gray" dimColor>
                  ... and {templates.length - 8} more
                </Text>
              </Box>
            )}
          </Box>
        ) : (
          <Box paddingLeft={2}>
            <Text color="gray" dimColor>
              No templates found
            </Text>
          </Box>
        )}
      </Box>

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Number keys: Select template • F: Toggle favorites • C: Change category • ESC: Close
        </Text>
      </Box>
    </Box>
  );
};
