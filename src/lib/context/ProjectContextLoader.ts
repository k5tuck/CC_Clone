import fs from 'fs/promises';
import path from 'path';

/**
 * Custom exception for project context operations
 */
export class ProjectContextError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ProjectContextError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * File metadata interface
 */
interface FileMetadata {
  path: string;
  relativePath: string;
  size: number;
  extension: string;
  type: 'code' | 'config' | 'documentation' | 'data' | 'other';
}

/**
 * Project structure interface
 */
interface ProjectStructure {
  rootPath: string;
  files: FileMetadata[];
  directories: string[];
  summary: {
    totalFiles: number;
    totalDirectories: number;
    fileTypes: Record<string, number>;
    largestFiles: FileMetadata[];
  };
}

/**
 * Project Context Loader
 * Provides automatic project structure awareness to agents
 * Language-agnostic - works with any programming language
 */
export class ProjectContextLoader {
  private readonly ignoredPatterns = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.next/,
    /coverage/,
    /\.turbo/,
    /\.DS_Store/,
    /\.env\.local/,
    /\.log$/,
    /\.lock$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /target\//,  // Rust
    /bin\//,     // Go/Java
    /obj\//,     // C#
    /__pycache__/, // Python
    /\.pyc$/,
    /venv/,
    /\.venv/,
  ];

  private readonly codeExtensions = new Set([
    // JavaScript/TypeScript
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    // Python
    '.py', '.pyw',
    // Java/Kotlin
    '.java', '.kt', '.kts',
    // C/C++
    '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
    // C#
    '.cs',
    // Go
    '.go',
    // Rust
    '.rs',
    // Ruby
    '.rb',
    // PHP
    '.php',
    // Swift
    '.swift',
    // Shell
    '.sh', '.bash', '.zsh',
    // Other
    '.scala', '.clj', '.ex', '.exs', '.erl', '.hs'
  ]);

  private readonly configExtensions = new Set([
    '.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.config',
    '.xml', '.properties', '.conf'
  ]);

  private readonly docExtensions = new Set([
    '.md', '.txt', '.rst', '.adoc', '.pdf'
  ]);

  constructor(private readonly rootPath: string) {
    if (!rootPath) {
      throw new ProjectContextError(
        'Root path is required',
        'constructor',
        { rootPath }
      );
    }
  }

  /**
   * Load project structure
   */
  async loadProjectStructure(): Promise<ProjectStructure> {
    try {
      const files: FileMetadata[] = [];
      const directories: string[] = [];

      await this.scanDirectory(this.rootPath, files, directories);

      const fileTypes: Record<string, number> = {};
      files.forEach(file => {
        fileTypes[file.type] = (fileTypes[file.type] || 0) + 1;
      });

      const largestFiles = [...files]
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

      return {
        rootPath: this.rootPath,
        files,
        directories,
        summary: {
          totalFiles: files.length,
          totalDirectories: directories.length,
          fileTypes,
          largestFiles,
        },
      };
    } catch (error) {
      throw new ProjectContextError(
        'Failed to load project structure',
        'loadProjectStructure',
        { 
          rootPath: this.rootPath, 
          error: error instanceof Error ? error.message : String(error) 
        }
      );
    }
  }

  /**
   * Generate context summary for LLM - Language agnostic
   */
  async generateContextSummary(): Promise<string> {
    const structure = await this.loadProjectStructure();
    
    let summary = `# Project Context\n\n`;
    summary += `**Root Directory:** ${structure.rootPath}\n`;
    summary += `**Total Files:** ${structure.summary.totalFiles}\n`;
    summary += `**Total Directories:** ${structure.summary.totalDirectories}\n\n`;

    // README info (if exists)
    try {
      const readmePath = await this.findReadme();
      if (readmePath) {
        const readme = await fs.readFile(readmePath, 'utf-8');
        const firstSection = readme.split('\n').slice(0, 20).join('\n');
        summary += `## README Preview\n\`\`\`\n${firstSection}\n...\n\`\`\`\n\n`;
      }
    } catch {
      // README not found - skip
    }

    // File type breakdown
    summary += `## File Type Distribution\n`;
    for (const [type, count] of Object.entries(structure.summary.fileTypes)) {
      summary += `- **${type}:** ${count} files\n`;
    }
    summary += '\n';

    // Extension breakdown (language detection)
    const extensionCounts: Record<string, number> = {};
    structure.files.forEach(file => {
      if (file.extension) {
        extensionCounts[file.extension] = (extensionCounts[file.extension] || 0) + 1;
      }
    });

    const topExtensions = Object.entries(extensionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (topExtensions.length > 0) {
      summary += `## Primary File Extensions\n`;
      topExtensions.forEach(([ext, count]) => {
        summary += `- **${ext}:** ${count} files\n`;
      });
      summary += '\n';
    }

    // Directory structure (top level)
    summary += `## Directory Structure (Top Level)\n`;
    const topLevelDirs = structure.directories
      .filter(dir => !dir.includes('/') && !dir.includes('\\'))
      .slice(0, 20);
    topLevelDirs.forEach(dir => {
      summary += `- ${dir}/\n`;
    });
    summary += '\n';

    // Key files
    summary += `## Key Files\n`;
    const keyFiles = structure.files
      .filter(f => 
        f.relativePath.includes('src/') ||
        f.relativePath.includes('lib/') ||
        f.relativePath.includes('main') ||
        f.extension === '.md' ||
        f.relativePath.match(/readme|license|makefile|dockerfile|cargo\.toml|go\.mod|requirements\.txt|setup\.py/i)
      )
      .slice(0, 30);
    
    keyFiles.forEach(file => {
      summary += `- ${file.relativePath} (${this.formatBytes(file.size)}, ${file.type})\n`;
    });

    return summary;
  }

  /**
   * Get specific file content for context
   */
  async getFileContent(relativePath: string): Promise<string> {
    try {
      const fullPath = path.join(this.rootPath, relativePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      throw new ProjectContextError(
        'Failed to read file',
        'getFileContent',
        { 
          relativePath, 
          error: error instanceof Error ? error.message : String(error) 
        }
      );
    }
  }

  /**
   * Find README file
   */
  private async findReadme(): Promise<string | null> {
    const readmeNames = ['README.md', 'README.txt', 'README', 'readme.md', 'Readme.md'];
    
    for (const name of readmeNames) {
      try {
        const readmePath = path.join(this.rootPath, name);
        await fs.access(readmePath);
        return readmePath;
      } catch {
        continue;
      }
    }
    
    return null;
  }

  /**
   * Scan directory recursively
   */
  private async scanDirectory(
    dirPath: string,
    files: FileMetadata[],
    directories: string[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.rootPath, fullPath);

        if (this.shouldIgnore(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          directories.push(relativePath);
          await this.scanDirectory(fullPath, files, directories);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            const extension = path.extname(entry.name).toLowerCase();
            
            files.push({
              path: fullPath,
              relativePath,
              size: stats.size,
              extension,
              type: this.determineFileType(extension),
            });
          } catch (error) {
            // Skip files we can't stat
            console.warn(`Could not stat file: ${relativePath}`);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Could not read directory: ${dirPath}`);
    }
  }

  /**
   * Check if path should be ignored
   */
  private shouldIgnore(relativePath: string): boolean {
    return this.ignoredPatterns.some(pattern => pattern.test(relativePath));
  }

  /**
   * Determine file type from extension
   */
  private determineFileType(extension: string): FileMetadata['type'] {
    if (this.codeExtensions.has(extension)) {
      return 'code';
    }
    if (this.configExtensions.has(extension)) {
      return 'config';
    }
    if (this.docExtensions.has(extension)) {
      return 'documentation';
    }
    if (['.csv', '.json', '.xml', '.sql'].includes(extension)) {
      return 'data';
    }
    return 'other';
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}

/**
 * Create project context for agent initialization
 */
export async function createProjectContext(rootPath: string = process.cwd()): Promise<string> {
  const loader = new ProjectContextLoader(rootPath);
  return await loader.generateContextSummary();
}

/**
 * Load project context into agent's system message
 */
export async function enhanceSystemMessageWithProjectContext(
  baseSystemMessage: string,
  rootPath: string = process.cwd()
): Promise<string> {
  try {
    const projectContext = await createProjectContext(rootPath);
    
    return `${baseSystemMessage}

---

# CURRENT PROJECT CONTEXT

The following information describes the current project structure you're working in. 
Use this context when answering questions or executing tasks.

${projectContext}

---

When asked about "this project", "the current codebase", or similar references, 
refer to the project context above. You have access to file tools to read specific 
files when needed.`;
  } catch (error) {
    console.error('Failed to load project context:', error);
    return baseSystemMessage;
  }
}