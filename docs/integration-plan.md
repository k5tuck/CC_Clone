# Integration Plan: Connecting All Components

**Agent**: Integration Agent  
**Status**: Planning Complete  
**Date**: 2025-10-29

## Objective
Seamlessly integrate conversational TUI with existing MultiAgentOrchestrator while preserving backward compatibility and enabling new chat-based workflows.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│              ConversationalTUI (New)                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ChatHistory │ InputArea │ StreamingMessage      │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌────▼────┐  ┌───────▼────────┐
│ Conversation │  │Streaming│  │    History     │
│   Manager    │  │ Client  │  │    Manager     │
└───────┬──────┘  └────┬────┘  └───────┬────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────▼───────────────┐
        │    OrchestratorBridge         │
        │  (Adapter Layer)              │
        └───────────────┬───────────────┘
                        │
        ┌───────────────▼───────────────┐
        │  MultiAgentOrchestrator       │
        │  (Existing System)            │
        └───────────────────────────────┘
```

## Core Integration Components

### 1. OrchestratorBridge
**Purpose**: Adapt between conversational interface and orchestrator

```typescript
class OrchestratorBridge {
  constructor(
    private orchestrator: MultiAgentOrchestrator,
    private streamingClient: StreamingClient,
    private historyManager: ConversationHistoryManager
  ) {}
  
  /**
   * Process user message through orchestrator with streaming
   */
  async *processMessage(
    conversationId: string,
    userMessage: string
  ): AsyncGenerator<StreamEvent> {
    // Save user message
    await this.historyManager.saveMessage(conversationId, {
      id: uuidv4(),
      conversationId,
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });
    
    // Build context from history
    const context = await this.historyManager.getContext(
      conversationId,
      userMessage
    );
    
    // Determine if this is a task or a query
    const intent = await this.detectIntent(userMessage, context);
    
    if (intent.type === 'task') {
      // Execute through orchestrator
      yield* this.executeTask(conversationId, intent);
    } else if (intent.type === 'query') {
      // Direct LLM response
      yield* this.streamResponse(conversationId, context, userMessage);
    } else {
      // Command handling
      yield* this.handleCommand(conversationId, intent);
    }
  }
  
  private async detectIntent(
    message: string,
    context: Message[]
  ): Promise<Intent> {
    // Commands
    if (message.startsWith('/')) {
      return {
        type: 'command',
        command: message.slice(1).split(' ')[0],
        args: message.slice(1).split(' ').slice(1)
      };
    }
    
    // Task indicators
    const taskKeywords = [
      'implement', 'create', 'build', 'develop',
      'optimize', 'refactor', 'test', 'deploy'
    ];
    
    const hasTaskKeyword = taskKeywords.some(kw => 
      message.toLowerCase().includes(kw)
    );
    
    if (hasTaskKeyword) {
      return {
        type: 'task',
        description: message,
        domain: this.inferDomain(message),
        requiredAgents: this.inferAgents(message)
      };
    }
    
    // Default to query
    return { type: 'query', question: message };
  }
  
  private async *executeTask(
    conversationId: string,
    intent: TaskIntent
  ): AsyncGenerator<StreamEvent> {
    yield {
      type: 'status',
      message: '🤖 Analyzing task and selecting agents...'
    };
    
    const taskRequest: TaskRequest = {
      description: intent.description,
      domain: intent.domain,
      requiredAgents: intent.requiredAgents,
      autoExecute: false,
      parallel: false
    };
    
    // Execute through orchestrator
    try {
      const result = await this.orchestrator.executeTask(taskRequest);
      
      // Stream agent plans
      for (const [agentId, plan] of Object.entries(result.plans)) {
        yield {
          type: 'agent_plan',
          agentId,
          plan
        };
        
        // Save to history
        await this.historyManager.saveMessage(conversationId, {
          id: uuidv4(),
          conversationId,
          role: 'assistant',
          content: `Agent ${agentId} plan:\n${plan}`,
          timestamp: new Date(),
          metadata: { agentId }
        });
      }
      
      yield {
        type: 'done',
        final: 'Task planning complete. Ready to execute?'
      };
      
    } catch (error) {
      yield {
        type: 'error',
        error: error as Error
      };
    }
  }
  
  private async *streamResponse(
    conversationId: string,
    context: Message[],
    userMessage: string
  ): AsyncGenerator<StreamEvent> {
    // Convert to LLM format
    const messages = context.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    messages.push({
      role: 'user',
      content: userMessage
    });
    
    // Stream response
    let fullResponse = '';
    
    for await (const event of this.streamingClient.stream(messages)) {
      if (event.type === 'token') {
        fullResponse += event.data;
      }
      
      yield event;
    }
    
    // Save assistant response
    await this.historyManager.saveMessage(conversationId, {
      id: uuidv4(),
      conversationId,
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date()
    });
  }
  
  private async *handleCommand(
    conversationId: string,
    intent: CommandIntent
  ): AsyncGenerator<StreamEvent> {
    switch (intent.command) {
      case 'help':
        yield {
          type: 'token',
          data: this.getHelpText()
        };
        break;
        
      case 'agents':
        const agents = this.orchestrator.getAgentRegistry();
        yield {
          type: 'token',
          data: this.formatAgentList(agents)
        };
        break;
        
      case 'clear':
        await this.historyManager.deleteConversation(conversationId);
        yield {
          type: 'token',
          data: 'Conversation cleared.'
        };
        break;
        
      case 'save':
        const filename = intent.args[0] || `conversation-${Date.now()}.md`;
        const exported = await this.historyManager.export(
          conversationId,
          'markdown'
        );
        // Write to file
        await fs.writeFile(filename, exported);
        yield {
          type: 'token',
          data: `Conversation saved to ${filename}`
        };
        break;
        
      default:
        yield {
          type: 'error',
          error: new Error(`Unknown command: ${intent.command}`)
        };
    }
  }
}
```

### 2. ConversationManager
**Purpose**: Manage conversation lifecycle and state

```typescript
class ConversationManager {
  private activeConversation: string | null = null;
  
  async createConversation(title?: string): Promise<string> {
    const id = uuidv4();
    const conversationTitle = title || `Conversation ${new Date().toLocaleString()}`;
    
    await this.historyManager.createConversation(id, conversationTitle);
    
    // Add system message
    await this.historyManager.saveMessage(id, {
      id: uuidv4(),
      conversationId: id,
      role: 'system',
      content: this.getSystemPrompt(),
      timestamp: new Date()
    });
    
    this.activeConversation = id;
    return id;
  }
  
  async switchConversation(conversationId: string): Promise<void> {
    const exists = await this.historyManager.conversationExists(conversationId);
    if (!exists) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    this.activeConversation = conversationId;
  }
  
  getActiveConversation(): string | null {
    return this.activeConversation;
  }
  
  private getSystemPrompt(): string {
    return `You are a helpful AI assistant integrated with a multi-agent orchestration system.
You can help with:
- Answering questions and providing information
- Creating and executing development tasks
- Coordinating multiple specialized agents
- Managing files and executing commands

When the user describes a task, you can spawn specialized agents to help complete it.
Available agent types: implementation, security, performance, testing.`;
  }
}
```

### 3. Mode Manager
**Purpose**: Handle different interaction modes

```typescript
type InteractionMode = 'chat' | 'task' | 'multi-agent';

class ModeManager {
  private currentMode: InteractionMode = 'chat';
  
  setMode(mode: InteractionMode): void {
    this.currentMode = mode;
  }
  
  getMode(): InteractionMode {
    return this.currentMode;
  }
  
  getModePrompt(): string {
    switch (this.currentMode) {
      case 'chat':
        return '💬 Chat mode - Conversational assistance';
      case 'task':
        return '🎯 Task mode - Single-agent execution';
      case 'multi-agent':
        return '🤖 Multi-agent mode - Collaborative execution';
    }
  }
}
```

## Backward Compatibility

### 1. Preserve Existing CLI
Keep the original menu-based TUI as an option:

```typescript
// package.json
{
  "scripts": {
    "tui": "tsx src/tui/conversational-tui.tsx",
    "tui:classic": "tsx src/tui/menu-tui.tsx",
    "tui:both": "tsx src/tui/launcher.tsx"
  }
}
```

### 2. Migration Path
```typescript
class DataMigrator {
  async migrateConversationStore(): Promise<void> {
    const oldStore = new ConversationStore();
    await oldStore.initialize();
    
    const conversations = await oldStore.listConversations();
    
    for (const conv of conversations) {
      const full = await oldStore.getConversation(conv.id);
      
      // Create in new system
      await this.historyManager.createConversation(
        conv.id,
        `Migrated: ${conv.agentName}`
      );
      
      // Migrate turns
      for (const turn of full.turns) {
        for (const msg of turn.messages) {
          await this.historyManager.saveMessage(conv.id, {
            id: uuidv4(),
            conversationId: conv.id,
            role: msg.role as any,
            content: msg.content,
            timestamp: turn.timestamp,
            metadata: { migrated: true }
          });
        }
      }
    }
  }
}
```

## Testing Strategy

### Integration Tests
```typescript
describe('OrchestratorBridge', () => {
  it('should route queries to LLM', async () => {
    const bridge = new OrchestratorBridge(orchestrator, streaming, history);
    const events = [];
    
    for await (const event of bridge.processMessage('conv-1', 'What is TypeScript?')) {
      events.push(event);
    }
    
    expect(events).toContainEqual({ type: 'token', data: expect.any(String) });
  });
  
  it('should route tasks to orchestrator', async () => {
    const bridge = new OrchestratorBridge(orchestrator, streaming, history);
    const events = [];
    
    for await (const event of bridge.processMessage('conv-1', 'Implement a user service')) {
      events.push(event);
    }
    
    expect(events).toContainEqual({ type: 'agent_plan', agentId: expect.any(String) });
  });
  
  it('should handle commands', async () => {
    const bridge = new OrchestratorBridge(orchestrator, streaming, history);
    const events = [];
    
    for await (const event of bridge.processMessage('conv-1', '/help')) {
      events.push(event);
    }
    
    expect(events.some(e => e.type === 'token')).toBe(true);
  });
});
```

### End-to-End Tests
```typescript
describe('Full Conversational Flow', () => {
  it('should complete a full conversation', async () => {
    // Create conversation
    const convId = await conversationManager.createConversation();
    
    // User asks question
    await processUserMessage(convId, 'Hello!');
    
    // Check history
    const history = await historyManager.getHistory(convId);
    expect(history).toHaveLength(3); // system + user + assistant
  });
  
  it('should handle task execution', async () => {
    const convId = await conversationManager.createConversation();
    
    // User requests task
    await processUserMessage(convId, 'Create a login system');
    
    // Verify agents were spawned
    const agents = orchestrator.getAgentRegistry();
    expect(agents.length).toBeGreaterThan(0);
  });
});
```

## Configuration

```typescript
// config/tui.config.ts
export const tuiConfig = {
  // Streaming
  streaming: {
    enabled: true,
    bufferSize: 10,
    flushInterval: 50
  },
  
  // History
  history: {
    backend: 'sqlite', // 'memory' | 'sqlite' | 'postgres'
    maxMessages: 10000,
    contextWindow: 8000
  },
  
  // Orchestrator
  orchestrator: {
    endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.1:latest',
    autoExecute: false
  },
  
  // UI
  ui: {
    theme: 'dark',
    showTimestamps: true,
    showAgentNames: true
  }
};
```

## File Structure

```
src/
├── tui/
│   ├── conversational-tui.tsx (NEW)
│   ├── menu-tui.tsx (EXISTING)
│   ├── launcher.tsx (NEW - choose mode)
│   └── integration/
│       ├── OrchestratorBridge.ts
│       ├── ConversationManager.ts
│       ├── ModeManager.ts
│       └── DataMigrator.ts
├── lib/
│   ├── orchestrator/ (EXISTING)
│   ├── streaming/ (NEW)
│   └── history/ (NEW)
└── config/
    └── tui.config.ts
```

## Implementation Phases

### Phase 1: Bridge Layer (2 days)
- [x] OrchestratorBridge implementation
- [x] Intent detection
- [x] Command routing

### Phase 2: Conversation Management (1 day)
- [ ] ConversationManager
- [ ] Mode switching
- [ ] State management

### Phase 3: Migration (1 day)
- [ ] Data migration tool
- [ ] Backward compatibility layer
- [ ] Testing

### Phase 4: Integration Testing (1 day)
- [ ] End-to-end tests
- [ ] Performance testing
- [ ] Bug fixes

## Success Criteria
- ✅ Seamless switching between modes
- ✅ All existing features work
- ✅ New conversational UI functional
- ✅ No data loss during migration
- ✅ Performance: < 100ms routing latency

## Deployment Plan

1. **Deploy bridge layer first** - Non-breaking
2. **Add conversational TUI** - Parallel to existing
3. **Test extensively** - Both modes
4. **Migrate data** - Optional for users
5. **Document** - Update README with new features
6. **Announce** - Release notes

---
**Plan Status**: ✅ READY FOR IMPLEMENTATION  
**Estimated Effort**: 5 days  
**Blockers**: Requires Streaming and History agents