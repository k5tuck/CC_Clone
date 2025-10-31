#!/usr/bin/env node
import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { OrchestratorBridge } from './integration/OrchestratorBridge';
import { MultiAgentOrchestrator } from '../lib/orchestrator/multi-agent-orchestrator';
import { StreamingClient, Message as StreamMessage } from '../lib/streaming/StreamingClient';
import { ResponseBuffer } from '../lib/streaming/ResponseBuffer';
import { ConversationHistoryManager, Message } from '../lib/history/ConversationHistoryManager';
import { getSkillAwareAgent, SkillAwareAgent } from '../lib/agents/SkillAwareAgent';
import { createStreamingProviderAdapter } from '../lib/providers/StreamingClientAdapter';
import {
  AgentOrchestrator,
  AgentStatus,
  AgentMessage,
  AgentCreator,
  getAgentOrchestrator,
} from '../../src/lib/agents/AgentSystem';
import { getSkillManager } from '@/lib/skills/SkillManager';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// TYPES
// ============================================================================

interface AppState {
  conversationId: string | null;
  messages: Message[];
  currentInput: string;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  status: 'initializing' | 'ready' | 'streaming' | 'error';
  initialized: boolean;
  cursorPosition: number;
  
  // Agent state
  agentStatuses: Map<string, AgentStatus>;
  agentMessages: AgentMessage[];
  availableAgents: Array<{
    id: string;
    name: string;
    description: string;
    avatar: string;
    status: AgentStatus['status'];
  }>;
  activeSkills: string[];
  
  // UI state
  showAgentList: boolean;
  showSkillsList: boolean;
  showAgentCreator: boolean;
  creatorStep: 'idle' | 'id' | 'name' | 'description' | 'avatar' | 'capabilities' | 'keywords' | 'prompt';
  creatorData: Partial<{
    id: string;
    name: string;
    description: string;
    avatar: string;
    capabilities: string;
    keywords: string;
    systemPrompt: string;
  }>;
}

// ============================================================================
// COMPONENTS
// ============================================================================

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
    <Text color="cyan">
      {frames[frame]} {label || 'Loading...'}
    </Text>
  );
};

const ProgressBar: React.FC<{ progress: number; width?: number }> = ({
  progress,
  width = 30,
}) => {
  const filled = Math.floor((progress / 100) * width);
  const empty = width - filled;

  return (
    <Text>
      <Text color="cyan">{'█'.repeat(filled)}</Text>
      <Text color="gray" dimColor>{'░'.repeat(empty)}</Text>
    </Text>
  );
};

const AgentStatusBox: React.FC<{ status: AgentStatus; agent: any }> = ({
  status,
  agent,
}) => {
  const getStatusColor = (s: AgentStatus['status']) => {
    switch (s) {
      case 'idle': return 'gray';
      case 'thinking': return 'yellow';
      case 'working': return 'cyan';
      case 'waiting': return 'magenta';
      case 'completed': return 'green';
      case 'error': return 'red';
      default: return 'white';
    }
  };

  const getStatusIcon = (s: AgentStatus['status']) => {
    switch (s) {
      case 'idle': return '💤';
      case 'thinking': return '🤔';
      case 'working': return '⚙️';
      case 'waiting': return '⏳';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const elapsed = Math.floor((Date.now() - status.startTime.getTime()) / 1000);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={getStatusColor(status.status)} paddingX={1} marginBottom={1}>
      <Box>
        <Text>
          {agent?.avatar || '🤖'} <Text bold color={getStatusColor(status.status)}>{agent?.name || status.agentId}</Text>
        </Text>
        <Text color="gray"> • </Text>
        <Text color={getStatusColor(status.status)}>
          {getStatusIcon(status.status)} {status.status}
        </Text>
        <Text color="gray"> • {elapsed}s</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color="gray">{status.currentStep}</Text>
      </Box>
      {status.progress > 0 && status.progress < 100 && (
        <Box paddingLeft={2}>
          <ProgressBar progress={status.progress} width={35} />
          <Text color="gray"> {status.progress.toFixed(0)}%</Text>
        </Box>
      )}
    </Box>
  );
};

const AgentActivityLog: React.FC<{ messages: AgentMessage[] }> = ({ messages }) => {
  const getTypeIcon = (type: AgentMessage['type']) => {
    switch (type) {
      case 'thought': return '💭';
      case 'action': return '⚡';
      case 'result': return '📋';
      case 'error': return '❌';
      case 'progress': return '📊';
      default: return '•';
    }
  };

  const getTypeColor = (type: AgentMessage['type']) => {
    switch (type) {
      case 'thought': return 'yellow';
      case 'action': return 'cyan';
      case 'result': return 'green';
      case 'error': return 'red';
      case 'progress': return 'blue';
      default: return 'white';
    }
  };

  if (messages.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1}>
      <Text bold color="gray">📡 Agent Activity</Text>
      {messages.slice(-8).map((msg, idx) => {
        const timeStr = msg.timestamp.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        return (
          <Box key={idx} paddingLeft={1}>
            <Text color="gray" dimColor>[{timeStr}]</Text>
            <Text> </Text>
            <Text color={getTypeColor(msg.type)}>
              {getTypeIcon(msg.type)} {msg.agentName}:
            </Text>
            <Text> {msg.content.substring(0, 60)}{msg.content.length > 60 ? '...' : ''}</Text>
          </Box>
        );
      })}
    </Box>
  );
};

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text bold color={isUser ? 'cyan' : 'green'}>
          {isUser ? '▯ ' : '◆ '}
          {message.role}
        </Text>
        {message.metadata?.agentId && (
          <Text color="gray" dimColor> • {message.metadata.agentId}</Text>
        )}
      </Box>
      <Box paddingLeft={2}>
        <Text color={isUser ? 'white' : 'gray'}>
          {message.content || ' '}
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
      <Box>
        <Text bold color="green">
          ◆ assistant
        </Text>
        <Text color="gray" dimColor> (streaming...)</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color="gray">
          {content || ' '}
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
    
    const timer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(timer);
  }, [isActive]);

  const beforeCursor = value.slice(0, cursorPosition);
  const atCursor = value[cursorPosition] || ' ';
  const afterCursor = value.slice(cursorPosition + 1);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
        <Text color="cyan" bold>▯ </Text>
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

const StatusBar: React.FC<{ 
  status: AppState['status']; 
  error: string | null;
  agentCount: number;
  skillCount: number;
}> = ({ status, error, agentCount, skillCount }) => {
  const getStatusColor = (): string => {
    if (error) return 'red';
    switch (status) {
      case 'initializing': return 'yellow';
      case 'ready': return 'green';
      case 'streaming': return 'cyan';
      case 'error': return 'red';
      default: return 'white';
    }
  };

  const getStatusText = (): string => {
    if (error) return 'Error';
    switch (status) {
      case 'initializing': return 'Initializing...';
      case 'ready': return 'Ready';
      case 'streaming': return 'Streaming...';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  return (
    <Box borderStyle="round" borderColor={getStatusColor()} paddingX={1} marginBottom={1}>
      <Text color={getStatusColor()}>● </Text>
      <Text color={getStatusColor()}>{getStatusText()}</Text>
      {agentCount > 0 && (
        <>
          <Text color="gray"> • </Text>
          <Text color="cyan">{agentCount} agents</Text>
        </>
      )}
      {skillCount > 0 && (
        <>
          <Text color="gray"> • </Text>
          <Text color="magenta">{skillCount} skills</Text>
        </>
      )}
    </Box>
  );
};

const AgentCreatorUI: React.FC<{
  step: AppState['creatorStep'];
  data: AppState['creatorData'];
  currentInput: string;
}> = ({ step, data, currentInput }) => {
  const prompts = {
    idle: '',
    id: 'Enter agent ID (e.g., my-agent):',
    name: 'Enter agent name (e.g., My Custom Agent):',
    description: 'Enter description (what does this agent do?):',
    avatar: 'Enter emoji avatar (e.g., 🎨):',
    capabilities: 'Enter capabilities (comma-separated):',
    keywords: 'Enter activation keywords (comma-separated):',
    prompt: 'Enter system prompt (instructions for agent):',
  };

  if (step === 'idle') return null;

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="yellow" paddingX={1} marginBottom={1}>
      <Text bold color="yellow">🛠️  Agent Creator</Text>
      <Box flexDirection="column" paddingLeft={1} paddingY={1}>
        <Text color="cyan">➤ {prompts[step]}</Text>
        <Box paddingLeft={2} marginTop={1}>
          <Text>{currentInput}</Text>
          <Text color="cyan">█</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>Press Enter to continue • Esc to cancel</Text>
        </Box>
      </Box>
    </Box>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ConversationalTUI: React.FC = () => {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>({
    conversationId: null,
    messages: [],
    currentInput: '',
    isStreaming: false,
    streamingContent: '',
    error: null,
    status: 'initializing',
    initialized: false,
    cursorPosition: 0,
    agentStatuses: new Map(),
    agentMessages: [],
    availableAgents: [],
    activeSkills: [],
    showAgentList: false,
    showSkillsList: false,
    showAgentCreator: false,
    creatorStep: 'idle',
    creatorData: {},
  });

  const orchestratorRef = useRef<MultiAgentOrchestrator | null>(null);
  const bridgeRef = useRef<OrchestratorBridge | null>(null);
  const streamingClientRef = useRef<StreamingClient | null>(null);
  const historyManagerRef = useRef<ConversationHistoryManager | null>(null);
  const bufferRef = useRef<ResponseBuffer | null>(null);
  const agentOrchestratorRef = useRef<AgentOrchestrator | null>(null);
  const agentCreatorRef = useRef<AgentCreator | null>(null);
  const skillManagerRef = useRef<ReturnType<typeof getSkillManager> | null>(null);
  const mountedRef = useRef(true);

  // Initialize system
useEffect(() => {
  mountedRef.current = true;

  const init = async (): Promise<void> => {
    try {
      const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
      const model = process.env.OLLAMA_MODEL || 'llama3.1:latest';

      // Initialize streaming client
      streamingClientRef.current = new StreamingClient(endpoint, model);
      
      // Initialize history manager
      historyManagerRef.current = new ConversationHistoryManager();
      await historyManagerRef.current.initialize();

      // Initialize buffer
      bufferRef.current = new ResponseBuffer({ flushInterval: 50 });

      // Initialize main orchestrator
      const orchestrator = new MultiAgentOrchestrator(endpoint, model);
      await orchestrator.initialize();
      orchestratorRef.current = orchestrator;

      // Initialize orchestrator bridge
      const bridge = new OrchestratorBridge(
        orchestrator,
        streamingClientRef.current,
        historyManagerRef.current
      );
      bridgeRef.current = bridge;

      // Initialize agent orchestrator
      const agentOrchestrator = getAgentOrchestrator(
        streamingClientRef.current,
        './agents'
      );
      await agentOrchestrator.initialize();
      agentOrchestratorRef.current = agentOrchestrator;

      // Initialize agent creator
      agentCreatorRef.current = new AgentCreator('./agents');

      // Initialize skill manager
      const skillManager = getSkillManager('./skills');
      await skillManager.initialize();
      skillManagerRef.current = skillManager;

      // Initialize SkillAwareAgent 
      const streamingProvider = createStreamingProviderAdapter(
        streamingClientRef.current
      );

      // Initialize SkillAwareAgent
      const skillAwareAgent = getSkillAwareAgent(
        streamingProvider,
        './skills'
      );
      await skillAwareAgent.initialize();

      // Subscribe to agent events
      agentOrchestrator.onStatusUpdate((status: any) => {
        if (mountedRef.current) {
          setState(prev => {
            const newStatuses = new Map(prev.agentStatuses);
            newStatuses.set(status.agentId, status);
            return { ...prev, agentStatuses: newStatuses };
          });
        }
      });

      agentOrchestrator.onMessage((message: any) => {
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            agentMessages: [...prev.agentMessages.slice(-30), message],
          }));
        }
      });

      // Create conversation
      const conversationId = await historyManagerRef.current.createConversation(
        `Chat ${new Date().toLocaleString()}`
      );

      // Add enhanced system message
      await historyManagerRef.current.saveMessage(conversationId, {
        role: 'system',
        content: `You are CC_Clone, an AI assistant with a multi-agent orchestration system.

**Available Capabilities:**
- Spawn specialized agents for complex tasks
- Execute bash commands safely
- Read, write, and search files in the codebase
- Answer questions and provide guidance
- Utilize ${skillManager.getSkillCount()} specialized skills

**Available Commands:**
/help - Show detailed help and available commands
/agents - List currently active agents and their status
/skills - Show available skills
/spawn <type> <task> - Manually spawn an agent
/create-agent - Create a new custom agent
/reload - Reload agents and skills
/clear - Clear conversation history
/stats - Show conversation and system statistics

**How to Use:**
- Ask questions naturally, and I'll answer directly
- Request implementation work and I'll coordinate agents
- Use commands starting with / for system actions

I will automatically coordinate specialized agents when needed for complex tasks.`,
      });

      const messages = await historyManagerRef.current.getHistory(conversationId);
      const agents = agentOrchestrator.listAgents();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          conversationId,
          messages,
          status: 'ready',
          initialized: true,
          error: null,
          availableAgents: agents,
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: errorMessage,
          status: 'error',
          initialized: false,
        }));
      }

      console.error('Initialization failed:', error);
    }
  };

  init();

  return () => {
    mountedRef.current = false;
    historyManagerRef.current?.close();
    bufferRef.current?.dispose();
  };
}, []);

  const handleCommand = async (input: string): Promise<boolean> => {
    const parts = input.trim().split(/\s+/);
    const command = parts[0].toLowerCase();

    switch (command) {
      case '/help':
        setState(prev => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: 'system',
              content: `Available commands:
/agents - Toggle agent list
/skills - Toggle skills list
/agent <id> <task> - Execute an agent
/create-agent - Create a new agent
/reload - Reload agents and skills
/clear - Clear messages
/help - Show this help`,
            } as Message,
          ],
        }));
        return true;

      case '/agents':
        setState(prev => ({ ...prev, showAgentList: !prev.showAgentList }));
        return true;

      case '/skills':
        setState(prev => ({ ...prev, showSkillsList: !prev.showSkillsList }));
        return true;

      case '/agent': {
        if (parts.length < 3) {
          setState(prev => ({ ...prev, error: 'Usage: /agent <id> <task>' }));
          return true;
        }

        const agentId = parts[1];
        const task = parts.slice(2).join(' ');

        setState(prev => ({ ...prev, isStreaming: true, status: 'streaming' }));

        try {
          await agentOrchestratorRef.current?.executeAgent(agentId, task);
        } catch (error) {
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Agent failed',
          }));
        }

        setState(prev => ({ ...prev, isStreaming: false, status: 'ready' }));
        return true;
      }

      case '/create-agent':
        setState(prev => ({
          ...prev,
          showAgentCreator: true,
          creatorStep: 'id',
          creatorData: {},
        }));
        return true;

      case '/reload':
        await agentOrchestratorRef.current?.reloadAgents();
        await skillManagerRef.current?.reload();
        const agents = agentOrchestratorRef.current?.listAgents() || [];
        setState(prev => ({ ...prev, availableAgents: agents }));
        return true;

      case '/clear':
        setState(prev => ({ ...prev, messages: [], agentMessages: [] }));
        return true;

      default:
        return false;
    }
  };

  const handleAgentCreatorInput = async (input: string): Promise<void> => {
    const { creatorStep, creatorData } = state;
    const steps: Array<AppState['creatorStep']> = [
      'id', 'name', 'description', 'avatar', 'capabilities', 'keywords', 'prompt'
    ];

    const currentIndex = steps.indexOf(creatorStep);
    const nextStep = steps[currentIndex + 1] || 'idle';
    const updatedData = { ...creatorData, [creatorStep]: input };

    if (nextStep === 'idle') {
      try {
        await agentCreatorRef.current?.createAgent({
          id: updatedData.id!,
          name: updatedData.name!,
          description: updatedData.description!,
          avatar: updatedData.avatar || '🤖',
          capabilities: (updatedData.capabilities || '').split(',').map(s => s.trim()),
          activation_keywords: (updatedData.keywords || '').split(',').map(s => s.trim()),
          systemPrompt: updatedData.systemPrompt!,
        });

        await agentOrchestratorRef.current?.reloadAgents();
        const agents = agentOrchestratorRef.current?.listAgents() || [];

        setState(prev => ({
          ...prev,
          showAgentCreator: false,
          creatorStep: 'idle',
          creatorData: {},
          availableAgents: agents,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to create agent',
          showAgentCreator: false,
          creatorStep: 'idle',
        }));
      }
    } else {
      setState(prev => ({ ...prev, creatorStep: nextStep, creatorData: updatedData }));
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!state.currentInput.trim() || !state.conversationId) return;
    if (!bridgeRef.current || !historyManagerRef.current || !bufferRef.current) return;

    const userMessage = state.currentInput.trim();

    // Handle agent creator
    if (state.showAgentCreator && state.creatorStep !== 'idle') {
      await handleAgentCreatorInput(userMessage);
      setState(prev => ({ ...prev, currentInput: '', cursorPosition: 0 }));
      return;
    }

    // Handle commands
    if (userMessage.startsWith('/')) {
      const handled = await handleCommand(userMessage);
      if (handled) {
        setState(prev => ({ ...prev, currentInput: '', cursorPosition: 0 }));
        return;
      }
    }

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
      let fullResponse = '';
      const buffer = bufferRef.current;
      let isFirstToken = true;

      const unsubscribe = buffer.onFlush((text: string) => {
        fullResponse += text;
        if (mountedRef.current) {
          setState(prev => ({ ...prev, streamingContent: fullResponse }));
        }
      });

      for await (const event of bridgeRef.current.processMessage(state.conversationId, userMessage)) {
        if (!mountedRef.current) {
          unsubscribe();
          break;
        }

        if (event.type === 'token') {
          if (isFirstToken) {
            const updatedMessages = await historyManagerRef.current.getHistory(state.conversationId);
            setState(prev => ({ ...prev, messages: updatedMessages }));
            isFirstToken = false;
          }
          buffer.append(event.data);
        } else if (event.type === 'done') {
          buffer.flush();
          unsubscribe();
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
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
          
          const errorMessages = await historyManagerRef.current.getHistory(state.conversationId);
          
          if (mountedRef.current) {
            setState(prev => ({ 
              ...prev,
              messages: errorMessages,
              error: event.error?.message || 'Stream error', 
              isStreaming: false,
              status: 'error',
            }));
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      try {
        const errorMessages = await historyManagerRef.current.getHistory(state.conversationId);
        if (mountedRef.current) {
          setState(prev => ({ 
            ...prev,
            messages: errorMessages,
            error: errorMessage, 
            isStreaming: false,
            status: 'error',
          }));
        }
      } catch {
        if (mountedRef.current) {
          setState(prev => ({ 
            ...prev, 
            error: errorMessage, 
            isStreaming: false,
            status: 'error',
          }));
        }
      }
    }
  };

  // Input handling
  useInput((input, key) => {
    if (!state.initialized) return;

    if (key.ctrl && (input === 'c' || input === 'd')) {
      exit();
      return;
    }

    if (state.showAgentCreator && key.escape) {
      setState(prev => ({
        ...prev,
        showAgentCreator: false,
        creatorStep: 'idle',
        creatorData: {},
        currentInput: '',
        cursorPosition: 0,
      }));
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
  });

  const displayMessages = state.messages
    .filter(m => m.role !== 'system')
    .slice(-8);

  const activeAgents = Array.from(state.agentStatuses.values()).filter(
    s => s.status !== 'idle' && s.status !== 'completed'
  );

  const skillCount = skillManagerRef.current?.getSkillCount() || 0;

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

      {/* Status Bar */}
      <StatusBar 
        status={state.status} 
        error={state.error}
        agentCount={state.availableAgents.length}
        skillCount={skillCount}
      />

      {/* Error */}
      {state.error && (
        <Box marginBottom={1}>
          <Text color="red">❌ {state.error}</Text>
        </Box>
      )}

      {/* Agent List */}
      {state.showAgentList && state.availableAgents.length > 0 && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
          <Text bold color="cyan">🤖 Available Agents</Text>
          {state.availableAgents.map(agent => (
            <Box key={agent.id} paddingLeft={1}>
              <Text>
                {agent.avatar} <Text bold>{agent.name}</Text>
                <Text color="gray"> - {agent.description}</Text>
              </Text>
            </Box>
          ))}
          <Text color="gray" dimColor>Use /agent &lt;id&gt; &lt;task&gt; to activate</Text>
        </Box>
      )}

      {/* Skills List */}
      {state.showSkillsList && skillManagerRef.current && (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginBottom={1}>
          <Text bold color="magenta">🎯 Available Skills</Text>
          {skillManagerRef.current.listSkills().map((skill:any) => (
            <Box key={skill.name} paddingLeft={1}>
              <Text>
                <Text bold>{skill.name}</Text>
                <Text color="gray"> - {skill.description}</Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Active Skills */}
      {state.activeSkills && state.activeSkills.length > 0 && (
        <Box marginBottom={1}>
          <Text color="cyan">🔧 Active Skills: </Text>
          <Text color="gray">
            {state.activeSkills.join(', ')}
          </Text>
        </Box>
      )}

      {/* Agent Creator */}
      {state.showAgentCreator && (
        <AgentCreatorUI
          step={state.creatorStep}
          data={state.creatorData}
          currentInput={state.currentInput}
        />
      )}

      {/* Active Agents */}
      {activeAgents.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">⚡ Active Agents</Text>
          {activeAgents.map(status => {
            const agent = state.availableAgents.find(a => a.id === status.agentId);
            return <AgentStatusBox key={status.agentId} status={status} agent={agent} />;
          })}
        </Box>
      )}

      {/* Agent Activity Log */}
      <AgentActivityLog messages={state.agentMessages} />

      {/* Chat History */}
      {displayMessages.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {displayMessages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg} />
          ))}
        </Box>
      )}

      {/* Streaming message */}
      {state.isStreaming && (
        <StreamingMessage content={state.streamingContent} />
      )}

      {/* Input Area */}
      {state.initialized && !state.showAgentCreator && (
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
            ? 'Type your message or /help for commands • Enter to send • Ctrl+C to exit' 
            : 'Please wait while the system initializes...'}
        </Text>
      </Box>
    </Box>
  );
};

render(<ConversationalTUI />);