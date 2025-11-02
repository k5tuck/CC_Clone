# Selek - Advanced Multi-Agent AI Framework

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Ollama](https://img.shields.io/badge/Ollama-Compatible-orange.svg)](https://ollama.ai/)

**Selek** is a powerful, extensible TypeScript framework for building sophisticated multi-agent AI systems with local LLM support. Featuring an interactive Terminal User Interface (TUI), dynamic model selection, intelligent agent orchestration, ephemeral knowledge graphs, and comprehensive tool integration with built-in safety mechanisms.

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

### ✨ Advanced UX Features (Phase 1)
- **🔍 Universal Search** (Ctrl+F): Search across files, agents, conversations, and commands with fuzzy matching
- **🔐 Smart Permission System**: Risk-based validation with trusted project management
- **📊 Tool Usage Transparency** (Ctrl+U): Real-time tracking of all tool executions with performance stats
- **📈 Enhanced Status Line** (Ctrl+S): Token usage, cost estimates, response times, and cache metrics
- **💼 Session Management** (Ctrl+E): Multiple conversation sessions with templates and tags
- **🧠 Context Inspector** (Ctrl+I): View context usage, auto-pruning suggestions, and token estimates
- **📋 Clipboard Integration** (Ctrl+V): Paste images directly from clipboard with platform-specific support

### 🤖 LLM & Model Management
- **Multi-Provider Support**: Ollama (local), Anthropic Claude, and OpenAI GPT
- **Dynamic Provider Switching**: Switch between providers on-the-fly (`/provider`, `/providers`)
- **Dynamic Model Switching**: Change models on-the-fly without restarting (`/model`, `/models`)
- **Multi-Model Support**: Use different models for different tasks
- **Automatic Model Discovery**: Lists all available models per provider
- **Streaming Responses**: Real-time token-by-token response streaming

### 🛠️ Comprehensive Tool System
- **File Operations**: Read, write, edit files with intelligent context awareness
- **File Safety Validation**: Enforces read-before-write rule to prevent accidental overwrites
- **Bash Execution**: Execute shell commands with 12-pattern security blacklist
- **Search Capabilities**: Glob patterns, regex search, and content grep
- **Tool-Aware LLM**: Automatic tool selection and execution during conversations
- **MCP Support**: Model Context Protocol integration for extended capabilities
- **Custom Tools**: Extensible tool registration system

### 🧩 Skills Framework
- **Reusable Skills**: Modular, composable skill definitions
- **Skill Discovery**: Automatic skill loading and registration
- **Skill-Aware Agents**: Agents can leverage available skills dynamically
- **Skill Manager**: Central management for all skills

### 🧠 Knowledge Graph & Memory
- **Ephemeral Knowledge Graph**: Track entities (files, agents, tasks) and relationships
- **Vector Database**: Lightweight in-memory vector store for semantic search
- **Agent History**: Learn from past agent executions and solutions
- **File Context Analysis**: Understand dependencies before modifying code
- **Graph Traversal**: Discover connections through relationship following
- **Knowledge Tools**: 5 specialized tools for querying and storing knowledge

### 🛡️ System Checks & Balances
- **File Read-Before-Write**: Prevents accidental overwrites of existing files
- **Command Blacklist**: Blocks 12 dangerous command patterns (`rm -rf`, etc.)
- **Tool Validation**: 30+ validation mechanisms across the system
- **Provider Health Checks**: Automatic validation of LLM provider configurations
- **Session Tracking**: File access tracking scoped to conversation sessions
- **Clear Error Messages**: Detailed guidance when validation fails

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

#### Model & Provider Management
- `/providers` - List all available providers (Ollama, Anthropic, OpenAI)
- `/provider <name>` - Switch to a different provider
- `/models` - List all available models for current provider
- `/model <name>` - Switch to a different model
- `/model-current` - Display current provider, model, and endpoint

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

### Keyboard Shortcuts

Selek provides powerful keyboard shortcuts for quick access to advanced features:

- **Ctrl+F** - Universal Search (files, agents, conversations, commands)
- **Ctrl+U** - Toggle Tool Usage Panel
- **Ctrl+Shift+U** - Toggle Tool Statistics
- **Ctrl+S** - Toggle Detailed Status Line
- **Ctrl+Shift+S** - Toggle Compact Status Bar
- **Ctrl+E** - Session Switcher (switch/create sessions)
- **Ctrl+I** - Context Inspector (view context usage)
- **Ctrl+Shift+I** - Context Details (show/hide details)
- **Ctrl+V** - Paste from Clipboard (images supported)
- **Ctrl+C / Ctrl+D** - Exit

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
│   │   ├── components/         # UI components (20+ components)
│   │   │   ├── SearchModal.tsx # Universal search UI
│   │   │   ├── ToolUsagePanel.tsx # Tool tracking display
│   │   │   ├── SessionSwitcher.tsx # Session management UI
│   │   │   ├── ContextInspectorPanel.tsx # Context usage UI
│   │   │   └── ... (and more)
│   │   └── integration/        # Orchestrator bridge
│   ├── lib/
│   │   ├── agents/             # Agent system
│   │   │   ├── AgentSystem.ts  # Core orchestration
│   │   │   ├── AgentManager.ts # CRUD operations
│   │   │   ├── SystematicAgentPrompts.ts # Agent prompts with KG docs
│   │   │   └── SkillAwareAgent.ts
│   │   ├── llm/
│   │   │   └── ollama-client.ts # Ollama integration
│   │   ├── config/
│   │   │   └── LLMConfig.ts    # Multi-provider configuration
│   │   ├── permissions/        # Permission system (Phase 1)
│   │   │   └── PermissionManager.ts # Risk-based validation
│   │   ├── tool-tracking/      # Tool tracking (Phase 1)
│   │   │   └── ToolTracker.ts  # Real-time tool execution tracking
│   │   ├── status/             # Status tracking (Phase 1)
│   │   │   └── StatusTracker.ts # Metrics and performance tracking
│   │   ├── sessions/           # Session management (Phase 1)
│   │   │   └── SessionManager.ts # Multiple conversation sessions
│   │   ├── context/            # Context inspection (Phase 1)
│   │   │   └── ContextInspector.ts # Context usage tracking
│   │   ├── clipboard/          # Clipboard integration (Phase 1)
│   │   │   └── ClipboardHandler.ts # Image/text pasting
│   │   ├── search/             # Universal search (Phase 1)
│   │   │   └── SearchEngine.ts # Multi-source search
│   │   ├── knowledge/          # Knowledge graph system
│   │   │   └── KnowledgeGraph.ts # Entity & relationship tracking
│   │   ├── memory/             # Memory & vector store
│   │   │   ├── VectorStore.ts  # In-memory vector database
│   │   │   └── EmbeddingProvider.ts
│   │   ├── streaming/          # Real-time streaming
│   │   │   └── StreamingClientWithTools.ts # File access tracking
│   │   ├── skills/             # Skills framework
│   │   ├── orchestrator/       # Multi-agent orchestrator
│   │   ├── history/            # Conversation management
│   │   ├── tools/              # Tool implementations
│   │   │   ├── toolFunctions.ts # File validation & tracking
│   │   │   └── knowledge-tools.ts # KG query tools
│   │   └── providers/          # LLM provider integrations
│   │       ├── AnthropicProvider.ts
│   │       ├── OpenAIProvider.ts
│   │       └── OllamaProvider.ts
│   ├── mcp/                    # Model Context Protocol
│   └── cli.ts                  # CLI entry point
├── agents/                     # Agent definitions with KG examples
├── skills/                     # Skill definitions
├── docs/                       # Documentation
│   ├── SYSTEM_CHECKS.md        # All validation mechanisms
│   └── FILE_READ_WRITE_VALIDATION.md # File safety docs
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
# Ollama Configuration (Default Provider)
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3.1:latest

# Anthropic Configuration (Optional)
ANTHROPIC_API_KEY=your-api-key-here

# OpenAI Configuration (Optional)
OPENAI_API_KEY=your-api-key-here

# Supported Ollama models (examples):
# - llama3.1:latest
# - mistral:latest
# - codellama:latest
# - deepseek-coder:latest
# - qwen2.5-coder:latest
```

**Multi-Provider Support:**
- Use `/providers` to see all configured providers
- Use `/provider <name>` to switch between Ollama, Anthropic, or OpenAI
- API keys for cloud providers are stored securely in `~/.local-agent/llm-config.json`

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

### Phase 1 UX Features

#### Universal Search (Ctrl+F)

Search across your entire project with intelligent fuzzy matching:

```
> Press Ctrl+F to open search

🔍 Universal Search                                                    Esc to close
┌─────────────────────────────────────────────────────────────────────────────┐
│ > auth                                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
8 results (45ms)

📄 authentication.ts
   src/lib/auth/authentication.ts

📄 auth-utils.ts
   Line 42
   export function validateAuthToken(token: string): boolean {

🤖 SecurityAuditor
   Identifies security vulnerabilities
   vulnerability scanning, security best practices, OWASP compliance

⌨️ help
   Show help information
   Ctrl+H
```

**Search Capabilities:**
- File names and content search with line numbers
- Agent discovery by name and capabilities
- Command search with shortcuts
- Conversation history (when available)
- Knowledge graph entities (when available)
- Fuzzy matching for typo tolerance
- Real-time results as you type

#### Tool Usage Transparency (Ctrl+U)

Monitor all tool executions in real-time:

```
╭─ Tool Usage ────────────────────────────────────────────────────────╮
│ Active Tool Calls:                                                   │
│ 🔄 readFile                                               (2.3s)     │
│    path: src/lib/auth.ts                                             │
│                                                                       │
│ Recent Tool Calls:                                                   │
│ ✓ glob                                                   (1.2s)      │
│    pattern: **/*.ts                                                  │
│ ✓ grep                                                   (0.8s)      │
│    pattern: export.*function                                         │
│                                                                       │
│ Press Ctrl+Shift+U for detailed statistics                          │
╰──────────────────────────────────────────────────────────────────────╯
```

**Features:**
- Real-time tool call tracking
- Execution timing and performance metrics
- Tool call history with parameters
- Success/failure status indicators
- Tool statistics (Ctrl+Shift+U)

#### Enhanced Status Line (Ctrl+S)

View comprehensive system metrics:

```
╭─ System Status ─────────────────────────────────────────────────────╮
│ Provider: anthropic • Model: claude-3-5-sonnet-20241022             │
│ Tokens: 45,234 / 200,000 (22%) • Cost: $0.23                       │
│ Response Time: 1.2s avg • Cache Hit Rate: 67%                      │
│ Operation: Analyzing code • Can Interrupt: Yes                      │
╰──────────────────────────────────────────────────────────────────────╯
```

**Metrics Tracked:**
- Input/output token usage with color-coded warnings
- Cost estimates per provider (Anthropic, OpenAI, Ollama)
- Average response times
- Cache hit rates
- Current operation status
- Interrupt availability

#### Session Management (Ctrl+E)

Organize conversations with multiple sessions:

```
╭─ Session Switcher ──────────────────────────────────────────────────╮
│ Sessions (3) • Templates (6)                                         │
│                                                                       │
│ ▸ general-chat                    ⭐                                 │
│   Created: 2 hours ago • Last used: Just now                        │
│   Tags: general                                                      │
│                                                                       │
│   bug-fix-auth                                                       │
│   Created: 1 day ago • Last used: 5 hours ago                       │
│   Tags: bug-fix, authentication                                      │
│                                                                       │
│   feature-search                                                     │
│   Created: 3 days ago • Last used: 2 days ago                       │
│   Tags: feature, search                                              │
│                                                                       │
│ Enter: Switch • N: New • D: Delete • T: Templates • Esc: Close      │
╰──────────────────────────────────────────────────────────────────────╯
```

**Features:**
- Multiple conversation sessions
- 6 pre-defined templates (General, Bug Fix, Feature, Refactor, Documentation, Testing)
- Tag-based organization
- Star favorites
- Session search
- Automatic session switching

#### Context Inspector (Ctrl+I)

Monitor and optimize context usage:

```
╭─ Context Inspector ─────────────────────────────────────────────────╮
│ Total: 45,234 tokens / 200,000 (22%)                                │
│                                                                       │
│ By Type:                                                             │
│ 📄 Files (15)           12,450 tokens   28%                         │
│ 💬 Conversations (23)   18,932 tokens   42%                         │
│ ⚙️  System (1)           2,100 tokens    5%                         │
│ 🧠 Knowledge Graph (45) 8,752 tokens    19%                         │
│ 🔧 Tools (12)           1,500 tokens    3%                          │
│ 🤖 Agents (8)           1,500 tokens    3%                          │
│                                                                       │
│ Suggestions:                                                         │
│ • Consider removing old conversation: "debug-session-old" (2,340 t) │
│ • File rarely accessed: src/old/legacy.ts (890 tokens)              │
│                                                                       │
│ Press Ctrl+Shift+I for detailed item list                           │
╰──────────────────────────────────────────────────────────────────────╯
```

**Features:**
- Real-time context tracking by type
- Token usage breakdown
- Auto-pruning suggestions
- Importance levels (critical, high, medium, low)
- Access count tracking
- Context optimization recommendations

#### Clipboard Integration (Ctrl+V)

Paste images and text directly from your clipboard:

```
╭─────────────────────────────────────────────────────────────────────╮
│ 📷 Image Pasted from Clipboard                                      │
│                                                                       │
│    Type: image/png                                                   │
│    Dimensions: 1920 × 1080 px                                       │
│    Size: 234.5KB                                                     │
│                                                                       │
│    Image will be sent to vision-capable LLM (Claude 3.5, GPT-4V)   │
│                                                                       │
│    Press Enter to send, or type a message to add context            │
╰──────────────────────────────────────────────────────────────────────╯
```

**Features:**
- Platform-specific clipboard handling (macOS, Linux, Windows)
- Image detection and extraction
- Automatic format detection (PNG, JPEG, etc.)
- Vision-capable LLM integration
- Text clipboard support
- Visual feedback with metadata

### Multi-Provider Support

Switch between LLM providers seamlessly:

```
> /providers
**Available Providers:**

• ollama (current) - ✓ Enabled, 🔑 Configured - Model: llama3.1:latest
• anthropic - ✗ Enabled, ❌ Configured - Model: claude-3-5-sonnet-20241022
• openai - ✗ Enabled, ❌ Configured - Model: gpt-4-turbo

**Current:** ollama

Use /provider <name> to switch providers.

> /provider anthropic
✅ Switched to provider: anthropic
📦 Default model: claude-3-5-sonnet-20241022
```

### Dynamic Model Selection

Switch between models for the current provider:

```
> /models
Available Models:

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
- **Current Provider**: Active LLM provider (Ollama, Anthropic, OpenAI)
- **Current Model**: Active model for the provider
- **AutoSuggest Status**: ON (green) or OFF (gray)

Example:
```
╭─────────────────────────────────────────────────────────────────────────────╮
│ ● Ready • 8 agents • 5 skills • Provider: ollama • Model: llama3.1:latest • AutoSuggest: ON │
╰─────────────────────────────────────────────────────────────────────────────╯
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

### Knowledge Graph & Memory Tools

Agents can use specialized knowledge tools to understand context and learn from history:

**Available Knowledge Tools:**
1. **queryKnowledgeGraph** - Query entities (Files, Agents, Tasks, etc.) and relationships
2. **getFileContext** - Get comprehensive file dependencies before modifying
3. **getAgentHistory** - Learn from past agent executions and solutions
4. **storeKnowledge** - Record discoveries, solutions, and task completions
5. **findRelatedEntities** - Traverse the knowledge graph to discover connections

**Example Usage:**
```typescript
// Before modifying a file, check its context
const context = await getFileContext({ filePath: "src/lib/auth.ts" });
// Returns: { dependencies, dependents, functions, modifiedBy, tests }

// Learn from past work
const history = await getAgentHistory({ agentName: "code-agent" });
// Returns: tasks completed, files modified, solutions applied
```

See [Agent Definitions](./agents/) for examples of how agents use these tools.

### File Safety Validation

The system enforces a **read-before-write rule** to prevent accidental overwrites:

```typescript
// ❌ This will throw FileNotReadError
await writeFile({ path: 'existing.txt', content: 'new content' });
// Error: File has not been read yet. Read it first before writing to it

// ✅ Correct approach
await readFile({ path: 'existing.txt' });
await writeFile({ path: 'existing.txt', content: 'updated content' });
// Success!
```

**Benefits:**
- Prevents accidental file overwrites
- Enforces agents to understand context before changes
- Session-scoped tracking (resets between conversations)
- New files can be created without reading

See [FILE_READ_WRITE_VALIDATION.md](./docs/FILE_READ_WRITE_VALIDATION.md) for complete documentation.

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

### ✅ Phase 1: UX/UI Enhancements (COMPLETED)
- [x] **Universal Search** - Search across files, agents, conversations, and commands
- [x] **Smart Permission System** - Risk-based validation with trusted projects
- [x] **Tool Usage Transparency** - Real-time tool tracking and performance metrics
- [x] **Enhanced Status Line** - Token usage, costs, response times, cache metrics
- [x] **Session Management** - Multiple conversations with templates and tags
- [x] **Context Inspector** - Context usage tracking and optimization
- [x] **Clipboard Integration** - Image and text pasting with platform support

### ✅ Foundation (COMPLETED)
- [x] **Vector database integration for memory** - Ephemeral knowledge graph & vector store
- [x] **Cloud LLM provider support** - Anthropic Claude & OpenAI GPT integration
- [x] **File safety validation** - Read-before-write enforcement
- [x] **Comprehensive system checks** - 30+ validation mechanisms

### 🚧 Phase 2: Collaboration & Intelligence (In Progress)
- [ ] Agent-to-agent communication protocols
- [ ] Shared knowledge graphs across sessions
- [ ] Advanced context optimization with ML
- [ ] Real-time collaboration features
- [ ] Enhanced permission granularity

### 🔮 Phase 3+: Extensibility & Scale (Planned)
- [ ] Plugin system for third-party extensions
- [ ] Web-based UI alongside TUI
- [ ] Multi-user support with authentication
- [ ] Docker containerization improvements
- [ ] Performance profiling and optimization
- [ ] Advanced knowledge graph persistence

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

### File Validation Error

**Problem**: "File has not been read yet. Read it first before writing to it"

**Solution**:
```typescript
// Read the file first
await readFile({ path: 'myfile.txt' });

// Then write to it
await writeFile({ path: 'myfile.txt', content: 'updated' });
```

This is a safety feature to prevent accidental overwrites. See [FILE_READ_WRITE_VALIDATION.md](./docs/FILE_READ_WRITE_VALIDATION.md) for details.

### Provider Switching Issues

**Problem**: Cannot switch to Anthropic or OpenAI

**Solution**:
- Ensure API key is configured in environment or via LLM config
- Check provider is enabled: `/providers`
- Verify API key is valid and has sufficient credits
- Check network connectivity for cloud providers

---

## 📚 Documentation

### Core Documentation
- **[SYSTEM_CHECKS.md](./docs/SYSTEM_CHECKS.md)** - Complete catalog of all 30+ validation mechanisms
- **[FILE_READ_WRITE_VALIDATION.md](./docs/FILE_READ_WRITE_VALIDATION.md)** - File safety validation guide

### Knowledge Graph & Memory
- **[Knowledge Graph Tools](./src/lib/tools/knowledge-tools.ts)** - 5 specialized tools for querying the knowledge graph
- **[Systematic Agent Prompts](./src/lib/agents/SystematicAgentPrompts.ts)** - Agent prompts with KG documentation

### Provider Configuration
- **[LLM Configuration](./src/lib/config/LLMConfig.ts)** - Multi-provider management system
- **[Provider Implementations](./src/lib/providers/)** - Anthropic, OpenAI, and Ollama integrations

### Testing
- **[File Validation Tests](./test-file-validation.ts)** - Run with `npx tsx test-file-validation.ts`

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
