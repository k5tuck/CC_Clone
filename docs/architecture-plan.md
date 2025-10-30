# Architecture Plan: Conversational TUI Design

**Agent**: Architecture Agent  
**Status**: Planning Complete  
**Date**: 2025-10-29

## Executive Summary
Transform CC_Clone from menu-driven to conversational architecture matching Claude Code's real-time chat interface.

## Current State Analysis
- Menu-based navigation using `ink-select-input`
- Batch-oriented agent spawning
- No streaming responses
- Limited real-time feedback

## Target Architecture

### 1. Conversational Flow Model
```
User Input → Message Parser → Orchestrator → Agent(s) → Streaming Response → UI Update
     ↑                                                                           ↓
     └─────────────────────── Conversation Loop ─────────────────────────────────┘
```

### 2. Core Components

#### 2.1 Message Handler
- **Purpose**: Process user input in natural language
- **Features**:
  - Intent detection (task request vs. query vs. command)
  - Context awareness from conversation history
  - Command parsing (/help, /clear, /agents, etc.)

#### 2.2 Streaming Manager
- **Purpose**: Handle real-time response chunks
- **Features**:
  - Token-by-token display
  - Buffering for smooth rendering
  - Progress indicators during tool execution

#### 2.3 Conversation State
- **Purpose**: Maintain context across interactions
- **Data Structure**:
```typescript
interface ConversationState {
  id: string;
  messages: Message[];
  activeAgents: Agent[];
  context: Map<string, any>;
  mode: 'chat' | 'tool-execution' | 'multi-agent';
}
```

### 3. Component Hierarchy

```
ConversationalTUI (Root)
├── Header (System status)
├── ChatHistory (Scrollable message list)
│   ├── UserMessage
│   ├── AssistantMessage (with streaming)
│   └── ToolExecutionMessage
├── InputArea (Multi-line with autocomplete)
└── StatusBar (Active agents, tokens, etc.)
```

## Implementation Tasks

### Phase 1: Foundation (Priority: HIGH)
1. **Create ConversationManager class**
   - Message history storage
   - Context management
   - State persistence

2. **Build MessageParser**
   - Natural language intent detection
   - Command pattern matching
   - Parameter extraction

3. **Implement StreamingRenderer**
   - Ink-based streaming component
   - Chunk buffer management
   - Render optimization

### Phase 2: Integration (Priority: HIGH)
1. **Adapt MultiAgentOrchestrator**
   - Add streaming callbacks
   - Return iterators instead of complete responses
   - Progress reporting hooks

2. **Create ConversationBridge**
   - Convert tasks to conversation context
   - Map agent responses to chat messages
   - Handle multi-agent coordination

### Phase 3: Enhancement (Priority: MEDIUM)
1. **Add Command System**
   - `/help` - Show available commands
   - `/agents` - List active agents
   - `/clear` - Clear conversation
   - `/save <filename>` - Export conversation
   - `/load <filename>` - Import conversation

2. **Implement Auto-suggestions**
   - Task templates
   - Agent selection hints
   - File path completion

## Technical Specifications

### Dependencies to Add
```json
{
  "ink-text-input": "^5.0.0",
  "ink-spinner": "^5.0.0",
  "ink-multi-select": "^2.0.0",
  "chalk": "^5.3.0"
}
```

### File Structure
```
src/
├── tui/
│   ├── conversational-tui.tsx (Main component)
│   ├── components/
│   │   ├── ChatHistory.tsx
│   │   ├── StreamingMessage.tsx
│   │   ├── InputArea.tsx
│   │   └── StatusBar.tsx
│   ├── managers/
│   │   ├── ConversationManager.ts
│   │   ├── MessageParser.ts
│   │   └── StreamingRenderer.ts
│   └── bridges/
│       └── OrchestratorBridge.ts
```

## Success Metrics
- [ ] Single-command launch into chat mode
- [ ] Streaming responses visible token-by-token
- [ ] Multi-turn conversations with context
- [ ] Tool execution visible in real-time
- [ ] < 100ms input latency

## Dependencies on Other Agents
- **UI Agent**: Component design and styling
- **Streaming Agent**: Technical streaming implementation
- **History Agent**: Persistence layer integration
- **Integration Agent**: Orchestrator adaptation

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Ink library limitations | Use custom rendering if needed |
| Orchestrator incompatibility | Create adapter pattern |
| Performance with history | Implement pagination/virtualization |

## Next Steps
1. Review with UI Agent for component coordination
2. Define message protocol with Streaming Agent
3. Coordinate state management with History Agent
4. Plan orchestrator hooks with Integration Agent

---
**Plan Status**: ✅ READY FOR IMPLEMENTATION  
**Estimated Effort**: 2-3 days  
**Blockers**: None