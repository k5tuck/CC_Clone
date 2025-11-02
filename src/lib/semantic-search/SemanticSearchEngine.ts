/**
 * Semantic Search Engine
 * Provides semantic search capabilities for code and documentation
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VectorStorage } from '../knowledge/VectorStorage';

/**
 * Search result
 */
export interface SemanticSearchResult {
  id: string;
  type: 'code' | 'documentation' | 'comment' | 'function' | 'class';
  filePath: string;
  content: string;
  score: number;
  startLine?: number;
  endLine?: number;
  context?: string;
  language?: string;
}

/**
 * Code snippet
 */
export interface CodeSnippet {
  id: string;
  filePath: string;
  content: string;
  type: 'function' | 'class' | 'method' | 'interface' | 'type' | 'variable' | 'comment';
  name?: string;
  startLine: number;
  endLine: number;
  language: string;
  embedding?: number[];
}

/**
 * Search options
 */
export interface SemanticSearchOptions {
  maxResults?: number;
  minScore?: number;
  fileTypes?: string[];
  excludePaths?: string[];
  includeContext?: boolean;
  searchType?: 'code' | 'documentation' | 'both';
}

/**
 * Index statistics
 */
export interface IndexStats {
  totalSnippets: number;
  byLanguage: Map<string, number>;
  byType: Map<string, number>;
  totalFiles: number;
  indexedAt: Date;
}

/**
 * Semantic Search Engine
 */
export class SemanticSearchEngine extends EventEmitter {
  private vectorStorage: VectorStorage;
  private snippets: Map<string, CodeSnippet> = new Map();
  private fileIndex: Map<string, string[]> = new Map(); // file -> snippet IDs
  private indexedPaths: Set<string> = new Set();
  private isIndexing: boolean = false;

  constructor(vectorStorage?: VectorStorage) {
    super();
    this.vectorStorage = vectorStorage || new VectorStorage();
  }

  /**
   * Index a directory for semantic search
   */
  async indexDirectory(
    directoryPath: string,
    options: {
      recursive?: boolean;
      fileTypes?: string[];
      excludePaths?: string[];
    } = {}
  ): Promise<void> {
    if (this.isIndexing) {
      throw new Error('Indexing already in progress');
    }

    this.isIndexing = true;
    this.emit('indexing:started', { path: directoryPath });

    try {
      await this.indexDirectoryRecursive(directoryPath, options);
      this.indexedPaths.add(directoryPath);
      this.emit('indexing:completed', {
        path: directoryPath,
        snippetCount: this.snippets.size,
      });
    } catch (error) {
      this.emit('indexing:error', { path: directoryPath, error });
      throw error;
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Index directory recursively
   */
  private async indexDirectoryRecursive(
    dirPath: string,
    options: {
      recursive?: boolean;
      fileTypes?: string[];
      excludePaths?: string[];
    }
  ): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Check if path should be excluded
      if (options.excludePaths?.some(exclude => fullPath.includes(exclude))) {
        continue;
      }

      if (entry.isDirectory()) {
        if (options.recursive !== false) {
          // Skip node_modules, .git, etc.
          if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
            await this.indexDirectoryRecursive(fullPath, options);
          }
        }
      } else if (entry.isFile()) {
        // Check file type
        const ext = path.extname(entry.name);
        if (!options.fileTypes || options.fileTypes.includes(ext)) {
          await this.indexFile(fullPath);
        }
      }
    }
  }

  /**
   * Index a single file
   */
  async indexFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const language = this.detectLanguage(filePath);
      const snippets = await this.extractSnippets(filePath, content, language);

      // Store snippets and create embeddings
      const snippetIds: string[] = [];
      for (const snippet of snippets) {
        this.snippets.set(snippet.id, snippet);
        snippetIds.push(snippet.id);

        // Add to vector storage
        await this.vectorStorage.addItem({
          id: snippet.id,
          content: snippet.content,
          metadata: {
            type: 'code-snippet',
            filePath: snippet.filePath,
            language: snippet.language,
            snippetType: snippet.type,
            name: snippet.name,
            startLine: snippet.startLine,
            endLine: snippet.endLine,
          },
        });
      }

      this.fileIndex.set(filePath, snippetIds);
      this.emit('file:indexed', { filePath, snippetCount: snippets.length });
    } catch (error) {
      this.emit('file:error', { filePath, error });
    }
  }

  /**
   * Extract code snippets from file content
   */
  private async extractSnippets(
    filePath: string,
    content: string,
    language: string
  ): Promise<CodeSnippet[]> {
    const snippets: CodeSnippet[] = [];
    const lines = content.split('\n');

    // Simple extraction based on language patterns
    // For a production system, use proper AST parsing

    if (['ts', 'tsx', 'js', 'jsx'].includes(language)) {
      snippets.push(...this.extractTypeScriptSnippets(filePath, lines, language));
    } else if (['py'].includes(language)) {
      snippets.push(...this.extractPythonSnippets(filePath, lines, language));
    } else {
      // Fallback: create snippets for chunks of code
      snippets.push(...this.extractGenericSnippets(filePath, lines, language));
    }

    return snippets;
  }

  /**
   * Extract TypeScript/JavaScript snippets
   */
  private extractTypeScriptSnippets(
    filePath: string,
    lines: string[],
    language: string
  ): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];

    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
    const classRegex = /(?:export\s+)?class\s+(\w+)/;
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)/;
    const typeRegex = /(?:export\s+)?type\s+(\w+)/;
    const arrowFuncRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match functions
      const funcMatch = line.match(functionRegex);
      if (funcMatch) {
        const snippet = this.extractBlock(filePath, lines, i, language, 'function', funcMatch[1]);
        if (snippet) snippets.push(snippet);
      }

      // Match classes
      const classMatch = line.match(classRegex);
      if (classMatch) {
        const snippet = this.extractBlock(filePath, lines, i, language, 'class', classMatch[1]);
        if (snippet) snippets.push(snippet);
      }

      // Match interfaces
      const interfaceMatch = line.match(interfaceRegex);
      if (interfaceMatch) {
        const snippet = this.extractBlock(filePath, lines, i, language, 'interface', interfaceMatch[1]);
        if (snippet) snippets.push(snippet);
      }

      // Match types
      const typeMatch = line.match(typeRegex);
      if (typeMatch) {
        const snippet = this.extractBlock(filePath, lines, i, language, 'type', typeMatch[1]);
        if (snippet) snippets.push(snippet);
      }

      // Match arrow functions
      const arrowMatch = line.match(arrowFuncRegex);
      if (arrowMatch) {
        const snippet = this.extractBlock(filePath, lines, i, language, 'function', arrowMatch[1]);
        if (snippet) snippets.push(snippet);
      }

      // Match comments
      if (line.trim().startsWith('/**')) {
        const snippet = this.extractComment(filePath, lines, i, language);
        if (snippet) snippets.push(snippet);
      }
    }

    return snippets;
  }

  /**
   * Extract Python snippets
   */
  private extractPythonSnippets(
    filePath: string,
    lines: string[],
    language: string
  ): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];

    const functionRegex = /def\s+(\w+)/;
    const classRegex = /class\s+(\w+)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const funcMatch = line.match(functionRegex);
      if (funcMatch) {
        const snippet = this.extractPythonBlock(filePath, lines, i, language, 'function', funcMatch[1]);
        if (snippet) snippets.push(snippet);
      }

      const classMatch = line.match(classRegex);
      if (classMatch) {
        const snippet = this.extractPythonBlock(filePath, lines, i, language, 'class', classMatch[1]);
        if (snippet) snippets.push(snippet);
      }
    }

    return snippets;
  }

  /**
   * Extract generic code snippets (fallback)
   */
  private extractGenericSnippets(
    filePath: string,
    lines: string[],
    language: string
  ): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];
    const chunkSize = 20; // Lines per snippet

    for (let i = 0; i < lines.length; i += chunkSize) {
      const endLine = Math.min(i + chunkSize, lines.length);
      const content = lines.slice(i, endLine).join('\n').trim();

      if (content.length > 50) {
        // Only create snippet if it has meaningful content
        snippets.push({
          id: `snippet_${filePath}_${i}`,
          filePath,
          content,
          type: 'comment',
          startLine: i + 1,
          endLine,
          language,
        });
      }
    }

    return snippets;
  }

  /**
   * Extract a code block (for braces-based languages)
   */
  private extractBlock(
    filePath: string,
    lines: string[],
    startLine: number,
    language: string,
    type: CodeSnippet['type'],
    name: string
  ): CodeSnippet | null {
    let braceCount = 0;
    let endLine = startLine;
    let started = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (started && braceCount === 0) {
        endLine = i;
        break;
      }

      // Safety limit
      if (i - startLine > 500) break;
    }

    const content = lines.slice(startLine, endLine + 1).join('\n').trim();
    if (content.length < 10) return null;

    return {
      id: `snippet_${filePath}_${startLine}`,
      filePath,
      content,
      type,
      name,
      startLine: startLine + 1,
      endLine: endLine + 1,
      language,
    };
  }

  /**
   * Extract a Python block (indentation-based)
   */
  private extractPythonBlock(
    filePath: string,
    lines: string[],
    startLine: number,
    language: string,
    type: CodeSnippet['type'],
    name: string
  ): CodeSnippet | null {
    const startIndent = lines[startLine].search(/\S/);
    let endLine = startLine;

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue; // Skip empty lines

      const indent = lines[i].search(/\S/);
      if (indent <= startIndent && line !== '') {
        endLine = i - 1;
        break;
      }

      // Safety limit
      if (i - startLine > 500) {
        endLine = i;
        break;
      }
    }

    const content = lines.slice(startLine, endLine + 1).join('\n').trim();
    if (content.length < 10) return null;

    return {
      id: `snippet_${filePath}_${startLine}`,
      filePath,
      content,
      type,
      name,
      startLine: startLine + 1,
      endLine: endLine + 1,
      language,
    };
  }

  /**
   * Extract a comment block
   */
  private extractComment(
    filePath: string,
    lines: string[],
    startLine: number,
    language: string
  ): CodeSnippet | null {
    let endLine = startLine;

    for (let i = startLine; i < lines.length; i++) {
      if (lines[i].includes('*/')) {
        endLine = i;
        break;
      }

      if (i - startLine > 50) break;
    }

    const content = lines.slice(startLine, endLine + 1).join('\n').trim();

    return {
      id: `comment_${filePath}_${startLine}`,
      filePath,
      content,
      type: 'comment',
      startLine: startLine + 1,
      endLine: endLine + 1,
      language,
    };
  }

  /**
   * Detect programming language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.js': 'js',
      '.jsx': 'jsx',
      '.py': 'py',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'cs',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
    };

    return languageMap[ext] || 'unknown';
  }

  /**
   * Perform semantic search
   */
  async search(query: string, options: SemanticSearchOptions = {}): Promise<SemanticSearchResult[]> {
    const {
      maxResults = 10,
      minScore = 0.5,
      includeContext = true,
    } = options;

    // Search in vector storage
    const vectorResults = await this.vectorStorage.search(query, maxResults * 2);

    // Convert to search results
    const results: SemanticSearchResult[] = [];

    for (const result of vectorResults) {
      if (result.score < minScore) continue;

      const snippet = this.snippets.get(result.item.id);
      if (!snippet) continue;

      // Apply filters
      if (options.fileTypes) {
        const ext = path.extname(snippet.filePath);
        if (!options.fileTypes.includes(ext)) continue;
      }

      if (options.excludePaths) {
        if (options.excludePaths.some(exclude => snippet.filePath.includes(exclude))) {
          continue;
        }
      }

      results.push({
        id: snippet.id,
        type: snippet.type === 'comment' ? 'comment' : 'code',
        filePath: snippet.filePath,
        content: snippet.content,
        score: result.score,
        startLine: snippet.startLine,
        endLine: snippet.endLine,
        context: includeContext ? snippet.name : undefined,
        language: snippet.language,
      });

      if (results.length >= maxResults) break;
    }

    this.emit('search:completed', { query, resultCount: results.length });
    return results;
  }

  /**
   * Find similar code snippets
   */
  async findSimilar(snippetId: string, maxResults: number = 5): Promise<SemanticSearchResult[]> {
    const snippet = this.snippets.get(snippetId);
    if (!snippet) return [];

    return this.search(snippet.content, { maxResults, includeContext: true });
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    const byLanguage = new Map<string, number>();
    const byType = new Map<string, number>();

    for (const snippet of this.snippets.values()) {
      byLanguage.set(snippet.language, (byLanguage.get(snippet.language) || 0) + 1);
      byType.set(snippet.type, (byType.get(snippet.type) || 0) + 1);
    }

    return {
      totalSnippets: this.snippets.size,
      byLanguage,
      byType,
      totalFiles: this.fileIndex.size,
      indexedAt: new Date(),
    };
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.snippets.clear();
    this.fileIndex.clear();
    this.indexedPaths.clear();
    this.emit('index:cleared');
  }
}

// Singleton instance
let semanticSearchInstance: SemanticSearchEngine | null = null;

/**
 * Get the global semantic search engine
 */
export function getSemanticSearchEngine(): SemanticSearchEngine {
  if (!semanticSearchInstance) {
    semanticSearchInstance = new SemanticSearchEngine();
  }
  return semanticSearchInstance;
}
