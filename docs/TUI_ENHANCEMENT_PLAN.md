# TUI Enhancement Plan: Claude Code-Style Interface

This document outlines the plan to enhance Selek's TUI to match Claude Code's interactive experience.

## Overview

The goal is to implement advanced TUI features that provide:
- Collapsible thinking displays
- Interactive todo list management
- Rich diff rendering
- Advanced keyboard navigation
- Real-time operation interruption
- Professional status indicators

---

## Phase 1: Advanced Keyboard Navigation

### 1.1 Multi-line Input Support
**Status:** Not Implemented

**Requirements:**
- `Shift+Enter` to add newlines without submitting
- Visual indicator for multi-line mode
- Proper cursor positioning across lines

**Implementation:**
```typescript
// In useInput handler
if (key.shift && key.return) {
  // Insert newline at cursor position
  const newInput =
    currentInput.slice(0, cursorPosition) +
    '\n' +
    currentInput.slice(cursorPosition);
  setState({
    ...prev,
    currentInput: newInput,
    cursorPosition: cursorPosition + 1
  });
}
```

### 1.2 Word-by-Word Navigation
**Status:** Not Implemented

**Requirements:**
- `Ctrl+Left` to move cursor to previous word
- `Ctrl+Right` to move cursor to next word
- `Alt+Left/Right` as alternative (Mac users)

**Implementation:**
```typescript
const findPreviousWord = (text: string, pos: number): number => {
  // Skip current whitespace
  while (pos > 0 && /\s/.test(text[pos - 1])) pos--;
  // Find start of word
  while (pos > 0 && !/\s/.test(text[pos - 1])) pos--;
  return pos;
};

const findNextWord = (text: string, pos: number): number => {
  // Skip current word
  while (pos < text.length && !/\s/.test(text[pos])) pos++;
  // Skip whitespace
  while (pos < text.length && /\s/.test(text[pos])) pos++;
  return pos;
};
```

### 1.3 Line Editing Shortcuts
**Status:** Not Implemented

**Shortcuts to implement:**
- `Ctrl+A` - Jump to start of line
- `Ctrl+E` - Jump to end of line
- `Ctrl+U` - Clear from cursor to start
- `Ctrl+K` - Clear from cursor to end
- `Ctrl+W` - Delete word before cursor

---

## Phase 2: Collapsible Thinking Display

### 2.1 Thinking State Management
**Status:** Not Implemented

**Requirements:**
- Store thinking/reasoning content separately from output
- Track collapsed/expanded state per thought block
- Keyboard shortcut to toggle visibility

**State Structure:**
```typescript
interface ThinkingBlock {
  id: string;
  content: string;
  timestamp: Date;
  collapsed: boolean;
  durationMs?: number;
}

interface AppState {
  // ... existing state
  thinkingBlocks: ThinkingBlock[];
  showAllThinking: boolean;
  selectedThinkingBlock: string | null;
}
```

### 2.2 Thinking Display Component
**Status:** Not Implemented

**Component:**
```tsx
const ThinkingBlock: React.FC<{
  block: ThinkingBlock;
  onToggle: () => void;
}> = ({ block, onToggle }) => {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray">
      <Box>
        <Text color="gray">∴ Thought for {block.durationMs}ms </Text>
        <Text color="gray" dimColor>
          (ctrl+o to {block.collapsed ? 'show' : 'hide'} thinking)
        </Text>
      </Box>
      {!block.collapsed && (
        <Box paddingLeft={2} marginTop={1}>
          <Text>{block.content}</Text>
        </Box>
      )}
    </Box>
  );
};
```

### 2.3 Keyboard Shortcut
**Status:** Not Implemented

**Implementation:**
```typescript
// In useInput handler
if (key.ctrl && input === 'o') {
  setState(prev => ({
    ...prev,
    showAllThinking: !prev.showAllThinking,
    thinkingBlocks: prev.thinkingBlocks.map(b => ({
      ...b,
      collapsed: !prev.showAllThinking
    }))
  }));
}
```

---

## Phase 3: Interactive Todo List

### 3.1 Todo State Management
**Status:** Partially Implemented (backend only)

**Requirements:**
- Visual todo list component
- Status tracking (pending, in_progress, completed)
- Keyboard shortcut to toggle visibility
- Real-time updates during execution

**State Structure:**
```typescript
interface TodoItem {
  id: string;
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: Date;
  completedAt?: Date;
}

interface AppState {
  // ... existing state
  todos: TodoItem[];
  showTodoList: boolean;
}
```

### 3.2 Todo Display Component
**Status:** Not Implemented

**Component:**
```tsx
const TodoList: React.FC<{ todos: TodoItem[] }> = ({ todos }) => {
  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'pending': return '○';
      case 'in_progress': return '◐';
      case 'completed': return '●';
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
    >
      <Text bold color="cyan">Tasks (ctrl+t to hide)</Text>
      {todos.map((todo, idx) => (
        <Box key={todo.id} marginTop={idx > 0 ? 1 : 0}>
          <Text color={
            todo.status === 'completed' ? 'green' :
            todo.status === 'in_progress' ? 'yellow' :
            'gray'
          }>
            {idx + 1}. [{getStatusIcon(todo.status)}] {
              todo.status === 'in_progress'
                ? todo.activeForm
                : todo.content
            }
          </Text>
        </Box>
      ))}
    </Box>
  );
};
```

### 3.3 Keyboard Shortcut
**Status:** Not Implemented

**Implementation:**
```typescript
// In useInput handler
if (key.ctrl && input === 't') {
  setState(prev => ({
    ...prev,
    showTodoList: !prev.showTodoList
  }));
}
```

---

## Phase 4: File Diff Display

### 4.1 Diff Parser
**Status:** Not Implemented

**Requirements:**
- Parse git-style diffs
- Extract file paths, line numbers, additions, removals
- Syntax highlighting for code changes

**Parser Structure:**
```typescript
interface FileDiff {
  path: string;
  additions: number;
  removals: number;
  hunks: DiffHunk[];
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'context' | 'add' | 'remove';
  lineNumber: number;
  content: string;
}
```

### 4.2 Diff Display Component
**Status:** Not Implemented

**Component:**
```tsx
const DiffDisplay: React.FC<{ diff: FileDiff }> = ({ diff }) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="cyan">⏺ Update({diff.path})</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color="gray">
          ⎿ Updated {diff.path} with {diff.additions} addition
          {diff.additions !== 1 ? 's' : ''} and {diff.removals} removal
          {diff.removals !== 1 ? 's' : ''}
        </Text>
      </Box>
      {diff.hunks.map((hunk, idx) => (
        <Box key={idx} flexDirection="column" marginTop={1} paddingLeft={2}>
          {hunk.lines.map((line, lineIdx) => (
            <Box key={lineIdx}>
              <Text color="gray">{line.lineNumber}→</Text>
              <Text
                color={
                  line.type === 'add' ? 'green' :
                  line.type === 'remove' ? 'red' :
                  'white'
                }
              >
                {line.type === 'add' ? '+' :
                 line.type === 'remove' ? '-' : ' '}
                {line.content}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};
```

### 4.3 File Operation Icons
**Status:** Not Implemented

**Icon System:**
```typescript
const getFileOperationIcon = (operation: string): string => {
  switch (operation) {
    case 'create': return '✚';
    case 'update': return '⏺';
    case 'delete': return '✖';
    case 'read': return '👁';
    default: return '•';
  }
};
```

---

## Phase 5: Operation Status & Interruption

### 5.1 Enhanced Status Line
**Status:** Partially Implemented

**Requirements:**
- Persistent bottom status bar
- Current operation display
- Next operation preview
- Token usage tracking
- Elapsed time

**Component:**
```tsx
const StatusLine: React.FC<{
  currentOp: string;
  nextOp: string;
  tokensUsed: number;
  tokensTotal: number;
  elapsedMs: number;
  canInterrupt: boolean;
}> = ({ currentOp, nextOp, tokensUsed, tokensTotal, elapsedMs, canInterrupt }) => {
  const tokensRemaining = tokensTotal - tokensUsed;

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginTop={1}
    >
      <Text color="yellow">✳ {currentOp}… </Text>
      {canInterrupt && (
        <Text color="gray" dimColor>(esc to interrupt · </Text>
      )}
      <Text color="gray" dimColor>ctrl+t to show todos · </Text>
      <Text color="gray" dimColor>
        {Math.floor(elapsedMs / 1000)}s ·
        ↓ {(tokensUsed / 1000).toFixed(1)}k tokens
      </Text>
      {nextOp && (
        <>
          <Text color="gray"> </Text>
          <Text color="gray">⎿ Next: {nextOp}</Text>
        </>
      )}
    </Box>
  );
};
```

### 5.2 Streaming Interruption
**Status:** Not Implemented

**Requirements:**
- Monitor escape key during streaming
- Gracefully cancel ongoing operations
- Clean up resources

**Implementation:**
```typescript
// Add to state
interface AppState {
  // ... existing state
  canInterrupt: boolean;
  interruptRequested: boolean;
}

// In useInput handler
if (key.escape && state.canInterrupt) {
  setState(prev => ({ ...prev, interruptRequested: true }));
}

// In streaming handler
for await (const chunk of stream) {
  if (state.interruptRequested) {
    console.log('Streaming interrupted by user');
    break;
  }
  // Process chunk
}
```

---

## Phase 6: Progress Indicators

### 6.1 Operation Steps Display
**Status:** Basic Implementation

**Enhancements Needed:**
- Visual step-by-step progress
- Estimated time remaining
- Sub-task tracking

**Component:**
```tsx
const OperationProgress: React.FC<{
  operation: string;
  currentStep: number;
  totalSteps: number;
  stepDescription: string;
}> = ({ operation, currentStep, totalSteps, stepDescription }) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box>
        <Text bold color="cyan">{operation}</Text>
        <Text color="gray"> ({currentStep}/{totalSteps})</Text>
      </Box>
      <Box paddingLeft={2} marginTop={1}>
        <ProgressBar progress={progress} width={40} />
        <Text color="gray"> {progress.toFixed(0)}%</Text>
      </Box>
      <Box paddingLeft={2} marginTop={1}>
        <Text color="yellow">⎿ {stepDescription}</Text>
      </Box>
    </Box>
  );
};
```

---

## Implementation Priority

### High Priority (Implement First)
1. ✅ **Todo List System** - Most visible, immediate UX improvement
2. ✅ **Enhanced Status Line** - Critical for user feedback
3. ✅ **Keyboard Shortcuts** (Ctrl+T, Ctrl+O, Esc)

### Medium Priority
4. **Collapsible Thinking Display** - Nice to have for debugging
5. **Advanced Navigation** (Word jump, line editing)
6. **Streaming Interruption** - Safety feature

### Lower Priority
7. **File Diff Display** - Polish feature
8. **Multi-line Input** - Advanced editing

---

## Technical Considerations

### Libraries Needed
```json
{
  "dependencies": {
    "ink": "^3.2.0",           // Already have
    "react": "^17.0.2",         // Already have
    "chalk": "^4.1.2",          // Already have
    "ansi-escapes": "^5.0.0",   // For advanced cursor control
    "strip-ansi": "^7.0.1"      // For text processing
  }
}
```

### State Management
- Consider using React Context for global UI state
- Separate TUI state from business logic state
- Use refs for tracking streaming/async operations

### Performance
- Limit visible message history (already doing this)
- Debounce rapid state updates
- Use React.memo for expensive components

---

## Testing Strategy

### Manual Testing
- [ ] Test all keyboard shortcuts in different scenarios
- [ ] Verify interruption works during long operations
- [ ] Check rendering with long messages/many todos
- [ ] Test on different terminal emulators

### Automated Testing
- [ ] Unit tests for keyboard event handlers
- [ ] Integration tests for state transitions
- [ ] Snapshot tests for component rendering

---

## Next Steps

1. **Create Feature Branches**
   - `feature/tui-todo-list`
   - `feature/tui-keyboard-nav`
   - `feature/tui-thinking-display`
   - `feature/tui-status-line`

2. **Implement Core Features First**
   - Start with todo list (highest value)
   - Add keyboard shortcuts
   - Enhance status line

3. **Iterate and Polish**
   - Gather feedback
   - Refine UX
   - Add advanced features

4. **Documentation**
   - Update README with keyboard shortcuts
   - Add GIFs/videos demonstrating features
   - Create user guide for TUI

---

## Success Metrics

- ✅ Users can see real-time progress of operations
- ✅ Users can interrupt long-running tasks
- ✅ Users can navigate efficiently with keyboard
- ✅ Users understand what the system is doing at all times
- ✅ TUI feels responsive and professional
