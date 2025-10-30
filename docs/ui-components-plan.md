# UI/UX Design Plan: Chat Interface Components

**Agent**: UI/UX Agent  
**Status**: Planning Complete  
**Date**: 2025-10-29

## Design Philosophy
Create a Claude Code-inspired terminal interface that feels natural, responsive, and provides clear visual feedback for all operations.

## Component Specifications

### 1. ChatHistory Component

#### Visual Design
```
┌─────────────────────────────────────────────────┐
│ 👤 User (2:30 PM)                               │
│ Create a new authentication module              │
│                                                  │
│ 🤖 Assistant (2:30 PM)                          │
│ I'll help you create an authentication module.  │
│ Let me break this down:                         │
│                                                  │
│ 🔧 Executing: readFile("src/auth/index.ts")    │
│ ✅ Complete                                      │
│                                                  │
│ [Streaming response appears here...]            │
└─────────────────────────────────────────────────┘
```

#### Features
- **Auto-scroll**: Follow latest message
- **Timestamps**: Human-readable relative times
- **Color coding**: 
  - User messages: Cyan
  - Assistant: White
  - Tool execution: Yellow
  - Errors: Red
  - Success: Green
- **Message types**:
  - Text messages
  - Code blocks with syntax highlighting
  - Tool execution status
  - Multi-agent coordination markers

#### Implementation
```typescript
interface ChatHistoryProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    agentId?: string;
    toolName?: string;
    status?: 'pending' | 'success' | 'error';
  };
}
```

### 2. StreamingMessage Component

#### Behavior
- Display text as it arrives (token-by-token)
- Show cursor indicator during streaming
- Smooth transitions without flicker
- Code block detection and formatting

#### Visual States
```
1. Streaming:  "Let me help you with that▊"
2. Tool Call:  "🔧 Reading file... ⏳"
3. Complete:   "Here's what I found: ..."
4. Error:      "❌ Failed to read file: Permission denied"
```

#### Implementation
```typescript
interface StreamingMessageProps {
  content: string;
  isComplete: boolean;
  onComplete?: () => void;
  renderInterval?: number; // ms between chunks
}
```

### 3. InputArea Component

#### Features
- **Multi-line support**: Shift+Enter for new line, Enter to send
- **Command completion**: Tab-complete for /commands
- **Syntax hints**: Show available commands and agents
- **Paste detection**: Handle large pastes gracefully

#### Visual Design
```
┌─────────────────────────────────────────────────┐
│ 💬 Type a message... (Shift+Enter for new line) │
│                                                  │
│ > _                                              │
│                                                  │
│ [Enter to send] [Ctrl+C to cancel]              │
└─────────────────────────────────────────────────┘
```

#### Commands to Support
- `/help` - Show help
- `/agents` - List active agents
- `/clear` - Clear history
- `/save <file>` - Save conversation
- `/load <file>` - Load conversation
- `/mode <type>` - Switch mode (chat/multi-agent)
- `/exit` - Exit application

### 4. StatusBar Component

#### Layout
```
┌──────────────────────────────────────────────────────────────┐
│ 🟢 Connected | 🤖 2 agents active | 💬 12 messages | 🔄 Auto │
└──────────────────────────────────────────────────────────────┘
```

#### Information Display
- Connection status (Ollama/LLM endpoint)
- Active agent count
- Message count in conversation
- Current mode (chat/multi-agent/tool)
- Token usage (if available)

### 5. Header Component

#### Design
```
╔══════════════════════════════════════════════════════╗
║  🤖 CC_Clone - Conversational Multi-Agent System     ║
║  Type /help for commands                             ║
╚══════════════════════════════════════════════════════╝
```

## Color Scheme

### Primary Palette
```typescript
const colors = {
  primary: '#00D9FF',      // Cyan - User messages
  secondary: '#A78BFA',    // Purple - System
  success: '#10B981',      // Green - Success
  warning: '#F59E0B',      // Yellow - In progress
  error: '#EF4444',        // Red - Errors
  text: '#F3F4F6',         // Light gray - Main text
  textDim: '#9CA3AF',      // Dim gray - Secondary text
  background: '#0F172A',   // Dark blue-gray
  backgroundAlt: '#1E293B' // Lighter dark
};
```

## Animation & Feedback

### 1. Streaming Animation
```
Frame 1: "Thinking▁"
Frame 2: "Thinking▂"
Frame 3: "Thinking▃"
Frame 4: "Thinking▄"
Frame 5: "Thinking▅"
Frame 6: "Thinking▆"
```

### 2. Tool Execution Spinner
```
⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏
```

### 3. Multi-Agent Coordination
```
🤖 Implementation Agent: Planning...
  └─ 🔍 Analyzing requirements
  └─ 📝 Generating code structure
  └─ ✅ Plan complete

🤖 Security Agent: Reviewing...
  └─ 🔒 Checking vulnerabilities
  └─ ✅ Security approved
```

## Responsive Layout

### Wide Terminal (>100 cols)
```
┌────────────────────────────────────────────────────────┐
│ Header                                                  │
├────────────────────────────────────────────────────────┤
│                                                         │
│                 Chat History                            │
│                                                         │
├────────────────────────────────────────────────────────┤
│ Input Area                                              │
├────────────────────────────────────────────────────────┤
│ Status Bar                                              │
└────────────────────────────────────────────────────────┘
```

### Narrow Terminal (<80 cols)
- Compress status bar
- Truncate long messages with "..."
- Stack elements vertically

## Accessibility

1. **Clear indicators**: Always show what's happening
2. **Keyboard shortcuts**: All features accessible via keyboard
3. **Error messages**: Clear, actionable error text
4. **Progress feedback**: Never leave user wondering
5. **Escape hatches**: Ctrl+C always works

## Implementation Priority

### Must Have (P0)
- [x] ChatHistory with message display
- [x] StreamingMessage with cursor
- [x] InputArea with multi-line
- [x] Basic StatusBar

### Should Have (P1)
- [ ] Command completion
- [ ] Syntax highlighting for code
- [ ] Tool execution animations
- [ ] Multi-agent visualization

### Nice to Have (P2)
- [ ] Message search
- [ ] Export formatting options
- [ ] Theme customization
- [ ] Message reactions

## Dependencies

### NPM Packages
```json
{
  "ink": "^4.4.1",
  "ink-text-input": "^5.0.1",
  "ink-spinner": "^5.0.0",
  "ink-box": "^3.0.0",
  "chalk": "^5.3.0",
  "react": "^18.2.0"
}
```

### Internal Dependencies
- Architecture Agent: Component structure
- Streaming Agent: Streaming logic
- History Agent: Message persistence

## Testing Plan

1. **Visual regression**: Screenshot comparison
2. **Streaming performance**: Measure render lag
3. **Input handling**: Test all keyboard shortcuts
4. **Responsive design**: Test at 80, 100, 120+ columns
5. **Color contrast**: Verify readability

## File Structure
```
src/tui/components/
├── ChatHistory.tsx
├── StreamingMessage.tsx
├── InputArea.tsx
├── StatusBar.tsx
├── Header.tsx
├── ToolExecutionView.tsx
├── MultiAgentView.tsx
└── styles/
    ├── colors.ts
    └── animations.ts
```

---
**Plan Status**: ✅ READY FOR IMPLEMENTATION  
**Estimated Effort**: 3-4 days  
**Blockers**: Need streaming protocol from Streaming Agent