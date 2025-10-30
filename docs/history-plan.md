# Conversation History Management Plan

**Agent**: History Agent  
**Status**: Planning Complete  
**Date**: 2025-10-29

## Objective
Build robust conversation history system supporting persistence, search, context management, and seamless integration with conversational TUI.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Application Layer                   │
│  (ConversationalTUI, StreamingMessage, etc.)        │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              History Manager API                     │
│  (saveMessage, getHistory, search, export, etc.)    │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼────┐  ┌──────▼─────┐  ┌───▼────────┐
│ In-Memory  │  │ File Store │  │  Database  │
│   Cache    │  │  (SQLite)  │  │ (Postgres) │
└────────────┘  └────────────┘  └────────────┘
```

## Core Components

### 1. ConversationHistoryManager

**Purpose**: Central API for all history operations

```typescript
interface ConversationHistoryManager {
  // Core operations
  saveMessage(conversationId: string, message: Message): Promise<void>;
  getHistory(conversationId: string, limit?: number): Promise<Message[]>;
  deleteConversation(conversationId: string): Promise<void>;
  
  // Search & retrieval
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getContext(conversationId: string, messageId: string): Promise<Message[]>;
  
  // Export & import
  export(conversationId: string, format: 'json' | 'markdown' | 'txt'): Promise<string>;
  import(data: string, format: 'json'): Promise<string>; // returns new conversationId
  
  // Stats & analytics
  getStatistics(conversationId?: string): Promise<ConversationStats>;
  
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}
```

### 2. Storage Backends

#### 2.1 In-Memory Cache (Primary)
**Purpose**: Fast access to recent messages

```typescript
class MemoryStore {
  private cache: Map<string, Message[]> = new Map();
  private maxSize: number = 1000; // messages per conversation
  
  set(conversationId: string, messages: Message[]): void {
    // Keep only last maxSize messages
    const trimmed = messages.slice(-this.maxSize);
    this.cache.set(conversationId, trimmed);
  }
  
  get(conversationId: string): Message[] | undefined {
    return this.cache.get(conversationId);
  }
  
  clear(conversationId?: string): void {
    if (conversationId) {
      this.cache.delete(conversationId);
    } else {
      this.cache.clear();
    }
  }
}
```

#### 2.2 File Store (SQLite)
**Purpose**: Persistent local storage

```typescript
// Schema
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  title TEXT,
  metadata JSON
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE VIRTUAL TABLE messages_fts USING fts5(content, content=messages);
```

```typescript
class SQLiteStore {
  private db: Database;
  
  async saveMessage(message: Message): Promise<void> {
    await this.db.run(
      'INSERT INTO messages (id, conversation_id, role, content, metadata) VALUES (?, ?, ?, ?, ?)',
      [message.id, message.conversationId, message.role, message.content, JSON.stringify(message.metadata)]
    );
    
    // Update conversation timestamp
    await this.db.run(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [message.conversationId]
    );
  }
  
  async search(query: string): Promise<Message[]> {
    return this.db.all(
      'SELECT m.* FROM messages m JOIN messages_fts ON messages_fts.rowid = m.rowid WHERE messages_fts MATCH ? ORDER BY rank',
      [query]
    );
  }
}
```

#### 2.3 Database Store (Postgres - Optional)
**Purpose**: Enterprise-grade persistence with existing ConversationStore

```typescript
class PostgresStore {
  // Leverage existing ConversationStore
  constructor(private conversationStore: ConversationStore) {}
  
  async saveMessage(message: Message): Promise<void> {
    await this.conversationStore.addMessage(
      message.conversationId,
      message.role as any,
      message.content
    );
  }
  
  async getHistory(conversationId: string): Promise<Message[]> {
    const conversation = await this.conversationStore.getConversation(conversationId);
    return this.convertToMessages(conversation);
  }
}
```

### 3. Message Model

```typescript
interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    agentId?: string;
    toolName?: string;
    toolArgs?: any;
    toolResult?: any;
    streamComplete?: boolean;
    tokenCount?: number;
    error?: Error;
  };
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  metadata?: {
    agents: string[];
    tags: string[];
    archived?: boolean;
  };
}
```

### 4. Context Management

**Purpose**: Maintain conversation context for LLM

```typescript
class ContextManager {
  private maxContextTokens: number = 8000;
  
  async buildContext(
    conversationId: string,
    currentMessage: string
  ): Promise<Message[]> {
    const history = await this.historyManager.getHistory(conversationId);
    
    // Token counting (approximate)
    let tokenCount = this.estimateTokens(currentMessage);
    const contextMessages: Message[] = [];
    
    // Always include system message
    const systemMsg = history.find(m => m.role === 'system');
    if (systemMsg) {
      contextMessages.push(systemMsg);
      tokenCount += this.estimateTokens(systemMsg.content);
    }
    
    // Add recent messages until token limit
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'system') continue;
      
      const msgTokens = this.estimateTokens(msg.content);
      if (tokenCount + msgTokens > this.maxContextTokens) break;
      
      contextMessages.unshift(msg);
      tokenCount += msgTokens;
    }
    
    return contextMessages;
  }
  
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}
```

### 5. Search System

```typescript
interface SearchOptions {
  conversationId?: string;
  role?: Message['role'];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

interface SearchResult {
  message: Message;
  score: number;
  highlights: string[];
}

class SearchEngine {
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // Full-text search using SQLite FTS5
    const results = await this.sqliteStore.search(query);
    
    // Filter by options
    let filtered = results;
    if (options.conversationId) {
      filtered = filtered.filter(m => m.conversationId === options.conversationId);
    }
    if (options.role) {
      filtered = filtered.filter(m => m.role === options.role);
    }
    if (options.dateFrom) {
      filtered = filtered.filter(m => m.timestamp >= options.dateFrom);
    }
    if (options.dateTo) {
      filtered = filtered.filter(m => m.timestamp <= options.dateTo);
    }
    
    // Generate highlights
    return filtered.map(msg => ({
      message: msg,
      score: this.calculateScore(msg, query),
      highlights: this.extractHighlights(msg.content, query)
    }));
  }
  
  private extractHighlights(content: string, query: string): string[] {
    const words = query.toLowerCase().split(' ');
    const sentences = content.split(/[.!?]+/);
    
    return sentences
      .filter(s => words.some(w => s.toLowerCase().includes(w)))
      .map(s => s.trim())
      .slice(0, 3);
  }
}
```

### 6. Export & Import

```typescript
class ConversationExporter {
  async exportJSON(conversationId: string): Promise<string> {
    const conversation = await this.historyManager.getConversation(conversationId);
    const messages = await this.historyManager.getHistory(conversationId);
    
    return JSON.stringify({
      version: '1.0',
      conversation,
      messages,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
  
  async exportMarkdown(conversationId: string): Promise<string> {
    const conversation = await this.historyManager.getConversation(conversationId);
    const messages = await this.historyManager.getHistory(conversationId);
    
    let md = `# ${conversation.title}\n\n`;
    md += `*Created: ${conversation.createdAt.toLocaleString()}*\n\n`;
    md += `---\n\n`;
    
    for (const msg of messages) {
      const icon = msg.role === 'user' ? '👤' : 
                   msg.role === 'assistant' ? '🤖' : 
                   msg.role === 'tool' ? '🔧' : '⚙️';
      
      md += `## ${icon} ${msg.role.toUpperCase()}\n`;
      md += `*${msg.timestamp.toLocaleString()}*\n\n`;
      md += `${msg.content}\n\n`;
      md += `---\n\n`;
    }
    
    return md;
  }
  
  async importJSON(data: string): Promise<string> {
    const imported = JSON.parse(data);
    
    // Create new conversation
    const newId = await this.historyManager.createConversation(
      imported.conversation.title + ' (imported)'
    );
    
    // Import messages
    for (const msg of imported.messages) {
      await this.historyManager.saveMessage(newId, {
        ...msg,
        conversationId: newId,
        id: uuidv4() // Generate new IDs
      });
    }
    
    return newId;
  }
}
```

## Performance Optimization

### 1. Caching Strategy
- Keep last 100 messages in memory per conversation
- Pre-load conversation list on startup
- Lazy load full message history

### 2. Indexing
```sql
-- Speed up common queries
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX idx_messages_conversation_time ON messages(conversation_id, timestamp DESC);
```

### 3. Pagination
```typescript
interface PaginationOptions {
  limit: number;
  offset: number;
  cursor?: string; // for cursor-based pagination
}

async getHistoryPaginated(
  conversationId: string,
  options: PaginationOptions
): Promise<{ messages: Message[], hasMore: boolean }> {
  const messages = await this.db.all(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
    [conversationId, options.limit + 1, options.offset]
  );
  
  const hasMore = messages.length > options.limit;
  if (hasMore) messages.pop();
  
  return { messages, hasMore };
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('ConversationHistoryManager', () => {
  it('should save and retrieve messages', async () => {
    const manager = new ConversationHistoryManager();
    await manager.initialize();
    
    const conversationId = 'test-123';
    const message: Message = {
      id: 'msg-1',
      conversationId,
      role: 'user',
      content: 'Hello',
      timestamp: new Date()
    };
    
    await manager.saveMessage(conversationId, message);
    const history = await manager.getHistory(conversationId);
    
    expect(history).toContainEqual(message);
  });
  
  it('should search messages', async () => {
    // Test full-text search
  });
  
  it('should export to markdown', async () => {
    // Test markdown export
  });
});
```

### Integration Tests
- Test with 10k+ messages
- Verify search performance
- Test concurrent access
- Verify data integrity

## File Structure
```
src/lib/history/
├── ConversationHistoryManager.ts
├── stores/
│   ├── MemoryStore.ts
│   ├── SQLiteStore.ts
│   └── PostgresStore.ts
├── ContextManager.ts
├── SearchEngine.ts
├── ConversationExporter.ts
└── __tests__/
    ├── HistoryManager.test.ts
    └── SearchEngine.test.ts
```

## Dependencies

```json
{
  "better-sqlite3": "^9.2.2",
  "uuid": "^9.0.1"
}
```

## Implementation Phases

### Phase 1: Core Storage (2 days)
- [x] ConversationHistoryManager interface
- [x] MemoryStore implementation
- [x] SQLite schema and store

### Phase 2: Search & Context (2 days)
- [ ] Full-text search with FTS5
- [ ] ContextManager with token limits
- [ ] Search highlighting

### Phase 3: Export/Import (1 day)
- [ ] JSON export/import
- [ ] Markdown export
- [ ] Text export

### Phase 4: Integration (1 day)
- [ ] Connect to ConversationalTUI
- [ ] Migrate from existing ConversationStore
- [ ] Testing

## Success Criteria
- ✅ Messages persist across restarts
- ✅ Search returns results in < 100ms
- ✅ Context building handles 100k+ messages
- ✅ Export/import works flawlessly
- ✅ No memory leaks

---
**Plan Status**: ✅ READY FOR IMPLEMENTATION  
**Estimated Effort**: 6 days  
**Blockers**: None