import { Router, Request, Response, NextFunction } from 'express';
import { Agent, AgentMeta } from '../lib/agent';
import { OllamaClient } from '../lib/llm/ollama-client';
import { registerTools } from '../lib/tools';
import { registerGitTools } from '../lib/tools/git-tools';
import { registerHTTPTools } from '../lib/tools/http-tools';
import { MCPClientManager, MCPServerConfig } from '../mcp/mcp-client';
import { enhanceSystemMessageWithProjectContext } from '../lib/context/ProjectContextLoader';
import fs from 'fs/promises';
import path from 'path';

/**
 * Chat session manager - stores active chat agents
 */
class ChatSessionManager {
  private sessions: Map<string, Agent> = new Map();
  private llmClient: OllamaClient;
  private mcpServers: MCPServerConfig[] = [];

  constructor(llmClient: OllamaClient) {
    this.llmClient = llmClient;
    this.loadMCPConfig();
  }

  private async loadMCPConfig(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'config', 'mcp-servers.json');
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      this.mcpServers = config.servers || [];
    } catch (error) {
      console.log('No MCP config found, chat will use local tools only');
    }
  }

  async createSession(sessionId: string, systemPrompt?: string): Promise<Agent> {
    // Build enhanced system prompt
    const basePrompt = systemPrompt || `You are CC_Clone, a helpful AI coding assistant with access to powerful tools.

You can:
- Read and write files
- Search codebases (file names and content)
- Execute bash commands (with security restrictions)
- Use git operations (status, diff, commit, branch, etc.)
- Make HTTP requests (GET, POST, PUT, DELETE)
- Use any connected MCP tools

When asked to perform tasks:
1. Break down complex tasks into steps
2. Use the appropriate tools efficiently
3. Explain what you're doing as you work
4. Show results clearly and concisely
5. Ask for clarification if needed

Be helpful, clear, and thorough. Always consider the project context when making decisions.`;

    const enhancedPrompt = await enhanceSystemMessageWithProjectContext(
      basePrompt,
      process.cwd()
    );

    const meta: AgentMeta = {
      name: `ChatSession_${sessionId}`,
      role: 'implementation',
      systemPrompt: enhancedPrompt,
    };

    const agent = new Agent(meta, this.llmClient, 15, this.mcpServers);

    // Register tools
    registerTools(agent);
    registerGitTools(agent);
    registerHTTPTools(agent);

    this.sessions.set(sessionId, agent);
    return agent;
  }

  getSession(sessionId: string): Agent | undefined {
    return this.sessions.get(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const agent = this.sessions.get(sessionId);
    if (agent) {
      await agent.shutdown();
      this.sessions.delete(sessionId);
    }
  }

  getAllSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}

/**
 * Create chat API routes
 */
export function createChatRoutes(llmClient: OllamaClient): Router {
  const router = Router();
  const sessionManager = new ChatSessionManager(llmClient);

  /**
   * POST /api/chat/sessions
   * Create a new chat session
   */
  router.post('/sessions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, systemPrompt } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: 'Missing required field: sessionId',
        });
      }

      // Check if session already exists
      if (sessionManager.getSession(sessionId)) {
        return res.status(409).json({
          error: 'Session already exists',
          sessionId,
        });
      }

      const agent = await sessionManager.createSession(sessionId, systemPrompt);
      const toolInfo = agent.getToolInfo();

      res.json({
        success: true,
        sessionId,
        tools: {
          local: toolInfo.local.length,
          mcp: toolInfo.mcp.length,
          total: toolInfo.total,
        },
        mcpServers: agent.getConnectedMCPServers(),
        created: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/chat/sessions/:sessionId/messages
   * Send a message to a chat session
   */
  router.post('/sessions/:sessionId/messages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { message, contextFiles } = req.body;

      if (!message) {
        return res.status(400).json({
          error: 'Missing required field: message',
        });
      }

      let agent = sessionManager.getSession(sessionId);

      // Auto-create session if it doesn't exist
      if (!agent) {
        agent = await sessionManager.createSession(sessionId);
      }

      const startTime = Date.now();
      const response = await agent.run(message, contextFiles || []);
      const duration = (Date.now() - startTime) / 1000;

      const stats = agent.getContextStats();

      res.json({
        success: true,
        sessionId,
        response,
        stats: {
          turns: stats.totalTurns,
          toolCalls: stats.toolCallsCount,
          hasSummary: stats.hasSummary,
          responseTime: duration,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
        errorType: error.name,
        sessionId: req.params.sessionId,
      });
    }
  });

  /**
   * GET /api/chat/sessions/:sessionId
   * Get session information
   */
  router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const agent = sessionManager.getSession(sessionId);

      if (!agent) {
        return res.status(404).json({
          error: 'Session not found',
          sessionId,
        });
      }

      const toolInfo = agent.getToolInfo();
      const stats = agent.getContextStats();
      const history = agent.getHistory();

      res.json({
        sessionId,
        tools: toolInfo,
        context: stats,
        history: {
          turns: history.length,
          summary: history.map(turn => ({
            timestamp: turn.timestamp,
            messageCount: turn.messages.length,
            toolCalls: turn.toolCalls.map(tc => tc.name),
          })),
        },
        mcpServers: agent.getConnectedMCPServers(),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
      });
    }
  });

  /**
   * GET /api/chat/sessions
   * List all active sessions
   */
  router.get('/sessions', async (req: Request, res: Response) => {
    try {
      const sessions = sessionManager.getAllSessions();

      res.json({
        sessions,
        count: sessions.length,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
      });
    }
  });

  /**
   * DELETE /api/chat/sessions/:sessionId
   * Delete a chat session
   */
  router.delete('/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const agent = sessionManager.getSession(sessionId);

      if (!agent) {
        return res.status(404).json({
          error: 'Session not found',
          sessionId,
        });
      }

      await sessionManager.deleteSession(sessionId);

      res.json({
        success: true,
        sessionId,
        deleted: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/chat/sessions/:sessionId/clear
   * Clear session history
   */
  router.post('/sessions/:sessionId/clear', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const agent = sessionManager.getSession(sessionId);

      if (!agent) {
        return res.status(404).json({
          error: 'Session not found',
          sessionId,
        });
      }

      agent.clearHistory();

      res.json({
        success: true,
        sessionId,
        message: 'History cleared',
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
      });
    }
  });

  /**
   * GET /api/chat/sessions/:sessionId/tools
   * Get available tools for a session
   */
  router.get('/sessions/:sessionId/tools', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const agent = sessionManager.getSession(sessionId);

      if (!agent) {
        return res.status(404).json({
          error: 'Session not found',
          sessionId,
        });
      }

      const toolInfo = agent.getToolInfo();

      res.json({
        sessionId,
        tools: toolInfo,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
      });
    }
  });

  /**
   * GET /api/chat/sessions/:sessionId/history
   * Get full conversation history
   */
  router.get('/sessions/:sessionId/history', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const agent = sessionManager.getSession(sessionId);

      if (!agent) {
        return res.status(404).json({
          error: 'Session not found',
          sessionId,
        });
      }

      const history = agent.getHistory();

      res.json({
        sessionId,
        history: history.map(turn => ({
          timestamp: turn.timestamp,
          messages: turn.messages,
          toolCalls: turn.toolCalls,
          toolResults: turn.toolResults,
        })),
        count: history.length,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
      });
    }
  });

  return router;
}