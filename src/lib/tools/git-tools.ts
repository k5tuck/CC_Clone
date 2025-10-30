import { exec } from 'child_process';
import { promisify } from 'util';
import { Agent } from '../agent';
import { Tool } from '../llm/ollama-client';

const execp = promisify(exec);

/**
 * Custom exceptions for Git operations
 */
export class GitOperationError extends Error {
  constructor(
    public readonly operation: string,
    public readonly originalError: Error,
    public readonly context: Record<string, any>
  ) {
    super(`Git ${operation} failed: ${originalError.message}`);
    this.name = 'GitOperationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class GitNotInstalledError extends Error {
  constructor() {
    super('Git is not installed or not accessible');
    this.name = 'GitNotInstalledError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotGitRepositoryError extends Error {
  constructor(public readonly directory: string) {
    super(`Directory ${directory} is not a git repository`);
    this.name = 'NotGitRepositoryError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Register Git-related tools with an agent
 */
export function registerGitTools(agent: Agent): void {
  
  // Git Status Tool
  agent.registerTool(
    'gitStatus',
    async ({ cwd = '.' }: any) => {
      try {
        const { stdout } = await execp('git status --porcelain', { cwd });
        const lines = stdout.trim().split('\n').filter(l => l);
        
        const changes = lines.map(line => {
          const status = line.substring(0, 2);
          const file = line.substring(3);
          return { status: status.trim(), file };
        });

        return {
          hasChanges: changes.length > 0,
          changes,
          count: changes.length,
        };
      } catch (error: any) {
        if (error.message.includes('not a git repository')) {
          throw new NotGitRepositoryError(cwd);
        }
        throw new GitOperationError('status', error, { cwd });
      }
    },
    {
      name: 'gitStatus',
      description: 'Get the status of files in the git repository',
      parameters: {
        type: 'object',
        properties: {
          cwd: {
            type: 'string',
            description: 'Working directory (default: current directory)',
          },
        },
      },
    }
  );

  // Git Diff Tool
  agent.registerTool(
    'gitDiff',
    async ({ file, staged = false, cwd = '.' }: any) => {
      try {
        const cmd = staged 
          ? `git diff --staged ${file || ''}` 
          : `git diff ${file || ''}`;
        
        const { stdout } = await execp(cmd, { cwd });
        
        return {
          diff: stdout,
          hasChanges: stdout.length > 0,
          file: file || 'all files',
        };
      } catch (error: any) {
        throw new GitOperationError('diff', error, { file, staged, cwd });
      }
    },
    {
      name: 'gitDiff',
      description: 'Get diff of changes in the repository',
      parameters: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'Specific file to diff (optional)',
          },
          staged: {
            type: 'boolean',
            description: 'Show staged changes only (default: false)',
          },
          cwd: {
            type: 'string',
            description: 'Working directory (default: current directory)',
          },
        },
      },
    }
  );

  // Git Log Tool
  agent.registerTool(
    'gitLog',
    async ({ limit = 10, oneLine = false, cwd = '.' }: any) => {
      try {
        const format = oneLine ? '--oneline' : '--pretty=format:%H|%an|%ae|%ad|%s';
        const cmd = `git log ${format} -n ${limit}`;
        
        const { stdout } = await execp(cmd, { cwd });
        
        if (oneLine) {
          return { commits: stdout.trim().split('\n') };
        }

        const commits = stdout.trim().split('\n').map(line => {
          const [hash, author, email, date, message] = line.split('|');
          return { hash, author, email, date, message };
        });

        return { commits, count: commits.length };
      } catch (error: any) {
        throw new GitOperationError('log', error, { limit, cwd });
      }
    },
    {
      name: 'gitLog',
      description: 'Get commit history',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of commits to show (default: 10)',
          },
          oneLine: {
            type: 'boolean',
            description: 'Show one line per commit (default: false)',
          },
          cwd: {
            type: 'string',
            description: 'Working directory (default: current directory)',
          },
        },
      },
    }
  );

  // Git Branch Tool
  agent.registerTool(
    'gitBranch',
    async ({ cwd = '.' }: any) => {
      try {
        const { stdout } = await execp('git branch -a', { cwd });
        
        const branches = stdout.trim().split('\n').map(line => {
          const isCurrent = line.startsWith('*');
          const name = line.replace('*', '').trim();
          return { name, current: isCurrent };
        });

        const currentBranch = branches.find(b => b.current);

        return {
          branches,
          current: currentBranch?.name || 'unknown',
          count: branches.length,
        };
      } catch (error: any) {
        throw new GitOperationError('branch', error, { cwd });
      }
    },
    {
      name: 'gitBranch',
      description: 'List all branches in the repository',
      parameters: {
        type: 'object',
        properties: {
          cwd: {
            type: 'string',
            description: 'Working directory (default: current directory)',
          },
        },
      },
    }
  );

  // Git Add Tool
  agent.registerTool(
    'gitAdd',
    async ({ files, all = false, cwd = '.' }: any) => {
      try {
        const filesToAdd = all ? '.' : (Array.isArray(files) ? files.join(' ') : files);
        
        if (!filesToAdd) {
          throw new Error('Either files parameter or all=true must be provided');
        }

        const cmd = `git add ${filesToAdd}`;
        const { stdout, stderr } = await execp(cmd, { cwd });

        return {
          success: true,
          files: filesToAdd,
          output: stdout || stderr,
        };
      } catch (error: any) {
        throw new GitOperationError('add', error, { files, all, cwd });
      }
    },
    {
      name: 'gitAdd',
      description: 'Stage files for commit',
      parameters: {
        type: 'object',
        properties: {
          files: {
            type: 'string',
            description: 'Files to add (space-separated or array)',
          },
          all: {
            type: 'boolean',
            description: 'Add all files (default: false)',
          },
          cwd: {
            type: 'string',
            description: 'Working directory (default: current directory)',
          },
        },
      },
    }
  );

  // Git Commit Tool
  agent.registerTool(
    'gitCommit',
    async ({ message, cwd = '.' }: any) => {
      if (!message || typeof message !== 'string') {
        throw new Error('Commit message is required');
      }

      try {
        const escapedMessage = message.replace(/"/g, '\\"');
        const cmd = `git commit -m "${escapedMessage}"`;
        
        const { stdout, stderr } = await execp(cmd, { cwd });

        return {
          success: true,
          message,
          output: stdout || stderr,
        };
      } catch (error: any) {
        throw new GitOperationError('commit', error, { message, cwd });
      }
    },
    {
      name: 'gitCommit',
      description: 'Commit staged changes',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Commit message',
          },
          cwd: {
            type: 'string',
            description: 'Working directory (default: current directory)',
          },
        },
        required: ['message'],
      },
    }
  );

  // Git Create Branch Tool
  agent.registerTool(
    'gitCreateBranch',
    async ({ name, checkout = true, cwd = '.' }: any) => {
      if (!name || typeof name !== 'string') {
        throw new Error('Branch name is required');
      }

      try {
        const createCmd = `git branch ${name}`;
        await execp(createCmd, { cwd });

        let checkoutOutput = '';
        if (checkout) {
          const checkoutCmd = `git checkout ${name}`;
          const result = await execp(checkoutCmd, { cwd });
          checkoutOutput = result.stdout || result.stderr;
        }

        return {
          success: true,
          branch: name,
          checkedOut: checkout,
          output: checkoutOutput,
        };
      } catch (error: any) {
        throw new GitOperationError('createBranch', error, { name, checkout, cwd });
      }
    },
    {
      name: 'gitCreateBranch',
      description: 'Create a new branch',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Branch name',
          },
          checkout: {
            type: 'boolean',
            description: 'Checkout the new branch immediately (default: true)',
          },
          cwd: {
            type: 'string',
            description: 'Working directory (default: current directory)',
          },
        },
        required: ['name'],
      },
    }
  );
}
