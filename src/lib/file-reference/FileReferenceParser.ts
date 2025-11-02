/**
 * File Reference System
 * Parses @file references and loads them into context
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File reference types
 */
export enum ReferenceType {
  FILE = 'file',           // @file.ts
  DIRECTORY = 'directory', // @src/
  LINE_RANGE = 'range',    // @file.ts:10-20
  FUNCTION = 'function',   // @file.ts:functionName
  CLASS = 'class',         // @file.ts:ClassName
  WILDCARD = 'wildcard',   // @src/**/*.ts
}

/**
 * Parsed file reference
 */
export interface FileReference {
  original: string;
  type: ReferenceType;
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  symbol?: string;
  pattern?: string;
}

/**
 * Resolved reference with content
 */
export interface ResolvedReference {
  reference: FileReference;
  resolvedPath: string;
  content: string;
  lineCount: number;
  size: number;
  exists: boolean;
  error?: string;
}

/**
 * Reference statistics
 */
export interface ReferenceStats {
  totalReferences: number;
  byType: Map<ReferenceType, number>;
  totalSize: number;
  totalLines: number;
  resolved: number;
  failed: number;
}

/**
 * File Reference Parser
 */
export class FileReferenceParser extends EventEmitter {
  private workingDirectory: string;
  private maxFileSize = 1024 * 1024; // 1MB
  private maxTotalSize = 10 * 1024 * 1024; // 10MB

  constructor(workingDirectory: string) {
    super();
    this.workingDirectory = workingDirectory;
  }

  /**
   * Parse references from text
   */
  parseReferences(text: string): FileReference[] {
    const references: FileReference[] = [];

    // Match @references with various patterns
    // Patterns:
    // @file.ts
    // @src/file.ts
    // @file.ts:10-20
    // @file.ts:functionName
    // @src/**/*.ts

    const patterns = [
      // @file.ts:10-20 (line range)
      /@([\w\-./]+\.\w+):(\d+)-(\d+)/g,

      // @file.ts:symbolName (function/class)
      /@([\w\-./]+\.\w+):([\w]+)/g,

      // @src/**/*.ts (wildcard)
      /@([\w\-./]+\/\*\*\/\*\.\w+)/g,

      // @src/ (directory)
      /@([\w\-./]+\/)/g,

      // @file.ts (file)
      /@([\w\-./]+\.\w+)/g,
    ];

    // Extract all @references
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const reference = this.parseReference(match[0]);
        if (reference) {
          // Avoid duplicates
          if (!references.some(r => r.original === reference.original)) {
            references.push(reference);
          }
        }
      }
    }

    return references;
  }

  /**
   * Parse a single reference
   */
  private parseReference(refString: string): FileReference | null {
    // Remove @ prefix
    const cleaned = refString.slice(1);

    // Check for line range: file.ts:10-20
    const rangeMatch = cleaned.match(/^([\w\-./]+\.\w+):(\d+)-(\d+)$/);
    if (rangeMatch) {
      return {
        original: refString,
        type: ReferenceType.LINE_RANGE,
        filePath: rangeMatch[1],
        lineStart: parseInt(rangeMatch[2]),
        lineEnd: parseInt(rangeMatch[3]),
      };
    }

    // Check for symbol: file.ts:symbolName
    const symbolMatch = cleaned.match(/^([\w\-./]+\.\w+):([\w]+)$/);
    if (symbolMatch) {
      return {
        original: refString,
        type: ReferenceType.FUNCTION, // Could be function or class
        filePath: symbolMatch[1],
        symbol: symbolMatch[2],
      };
    }

    // Check for wildcard: src/**/*.ts
    if (cleaned.includes('**')) {
      return {
        original: refString,
        type: ReferenceType.WILDCARD,
        filePath: cleaned.split('**')[0],
        pattern: cleaned,
      };
    }

    // Check for directory: src/
    if (cleaned.endsWith('/')) {
      return {
        original: refString,
        type: ReferenceType.DIRECTORY,
        filePath: cleaned,
      };
    }

    // Regular file: file.ts
    if (cleaned.includes('.')) {
      return {
        original: refString,
        type: ReferenceType.FILE,
        filePath: cleaned,
      };
    }

    return null;
  }

  /**
   * Resolve references to actual content
   */
  async resolveReferences(references: FileReference[]): Promise<ResolvedReference[]> {
    const resolved: ResolvedReference[] = [];
    let totalSize = 0;

    for (const reference of references) {
      if (totalSize >= this.maxTotalSize) {
        this.emit('size-limit-exceeded', { totalSize, maxSize: this.maxTotalSize });
        break;
      }

      try {
        const result = await this.resolveReference(reference);
        if (result) {
          totalSize += result.size;
          resolved.push(result);
        }
      } catch (error) {
        resolved.push({
          reference,
          resolvedPath: '',
          content: '',
          lineCount: 0,
          size: 0,
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.emit('references:resolved', {
      total: references.length,
      resolved: resolved.filter(r => r.exists).length,
      totalSize,
    });

    return resolved;
  }

  /**
   * Resolve a single reference
   */
  private async resolveReference(reference: FileReference): Promise<ResolvedReference | null> {
    const fullPath = path.resolve(this.workingDirectory, reference.filePath);

    switch (reference.type) {
      case ReferenceType.FILE:
        return await this.resolveFile(reference, fullPath);

      case ReferenceType.LINE_RANGE:
        return await this.resolveLineRange(reference, fullPath);

      case ReferenceType.FUNCTION:
      case ReferenceType.CLASS:
        return await this.resolveSymbol(reference, fullPath);

      case ReferenceType.DIRECTORY:
        return await this.resolveDirectory(reference, fullPath);

      case ReferenceType.WILDCARD:
        return await this.resolveWildcard(reference, fullPath);

      default:
        return null;
    }
  }

  /**
   * Resolve a file reference
   */
  private async resolveFile(reference: FileReference, fullPath: string): Promise<ResolvedReference> {
    try {
      const stats = await fs.stat(fullPath);

      if (stats.size > this.maxFileSize) {
        return {
          reference,
          resolvedPath: fullPath,
          content: '',
          lineCount: 0,
          size: stats.size,
          exists: true,
          error: `File too large (${Math.round(stats.size / 1024)}KB > ${this.maxFileSize / 1024}KB)`,
        };
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const lineCount = content.split('\n').length;

      return {
        reference,
        resolvedPath: fullPath,
        content,
        lineCount,
        size: stats.size,
        exists: true,
      };
    } catch (error) {
      return {
        reference,
        resolvedPath: fullPath,
        content: '',
        lineCount: 0,
        size: 0,
        exists: false,
        error: error instanceof Error ? error.message : 'File not found',
      };
    }
  }

  /**
   * Resolve a line range reference
   */
  private async resolveLineRange(reference: FileReference, fullPath: string): Promise<ResolvedReference> {
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      const start = Math.max(0, (reference.lineStart || 1) - 1);
      const end = Math.min(lines.length, reference.lineEnd || lines.length);

      const selectedLines = lines.slice(start, end).join('\n');
      const size = Buffer.byteLength(selectedLines, 'utf-8');

      return {
        reference,
        resolvedPath: fullPath,
        content: selectedLines,
        lineCount: end - start,
        size,
        exists: true,
      };
    } catch (error) {
      return {
        reference,
        resolvedPath: fullPath,
        content: '',
        lineCount: 0,
        size: 0,
        exists: false,
        error: error instanceof Error ? error.message : 'File not found',
      };
    }
  }

  /**
   * Resolve a symbol (function/class) reference
   */
  private async resolveSymbol(reference: FileReference, fullPath: string): Promise<ResolvedReference> {
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Simple regex-based symbol extraction
      // For production, use proper AST parsing
      const symbol = reference.symbol!;
      const patterns = [
        new RegExp(`(function|const)\\s+${symbol}\\s*[=(]`, 'i'),
        new RegExp(`class\\s+${symbol}\\s*`, 'i'),
        new RegExp(`export\\s+(function|const|class)\\s+${symbol}\\s*`, 'i'),
      ];

      let startLine = -1;
      for (let i = 0; i < lines.length; i++) {
        for (const pattern of patterns) {
          if (pattern.test(lines[i])) {
            startLine = i;
            break;
          }
        }
        if (startLine !== -1) break;
      }

      if (startLine === -1) {
        return {
          reference,
          resolvedPath: fullPath,
          content: '',
          lineCount: 0,
          size: 0,
          exists: true,
          error: `Symbol '${symbol}' not found`,
        };
      }

      // Extract the function/class body
      // Simple brace counting
      let endLine = startLine;
      let braceCount = 0;
      let started = false;

      for (let i = startLine; i < lines.length; i++) {
        for (const char of lines[i]) {
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

        if (i - startLine > 500) break; // Safety limit
      }

      const symbolContent = lines.slice(startLine, endLine + 1).join('\n');
      const size = Buffer.byteLength(symbolContent, 'utf-8');

      return {
        reference,
        resolvedPath: fullPath,
        content: symbolContent,
        lineCount: endLine - startLine + 1,
        size,
        exists: true,
      };
    } catch (error) {
      return {
        reference,
        resolvedPath: fullPath,
        content: '',
        lineCount: 0,
        size: 0,
        exists: false,
        error: error instanceof Error ? error.message : 'File not found',
      };
    }
  }

  /**
   * Resolve a directory reference
   */
  private async resolveDirectory(reference: FileReference, fullPath: string): Promise<ResolvedReference> {
    try {
      const files = await fs.readdir(fullPath);
      const fileList = files.join('\n');
      const size = Buffer.byteLength(fileList, 'utf-8');

      return {
        reference,
        resolvedPath: fullPath,
        content: `Directory listing for ${reference.filePath}:\n${fileList}`,
        lineCount: files.length + 1,
        size,
        exists: true,
      };
    } catch (error) {
      return {
        reference,
        resolvedPath: fullPath,
        content: '',
        lineCount: 0,
        size: 0,
        exists: false,
        error: error instanceof Error ? error.message : 'Directory not found',
      };
    }
  }

  /**
   * Resolve a wildcard reference
   */
  private async resolveWildcard(reference: FileReference, basePath: string): Promise<ResolvedReference> {
    // Simplified wildcard - just list matching files
    // For production, use proper glob matching
    try {
      const pattern = reference.pattern || '';
      const ext = pattern.split('.').pop();

      const files = await this.findFiles(basePath, ext || '');
      const fileList = files.slice(0, 50).join('\n'); // Limit to 50 files
      const size = Buffer.byteLength(fileList, 'utf-8');

      return {
        reference,
        resolvedPath: basePath,
        content: `Files matching ${pattern}:\n${fileList}${files.length > 50 ? '\n... and more' : ''}`,
        lineCount: Math.min(files.length + 1, 51),
        size,
        exists: true,
      };
    } catch (error) {
      return {
        reference,
        resolvedPath: basePath,
        content: '',
        lineCount: 0,
        size: 0,
        exists: false,
        error: error instanceof Error ? error.message : 'Pattern match failed',
      };
    }
  }

  /**
   * Find files recursively
   */
  private async findFiles(dirPath: string, ext: string, depth: number = 0): Promise<string[]> {
    if (depth > 5) return []; // Max depth limit

    const files: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            const subFiles = await this.findFiles(fullPath, ext, depth + 1);
            files.push(...subFiles);
          }
        } else if (entry.isFile()) {
          if (ext === '' || entry.name.endsWith(`.${ext}`)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return files;
  }

  /**
   * Get statistics for resolved references
   */
  getStatistics(resolved: ResolvedReference[]): ReferenceStats {
    const byType = new Map<ReferenceType, number>();
    let totalSize = 0;
    let totalLines = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const result of resolved) {
      byType.set(
        result.reference.type,
        (byType.get(result.reference.type) || 0) + 1
      );
      totalSize += result.size;
      totalLines += result.lineCount;

      if (result.exists && !result.error) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return {
      totalReferences: resolved.length,
      byType,
      totalSize,
      totalLines,
      resolved: successCount,
      failed: failedCount,
    };
  }
}

// Singleton instance
let fileReferenceParserInstance: FileReferenceParser | null = null;

/**
 * Get the global file reference parser
 */
export function getFileReferenceParser(workingDirectory?: string): FileReferenceParser {
  if (!fileReferenceParserInstance || workingDirectory) {
    fileReferenceParserInstance = new FileReferenceParser(
      workingDirectory || process.cwd()
    );
  }
  return fileReferenceParserInstance;
}
