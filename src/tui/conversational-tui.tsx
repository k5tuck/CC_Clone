#!/usr/bin/env node
import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { StreamingClient, Message as StreamMessage } from '../lib/streaming/StreamingClient';
import { ResponseBuffer } from '../lib/streaming/ResponseBuffer';
import { ConversationHistoryManager, Message } from '../lib/history/ConversationHistoryManager';
import * as dotenv from 'dotenv';

dotenv.config();

interface AppState {
  conversationId: string | null;
  messages: Message[];
  currentInput: string;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  status: string;
  initialized: boolean;
}

const Spinner: React.FC<{ label?: string }> = ({ label }) => {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color="yellow">
      {frames[frame]} {label}
    </Text>
  );
};

const ConversationalTUI: React.FC = () => {
  const [state, setState] = useState<AppState>({
    conversationId: null,
    messages: [],
    currentInput: '',
    isStreaming: false,
    streamingContent: '',
    error: null,
    status: 'Initializing...',
    initialized: false,
  });

  const streamingClientRef = useRef<StreamingClient | null>(null);
  const historyManagerRef = useRef<ConversationHistoryManager | null>(null);
  const bufferRef = useRef<ResponseBuffer | null>(null);
  const inputRef = useRef<string>('');

  // Initialize system
  useEffect(() => {
    const init = async () => {
      try {
        const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
        const model = process.env.OLLAMA_MODEL || 'llama3.1:latest';

        streamingClientRef.current = new StreamingClient(endpoint, model);
        historyManagerRef.current = new ConversationHistoryManager();
        bufferRef.current = new ResponseBuffer({ flushInterval: 50 });

        await historyManagerRef.current.initialize();

        // Create initial conversation
        const conversationId = await historyManagerRef.current.createConversation(
          `Chat ${new Date().toLocaleString()}`
        );

        // Add system message
        await historyManagerRef.current.saveMessage(conversationId, {
          role: 'system',
          content: 'You are a helpful AI assistant with access to a multi-agent system. Answer questions concisely and accurately.',
        });

        setState(prev => ({
          ...prev,
          conversationId,
          status: 'Ready',
          initialized: true,
          error: null,
        }));
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          error: `Initialization failed: ${error.message}`,
          status: 'Error',
        }));
      }
    };

    init();

    return () => {
      historyManagerRef.current?.close();
      bufferRef.current?.dispose();
    };
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (state.conversationId && historyManagerRef.current) {
      historyManagerRef.current.getHistory(state.conversationId).then(messages => {
        setState(prev => ({ ...prev, messages }));
      });
    }
  }, [state.conversationId]);

  const handleSubmit = async () => {
    if (!inputRef.current.trim() || !state.conversationId) return;
    if (!streamingClientRef.current || !historyManagerRef.current || !bufferRef.current) return;

    const userMessage = inputRef.current.trim();
    inputRef.current = '';
    
    setState(prev => ({ ...prev, currentInput: '', isStreaming: true, streamingContent: '' }));

    try {
      // Save user message
      await historyManagerRef.current!.saveMessage(state.conversationId!, {
        role: 'user',
        content: userMessage,
      });

      // Reload messages
      const updatedMessages = await historyManagerRef.current!.getHistory(state.conversationId!);
      setState(prev => ({ ...prev, messages: updatedMessages }));

      // Get context for LLM
      const context = await historyManagerRef.current!.getContext(state.conversationId!);
      const llmMessages: StreamMessage[] = context.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      // Stream response
      let fullResponse = '';
      const buffer = bufferRef.current!;

      const unsubscribe = buffer.onFlush((text) => {
        fullResponse += text;
        setState(prev => ({ 
          ...prev, 
          streamingContent: fullResponse 
        }));
      });

      for await (const event of streamingClientRef.current!.stream(llmMessages)) {
        if (event.type === 'token') {
          buffer.append(event.data);
        } else if (event.type === 'done') {
          buffer.flush();
          unsubscribe();
          
          // Save assistant message
          await historyManagerRef.current!.saveMessage(state.conversationId!, {
            role: 'assistant',
            content: fullResponse,
          });

          // Reload messages
          const finalMessages = await historyManagerRef.current!.getHistory(state.conversationId!);
          setState(prev => ({ 
            ...prev, 
            messages: finalMessages, 
            isStreaming: false, 
            streamingContent: '' 
          }));
        } else if (event.type === 'error') {
          unsubscribe();
          setState(prev => ({ 
            ...prev, 
            error: event.error.message, 
            isStreaming: false 
          }));
        }
      }
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        error: error.message, 
        isStreaming: false 
      }));
    }
  };

  // Custom input handling
  useInput((input, key) => {
    if (!state.initialized || state.isStreaming) return;

    if (key.return) {
      handleSubmit();
    } else if (key.backspace || key.delete) {
      inputRef.current = inputRef.current.slice(0, -1);
      setState(prev => ({ ...prev, currentInput: inputRef.current }));
    } else if (input && !key.ctrl && !key.meta) {
      inputRef.current += input;
      setState(prev => ({ ...prev, currentInput: inputRef.current }));
    }
  });

  const getMessageIcon = (role: string) => {
    switch (role) {
      case 'user': return '👤';
      case 'assistant': return '🤖';
      case 'system': return '⚙️';
      case 'tool': return '🔧';
      default: return '•';
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Text bold color="cyan">🤖 CC_Clone - Conversational Interface</Text>
      </Box>

      {/* Status */}
      <Box marginBottom={1}>
        <Text color="gray">Status: </Text>
        <Text color={state.error ? 'red' : 'green'}>{state.status}</Text>
      </Box>

      {/* Error */}
      {state.error && (
        <Box marginBottom={1}>
          <Text color="red">❌ {state.error}</Text>
        </Box>
      )}

      {/* Chat History - Scrollable area */}
      <Box flexDirection="column" marginBottom={1}>
        {state.messages
          .filter(m => m.role !== 'system')
          .slice(-15) // Show last 15 messages
          .map((msg, idx) => (
            <Box key={idx} marginBottom={1} flexDirection="column">
              <Box>
                <Text color={msg.role === 'user' ? 'cyan' : 'white'}>
                  {getMessageIcon(msg.role)} {msg.role}
                </Text>
                <Text color="gray" dimColor> • {msg.timestamp.toLocaleTimeString()}</Text>
              </Box>
              <Text>{msg.content}</Text>
            </Box>
          ))}

        {/* Streaming message */}
        {state.isStreaming && (
          <Box marginBottom={1} flexDirection="column">
            <Box>
              <Text color="white">🤖 assistant</Text>
              <Text color="gray" dimColor> • streaming...</Text>
            </Box>
            <Text>{state.streamingContent}<Text color="cyan">▊</Text></Text>
          </Box>
        )}
      </Box>

      {/* Input Area */}
      {state.initialized && !state.isStreaming && (
        <Box borderStyle="single" borderColor="cyan" paddingX={1}>
          <Text color="cyan">💬 </Text>
          <Text>{state.currentInput}</Text>
          <Text color="cyan">▊</Text>
        </Box>
      )}

      {state.isStreaming && (
        <Box borderStyle="single" borderColor="yellow" paddingX={1}>
          <Spinner label="Processing..." />
        </Box>
      )}

      {/* Help */}
      <Box marginTop={1}>
        <Text dimColor color="gray">
          Type your message and press Enter • Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
};

render(<ConversationalTUI />);


// ----------------------- Version 5 -------------------------
// #!/usr/bin/env node
// import React, { useState, useEffect, useRef } from 'react';
// import { render, Box, Text, useInput } from 'ink';
// import TextInput from 'ink-text-input';
// import Spinner from 'ink-spinner';
// import { StreamingClient, Message as StreamMessage } from './lib/streaming/StreamingClient';
// import { ResponseBuffer } from './lib/streaming/ResponseBuffer';
// import { ConversationHistoryManager, Message } from './lib/history/ConversationHistoryManager';
// import * as dotenv from 'dotenv';

// dotenv.config();

// interface AppState {
//   conversationId: string | null;
//   messages: Message[];
//   currentInput: string;
//   isStreaming: boolean;
//   streamingContent: string;
//   error: string | null;
//   status: string;
//   initialized: boolean;
// }

// const ConversationalTUI: React.FC = () => {
//   const [state, setState] = useState<AppState>({
//     conversationId: null,
//     messages: [],
//     currentInput: '',
//     isStreaming: false,
//     streamingContent: '',
//     error: null,
//     status: 'Initializing...',
//     initialized: false,
//   });

//   const streamingClientRef = useRef<StreamingClient | null>(null);
//   const historyManagerRef = useRef<ConversationHistoryManager | null>(null);
//   const bufferRef = useRef<ResponseBuffer | null>(null);
//   const inputRef = useRef<string>('');

//   // Initialize system
//   useEffect(() => {
//     const init = async () => {
//       try {
//         const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
//         const model = process.env.OLLAMA_MODEL || 'llama3.1:latest';

//         streamingClientRef.current = new StreamingClient(endpoint, model);
//         historyManagerRef.current = new ConversationHistoryManager();
//         bufferRef.current = new ResponseBuffer({ flushInterval: 50 });

//         await historyManagerRef.current.initialize();

//         // Create initial conversation
//         const conversationId = await historyManagerRef.current.createConversation(
//           `Chat ${new Date().toLocaleString()}`
//         );

//         // Add system message
//         await historyManagerRef.current.saveMessage(conversationId, {
//           role: 'system',
//           content: 'You are a helpful AI assistant with access to a multi-agent system. Answer questions concisely and accurately.',
//         });

//         setState(prev => ({
//           ...prev,
//           conversationId,
//           status: 'Ready',
//           initialized: true,
//           error: null,
//         }));
//       } catch (error: any) {
//         setState(prev => ({
//           ...prev,
//           error: `Initialization failed: ${error.message}`,
//           status: 'Error',
//         }));
//       }
//     };

//     init();

//     return () => {
//       historyManagerRef.current?.close();
//       bufferRef.current?.dispose();
//     };
//   }, []);

//   // Load messages when conversation changes
//   useEffect(() => {
//     if (state.conversationId && historyManagerRef.current) {
//       historyManagerRef.current.getHistory(state.conversationId).then(messages => {
//         setState(prev => ({ ...prev, messages }));
//       });
//     }
//   }, [state.conversationId]);

//   const handleSubmit = async () => {
//     if (!inputRef.current.trim() || !state.conversationId) return;
//     if (!streamingClientRef.current || !historyManagerRef.current || !bufferRef.current) return;

//     const userMessage = inputRef.current.trim();
//     inputRef.current = '';
    
//     setState(prev => ({ ...prev, currentInput: '', isStreaming: true, streamingContent: '' }));

//     try {
//       // Save user message
//       await historyManagerRef.current!.saveMessage(state.conversationId!, {
//         role: 'user',
//         content: userMessage,
//       });

//       // Reload messages
//       const updatedMessages = await historyManagerRef.current!.getHistory(state.conversationId!);
//       setState(prev => ({ ...prev, messages: updatedMessages }));

//       // Get context for LLM
//       const context = await historyManagerRef.current!.getContext(state.conversationId!);
//       const llmMessages: StreamMessage[] = context.map(m => ({
//         role: m.role as 'user' | 'assistant' | 'system',
//         content: m.content,
//       }));

//       // Stream response
//       let fullResponse = '';
//       const buffer = bufferRef.current!;

//       const unsubscribe = buffer.onFlush((text) => {
//         fullResponse += text;
//         setState(prev => ({ 
//           ...prev, 
//           streamingContent: fullResponse 
//         }));
//       });

//       for await (const event of streamingClientRef.current!.stream(llmMessages)) {
//         if (event.type === 'token') {
//           buffer.append(event.data);
//         } else if (event.type === 'done') {
//           buffer.flush();
//           unsubscribe();
          
//           // Save assistant message
//           await historyManagerRef.current!.saveMessage(state.conversationId!, {
//             role: 'assistant',
//             content: fullResponse,
//           });

//           // Reload messages
//           const finalMessages = await historyManagerRef.current!.getHistory(state.conversationId!);
//           setState(prev => ({ 
//             ...prev, 
//             messages: finalMessages, 
//             isStreaming: false, 
//             streamingContent: '' 
//           }));
//         } else if (event.type === 'error') {
//           unsubscribe();
//           setState(prev => ({ 
//             ...prev, 
//             error: event.error.message, 
//             isStreaming: false 
//           }));
//         }
//       }
//     } catch (error: any) {
//       setState(prev => ({ 
//         ...prev, 
//         error: error.message, 
//         isStreaming: false 
//       }));
//     }
//   };

//   // Custom input handling
//   useInput((input, key) => {
//     if (!state.initialized || state.isStreaming) return;

//     if (key.return) {
//       handleSubmit();
//     } else if (key.backspace || key.delete) {
//       inputRef.current = inputRef.current.slice(0, -1);
//       setState(prev => ({ ...prev, currentInput: inputRef.current }));
//     } else if (input && !key.ctrl && !key.meta) {
//       inputRef.current += input;
//       setState(prev => ({ ...prev, currentInput: inputRef.current }));
//     }
//   });

//   const getMessageIcon = (role: string) => {
//     switch (role) {
//       case 'user': return '👤';
//       case 'assistant': return '🤖';
//       case 'system': return '⚙️';
//       case 'tool': return '🔧';
//       default: return '•';
//     }
//   };

//   return (
//     <Box flexDirection="column" padding={1}>
//       {/* Header */}
//       <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1}>
//         <Text bold color="cyan">🤖 CC_Clone - Conversational Interface</Text>
//       </Box>

//       {/* Status */}
//       <Box marginBottom={1}>
//         <Text color="gray">Status: </Text>
//         <Text color={state.error ? 'red' : 'green'}>{state.status}</Text>
//       </Box>

//       {/* Error */}
//       {state.error && (
//         <Box marginBottom={1}>
//           <Text color="red">❌ {state.error}</Text>
//         </Box>
//       )}

//       {/* Chat History */}
//       <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1} height={20}>
//         {state.messages
//           .filter(m => m.role !== 'system')
//           .map((msg, idx) => (
//             <Box key={idx} marginBottom={1} flexDirection="column">
//               <Box>
//                 <Text color={msg.role === 'user' ? 'cyan' : 'white'}>
//                   {getMessageIcon(msg.role)} {msg.role}
//                 </Text>
//                 <Text color="gray" dimColor> • {msg.timestamp.toLocaleTimeString()}</Text>
//               </Box>
//               <Text>{msg.content}</Text>
//             </Box>
//           ))}

//         {/* Streaming message */}
//         {state.isStreaming && (
//           <Box marginBottom={1} flexDirection="column">
//             <Box>
//               <Text color="white">🤖 assistant</Text>
//               <Text color="gray" dimColor> • streaming...</Text>
//             </Box>
//             <Text>{state.streamingContent}<Text color="cyan">▊</Text></Text>
//           </Box>
//         )}
//       </Box>

//       {/* Input Area */}
//       {state.initialized && !state.isStreaming && (
//         <Box borderStyle="single" borderColor="cyan" paddingX={1}>
//           <Text color="cyan">💬 </Text>
//           <Text>{state.currentInput}</Text>
//           <Text color="cyan">▊</Text>
//         </Box>
//       )}

//       {state.isStreaming && (
//         <Box borderStyle="single" borderColor="yellow" paddingX={1}>
//           <Text color="yellow"><Spinner type="dots" /> Processing...</Text>
//         </Box>
//       )}

//       {/* Help */}
//       <Box marginTop={1}>
//         <Text dimColor color="gray">
//           Type your message and press Enter • Ctrl+C to exit
//         </Text>
//       </Box>
//     </Box>
//   );
// };

// render(<ConversationalTUI />);