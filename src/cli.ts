#!/usr/bin/env node
import { Command } from 'commander';
import { MultiAgentOrchestrator, TaskRequest } from './lib/orchestrator/multi-agent-orchestrator';
import chalk from 'chalk';
import ora from 'ora';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { getLLMConfigManager } from './lib/config/LLMConfig';
import inquirer from 'inquirer';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('selek')
  .description('Selek - Systematic Multi-Agent AI Platform')
  .version('2.0.0');

/**
 * Initialize orchestrator command
 */
program
  .command('init')
  .description('Initialize the multi-agent system')
  .option('-e, --endpoint <url>', 'Ollama endpoint URL', process.env.OLLAMA_ENDPOINT || 'http://localhost:11434')
  .option('-m, --model <name>', 'Ollama model name', process.env.OLLAMA_MODEL || 'llama3.1:latest')
  .action(async (options) => {
    const spinner = ora('Initializing orchestrator...').start();

    try {
      const orchestrator = new MultiAgentOrchestrator(
        options.endpoint,
        options.model
      );

      await orchestrator.initialize();
      
      spinner.succeed('Orchestrator initialized successfully');
      console.log(chalk.green('\n✓ System ready to use'));
      console.log(chalk.gray(`  Endpoint: ${options.endpoint}`));
      console.log(chalk.gray(`  Model: ${options.model}`));
    } catch (error: any) {
      spinner.fail('Initialization failed');
      console.error(chalk.red('\n✗ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Spawn specialized agents command
 */
program
  .command('spawn')
  .description('Spawn specialized agents to create implementation plans')
  .requiredOption('-t, --task <description>', 'Task description')
  .requiredOption('-d, --domain <domain>', 'Domain expertise (e.g., "Python Backend Development")')
  .requiredOption('-a, --agents <types>', 'Comma-separated agent types (implementation,security,performance)')
  .option('-e, --endpoint <url>', 'Ollama endpoint URL', process.env.OLLAMA_ENDPOINT || 'http://localhost:11434')
  .option('-m, --model <name>', 'Ollama model name', process.env.OLLAMA_MODEL || 'llama3.1:latest')
  .option('--auto-execute', 'Automatically execute the implementation plan', false)
  .action(async (options) => {
    const spinner = ora('Initializing orchestrator...').start();

    try {
      const orchestrator = new MultiAgentOrchestrator(
        options.endpoint,
        options.model
      );

      await orchestrator.initialize();
      spinner.succeed('Orchestrator initialized');

      const agentTypes = options.agents.split(',').map((a: string) => a.trim());

      const taskRequest: TaskRequest = {
        description: options.task,
        domain: options.domain,
        requiredAgents: agentTypes,
        autoExecute: options.autoExecute,
      };

      console.log(chalk.cyan('\n🚀 Starting multi-agent execution'));
      console.log(chalk.gray(`   Task: ${taskRequest.description}`));
      console.log(chalk.gray(`   Domain: ${taskRequest.domain}`));
      console.log(chalk.gray(`   Agents: ${agentTypes.join(', ')}`));

      const result = await orchestrator.executeTask(taskRequest);

      console.log(chalk.green('\n✓ Task completed successfully\n'));
      console.log(chalk.bold('Generated Plans:'));
      for (const [agentType, planFile] of Object.entries(result.plans)) {
        console.log(chalk.gray(`  • ${agentType}: ${planFile}`));
      }

      if (result.execution) {
        console.log(chalk.bold('\nExecution Results:'));
        console.log(chalk.gray(`  Status: ${result.execution.success ? '✅ Success' : '❌ Failed'}`));
        console.log(chalk.gray(`  Steps: ${result.execution.completedSteps.length} completed`));
        console.log(chalk.gray(`  Time: ${result.execution.executionTime.toFixed(2)}s`));
      }

      // Save summary
      const summaryPath = path.join('plans', 'summary.md');
      await fs.writeFile(summaryPath, result.summary, 'utf-8');
      console.log(chalk.gray(`\nSummary saved to: ${summaryPath}`));

    } catch (error: any) {
      spinner.fail('Task execution failed');
      console.error(chalk.red('\n✗ Error:'), error.message);
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

/**
 * Execute a plan command
 */
program
  .command('execute')
  .description('Execute an implementation plan')
  .argument('<planFile>', 'Path to the plan file')
  .option('-e, --endpoint <url>', 'Ollama endpoint URL', process.env.OLLAMA_ENDPOINT || 'http://localhost:11434')
  .option('-m, --model <name>', 'Ollama model name', process.env.OLLAMA_MODEL || 'llama3.1:latest')
  .option('--dry-run', 'Perform a dry run without making changes', false)
  .action(async (planFile, options) => {
    const spinner = ora('Initializing executor...').start();

    try {
      const orchestrator = new MultiAgentOrchestrator(
        options.endpoint,
        options.model
      );

      await orchestrator.initialize();
      spinner.succeed('Executor initialized');

      if (options.dryRun) {
        console.log(chalk.yellow('\n⚠️  DRY RUN MODE - No changes will be made\n'));
      }

      spinner.start('Executing plan...');
      const result = await orchestrator.executePlan(planFile, options.dryRun);
      spinner.stop();

      if (result.success) {
        console.log(chalk.green('\n✓ Plan executed successfully'));
        console.log(chalk.gray(`  Steps completed: ${result.completedSteps.length}`));
        console.log(chalk.gray(`  Checkpoints reached: ${result.checkpointsReached.length}`));
        console.log(chalk.gray(`  Execution time: ${result.executionTime.toFixed(2)}s`));
      } else {
        console.log(chalk.red('\n✗ Plan execution failed'));
        console.log(chalk.gray(`  Steps completed: ${result.completedSteps.length}`));
        console.log(chalk.gray(`  Failed at: ${result.failedStep}`));
        console.log(chalk.red(`  Error: ${result.error?.message}`));
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail('Execution failed');
      console.error(chalk.red('\n✗ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * List agents command
 */
program
  .command('list')
  .description('List all agent executions')
  .option('-s, --status <status>', 'Filter by status (active/completed/failed)')
  .option('-e, --endpoint <url>', 'Ollama endpoint URL', process.env.OLLAMA_ENDPOINT || 'http://localhost:11434')
  .option('-m, --model <name>', 'Ollama model name', process.env.OLLAMA_MODEL || 'llama3.1:latest')
  .action(async (options) => {
    try {
      const orchestrator = new MultiAgentOrchestrator(
        options.endpoint,
        options.model
      );

      await orchestrator.initialize();

      const agents = options.status
        ? orchestrator.getAgentsByStatus(options.status)
        : orchestrator.getAgentRegistry();

      if (agents.length === 0) {
        console.log(chalk.yellow('\nNo agents found'));
        return;
      }

      console.log(chalk.cyan(`\n📋 Found ${agents.length} agent(s):\n`));

      for (const agent of agents) {
        const statusColor = 
          agent.status === 'completed' ? chalk.green :
          agent.status === 'failed' ? chalk.red :
          chalk.yellow;

        console.log(chalk.bold(`  • ${agent.agentId}`) + statusColor(` [${agent.status}]`));
        console.log(chalk.gray(`    Type: ${agent.agentType}`));
        console.log(chalk.gray(`    Domain: ${agent.domain}`));
        console.log(chalk.gray(`    Task: ${agent.task}`));
        console.log(chalk.gray(`    Plan: ${agent.planFile}`));
        console.log(chalk.gray(`    Date: ${new Date(agent.timestamp).toLocaleString()}`));
        console.log();
      }
    } catch (error: any) {
      console.error(chalk.red('\n✗ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Search tasks command
 */
program
  .command('search')
  .description('Search for agents by task keywords')
  .argument('<keywords>', 'Keywords to search for in task descriptions')
  .option('-e, --endpoint <url>', 'Ollama endpoint URL', process.env.OLLAMA_ENDPOINT || 'http://localhost:11434')
  .option('-m, --model <name>', 'Ollama model name', process.env.OLLAMA_MODEL || 'llama3.1:latest')
  .action(async (keywords, options) => {
    try {
      const orchestrator = new MultiAgentOrchestrator(
        options.endpoint,
        options.model
      );

      await orchestrator.initialize();

      const agents = orchestrator.getAgentsForTask(keywords);

      if (agents.length === 0) {
        console.log(chalk.yellow(`\nNo agents found matching: ${keywords}`));
        return;
      }

      console.log(chalk.cyan(`\n🔍 Found ${agents.length} agent(s) matching "${keywords}":\n`));

      for (const agent of agents) {
        console.log(chalk.bold(`  • ${agent.agentId}`) + chalk.gray(` [${agent.status}]`));
        console.log(chalk.gray(`    Task: ${agent.task}`));
        console.log(chalk.gray(`    Plan: ${agent.planFile}`));
        console.log();
      }
    } catch (error: any) {
      console.error(chalk.red('\n✗ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Health check command
 */
program
  .command('health')
  .description('Check system health')
  .option('-e, --endpoint <url>', 'Ollama endpoint URL', process.env.OLLAMA_ENDPOINT || 'http://localhost:11434')
  .option('-m, --model <name>', 'Ollama model name', process.env.OLLAMA_MODEL || 'llama3.1:latest')
  .action(async (options) => {
    const spinner = ora('Checking system health...').start();

    try {
      const orchestrator = new MultiAgentOrchestrator(
        options.endpoint,
        options.model
      );

      const llm = orchestrator.getLLMClient();
      const health = await llm.healthCheck();

      if (health.healthy) {
        spinner.succeed('System is healthy');
        console.log(chalk.green('\n✓ All systems operational'));
        console.log(chalk.gray(`  Endpoint: ${options.endpoint}`));
        console.log(chalk.gray(`  Model: ${options.model}`));
      } else {
        spinner.fail('System is unhealthy');
        console.log(chalk.red('\n✗ Health check failed'));
        console.log(chalk.red(`  Error: ${health.error}`));
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail('Health check failed');
      console.error(chalk.red('\n✗ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * LLM Configuration Commands
 */
const configCmd = program
  .command('config')
  .description('Manage LLM provider configuration');

// Set API key
configCmd
  .command('set-key')
  .description('Set API key for a cloud provider')
  .requiredOption('-p, --provider <name>', 'Provider name (anthropic, openai)')
  .option('-k, --key <apikey>', 'API key (will prompt if not provided)')
  .action(async (options) => {
    try {
      const configManager = getLLMConfigManager();
      await configManager.load();

      let apiKey = options.key;
      if (!apiKey) {
        const answer = await inquirer.prompt([
          {
            type: 'password',
            name: 'apiKey',
            message: `Enter API key for ${options.provider}:`,
            mask: '*',
          },
        ]);
        apiKey = answer.apiKey;
      }

      await configManager.setApiKey(options.provider, apiKey);
      console.log(chalk.green(`✓ API key set for ${options.provider}`));
    } catch (error: any) {
      console.error(chalk.red('✗ Error:'), error.message);
      process.exit(1);
    }
  });

// Enable provider
configCmd
  .command('enable')
  .description('Enable an LLM provider')
  .requiredOption('-p, --provider <name>', 'Provider name (anthropic, openai, ollama)')
  .action(async (options) => {
    try {
      const configManager = getLLMConfigManager();
      await configManager.load();
      await configManager.enableProvider(options.provider);
      console.log(chalk.green(`✓ ${options.provider} enabled`));
    } catch (error: any) {
      console.error(chalk.red('✗ Error:'), error.message);
      process.exit(1);
    }
  });

// Disable provider
configCmd
  .command('disable')
  .description('Disable an LLM provider')
  .requiredOption('-p, --provider <name>', 'Provider name (anthropic, openai, ollama)')
  .action(async (options) => {
    try {
      const configManager = getLLMConfigManager();
      await configManager.load();
      await configManager.disableProvider(options.provider);
      console.log(chalk.green(`✓ ${options.provider} disabled`));
    } catch (error: any) {
      console.error(chalk.red('✗ Error:'), error.message);
      process.exit(1);
    }
  });

// Set default provider
configCmd
  .command('set-default')
  .description('Set the default LLM provider')
  .requiredOption('-p, --provider <name>', 'Provider name (anthropic, openai, ollama)')
  .action(async (options) => {
    try {
      const configManager = getLLMConfigManager();
      await configManager.load();
      await configManager.setDefaultProvider(options.provider);
      console.log(chalk.green(`✓ Default provider set to ${options.provider}`));
    } catch (error: any) {
      console.error(chalk.red('✗ Error:'), error.message);
      process.exit(1);
    }
  });

// Set default model
configCmd
  .command('set-model')
  .description('Set the default model for a provider')
  .requiredOption('-p, --provider <name>', 'Provider name (anthropic, openai, ollama)')
  .requiredOption('-m, --model <name>', 'Model name')
  .action(async (options) => {
    try {
      const configManager = getLLMConfigManager();
      await configManager.load();
      await configManager.setDefaultModel(options.provider, options.model);
      console.log(chalk.green(`✓ Default model for ${options.provider} set to ${options.model}`));
    } catch (error: any) {
      console.error(chalk.red('✗ Error:'), error.message);
      process.exit(1);
    }
  });

// List providers
configCmd
  .command('list')
  .description('List all configured LLM providers')
  .action(async () => {
    try {
      const configManager = getLLMConfigManager();
      await configManager.load();

      const config = configManager.getConfig();
      const providers = configManager.getProviders();

      console.log(chalk.bold('\nConfigured LLM Providers:\n'));
      console.log(chalk.gray(`Default Provider: ${chalk.cyan(config.defaultProvider)}\n`));

      for (const provider of providers) {
        const status = provider.enabled ? chalk.green('✓ Enabled') : chalk.gray('✗ Disabled');
        const hasKey = provider.hasApiKey ? chalk.green('✓') : chalk.red('✗');

        console.log(chalk.bold(`${provider.name}:`));
        console.log(`  Status: ${status}`);
        console.log(`  API Key: ${hasKey}`);

        const providerConfig = config.providers[provider.name as keyof typeof config.providers];
        if (providerConfig?.defaultModel) {
          console.log(`  Default Model: ${chalk.cyan(providerConfig.defaultModel)}`);
        }
        console.log();
      }
    } catch (error: any) {
      console.error(chalk.red('✗ Error:'), error.message);
      process.exit(1);
    }
  });

// Validate provider
configCmd
  .command('validate')
  .description('Validate provider configuration')
  .requiredOption('-p, --provider <name>', 'Provider name (anthropic, openai, ollama)')
  .action(async (options) => {
    const spinner = ora(`Validating ${options.provider} configuration...`).start();

    try {
      const configManager = getLLMConfigManager();
      await configManager.load();

      const result = await configManager.validateProvider(options.provider);

      if (result.valid) {
        spinner.succeed(`${options.provider} configuration is valid`);
        console.log(chalk.green('\n✓ All checks passed'));
      } else {
        spinner.fail(`${options.provider} configuration is invalid`);
        console.log(chalk.red('\n✗ Validation errors:'));
        for (const error of result.errors) {
          console.log(chalk.red(`  • ${error}`));
        }
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail('Validation failed');
      console.error(chalk.red('\n✗ Error:'), error.message);
      process.exit(1);
    }
  });

// Show current config
configCmd
  .command('show')
  .description('Show current configuration (without sensitive data)')
  .action(async () => {
    try {
      const configManager = getLLMConfigManager();
      await configManager.load();

      const config = configManager.exportConfig();

      console.log(chalk.bold('\nCurrent Configuration:\n'));
      console.log(JSON.stringify(config, null, 2));
    } catch (error: any) {
      console.error(chalk.red('✗ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
