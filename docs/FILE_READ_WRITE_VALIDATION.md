# File Read/Write Validation

## Overview

The system implements a **file read-before-write validation** mechanism to ensure that files are read before being modified. This prevents accidental overwrites and ensures agents understand the current state of a file before making changes.

## The Rule

> **"File has not been read yet. Read it first before writing to it."**

If an agent attempts to write to an existing file without first reading it in the current session, a `FileNotReadError` will be thrown.

## How It Works

### 1. File Access Tracker

A singleton `FileAccessTracker` class maintains state about which files have been read in the current session:

```typescript
import { getFileAccessTracker, resetFileAccessTracking } from './src/lib/tools/toolFunctions';

const tracker = getFileAccessTracker();

// Check stats
const stats = tracker.getStats();
console.log(`Read ${stats.readFiles} files in session ${stats.sessionId}`);

// Reset for new session
resetFileAccessTracking();
```

### 2. Read File Behavior

When `readFile()` is called:
- ✅ The file is read from disk
- ✅ The file path is added to the "read files" set
- ✅ File content is returned

### 3. Write File Behavior

When `writeFile()` is called:
- ❓ Check: Does the file exist on disk?
  - **If NO (new file)**: ✅ Allow write
  - **If YES (existing file)**:
    - ❓ Has it been read in this session?
      - **If YES**: ✅ Allow write
      - **If NO**: ❌ Throw `FileNotReadError`

### 4. Error Handling

When the validation fails:

```typescript
try {
  await writeFile({ path: 'existing-file.txt', content: 'new content' });
} catch (error) {
  if (error.name === 'FileNotReadError') {
    console.error(error.message);
    // Output: File has not been read yet. Read it first before writing to it: "/path/to/existing-file.txt"
  }
}
```

## Examples

### ✅ Correct Usage

```typescript
// Read the file first
const { content } = await readFile({ path: 'config.json' });

// Modify the content
const config = JSON.parse(content);
config.newSetting = true;

// Write it back (allowed because we read it first)
await writeFile({
  path: 'config.json',
  content: JSON.stringify(config, null, 2)
});
```

### ❌ Incorrect Usage

```typescript
// This will throw FileNotReadError!
await writeFile({
  path: 'existing-file.txt',
  content: 'new content'
});
// Error: File has not been read yet. Read it first before writing to it
```

### ✅ New File Creation

```typescript
// New files can be created without reading (they don't exist yet)
await writeFile({
  path: 'brand-new-file.txt',
  content: 'Hello, world!'
});
// ✓ Success - file doesn't exist, so no read required
```

### ✅ Multiple Writes

```typescript
// Read once
await readFile({ path: 'file.txt' });

// Can write multiple times after initial read
await writeFile({ path: 'file.txt', content: 'First update' });
await writeFile({ path: 'file.txt', content: 'Second update' });
await writeFile({ path: 'file.txt', content: 'Third update' });
// ✓ All succeed
```

## Session Management

### StreamingClientWithTools Integration

The `StreamingClientWithTools` class provides methods to manage file access tracking:

```typescript
import { StreamingClientWithTools } from './src/lib/streaming/StreamingClientWithTools';

const toolClient = new StreamingClientWithTools(streamingClient);

// Reset tracking for a new conversation
toolClient.resetFileAccessTracking();

// Get statistics
const stats = toolClient.getFileAccessStats();
console.log(`Session ${stats.sessionId}: ${stats.readFiles} files read`);
```

### When to Reset

Reset the file access tracker when:
- ✅ Starting a new conversation/session
- ✅ User explicitly requests a fresh start
- ✅ Context window is cleared
- ✅ Agent switches to a different task

**Do NOT reset:**
- ❌ Between tool calls in the same conversation
- ❌ When continuing an existing task
- ❌ During multi-step operations

## Implementation Details

### File Locations

- **Tracker Implementation**: `src/lib/tools/toolFunctions.ts`
  - `FileAccessTracker` class (singleton)
  - `FileNotReadError` exception
  - `getFileAccessTracker()` function
  - `resetFileAccessTracking()` function

- **Tool Integration**:
  - `readFile()` - marks files as read
  - `writeFile()` - validates files were read

- **Client Integration**: `src/lib/streaming/StreamingClientWithTools.ts`
  - `resetFileAccessTracking()` method
  - `getFileAccessStats()` method

### Exception Hierarchy

```
Error
└── FileNotReadError
    └── filePath: string
```

### Testing

Run the validation test suite:

```bash
npx tsx test-file-validation.ts
```

Test cases:
1. ✅ Write to existing file WITHOUT reading → FileNotReadError
2. ✅ Read first, THEN write → Success
3. ✅ Write to NEW file → Success (no read required)
4. ✅ Multiple writes after initial read → Success

## Benefits

### 1. **Prevents Accidental Overwrites**
Agents must understand file contents before modifying them.

### 2. **Enforces Best Practices**
Encourages agents to analyze code before making changes.

### 3. **Reduces Bugs**
Prevents blind writes that might corrupt data or lose important information.

### 4. **Clear Error Messages**
When validation fails, agents receive explicit guidance on what to do.

### 5. **Session Awareness**
Tracking is session-scoped, preventing cross-contamination between tasks.

## Disabling Validation (Advanced)

If you need to bypass validation for specific use cases:

```typescript
// Option 1: Read the file first (recommended)
await readFile({ path: 'file.txt' });
await writeFile({ path: 'file.txt', content: 'new content' });

// Option 2: Mark as read without actually reading (use with caution)
import { getFileAccessTracker } from './src/lib/tools/toolFunctions';
const tracker = getFileAccessTracker();
tracker.markAsRead('/path/to/file.txt');
await writeFile({ path: '/path/to/file.txt', content: 'new content' });
```

⚠️ **Warning**: Bypassing validation should only be done when absolutely necessary and you understand the implications.

## Future Enhancements

Potential improvements to consider:

1. **Configuration Option**: Allow users to enable/disable validation
2. **Whitelist**: Allow certain file patterns to bypass validation
3. **Metrics**: Track validation violations for monitoring
4. **IDE Integration**: Surface validation errors in development tools
5. **Audit Log**: Record all file access attempts for debugging

## Related Documentation

- [Tool Functions](../src/lib/tools/toolFunctions.ts)
- [Streaming Client with Tools](../src/lib/streaming/StreamingClientWithTools.ts)
- [System Checks Documentation](./SYSTEM_CHECKS.md)
