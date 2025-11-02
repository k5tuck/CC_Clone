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
import { StreamingClientWithTools, registerStandardTools } from '../lib/streaming/StreamingClientWithTools';
import {
  AgentOrchestrator,
  AgentStatus,
  AgentMessage,
  AgentCreator,
  getAgentOrchestrator,
} from '../../src/lib/agents/AgentSystem';
import { getSkillManager } from '@/lib/skills/SkillManager';
import { MCPClientManager } from '../mcp/mcp-client';
import { getAgentManager } from '../lib/agents/AgentManager';
import { OllamaClient } from '../lib/llm/ollama-client';
import { LLMConfigManager, ProviderConfig } from '../lib/config/LLMConfig';
import * as dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();
import { createProjectContext } from '../lib/context/ProjectContextLoader';

// Permission System
import { PermissionManager, PermissionRequest, PermissionDecision } from '../lib/permissions';
import { PermissionPrompt, PermissionIndicator } from './components';
import {
  initializePermissionManager,
  createPermissionRequestHandler,
  handlePermissionDecision,
  getCurrentProjectPath,
} from './integration/PermissionIntegration';

// Tool Tracking System
import { getToolTracker, ToolExecutionEvent, ToolUsageStats } from '../lib/tool-tracking';
import { ToolUsagePanel, ToolIndicator } from './components';

// Status Tracking System
import { initializeStatusTracker, getStatusTracker, StatusInfo } from '../lib/status';
import { EnhancedStatusLine, CompactStatusBar } from './components';

// Session Management System
import { getSessionManager, SessionMetadata, SessionTemplate } from '../lib/sessions';
import { SessionSwitcher, SessionIndicator } from './components';

// Context Inspection System
import { getContextInspector, ContextStats, ContextItem, ContextSuggestion } from '../lib/context';
import { ContextInspectorPanel, ContextSuggestions } from './components';

// Clipboard System
import { getClipboardHandler, ImagePasteResult, ClipboardContentType } from '../lib/clipboard';
import { ImagePasteIndicator, ClipboardPrompt } from './components';

// Search System
import { getSearchEngine, SearchResult, SearchResultType } from '../lib/search';
import { SearchModal } from './components';

// Knowledge Graph System
import { getGraphVisualizer, GraphVisualizer, KnowledgeGraph } from '../lib/knowledge';
import { KnowledgeGraphPanel } from './components';
import { getKnowledgeGraphTools } from '../lib/tools/knowledge-tools';

// Agent Pipeline System
import { getAgentPipelineTracker, AgentPipelineTracker } from '../lib/agents/AgentPipeline';
import { AgentPipelinePanel } from './components';

// Error Recovery System (Phase 2)
import { getErrorRecoverySystem, ErrorRecoverySystem } from '../lib/errors';
import { ErrorRecoveryPanel } from './components';

// Agent Communication System (Phase 3)
import { getAgentCommunicationLog, AgentCommunicationLog } from '../lib/agents/AgentCommunication';
import { AgentCommunicationPanel } from './components';

// Template System (Phase 3)
import { getTemplateManager, TemplateManager } from '../lib/templates';
import { TemplateBrowserPanel } from './components';

// Semantic Search System (Phase 3)
import { getSemanticSearchEngine, SemanticSearchEngine } from '../lib/semantic-search';

// Rollback System (Phase 3)
import { getRollbackManager, RollbackManager } from '../lib/rollback';

// Theme System (Phase 3)
import { getThemeManager, ThemeManager } from '../lib/themes';

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

  // Autocomplete state
  suggestions: string[];
  selectedSuggestion: number;
  showSuggestions: boolean;

  // Agent management UI
  showAgentManager: boolean;
  agentManagerMode: 'list' | 'view' | 'edit' | 'delete' | 'templates' | null;
  selectedAgentId: string | null;

  // Plan approval
  pendingPlan: { agentType: string; planFile: string; content: string } | null;
  awaitingApproval: boolean;

  // Model selection
  currentModel: string;
  availableModels: string[];
  ollamaEndpoint: string;

  // Provider management
  currentProvider: 'anthropic' | 'openai' | 'ollama';
  availableProviders: Array<{
    name: string;
    enabled: boolean;
    configured: boolean;
    defaultModel?: string;
  }>;
  showProviderSelector: boolean;

  // Agent auto-suggest
  autoSuggestEnabled: boolean;
  suggestedAgent: { id: string; name: string; confidence: number } | null;

  // Permission System
  permissionManager: PermissionManager | null;
  pendingPermissionRequest: PermissionRequest | null;
  showPermissionPrompt: boolean;
  recentPermissions: number;
  permissionResolver?: (decision: PermissionDecision) => void;

  // Tool Tracking
  activeToolCalls: ToolExecutionEvent[];
  recentToolCalls: ToolExecutionEvent[];
  toolStats: ToolUsageStats[];
  showToolPanel: boolean;
  showToolStats: boolean;

  // Status Tracking
  statusInfo?: StatusInfo;
  showDetailedStatus: boolean;
  showCompactStatus: boolean;

  // Session Management
  sessions: SessionMetadata[];
  currentSession?: SessionMetadata;
  showSessionSwitcher: boolean;

  // Context Inspection
  contextStats?: ContextStats;
  contextItems: ContextItem[];
  contextSuggestions: ContextSuggestion[];
  showContextInspector: boolean;
  showContextDetails: boolean;

  // Clipboard
  pastedImage?: ImagePasteResult;
  clipboardContentType?: ClipboardContentType;
  showClipboardPrompt: boolean;

  // Search
  showSearch: boolean;
  searchResults: SearchResult[];

  // Knowledge Graph
  showKnowledgeGraph: boolean;

  // Agent Pipeline
  showAgentPipeline: boolean;
  showPipelineStats: boolean;

  // Error Recovery (Phase 2)
  showErrorRecovery: boolean;

  // Agent Communication (Phase 3)
  showAgentCommunication: boolean;
  communicationMode: 'messages' | 'threads';

  // Template Browser (Phase 3)
  showTemplateBrowser: boolean;

  // Semantic Search (Phase 3)
  showSemanticSearch: boolean;
  semanticSearchQuery: string;

  // Rollback (Phase 3)
  showRollbackHistory: boolean;

  // Theme Selector (Phase 3)
  showThemeSelector: boolean;
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
        <Text bold color={isUser ? 'cyan' : '#E26313'}>
          {isUser ? '▯ ' : '◆ '}
          {message.role.toUpperCase()}
        </Text>
            {message.metadata?.agentId && (
          <Text color="gray" dimColor> • {message.metadata.agentId}</Text>
        )}
      </Box>
      <Box paddingLeft={2}>
        <Text color={isUser ? 'white' : 'white'}>
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
        <Text bold color="#CD853F">
          ◆ assistant
        </Text>
        <Text color="white"> (streaming...)</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color="white">
          {content || ' '}
          {showCursor && <Text color="#CD853F">█</Text>}
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
        {/* CHANGED: Split into separate Text components with explicit colors */}
        <Text color="white">{beforeCursor}</Text>
        {isActive && showCursor ? (
          <Text backgroundColor="cyan" color="black">{atCursor}</Text>
        ) : (
          <Text color="white">{atCursor}</Text>
        )}
        <Text color="white">{afterCursor}</Text>
      </Box>
    </Box>
  );
};

const StatusBar: React.FC<{
  status: AppState['status'];
  error: string | null;
  agentCount: number;
  skillCount: number;
  currentModel: string;
  currentProvider: string;
  autoSuggestEnabled: boolean;
}> = ({ status, error, agentCount, skillCount, currentModel, currentProvider, autoSuggestEnabled }) => {
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
    <Box borderStyle="round" borderColor='#FEFFF1' paddingX={1} marginBottom={1}>
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
      <Text color="gray"> • </Text>
      <Text color="yellow">Provider: {currentProvider}</Text>
      <Text color="gray"> • </Text>
      <Text color="blue">Model: {currentModel}</Text>
      <Text color="gray"> • </Text>
      <Text color={autoSuggestEnabled ? 'green' : 'gray'}>
        AutoSuggest: {autoSuggestEnabled ? 'ON' : 'OFF'}
      </Text>
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
          <Text color="white" dimColor>Press Enter to continue • Esc to cancel</Text>
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
    suggestions: [],
    selectedSuggestion: 0,
    showSuggestions: false,
    showAgentManager: false,
    agentManagerMode: null,
    selectedAgentId: null,
    pendingPlan: null,
    awaitingApproval: false,
    currentModel: process.env.OLLAMA_MODEL || 'llama3.1:latest',
    availableModels: [],
    ollamaEndpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
    currentProvider: 'ollama',
    availableProviders: [],
    showProviderSelector: false,
    autoSuggestEnabled: true,
    suggestedAgent: null,

    // Permission System
    permissionManager: null,
    pendingPermissionRequest: null,
    showPermissionPrompt: false,
    recentPermissions: 0,

    // Tool Tracking
    activeToolCalls: [],
    recentToolCalls: [],
    toolStats: [],
    showToolPanel: true,
    showToolStats: false,

    // Status Tracking
    showDetailedStatus: false,
    showCompactStatus: true,

    // Session Management
    sessions: [],
    showSessionSwitcher: false,

    // Context Inspection
    contextItems: [],
    contextSuggestions: [],
    showContextInspector: false,
    showContextDetails: false,

    // Clipboard
    showClipboardPrompt: false,

    // Search
    showSearch: false,
    searchResults: [],

    // Knowledge Graph
    showKnowledgeGraph: false,

    // Agent Pipeline
    showAgentPipeline: false,
    showPipelineStats: false,

    // Error Recovery (Phase 2)
    showErrorRecovery: false,

    // Agent Communication (Phase 3)
    showAgentCommunication: false,
    communicationMode: 'threads',

    // Template Browser (Phase 3)
    showTemplateBrowser: false,

    // Semantic Search (Phase 3)
    showSemanticSearch: false,
    semanticSearchQuery: '',

    // Rollback (Phase 3)
    showRollbackHistory: false,

    // Theme Selector (Phase 3)
    showThemeSelector: false,
  });

  const orchestratorRef = useRef<MultiAgentOrchestrator | null>(null);
  const bridgeRef = useRef<OrchestratorBridge | null>(null);
  const streamingClientRef = useRef<StreamingClient | null>(null);
  const historyManagerRef = useRef<ConversationHistoryManager | null>(null);
  const bufferRef = useRef<ResponseBuffer | null>(null);
  const agentOrchestratorRef = useRef<AgentOrchestrator | null>(null);
  const agentCreatorRef = useRef<AgentCreator | null>(null);
  const skillManagerRef = useRef<ReturnType<typeof getSkillManager> | null>(null);
  const mcpManagerRef = useRef<MCPClientManager | null>(null);
  const agentManagerRef = useRef<ReturnType<typeof getAgentManager> | null>(null);
  const ollamaClientRef = useRef<OllamaClient | null>(null);
  const llmConfigRef = useRef<LLMConfigManager | null>(null);
  const mountedRef = useRef(true);
  const toolClientRef = useRef<StreamingClientWithTools | null>(null);
  const statusUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const searchEngineRef = useRef<ReturnType<typeof getSearchEngine> | null>(null);
  const graphVisualizerRef = useRef<GraphVisualizer | null>(null);
  const pipelineTrackerRef = useRef<AgentPipelineTracker | null>(null);

  // Phase 2 & 3 System Refs
  const errorRecoveryRef = useRef<ErrorRecoverySystem | null>(null);
  const communicationLogRef = useRef<AgentCommunicationLog | null>(null);
  const templateManagerRef = useRef<TemplateManager | null>(null);
  const semanticSearchRef = useRef<SemanticSearchEngine | null>(null);
  const rollbackManagerRef = useRef<RollbackManager | null>(null);
  const themeManagerRef = useRef<ThemeManager | null>(null);

  // Initialize system
useEffect(() => {
  mountedRef.current = true;

  const init = async (): Promise<void> => {
    try {
      const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
      const model = process.env.OLLAMA_MODEL || 'llama3.1:latest';

      // Initialize streaming client
      streamingClientRef.current = new StreamingClient(endpoint, model);

      // Initialize Ollama client for model management
      ollamaClientRef.current = new OllamaClient({
        baseUrl: endpoint,
        model: model,
      });

      // Initialize LLM Configuration Manager
      llmConfigRef.current = new LLMConfigManager();
      try {
        const config = await llmConfigRef.current.load();
        console.log('[LLM Config] Loaded configuration');

        // Determine current provider
        const currentProv = config.defaultProvider as any || 'ollama';

        // Build available providers list
        const providers: Array<{name: string; enabled: boolean; configured: boolean; defaultModel: string}> = [];
        if (config.providers.anthropic) {
          providers.push({
            name: 'anthropic',
            enabled: config.providers.anthropic.enabled,
            configured: !!config.providers.anthropic.apiKey,
            defaultModel: config.providers.anthropic.defaultModel || 'claude-3-sonnet-20240229',
          });
        }
        if (config.providers.openai) {
          providers.push({
            name: 'openai',
            enabled: config.providers.openai.enabled,
            configured: !!config.providers.openai.apiKey,
            defaultModel: config.providers.openai.defaultModel || 'gpt-4',
          });
        }
        if (config.providers.ollama) {
          providers.push({
            name: 'ollama',
            enabled: config.providers.ollama.enabled,
            configured: true, // Ollama is always configured locally
            defaultModel: config.providers.ollama.defaultModel || 'llama3',
          });
        }

        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            currentProvider: currentProv,
            availableProviders: providers,
          }));
        }
      } catch (error) {
        console.warn('[LLM Config] Failed to load configuration:', error);
      }

      // Load available models
      try {
        const models = await ollamaClientRef.current.listModels();
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            availableModels: models,
            currentModel: model,
            ollamaEndpoint: endpoint,
          }));
        }
        console.log('[Ollama] Available models:', models);
      } catch (error) {
        console.warn('[Ollama] Failed to list models:', error);
      }

      // Initialize tool-enabled streaming client
      toolClientRef.current = new StreamingClientWithTools(
        streamingClientRef.current as any,
        10 // max iterations for tool calling loop
      );

      // Register all tools
      registerStandardTools(toolClientRef.current);
      console.log('[Tools] Registered:', toolClientRef.current.getAvailableTools());

      // Initialize MCP (Model Context Protocol) servers
      try {
        mcpManagerRef.current = new MCPClientManager();
        const mcpConfigPath = './config/mcp-servers.json';

        try {
          await fs.access(mcpConfigPath);
          const configContent = await fs.readFile(mcpConfigPath, 'utf-8');
          const mcpConfig = JSON.parse(configContent);

          console.log('[MCP] Loading servers from config...');

          for (const server of mcpConfig.servers) {
            try {
              await mcpManagerRef.current.connectToServer(server);
            } catch (error) {
              console.warn(`[MCP] Failed to connect to ${server.name}:`, error);
            }
          }

          // Register MCP tools with the tool client
          const mcpTools = mcpManagerRef.current.getToolsForLLM();
          console.log(`[MCP] Registering ${mcpTools.length} MCP tools`);

          for (const tool of mcpTools) {
            toolClientRef.current.registerTool(
              tool.name,
              async (params: Record<string, any>) => {
                return await mcpManagerRef.current!.callTool(tool.name, params);
              },
              tool as any
            );
          }

          const mcpStats = mcpManagerRef.current.getStats();
          console.log(`[MCP] ✓ Loaded ${mcpStats.connectedServers} servers with ${mcpStats.totalTools} tools`);
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            console.log('[MCP] No mcp-servers.json found, skipping MCP initialization');
          } else {
            console.warn('[MCP] Failed to load MCP config:', error);
          }
        }
      } catch (error) {
        console.warn('[MCP] MCP initialization failed:', error);
      }

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

      // Initialize agent manager
      agentManagerRef.current = getAgentManager('./agents');

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

      let projectContext = '';
      try {
        projectContext = await createProjectContext(process.cwd());
        console.log('[ProjectContext] Loaded project structure');
      } catch (error) {
        console.warn('[ProjectContext] Failed to load project context:', error);
        projectContext = 'Project context unavailable.';
}

      // Add enhanced system message
      await historyManagerRef.current.saveMessage(conversationId, {
        role: 'system',
        content: `You are Selek, an AI assistant with a multi-agent orchestration system.

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

        I will automatically coordinate specialized agents when needed for complex tasks.

        ---

        # CURRENT PROJECT CONTEXT

        ${projectContext}

        ---

        **Important:** When you're asked about "this project", "the current codebase", or similar, 
        you now have the project structure above as context. Use the file tools (readFile, searchFiles, blobSearch) 
        to read specific files when you need more details.`,
        });

      const messages = await historyManagerRef.current.getHistory(conversationId);
      const agents = agentOrchestrator.listAgents();

      // Initialize permission manager
      const projectPath = getCurrentProjectPath();
      const permissionManager = initializePermissionManager(projectPath);
      const permissionHandler = createPermissionRequestHandler(setState);
      permissionManager.setPermissionRequestHandler(permissionHandler);
      console.log('[Permissions] Permission system initialized for:', projectPath);

      // Initialize tool tracker
      const toolTracker = getToolTracker();
      toolTracker.subscribe((event) => {
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            activeToolCalls: toolTracker.getActiveToolCalls(),
            recentToolCalls: toolTracker.getHistory(10),
            toolStats: toolTracker.getAllStats(),
          }));
        }
      });
      console.log('[Tools] Tool tracking initialized');

      // Initialize status tracker
      const statusTracker = initializeStatusTracker(
        conversationId,
        state.currentProvider,
        state.currentModel,
        200000 // 200k token limit
      );

      statusTracker.subscribe((statusInfo) => {
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            statusInfo,
          }));
        }
      });

      // Start periodic status updates
      statusUpdateIntervalRef.current = setInterval(() => {
        const tracker = getStatusTracker();
        if (tracker) {
          tracker.updateOperationTime();
        }
      }, 1000);

      console.log('[Status] Status tracking initialized');

      // Initialize session manager
      const sessionManager = getSessionManager();
      const initialSession = sessionManager.createSession(
        `Chat ${new Date().toLocaleString()}`,
        {
          model: state.currentModel,
          provider: state.currentProvider,
        }
      );

      sessionManager.subscribe((sessions) => {
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            sessions,
            currentSession: sessionManager.getCurrentSession(),
          }));
        }
      });

      console.log('[Sessions] Session management initialized');

      // Initialize context inspector
      const contextInspector = getContextInspector();
      contextInspector.subscribe((stats) => {
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            contextStats: stats,
            contextItems: contextInspector.getAllItems(),
            contextSuggestions: contextInspector.getSuggestions(),
          }));
        }
      });

      console.log('[Context] Context inspector initialized');

      // Initialize search engine
      searchEngineRef.current = getSearchEngine(process.cwd());
      console.log('[Search] Search engine initialized');

      // Initialize agent pipeline tracker
      pipelineTrackerRef.current = getAgentPipelineTracker();
      console.log('[Pipeline] Agent pipeline tracker initialized');

      // Initialize knowledge graph visualizer lazily
      // The visualizer will be created when the knowledge graph panel is shown
      // For now, create a placeholder graph for demonstration
      const kgTools = getKnowledgeGraphTools();
      const demoGraph = new KnowledgeGraph('selek-project');
      graphVisualizerRef.current = getGraphVisualizer(demoGraph);
      console.log('[KnowledgeGraph] Graph visualizer initialized');

      // Initialize Phase 2 & 3 systems
      errorRecoveryRef.current = getErrorRecoverySystem();
      console.log('[ErrorRecovery] Error recovery system initialized');

      communicationLogRef.current = getAgentCommunicationLog();
      console.log('[Communication] Agent communication log initialized');

      templateManagerRef.current = getTemplateManager();
      await templateManagerRef.current.initialize();
      console.log('[Templates] Template manager initialized');

      semanticSearchRef.current = getSemanticSearchEngine();
      console.log('[SemanticSearch] Semantic search engine initialized');

      rollbackManagerRef.current = getRollbackManager();
      await rollbackManagerRef.current.initialize();
      console.log('[Rollback] Rollback manager initialized');

      themeManagerRef.current = getThemeManager();
      await themeManagerRef.current.initialize();
      console.log('[Themes] Theme manager initialized');

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          conversationId,
          messages,
          status: 'ready',
          initialized: true,
          error: null,
          availableAgents: agents,
          permissionManager,
          statusInfo: statusTracker.getStatus(),
          currentSession: initialSession,
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

    // Cleanup MCP connections
    if (mcpManagerRef.current) {
      mcpManagerRef.current.disconnectAll().catch(error => {
        console.warn('[MCP] Cleanup error:', error);
      });
    }

    // Cleanup status update interval
    if (statusUpdateIntervalRef.current) {
      clearInterval(statusUpdateIntervalRef.current);
    }

    // Cleanup permission system
    PermissionManager.clearSession();
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
              content: `**Available Commands:**

**Chat & System:**
• /help - Show this help
• /clear - Clear messages
• /reload - Reload agents and skills

**Agent Management:**
• /agent-list - List all agents
• /agent-view <id> - View agent details
• /agent-delete <id> - Delete an agent
• /agent <id> <task> - Execute a specific agent
• /create-agent - Create a new agent
• /agents - Toggle agent list display
• /autosuggest - Toggle agent auto-suggest on/off

**Model Management:**
• /models - List available Ollama models
• /model <name> - Switch to a different model
• /model-current - Show current model

**Templates:**
• /templates - List agent templates
• /template-export <id> [category] - Export agent as template
• /template-install <template-id> <new-id> - Install template

**Plan Approval:**
• /approve - Approve pending plan
• /reject - Reject pending plan

**Other:**
• /skills - Toggle skills list
• /mcp - Show MCP servers and tools status

**Keyboard Shortcuts:**

**Phase 1 - Core UX:**
• Ctrl+F - Universal Search (files, agents, conversations, commands)
• Ctrl+U - Toggle Tool Usage Panel
• Ctrl+Shift+U - Toggle Tool Statistics
• Ctrl+S - Toggle Detailed Status Line
• Ctrl+Shift+S - Toggle Compact Status Bar
• Ctrl+E - Session Switcher (switch/create sessions)
• Ctrl+I - Context Inspector (view context usage)
• Ctrl+Shift+I - Context Details (show/hide details)
• Ctrl+V - Paste from Clipboard (images supported)

**Phase 2 - Advanced Visualization:**
• Ctrl+G - Knowledge Graph Visualization (entity relationships)
• Ctrl+P - Agent Pipeline View (collaboration tracking)
• Ctrl+Shift+P - Toggle Pipeline Statistics
• Ctrl+R - Error Recovery Panel (view/fix errors)

**Phase 3 - Productivity Features:**
• Ctrl+M - Agent Communication Log (inter-agent messages)
• Ctrl+Shift+M - Toggle Messages/Threads view
• Ctrl+T - Template Browser (conversation templates)
• Ctrl+Shift+T - Theme Selector (choose color themes)
• Ctrl+Z - Rollback History (undo file changes)

**System:**
• Ctrl+C / Ctrl+D - Exit`,
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

      case '/mcp': {
        if (!mcpManagerRef.current) {
          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: '❌ MCP is not initialized',
              } as Message,
            ],
          }));
          return true;
        }

        const stats = mcpManagerRef.current.getStats();
        const servers = mcpManagerRef.current.getConnectedServers();
        const allTools = mcpManagerRef.current.getAllTools();

        let mcpInfo = `**MCP Status**\n\n`;
        mcpInfo += `✅ Connected Servers: ${stats.connectedServers}\n`;
        mcpInfo += `🔧 Total Tools: ${stats.totalTools}\n\n`;

        if (servers.length > 0) {
          mcpInfo += `**Servers:**\n`;
          for (const server of servers) {
            const toolCount = stats.byServer[server] || 0;
            mcpInfo += `  • ${server}: ${toolCount} tools\n`;
          }

          mcpInfo += `\n**Available Tools:**\n`;
          for (const { name, serverName } of allTools.slice(0, 20)) {
            mcpInfo += `  • ${name} (from ${serverName})\n`;
          }

          if (allTools.length > 20) {
            mcpInfo += `  ... and ${allTools.length - 20} more\n`;
          }
        } else {
          mcpInfo += `No servers connected. Add servers to config/mcp-servers.json\n`;
        }

        setState(prev => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: 'system',
              content: mcpInfo,
            } as Message,
          ],
        }));
        return true;
      }

      case '/agent-list': {
        if (!agentManagerRef.current) {
          setState(prev => ({ ...prev, error: 'Agent manager not initialized' }));
          return true;
        }

        try {
          const agents = await agentManagerRef.current.listAgents();
          let agentList = `**📋 Agent Library** (${agents.length} agents)\n\n`;

          for (const agent of agents) {
            agentList += `${agent.metadata.avatar} **${agent.metadata.name}** (\`${agent.metadata.id}\`)\n`;
            agentList += `   ${agent.metadata.description}\n`;
            agentList += `   Capabilities: ${agent.metadata.capabilities.join(', ')}\n\n`;
          }

          agentList += `\nCommands:\n`;
          agentList += `• /agent-view <id> - View agent details\n`;
          agentList += `• /agent-delete <id> - Delete an agent\n`;
          agentList += `• /template-export <id> - Export as template\n`;

          setState(prev => ({
            ...prev,
            messages: [...prev.messages, { role: 'system', content: agentList } as Message],
          }));
        } catch (error) {
          setState(prev => ({ ...prev, error: `Failed to list agents: ${error}` }));
        }
        return true;
      }

      case '/agent-view': {
        if (parts.length < 2) {
          setState(prev => ({ ...prev, error: 'Usage: /agent-view <agent-id>' }));
          return true;
        }

        if (!agentManagerRef.current) {
          setState(prev => ({ ...prev, error: 'Agent manager not initialized' }));
          return true;
        }

        try {
          const agentId = parts[1];
          const agent = await agentManagerRef.current.getAgent(agentId);

          if (!agent) {
            setState(prev => ({ ...prev, error: `Agent not found: ${agentId}` }));
            return true;
          }

          let details = `${agent.metadata.avatar} **${agent.metadata.name}**\n\n`;
          details += `**ID:** \`${agent.metadata.id}\`\n`;
          details += `**Description:** ${agent.metadata.description}\n`;
          details += `**Version:** ${agent.metadata.version}\n`;
          details += `**Capabilities:** ${agent.metadata.capabilities.join(', ')}\n`;
          details += `**Keywords:** ${agent.metadata.activation_keywords?.join(', ') || 'None'}\n`;
          details += `**Temperature:** ${agent.config.temperature}\n`;
          details += `**Max Tokens:** ${agent.config.maxTokens}\n\n`;
          details += `**System Prompt:**\n\`\`\`\n${agent.config.systemPrompt.substring(0, 300)}...\n\`\`\`\n`;

          setState(prev => ({
            ...prev,
            messages: [...prev.messages, { role: 'system', content: details } as Message],
          }));
        } catch (error) {
          setState(prev => ({ ...prev, error: `Failed to view agent: ${error}` }));
        }
        return true;
      }

      case '/agent-delete': {
        if (parts.length < 2) {
          setState(prev => ({ ...prev, error: 'Usage: /agent-delete <agent-id>' }));
          return true;
        }

        if (!agentManagerRef.current) {
          setState(prev => ({ ...prev, error: 'Agent manager not initialized' }));
          return true;
        }

        try {
          const agentId = parts[1];
          await agentManagerRef.current.deleteAgent(agentId);

          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: 'system', content: `✅ Deleted agent: ${agentId}` } as Message
            ],
          }));

          // Reload agents
          await agentOrchestratorRef.current?.reloadAgents();
          const agents = agentOrchestratorRef.current?.listAgents() || [];
          setState(prev => ({ ...prev, availableAgents: agents }));
        } catch (error) {
          setState(prev => ({ ...prev, error: `Failed to delete agent: ${error}` }));
        }
        return true;
      }

      case '/templates': {
        if (!agentManagerRef.current) {
          setState(prev => ({ ...prev, error: 'Agent manager not initialized' }));
          return true;
        }

        try {
          const templates = await agentManagerRef.current.listTemplates();
          let templateList = `**📦 Agent Templates** (${templates.length} available)\n\n`;

          if (templates.length === 0) {
            templateList += `No templates found. Export an agent with /template-export <agent-id>\n`;
          } else {
            for (const template of templates) {
              templateList += `• **${template.name}** (\`${template.id}\`)\n`;
              templateList += `  ${template.description}\n`;
              templateList += `  Category: ${template.category}\n\n`;
            }

            templateList += `\nCommands:\n`;
            templateList += `• /template-install <template-id> <new-agent-id> - Install template\n`;
            templateList += `• /template-export <agent-id> - Export agent as template\n`;
          }

          setState(prev => ({
            ...prev,
            messages: [...prev.messages, { role: 'system', content: templateList } as Message],
          }));
        } catch (error) {
          setState(prev => ({ ...prev, error: `Failed to list templates: ${error}` }));
        }
        return true;
      }

      case '/template-export': {
        if (parts.length < 2) {
          setState(prev => ({ ...prev, error: 'Usage: /template-export <agent-id> [category]' }));
          return true;
        }

        if (!agentManagerRef.current) {
          setState(prev => ({ ...prev, error: 'Agent manager not initialized' }));
          return true;
        }

        try {
          const agentId = parts[1];
          const category = parts[2] || 'custom';
          await agentManagerRef.current.exportAsTemplate(agentId, category);

          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: 'system', content: `✅ Exported ${agentId} as template` } as Message
            ],
          }));
        } catch (error) {
          setState(prev => ({ ...prev, error: `Failed to export template: ${error}` }));
        }
        return true;
      }

      case '/template-install': {
        if (parts.length < 3) {
          setState(prev => ({
            ...prev,
            error: 'Usage: /template-install <template-id> <new-agent-id>'
          }));
          return true;
        }

        if (!agentManagerRef.current) {
          setState(prev => ({ ...prev, error: 'Agent manager not initialized' }));
          return true;
        }

        try {
          const templateId = parts[1];
          const newAgentId = parts[2];
          await agentManagerRef.current.importFromTemplate(templateId, newAgentId);

          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: 'system', content: `✅ Installed template ${templateId} as ${newAgentId}` } as Message
            ],
          }));

          // Reload agents
          await agentOrchestratorRef.current?.reloadAgents();
          const agents = agentOrchestratorRef.current?.listAgents() || [];
          setState(prev => ({ ...prev, availableAgents: agents }));
        } catch (error) {
          setState(prev => ({ ...prev, error: `Failed to install template: ${error}` }));
        }
        return true;
      }

      case '/approve': {
        if (!state.awaitingApproval || !state.pendingPlan) {
          setState(prev => ({
            ...prev,
            error: 'No plan awaiting approval'
          }));
          return true;
        }

        setState(prev => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: 'system',
              content: `✅ Plan approved! Executing ${prev.pendingPlan?.agentType} plan...`
            } as Message
          ],
          awaitingApproval: false,
          isStreaming: true,
        }));

        // Execute the plan
        try {
          const result = await orchestratorRef.current?.executePlan(state.pendingPlan.planFile);

          if (result?.success) {
            setState(prev => ({
              ...prev,
              messages: [
                ...prev.messages,
                {
                  role: 'system',
                  content: `✅ Plan executed successfully!\nSteps completed: ${result.completedSteps.length}\nTime: ${result.executionTime.toFixed(2)}s`
                } as Message
              ],
              pendingPlan: null,
              isStreaming: false,
            }));
          } else {
            setState(prev => ({
              ...prev,
              error: `Plan execution failed: ${result?.error?.message}`,
              pendingPlan: null,
              isStreaming: false,
            }));
          }
        } catch (error) {
          setState(prev => ({
            ...prev,
            error: `Failed to execute plan: ${error}`,
            pendingPlan: null,
            isStreaming: false,
          }));
        }
        return true;
      }

      case '/reject': {
        if (!state.awaitingApproval || !state.pendingPlan) {
          setState(prev => ({
            ...prev,
            error: 'No plan awaiting approval'
          }));
          return true;
        }

        setState(prev => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: 'system',
              content: `❌ Plan rejected. How would you like to modify the approach?`
            } as Message
          ],
          awaitingApproval: false,
          pendingPlan: null,
        }));
        return true;
      }

      case '/models': {
        if (!ollamaClientRef.current) {
          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: '❌ Ollama client not initialized',
              } as Message,
            ],
          }));
          return true;
        }

        try {
          const models = await ollamaClientRef.current.listModels();
          setState(prev => ({
            ...prev,
            availableModels: models,
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: `**Available Ollama Models:**\n\n${models.map(m =>
                  m === state.currentModel ? `• ${m} ✓ (current)` : `• ${m}`
                ).join('\n')}\n\nUse /model <name> to switch models.`,
              } as Message,
            ],
          }));
        } catch (error) {
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Failed to list models',
          }));
        }
        return true;
      }

      case '/model': {
        if (parts.length < 2) {
          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: 'Usage: /model <name>\n\nUse /models to see available models.',
              } as Message,
            ],
          }));
          return true;
        }

        const newModel = parts.slice(1).join(' ');

        try {
          // Reinitialize streaming client with new model
          streamingClientRef.current = new StreamingClient(state.ollamaEndpoint, newModel);

          // Reinitialize tool client
          toolClientRef.current = new StreamingClientWithTools(
            streamingClientRef.current as any,
            10
          );
          registerStandardTools(toolClientRef.current);

          // Update Ollama client
          ollamaClientRef.current = new OllamaClient({
            baseUrl: state.ollamaEndpoint,
            model: newModel,
          });

          // Reinitialize orchestrator with new model
          const orchestrator = new MultiAgentOrchestrator(state.ollamaEndpoint, newModel);
          await orchestrator.initialize();
          orchestratorRef.current = orchestrator;

          const bridge = new OrchestratorBridge(
            orchestrator,
            streamingClientRef.current,
            historyManagerRef.current!
          );
          bridgeRef.current = bridge;

          setState(prev => ({
            ...prev,
            currentModel: newModel,
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: `✅ Switched to model: ${newModel}`,
              } as Message,
            ],
          }));
        } catch (error) {
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Failed to switch model',
          }));
        }
        return true;
      }

      case '/model-current': {
        setState(prev => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: 'system',
              content: `**Current Model:** ${state.currentModel}\n**Endpoint:** ${state.ollamaEndpoint}`,
            } as Message,
          ],
        }));
        return true;
      }

      case '/providers': {
        if (!llmConfigRef.current) {
          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: '❌ LLM Config not initialized',
              } as Message,
            ],
          }));
          return true;
        }

        try {
          const config = await llmConfigRef.current.load();
          const providerList = Object.entries(config.providers)
            .map(([name, cfg]) => {
              const status = cfg?.enabled ? '✓' : '✗';
              const configured = name === 'ollama' || cfg?.apiKey ? '🔑' : '❌';
              const isCurrent = config.defaultProvider === name ? ' (current)' : '';
              return `• ${name}${isCurrent} - ${status} Enabled, ${configured} Configured - Model: ${cfg?.defaultModel || 'N/A'}`;
            })
            .join('\n');

          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: `**Available Providers:**\n\n${providerList}\n\n**Current:** ${config.defaultProvider}\n\nUse /provider <name> to switch providers.`,
              } as Message,
            ],
          }));
        } catch (error) {
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Failed to list providers',
          }));
        }
        return true;
      }

      case '/provider': {
        if (parts.length < 2) {
          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: 'Usage: /provider <name>\n\nAvailable providers: anthropic, openai, ollama\n\nUse /providers to see details.',
              } as Message,
            ],
          }));
          return true;
        }

        const newProvider = parts[1].toLowerCase() as 'anthropic' | 'openai' | 'ollama';

        if (!['anthropic', 'openai', 'ollama'].includes(newProvider)) {
          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: `❌ Unknown provider: ${newProvider}\n\nAvailable: anthropic, openai, ollama`,
              } as Message,
            ],
          }));
          return true;
        }

        if (!llmConfigRef.current) {
          setState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: '❌ LLM Config not initialized',
              } as Message,
            ],
          }));
          return true;
        }

        try {
          const config = await llmConfigRef.current.load();
          const providerConfig = config.providers[newProvider];

          if (!providerConfig) {
            throw new Error(`Provider ${newProvider} not configured`);
          }

          if (!providerConfig.enabled) {
            throw new Error(`Provider ${newProvider} is not enabled. Enable it first in your configuration.`);
          }

          if (newProvider !== 'ollama' && !providerConfig.apiKey) {
            throw new Error(`Provider ${newProvider} requires an API key. Configure it first.`);
          }

          // Set as default provider
          await llmConfigRef.current.setDefaultProvider(newProvider);

          // Update state
          setState(prev => ({
            ...prev,
            currentProvider: newProvider,
            currentModel: providerConfig.defaultModel || '',
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: `✅ Switched to provider: ${newProvider}\n📦 Default model: ${providerConfig.defaultModel || 'N/A'}\n\n${newProvider === 'ollama' ? 'Note: Use /model <name> to switch Ollama models.' : 'Note: Streaming client will use this provider for next requests.'}`,
              } as Message,
            ],
          }));

          console.log(`[Provider] Switched to ${newProvider}`);
        } catch (error) {
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Failed to switch provider',
            messages: [
              ...prev.messages,
              {
                role: 'system',
                content: `❌ ${error instanceof Error ? error.message : 'Failed to switch provider'}`,
              } as Message,
            ],
          }));
        }
        return true;
      }

      case '/autosuggest': {
        const newValue = !state.autoSuggestEnabled;
        setState(prev => ({
          ...prev,
          autoSuggestEnabled: newValue,
          suggestedAgent: null,
          messages: [
            ...prev.messages,
            {
              role: 'system',
              content: `Agent auto-suggest ${newValue ? 'enabled ✓' : 'disabled ✗'}`,
            } as Message,
          ],
        }));
        return true;
      }

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

  // Generate autocomplete suggestions
  const generateSuggestions = (input: string): string[] => {
    if (!input.startsWith('/')) {
      return [];
    }

    const commands = [
      '/help',
      '/clear',
      '/reload',
      '/agents',
      '/agent-list',
      '/agent-view ',
      '/agent-delete ',
      '/skills',
      '/mcp',
      '/create-agent',
      '/templates',
      '/template-export ',
      '/template-install ',
      '/approve',
      '/models',
      '/model ',
      '/model-current',
      '/autosuggest',
      '/reject',
    ];

    // Add agent-specific commands
    if (state.availableAgents.length > 0) {
      for (const agent of state.availableAgents) {
        commands.push(`/agent ${agent.id} `);
        commands.push(`/agent-view ${agent.id}`);
        commands.push(`/agent-delete ${agent.id}`);
        commands.push(`/template-export ${agent.id}`);
      }
    }

    const matches = commands.filter(cmd =>
      cmd.toLowerCase().startsWith(input.toLowerCase())
    );

    return matches.slice(0, 15); // Limit to 15 suggestions
  };

  // Update suggestions when input changes
  useEffect(() => {
    if (state.currentInput.startsWith('/') && state.currentInput.length > 1) {
      const suggestions = generateSuggestions(state.currentInput);
      if (suggestions.length > 0) {
        setState(prev => ({
          ...prev,
          suggestions,
          showSuggestions: true,
          selectedSuggestion: 0,
        }));
      } else {
        setState(prev => ({
          ...prev,
          suggestions: [],
          showSuggestions: false,
        }));
      }
    } else {
      setState(prev => ({
        ...prev,
        suggestions: [],
        showSuggestions: false,
      }));
    }
  }, [state.currentInput, state.availableAgents]);

  // Auto-suggest best agent for the user's request
  const suggestAgent = (userMessage: string): { agentId: string; confidence: number; reason: string } | null => {
    if (!state.availableAgents || state.availableAgents.length === 0 || !agentOrchestratorRef.current) {
      return null;
    }

    const message = userMessage.toLowerCase();
    const scores: Array<{ agentId: string; score: number; matchedKeywords: string[] }> = [];

    for (const agent of state.availableAgents) {
      let score = 0;
      const matchedKeywords: string[] = [];

      // Get full agent metadata
      const fullAgent = agentOrchestratorRef.current.getAgent(agent.id);
      if (!fullAgent) continue;

      // Check activation keywords
      const keywords = fullAgent.metadata.activation_keywords || [];
      for (const keyword of keywords) {
        if (message.includes(keyword.toLowerCase())) {
          score += 10;
          matchedKeywords.push(keyword);
        }
      }

      // Check capabilities
      const capabilities = fullAgent.metadata.capabilities || [];
      for (const capability of capabilities) {
        const capWords = capability.toLowerCase().replace(/_/g, ' ').split(' ');
        for (const word of capWords) {
          if (word.length > 3 && message.includes(word)) {
            score += 5;
            matchedKeywords.push(capability);
          }
        }
      }

      // Check agent name
      if (message.includes(agent.name.toLowerCase())) {
        score += 15;
      }

      if (score > 0) {
        scores.push({ agentId: agent.id, score, matchedKeywords });
      }
    }

    // Sort by score and return best match
    scores.sort((a, b) => b.score - a.score);

    if (scores.length > 0 && scores[0].score >= 10) {
      const best = scores[0];
      const agent = state.availableAgents.find(a => a.id === best.agentId)!;
      const reason = `Matched keywords: ${best.matchedKeywords.slice(0, 3).join(', ')}`;

      return {
        agentId: best.agentId,
        confidence: Math.min(best.score / 30, 1), // Normalize to 0-1
        reason,
      };
    }

    return null;
  };

  const handleSubmit = async (): Promise<void> => {
    if (!state.currentInput.trim()) return;

    const userMessage = state.currentInput.trim();

    // Handle commands FIRST (they don't need conversationId)
    if (userMessage.startsWith('/')) {
      const handled = await handleCommand(userMessage);
      if (handled) {
        setState(prev => ({ ...prev, currentInput: '', cursorPosition: 0 }));
        return;
      }
    }

    // Now check for conversationId and refs (needed for regular messages)
    if (!state.conversationId) return;
    if (!bridgeRef.current || !historyManagerRef.current || !bufferRef.current) return;
  if (!toolClientRef.current) return;

    // Handle agent creator
    if (state.showAgentCreator && state.creatorStep !== 'idle') {
      await handleAgentCreatorInput(userMessage);
      setState(prev => ({ ...prev, currentInput: '', cursorPosition: 0 }));
      return;
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
    // Save user message
    await historyManagerRef.current.saveMessage(state.conversationId, {
      role: 'user',
      content: userMessage,
    });

    // Auto-suggest agent if appropriate and enabled
    if (state.autoSuggestEnabled) {
      const suggestion = suggestAgent(userMessage);
      if (suggestion && suggestion.confidence > 0.5) {
        const suggestedAgent = state.availableAgents.find(a => a.id === suggestion.agentId);
        if (suggestedAgent) {
          const suggestionMsg = `💡 **Agent Suggestion:** ${suggestedAgent.avatar} **${suggestedAgent.name}** might be best suited for this task.\n` +
            `   Reason: ${suggestion.reason}\n` +
            `   Confidence: ${(suggestion.confidence * 100).toFixed(0)}%\n\n` +
            `   Use \`/agent ${suggestedAgent.id} ${userMessage}\` to execute with this agent specifically.\n`;

          await historyManagerRef.current.saveMessage(state.conversationId, {
            role: 'system',
            content: suggestionMsg,
          });

          setState(prev => ({
            ...prev,
            messages: [...prev.messages, { role: 'system', content: suggestionMsg } as Message],
            suggestedAgent: {
              id: suggestedAgent.id,
              name: suggestedAgent.name,
              confidence: suggestion.confidence,
            },
          }));
        }
      }
    }

    // Get conversation history
    const history = await historyManagerRef.current.getHistory(state.conversationId);
    
    let fullResponse = '';
    const buffer = bufferRef.current;
    let isFirstToken = true;

    const unsubscribe = buffer.onFlush((text: string) => {
      fullResponse += text;
      if (mountedRef.current) {
        setState(prev => ({ ...prev, streamingContent: fullResponse }));
      }
    });

    // REPLACED: Use tool-aware streaming
    for await (const event of toolClientRef.current.streamChatWithTools(
      history,
      // On tool call callback
      (toolCall) => {
        console.log('[Tool] Calling:', toolCall.name, toolCall.arguments);
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            agentMessages: [
              ...prev.agentMessages.slice(-30),
              {
                agentId: 'system',
                agentName: 'Tool System',
                type: 'action',
                content: `Calling tool: ${toolCall.name}`,
                timestamp: new Date(),
              }
            ],
          }));
        }
      },
      // On tool result callback
      (toolName, result) => {
        console.log('[Tool] Result from:', toolName, result);
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            agentMessages: [
              ...prev.agentMessages.slice(-30),
              {
                agentId: 'system',
                agentName: 'Tool System',
                type: 'result',
                content: `Tool ${toolName} completed`,
                timestamp: new Date(),
              }
            ],
          }));
        }
      }
    )) {
      if (!mountedRef.current) {
        unsubscribe();
        break;
      }

      if (event.type === 'token') {
        if (isFirstToken) {
          isFirstToken = false;
        }
        buffer.append(event.data);
      } else if (event.type === 'tool_call') {
        // Tool is being called - show in UI
        buffer.flush();
        fullResponse += `\n\n[🔧 Using tool: ${event.toolCall.name}]\n\n`;
        if (mountedRef.current) {
          setState(prev => ({ ...prev, streamingContent: fullResponse }));
        }
      } else if (event.type === 'tool_result') {
        // Tool completed - show brief result
        const resultPreview = JSON.stringify(event.result).slice(0, 100);
        fullResponse += `[✓ ${event.toolName}: ${resultPreview}...]\n\n`;
        if (mountedRef.current) {
          setState(prev => ({ ...prev, streamingContent: fullResponse }));
        }
      } else if (event.type === 'done') {
        buffer.flush();
        unsubscribe();
        
        // Save assistant response
        await historyManagerRef.current.saveMessage(state.conversationId, {
          role: 'assistant',
          content: fullResponse,
        });
        
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
        break;
      } else if (event.type === 'error') {
        unsubscribe();
        
        if (mountedRef.current) {
          setState(prev => ({ 
            ...prev,
            error: event.error.message, 
            isStreaming: false,
            status: 'error',
          }));
        }
        break;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (mountedRef.current) {
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isStreaming: false,
        status: 'error',
      }));
    }
  }
  };

  // Handle clipboard paste
  const handleClipboardPaste = async (): Promise<void> => {
    try {
      const clipboardHandler = getClipboardHandler();
      const contentType = await clipboardHandler.detectContentType();

      if (contentType === ClipboardContentType.IMAGE) {
        const result = await clipboardHandler.readImage();

        setState(prev => ({
          ...prev,
          pastedImage: result,
          clipboardContentType: contentType,
        }));

        if (result.success) {
          // Add a note to the input that an image was pasted
          const imageNote = `[Image pasted: ${result.width}×${result.height}px, ${(result.size! / 1024).toFixed(1)}KB]`;
          setState(prev => ({
            ...prev,
            currentInput: prev.currentInput ? `${prev.currentInput} ${imageNote}` : imageNote,
            cursorPosition: prev.currentInput.length + imageNote.length + 1,
          }));
        }
      } else if (contentType === ClipboardContentType.TEXT) {
        const text = await clipboardHandler.readText();
        if (text) {
          setState(prev => ({
            ...prev,
            currentInput: prev.currentInput + text,
            cursorPosition: prev.cursorPosition + text.length,
          }));
        }
      }
    } catch (error) {
      console.error('Error handling clipboard paste:', error);
    }
  };

  // Handle search result selection
  const handleSearchSelect = (result: SearchResult): void => {
    try {
      // Handle different result types
      switch (result.type) {
        case SearchResultType.FILE:
          if (result.filePath) {
            // Add file path to input
            const fileRef = result.lineNumber
              ? `${result.filePath}:${result.lineNumber}`
              : result.filePath;
            setState(prev => ({
              ...prev,
              currentInput: `@file ${fileRef} `,
              cursorPosition: `@file ${fileRef} `.length,
            }));
          }
          break;

        case SearchResultType.COMMAND:
          // Execute command based on metadata
          if (result.metadata?.shortcut) {
            // This would trigger the appropriate shortcut
            console.log(`Executing command: ${result.title}`);
          }
          break;

        case SearchResultType.AGENT:
          // Mention agent in input
          setState(prev => ({
            ...prev,
            currentInput: `@agent ${result.title} `,
            cursorPosition: `@agent ${result.title} `.length,
          }));
          break;

        case SearchResultType.CONVERSATION:
        case SearchResultType.KNOWLEDGE:
          // Add reference to input
          setState(prev => ({
            ...prev,
            currentInput: `${prev.currentInput}[${result.title}] `,
            cursorPosition: prev.currentInput.length + result.title.length + 3,
          }));
          break;
      }
    } catch (error) {
      console.error('Error handling search selection:', error);
    }
  };

  // Input handling
  useInput((input, key) => {
    if (!state.initialized) return;

    if (key.ctrl && (input === 'c' || input === 'd')) {
      exit();
      return;
    }

    // Toggle tool panel (Ctrl+U)
    if (key.ctrl && input === 'u') {
      setState(prev => ({
        ...prev,
        showToolPanel: !prev.showToolPanel,
      }));
      return;
    }

    // Toggle tool stats (Ctrl+Shift+U)
    if (key.ctrl && key.shift && input === 'U') {
      setState(prev => ({
        ...prev,
        showToolStats: !prev.showToolStats,
      }));
      return;
    }

    // Toggle detailed status (Ctrl+S)
    if (key.ctrl && input === 's') {
      setState(prev => ({
        ...prev,
        showDetailedStatus: !prev.showDetailedStatus,
      }));
      return;
    }

    // Toggle compact status bar (Ctrl+Shift+S)
    if (key.ctrl && key.shift && input === 'S') {
      setState(prev => ({
        ...prev,
        showCompactStatus: !prev.showCompactStatus,
      }));
      return;
    }

    // Toggle session switcher (Ctrl+E)
    if (key.ctrl && input === 'e') {
      setState(prev => ({
        ...prev,
        showSessionSwitcher: !prev.showSessionSwitcher,
      }));
      return;
    }

    // Toggle context inspector (Ctrl+I)
    if (key.ctrl && input === 'i') {
      setState(prev => ({
        ...prev,
        showContextInspector: !prev.showContextInspector,
      }));
      return;
    }

    // Toggle context details (Ctrl+Shift+I)
    if (key.ctrl && key.shift && input === 'I') {
      setState(prev => ({
        ...prev,
        showContextDetails: !prev.showContextDetails,
      }));
      return;
    }

    // Handle clipboard paste (Ctrl+V)
    if (key.ctrl && input === 'v') {
      handleClipboardPaste();
      return;
    }

    // Toggle search (Ctrl+F)
    if (key.ctrl && input === 'f') {
      setState(prev => ({
        ...prev,
        showSearch: !prev.showSearch,
      }));
      return;
    }

    // Toggle knowledge graph (Ctrl+G)
    if (key.ctrl && input === 'g') {
      setState(prev => ({
        ...prev,
        showKnowledgeGraph: !prev.showKnowledgeGraph,
      }));
      return;
    }

    // Toggle agent pipeline (Ctrl+P)
    if (key.ctrl && input === 'p') {
      setState(prev => ({
        ...prev,
        showAgentPipeline: !prev.showAgentPipeline,
      }));
      return;
    }

    // Toggle pipeline stats (Ctrl+Shift+P)
    if (key.ctrl && key.shift && input === 'P') {
      setState(prev => ({
        ...prev,
        showPipelineStats: !prev.showPipelineStats,
      }));
      return;
    }

    // Toggle error recovery (Ctrl+R)
    if (key.ctrl && input === 'r') {
      setState(prev => ({
        ...prev,
        showErrorRecovery: !prev.showErrorRecovery,
      }));
      return;
    }

    // Toggle agent communication (Ctrl+M)
    if (key.ctrl && input === 'm') {
      setState(prev => ({
        ...prev,
        showAgentCommunication: !prev.showAgentCommunication,
      }));
      return;
    }

    // Toggle communication mode (Ctrl+Shift+M)
    if (key.ctrl && key.shift && input === 'M') {
      setState(prev => ({
        ...prev,
        communicationMode: prev.communicationMode === 'messages' ? 'threads' : 'messages',
      }));
      return;
    }

    // Toggle template browser (Ctrl+T)
    if (key.ctrl && input === 't') {
      setState(prev => ({
        ...prev,
        showTemplateBrowser: !prev.showTemplateBrowser,
      }));
      return;
    }

    // Toggle rollback history (Ctrl+Z)
    if (key.ctrl && input === 'z') {
      setState(prev => ({
        ...prev,
        showRollbackHistory: !prev.showRollbackHistory,
      }));
      return;
    }

    // Toggle theme selector (Ctrl+Shift+T)
    if (key.ctrl && key.shift && input === 'T') {
      setState(prev => ({
        ...prev,
        showThemeSelector: !prev.showThemeSelector,
      }));
      return;
    }

    // Handle autocomplete suggestions
    if (state.showSuggestions && state.suggestions.length > 0) {
      if (key.upArrow) {
        setState(prev => ({
          ...prev,
          selectedSuggestion: Math.max(0, prev.selectedSuggestion - 1),
        }));
        return;
      }
      if (key.downArrow) {
        setState(prev => ({
          ...prev,
          selectedSuggestion: Math.min(prev.suggestions.length - 1, prev.selectedSuggestion + 1),
        }));
        return;
      }
      if (key.tab) {
        // Accept selected suggestion
        const selected = state.suggestions[state.selectedSuggestion];
        setState(prev => ({
          ...prev,
          currentInput: selected,
          cursorPosition: selected.length,
          showSuggestions: false,
          suggestions: [],
          selectedSuggestion: 0,
        }));
        return;
      }
      if (key.escape) {
        // Dismiss suggestions
        setState(prev => ({
          ...prev,
          showSuggestions: false,
          suggestions: [],
          selectedSuggestion: 0,
        }));
        return;
      }
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
    } else if (input && !key.ctrl && !key.meta) {
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
  {/* Welcome Banner */}
  <Box 
    marginBottom={1} 
    paddingX={2} 
    paddingY={1} 
    borderStyle="round" 
    borderColor="#CD853F"
  >
    <Text color="#CD853F">✱ </Text>
    <Text>Welcome to the </Text>
    <Text bold>Selek</Text>
    <Text> playground!</Text>
  </Box>

  {/* Tilde */}
  <Box marginBottom={1}>
    <Text color="cyan">~</Text>
  </Box>

  {/* ASCII Art Header */}
  <Box marginBottom={1}>
      <Text bold color="#00D9FF">
        {'     ███████╗███████╗██╗     ███████╗██╗  ██╗'}
      </Text>
    </Box>
    <Box marginBottom={1}>
      <Text bold color="#00D9FF">
        {'     ██╔════╝██╔════╝██║     ██╔════╝██║ ██╔╝'}
      </Text>
    </Box>
    <Box marginBottom={1}>
      <Text bold color="#00D9FF">
        {'     ███████╗█████╗  ██║     █████╗  █████╔╝ '}
      </Text>
    </Box>
    <Box marginBottom={1}>
      <Text bold color="#00D9FF">
        {'     ╚════██║██╔══╝  ██║     ██╔══╝  ██╔═██╗ '}
      </Text>
    </Box>
    <Box marginBottom={1}>
      <Text bold color="#00D9FF">
        {'     ███████║███████╗███████╗███████╗██║  ██╗'}
      </Text>
    </Box>
    <Box marginBottom={1}>
      <Text bold color="#00D9FF">
        {'     ╚══════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝'}
      </Text>
    </Box>

    <Box marginBottom={1} marginTop={1}>
      <Text color="#00D9FF">     🧠 Systematic Multi-Agent AI Platform v2.0</Text>
    </Box>

      {/* Error */}
      {state.error && (
        <Box marginBottom={1}>
          <Text color="red">❌ {state.error}</Text>
        </Box>
      )}

      {/* Permission Prompt */}
      {state.showPermissionPrompt && state.pendingPermissionRequest && state.permissionManager && (
        <PermissionPrompt
          request={state.pendingPermissionRequest}
          onDecision={(decision) => handlePermissionDecision(decision, setState, state.permissionResolver)}
          currentTrustLevel={state.permissionManager.getTrustLevel() || undefined}
        />
      )}

      {/* Tool Usage Panel */}
      {state.showToolPanel && (
        <ToolUsagePanel
          activeTools={state.activeToolCalls}
          recentTools={state.recentToolCalls}
          stats={state.toolStats}
          showStats={state.showToolStats}
          maxDisplay={5}
        />
      )}

      {/* Enhanced Status Line */}
      {state.showDetailedStatus && state.statusInfo && (
        <EnhancedStatusLine status={state.statusInfo} compact={false} />
      )}

      {/* Session Switcher */}
      {state.showSessionSwitcher && (
        <SessionSwitcher
          sessions={state.sessions}
          currentSessionId={state.currentSession?.id || null}
          onSwitch={(sessionId) => {
            const sessionManager = getSessionManager();
            sessionManager.switchSession(sessionId);
            setState(prev => ({ ...prev, showSessionSwitcher: false }));
          }}
          onNew={(name, template) => {
            const sessionManager = getSessionManager();
            sessionManager.createSession(name, {
              tags: template?.tags || [],
              description: template?.description,
            });
            setState(prev => ({ ...prev, showSessionSwitcher: false }));
          }}
          onDelete={(sessionId) => {
            const sessionManager = getSessionManager();
            sessionManager.deleteSession(sessionId);
          }}
          onClose={() => {
            setState(prev => ({ ...prev, showSessionSwitcher: false }));
          }}
        />
      )}

      {/* Context Inspector */}
      {state.showContextInspector && state.contextStats && (
        <ContextInspectorPanel
          stats={state.contextStats}
          items={state.contextItems}
          showDetails={state.showContextDetails}
        />
      )}

      {/* Context Suggestions */}
      {state.contextSuggestions.length > 0 && !state.showContextInspector && (
        <ContextSuggestions
          suggestions={state.contextSuggestions}
          onAccept={(suggestionId) => {
            const suggestion = state.contextSuggestions.find(s => s.id === suggestionId);
            if (suggestion && suggestion.type === 'remove') {
              const inspector = getContextInspector();
              inspector.removeItem(suggestion.item.id);
            }
          }}
          onDismiss={(suggestionId) => {
            setState(prev => ({
              ...prev,
              contextSuggestions: prev.contextSuggestions.filter(s => s.id !== suggestionId),
            }));
          }}
        />
      )}

      {/* Image Paste Indicator */}
      {state.pastedImage && (
        <ImagePasteIndicator
          result={state.pastedImage}
          onDismiss={() => {
            setState(prev => ({ ...prev, pastedImage: undefined }));
          }}
        />
      )}

      {/* Search Modal */}
      {state.showSearch && searchEngineRef.current && (
        <SearchModal
          searchEngine={searchEngineRef.current}
          onClose={() => {
            setState(prev => ({ ...prev, showSearch: false }));
          }}
          onSelect={handleSearchSelect}
        />
      )}

      {/* Knowledge Graph Panel */}
      {state.showKnowledgeGraph && graphVisualizerRef.current && (
        <KnowledgeGraphPanel
          visualizer={graphVisualizerRef.current}
          onClose={() => {
            setState(prev => ({ ...prev, showKnowledgeGraph: false }));
          }}
        />
      )}

      {/* Agent Pipeline Panel */}
      {state.showAgentPipeline && pipelineTrackerRef.current && (
        <AgentPipelinePanel
          tracker={pipelineTrackerRef.current}
          showStats={state.showPipelineStats}
          maxDisplay={5}
        />
      )}

      {/* Error Recovery Panel (Phase 2) */}
      {state.showErrorRecovery && errorRecoveryRef.current && (
        <ErrorRecoveryPanel
          errorSystem={errorRecoveryRef.current}
          maxDisplay={5}
        />
      )}

      {/* Agent Communication Panel (Phase 3) */}
      {state.showAgentCommunication && communicationLogRef.current && (
        <AgentCommunicationPanel
          communicationLog={communicationLogRef.current}
          mode={state.communicationMode}
          maxDisplay={5}
        />
      )}

      {/* Template Browser Panel (Phase 3) */}
      {state.showTemplateBrowser && templateManagerRef.current && (
        <TemplateBrowserPanel
          templateManager={templateManagerRef.current}
          onClose={() => {
            setState(prev => ({ ...prev, showTemplateBrowser: false }));
          }}
        />
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

      {/* Bottom Status Bar */}
      {state.initialized && (
        <Box marginTop={1} marginBottom={0}>
          <StatusBar
            status={state.status}
            error={state.error}
            agentCount={state.availableAgents.length}
            skillCount={skillCount}
            currentModel={state.currentModel}
            currentProvider={state.currentProvider}
            autoSuggestEnabled={state.autoSuggestEnabled}
          />
        </Box>
      )}

      {/* Input Area */}
      {state.initialized && !state.showAgentCreator && (
        <InputPrompt
          value={state.currentInput}
          cursorPosition={state.cursorPosition}
          isActive={!state.isStreaming}
        />
      )}

      {/* Autocomplete Suggestions */}
      {state.showSuggestions && state.suggestions.length > 0 && (
        <Box flexDirection="column" marginTop={0} borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text color="yellow" bold>💡 Suggestions (Tab to accept, ↑↓ to navigate, Esc to dismiss):</Text>
          {state.suggestions.map((suggestion, idx) => (
            <Box key={idx} paddingLeft={1}>
              <Text color={idx === state.selectedSuggestion ? 'cyan' : 'gray'}>
                {idx === state.selectedSuggestion ? '▶ ' : '  '}
                {suggestion}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Loading indicator */}
      {state.status === 'initializing' && (
        <Box marginTop={1}>
          <Spinner label="Initializing system..." />
        </Box>
      )}

      {/* Compact Status Bar */}
      {state.showCompactStatus && (
        <Box marginTop={1}>
          <CompactStatusBar status={state.statusInfo} />
        </Box>
      )}

      {/* Help */}
      <Box marginTop={1}>
        <Text color="white">
          {state.initialized
            ? 'Type your message or /help for commands • Enter to send • Ctrl+C to exit'
            : 'Please wait while the system initializes...'}
        </Text>
      </Box>
    </Box>
  );
};

render(<ConversationalTUI />);