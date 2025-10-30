#!/usr/bin/env node
import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { MultiAgentOrchestrator, TaskRequest } from '../lib/orchestrator/multi-agent-orchestrator';
import { ConversationStore } from '../lib/persistence/conversation-store';
import * as dotenv from 'dotenv';
import { Agent } from 'http';

dotenv.config();

interface MenuItem {
  label: string;
  value: string;
}

interface AppState {
  currentMenu: 'main' | 'agents' | 'conversations' | 'executing';
  orchestrator: MultiAgentOrchestrator | null;
  conversationStore: ConversationStore | null;
  message: string;
  error: string;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentMenu: 'main',
    orchestrator: null,
    conversationStore: null,
    message: '',
    error: '',
  });

  const mainMenuItems: MenuItem[] = [
    { label: '🚀 Initialize System', value: 'init' },
    { label: '🤖 Spawn Agents', value: 'spawn' },
    { label: '📋 List Agents', value: 'list-agents' },
    { label: '💬 Conversations', value: 'conversations' },
    { label: '📊 Statistics', value: 'stats' },
    { label: '🏥 Health Check', value: 'health' },
    { label: '❌ Exit', value: 'exit' },
  ];

  const agentTypeItems: MenuItem[] = [
    { label: '📝 Implementation', value: 'implementation' },
    { label: '🔒 Security', value: 'security' },
    { label: '⚡ Performance', value: 'performance' },
    { label: '🔙 Back', value: 'back' },
  ];

  const conversationMenuItems: MenuItem[] = [
    { label: '📄 List Conversations', value: 'list' },
    { label: '🔍 Search Conversations', value: 'search' },
    { label: '➕ Create Conversation', value: 'create' },
    { label: '🔙 Back', value: 'back' },
  ];

  const handleMainMenuSelect = async (item: MenuItem) => {
    setState(prev => ({ ...prev, message: '', error: '' }));

    switch (item.value) {
      case 'init':
        await initializeSystem();
        break;
      case 'spawn':
        setState(prev => ({ ...prev, currentMenu: 'agents' }));
        break;
      case 'list-agents':
        await listAgents();
        break;
      case 'conversations':
        setState(prev => ({ ...prev, currentMenu: 'conversations' }));
        break;
      case 'stats':
        await showStats();
        break;
      case 'health':
        await checkHealth();
        break;
      case 'exit':
        process.exit(0);
    }
  };

  const handleAgentSelect = async (item: MenuItem) => {
    if (item.value === 'back') {
      setState(prev => ({ ...prev, currentMenu: 'main' }));
      return;
    }

    // For demo purposes, use predefined task
    // In production, you'd prompt for task details
    const task = `Implement a sample feature in ${item.value} domain`;
    const domain = item.value === 'implementation' ? 'TypeScript Development' :
                   item.value === 'security' ? 'Application Security' :
                   'Performance Optimization';

    await spawnAgent(task, domain, item.value);
  };

  const handleConversationSelect = async (item: MenuItem) => {
    if (item.value === 'back') {
      setState(prev => ({ ...prev, currentMenu: 'main' }));
      return;
    }

    switch (item.value) {
      case 'list':
        await listConversations();
        break;
      case 'search':
        setState(prev => ({ 
          ...prev, 
          message: 'Search not implemented in TUI. Use CLI: npm run cli search' 
        }));
        break;
      case 'create':
        await createConversation();
        break;
    }
  };

  const initializeSystem = async () => {
    setState(prev => ({ ...prev, message: '⏳ Initializing system...' }));

    try {
      const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
      const model = process.env.OLLAMA_MODEL || 'llama3.1:latest';

      const orchestrator = new MultiAgentOrchestrator(endpoint, model);
      await orchestrator.initialize();

      const conversationStore = new ConversationStore();
      await conversationStore.initialize();

      setState(prev => ({
        ...prev,
        orchestrator,
        conversationStore,
        message: '✅ System initialized successfully!',
        error: '',
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: `❌ Initialization failed: ${error.message}`,
        message: '',
      }));
    }
  };

  const spawnAgent = async (task: string, domain: string, agentType: string) => {
    if (!state.orchestrator) {
      setState(prev => ({ ...prev, error: '❌ Please initialize system first' }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      currentMenu: 'executing',
      message: `⏳ Spawning ${agentType} agent...` 
    }));

    try {
      const taskRequest: TaskRequest = {
        description: task,
        domain,
        requiredAgents: [agentType],
        autoExecute: false,
        parallel: false,
      };

      const result = await state.orchestrator.executeTask(taskRequest);

      setState(prev => ({
        ...prev,
        currentMenu: 'main',
        message: `✅ Agent completed! Plan: ${Object.values(result.plans)[0]}`,
        error: '',
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        currentMenu: 'main',
        error: `❌ Agent failed: ${error.message}`,
        message: '',
      }));
    }
  };

  const listAgents = async () => {
    if (!state.orchestrator) {
      setState(prev => ({ ...prev, error: '❌ Please initialize system first' }));
      return;
    }

    try {
      const agents = state.orchestrator.getAgentRegistry();

      if (agents.length === 0) {
        setState(prev => ({ ...prev, message: '📋 No agents found' }));
        return;
      }

      const agentList = agents
        .map((a: any) => `  • ${a.agentId} [${a.status}] - ${a.task}`)
        .join('\n');

      setState(prev => ({ 
        ...prev, 
        message: `📋 Found ${agents.length} agent(s):\n${agentList}` 
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: `❌ Error: ${error.message}` }));
    }
  };

  const listConversations = async () => {
    if (!state.conversationStore) {
      setState(prev => ({ ...prev, error: '❌ Please initialize system first' }));
      return;
    }

    try {
      const conversations = await state.conversationStore.listConversations();

      if (conversations.length === 0) {
        setState(prev => ({ ...prev, message: '💬 No conversations found' }));
        return;
      }

      const convList = conversations
        .map((c: any) => `  • ${c.id} - ${c.agentName} (${c.turnCount} turns)`)
        .join('\n');

      setState(prev => ({ 
        ...prev, 
        message: `💬 Found ${conversations.length} conversation(s):\n${convList}` 
      }));
      
      setState(prev => ({ ...prev, currentMenu: 'main' }));
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        error: `❌ Error: ${error.message}`,
        currentMenu: 'main'
      }));
    }
  };

  const createConversation = async () => {
    if (!state.conversationStore) {
      setState(prev => ({ ...prev, error: '❌ Please initialize system first' }));
      return;
    }

    try {
      const conversationId = await state.conversationStore.createConversation(
        'tui-agent',
        'admin',
        ['tui']
      );

      setState(prev => ({ 
        ...prev, 
        message: `✅ Conversation created: ${conversationId}`,
        currentMenu: 'main'
      }));
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        error: `❌ Error: ${error.message}`,
        currentMenu: 'main'
      }));
    }
  };

  const showStats = async () => {
    if (!state.orchestrator || !state.conversationStore) {
      setState(prev => ({ ...prev, error: '❌ Please initialize system first' }));
      return;
    }

    try {
      const convStats = await state.conversationStore.getStatistics();
      const agentStats = {
        total: state.orchestrator.getAgentRegistry().length,
        completed: state.orchestrator.getAgentsByStatus('completed').length,
        failed: state.orchestrator.getAgentsByStatus('failed').length,
      };

      const statsText = `
📊 System Statistics:

Agents:
  • Total: ${agentStats.total}
  • Completed: ${agentStats.completed}
  • Failed: ${agentStats.failed}

Conversations:
  • Total: ${convStats.totalConversations}
  • Total Turns: ${convStats.totalTurns}
  • Total Messages: ${convStats.totalMessages}
      `;

      setState(prev => ({ ...prev, message: statsText }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: `❌ Error: ${error.message}` }));
    }
  };

  const checkHealth = async () => {
    if (!state.orchestrator) {
      setState(prev => ({ ...prev, error: '❌ Please initialize system first' }));
      return;
    }

    try {
      const llm = state.orchestrator.getLLMClient();
      const health = await llm.healthCheck();

      if (health.healthy) {
        setState(prev => ({ 
          ...prev, 
          message: '🏥 System is healthy ✅' 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          error: `🏥 System is unhealthy: ${health.error}` 
        }));
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, error: `❌ Error: ${error.message}` }));
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🤖 CC_Clone Multi-Agent System - TUI
        </Text>
      </Box>

      {state.error?.length ? (
        <Box marginBottom={1}>
          <Text color="red">{state.error}</Text>
        </Box>
      ) : null}

      {state.message?.length ? (
        <Box marginBottom={1}>
          <Text color="green">{state.message}</Text>
        </Box>
      ) : null}

      {state.currentMenu === 'main' && (
        <SelectInput items={mainMenuItems} onSelect={handleMainMenuSelect} />
      )}

      {state.currentMenu === 'agents' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Select agent type:</Text>
          </Box>
          <SelectInput items={agentTypeItems} onSelect={handleAgentSelect} />
        </Box>
      )}

      {state.currentMenu === 'conversations' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Conversation menu:</Text>
          </Box>
          <SelectInput items={conversationMenuItems} onSelect={handleConversationSelect} />
        </Box>
      )}

      {state.currentMenu === 'executing' && (
        <Box>
          <Text>⏳ Executing... Please wait...</Text>
        </Box>
      )}
    </Box>
  );
};

render(<App />);