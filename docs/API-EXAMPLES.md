# Chat API Examples

## Overview

The Chat API provides interactive, stateful conversations with the Selek agent. Each session maintains context, tool usage history, and can leverage both local tools and MCP servers.

## Base URL

```
http://localhost:3000/api/chat
```

## Endpoints

### 1. Create a Chat Session

```bash
POST /api/chat/sessions
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "my-coding-session",
    "systemPrompt": "You are a senior backend developer specializing in TypeScript."
  }'
```

**Response:**
```json
{
  "success": true,
  "sessionId": "my-coding-session",
  "tools": {
    "local": 11,
    "mcp": 15,
    "total": 26
  },
  "mcpServers": ["github", "filesystem", "postgres"],
  "created": "2025-10-31T10:30:00.000Z"
}
```

### 2. Send a Message

```bash
POST /api/chat/sessions/:sessionId/messages
```

**Simple message:**
```bash
curl -X POST http://localhost:3000/api/chat/sessions/my-coding-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Search the codebase for all TODO comments"
  }'
```

**With context files:**
```bash
curl -X POST http://localhost:3000/api/chat/sessions/my-coding-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Implement the feature described in the spec",
    "contextFiles": ["./docs/feature-spec.md", "./README.md"]
  }'
```

**Response:**
```json
{
  "success": true,
  "sessionId": "my-coding-session",
  "response": "I found 12 TODO comments in your codebase:\n\n1. src/lib/agent.ts:45 - TODO: Implement retry logic\n2. src/lib/tools.ts:120 - TODO: Add rate limiting\n...",
  "stats": {
    "turns": 3,
    "toolCalls": 1,
    "hasSummary": false,
    "responseTime": 2.34
  }
}
```

### 3. Get Session Info

```bash
GET /api/chat/sessions/:sessionId
```

**Request:**
```bash
curl http://localhost:3000/api/chat/sessions/my-coding-session
```

**Response:**
```json
{
  "sessionId": "my-coding-session",
  "tools": {
    "local": ["readFile", "writeFile", "searchFiles", "blobSearch", "bashExec", ...],
    "mcp": [
      { "name": "github__create_issue", "server": "github", "description": "..." },
      { "name": "filesystem__read_file", "server": "filesystem", "description": "..." }
    ],
    "total": 26
  },
  "context": {
    "totalTurns": 3,
    "toolCallsCount": 5,
    "hasSummary": false
  },
  "history": {
    "turns": 3,
    "summary": [
      {
        "timestamp": "2025-10-31T10:31:00.000Z",
        "messageCount": 2,
        "toolCalls": ["blobSearch"]
      }
    ]
  },
  "mcpServers": ["github", "filesystem"]
}
```

### 4. List All Sessions

```bash
GET /api/chat/sessions
```

**Request:**
```bash
curl http://localhost:3000/api/chat/sessions
```

**Response:**
```json
{
  "sessions": ["my-coding-session", "debug-session", "refactor-session"],
  "count": 3
}
```

### 5. Get Full History

```bash
GET /api/chat/sessions/:sessionId/history
```

**Request:**
```bash
curl http://localhost:3000/api/chat/sessions/my-coding-session/history
```

**Response:**
```json
{
  "sessionId": "my-coding-session",
  "history": [
    {
      "timestamp": "2025-10-31T10:31:00.000Z",
      "messages": [
        { "role": "user", "content": "Search for TODO comments" },
        { "role": "assistant", "content": "I'll search..." }
      ],
      "toolCalls": [
        {
          "name": "blobSearch",
          "arguments": { "dir": ".", "q": "TODO" }
        }
      ],
      "toolResults": {
        "blobSearch": { "hits": [...], "count": 12 }
      }
    }
  ],
  "count": 1
}
```

### 6. Get Available Tools

```bash
GET /api/chat/sessions/:sessionId/tools
```

**Request:**
```bash
curl http://localhost:3000/api/chat/sessions/my-coding-session/tools
```

**Response:**
```json
{
  "sessionId": "my-coding-session",
  "tools": {
    "local": ["readFile", "writeFile", "searchFiles", ...],
    "mcp": [
      { "name": "github__create_issue", "server": "github" },
      { "name": "github__list_repos", "server": "github" },
      { "name": "filesystem__read_file", "server": "filesystem" }
    ],
    "total": 26
  }
}
```

### 7. Clear Session History

```bash
POST /api/chat/sessions/:sessionId/clear
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/chat/sessions/my-coding-session/clear
```

**Response:**
```json
{
  "success": true,
  "sessionId": "my-coding-session",
  "message": "History cleared"
}
```

### 8. Delete Session

```bash
DELETE /api/chat/sessions/:sessionId
```

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/chat/sessions/my-coding-session
```

**Response:**
```json
{
  "success": true,
  "sessionId": "my-coding-session",
  "deleted": "2025-10-31T11:00:00.000Z"
}
```

## Example Workflows

### Workflow 1: Code Analysis

```bash
# 1. Create session
curl -X POST http://localhost:3000/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "code-analysis"}'

# 2. Ask for analysis
curl -X POST http://localhost:3000/api/chat/sessions/code-analysis/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze the codebase and find potential security issues"}'

# 3. Follow up
curl -X POST http://localhost:3000/api/chat/sessions/code-analysis/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Fix the SQL injection vulnerability in user-routes.ts"}'

# 4. Get full history
curl http://localhost:3000/api/chat/sessions/code-analysis/history
```

### Workflow 2: Feature Implementation with MCP

```bash
# 1. Create session
curl -X POST http://localhost:3000/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "new-feature"}'

# 2. Implement feature (uses local tools)
curl -X POST http://localhost:3000/api/chat/sessions/new-feature/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a new user authentication endpoint in src/routes/"}'

# 3. Create GitHub issue (uses MCP tool)
curl -X POST http://localhost:3000/api/chat/sessions/new-feature/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a GitHub issue to track this feature implementation"}'

# 4. Send Slack notification (uses MCP tool)
curl -X POST http://localhost:3000/api/chat/sessions/new-feature/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Send a Slack message to #engineering about the new auth endpoint"}'
```

### Workflow 3: Database Operations

```bash
# 1. Create session
curl -X POST http://localhost:3000/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "db-ops"}'

# 2. Query database (uses Postgres MCP tool)
curl -X POST http://localhost:3000/api/chat/sessions/db-ops/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me all users created in the last 7 days"}'

# 3. Update schema
curl -X POST http://localhost:3000/api/chat/sessions/db-ops/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Add an index on the users.email column"}'
```

## Error Handling

### Common Errors

**Session Not Found (404):**
```json
{
  "error": "Session not found",
  "sessionId": "nonexistent"
}
```

**Tool Execution Failed (500):**
```json
{
  "error": "Tool execution failed for bashExec: Command blocked by security policy",
  "errorType": "CommandBlacklistedError",
  "sessionId": "my-session"
}
```

**Max Iterations Exceeded (500):**
```json
{
  "error": "Agent Selek_Chat exceeded maximum iterations (15)",
  "errorType": "MaxIterationsExceededError",
  "sessionId": "my-session"
}
```

## Tips

1. **Session IDs**: Use meaningful session IDs like `feature-<name>`, `bug-<id>`, `review-<pr>` for easier tracking

2. **Context Files**: Pass context files for domain-specific tasks to improve accuracy

3. **MCP Tools**: Check available tools with `/tools` endpoint to see what MCP servers provide

4. **Long Conversations**: Monitor `stats.hasSummary` - when true, old context has been compressed to save memory

5. **Tool Calls**: Check response stats to see how many tools were used and response time

6. **Cleanup**: Delete sessions when done to free up resources
