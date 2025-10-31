#!/usr/bin/env node
import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { OrchestratorBridge } from './integration/OrchestratorBridge';
import { MultiAgentOrchestrator } from '../lib/orchestrator/multi-agent-orchestrator';
import { StreamingClient } from '../lib/streaming/StreamingClient';
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
  activeAgents: number;
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
      {frames[frame]} {label || 'Loading...'}
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
    activeAgents: 0
  });

  const orchestratorRef = useRef<MultiAgentOrchestrator | null>(null);
  const bridgeRef = useRef<OrchestratorBridge | null>(null);
  const historyManagerRef = useRef<ConversationHistoryManager | null>(null);
  const bufferRef = useRef<ResponseBuffer | null>(null);

  // Initialize system
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
        const model = process.env.OLLAMA_MODEL || 'llama3.1:latest';

        setState(prev => ({ ...prev, status: 'Initializing orchestrator...' }));

        // Initialize orchestrator
        const orchestrator = new MultiAgentOrchestrator(endpoint, model);
        await orchestrator.initialize();
        orchestratorRef.current = orchestrator;

        setState(prev => ({ ...prev, status: 'Initializing history...' }));

        // Initialize history manager
        const historyManager = new ConversationHistoryManager();
        await historyManager.initialize();
        historyManagerRef.current = historyManager;

        // Initialize streaming client
        const streamingClient = new StreamingClient(endpoint, model);

        // Initialize buffer
        bufferRef.current = new ResponseBuffer({ flushInterval: 50 });

        // Create orchestrator bridge
        const bridge = new OrchestratorBridge(
          orchestrator,
          streamingClient,
          historyManager
        );
        bridgeRef.current = bridge;

        setState(prev => ({ ...prev, status: 'Creating conversation...' }));

        // Create conversation
        const conversationId = await historyManager.createConversation(
          `Chat ${new Date().toLocaleString()}`
        );

        // Add enhanced system message
        await historyManager.saveMessage(conversationId, {
          role: 'system',
          content: `You are CC_Clone, an AI assistant with a multi-agent orchestration system.

        **Available Capabilities:**
        - Spawn specialized agents for complex tasks:
          • Implementation Agent - TypeScript/JavaScript development
          • Security Agent - Security audits and vulnerability analysis
          • Performance Agent - Performance optimization and profiling
        - Execute bash commands safely
        - Read, write, and search files in the codebase
        - Answer questions and provide guidance

        **Available Commands:**
        /help - Show detailed help and available commands
        /agents - List currently active agents and their status
        /spawn <type> <task> - Manually spawn an agent (types: implementation, security, performance)
        /kill <agent-id> - Terminate a specific agent
        /clear - Clear conversation history and start fresh
        /stats - Show conversation and system statistics
        /export [format] - Export conversation (json|markdown|txt)

        **How to Use:**
        - Ask questions naturally, and I'll answer directly
        - Request implementation work like "Implement a user authentication system"
        - Request security audits like "Audit the security of the login flow"
        - Request optimizations like "Optimize the database query performance"
        - Use /spawn to manually create agents: "/spawn implementation Create a REST API"
        - Use commands starting with / for system actions

        I will automatically coordinate specialized agents when needed for complex tasks.`,
        });

        const messages = await historyManager.getHistory(conversationId);

        if (mounted) {
          setState(prev => ({
            ...prev,
            conversationId,
            messages,
            status: 'Ready',
            initialized: true,
            error: null,
          }));
        }
      } catch (error: any) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            error: `Initialization failed: ${error.message}`,
            status: 'Error',
          }));
        }
      }
    };

    init();

    return () => {
      mounted = false;
      historyManagerRef.current?.close();
      bufferRef.current?.dispose();
    };
  }, []);

 const handleSubmit = async () => {
  if (!state.currentInput.trim() || !state.conversationId) return;
  if (!bridgeRef.current || !historyManagerRef.current || !bufferRef.current) return;

  const userMessage = state.currentInput.trim();
  
  setState(prev => ({ 
    ...prev, 
    currentInput: '', 
    isStreaming: true, 
    streamingContent: '',
    error: null
  }));

  try {
    // Process through orchestrator bridge
    let fullResponse = '';
    const buffer = bufferRef.current;
    let isFirstToken = true;

    const unsubscribe = buffer.onFlush((text) => {
      fullResponse += text;
      setState(prev => ({ 
        ...prev, 
        streamingContent: fullResponse 
      }));
    });
 
    for await (const event of bridgeRef.current.processMessage(state.conversationId, userMessage)) {
      if (event.type === 'token') {
        // On first token, reload messages to show user input
        if (isFirstToken) {
          const updatedMessages = await historyManagerRef.current.getHistory(state.conversationId);
          setState(prev => ({ ...prev, messages: updatedMessages }));
          isFirstToken = false;
        }
        buffer.append(event.data);
      } else if (event.type === 'done') {
        buffer.flush();
        unsubscribe();
        
        // IMPORTANT: Wait a bit for the message to be saved, then reload
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const finalMessages = await historyManagerRef.current.getHistory(state.conversationId);
        setState(prev => ({ 
          ...prev, 
          messages: finalMessages, 
          isStreaming: false, 
          streamingContent: '' 
        }));
      } else if (event.type === 'error') {
        unsubscribe();
        
        // Reload messages even on error
        const errorMessages = await historyManagerRef.current.getHistory(state.conversationId);
        setState(prev => ({ 
          ...prev, 
          messages: errorMessages,
          error: event.error.message, 
          isStreaming: false,
          streamingContent: ''
        }));
      }


 
    }
  } catch (error: any) {
    // Reload messages on exception
    try {
      const errorMessages = await historyManagerRef.current.getHistory(state.conversationId);
      setState(prev => ({ 
        ...prev, 
        messages: errorMessages,
        error: error.message, 
        isStreaming: false,
        streamingContent: ''
      }));
    } catch {
      setState(prev => ({ 
        ...prev, 
        error: error.message, 
        isStreaming: false,
        streamingContent: ''
      }));
    }
  }
};

  // Custom input handling
  useInput((input, key) => {
    if (!state.initialized || state.isStreaming) return;

    if (key.return) {
      handleSubmit();
    } else if (key.backspace || key.delete) {
      setState(prev => ({ 
        ...prev, 
        currentInput: prev.currentInput.slice(0, -1) 
      }));
    } else if (input && !key.ctrl && !key.meta) {
      setState(prev => ({ 
        ...prev, 
        currentInput: prev.currentInput + input 
      }));
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
        <Text bold color="cyan">🤖 CC_Clone - Multi-Agent System</Text>
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

      {/* Chat History */}
      {state.messages.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {state.messages
            .filter(m => m.role !== 'system')
            .slice(-15)
            .map((msg, idx) => (
              <Box key={idx} marginBottom={1} flexDirection="column">
                <Box>
                  <Text color={msg.role === 'user' ? 'cyan' : 'white'}>
                    {getMessageIcon(msg.role)} {msg.role}
                  </Text>
                  {msg.metadata?.agentId && (
                    <Text color="gray" dimColor> • {msg.metadata.agentId}</Text>
                  )}
                </Box>
                <Text>{msg.content || ' '}</Text>
              </Box>
            ))}
        </Box>
      )}

      {/* Streaming message */}
      {state.isStreaming && (
        <Box marginBottom={1} flexDirection="column">
          <Box>
            <Text color="white">🤖 assistant</Text>
            <Text color="gray" dimColor> • streaming...</Text>
          </Box>
          <Text>
            {state.streamingContent || ' '}
            <Text color="cyan">▊</Text>
          </Text>
        </Box>
      )}

      {/* Input Area */}
      {state.initialized && !state.isStreaming && (
        <Box borderStyle="single" borderColor="cyan" paddingX={1}>
          <Text color="cyan">💬 </Text>
          <Text>{state.currentInput || ' '}</Text>
          <Text color="cyan">▊</Text>
        </Box>
      )}

      {state.isStreaming && (
        <Box borderStyle="single" borderColor="yellow" paddingX={1}>
          <Spinner label="Processing..." />
        </Box>
      )}

      {/* Agents */}
      <Box marginBottom={1}>
        <Text color="gray">Status: </Text>
        <Text color={state.error ? 'red' : 'green'}>{state.status}</Text>
        {state.activeAgents > 0 && (
          <>
            <Text color="gray"> • Agents: </Text>
            <Text color="yellow">{state.activeAgents} active</Text>
          </>
        )}
      </Box>

      {/* Help */}
      <Box marginTop={1}>
        <Text dimColor color="gray">
          Type your message or /help for commands • Enter to send • Ctrl+C to exit
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