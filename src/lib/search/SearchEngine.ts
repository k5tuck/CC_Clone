/**
 * Universal Search Engine
 * Provides fast search across conversations, files, agents, and knowledge graph
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/**
 * Search result type
 */
export enum SearchResultType {
  CONVERSATION = 'conversation',
  FILE = 'file',
  AGENT = 'agent',
  KNOWLEDGE = 'knowledge',
  COMMAND = 'command',
}

/**
 * Search result
 */
export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description?: string;
  preview?: string;
  filePath?: string;
  lineNumber?: number;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Search options
 */
export interface SearchOptions {
  types?: SearchResultType[];
  maxResults?: number;
  fuzzy?: boolean;
  caseSensitive?: boolean;
  includeContent?: boolean;
}

/**
 * Search history item
 */
export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount: number;
}

/**
 * Search statistics
 */
export interface SearchStats {
  totalSearches: number;
  averageResultCount: number;
  mostSearchedQueries: string[];
  recentSearches: SearchHistoryItem[];
}

/**
 * Universal Search Engine
 */
export class SearchEngine extends EventEmitter {
  private searchHistory: SearchHistoryItem[] = [];
  private maxHistorySize = 100;
  private workingDirectory: string;

  constructor(workingDirectory: string = process.cwd()) {
    super();
    this.workingDirectory = workingDirectory;
  }

  /**
   * Execute a search query
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const results: SearchResult[] = [];

    const {
      types = Object.values(SearchResultType),
      maxResults = 50,
      fuzzy = true,
      caseSensitive = false,
      includeContent = true,
    } = options;

    try {
      // Search across different types
      if (types.includes(SearchResultType.FILE)) {
        const fileResults = await this.searchFiles(query, {
          fuzzy,
          caseSensitive,
          includeContent,
        });
        results.push(...fileResults);
      }

      if (types.includes(SearchResultType.CONVERSATION)) {
        const conversationResults = await this.searchConversations(query, {
          fuzzy,
          caseSensitive,
        });
        results.push(...conversationResults);
      }

      if (types.includes(SearchResultType.AGENT)) {
        const agentResults = await this.searchAgents(query, { fuzzy, caseSensitive });
        results.push(...agentResults);
      }

      if (types.includes(SearchResultType.KNOWLEDGE)) {
        const knowledgeResults = await this.searchKnowledge(query, {
          fuzzy,
          caseSensitive,
        });
        results.push(...knowledgeResults);
      }

      if (types.includes(SearchResultType.COMMAND)) {
        const commandResults = await this.searchCommands(query, { fuzzy, caseSensitive });
        results.push(...commandResults);
      }

      // Sort by score and limit results
      const sortedResults = results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      // Record search in history
      this.addToHistory({
        query,
        timestamp: Date.now(),
        resultCount: sortedResults.length,
      });

      // Emit search event
      const duration = Date.now() - startTime;
      this.emit('search', {
        query,
        resultCount: sortedResults.length,
        duration,
      });

      return sortedResults;
    } catch (error) {
      this.emit('error', { query, error });
      throw error;
    }
  }

  /**
   * Recursively search for files
   */
  private async findFiles(
    dir: string,
    query: string,
    options: { fuzzy: boolean; caseSensitive: boolean },
    maxFiles: number = 20
  ): Promise<string[]> {
    const results: string[] = [];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

    const searchTerm = options.caseSensitive ? query : query.toLowerCase();

    const search = async (currentDir: string, depth: number = 0): Promise<void> => {
      if (depth > 5 || results.length >= maxFiles) return;

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxFiles) break;

          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(this.workingDirectory, fullPath);

          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              await search(fullPath, depth + 1);
            }
          } else {
            const fileName = options.caseSensitive ? entry.name : entry.name.toLowerCase();
            if (fileName.includes(searchTerm)) {
              results.push(relativePath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await search(dir);
    return results;
  }

  /**
   * Search files
   */
  private async searchFiles(
    query: string,
    options: { fuzzy: boolean; caseSensitive: boolean; includeContent: boolean }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Search file names
      const files = await this.findFiles(this.workingDirectory, query, options, 20);

      for (const file of files) {
        const filePath = path.join(this.workingDirectory, file);
        const score = this.calculateFuzzyScore(query, file, options.caseSensitive);

        results.push({
          id: `file:${file}`,
          type: SearchResultType.FILE,
          title: path.basename(file),
          description: file,
          filePath,
          score,
        });

        // Search file content if requested
        if (options.includeContent && results.length < 50) {
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < Math.min(lines.length, 1000); i++) {
              const line = lines[i];
              const searchTerm = options.caseSensitive ? query : query.toLowerCase();
              const searchLine = options.caseSensitive ? line : line.toLowerCase();

              if (searchLine.includes(searchTerm)) {
                results.push({
                  id: `file:${file}:${i + 1}`,
                  type: SearchResultType.FILE,
                  title: path.basename(file),
                  description: `Line ${i + 1}`,
                  preview: line.trim().slice(0, 100),
                  filePath,
                  lineNumber: i + 1,
                  score: score + 10, // Boost content matches
                });

                // Limit content matches per file
                if (results.filter(r => r.filePath === filePath).length > 5) {
                  break;
                }
              }
            }
          } catch (error) {
            // Skip files that can't be read as text
          }
        }
      }
    } catch (error) {
      // Ignore search errors
    }

    return results;
  }

  /**
   * Search conversations
   */
  private async searchConversations(
    query: string,
    options: { fuzzy: boolean; caseSensitive: boolean }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // TODO: Implement conversation search when session history is available
    // This would search through session manager's conversation history

    return results;
  }

  /**
   * Search agents
   */
  private async searchAgents(
    query: string,
    options: { fuzzy: boolean; caseSensitive: boolean }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Common agent names and descriptions
    const agents = [
      {
        name: 'CodeAnalyst',
        description: 'Analyzes code structure and patterns',
        capabilities: ['code analysis', 'refactoring suggestions', 'best practices'],
      },
      {
        name: 'DocumentationExpert',
        description: 'Generates and maintains documentation',
        capabilities: ['API docs', 'README generation', 'code comments'],
      },
      {
        name: 'TestEngineer',
        description: 'Creates and maintains test suites',
        capabilities: ['unit tests', 'integration tests', 'test coverage'],
      },
      {
        name: 'SecurityAuditor',
        description: 'Identifies security vulnerabilities',
        capabilities: ['vulnerability scanning', 'security best practices', 'OWASP compliance'],
      },
      {
        name: 'PerformanceOptimizer',
        description: 'Optimizes code performance',
        capabilities: ['profiling', 'bottleneck detection', 'optimization suggestions'],
      },
    ];

    for (const agent of agents) {
      const searchTerm = options.caseSensitive ? query : query.toLowerCase();
      const agentName = options.caseSensitive ? agent.name : agent.name.toLowerCase();
      const agentDesc = options.caseSensitive
        ? agent.description
        : agent.description.toLowerCase();

      if (agentName.includes(searchTerm) || agentDesc.includes(searchTerm)) {
        const score = this.calculateFuzzyScore(query, agent.name, options.caseSensitive);
        results.push({
          id: `agent:${agent.name}`,
          type: SearchResultType.AGENT,
          title: agent.name,
          description: agent.description,
          preview: agent.capabilities.join(', '),
          score,
          metadata: { capabilities: agent.capabilities },
        });
      }
    }

    return results;
  }

  /**
   * Search knowledge graph
   */
  private async searchKnowledge(
    query: string,
    options: { fuzzy: boolean; caseSensitive: boolean }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // TODO: Implement knowledge graph search when available
    // This would search through context inspector's knowledge items

    return results;
  }

  /**
   * Search commands
   */
  private async searchCommands(
    query: string,
    options: { fuzzy: boolean; caseSensitive: boolean }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Common commands
    const commands = [
      { name: 'help', description: 'Show help information', shortcut: 'Ctrl+H' },
      { name: 'permissions', description: 'Manage permissions', shortcut: 'Ctrl+P' },
      { name: 'tools', description: 'View tool usage', shortcut: 'Ctrl+U' },
      { name: 'sessions', description: 'Switch sessions', shortcut: 'Ctrl+S' },
      { name: 'context', description: 'Inspect context', shortcut: 'Ctrl+I' },
      { name: 'status', description: 'Show detailed status', shortcut: 'Ctrl+E' },
      { name: 'paste', description: 'Paste from clipboard', shortcut: 'Ctrl+V' },
      { name: 'search', description: 'Search everything', shortcut: 'Ctrl+F' },
    ];

    for (const command of commands) {
      const searchTerm = options.caseSensitive ? query : query.toLowerCase();
      const commandName = options.caseSensitive ? command.name : command.name.toLowerCase();
      const commandDesc = options.caseSensitive
        ? command.description
        : command.description.toLowerCase();

      if (commandName.includes(searchTerm) || commandDesc.includes(searchTerm)) {
        const score = this.calculateFuzzyScore(
          query,
          command.name,
          options.caseSensitive
        );
        results.push({
          id: `command:${command.name}`,
          type: SearchResultType.COMMAND,
          title: command.name,
          description: command.description,
          preview: command.shortcut,
          score,
          metadata: { shortcut: command.shortcut },
        });
      }
    }

    return results;
  }

  /**
   * Calculate fuzzy match score
   */
  private calculateFuzzyScore(
    query: string,
    target: string,
    caseSensitive: boolean
  ): number {
    const q = caseSensitive ? query : query.toLowerCase();
    const t = caseSensitive ? target : target.toLowerCase();

    // Exact match
    if (t === q) return 100;

    // Starts with query
    if (t.startsWith(q)) return 90;

    // Contains query
    if (t.includes(q)) return 70;

    // Fuzzy match
    let score = 0;
    let qIndex = 0;

    for (let i = 0; i < t.length && qIndex < q.length; i++) {
      if (t[i] === q[qIndex]) {
        score += 1;
        qIndex++;
      }
    }

    return qIndex === q.length ? (score / q.length) * 50 : 0;
  }

  /**
   * Add search to history
   */
  private addToHistory(item: SearchHistoryItem): void {
    this.searchHistory.unshift(item);

    // Limit history size
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get search statistics
   */
  getStats(): SearchStats {
    const totalSearches = this.searchHistory.length;
    const averageResultCount =
      totalSearches > 0
        ? this.searchHistory.reduce((sum, item) => sum + item.resultCount, 0) /
          totalSearches
        : 0;

    // Count query frequency
    const queryFrequency = new Map<string, number>();
    for (const item of this.searchHistory) {
      queryFrequency.set(item.query, (queryFrequency.get(item.query) || 0) + 1);
    }

    // Get most searched queries
    const mostSearchedQueries = Array.from(queryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query]) => query);

    return {
      totalSearches,
      averageResultCount,
      mostSearchedQueries,
      recentSearches: this.searchHistory.slice(0, 10),
    };
  }

  /**
   * Get recent searches
   */
  getRecentSearches(limit: number = 10): SearchHistoryItem[] {
    return this.searchHistory.slice(0, limit);
  }

  /**
   * Clear search history
   */
  clearHistory(): void {
    this.searchHistory = [];
    this.emit('historyCleared');
  }
}

// Singleton instance
let searchEngineInstance: SearchEngine | null = null;

/**
 * Get the global search engine instance
 */
export function getSearchEngine(workingDirectory?: string): SearchEngine {
  if (!searchEngineInstance) {
    searchEngineInstance = new SearchEngine(workingDirectory);
  }
  return searchEngineInstance;
}
