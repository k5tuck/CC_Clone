import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * MCP Client Manager
 * Allows your agent to connect to and use external MCP servers
 */
export class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private connectedServers: Map<string, MCPServerConfig> = new Map();
  private availableTools: Map<string, { serverName: string; tool: Tool }> = new Map();

  /**
   * Connect to an MCP server
   */
  async connectToServer(config: MCPServerConfig): Promise<void> {
    try {
      console.log(`  🔌 Connecting to ${config.name}...`);

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });

      const client = new Client(
        {
          name: 'cc-clone-agent',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      await client.connect(transport);

      this.clients.set(config.name, client);
      this.connectedServers.set(config.name, config);

      // Fetch available tools from this server
      await this.fetchToolsFromServer(config.name, client);

      const toolCount = Array.from(this.availableTools.values())
        .filter(t => t.serverName === config.name).length;
      
      console.log(`  ✓ ${config.name}: ${toolCount} tools available`);
    } catch (error: any) {
      throw new Error(`Failed to connect to MCP server ${config.name}: ${error.message}`);
    }
  }

  /**
   * Disconnect from a server
   */
  async disconnectFromServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} is not connected`);
    }

    await client.close();
    this.clients.delete(serverName);
    this.connectedServers.delete(serverName);

    // Remove tools from this server
    for (const [toolName, info] of this.availableTools.entries()) {
      if (info.serverName === serverName) {
        this.availableTools.delete(toolName);
      }
    }

    console.log(`✓ Disconnected from MCP server: ${serverName}`);
  }

  /**
   * Fetch tools from a connected server
   */
  private async fetchToolsFromServer(serverName: string, client: Client): Promise<void> {
    try {
      const response = await client.request(
        { method: 'tools/list' },
        {}
      );

      const tools = (response as any).tools as Tool[];

      for (const tool of tools) {
        // Prefix tool name with server name to avoid conflicts
        const prefixedName = `${serverName}__${tool.name}`;
        this.availableTools.set(prefixedName, { serverName, tool });
      }
    } catch (error: any) {
      console.error(`    ⚠️  Failed to fetch tools from ${serverName}:`, error.message);
    }
  }

  /**
   * Call a tool on an MCP server
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    const toolInfo = this.availableTools.get(toolName);
    
    if (!toolInfo) {
      throw new Error(`Tool ${toolName} not found in any connected MCP server`);
    }

    const client = this.clients.get(toolInfo.serverName);
    if (!client) {
      throw new Error(`Server ${toolInfo.serverName} is not connected`);
    }

    try {
      // Remove server prefix from tool name for the actual call
      const actualToolName = toolName.replace(`${toolInfo.serverName}__`, '');

      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: actualToolName,
            arguments: args,
          },
        },
        {}
      );

      return (response as any).content;
    } catch (error: any) {
      throw new Error(`Tool call failed for ${toolName}: ${error.message}`);
    }
  }

  /**
   * Get all available tools from all connected servers
   */
  getAllTools(): Array<{ name: string; serverName: string; tool: Tool }> {
    const tools: Array<{ name: string; serverName: string; tool: Tool }> = [];

    for (const [name, info] of this.availableTools.entries()) {
      tools.push({
        name,
        serverName: info.serverName,
        tool: info.tool,
      });
    }

    return tools;
  }

  /**
   * Get tools formatted for LLM (compatible with your Tool interface)
   */
  getToolsForLLM(): Array<{
    name: string;
    description: string;
    parameters: any;
  }> {
    return this.getAllTools().map(({ name, tool }) => ({
      name,
      description: tool.description || '',
      parameters: tool.inputSchema,
    }));
  }

  /**
   * Get list of connected servers
   */
  getConnectedServers(): string[] {
    return Array.from(this.connectedServers.keys());
  }

  /**
   * Check if a server is connected
   */
  isServerConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    const serverNames = Array.from(this.clients.keys());
    
    for (const serverName of serverNames) {
      try {
        await this.disconnectFromServer(serverName);
      } catch (error) {
        console.error(`Error disconnecting from ${serverName}:`, error);
      }
    }
  }

  /**
   * Get statistics about connected servers and tools
   */
  getStats() {
    const stats = {
      connectedServers: this.connectedServers.size,
      totalTools: this.availableTools.size,
      byServer: {} as Record<string, number>,
    };

    for (const [toolName, info] of this.availableTools.entries()) {
      stats.byServer[info.serverName] = (stats.byServer[info.serverName] || 0) + 1;
    }

    return stats;
  }
}