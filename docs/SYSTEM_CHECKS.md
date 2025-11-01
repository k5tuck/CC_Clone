# System Checks & Balances

## Overview

This document catalogs all validation mechanisms, security checks, and guardrails implemented in the CC_Clone system to ensure safe and predictable agent behavior.

---

## 1. File Operations

### ✅ File Read-Before-Write Validation

**Location**: `src/lib/tools/toolFunctions.ts:51-141`

**Check**: "File has not been read yet. Read it first before writing to it."

**Implementation**:
- `FileAccessTracker` singleton tracks which files have been read
- `readFile()` marks files as read in the session
- `writeFile()` validates existing files were read first
- New files can be created without reading
- Multiple writes allowed after initial read

**Error**: `FileNotReadError`

**Example**:
```typescript
// ❌ This throws FileNotReadError
await writeFile({ path: 'existing.txt', content: 'new' });

// ✅ This works
await readFile({ path: 'existing.txt' });
await writeFile({ path: 'existing.txt', content: 'new' });
```

**Documentation**: [FILE_READ_WRITE_VALIDATION.md](./FILE_READ_WRITE_VALIDATION.md)

---

### ✅ File Access Validation

**Location**: `src/lib/tools/toolFunctions.ts:146-165` (readFile), `170-207` (writeFile)

**Checks**:
- Path parameter required and must be string
- File read errors wrapped in `FileAccessError`
- Directory creation for writes (with `mkdir -p` behavior)

**Errors**:
- `Error` for missing/invalid path
- `FileAccessError` for I/O failures

---

## 2. Command Execution Security

### ✅ Command Blacklist

**Location**: `src/lib/tools/toolFunctions.ts:293-348`

**Check**: Blocks dangerous commands before execution

**Blacklisted Patterns**:
1. `rm -rf` - Recursive force delete
2. `rm -fr` - Recursive force delete (alternate)
3. `shutdown` - System shutdown
4. `reboot` - System reboot
5. `:(){` - Fork bomb
6. `mkfs` - Format filesystem
7. `dd if=` - Direct disk write
8. `format` - Format command
9. `> /dev/` - Write to device files
10. `chmod 777` - Dangerous permissions
11. `curl | bash` - Pipe to shell execution
12. `wget | sh` - Pipe to shell execution

**Error**: `CommandBlacklistedError`

**Implementation**:
```typescript
const blacklist = [
  /rm\s+-[rf][rf]/i,
  /shutdown/i,
  // ... more patterns
];

for (const pattern of blacklist) {
  if (pattern.test(command)) {
    throw new CommandBlacklistedError(command, pattern.source);
  }
}
```

---

### ✅ Command Execution Limits

**Location**: `src/lib/tools/toolFunctions.ts:312-320`

**Limits**:
- **Timeout**: 60 seconds max
- **Output buffer**: 10MB max

**Implementation**:
```typescript
const { stdout, stderr } = await execp(cmd, {
  cwd: cwd || process.cwd(),
  timeout: 60000,      // 60 second timeout
  maxBuffer: 10485760  // 10MB buffer
});
```

---

## 3. Tool Execution

### ✅ Tool Registration Validation

**Location**: `src/lib/streaming/StreamingClientWithTools.ts:79-99`

**Checks**:
- Tool must be registered before execution
- Available tools list provided in error message
- Tool execution errors wrapped with context

**Error**: `StreamingToolError`

**Implementation**:
```typescript
const func = this.tools.get(toolCall.name);

if (!func) {
  throw new StreamingToolError(
    `Tool not found: ${toolCall.name}`,
    toolCall.name,
    { availableTools: Array.from(this.tools.keys()) }
  );
}
```

---

## 4. Configuration Management

### ✅ Config Load-Before-Access

**Location**: `src/lib/config/LLMConfig.ts:84-85, 108`

**Check**: Configuration must be loaded before access

**Implementation**:
```typescript
getConfig(): LLMConfiguration {
  if (!this.config) {
    throw new Error('Configuration not loaded. Call load() first.');
  }
  return this.config;
}
```

---

### ✅ Provider Validation

**Location**: `src/lib/config/LLMConfig.ts:276-305`

**Checks**:
1. Provider exists in configuration
2. Provider is enabled
3. API key present for cloud providers (Anthropic, OpenAI)
4. Endpoint configured for Ollama
5. Default model specified

**Errors**: Detailed validation error messages

**Implementation**:
```typescript
validateProvider(provider: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.providers[provider]) {
    errors.push(`Provider ${provider} not found`);
  }

  if (!providerConfig.enabled) {
    errors.push(`Provider ${provider} is disabled`);
  }

  if (provider !== 'ollama' && !providerConfig.apiKey) {
    errors.push(`Provider ${provider} requires API key`);
  }

  // ... more checks

  return { valid: errors.length === 0, errors };
}
```

---

### ✅ Provider Enable/Disable Guards

**Location**: `src/lib/config/LLMConfig.ts:172-227`

**Checks**:
- Provider exists before operations (setApiKey, enable, disable, setDefault)
- Provider enabled before setting as default
- Clear error messages for each failure case

---

## 5. Agent Management

### ✅ Required Fields Validation

**Location**: `src/lib/agents/AgentSystem.ts:180-186`

**Check**: Agent definitions must have required fields

**Required**:
- `id`: Unique identifier
- `name`: Display name
- `description`: What the agent does

**Error**: `AgentError`

---

### ✅ Duplicate Agent Prevention

**Location**: `src/lib/agents/AgentManager.ts:115-123`

**Check**: Agent IDs must be unique

**Implementation**:
```typescript
const agentPath = path.join(this.agentsDir, params.id, 'AGENT.md');

try {
  await fs.access(agentPath);
  throw new Error(`Agent already exists: ${params.id}`);
} catch (error: any) {
  if (error.code !== 'ENOENT') throw error;
}
```

---

### ✅ Agent Iteration Limits

**Location**: `src/lib/agent.ts:89-152`

**Limits**:
- Max 10 turns kept in context (sliding window)
- Summarization triggers after 15 turns
- Automatic context compression

---

## 6. Knowledge Graph

### ✅ Entity Uniqueness

**Location**: `src/lib/knowledge/KnowledgeGraph.ts:47-50`

**Check**: Entity IDs must be unique

**Error**: `Error` with message "Entity with id ${entity.id} already exists"

---

### ✅ Entity Existence for Updates

**Location**: `src/lib/knowledge/KnowledgeGraph.ts:70-73`

**Check**: Entity must exist before updating

**Error**: `Error` with message "Entity ${entityId} not found"

---

## 7. Vector Store

### ✅ Embedding Dimension Validation

**Location**: `src/lib/memory/VectorStore.ts:55-60`

**Check**: Embedding dimensions must match configured size

**Error**: Throws if dimension mismatch

---

### ✅ Max Vectors Limit

**Location**: `src/lib/memory/VectorStore.ts:62-68`

**Check**: Enforces maximum vector count with automatic eviction of oldest

---

## 8. Provider Health Checks

### ✅ Provider Configuration Validation

**Location**: `src/lib/providers/BaseProvider.ts:46-64`

**Checks**:
- Calls `healthCheck()` to verify provider config
- Validates connectivity by listing models
- Returns health status with error messages

---

### ✅ Model Validation

**Location**: `src/lib/providers/BaseProvider.ts:86-91`

**Check**: Model must be in available models list

**Error**: `ModelNotFoundError`

---

### ✅ Provider Registration Guards

**Location**: `src/lib/providers/BaseProvider.ts:107-150`

**Checks**:
- Prevent duplicate provider registration
- Validate provider exists before activation
- Ensure provider is active before use
- Include available providers list in errors

---

## 9. API Route Validation

### ✅ Session Creation Guards

**Location**: `src/routes/chat-routes.ts:111-128`

**Checks**:
- `sessionId` parameter required
- Prevent duplicate session creation (HTTP 409)

---

### ✅ Message Endpoint Validation

**Location**: `src/routes/chat-routes.ts:152-162`

**Check**: `message` parameter required

---

## 10. Skill Management

### ✅ Skill Metadata Validation

**Location**: `src/lib/skills/SkillLoader.ts:59-65`

**Check**: Skills must have `name` and `description`

**Error**: `SkillError`

---

## 11. Search Operations

### ✅ Search Pattern Validation

**Location**: `src/lib/tools/toolFunctions.ts:212-242`

**Checks**:
- RegExp validation (can throw on bad pattern)
- Directory skip list (`node_modules`, `.git`, etc.)
- Result truncation at max limit

---

### ✅ Blob Search Validation

**Location**: `src/lib/tools/toolFunctions.ts:247-291`

**Checks**:
- `q` (query) parameter required
- Directory skip list
- Binary file detection and skip
- Result truncation at max files

---

## Exception Hierarchy

```
Error
├── FileAccessError
│   ├── filePath: string
│   ├── operation: string
│   └── originalError: Error
├── FileNotReadError
│   └── filePath: string
├── CommandBlacklistedError
│   ├── command: string
│   └── matchedPattern: string
├── ToolExecutionError
│   ├── toolName: string
│   ├── params: Record<string, any>
│   └── originalError: Error
├── StreamingToolError
│   ├── toolName: string
│   └── context?: Record<string, unknown>
├── AgentError
│   ├── agentId: string
│   └── cause?: Error
│   ├── AgentNotFoundError
│   └── AgentExecutionError
├── SkillError
│   ├── skillName: string
│   └── cause?: Error
│   ├── SkillNotFoundError
│   └── SkillValidationError
├── ToolNotFoundError
│   ├── toolName: string
│   └── availableTools: string[]
└── MaxIterationsExceededError
    ├── agentName: string
    └── maxIterations: number
```

---

## Summary Statistics

| Category | Checks | Exceptions |
|----------|--------|------------|
| File Operations | 3 | FileAccessError, FileNotReadError |
| Command Execution | 3 | CommandBlacklistedError, ToolExecutionError |
| Tool Management | 2 | StreamingToolError, ToolNotFoundError |
| Configuration | 4 | Error (generic) |
| Agent System | 4 | AgentError, AgentNotFoundError, AgentExecutionError, MaxIterationsExceededError |
| Knowledge Graph | 2 | Error (generic) |
| Vector Store | 2 | Error (generic) |
| Providers | 4 | ModelNotFoundError, Error (generic) |
| API Routes | 2 | HTTP 400, HTTP 409 |
| Skills | 2 | SkillError, SkillNotFoundError, SkillValidationError |
| Search | 2 | Error (generic) |
| **TOTAL** | **30** | **19 unique exception types** |

---

## Testing

### File Read/Write Validation
```bash
npx tsx test-file-validation.ts
```

### Command Blacklist
Tested in unit tests and integration tests for `bashExec` tool.

### All Other Validations
Covered by existing test suites in `src/**/__tests__/`.

---

## Related Documentation

- [File Read/Write Validation](./FILE_READ_WRITE_VALIDATION.md)
- [Tool Functions](../src/lib/tools/toolFunctions.ts)
- [Streaming Client with Tools](../src/lib/streaming/StreamingClientWithTools.ts)
- [Agent System](../src/lib/agents/AgentSystem.ts)
- [LLM Configuration](../src/lib/config/LLMConfig.ts)

---

## Future Enhancements

Potential additional checks to consider:

1. **Rate Limiting**: Limit tool calls per minute
2. **Resource Quotas**: Max disk usage, memory usage
3. **Network Sandboxing**: Restrict network access by domain
4. **File Pattern Whitelisting**: Only allow access to certain file types
5. **Audit Logging**: Record all validation failures
6. **User Confirmations**: Require approval for certain operations
7. **Rollback Support**: Undo dangerous operations
8. **Dry Run Mode**: Preview changes without executing
9. **Permission System**: Role-based access control for tools
10. **Input Sanitization**: Validate all user inputs against injection attacks
