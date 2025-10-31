/**
 * AgentManager - Complete CRUD operations for agents
 * Provides Claude Code-style agent management functionality
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { AgentMetadata, AgentConfig, Agent } from './AgentSystem';

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  metadata: AgentMetadata;
  config: AgentConfig;
}

export class AgentManager {
  private agentsDirectory: string;
  private templatesDirectory: string;

  constructor(agentsDirectory: string = './agents', templatesDirectory: string = './agent-templates') {
    this.agentsDirectory = path.resolve(agentsDirectory);
    this.templatesDirectory = path.resolve(templatesDirectory);
  }

  /**
   * List all agents with details
   */
  async listAgents(): Promise<Agent[]> {
    await this.ensureDirectoryExists(this.agentsDirectory);

    const entries = await fs.readdir(this.agentsDirectory, { withFileTypes: true });
    const agentDirs = entries.filter(e => e.isDirectory());

    const agents: Agent[] = [];
    for (const dir of agentDirs) {
      try {
        const agent = await this.getAgent(dir.name);
        if (agent) {
          agents.push(agent);
        }
      } catch (error) {
        console.warn(`Failed to load agent ${dir.name}:`, error);
      }
    }

    return agents;
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    const agentPath = path.join(this.agentsDirectory, agentId);
    const agentFile = path.join(agentPath, 'AGENT.md');

    try {
      await fs.access(agentFile);
    } catch {
      return null;
    }

    const content = await fs.readFile(agentFile, 'utf-8');
    const { data, content: systemPrompt } = matter(content);

    const metadata: AgentMetadata = {
      id: data.id || agentId,
      name: data.name,
      description: data.description,
      version: data.version || '1.0.0',
      author: data.author,
      avatar: data.avatar || '🤖',
      color: data.color || 'blue',
      capabilities: data.capabilities || [],
      activation_keywords: data.activation_keywords || [],
      requires_approval: data.requires_approval || false,
      max_iterations: data.max_iterations || 10,
    };

    const config: AgentConfig = {
      systemPrompt: systemPrompt.trim(),
      temperature: data.temperature || 0.7,
      maxTokens: data.max_tokens || 2000,
      tools: data.tools || [],
    };

    return {
      metadata,
      config,
      path: agentPath,
    };
  }

  /**
   * Create a new agent
   */
  async createAgent(params: {
    id: string;
    name: string;
    description: string;
    avatar?: string;
    color?: string;
    capabilities?: string[];
    activation_keywords?: string[];
    systemPrompt: string;
    temperature?: number;
    max_tokens?: number;
    tools?: string[];
  }): Promise<Agent> {
    const agentPath = path.join(this.agentsDirectory, params.id);

    // Check if agent already exists
    try {
      await fs.access(agentPath);
      throw new Error(`Agent already exists: ${params.id}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT' && error.message.includes('already exists')) {
        throw error;
      }
    }

    // Create directory
    await fs.mkdir(agentPath, { recursive: true });

    // Create AGENT.md
    const agentMd = this.generateAgentMarkdown(params);
    await fs.writeFile(path.join(agentPath, 'AGENT.md'), agentMd, 'utf-8');

    console.log(`✓ Created agent: ${params.name} at ${agentPath}`);

    // Return the created agent
    return (await this.getAgent(params.id))!;
  }

  /**
   * Update an existing agent
   */
  async updateAgent(
    agentId: string,
    updates: Partial<{
      name: string;
      description: string;
      avatar: string;
      color: string;
      capabilities: string[];
      activation_keywords: string[];
      systemPrompt: string;
      temperature: number;
      max_tokens: number;
      tools: string[];
    }>
  ): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Merge updates
    const updatedMetadata = {
      ...agent.metadata,
      name: updates.name || agent.metadata.name,
      description: updates.description || agent.metadata.description,
      avatar: updates.avatar || agent.metadata.avatar,
      color: updates.color || agent.metadata.color,
      capabilities: updates.capabilities || agent.metadata.capabilities,
      activation_keywords: updates.activation_keywords || agent.metadata.activation_keywords,
    };

    const updatedConfig = {
      ...agent.config,
      systemPrompt: updates.systemPrompt || agent.config.systemPrompt,
      temperature: updates.temperature ?? agent.config.temperature,
      maxTokens: updates.max_tokens ?? agent.config.maxTokens,
      tools: updates.tools || agent.config.tools,
    };

    // Generate updated markdown
    const agentMd = this.generateAgentMarkdown({
      id: agentId,
      name: updatedMetadata.name,
      description: updatedMetadata.description,
      avatar: updatedMetadata.avatar,
      color: updatedMetadata.color,
      capabilities: updatedMetadata.capabilities,
      activation_keywords: updatedMetadata.activation_keywords,
      systemPrompt: updatedConfig.systemPrompt,
      temperature: updatedConfig.temperature,
      max_tokens: updatedConfig.maxTokens,
      tools: updatedConfig.tools,
    });

    // Write updated file
    const agentFile = path.join(agent.path, 'AGENT.md');
    await fs.writeFile(agentFile, agentMd, 'utf-8');

    console.log(`✓ Updated agent: ${updatedMetadata.name}`);

    return (await this.getAgent(agentId))!;
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    const agentPath = path.join(this.agentsDirectory, agentId);

    try {
      await fs.access(agentPath);
      await fs.rm(agentPath, { recursive: true, force: true });
      console.log(`✓ Deleted agent: ${agentId}`);
    } catch (error) {
      throw new Error(`Failed to delete agent ${agentId}: Agent not found`);
    }
  }

  /**
   * Duplicate an agent with a new ID
   */
  async duplicateAgent(sourceId: string, newId: string, newName?: string): Promise<Agent> {
    const sourceAgent = await this.getAgent(sourceId);
    if (!sourceAgent) {
      throw new Error(`Source agent not found: ${sourceId}`);
    }

    return await this.createAgent({
      id: newId,
      name: newName || `${sourceAgent.metadata.name} (Copy)`,
      description: sourceAgent.metadata.description,
      avatar: sourceAgent.metadata.avatar,
      color: sourceAgent.metadata.color,
      capabilities: sourceAgent.metadata.capabilities,
      activation_keywords: sourceAgent.metadata.activation_keywords,
      systemPrompt: sourceAgent.config.systemPrompt,
      temperature: sourceAgent.config.temperature,
      max_tokens: sourceAgent.config.maxTokens,
      tools: sourceAgent.config.tools,
    });
  }

  /**
   * Export agent as a template
   */
  async exportAsTemplate(agentId: string, category: string = 'custom'): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    await this.ensureDirectoryExists(this.templatesDirectory);

    const templatePath = path.join(this.templatesDirectory, `${agentId}.json`);
    const template: AgentTemplate = {
      id: agentId,
      name: agent.metadata.name,
      description: agent.metadata.description,
      category,
      metadata: agent.metadata,
      config: agent.config,
    };

    await fs.writeFile(templatePath, JSON.stringify(template, null, 2), 'utf-8');
    console.log(`✓ Exported agent template: ${templatePath}`);
  }

  /**
   * Import agent from template
   */
  async importFromTemplate(templateId: string, newAgentId: string): Promise<Agent> {
    const templatePath = path.join(this.templatesDirectory, `${templateId}.json`);

    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      const template: AgentTemplate = JSON.parse(content);

      return await this.createAgent({
        id: newAgentId,
        name: template.metadata.name,
        description: template.metadata.description,
        avatar: template.metadata.avatar,
        color: template.metadata.color,
        capabilities: template.metadata.capabilities,
        activation_keywords: template.metadata.activation_keywords,
        systemPrompt: template.config.systemPrompt,
        temperature: template.config.temperature,
        max_tokens: template.config.maxTokens,
        tools: template.config.tools,
      });
    } catch (error) {
      throw new Error(`Failed to import template ${templateId}: ${error}`);
    }
  }

  /**
   * List available templates
   */
  async listTemplates(): Promise<AgentTemplate[]> {
    await this.ensureDirectoryExists(this.templatesDirectory);

    const files = await fs.readdir(this.templatesDirectory);
    const templates: AgentTemplate[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(this.templatesDirectory, file), 'utf-8');
          const template: AgentTemplate = JSON.parse(content);
          templates.push(template);
        } catch (error) {
          console.warn(`Failed to load template ${file}:`, error);
        }
      }
    }

    return templates;
  }

  /**
   * Search agents by keywords
   */
  async searchAgents(query: string): Promise<Agent[]> {
    const allAgents = await this.listAgents();
    const lowerQuery = query.toLowerCase();

    return allAgents.filter(agent =>
      agent.metadata.name.toLowerCase().includes(lowerQuery) ||
      agent.metadata.description.toLowerCase().includes(lowerQuery) ||
      agent.metadata.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery)) ||
      agent.metadata.activation_keywords?.some(kw => kw.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get agent statistics
   */
  async getStatistics(): Promise<{
    totalAgents: number;
    totalTemplates: number;
    agentsByCategory: Record<string, number>;
  }> {
    const agents = await this.listAgents();
    const templates = await this.listTemplates();

    const agentsByCategory: Record<string, number> = {};
    for (const agent of agents) {
      // Use first capability as category
      const category = agent.metadata.capabilities[0] || 'general';
      agentsByCategory[category] = (agentsByCategory[category] || 0) + 1;
    }

    return {
      totalAgents: agents.length,
      totalTemplates: templates.length,
      agentsByCategory,
    };
  }

  // Helper methods

  private generateAgentMarkdown(params: any): string {
    return `---
id: ${params.id}
name: ${params.name}
description: ${params.description}
version: 1.0.0
avatar: ${params.avatar || '🤖'}
color: ${params.color || 'blue'}
capabilities: ${JSON.stringify(params.capabilities || [])}
activation_keywords: ${JSON.stringify(params.activation_keywords || [])}
requires_approval: false
max_iterations: 10
temperature: ${params.temperature || 0.7}
max_tokens: ${params.max_tokens || 2000}
tools: ${JSON.stringify(params.tools || [])}
---

${params.systemPrompt}
`;
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// Singleton instance
let agentManagerInstance: AgentManager | null = null;

export function getAgentManager(agentsDirectory?: string): AgentManager {
  if (!agentManagerInstance) {
    agentManagerInstance = new AgentManager(agentsDirectory);
  }
  return agentManagerInstance;
}

export function resetAgentManager(): void {
  agentManagerInstance = null;
}
