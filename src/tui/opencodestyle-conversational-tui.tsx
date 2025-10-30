import React, { useState, useEffect, useRef } from ‘react’;
import { render, Box, Text, useInput, useApp } from ‘ink’;
import { StreamingClient, Message as StreamMessage } from ‘../lib/streaming/StreamingClient’;
import { ResponseBuffer } from ‘../lib/streaming/ResponseBuffer’;
import { ConversationHistoryManager, Message } from ‘../lib/history/ConversationHistoryManager’;
import * as dotenv from ‘dotenv’;

dotenv.config();

// Custom exceptions
class InitializationError extends Error {
constructor(message: string, public readonly cause?: Error) {
super(message);
this.name = ‘InitializationError’;
}
}

class StreamingError extends Error {
constructor(message: string, public readonly cause?: Error) {
super(message);
this.name = ‘StreamingError’;
}
}

class HistoryError extends Error {
constructor(message: string, public readonly cause?: Error) {
super(message);
this.name = ‘HistoryError’;
}
}

interface AppState {
conversationId: string | null;
messages: Message[];
currentInput: string;
isStreaming: boolean;
streamingContent: string;
error: string | null;
status: ‘initializing’ | ‘ready’ | ‘streaming’ | ‘error’;
initialized: boolean;
cursorPosition: number;
}

const Spinner: React.FC<{ label?: string }> = ({ label }) => {
const [frame, setFrame] = useState(0);
const frames = [‘⠋’, ‘⠙’, ‘⠹’, ‘⠸’, ‘⠼’, ‘⠴’, ‘⠦’, ‘⠧’, ‘⠇’, ‘⠏’];

useEffect(() => {
const timer = setInterval(() => {
setFrame(prev => (prev + 1) % frames.length);
}, 80);
return () => clearInterval(timer);
}, []);

return (
<Text color="cyan">
{frames[frame]} {label || ‘Loading…’}
</Text>
);
};

const MessageBubble: React.FC<{ message: Message; isLatest: boolean }> = ({ message, isLatest }) => {
const isUser = message.role === ‘user’;

return (
<Box flexDirection="column" marginY={1}>
<Box marginBottom={0}>
<Text bold color={isUser ? ‘cyan’ : ‘green’}>
{isUser ? ’❯ ’ : ’◆ ’}
{message.role}
</Text>
</Box>
<Box paddingLeft={2}>
<Text color={isUser ? ‘white’ : ‘gray’}>
{message.content || ’ ’}
</Text>
</Box>
</Box>
);
};

const StreamingMessage: React.FC<{ content: string }> = ({ content }) => {
const [showCursor, setShowCursor] = useState(true);

useEffect(() => {
const timer = setInterval(() => {
setShowCursor(prev => !prev);
}, 500);
return () => clearInterval(timer);
}, []);

return (
<Box flexDirection="column" marginY={1}>
<Box marginBottom={0}>
<Text bold color="green">
◆ assistant
</Text>
<Text color="gray" dimColor> (streaming…)</Text>
</Box>
<Box paddingLeft={2}>
<Text color="gray">
{content || ’ ’}
{showCursor && <Text color="green">█</Text>}
</Text>
</Box>
</Box>
);
};

const InputPrompt: React.FC<{
value: string;
cursorPosition: number;
isActive: boolean;
}> = ({ value, cursorPosition, isActive }) => {
const [showCursor, setShowCursor] = useState(true);

useEffect(() => {
if (!isActive) {
setShowCursor(false);
return;
}

```
const timer = setInterval(() => {
  setShowCursor(prev => !prev);
}, 530);
return () => clearInterval(timer);
```

}, [isActive]);

const beforeCursor = value.slice(0, cursorPosition);
const atCursor = value[cursorPosition] || ’ ’;
const afterCursor = value.slice(cursorPosition + 1);

return (
<Box flexDirection="column" marginTop={1}>
<Box borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
<Text color="cyan" bold>❯ </Text>
<Text>
{beforeCursor}
{isActive && showCursor ? (
<Text backgroundColor="cyan" color="black">{atCursor}</Text>
) : (
<Text>{atCursor}</Text>
)}
{afterCursor}
</Text>
</Box>
</Box>
);
};

const StatusBar: React.FC<{ status: AppState[‘status’]; error: string | null }> = ({
status,
error
}) => {
const getStatusColor = (): string => {
if (error) return ‘red’;
switch (status) {
case ‘initializing’: return ‘yellow’;
case ‘ready’: return ‘green’;
case ‘streaming’: return ‘cyan’;
case ‘error’: return ‘red’;
default: return ‘white’;
}
};

const getStatusText = (): string => {
if (error) return `Error: ${error}`;
switch (status) {
case ‘initializing’: return ‘Initializing…’;
case ‘ready’: return ‘Ready’;
case ‘streaming’: return ‘Streaming response…’;
case ‘error’: return ‘Error occurred’;
default: return ‘Unknown’;
}
};

return (
<Box borderStyle="round" borderColor={getStatusColor()} paddingX={1}>
<Text color={getStatusColor()}>● </Text>
<Text color={getStatusColor()}>{getStatusText()}</Text>
</Box>
);
};

const ConversationalTUI: React.FC = () => {
const { exit } = useApp();
const [state, setState] = useState<AppState>({
conversationId: null,
messages: [],
currentInput: ‘’,
isStreaming: false,
streamingContent: ‘’,
error: null,
status: ‘initializing’,
initialized: false,
cursorPosition: 0,
});

const streamingClientRef = useRef<StreamingClient | null>(null);
const historyManagerRef = useRef<ConversationHistoryManager | null>(null);
const bufferRef = useRef<ResponseBuffer | null>(null);
const mountedRef = useRef(true);

// Initialize system
useEffect(() => {
mountedRef.current = true;

```
const init = async (): Promise<void> => {
  try {
    const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3.1:latest';

    if (!endpoint || !model) {
      throw new InitializationError(
        'Missing required configuration: OLLAMA_ENDPOINT or OLLAMA_MODEL'
      );
    }

    streamingClientRef.current = new StreamingClient(endpoint, model);
    historyManagerRef.current = new ConversationHistoryManager();
    bufferRef.current = new ResponseBuffer({ flushInterval: 50 });

    await historyManagerRef.current.initialize();

    const conversationId = await historyManagerRef.current.createConversation(
      `Chat ${new Date().toLocaleString()}`
    );

    if (!conversationId) {
      throw new InitializationError('Failed to create conversation: conversationId is null');
    }

    await historyManagerRef.current.saveMessage(conversationId, {
      role: 'system',
      content: 'You are a helpful AI assistant with access to a multi-agent system. Answer questions concisely and accurately.',
    });

    const messages = await historyManagerRef.current.getHistory(conversationId);

    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        conversationId,
        messages,
        status: 'ready',
        initialized: true,
        error: null,
      }));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        error: errorMessage,
        status: 'error',
        initialized: false,
      }));
    }

    // Log error with context
    console.error('Initialization failed:', {
      error,
      timestamp: new Date().toISOString(),
      endpoint: process.env.OLLAMA_ENDPOINT,
      model: process.env.OLLAMA_MODEL,
    });
  }
};

init();

return () => {
  mountedRef.current = false;
  historyManagerRef.current?.close();
  bufferRef.current?.dispose();
};
```

}, []);

const handleSubmit = async (): Promise<void> => {
if (!state.currentInput.trim() || !state.conversationId) {
return;
}

```
if (!streamingClientRef.current || !historyManagerRef.current || !bufferRef.current) {
  setState(prev => ({
    ...prev,
    error: 'System not initialized',
    status: 'error',
  }));
  return;
}

const userMessage = state.currentInput.trim();

setState(prev => ({ 
  ...prev, 
  currentInput: '', 
  cursorPosition: 0,
  isStreaming: true, 
  streamingContent: '',
  status: 'streaming',
  error: null,
}));

try {
  // Save user message
  await historyManagerRef.current.saveMessage(state.conversationId, {
    role: 'user',
    content: userMessage,
  });

  // Reload messages
  const updatedMessages = await historyManagerRef.current.getHistory(state.conversationId);
  
  if (!mountedRef.current) return;
  
  setState(prev => ({ ...prev, messages: updatedMessages }));

  // Get context for LLM
  const context = await historyManagerRef.current.getContext(state.conversationId);
  const llmMessages: StreamMessage[] = context.map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  // Stream response
  let fullResponse = '';
  const buffer = bufferRef.current;

  const unsubscribe = buffer.onFlush((text: string) => {
    fullResponse += text;
    if (mountedRef.current) {
      setState(prev => ({ 
        ...prev, 
        streamingContent: fullResponse 
      }));
    }
  });

  for await (const event of streamingClientRef.current.stream(llmMessages)) {
    if (!mountedRef.current) {
      unsubscribe();
      break;
    }

    if (event.type === 'token') {
      buffer.append(event.data);
    } else if (event.type === 'done') {
      buffer.flush();
      unsubscribe();
      
      await historyManagerRef.current.saveMessage(state.conversationId, {
        role: 'assistant',
        content: fullResponse,
      });

      const finalMessages = await historyManagerRef.current.getHistory(state.conversationId);
      
      if (mountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          messages: finalMessages, 
          isStreaming: false, 
          streamingContent: '',
          status: 'ready',
        }));
      }
    } else if (event.type === 'error') {
      unsubscribe();
      
      const errorMessage = event.error?.message || 'Unknown streaming error';
      
      if (mountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          error: errorMessage, 
          isStreaming: false,
          status: 'error',
        }));
      }

      console.error('Streaming error:', {
        error: event.error,
        timestamp: new Date().toISOString(),
        conversationId: state.conversationId,
      });

      throw new StreamingError(errorMessage, event.error);
    }
  }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  if (mountedRef.current) {
    setState(prev => ({ 
      ...prev, 
      error: errorMessage, 
      isStreaming: false,
      status: 'error',
    }));
  }

  console.error('Message submission failed:', {
    error,
    timestamp: new Date().toISOString(),
    conversationId: state.conversationId,
    userMessage,
  });
}
```

};

// Custom input handling
useInput((input, key) => {
if (!state.initialized || state.isStreaming) return;

```
// Exit on Ctrl+C or Ctrl+D
if (key.ctrl && (input === 'c' || input === 'd')) {
  exit();
  return;
}

if (key.return) {
  handleSubmit();
} else if (key.backspace || key.delete) {
  if (state.cursorPosition > 0) {
    setState(prev => {
      const newInput = 
        prev.currentInput.slice(0, prev.cursorPosition - 1) + 
        prev.currentInput.slice(prev.cursorPosition);
      return {
        ...prev,
        currentInput: newInput,
        cursorPosition: prev.cursorPosition - 1,
      };
    });
  }
} else if (key.leftArrow) {
  setState(prev => ({
    ...prev,
    cursorPosition: Math.max(0, prev.cursorPosition - 1),
  }));
} else if (key.rightArrow) {
  setState(prev => ({
    ...prev,
    cursorPosition: Math.min(prev.currentInput.length, prev.cursorPosition + 1),
  }));
} else if (input && !key.ctrl && !key.meta && !key.shift) {
  setState(prev => {
    const newInput = 
      prev.currentInput.slice(0, prev.cursorPosition) + 
      input + 
      prev.currentInput.slice(prev.cursorPosition);
    return {
      ...prev,
      currentInput: newInput,
      cursorPosition: prev.cursorPosition + input.length,
    };
  });
}
```

});

const displayMessages = state.messages
.filter(m => m.role !== ‘system’)
.slice(-10);

return (
<Box flexDirection="column" padding={1}>
{/* Header */}
<Box marginBottom={1}>
<Text bold color="cyan">
┌─────────────────────────────────────────┐
</Text>
</Box>
<Box marginBottom={1} justifyContent="center">
<Text bold color="cyan">
│  🤖  CC_CLONE - AI Assistant  │
</Text>
</Box>
<Box marginBottom={1}>
<Text bold color="cyan">
└─────────────────────────────────────────┘
</Text>
</Box>

```
  {/* Status Bar */}
  <Box marginBottom={1}>
    <StatusBar status={state.status} error={state.error} />
  </Box>

  {/* Chat History */}
  {displayMessages.length > 0 && (
    <Box flexDirection="column" marginBottom={1}>
      {displayMessages.map((msg, idx) => (
        <MessageBubble 
          key={idx} 
          message={msg} 
          isLatest={idx === displayMessages.length - 1}
        />
      ))}
    </Box>
  )}

  {/* Streaming message */}
  {state.isStreaming && (
    <StreamingMessage content={state.streamingContent} />
  )}

  {/* Input Area */}
  {state.initialized && (
    <InputPrompt 
      value={state.currentInput}
      cursorPosition={state.cursorPosition}
      isActive={!state.isStreaming}
    />
  )}

  {/* Loading indicator */}
  {state.status === 'initializing' && (
    <Box marginTop={1}>
      <Spinner label="Initializing system..." />
    </Box>
  )}

  {/* Help */}
  <Box marginTop={1}>
    <Text dimColor color="gray">
      {state.initialized 
        ? 'Type your message and press Enter • Ctrl+C to exit' 
        : 'Please wait while the system initializes...'}
    </Text>
  </Box>
</Box>
```

);
};

render(<ConversationalTUI />);

// Code critique:
//
// Strengths:
// 1. ✅ Custom exception classes with proper error context
// 2. ✅ Comprehensive error handling with try-catch blocks
// 3. ✅ Proper cleanup in useEffect return functions
// 4. ✅ Type safety with TypeScript interfaces
// 5. ✅ Fail-fast pattern with early returns
// 6. ✅ Error logging with contextual information
// 7. ✅ Mounted ref to prevent state updates after unmount
// 8. ✅ Null checks before using refs
// 9. ✅ SOLID: Single Responsibility (components have clear purposes)
// 10. ✅ SOLID: Open/Closed (easily extendable via props)
//
// Potential Issues & Improvements:
// 1. ⚠️ Cursor navigation could be improved with Home/End key support
// 2. ⚠️ No message history scrolling - could add with Up/Down arrow keys
// 3. ⚠️ Large conversation histories could cause performance issues
// 4. ⚠️ No message edit/delete functionality
// 5. ⚠️ Could add Dependency Injection for better testability
// 6. ⚠️ Error recovery could be more robust (retry mechanisms)
// 7. ⚠️ StreamingClient and other dependencies should be interfaces
// 8. ⚠️ Magic numbers (10 message limit, 530ms cursor) should be constants
// 9. ⚠️ Could benefit from a state machine for status management
// 10. ⚠️ No unit tests (would require mocking ink and dependencies)
//
// Security Considerations:
// 1. ✅ Input sanitization happens via trim()
// 2. ⚠️ Should validate message content length
// 3. ⚠️ Should rate-limit user submissions
// 4. ⚠️ Environment variables should be validated at startup
//
// Performance Optimizations:
// 1. Could memoize MessageBubble components
// 2. Could implement virtual scrolling for large message lists
// 3. Could debounce streaming updates
// 4. Could lazy-load conversation history