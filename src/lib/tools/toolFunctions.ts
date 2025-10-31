/**
 * Standalone tool functions extracted from tools.ts
 * These accept params as Record<string, any> for flexibility
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execp = promisify(exec);

/**
 * Custom exceptions
 */
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

/**
 * Read file tool - accepts Record<string, any> params
 */
export async function readFile(params: Record<string, any>): Promise<any> {
  const p = params.path;
  
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
}

/**
 * Write file tool - accepts Record<string, any> params
 */
export async function writeFile(params: Record<string, any>): Promise<any> {
  const p = params.path;
  const content = params.content;
  
  if (!p || typeof p !== 'string') {
    throw new Error('path parameter is required and must be a string');
  }

  try {
    const resolvedPath = path.resolve(p);
    const dir = path.dirname(resolvedPath);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(resolvedPath, content ?? '', 'utf-8');
    
    return { 
      ok: true, 
      path: resolvedPath,
      size: (content ?? '').length 
    };
  } catch (error: any) {
    throw new FileAccessError(p, 'write', error);
  }
}

/**
 * Search files tool - accepts Record<string, any> params
 */
export async function searchFiles(params: Record<string, any>): Promise<any> {
  const dir = params.dir || '.';
  const pattern = params.pattern || '.*';
  const max = params.max || 100;

  try {
    const re = new RegExp(pattern);
    const found: string[] = [];
    
    async function walk(d: string) {
      try {
        const items = await fs.readdir(d, { withFileTypes: true });
        
        for (const it of items) {
          const full = path.join(d, it.name);
          
          if (it.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', 'target', 'bin', 'obj', '__pycache__', 'venv', '.venv'].includes(it.name)) {
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
}

/**
 * Blob search tool - accepts Record<string, any> params
 */
export async function blobSearch(params: Record<string, any>): Promise<any> {
  const dir = params.dir || '.';
  const q = params.q;
  const maxFiles = params.maxFiles || 50;
  
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
            if (!['node_modules', '.git', 'dist', 'build', 'target', 'bin', 'obj', '__pycache__', 'venv', '.venv'].includes(it.name)) {
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
              // Skip binary files
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
}

/**
 * Bash exec tool - accepts Record<string, any> params
 */
export async function bashExec(params: Record<string, any>): Promise<any> {
  const cmd = params.cmd;
  const cwd = params.cwd || '.';
  
  if (!cmd || typeof cmd !== 'string') {
    throw new Error('cmd parameter is required and must be a string');
  }

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
      maxBuffer: 1024 * 1024 * 10
    });
    
    return { 
      stdout: stdout.trim(), 
      stderr: stderr.trim(),
      exitCode: 0,
      command: cmd
    };
  } catch (error: any) {
    return {
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || error.message,
      exitCode: error.code || 1,
      command: cmd,
      error: error.message
    };
  }
}