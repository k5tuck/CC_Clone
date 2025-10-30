# CC_Clone - Multi-Agent Code Assistant with Ollama

A powerful TypeScript-based multi-agent orchestration system that uses local LLMs (via Ollama) to plan and execute complex coding tasks.

## 🌟 Features

- **Multi-Agent Architecture**: Specialized agents for implementation, security, performance, and more
- **Local LLM Integration**: Uses Ollama for complete privacy and offline operation
- **Automated Planning**: Agents create detailed implementation plans following SOLID principles
- **Automated Execution**: Plans can be automatically executed with checkpoints and rollback
- **Tool System**: File operations, code search, and bash execution
- **Plan Registry**: Track all agent executions and plans
- **Error Handling**: Custom exception classes with full context
- **Type Safety**: Full TypeScript with strict typing

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** or **npm**
- **Ollama** installed and running locally

### Installing Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

### Pull an LLM Model

```bash
# Recommended models:
ollama pull llama3.1:latest      # Best for general tasks
ollama pull codellama:latest     # Optimized for coding
ollama pull deepseek-coder:latest # Excellent for code generation
ollama pull mistral:latest       # Fast and capable
```

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/k5tuck/CC_Clone.git
cd CC_Clone
```

### 2. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 3. Set Up Environment

```bash
cp .env.example .env
# Edit .env to configure your Ollama endpoint and model
```

### 4. Create Prompt Templates Directory

```bash
mkdir -p .claude/prompts
```

### 5. Add the Implementation Agent Template

Create `.claude/prompts/implementation-agent.md` and paste your implementation agent prompt template (the one from earlier).

### 6. Build the Project

```bash
pnpm build
# or
npm run build
```

### 7. Link CLI Globally (Optional)

```bash
npm link
# Now you can use 'local-agent' command anywhere
```

## 📖 Usage

### Health Check

Verify your system is properly configured:

```bash
pnpm cli health
# or
local-agent health
```

### Initialize the System

```bash
pnpm cli init
```

### Spawn Agents to Create Plans

```bash
pnpm cli spawn \
  --task "Build a REST API for user authentication with JWT tokens" \
  --domain "Python Backend Development" \
  --agents "implementation"
```

With multiple agents:

```bash
pnpm cli spawn \
  --task "Create a payment processing module" \
  --domain "Backend Development" \
  --agents "implementation,security,performance"
```

With auto-execution:

```bash
pnpm cli spawn \
  --task "Build a simple TODO API" \
  --domain "Node.js Backend" \
  --agents "implementation" \
  --auto-execute
```

### Execute a Plan

```bash
pnpm cli execute plans/implementation/implementation-plan-2025-10-29-rest-api.md
```

Dry run (no actual changes):

```bash
pnpm cli execute plans/implementation/implementation-plan-2025-10-29-rest-api.md --dry-run
```

### List All Agents

```bash
pnpm cli list
```

Filter by status:

```bash
pnpm cli list --status completed
pnpm cli list --status failed
```

### Search for Agents

```bash
pnpm cli search "authentication"
pnpm cli search "API"
```

## 📁 Project Structure

```
CC_Clone/
├── src/
│   ├── lib/
│   │   ├── llm/
│   │   │   └── ollama-client.ts      # Ollama LLM integration
│   │   ├── agents/
│   │   │   ├── specialized-agent.ts  # Base for specialized agents
│   │   │   └── implementation-agent.ts # Implementation planning agent
│   │   ├── executor/
│   │   │   └── plan-executor.ts      # Automated plan execution
│   │   ├── orchestrator/
│   │   │   └── multi-agent-orchestrator.ts # Multi-agent coordination
│   │   ├── agent.ts                  # Base Agent class
│   │   ├── tools.ts                  # Tool registration
│   │   ├── storage.ts                # File storage
│   │   ├── trust.ts                  # Security/trust system
│   │   └── session.ts                # Session management
│   ├── cli.ts                        # CLI interface
│   └── tui.ts                        # Terminal UI (optional)
├── .claude/
│   └── prompts/
│       └── implementation-agent.md   # Agent prompt templates
├── plans/                            # Generated plans
│   ├── implementation/
│   ├── security/
│   ├── performance/
│   └── agent-registry.json          # Agent execution registry
├── .env                              # Configuration
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Configuration

Edit `.env` to customize:

```bash
# Ollama Configuration
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3.1:latest

# Agent Configuration
AGENT_HOME=~/.local-agent
MAX_ITERATIONS=10

# Output Directories
PLANS_DIR=./plans
TEMPLATES_DIR=./.claude/prompts
```

## 🎯 Creating Your Own Specialized Agents

### 1. Create Agent Class

```typescript
// src/lib/agents/security-agent.ts
import { SpecializedAgent } from './specialized-agent';

export class SecurityAgent extends SpecializedAgent {
  protected getRequiredSections(): string[] {
    return [
      '# Security Review',
      '## Threat Analysis',
      '## Vulnerabilities',
      '## Mitigation Strategy',
    ];
  }

  protected getAgentType(): string {
    return 'security';
  }
}
```

### 2. Create Prompt Template

Create `.claude/prompts/security-agent.md` with your specialized prompt.

### 3. Update Orchestrator

Modify `multi-agent-orchestrator.ts` to handle your new agent type.

## 🛠️ Advanced Usage

### Programmatic API

```typescript
import { MultiAgentOrchestrator } from './lib/orchestrator/multi-agent-orchestrator';

const orchestrator = new MultiAgentOrchestrator(
  'http://localhost:11434',
  'llama3.1:latest'
);

await orchestrator.initialize();

const result = await orchestrator.executeTask({
  description: 'Build user authentication',
  domain: 'Backend Development',
  requiredAgents: ['implementation', 'security'],
  autoExecute: false,
});

console.log('Plans:', result.plans);
console.log('Summary:', result.summary);
```

### Direct Agent Usage

```typescript
import { Agent } from './lib/agent';
import { OllamaClient } from './lib/llm/ollama-client';
import { registerTools } from './lib/tools';

const llm = new OllamaClient({
  endpoint: 'http://localhost:11434',
  model: 'llama3.1:latest',
});

const agent = new Agent(
  { name: 'my-agent', role: 'admin' },
  llm
);

registerTools(agent);

const response = await agent.run('Create a Python function to sort a list');
console.log(response);
```

## 🧪 Testing

```bash
pnpm test
```

## 🐛 Troubleshooting

### Ollama Connection Issues

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve
```

### Model Not Found

```bash
# List available models
ollama list

# Pull the model
ollama pull llama3.1:latest
```

### Permission Errors

```bash
# Ensure directories are writable
chmod -R 755 .claude plans
```

### Type Errors

```bash
# Rebuild the project
pnpm clean
pnpm build
```

## 📝 Examples

### Example 1: Create a Simple Web Server

```bash
pnpm cli spawn \
  --task "Create an Express web server with /hello endpoint" \
  --domain "Node.js Backend" \
  --agents "implementation" \
  --auto-execute
```

### Example 2: Security Review

```bash
pnpm cli spawn \
  --task "Review authentication implementation for vulnerabilities" \
  --domain "Security Analysis" \
  --agents "security"
```

### Example 3: Full Stack Feature

```bash
pnpm cli spawn \
  --task "Implement user profile CRUD operations with tests" \
  --domain "Full Stack Development" \
  --agents "implementation,security,performance"
```

## 🔒 Security

- **Trusted Directories**: Only specified directories are accessible
- **Command Blacklist**: Dangerous bash commands are blocked
- **Sub-agent Restrictions**: Sub-agents cannot modify orchestrator files
- **Local LLM**: All processing happens locally via Ollama

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Anthropic for Claude Code inspiration
- Ollama team for local LLM inference
- The open-source community

## 📚 Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

## 🆘 Support

- **Issues**: https://github.com/k5tuck/CC_Clone/issues
- **Discussions**: https://github.com/k5tuck/CC_Clone/discussions

---

**Made with ❤️ by the CC_Clone team**
