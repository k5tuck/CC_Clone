# Streaming Implementation Plan

**Agent**: Streaming Agent  
**Status**: Planning Complete  
**Date**: 2025-10-29

## Objective
Implement real-time streaming response system for conversational TUI, enabling token-by-token display and live progress feedback.

## Technical Architecture

### 1. Streaming Protocol

#### Message Flow
```
Ollama/LLM → StreamingClient → ResponseBuffer → UIRenderer
                ↓
         ToolExecutor (if tool call detected)
```

#### Event Types
```typescript
type StreamEvent = 
  | { type: 'token'; data: string }
  | { type: 'tool_call'; tool: string; args: any }
  | { type: 'tool_result'; tool: string; result: any }
  | { type: 'error'; error: Error }
  | { type: 'done'; final: string };
```

### 2. Core Components

#### 2.1 StreamingClient
**Purpose**: Interface with LLM streaming endpoints

```typescript
class StreamingClient {
  private endpoint: string;
  private model: string;
  
  async *stream(
    messages: Message[],
    options?: StreamOptions
  ): AsyncGenerator<StreamEvent> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true
      })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(Boolean);
      
      for (const line of lines) {
        const data = JSON.parse(line);
        
        if (data.message?.content) {
          yield { type: 'token', data: data.message.content };
        }
        
        if (data.done) {
          yield { type: 'done', final: data.message.content };
        }
      }
    }
  }
}
```

#### 2.2 ResponseBuffer
**Purpose**: Buffer and manage streaming chunks for smooth rendering

```typescript
class ResponseBuffer {
  private buffer: string[] = [];
  private flushInterval: number = 50; // ms
  private listeners: ((text: string) => void)[] = [];
  
  append(chunk: string): void {
    this.buffer.push(chunk);
    this.scheduleFlush();
  }
  
  private scheduleFlush(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setTimeout(() => {
      const accumulated = this.buffer.join('');
      this.buffer = [];
      this.listeners.forEach(fn => fn(accumulated));
      this.flushTimer = null;
    }, this.flushInterval);
  }
  
  onFlush(fn: (text: string) => void): void {
    this.listeners.push(fn);
  }
}
```

#### 2.3 ToolStreamingCoordinator
**Purpose**: Handle tool calls during streaming

```typescript
class ToolStreamingCoordinator {
  async handleToolCall(
    toolName: string,
    args: any,
    onProgress: (status: string) => void
  ): Promise<any> {
    onProgress(`🔧 Executing ${toolName}...`);
    
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    try {
      const result = await tool.execute(args);
      onProgress(`✅ ${toolName} completed`);
      return result;
    } catch (error) {
      onProgress(`❌ ${toolName} failed: ${error.message}`);
      throw error;
    }
  }
}
```

### 3. Integration with Orchestrator

#### Adapter Pattern
```typescript
class OrchestratorStreamingAdapter {
  constructor(
    private orchestrator: MultiAgentOrchestrator,
    private streamingClient: StreamingClient
  ) {}
  
  async *executeWithStreaming(
    taskRequest: TaskRequest
  ): AsyncGenerator<StreamEvent> {
    // Convert task to conversation messages
    const messages = this.taskToMessages(taskRequest);
    
    // Stream response
    for await (const event of this.streamingClient.stream(messages)) {
      if (event.type === 'tool_call') {
        // Execute tool through orchestrator
        const result = await this.orchestrator.executeTool(
          event.tool,
          event.args
        );
        yield { type: 'tool_result', tool: event.tool, result };
      } else {
        yield event;
      }
    }
  }
}
```

### 4. Ollama-Specific Implementation

#### Streaming Format
Ollama streams newline-delimited JSON:
```json
{"model":"llama3.1:latest","created_at":"...","message":{"role":"assistant","content":"I"},"done":false}
{"model":"llama3.1:latest","created_at":"...","message":{"role":"assistant","content":" can"},"done":false}
{"model":"llama3.1:latest","created_at":"...","message":{"role":"assistant","content":" help"},"done":false}
```

#### Parser
```typescript
class OllamaStreamParser {
  parseChunk(chunk: string): StreamEvent[] {
    const events: StreamEvent[] = [];
    const lines = chunk.split('\n').filter(Boolean);
    
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        
        if (data.message?.content) {
          events.push({ 
            type: 'token', 
            data: data.message.content 
          });
        }
        
        if (data.done) {
          events.push({ 
            type: 'done', 
            final: data.message?.content || '' 
          });
        }
      } catch (e) {
        console.error('Failed to parse chunk:', line);
      }
    }
    
    return events;
  }
}
```

## Performance Optimization

### 1. Buffering Strategy
- **Minimum chunk size**: 10 characters before rendering
- **Maximum delay**: 100ms to prevent lag
- **Adaptive timing**: Speed up if buffer grows too large

### 2. Backpressure Handling
```typescript
class BackpressureHandler {
  private pending: number = 0;
  private maxPending: number = 10;
  
  async waitIfOverloaded(): Promise<void> {
    while (this.pending >= this.maxPending) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  increment(): void {
    this.pending++;
  }
  
  decrement(): void {
    this.pending--;
  }
}
```

### 3. Memory Management
- Clear old chunks after rendering
- Limit total buffer size to 1MB
- Use WeakMap for chunk references

## Error Handling

### Recovery Strategies
```typescript
class StreamingErrorHandler {
  async handleError(
    error: Error,
    retry: () => AsyncGenerator<StreamEvent>
  ): AsyncGenerator<StreamEvent> {
    // Network errors: retry with exponential backoff
    if (error.message.includes('fetch')) {
      yield { type: 'error', error };
      await this.backoff();
      yield* retry();
    }
    
    // Parse errors: skip and continue
    if (error instanceof SyntaxError) {
      console.warn('Skipping malformed chunk');
      return;
    }
    
    // Fatal errors: propagate
    throw error;
  }
  
  private async backoff(): Promise<void> {
    const delay = Math.min(1000 * Math.pow(2, this.retries), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));
    this.retries++;
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('StreamingClient', () => {
  it('should stream tokens sequentially', async () => {
    const client = new StreamingClient(mockEndpoint, 'test-model');
    const events = [];
    
    for await (const event of client.stream(messages)) {
      events.push(event);
    }
    
    expect(events).toContainEqual({ type: 'token', data: expect.any(String) });
    expect(events[events.length - 1]).toMatchObject({ type: 'done' });
  });
  
  it('should handle tool calls', async () => {
    // Test tool call detection and execution
  });
  
  it('should recover from network errors', async () => {
    // Test retry logic
  });
});
```

### Integration Tests
- Stream 1000+ tokens and verify ordering
- Test concurrent streams
- Verify memory doesn't leak
- Test with real Ollama endpoint

### Performance Benchmarks
- Latency: First token < 500ms
- Throughput: > 100 tokens/sec
- Memory: < 50MB for 10k tokens
- CPU: < 10% during streaming

## Dependencies

### External
```json
{
  "node-fetch": "^3.3.2"  // For streaming fetch
}
```

### Internal
- Architecture Agent: Event protocol
- UI Agent: Render integration
- Integration Agent: Orchestrator hooks

## File Structure
```
src/lib/streaming/
├── StreamingClient.ts
├── ResponseBuffer.ts
├── OllamaStreamParser.ts
├── ToolStreamingCoordinator.ts
├── BackpressureHandler.ts
├── StreamingErrorHandler.ts
└── __tests__/
    ├── StreamingClient.test.ts
    └── ResponseBuffer.test.ts
```

## Implementation Phases

### Phase 1: Core Streaming (2 days)
- [x] StreamingClient with Ollama support
- [x] ResponseBuffer with adaptive timing
- [x] Basic error handling

### Phase 2: Tool Integration (1 day)
- [ ] ToolStreamingCoordinator
- [ ] Tool call detection in stream
- [ ] Progress callbacks

### Phase 3: Performance (1 day)
- [ ] Backpressure handling
- [ ] Memory optimization
- [ ] Benchmarking

### Phase 4: Testing (1 day)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Performance tests

## Success Criteria
- ✅ Tokens appear within 500ms
- ✅ No visible lag during streaming
- ✅ Tool calls execute smoothly
- ✅ Errors handled gracefully
- ✅ Memory usage stays under 50MB

---
**Plan Status**: ✅ READY FOR IMPLEMENTATION  
**Estimated Effort**: 5 days  
**Blockers**: None (can start immediately)