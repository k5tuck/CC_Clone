# 🚀 Quick Start Guide

Get your CC_Clone multi-agent system up and running in 5 minutes!

## Step 1: Prerequisites Check

```bash
# Check Node.js version (need >= 18)
node -v

# Check if Ollama is installed
ollama --version

# Check if Ollama is running
curl http://localhost:11434/api/tags
```

## Step 2: Install Dependencies

```bash
# Clone the repo (if not already done)
git clone https://github.com/k5tuck/CC_Clone.git
cd CC_Clone

# Install packages
pnpm install
# or
npm install
```

## Step 3: Fix TypeScript Compilation Issues

The system is now fully configured! All TypeScript errors have been fixed:

- ✅ JSX support added to tsconfig.json
- ✅ `tui.tsx` excluded from build
- ✅ All import errors resolved
- ✅ Type safety improved

## Step 4: Pull an Ollama Model

```bash
# Recommended for coding tasks
ollama pull deepseek-coder:latest

# Or use llama3.1
ollama pull llama3.1:latest

# Or use codellama
ollama pull codellama:latest
```

## Step 5: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env to set your model
nano .env
```

Example `.env`:
```bash
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=deepseek-coder:latest
```

## Step 6: Create Prompt Templates

```bash
# Create templates directory
mkdir -p .claude/prompts

# Add your implementation agent template
# (Use the template from our earlier conversation)
nano .claude/prompts/implementation-agent.md
```

### Implementation Agent Template (Quick Version)

Create `.claude/prompts/implementation-agent.md`:

```markdown
You are an expert {DOMAIN} implementation planning agent.

Your role is to create detailed, production-ready implementation plans.

## Instructions

1. Read claude.md for project context
2. Create comprehensive plans with:
   - Clear implementation steps
   - Custom error handling classes
   - SOLID principles justification
   - Type safety requirements
   - Testing requirements
   - Rollback strategies

## Output Format

Generate a markdown plan with these sections:
- Context Summary
- Implementation Steps
- Error Handling Strategy
- Type Safety & Validation
- Testing Requirements
- Success Metrics
- Rollback Strategy

Remember: NO placeholders, TODOs, or ellipses!
```

### Security Agent Template

Create `.claude/prompts/security-agent.md`:

```markdown
You are an expert Application Security & Compliance agent.

Your role is to review implementations for security vulnerabilities.

## Focus Areas

1. OWASP Top 10 vulnerabilities
2. Authentication & Authorization
3. Data encryption
4. Input validation
5. SQL injection, XSS, CSRF
6. API security
7. Secrets management
8. Compliance (GDPR, PCI-DSS)

## Output Format

Generate a security review with:
- Threat Analysis
- Vulnerability Assessment
- Mitigation Strategies
- Security Testing Requirements
```

### Performance Agent Template

Create `.claude/prompts/performance-agent.md`:

```markdown
You are an expert Performance Analysis & Optimization agent.

Your role is to analyze and optimize system performance.

## Focus Areas

1. Performance baselines
2. Latency & throughput
3. Memory & CPU usage
4. Database optimization
5. Caching strategies
6. Load balancing
7. Async processing
8. Performance monitoring

## Output Format

Generate a performance analysis with:
- Performance Baseline
- Bottleneck Analysis
- Optimization Strategy
- Scalability Assessment
```

## Step 7: Build the Project

```bash
# Clean previous builds
npm run clean

# Build
npm run build
```

You should see:
```
✓ Successfully compiled X files
```

## Step 8: Start Ollama (if not running)

```bash
# In a separate terminal
ollama serve
```

## Step 9: Run Health Check

```bash
npm run cli health
```

Expected output:
```
✓ System is healthy
  Endpoint: http://localhost:11434
  Model: deepseek-coder:latest
```

## Step 10: Your First Agent!

### Simple Implementation Agent

```bash
npm run cli spawn \
  --task "Create a TypeScript function to validate email addresses" \
  --domain "TypeScript Development" \
  --agents "implementation"
```

### Multi-Agent (Sequential)

```bash
npm run cli spawn \
  --task "Build a REST API for user authentication" \
  --domain "Node.js Backend" \
  --agents "implementation,security"
```

### Multi-Agent (Parallel)

```bash
npm run cli spawn \
  --task "Create a payment processing module" \
  --domain "Backend Development" \
  --agents "implementation,security,performance" \
  --parallel
```

### With Auto-Execution

```bash
npm run cli spawn \
  --task "Create a simple TODO API with Express" \
  --domain "Node.js Backend" \
  --agents "implementation" \
  --auto-execute
```

## Step 11: View Results

```bash
# List all agents
npm run cli list

# Search for specific task
npm run cli search "authentication"

# View generated plan
cat plans/implementation/implementation-plan-*.md
```

## Step 12: Execute a Plan Manually

```bash
# Dry run first
npm run cli execute plans/implementation/implementation-plan-*.md --dry-run

# Real execution
npm run cli execute plans/implementation/implementation-plan-*.md
```

---

## Common Commands Reference

### Agent Management
```bash
# Initialize system
npm run cli init

# Spawn agents
npm run cli spawn -t "task" -d "domain" -a "agents"

# List agents
npm run cli list
npm run cli list --status completed
npm run cli list --status failed

# Search agents
npm run cli search "keyword"
```

### Plan Execution
```bash
# Execute plan
npm run cli execute <plan-file>

# Dry run
npm run cli execute <plan-file> --dry-run
```

### System Health
```bash
# Health check
npm run cli health

# Check Ollama models
ollama list
```

---

## Troubleshooting

### Issue: "Cannot find module"
```bash
npm run clean
npm install
npm run build
```

### Issue: "Ollama not responding"
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# In another terminal, pull model
ollama pull deepseek-coder:latest
```

### Issue: "Model not found"
```bash
# List available models
ollama list

# Pull the model you want
ollama pull llama3.1:latest

# Update .env
nano .env
# Set: OLLAMA_MODEL=llama3.1:latest
```

### Issue: TypeScript errors
```bash
# Ensure tsconfig.json has jsx: "react"
# Ensure tui.tsx is excluded in tsconfig.json

# Rebuild
npm run clean
npm run build
```

### Issue: "Permission denied"
```bash
chmod +x setup.sh
chmod -R 755 .claude plans
```

---

## Advanced Usage

### Custom Agent Domain
```bash
npm run cli spawn \
  --task "Optimize database queries" \
  --domain "PostgreSQL Database Optimization" \
  --agents "performance"
```

### Multiple Domains
```bash
# Frontend
npm run cli spawn \
  --task "Create React component library" \
  --domain "React Frontend Development" \
  --agents "implementation"

# Backend
npm run cli spawn \
  --task "Build GraphQL API" \
  --domain "Node.js GraphQL Backend" \
  --agents "implementation,security"
```

### Git Integration (with git tools)
```bash
# The agents can now use Git tools:
# - gitStatus
# - gitDiff
# - gitLog
# - gitBranch
# - gitAdd
# - gitCommit
# - gitCreateBranch
```

### HTTP/API Tools
```bash
# Agents can make HTTP requests:
# - httpGet
# - httpPost
# - httpPut
# - httpDelete
```

---

## What's New (Latest Updates)

✅ **Fixed all TypeScript compilation errors**
✅ **Added Security Agent** - OWASP Top 10 analysis
✅ **Added Performance Agent** - Performance optimization
✅ **Added Git Tools** - Full git integration
✅ **Added HTTP Tools** - API request capabilities
✅ **Added Conversation Persistence** - Save/resume conversations
✅ **Added Streaming Responses** - Real-time LLM output
✅ **Added Parallel Execution** - Run agents concurrently
✅ **Improved Error Handling** - Custom exception classes everywhere

---

## Next Steps

1. **Create more specialized agents** - Testing, Documentation, DevOps
2. **Add web UI** - React frontend for visual interaction
3. **Agent memory** - Learn from previous executions
4. **Plan templates** - Reusable plan patterns
5. **CI/CD integration** - Run agents in pipelines

---

## Getting Help

- **Documentation**: See README.md
- **Issues**: https://github.com/k5tuck/CC_Clone/issues
- **Discussions**: https://github.com/k5tuck/CC_Clone/discussions

---

**You're all set! 🎉**

Start building amazing things with your multi-agent system!
