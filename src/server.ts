import express, { Request, Response, NextFunction } from 'express';
import { MultiAgentOrchestrator, TaskRequest } from './lib/orchestrator/multi-agent-orchestrator';
import { ConversationStore } from './lib/persistence/conversation-store';
import dotenv  from 'dotenv';
import cors from 'cors';

dotenv.config();

/**
 * Custom error class for API errors
 */
class APIError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Express server that exposes multi-agent system via REST API
 */
class AgentServer {
  private app: express.Application;
  private orchestrator: MultiAgentOrchestrator;
  private conversationStore: ConversationStore;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;

    const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:latest';

    this.orchestrator = new MultiAgentOrchestrator(ollamaEndpoint, ollamaModel);
    this.conversationStore = new ConversationStore();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const llm = this.orchestrator.getLLMClient();
        const health = await llm.healthCheck();

        res.json({
          status: health.healthy ? 'healthy' : 'unhealthy',
          llm: health,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        res.status(500).json({
          status: 'error',
          error: error.message,
        });
      }
    });

    // Spawn agents and create plans
    this.app.post('/api/agents/spawn', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { task, domain, agents, parallel, autoExecute } = req.body;

        if (!task || !domain || !agents) {
          throw new APIError(400, 'Missing required fields: task, domain, agents');
        }

        const taskRequest: TaskRequest = {
          description: task,
          domain,
          requiredAgents: Array.isArray(agents) ? agents : [agents],
          autoExecute: autoExecute || false,
          parallel: parallel || false,
        };

        const result = await this.orchestrator.executeTask(taskRequest);

        res.json({
          success: true,
          task: result.taskDescription,
          plans: result.plans,
          execution: result.execution,
          summary: result.summary,
        });
      } catch (error) {
        next(error);
      }
    });

    // Execute a plan
    this.app.post('/api/plans/execute', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { planFile, dryRun } = req.body;

        if (!planFile) {
          throw new APIError(400, 'Missing required field: planFile');
        }

        const result = await this.orchestrator.executePlan(planFile, dryRun || false);

        res.json({
          success: result.success,
          planFile: result.planFile,
          completedSteps: result.completedSteps,
          failedStep: result.failedStep,
          error: result.error?.message,
          executionTime: result.executionTime,
          checkpoints: result.checkpointsReached,
        });
      } catch (error) {
        next(error);
      }
    });

    // List all agents
    this.app.get('/api/agents', async (req: Request, res: Response) => {
      try {
        const { status } = req.query;

        const agents = status
          ? this.orchestrator.getAgentsByStatus(status as any)
          : this.orchestrator.getAgentRegistry();

        res.json({
          agents,
          count: agents.length,
        });
      } catch (error: any) {
        res.status(500).json({
          error: error.message,
        });
      }
    });

    // Search agents
    this.app.get('/api/agents/search', async (req: Request, res: Response) => {
      try {
        const { q } = req.query;

        if (!q) {
          throw new APIError(400, 'Missing query parameter: q');
        }

        const agents = this.orchestrator.getAgentsForTask(q as string);

        res.json({
          agents,
          count: agents.length,
          query: q,
        });
      } catch (error: any) {
        res.status(500).json({
          error: error.message,
        });
      }
    });

    // Create conversation
    this.app.post('/api/conversations', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { agentName, agentRole, tags } = req.body;

        if (!agentName || !agentRole) {
          throw new APIError(400, 'Missing required fields: agentName, agentRole');
        }

        const conversationId = await this.conversationStore.createConversation(
          agentName,
          agentRole,
          tags || []
        );

        res.json({
          conversationId,
          created: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    });

    // Get conversation
    this.app.get('/api/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const conversation = await this.conversationStore.loadConversation(id);

        res.json(conversation);
      } catch (error) {
        next(error);
      }
    });

    // List conversations
    this.app.get('/api/conversations', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { agentName, agentRole, tags } = req.query;

        const filter: any = {};
        if (agentName) filter.agentName = agentName;
        if (agentRole) filter.agentRole = agentRole;
        if (tags) filter.tags = (tags as string).split(',');

        const conversations = await this.conversationStore.listConversations(
          Object.keys(filter).length > 0 ? filter : undefined
        );

        res.json({
          conversations,
          count: conversations.length,
        });
      } catch (error) {
        next(error);
      }
    });

    // Search conversations
    this.app.get('/api/conversations/search', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { q } = req.query;

        if (!q) {
          throw new APIError(400, 'Missing query parameter: q');
        }

        const conversations = await this.conversationStore.searchConversations(q as string);

        res.json({
          conversations,
          count: conversations.length,
          query: q,
        });
      } catch (error) {
        next(error);
      }
    });

    // Delete conversation
    this.app.delete('/api/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        await this.conversationStore.deleteConversation(id);

        res.json({
          success: true,
          conversationId: id,
        });
      } catch (error) {
        next(error);
      }
    });

    // Get statistics
    this.app.get('/api/stats', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const conversationStats = await this.conversationStore.getStatistics();
        const agentRegistry = this.orchestrator.getAgentRegistry();

        res.json({
          conversations: conversationStats,
          agents: {
            total: agentRegistry.length,
            completed: this.orchestrator.getAgentsByStatus('completed').length,
            failed: this.orchestrator.getAgentsByStatus('failed').length,
            active: this.orchestrator.getAgentsByStatus('active').length,
          },
        });
      } catch (error) {
        next(error);
      }
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
      });
    });
  }



  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Error:', err);

      if (err instanceof APIError) {
        res.status(err.statusCode).json({
          error: err.message,
          details: err.details,
        });
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    });
  }

  /**
   * Initialize and start server
   */
  async start(): Promise<void> {
    try {
      console.log('🚀 Initializing Agent Server...');

      // Initialize orchestrator
      await this.orchestrator.initialize();
      console.log('✅ Orchestrator initialized');

      // Initialize conversation store
      await this.conversationStore.initialize();
      console.log('✅ Conversation store initialized');

      // Start Express server
      this.app.listen(this.port, () => {
        console.log(`✅ Server listening on http://localhost:${this.port}`);
        console.log('\nAvailable endpoints:');
        console.log('  GET  /health');
        console.log('  POST /api/agents/spawn');
        console.log('  POST /api/plans/execute');
        console.log('  GET  /api/agents');
        console.log('  GET  /api/agents/search');
        console.log('  POST /api/conversations');
        console.log('  GET  /api/conversations');
        console.log('  GET  /api/conversations/:id');
        console.log('  GET  /api/conversations/search');
        console.log('  DELETE /api/conversations/:id');
        console.log('  GET  /api/stats');
      });
    } catch (error: any) {
      console.error('❌ Failed to start server:', error.message);
      process.exit(1);
    }
  }
}

// Start server if run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  const server = new AgentServer(port);
  server.start();
}

export { AgentServer };