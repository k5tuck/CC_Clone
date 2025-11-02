/**
 * Search Modal Component
 * Main search interface with input and results
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { SearchEngine, SearchResult, SearchResultType } from '../../lib/search';
import { SearchResultItem } from './SearchResultItem';

interface SearchModalProps {
  searchEngine: SearchEngine;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  searchEngine,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);

  // Perform search
  useEffect(() => {
    const performSearch = async () => {
      if (query.trim().length === 0) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      const startTime = Date.now();

      try {
        const searchResults = await searchEngine.search(query, {
          maxResults: 20,
          fuzzy: true,
          caseSensitive: false,
          includeContent: true,
        });

        setResults(searchResults);
        setSearchTime(Date.now() - startTime);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(performSearch, 150);
    return () => clearTimeout(timeoutId);
  }, [query, searchEngine]);

  // Handle keyboard input
  useInput((input, key) => {
    // Close on Escape
    if (key.escape) {
      onClose();
      return;
    }

    // Navigate results
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    // Select result
    if (key.return && results.length > 0 && selectedIndex >= 0) {
      onSelect(results[selectedIndex]);
      onClose();
      return;
    }

    // Delete character
    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
      return;
    }

    // Add character
    if (input && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + input);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      width={80}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔍 Universal Search
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          Esc to close
        </Text>
      </Box>

      {/* Search Input */}
      <Box
        borderStyle="single"
        borderColor="blue"
        paddingLeft={1}
        paddingRight={1}
        marginBottom={1}
      >
        <Text color="blue">&gt; </Text>
        <Text>{query}</Text>
        <Text backgroundColor="white"> </Text>
      </Box>

      {/* Search Stats */}
      <Box marginBottom={1}>
        {isSearching ? (
          <Text color="yellow">Searching...</Text>
        ) : (
          <Box>
            <Text color="gray">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </Text>
            {searchTime > 0 && (
              <Text color="gray" dimColor>
                {' '}
                ({searchTime}ms)
              </Text>
            )}
          </Box>
        )}
      </Box>

      {/* Results List */}
      <Box flexDirection="column" height={15}>
        {results.length === 0 && query.trim().length > 0 && !isSearching && (
          <Box paddingLeft={2}>
            <Text color="gray" dimColor>
              No results found
            </Text>
          </Box>
        )}

        {results.length === 0 && query.trim().length === 0 && (
          <Box flexDirection="column" paddingLeft={2}>
            <Text color="gray" dimColor>
              Start typing to search...
            </Text>
            <Box marginTop={1}>
              <Text color="gray" dimColor>
                Search across:
              </Text>
            </Box>
            <Box paddingLeft={2} flexDirection="column">
              <Text color="gray" dimColor>
                📄 Files (name and content)
              </Text>
              <Text color="gray" dimColor>
                💬 Conversations
              </Text>
              <Text color="gray" dimColor>
                🤖 Agents
              </Text>
              <Text color="gray" dimColor>
                🧠 Knowledge Graph
              </Text>
              <Text color="gray" dimColor>
                ⌨️ Commands
              </Text>
            </Box>
          </Box>
        )}

        {results.map((result, index) => (
          <SearchResultItem
            key={result.id}
            result={result}
            isSelected={index === selectedIndex}
            index={index}
          />
        ))}
      </Box>

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          ↑↓ Navigate • Enter Select • Esc Close
        </Text>
      </Box>
    </Box>
  );
};
