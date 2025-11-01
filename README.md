# Selek - Advanced Multi-Agent AI Framework

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Ollama](https://img.shields.io/badge/Ollama-Compatible-orange.svg)](https://ollama.ai/)

**Selek** is a powerful, extensible TypeScript framework for building sophisticated multi-agent AI systems with local LLM support. Featuring an interactive Terminal User Interface (TUI), dynamic model selection, intelligent agent orchestration, and comprehensive tool integration.

---

## ✨ Key Features

### 🎯 Multi-Agent Orchestration
- **Dynamic Agent System**: Create, manage, and execute specialized agents for specific tasks
- **Agent Templates**: Export and install reusable agent configurations
- **Intelligent Auto-Suggest**: AI-powered agent recommendations based on user intent (toggle on/off)
- **Real-time Status Tracking**: Monitor agent execution, progress, and activity logs
- **Plan Approval Workflow**: Review and approve agent execution plans before running

### 🖥️ Interactive Terminal UI (TUI)
- **Real-time Streaming**: Live response streaming with visual feedback
- **Command Autocomplete**: Tab completion for all available commands
- **Visual Agent Management**: Browse, create, and manage agents directly in the TUI
- **Status Bar**: Live display of system status, model info, and auto-suggest state
- **Message History**: Full conversation history with role-based formatting

### 🤖 LLM & Model Management
- **Ollama Integration**: Native support for local Ollama models
- **Dynamic Model Switching**: Change models on-the-fly without restarting (`/model`, `/models`)
- **Multi-Model Support**: Use different models for different tasks
- **Automatic Model Discovery**: Lists all available Ollama models
- **Streaming Responses**: Real-time token-by-token response streaming

### 🛠️ Comprehensive Tool System
- **File Operations**: Read, write, edit files with intelligent context awareness
- **Bash Execution**: Execute shell commands with safety constraints
- **Search Capabilities**: Glob patterns, regex search, and content grep
- **Tool-Aware LLM**: Automatic tool selection and execution during conversations
- **MCP Support**: Model Context Protocol integration for extended capabilities
- **Custom Tools**: Extensible tool registration system

### 🧩 Skills Framework
- **Reusable Skills**: Modular, composable skill definitions
- **Skill Discovery**: Automatic skill loading and registration
- **Skill-Aware Agents**: Agents can leverage available skills dynamically
- **Skill Manager**: Central management for all skills

### 💾 Conversation Management
- **History Persistence**: Automatic conversation history saving
- **Context Loading**: Project context awareness for better responses
- **Message Formatting**: Markdown support with syntax highlighting
- **Conversation Restore**: Resume previous conversations

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18.0 or higher
- **Ollama**: For local LLM inference ([Install Ollama](https://ollama.ai/))
- **TypeScript**: Included in dependencies

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/k5tuck/CC_Clone.git selek
cd selek
```

2. **Install dependencies:**
```bash
npm install
# or
pnpm install
```

3. **Set up environment:**
```bash
cp env.example .env
```

4. **Configure Ollama endpoint and model** (`.env`):
```env
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3.1:latest
```

5. **Build the project:**
```bash
npm run build
```

### Running Selek

#### Interactive TUI (Recommended)
```bash
npm run tui
```

#### CLI Mode
```bash
npm run cli
```

---

## 📖 Usage Guide

### TUI Commands

#### Chat & System
- `/help` - Show all available commands
- `/clear` - Clear conversation history
- `/reload` - Reload agents and skills

#### Agent Management
- `/agents` - Toggle agent list display
- `/agent-list` - List all available agents
- `/agent-view <id>` - View detailed agent information
- `/agent-delete <id>` - Delete an agent
- `/agent <id> <task>` - Execute a specific agent with a task
- `/create-agent` - Launch agent creation wizard
- `/autosuggest` - Toggle agent auto-suggest on/off

#### Model Management (NEW!)
- `/models` - List all available Ollama models
- `/model <name>` - Switch to a different model
- `/model-current` - Display current model and endpoint

#### Templates
- `/templates` - List agent templates
- `/template-export <id> [category]` - Export agent as template
- `/template-install <template-id> <new-id>` - Install template as new agent

#### Plan Approval
- `/approve` - Approve a pending agent execution plan
- `/reject` - Reject a pending plan

#### Other
- `/skills` - Toggle skills list display
- `/mcp` - Show MCP server status and available tools

### Creating Custom Agents

Use the interactive agent creator:
```
/create-agent
```

Follow the prompts to define:
1. **Agent ID**: Unique identifier (e.g., `code-reviewer`)
2. **Name**: Display name (e.g., `Code Reviewer`)
3. **Description**: What the agent does
4. **Avatar**: Emoji representation
5. **Capabilities**: Comma-separated list
6. **Keywords**: Activation keywords for auto-suggest
7. **System Prompt**: Agent's behavior instructions

### Agent Structure

Agents are stored in `./agents/<agent-id>/AGENT.md`:

```markdown
---
id: code-reviewer
name: Code Reviewer
description: Reviews code for best practices and issues
avatar: 🔍
capabilities: [code-review, analysis, suggestions]
activation_keywords: [review, analyze, check]
requires_approval: false
max_iterations: 10
---

# System Prompt
You are an expert code reviewer. Analyze code for...
```

---

## 🏗️ Architecture

### Core Components

```
selek/
├── src/
│   ├── tui/                    # Terminal UI
│   │   ├── multiagent-tui.tsx  # Main TUI component
│   │   └── integration/        # Orchestrator bridge
│   ├── lib/
│   │   ├── agents/             # Agent system
│   │   │   ├── AgentSystem.ts  # Core orchestration
│   │   │   ├── AgentManager.ts # CRUD operations
│   │   │   └── SkillAwareAgent.ts
│   │   ├── llm/
│   │   │   └── ollama-client.ts # Ollama integration
│   │   ├── streaming/          # Real-time streaming
│   │   ├── skills/             # Skills framework
│   │   ├── orchestrator/       # Multi-agent orchestrator
│   │   ├── history/            # Conversation management
│   │   └── tools/              # Tool implementations
│   ├── mcp/                    # Model Context Protocol
│   └── cli.ts                  # CLI entry point
├── agents/                     # Agent definitions
├── skills/                     # Skill definitions
├── config/                     # Configuration files
│   └── mcp-servers.json        # MCP server config
└── .conversation_history/      # Saved conversations
```

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **UI Framework**: Ink (React for terminals)
- **LLM Integration**: Ollama via REST API
- **State Management**: React hooks
- **File I/O**: Node.js fs/promises
- **Process Management**: child_process
- **Data Formats**: YAML frontmatter, JSON, Markdown

---

## 🔧 Configuration

### Environment Variables

```env
# Ollama Configuration
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3.1:latest

# Supported models (examples):
# - llama3.1:latest
# - mistral:latest
# - codellama:latest
# - deepseek-coder:latest
# - qwen2.5-coder:latest
```

### MCP Server Configuration

Create `config/mcp-servers.json`:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"],
      "env": {}
    }
  ]
}
```

---

## 🎨 Features in Detail

### Dynamic Model Selection

Switch between Ollama models on-the-fly:

```
> /models
Available Ollama Models:

• llama3.1:latest ✓ (current)
• mistral:latest
• codellama:latest
• deepseek-coder:latest

> /model codellama:latest
✅ Switched to model: codellama:latest
```

### Intelligent Agent Auto-Suggest

The system analyzes your input and suggests the most appropriate agent:

```
> Review my authentication code

💡 Agent Suggestion: 🔍 Code Reviewer might be best suited for this task.
   Reason: Matched keywords: review
   Confidence: 85%

   Use `/agent code-reviewer Review my authentication code` to execute.
```

Toggle auto-suggest on/off with `/autosuggest`.

### Real-Time Status Bar

The bottom status bar displays:
- **System Status**: Initializing, Ready, Streaming, or Error
- **Agent Count**: Number of available agents
- **Skills Count**: Number of loaded skills
- **Current Model**: Active Ollama model
- **AutoSuggest Status**: ON (green) or OFF (gray)

Example:
```
╭──────────────────────────────────────────────────────────╮
│ ● Ready • 8 agents • 5 skills • Model: llama3.1:latest • AutoSuggest: ON │
╰──────────────────────────────────────────────────────────╯
```

### Tool-Aware Conversations

The LLM automatically uses available tools during conversations:

```
> What files are in the src directory?

[Agent uses glob tool to search]

I found the following files in src/:
- src/tui/multiagent-tui.tsx
- src/lib/agents/AgentSystem.ts
- src/lib/llm/ollama-client.ts
...
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 Roadmap

- [ ] Multi-user support with authentication
- [ ] Web-based UI alongside TUI
- [ ] Vector database integration for memory
- [ ] Cloud LLM provider support (Anthropic, OpenAI)
- [ ] Agent collaboration and handoff
- [ ] Persistent tool call logging
- [ ] Plugin system for third-party extensions
- [ ] Docker containerization improvements
- [ ] Performance profiling and optimization

---

## 🐛 Troubleshooting

### Ollama Connection Issues

**Problem**: "Cannot connect to Ollama"

**Solution**:
```bash
# Check if Ollama is running
ollama list

# Start Ollama service
ollama serve

# Verify endpoint
curl http://localhost:11434/api/tags
```

### Model Not Found

**Problem**: Model doesn't appear in `/models` list

**Solution**:
```bash
# Pull the model
ollama pull llama3.1

# Verify it's available
ollama list
```

### Agent Creation Fails

**Problem**: Agent doesn't save or appears broken

**Solution**:
- Ensure the `./agents` directory exists
- Check file permissions
- Verify YAML frontmatter syntax
- Review agent ID for special characters (use lowercase, hyphens only)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Ollama**: For providing excellent local LLM infrastructure
- **Ink**: For the React-based terminal UI framework
- **TypeScript**: For making JavaScript development sane
- **Model Context Protocol**: For standardized tool interfaces

---

## 📧 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/k5tuck/CC_Clone/issues)
- **Discussions**: [GitHub Discussions](https://github.com/k5tuck/CC_Clone/discussions)

---

**Built with ❤️ by the Selek Team**

*Empowering developers to build the future of AI agents, locally.*
