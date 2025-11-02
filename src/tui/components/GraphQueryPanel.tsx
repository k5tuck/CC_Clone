/**
 * Graph Query Panel
 * Interface for executing GQL queries on the knowledge graph
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { QueryResult } from '../../lib/graph-query';
import { Entity, EntityType } from '../../lib/knowledge/types';

interface GraphQueryPanelProps {
  onExecuteQuery: (query: string) => Promise<QueryResult>;
  queryHistory?: string[];
  onClose?: () => void;
}

export const GraphQueryPanel: React.FC<GraphQueryPanelProps> = ({
  onExecuteQuery,
  queryHistory = [],
  onClose,
}) => {
  const [currentResult, setCurrentResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const examples = [
    'MATCH (n:File) RETURN n',
    'MATCH (n:Function) WHERE n.name CONTAINS "handle" RETURN n LIMIT 10',
    'MATCH (n:File)-[r:IMPORTS]->(m) RETURN n, m',
    'MATCH (n)-[*1..3]->(m:Module) WHERE m.name = "react" RETURN n',
    'MATCH (n:Class) WHERE n.data.lineCount > 100 ORDER BY n.data.lineCount DESC',
    'MATCH (n:File) WHERE n.name STARTS_WITH "test" RETURN n',
  ];

  const formatNodeType = (node: Entity): string => {
    switch (node.type) {
      case EntityType.FILE:
        return '📄';
      case EntityType.FUNCTION:
        return '⚡';
      case EntityType.CLASS:
        return '🏛️';
      case EntityType.MODULE:
        return '📦';
      case EntityType.AGENT:
        return '🤖';
      case EntityType.TASK:
        return '✓';
      case EntityType.CONVERSATION:
        return '💬';
      case EntityType.ERROR:
        return '❌';
      case EntityType.SOLUTION:
        return '✅';
      default:
        return '📍';
    }
  };

  const truncate = (str: string, maxLen: number): string => {
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="blue"
      paddingX={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="blue">
          🔍 Graph Query Language (GQL)
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          Ctrl+Shift+Q
        </Text>
      </Box>

      {/* Quick Reference */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">
          📖 Quick Reference:
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text color="cyan">MATCH (n:Type) - Match nodes of type</Text>
          <Text color="cyan">WHERE field = &quot;value&quot; - Filter results</Text>
          <Text color="cyan">-[r:TYPE]-&gt; - Traverse edges</Text>
          <Text color="cyan">RETURN n - Return results</Text>
          <Text color="cyan">LIMIT 10 - Limit results</Text>
          <Text color="cyan">ORDER BY field DESC - Sort results</Text>
        </Box>
      </Box>

      {/* Operators */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">
          🔧 Operators:
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text color="gray">
            = != {'>'} {'<'} CONTAINS STARTS_WITH ENDS_WITH MATCHES
          </Text>
        </Box>
      </Box>

      {/* Query Examples */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="white">
          💡 Example Queries:
        </Text>
        {examples.map((example, index) => (
          <Box key={index} paddingLeft={2}>
            <Text color="green">{index + 1}. </Text>
            <Text color="gray">{example}</Text>
          </Box>
        ))}
      </Box>

      {/* Query History */}
      {queryHistory.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            📜 Recent Queries:
          </Text>
          {queryHistory.slice(-5).reverse().map((query, index) => (
            <Box key={index} paddingLeft={2}>
              <Text color="yellow">• </Text>
              <Text color="gray" dimColor>
                {truncate(query, 60)}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Current Result */}
      {currentResult && !isExecuting && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">
            ✅ Query Results:
          </Text>

          {/* Stats */}
          <Box paddingLeft={2} marginTop={1}>
            <Text color="cyan">
              Nodes: {currentResult.stats.nodesMatched} |
              Edges: {currentResult.stats.edgesTraversed} |
              Time: {currentResult.stats.executionTime}ms
            </Text>
          </Box>

          {/* Nodes */}
          {currentResult.nodes.length > 0 ? (
            <Box flexDirection="column" paddingLeft={2} marginTop={1}>
              <Text color="white">Nodes ({currentResult.nodes.length}):</Text>
              {currentResult.nodes.slice(0, 10).map((node, index) => (
                <Box key={node.id} paddingLeft={2}>
                  <Text color="green">
                    {formatNodeType(node)} {node.type}:{' '}
                  </Text>
                  <Text color="white">{truncate(node.name || node.id, 40)}</Text>
                </Box>
              ))}
              {currentResult.nodes.length > 10 && (
                <Box paddingLeft={2}>
                  <Text color="gray" dimColor>
                    ... and {currentResult.nodes.length - 10} more nodes
                  </Text>
                </Box>
              )}
            </Box>
          ) : (
            <Box paddingLeft={2} marginTop={1}>
              <Text color="yellow">No nodes matched</Text>
            </Box>
          )}

          {/* Edges */}
          {currentResult.edges.length > 0 && (
            <Box flexDirection="column" paddingLeft={2} marginTop={1}>
              <Text color="white">Edges ({currentResult.edges.length}):</Text>
              {currentResult.edges.slice(0, 5).map((edge, index) => (
                <Box key={`${edge.source}-${edge.target}`} paddingLeft={2}>
                  <Text color="magenta">
                    {truncate(edge.source, 20)} --[{edge.type}]-&gt; {truncate(edge.target, 20)}
                  </Text>
                </Box>
              ))}
              {currentResult.edges.length > 5 && (
                <Box paddingLeft={2}>
                  <Text color="gray" dimColor>
                    ... and {currentResult.edges.length - 5} more edges
                  </Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Executing State */}
      {isExecuting && (
        <Box paddingLeft={2} marginBottom={1}>
          <Text color="yellow">⏳ Executing query...</Text>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
          <Text bold color="red">
            ❌ Error:
          </Text>
          <Box paddingLeft={2}>
            <Text color="red">{error}</Text>
          </Box>
        </Box>
      )}

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Type GQL queries in the input to query the knowledge graph. Use /gql followed by your query.
        </Text>
      </Box>
    </Box>
  );
};
