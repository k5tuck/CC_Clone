# CC_Clone Comprehensive Refactoring Plan

## Current Folder Structure Analysis

### ✅ Well-Organized
```
src/
├── tui/                     # Terminal UI components
│   ├── integration/        # Bridge between UI and backend
│   └── *.tsx               # React components
├── mcp/                    # Model Context Protocol
├── lib/
│   ├── agents/            # Agent system (well-contained)
│   ├── skills/            # Skill system (well-contained)
│   ├── providers/         # LLM providers (clean)
│   ├── streaming/         # Streaming components
│   └── tools/             # Tool functions
```

### ❌ Issues Identified

#### 1. **Duplication & Redundancy**
- `src/lib/agent.ts` (523 lines) vs `src/lib/agents/AgentSystem.ts` (757 lines)
  - Both implement agent logic
  - `agent.ts` is older, `AgentSystem.ts` is newer and better
  - **ACTION**: Delete `agent.ts`, use `AgentSystem.ts` only

- `src/lib/tools.ts` (367 lines) vs `src/lib/tools/toolFunctions.ts` (275 lines)
  - Both define tool functions
  - **ACTION**: Consolidate into `tools/` directory

- `src/lib/orchestrator/orchestrator.ts` vs `multi-agent-orchestrator.ts`
  - Two orchestrators with different purposes
  - **ACTION**: Clarify naming and purpose

#### 2. **Misplaced Files**
- `src/lib/storage.ts`, `src/lib/session.ts`, `src/lib/plugins.ts`
  - Should be in subdirectories
  - **ACTION**: Move to appropriate locations

#### 3. **Missing Organization**
- No `core/` directory for fundamental types and interfaces
- No `ui/` directory separation for components
- No `shared/` or `common/` for utilities

#### 4. **Root-Level Clutter**
- `agents/`, `skills/`, `.claude/` in root
  - Should be in data directory or config
  - **ACTION**: Move to `data/` or keep but document clearly

---

## Proposed New Structure

```
src/
├── core/                          # Core types, interfaces, constants
│   ├── types.ts                  # Shared TypeScript types
│   ├── errors.ts                 # Custom error classes
│   ├── constants.ts              # System constants
│   └── interfaces.ts             # Core interfaces
│
├── agents/                        # Agent system (unified)
│   ├── system/
│   │   ├── AgentOrchestrator.ts  # Main orchestrator
│   │   ├── AgentLoader.ts        # Load agents from disk
│   │   ├── AgentExecutor.ts      # Execute agent tasks
│   │   ├── AgentCreator.ts       # Create new agents
│   │   └── AgentEventBus.ts      # Event system
│   ├── types/
│   │   ├── specialized-agent.ts  # Base specialized agent
│   │   ├── implementation.ts     # Implementation agent
│   │   ├── security.ts           # Security agent
│   │   └── performance.ts        # Performance agent
│   ├── management/
│   │   ├── AgentManager.ts       # CRUD operations
│   │   ├── AgentEditor.ts        # Edit agent definitions
│   │   └── AgentTemplates.ts     # Template library
│   └── index.ts
│
├── skills/                        # Skill system
│   ├── SkillManager.ts
│   ├── SkillLoader.ts
│   ├── SkillExecutor.ts
│   ├── SkillMatcher.ts
│   └── index.ts
│
├── tools/                         # Tool system
│   ├── registry/
│   │   ├── ToolRegistry.ts       # Central registry
│   │   └── ToolValidator.ts      # Validate tool schemas
│   ├── builtin/
│   │   ├── filesystem.ts         # File operations
│   │   ├── git.ts                # Git operations
│   │   ├── http.ts               # HTTP operations
│   │   └── bash.ts               # Shell execution
│   ├── mcp/
│   │   ├── MCPClient.ts          # MCP client
│   │   ├── MCPServer.ts          # MCP server
│   │   └── MCPToolAdapter.ts     # Adapt MCP tools
│   └── index.ts
│
├── llm/                           # LLM integrations
│   ├── providers/
│   │   ├── base.ts               # Base provider
│   │   ├── ollama.ts             # Ollama provider
│   │   ├── anthropic.ts          # Claude API
│   │   └── openai.ts             # OpenAI API
│   ├── streaming/
│   │   ├── StreamingClient.ts
│   │   ├── ResponseBuffer.ts
│   │   └── ToolAwareStreaming.ts
│   └── index.ts
│
├── orchestration/                 # Task orchestration
│   ├── TaskOrchestrator.ts       # Main orchestrator
│   ├── PlanGenerator.ts          # Generate plans
│   ├── PlanExecutor.ts           # Execute plans
│   ├── PlanViewer.ts             # View/format plans
│   └── index.ts
│
├── context/                       # Project context
│   ├── ProjectAnalyzer.ts        # Analyze project structure
│   ├── DependencyGraph.ts        # Build dependency graph
│   ├── ASTParser.ts              # Parse code files
│   └── index.ts
│
├── storage/                       # Data persistence
│   ├── ConversationStore.ts
│   ├── SessionManager.ts
│   ├── CacheManager.ts
│   └── index.ts
│
├── ui/                            # User interface
│   ├── tui/
│   │   ├── components/
│   │   │   ├── AgentStatus.tsx
│   │   │   ├── PlanViewer.tsx
│   │   │   ├── Autocomplete.tsx
│   │   │   ├── InputPrompt.tsx
│   │   │   └── MessageBubble.tsx
│   │   ├── screens/
│   │   │   ├── MainScreen.tsx
│   │   │   ├── AgentManager.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── hooks/
│   │   │   ├── useAutocomplete.ts
│   │   │   ├── useAgentStatus.ts
│   │   │   └── useCommands.ts
│   │   └── TUIApp.tsx            # Main TUI app
│   └── cli/
│       ├── commands/
│       └── CLI.ts
│
├── server/                        # Express server
│   ├── routes/
│   ├── middleware/
│   └── server.ts
│
└── utils/                         # Shared utilities
    ├── logger.ts
    ├── validation.ts
    └── helpers.ts
```

---

## Implementation Plan

### Phase 1: Critical Fixes (Immediate)
1. ✅ Fix MCP integration
2. ✅ Fix plan display
3. ✅ Fix StreamingClientWithTools bug
4. ✅ Add command autocomplete

### Phase 2: Agent Management (High Priority)
5. ✅ Create AgentManager class
6. ✅ Add agent list/view/edit/delete commands
7. ✅ Add agent template library
8. ✅ Add agent modification UI in TUI

### Phase 3: Folder Reorganization (Medium Priority)
9. ✅ Create new folder structure
10. ✅ Move files to new locations
11. ✅ Update all imports
12. ✅ Remove duplicate files

### Phase 4: Enhanced Features (Lower Priority)
13. ✅ Add plan approval flow
14. ✅ Deep project context
15. ✅ Better error handling
16. ✅ Performance optimizations

---

## Files to Delete (Duplicates/Obsolete)

1. `src/lib/agent.ts` - Use `AgentSystem.ts` instead
2. `src/lib/tools.ts` - Use `tools/toolFunctions.ts` instead
3. `src/lib/orchestrator/orchestrator.ts` - Use `multi-agent-orchestrator.ts`

## Files to Consolidate

1. All provider files → `src/llm/providers/`
2. All tool files → `src/tools/builtin/`
3. MCP files → `src/tools/mcp/`

---

## Claude Code Agent Management Features to Add

### 1. Agent CRUD Operations
```typescript
/agent list                    # List all agents
/agent view <id>              # View agent details
/agent edit <id>              # Edit agent in TUI
/agent delete <id>            # Delete agent
/agent create                 # Create wizard
/agent duplicate <id> <new>   # Duplicate agent
```

### 2. Agent Templates
```typescript
/agent templates              # List templates
/agent new from <template>    # Create from template
/agent export <id>            # Export as template
/agent import <file>          # Import template
```

### 3. Agent Testing
```typescript
/agent test <id> <prompt>     # Test agent
/agent benchmark <id>         # Run benchmarks
/agent history <id>           # Show execution history
```

### 4. Agent Composition
```typescript
/agent chain <id1> <id2>      # Chain agents
/agent group <name> <ids>     # Create agent group
/agent workflow <name>        # Create workflow
```

---

## Next Steps

1. Start with Phase 1 implementations
2. Create branch for refactoring
3. Implement agent management features
4. Reorganize folder structure
5. Update documentation
6. Run comprehensive tests

