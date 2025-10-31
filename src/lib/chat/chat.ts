#!/usr/bin/env node
import readline from 'readline';
import { Agent, AgentMeta } from '../../lib/agent';
import { OllamaClient } from '../../lib/llm/ollama-client';
import { registerTools } from '../../lib/tools';
import { registerGitTools } from '../../lib/tools/git-tools';
import { registerHTTPTools } from '../../lib/tools/http-tools';
import { MCPServerConfig } from '../../mcp/mcp-client';
import { enhanceSystemMessageWithProjectContext } from '../../lib/context/ProjectContextLoader';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

/**
 * Load MCP configuration
 */
async function loadMCPConfig(): Promise<MCPServerConfig[]> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'mcp-servers.json');
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    return config.servers || [];
  } catch (error) {
    return [];
  }
}

/**
 * Display ASCII art welcome
 */
function displayWelcome() {
  console.log('\n');
  console.log(chalk.hex('#CD853F')('  ██████╗ ██████╗     ██████╗██╗      ██████╗ ███╗   ██╗███████╗'));
  console.log(chalk.hex('#CD853F')('██╔════╝██╔════╝    ██╔════╝██║     ██╔═══██╗████╗  ██║██╔════╝'));
  console.log(chalk.hex('#CD853F')('██║     ██║         ██║     ██║     ██║   ██║██╔██╗ ██║█████╗  '));
  console.log(chalk.hex('#CD853F')('██║     ██║         ██║     ██║     ██║   ██║██║╚██╗██║██╔══╝  '));
  console.log(chalk.hex('#CD853F')('╚██████╗╚██████╗    ╚██████╗███████╗╚██████╔╝██║ ╚████║███████╗'));
  console.log(chalk.hex('#CD853F')(' ╚═════╝ ╚═════╝     ╚═════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝'));
  console.log(chalk.hex('#CD853F')('\n        🤖 Interactive Chat Mode v1.0\n'));
}

/**
 * Display tool information
 */
function displayToolInfo(agent: Agent) {
  const toolInfo = agent.getToolInfo();
  
  console.log(chalk.cyan('\n📦 Available Tools:'));
  console.log(chalk.gray(`  Local: ${toolInfo.local.length} tool(s)`));
  toolInfo.local.forEach(tool => console.log(chalk.gray(`    • ${tool}`)));
  
  if (toolInfo.mcp.length > 0) {
    console.log(chalk.gray(`\n  MCP: ${toolInfo.mcp.length} tool(s) from external servers`));
    
    const byServer: Record<string, string[]> = {};
    toolInfo.mcp.forEach(({ name, server }) => {
      if (!byServer[server]) byServer[server] = [];
      byServer[server].push(name.replace(`${server}__`, ''));
    });
    
    for (const [server, tools] of Object.entries(byServer)) {
      console.log(chalk.gray(`    ${server}: ${tools.length} tool(s)`));
    }
  }
  
  console.log(chalk.gray(`\n  Total: ${toolInfo.total} tool(s) available`));
}

/**
 * Main chat loop
 */
async function main() {
  displayWelcome();

  // Load configuration
  const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:32b';
  
  console.log(chalk.gray(`📡 Endpoint: ${endpoint}`));
  console.log(chalk.gray(`🤖 Model: ${model}`));

  // Initialize LLM client
  const llm = new OllamaClient({
    baseUrl: endpoint,
    model: model,
  });

  // Check health
  console.log(chalk.yellow('\n⏳ Checking LLM health...'));
  const health = await llm.healthCheck();
  if (!health.healthy) {
    console.log(chalk.red('❌ LLM is not available. Please start Ollama.'));
    process.exit(1);
  }
  console.log(chalk.green('✓ LLM is healthy'));

  // Load MCP servers
  const mcpServers = await loadMCPConfig();
  if (mcpServers.length > 0) {
    console.log(chalk.cyan(`\n📋 Loading ${mcpServers.length} MCP server(s)...`));
  }

  // Build system prompt with project context
  const baseSystemPrompt = `You are CC_Clone, a helpful AI coding assistant with access to powerful tools.

You can:
- Read and write files
- Search codebases (file names and content)
- Execute bash commands (with security restrictions)
- Use git operations (status, diff, commit, branch, etc.)
- Make HTTP requests (GET, POST, PUT, DELETE)
- Use any connected MCP tools

When asked to perform tasks:
1. Break down complex tasks into steps
2. Use the appropriate tools efficiently
3. Explain what you're doing as you work
4. Show results clearly and concisely
5. Ask for clarification if needed

Be helpful, clear, and thorough. Always consider the project context when making decisions.`;

  console.log(chalk.yellow('\n⏳ Loading project context...'));
  const enhancedSystemPrompt = await enhanceSystemMessageWithProjectContext(
    baseSystemPrompt,
    process.cwd()
  );

  // Create agent
  const agentMeta: AgentMeta = {
    name: 'CC_Clone_Chat',
    role: 'implementation',
    systemPrompt: enhancedSystemPrompt,
  };

  const agent = new Agent(agentMeta, llm, 15, mcpServers);

  // Register local tools
  registerTools(agent);
  registerGitTools(agent);
  registerHTTPTools(agent);

  console.log(chalk.green('✓ Agent initialized'));

  // Display available tools
  displayToolInfo(agent);

  // Setup readline
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('\n💬 You: '),
  });

  console.log(chalk.gray('\n' + '─'.repeat(60)));
  console.log(chalk.bold('\n📝 Commands:'));
  console.log(chalk.gray('  /tools    - Show available tools'));
  console.log(chalk.gray('  /history  - Show conversation history'));
  console.log(chalk.gray('  /clear    - Clear conversation history'));
  console.log(chalk.gray('  /stats    - Show context statistics'));
  console.log(chalk.gray('  /mcp      - Show MCP server info'));
  console.log(chalk.gray('  /help     - Show this help message'));
  console.log(chalk.gray('  /exit     - Exit chat'));
  console.log(chalk.gray('\n' + '─'.repeat(60)));

  rl.prompt();

  rl.on('line', async (input: string) => {
    const trimmed = input.trim();

    // Handle commands
    if (trimmed === '/exit') {
      console.log(chalk.yellow('\n👋 Shutting down...'));
      await agent.shutdown();
      rl.close();
      process.exit(0);
    }

    if (trimmed === '/help') {
      console.log(chalk.bold('\n📝 Available Commands:'));
      console.log(chalk.gray('  /tools    - Show available tools'));
      console.log(chalk.gray('  /history  - Show conversation history'));
      console.log(chalk.gray('  /clear    - Clear conversation history'));
      console.log(chalk.gray('  /stats    - Show context statistics'));
      console.log(chalk.gray('  /mcp      - Show MCP server info'));
      console.log(chalk.gray('  /exit     - Exit chat'));
      rl.prompt();
      return;
    }

    if (trimmed === '/tools') {
      displayToolInfo(agent);
      rl.prompt();
      return;
    }

    if (trimmed === '/history') {
      const history = agent.getHistory();
      console.log(chalk.cyan(`\n📜 Conversation History: ${history.length} turn(s)\n`));
      
      history.forEach((turn, i) => {
        const timestamp = turn.timestamp.toLocaleString();
        console.log(chalk.bold(`Turn ${i + 1}`) + chalk.gray(` (${timestamp})`));
        console.log(chalk.gray(`  Messages: ${turn.messages.length}`));
        
        if (turn.toolCalls.length > 0) {
          console.log(chalk.yellow(`  Tools used: ${turn.toolCalls.map(tc => tc.name).join(', ')}`));
        }
        
        console.log();
      });
      
      rl.prompt();
      return;
    }

    if (trimmed === '/clear') {
      agent.clearHistory();
      console.log(chalk.green('\n✓ Conversation history cleared'));
      rl.prompt();
      return;
    }

    if (trimmed === '/stats') {
      const stats = agent.getContextStats();
      console.log(chalk.cyan('\n📊 Context Statistics:'));
      console.log(chalk.gray(`  Total turns: ${stats.totalTurns}`));
      console.log(chalk.gray(`  Tool calls: ${stats.toolCallsCount}`));
      console.log(chalk.gray(`  Has summary: ${stats.hasSummary ? '✓ Yes' : '✗ No'}`));
      
      if (stats.hasSummary) {
        console.log(chalk.yellow('\n  ℹ️  Old context has been summarized to save memory'));
      }
      
      rl.prompt();
      return;
    }

    if (trimmed === '/mcp') {
      const servers = agent.getConnectedMCPServers();
      console.log(chalk.cyan('\n🔌 MCP Server Status:'));
      
      if (servers.length === 0) {
        console.log(chalk.gray('  No MCP servers connected'));
      } else {
        servers.forEach(server => {
          console.log(chalk.green(`  ✓ ${server}`));
        });
        
        const toolInfo = agent.getToolInfo();
        console.log(chalk.gray(`\n  Total MCP tools: ${toolInfo.mcp.length}`));
      }
      
      rl.prompt();
      return;
    }

    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Process user message
    try {
      console.log(chalk.yellow('\n⏳ Processing...\n'));
      
      const startTime = Date.now();
      const response = await agent.run(trimmed);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(chalk.bold('\n🤖 Assistant:'));
      console.log(response);
      
      // Show stats for long conversations
      const stats = agent.getContextStats();
      if (stats.totalTurns > 0) {
        console.log(chalk.gray(`\n⏱️  Response time: ${duration}s | Turns: ${stats.totalTurns} | Tools: ${stats.toolCallsCount}`));
      }
      
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      
      if (error.name === 'MaxIterationsExceededError') {
        console.log(chalk.yellow('\n💡 Tip: Try breaking your request into smaller, more specific tasks.'));
      } else if (error.name === 'ToolNotFoundError') {
        console.log(chalk.yellow('\n💡 Tip: Use /tools to see available tools.'));
      }
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    console.log(chalk.yellow('\n\n👋 Goodbye!'));
    await agent.shutdown();
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n👋 Received interrupt signal. Shutting down...'));
    await agent.shutdown();
    process.exit(0);
  });
}

// Error handling
process.on('unhandledRejection', async (error: any) => {
  console.error(chalk.red('\n❌ Unhandled error:'), error.message);
  process.exit(1);
});

// Start
main().catch(console.error);