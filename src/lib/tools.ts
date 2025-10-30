import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { Agent } from './agent';
import { Tool } from './llm/ollama-client';
import { promisify } from 'util';

const execp = promisify(exec);

/**
 * Custom exception for tool execution errors
 */
class ToolExecutionError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly params: Record<string, any>,
    public readonly originalError: Error
  ) {
    super(`Tool "${toolName}" failed: ${originalError.message}`);
    this.name = 'ToolExecutionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

class CommandBlacklistedError extends Error {
  constructor(
    public readonly command: string,
    public readonly matchedPattern: string
  ) {
    super(`Command blocked by security policy: matched pattern "${matchedPattern}"`);
    this.name = 'CommandBlacklistedError';
    Error.captureStackTrace(this, this.constructor);
  }
}

class FileAccessError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly operation: string,
    public readonly originalError: Error
  ) {
    super(`File access failed for ${operation} on "${filePath}": ${originalError.message}`);
    this.name = 'FileAccessError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Register all tools with an agent
 */
export function registerTools(agent: Agent): void {
  // Read File Tool
  agent.registerTool(
    'readFile',
    async ({ path: p }: any) => {
      if (!p || typeof p !== 'string') {
        throw new Error('path parameter is required and must be a string');
      }

      try {
        const resolvedPath = path.resolve(p);
        const content = await fs.readFile(resolvedPath, 'utf-8');
        return { path: resolvedPath, content, size: content.length };
      } catch (error: any) {
        throw new FileAccessError(p, 'read', error);
      }
    },
    {
      name: 'readFile',
      description: 'Read the contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read',
          },
        },
        required: ['path'],
      },
    }
  );

  // Write File Tool
  agent.registerTool(
    'writeFile',
    async ({ path: p, content }: any) => {
      if (!p || typeof p !== 'string') {
        throw new Error('path parameter is required and must be a string');
      }

      try {
        const resolvedPath = path.resolve(p);
        const dir = path.dirname(resolvedPath);
        
        // Ensure directory exists
        await fs.mkdir(dir, { recursive: true });
        
        // Write file
        await fs.writeFile(resolvedPath, content ?? '', 'utf-8');
        
        return { 
          ok: true, 
          path: resolvedPath,
          size: (content ?? '').length 
        };
      } catch (error: any) {
        throw new FileAccessError(p, 'write', error);
      }
    },
    {
      name: 'writeFile',
      description: 'Write content to a file, creating directories as needed',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to write',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['path'],
      },
    }
  );

  // Search Files Tool
  agent.registerTool(
    'searchFiles',
    async ({ dir = '.', pattern = '.*', max = 100 }: any) => {
      try {
        const re = new RegExp(pattern);
        const found: string[] = [];
        
        async function walk(d: string) {
          try {
            const items = await fs.readdir(d, { withFileTypes: true });
            
            for (const it of items) {
              const full = path.join(d, it.name);
              
              if (it.isDirectory()) {
                // Skip node_modules and other common ignore patterns
                if (!['node_modules', '.git', 'dist', 'build'].includes(it.name)) {
                  await walk(full);
                }
              } else {
                if (re.test(it.name)) {
                  found.push(full);
                }
                
                if (found.length >= max) {
                  return;
                }
              }
            }
          } catch (error) {
            // Skip directories we can't read
            console.warn(`Skipping directory ${d}: permission denied`);
          }
        }
        
        const startDir = path.resolve(dir);
        await walk(startDir);
        
        return { 
          results: found.slice(0, max),
          count: found.length,
          truncated: found.length >= max
        };
      } catch (error: any) {
        throw new ToolExecutionError('searchFiles', { dir, pattern, max }, error);
      }
    },
    {
      name: 'searchFiles',
      description: 'Search for files matching a pattern in a directory tree',
      parameters: {
        type: 'object',
        properties: {
          dir: {
            type: 'string',
            description: 'Directory to search (default: current directory)',
          },
          pattern: {
            type: 'string',
            description: 'Regular expression pattern to match filenames (default: .*)',
          },
          max: {
            type: 'number',
            description: 'Maximum number of results (default: 100)',
          },
        },
      },
    }
  );

  // Blob Search Tool (search inside files)
  agent.registerTool(
    'blobSearch',
    async ({ dir = '.', q = '', maxFiles = 50 }: any) => {
      if (!q || typeof q !== 'string') {
        throw new Error('q (query string) parameter is required');
      }

      try {
        const hits: Array<{ path: string; snippet: string; line: number }> = [];
        
        async function walk(d: string) {
          try {
            const items = await fs.readdir(d, { withFileTypes: true });
            
            for (const it of items) {
              const full = path.join(d, it.name);
              
              if (it.isDirectory()) {
                if (!['node_modules', '.git', 'dist', 'build'].includes(it.name)) {
                  await walk(full);
                }
              } else {
                try {
                  const txt = await fs.readFile(full, 'utf-8');
                  
                  if (txt.includes(q)) {
                    const lines = txt.split('\n');
                    const lineNumber = lines.findIndex(line => line.includes(q));
                    const contextStart = Math.max(0, txt.indexOf(q) - 50);
                    const contextEnd = Math.min(txt.length, txt.indexOf(q) + q.length + 90);
                    const snippet = txt.substring(contextStart, contextEnd);
                    
                    hits.push({ 
                      path: full, 
                      snippet: snippet.replace(/\n/g, ' '),
                      line: lineNumber + 1
                    });
                  }
                } catch (e) {
                  // Skip binary files or files we can't read
                }
                
                if (hits.length >= maxFiles) {
                  return;
                }
              }
            }
          } catch (error) {
            // Skip directories we can't read
          }
        }
        
        const startDir = path.resolve(dir);
        await walk(startDir);
        
        return { 
          hits,
          query: q,
          count: hits.length,
          truncated: hits.length >= maxFiles
        };
      } catch (error: any) {
        throw new ToolExecutionError('blobSearch', { dir, q, maxFiles }, error);
      }
    },
    {
      name: 'blobSearch',
      description: 'Search for text content within files',
      parameters: {
        type: 'object',
        properties: {
          dir: {
            type: 'string',
            description: 'Directory to search (default: current directory)',
          },
          q: {
            type: 'string',
            description: 'Text to search for',
          },
          maxFiles: {
            type: 'number',
            description: 'Maximum number of files to search (default: 50)',
          },
        },
        required: ['q'],
      },
    }
  );

  // Bash Exec Tool
  agent.registerTool(
    'bashExec',
    async ({ cmd, cwd = '.' }: any) => {
      if (!cmd || typeof cmd !== 'string') {
        throw new Error('cmd parameter is required and must be a string');
      }

      // Enhanced security: blacklist dangerous commands
      const blacklist = [
        'rm -rf',
        'rm -fr',
        'shutdown',
        'reboot',
        ':(){',
        'mkfs',
        'dd if=',
        'format',
        '> /dev/',
        'chmod 777',
        'curl | bash',
        'wget | sh',
      ];

      for (const pattern of blacklist) {
        if (cmd.toLowerCase().includes(pattern.toLowerCase())) {
          throw new CommandBlacklistedError(cmd, pattern);
        }
      }

      try {
        const resolvedCwd = path.resolve(cwd);
        
        const { stdout, stderr } = await execp(cmd, { 
          cwd: resolvedCwd, 
          timeout: 60_000,
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        return { 
          stdout: stdout.trim(), 
          stderr: stderr.trim(),
          exitCode: 0,
          command: cmd
        };
      } catch (error: any) {
        // Execution failed, but we still want to return the error
        return {
          stdout: error.stdout?.trim() || '',
          stderr: error.stderr?.trim() || error.message,
          exitCode: error.code || 1,
          command: cmd,
          error: error.message
        };
      }
    },
    {
      name: 'bashExec',
      description: 'Execute a bash command (with security restrictions)',
      parameters: {
        type: 'object',
        properties: {
          cmd: {
            type: 'string',
            description: 'Command to execute',
          },
          cwd: {
            type: 'string',
            description: 'Working directory (default: current directory)',
          },
        },
        required: ['cmd'],
      },
    }
  );
}
