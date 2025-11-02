/**
 * Knowledge Graph Panel Component
 * Displays ASCII visualization of the knowledge graph
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { GraphVisualizer, ASCIIVisualization, LayoutType } from '../../lib/knowledge';

interface KnowledgeGraphPanelProps {
  visualizer: GraphVisualizer;
  focusEntity?: string;
  onClose?: () => void;
}

export const KnowledgeGraphPanel: React.FC<KnowledgeGraphPanelProps> = ({
  visualizer,
  focusEntity,
  onClose,
}) => {
  const [visualization, setVisualization] = useState<ASCIIVisualization | null>(null);
  const [layout, setLayout] = useState<LayoutType>(LayoutType.TREE);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    try {
      const viz = visualizer.visualize({
        maxNodes: 20,
        maxDepth: 3,
        layout,
        focusEntity,
        showLabels: true,
        showTypes: true,
      });
      setVisualization(viz);
    } catch (error) {
      console.error('Error visualizing graph:', error);
    }
  }, [visualizer, focusEntity, layout]);

  if (!visualization) {
    return (
      <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
        <Text color="yellow">Loading knowledge graph...</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🧠 Knowledge Graph Visualization
        </Text>
        <Box flexGrow={1} />
        {onClose && (
          <Text color="gray" dimColor>
            Esc to close
          </Text>
        )}
      </Box>

      {/* Graph Visualization */}
      <Box flexDirection="column">
        {visualization.lines.map((line, index) => (
          <Text key={index} color="white">
            {line}
          </Text>
        ))}
      </Box>

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Ctrl+G: Toggle • L: Change Layout • D: Toggle Details
        </Text>
      </Box>
    </Box>
  );
};
