# Comprehensive UX/UI Improvements for Selek

This document outlines advanced UX/UI improvements beyond basic TUI enhancements, specifically tailored to Selek's multi-agent, knowledge-graph-powered architecture.

---

## Table of Contents
1. [Knowledge Graph Visualization](#1-knowledge-graph-visualization)
2. [Tool Usage Transparency](#2-tool-usage-transparency)
3. [Agent Collaboration Visualization](#3-agent-collaboration-visualization)
4. [Session & Conversation Management](#4-session--conversation-management)
5. [Onboarding & Discoverability](#5-onboarding--discoverability)
6. [Performance & Cost Tracking](#6-performance--cost-tracking)
7. [Error Handling & Recovery](#7-error-handling--recovery)
8. [Smart Context Awareness](#8-smart-context-awareness)
9. [Agent Marketplace & Templates](#9-agent-marketplace--templates)
10. [Advanced Search & Discovery](#10-advanced-search--discovery)
11. [Streaming & Real-time Feedback](#11-streaming--real-time-feedback)
12. [Accessibility & Customization](#12-accessibility--customization)

---

## 1. Knowledge Graph Visualization

### Current State
- ✅ Knowledge graph implemented (entities, relationships, queries)
- ❌ No visual representation of the graph
- ❌ Users can't see what the AI knows about their project
- ❌ No way to explore relationships visually

### Proposed Improvements

#### 1.1 Mini Graph View in TUI
**Priority: HIGH**

Display a compact ASCII art representation of the knowledge graph:

```
┌─ Knowledge Graph ─────────────────────────────┐
│                                               │
│    [AgentSystem.ts]                          │
│         │                                     │
│         ├─imports─> [OllamaClient]           │
│         ├─uses────> [KnowledgeGraph]         │
│         └─modifiedBy─> code-agent            │
│                                               │
│    Recent Discoveries:                        │
│    • AgentSystem depends on 3 files          │
│    • code-agent modified 5 files today       │
│    • New entity: research-agent              │
│                                               │
│    /kg-explore to see more                   │
└───────────────────────────────────────────────┘
```

**Commands:**
- `/kg` - Show knowledge graph summary
- `/kg-explore <entity>` - Explore entity relationships
- `/kg-path <from> <to>` - Find connections between entities
- `/kg-recent` - Show recently added entities
- `/kg-stats` - Show graph statistics

**Implementation:**
```typescript
interface KnowledgeGraphView {
  centerEntity: string;
  depth: number; // How many hops to show
  maxNodes: number; // Limit for TUI display
  filter?: EntityType[]; // Only show certain types
}

const renderGraphView = (view: KnowledgeGraphView): string => {
  // ASCII art graph rendering
  // Use box-drawing characters
  // Show relationships as arrows
};
```

#### 1.2 Interactive Graph Browser
**Priority: MEDIUM**

```
┌─ Graph Browser ──────────────────────────────┐
│ [←/→] Navigate  [↑/↓] Select  [Enter] Expand │
├──────────────────────────────────────────────┤
│                                               │
│  > 📄 src/lib/agents/AgentSystem.ts          │
│    ├─ 📦 Imports (3)                         │
│    │  ├─ EventEmitter                        │
│    │  ├─ gray-matter                         │
│    │  └─ SystematicAgentPrompts              │
│    ├─ 🔧 Used By (2)                         │
│    │  ├─ multiagent-tui.tsx                  │
│    │  └─ cli.ts                              │
│    ├─ ✏️  Modified By                         │
│    │  └─ code-agent (2h ago)                 │
│    └─ 🧪 Tests                               │
│       └─ None found (⚠️  create tests?)      │
│                                               │
│  [Press Enter to expand imports]             │
└───────────────────────────────────────────────┘
```

#### 1.3 Graph Query Language
**Priority: LOW**

Simple query syntax for exploring the graph:

```
> /kg-query "files modified by code-agent in last 24h"
> /kg-query "agents that use OllamaClient"
> /kg-query "path from AgentSystem.ts to KnowledgeGraph.ts"
```

---

## 2. Tool Usage Transparency

### Current State
- ✅ Tools are called automatically
- ✅ Basic logging in console
- ❌ User can't see WHAT tools are being used
- ❌ No visibility into tool parameters
- ❌ Can't see tool results inline

### Proposed Improvements

#### 2.1 Real-time Tool Call Display
**Priority: HIGH**

Show tools as they're called with clear visual indicators:

```
┌─ Agent Activity ────────────────────────────┐
│                                             │
│ 🤖 code-agent: Analyzing your request...   │
│                                             │
│ 🔧 Tool: readFile                          │
│    ├─ path: src/lib/agents/AgentSystem.ts │
│    └─ ✓ Success (1.2ms)                    │
│                                             │
│ 🔧 Tool: grep                              │
│    ├─ pattern: "class AgentSystem"        │
│    ├─ path: src/lib                        │
│    └─ ✓ Found 1 match (45ms)              │
│                                             │
│ 💭 Thinking: Found the AgentSystem class. │
│    Let me check its dependencies...        │
│                                             │
│ 🔧 Tool: queryKnowledgeGraph               │
│    ├─ entityId: AgentSystem.ts            │
│    ├─ relationshipType: imports           │
│    └─ ✓ Found 3 imports (5ms)             │
│                                             │
└─────────────────────────────────────────────┘
```

**Features:**
- Collapsible tool sections (hide details, show only names)
- Color coding by tool type (file ops = blue, search = green, KG = purple)
- Timing information for each tool
- Success/failure indicators
- Keyboard shortcut to toggle tool visibility

#### 2.2 Tool Usage Summary
**Priority: MEDIUM**

After each agent response, show a summary:

```
┌─ Tool Usage Summary ────────────────────────┐
│ 🔧 6 tools used • 234ms total               │
│ ├─ readFile (3x) - 67ms                    │
│ ├─ grep (2x) - 145ms                       │
│ └─ queryKnowledgeGraph (1x) - 22ms         │
│                                             │
│ 📊 Files accessed: 3 read, 0 written       │
│ 💾 Knowledge updated: 2 entities, 1 rel.   │
└─────────────────────────────────────────────┘
```

#### 2.3 Tool Call History
**Priority: LOW**

```
> /tools-history

Last 10 Tool Calls:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. readFile • AgentSystem.ts • 2s ago • ✓
2. grep • "class Agent" • 5s ago • ✓
3. writeFile • test.ts • 12s ago • ❌ (File not read)
4. bash • npm test • 1m ago • ✓
5. queryKnowledgeGraph • Files • 2m ago • ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> /tools-stats

Tool Usage Statistics (Current Session):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
readFile           ████████████ 12 calls
grep               ████████     8 calls
writeFile          ████         4 calls
queryKnowledgeGraph ███         3 calls
bash               ██           2 calls
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 3. Agent Collaboration Visualization

### Current State
- ✅ Multi-agent orchestration works
- ❌ No visibility into agent handoffs
- ❌ Can't see which agent is doing what
- ❌ No agent communication visualization

### Proposed Improvements

#### 3.1 Agent Pipeline View
**Priority: HIGH**

Show multiple agents working in sequence or parallel:

```
┌─ Agent Pipeline ────────────────────────────────┐
│                                                 │
│  [coordinator] → [research] → [code] → [test]  │
│       ✓            🔄           ⏳       ○       │
│                                                 │
│  Current: 🧪 research-agent                    │
│  Status: Gathering information from docs...    │
│  Progress: ████████████░░░░░░░░ 60%           │
│                                                 │
│  Next: 💻 code-agent will implement changes    │
│  Then: 🧪 test-agent will run validation       │
│                                                 │
│  /agents-pause to pause pipeline               │
└─────────────────────────────────────────────────┘
```

**Legend:**
- ✓ Completed
- 🔄 In Progress
- ⏳ Waiting
- ○ Pending

#### 3.2 Agent Communication Log
**Priority: MEDIUM**

Show messages between agents:

```
┌─ Agent Communication ───────────────────────┐
│                                             │
│ 08:23:15 coordinator → research-agent       │
│          "Find all authentication files"   │
│                                             │
│ 08:23:45 research-agent → code-agent        │
│          "Found 3 files: auth.ts, ..."     │
│          + Context: [KnowledgeGraph query] │
│                                             │
│ 08:24:10 code-agent → test-agent            │
│          "Modified auth.ts, run tests"     │
│          + Files: [auth.ts, auth.test.ts]  │
│                                             │
│ [Ctrl+A to see all messages]                │
└─────────────────────────────────────────────┘
```

#### 3.3 Agent Dependency Graph
**Priority: LOW**

Visual representation of which agents call which:

```
> /agents-graph

Agent Dependency Graph:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     coordinator
          │
     ┌────┴────┬────────┐
     │         │        │
  research   code    test
     │         │
     └─────────┘

Frequent Collaborations:
• coordinator + research (15 times)
• research + code (12 times)
• code + test (8 times)
```

---

## 4. Session & Conversation Management

### Current State
- ✅ Conversation history saved
- ❌ Can't easily switch between sessions
- ❌ No session metadata (tags, names, descriptions)
- ❌ Can't compare sessions

### Proposed Improvements

#### 4.1 Session Switcher
**Priority: HIGH**

Quick session switching with previews:

```
> /sessions

┌─ Active Sessions ───────────────────────────┐
│                                             │
│ > 1. Authentication Bug Fix (current)      │
│      Last active: 2m ago                   │
│      Messages: 15 • Agents: code, test     │
│      Tags: bug-fix, auth                   │
│                                             │
│   2. Implement Dark Mode                   │
│      Last active: 2h ago                   │
│      Messages: 8 • Agents: shadcn-ui       │
│      Tags: feature, ui                     │
│                                             │
│   3. Database Migration                    │
│      Last active: 1d ago                   │
│      Messages: 23 • Agents: coordinator    │
│      Tags: database, migration             │
│                                             │
│ [↑/↓] Navigate [Enter] Switch [D] Delete   │
│ [N] New Session [S] Search [T] By Tag      │
└─────────────────────────────────────────────┘
```

**Commands:**
- `/sessions` - List all sessions
- `/session-new <name>` - Create named session
- `/session-switch <id>` - Switch session
- `/session-tag <tag>` - Add tag to current session
- `/session-search <query>` - Search sessions

#### 4.2 Session Summary
**Priority: MEDIUM**

Automatic summarization of long sessions:

```
> /session-summary

Session: Authentication Bug Fix
Started: 2h ago • Duration: 1h 45m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
You asked me to fix the authentication bug where
users were being logged out unexpectedly. I:

1. Analyzed auth.ts and found session timeout issue
2. Modified the session handling logic
3. Updated tests to cover edge cases
4. Ran validation and all tests passed

Files Modified: 3
• src/lib/auth.ts (+45, -12)
• src/lib/session.ts (+23, -5)
• tests/auth.test.ts (+67, -0)

Agents Used:
• code-agent (2 executions, 45m)
• test-agent (1 execution, 15m)

Knowledge Gained:
• Session timeout was set to 15m (changed to 60m)
• Added new relationship: auth.ts → session.ts

Next Steps:
• Deploy to staging
• Monitor for 24h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 4.3 Session Templates
**Priority: LOW**

Pre-configured session types:

```
> /session-from-template

Available Templates:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 🐛 Bug Fix
   Agents: code-agent, test-agent
   Context: Always loads recent errors

2. ✨ Feature Development
   Agents: coordinator, code-agent, test-agent
   Context: Loads project structure

3. 📚 Documentation
   Agents: research-agent
   Context: Loads all README files

4. 🔍 Code Review
   Agents: code-agent
   Context: Loads git diff

Select template [1-4]:
```

---

## 5. Onboarding & Discoverability

### Current State
- ❌ No first-run experience
- ❌ Users must discover features manually
- ❌ No interactive tutorial
- ❌ Help system is basic

### Proposed Improvements

#### 5.1 Interactive Onboarding
**Priority: HIGH**

First-time user flow:

```
┌─ Welcome to Selek! ─────────────────────────┐
│                                             │
│  🎉 Let's get you started!                 │
│                                             │
│  Selek is a multi-agent AI framework that  │
│  helps you build with AI agents.           │
│                                             │
│  What would you like to do?                │
│                                             │
│  1. 🎓 Take the 5-minute tour              │
│  2. 🚀 Jump right in                       │
│  3. 📖 Read the documentation              │
│                                             │
│  [1/2/3 or Esc to skip]                    │
└─────────────────────────────────────────────┘
```

**Interactive Tutorial Steps:**
1. Basic chat interaction
2. Try an agent (`/agent code-agent help me`)
3. Create a custom agent
4. Use a tool
5. Check the knowledge graph
6. Switch models/providers

#### 5.2 Contextual Help
**Priority: MEDIUM**

Smart suggestions based on user behavior:

```
┌─ 💡 Tip ─────────────────────────────────────┐
│                                              │
│ I notice you're creating many agents.       │
│ Did you know you can:                       │
│                                              │
│ • Export agents as templates (/template-export)│
│ • Share templates with your team            │
│ • Browse community templates (/templates)   │
│                                              │
│ [Enter] Try it now  [Esc] Dismiss  [H] Don't show tips│
└──────────────────────────────────────────────┘
```

**Trigger Conditions:**
- Used same agent 5+ times → "Try creating a specialized version"
- Many file errors → "Check file safety validation guide"
- Long conversation → "You can create a new session"
- Never used KG → "Explore knowledge graph features"

#### 5.3 Command Discovery
**Priority: HIGH**

Better help system with examples:

```
> /help agents

Agent Commands
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/agents
  Show/hide agent list in sidebar

/agent <id> <task>
  Execute a specific agent with a task
  Example: /agent code-agent Review auth.ts

/agent-list
  List all available agents with details

/agent-create
  Launch interactive agent creation wizard
  💡 Tip: Agents are saved in ./agents/<id>/

/agent-view <id>
  View detailed agent information
  Example: /agent-view code-agent

/agent-delete <id>
  Delete an agent (requires confirmation)

/autosuggest
  Toggle agent auto-suggestions ON/OFF
  💡 When ON, I'll suggest the best agent for your task

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
See also: /help templates, /help all
```

#### 5.4 Feature Discovery Panel
**Priority: MEDIUM**

Highlight underutilized features:

```
┌─ 🌟 Features You Haven't Tried ─────────────┐
│                                             │
│ 📊 Knowledge Graph                         │
│    Explore how your project is connected   │
│    → Try: /kg or /kg-explore              │
│                                             │
│ 🔄 Provider Switching                      │
│    Use Claude, GPT, or local models        │
│    → Try: /providers                       │
│                                             │
│ 🎨 Agent Templates                         │
│    Reusable agent configurations           │
│    → Try: /templates                       │
│                                             │
│ [Space] Dismiss  [?] Learn more             │
└─────────────────────────────────────────────┘
```

---

## 6. Performance & Cost Tracking

### Current State
- ❌ No token usage tracking
- ❌ No cost estimates for cloud providers
- ❌ No performance metrics
- ❌ Can't see which operations are slow

### Proposed Improvements

#### 6.1 Real-time Metrics Dashboard
**Priority: HIGH**

```
┌─ Performance Metrics ───────────────────────┐
│                                             │
│ 📊 Current Session                         │
│ ├─ Duration: 1h 23m                        │
│ ├─ Messages: 47                            │
│ ├─ Tokens: 142.3k / 200k (71%)            │
│ └─ Est. Cost: $0.23 (Anthropic)           │
│                                             │
│ 🚀 Performance                             │
│ ├─ Avg Response: 2.3s                     │
│ ├─ Tool Calls: 156 (avg 234ms)            │
│ └─ Cache Hits: 78% (↓ cost 45%)           │
│                                             │
│ 💰 Cost Breakdown (Today)                  │
│ ├─ Input: 85k tokens ($0.12)              │
│ ├─ Output: 57k tokens ($0.34)             │
│ └─ Total: $0.46                            │
│                                             │
│ /metrics-detail for more info              │
└─────────────────────────────────────────────┘
```

**Toggle:** `/metrics` to show/hide

#### 6.2 Budget Alerts
**Priority: MEDIUM**

Proactive cost management:

```
┌─ ⚠️  Budget Alert ──────────────────────────┐
│                                             │
│ You're approaching your daily budget:      │
│                                             │
│ Daily Limit: $5.00                         │
│ Used Today: $4.32 (86%)                    │
│ Remaining: $0.68                           │
│                                             │
│ Suggestions:                                │
│ • Switch to Ollama (free, local)           │
│ • Use smaller model (gpt-3.5-turbo)        │
│ • Continue anyway                          │
│                                             │
│ Set budget: /budget-set <amount>           │
└─────────────────────────────────────────────┘
```

#### 6.3 Performance Profiling
**Priority: LOW**

Identify bottlenecks:

```
> /profile

Session Performance Profile
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Slowest Operations:
1. bash: npm test (45.2s)
2. readFile: large-file.json (2.3s)
3. grep: recursive search (1.8s)

Token Usage by Agent:
1. code-agent: 45.2k tokens (32%)
2. research-agent: 38.1k tokens (27%)
3. coordinator: 22.5k tokens (16%)

Tool Performance:
readFile     avg 145ms  (67 calls)
grep         avg 234ms  (23 calls)
bash         avg 3.2s   (8 calls)
writeFile    avg 89ms   (12 calls)

Recommendations:
• Consider caching npm test results
• Split large-file.json into smaller files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 7. Error Handling & Recovery

### Current State
- ✅ Custom error types
- ✅ Clear error messages
- ❌ No error recovery suggestions
- ❌ Can't undo failed operations
- ❌ No error patterns detection

### Proposed Improvements

#### 7.1 Smart Error Recovery
**Priority: HIGH**

Suggest fixes for common errors:

```
┌─ ❌ Error ──────────────────────────────────┐
│                                             │
│ FileNotReadError: File has not been read   │
│ yet. Read it first before writing to it.   │
│                                             │
│ File: src/config/settings.ts               │
│                                             │
│ 💡 What happened:                          │
│ The agent tried to modify a file without   │
│ reading it first. This is a safety feature │
│ to prevent accidental overwrites.          │
│                                             │
│ 🔧 How to fix:                             │
│ 1. Automatic: I can read the file and retry│
│    → Press [A] to auto-fix                 │
│                                             │
│ 2. Manual: Use this command:               │
│    /tool readFile src/config/settings.ts  │
│                                             │
│ 📚 Learn more: /help file-safety           │
└─────────────────────────────────────────────┘
```

#### 7.2 Undo/Rollback
**Priority: MEDIUM**

Reverse failed operations:

```
> Agent failed due to syntax error in generated code

┌─ 🔄 Rollback Available ─────────────────────┐
│                                             │
│ The last operation made changes that       │
│ caused errors. You can:                    │
│                                             │
│ 1. Rollback all changes (3 files)          │
│    → Press [R]                             │
│                                             │
│ 2. Rollback specific files                 │
│    → Press [S] to select                   │
│                                             │
│ 3. Keep changes and debug                  │
│    → Press [K]                             │
│                                             │
│ Changes made:                               │
│ • auth.ts (45 lines added)                 │
│ • session.ts (23 lines modified)           │
│ • config.ts (12 lines deleted)             │
│                                             │
└─────────────────────────────────────────────┘
```

#### 7.3 Error Pattern Detection
**Priority: LOW**

Learn from repeated errors:

```
┌─ 🔍 Pattern Detected ───────────────────────┐
│                                             │
│ You've encountered "Module not found"      │
│ errors 3 times in the last 10 minutes.     │
│                                             │
│ Common causes:                              │
│ 1. Missing npm install                     │
│    → Run: /tool bash npm install          │
│                                             │
│ 2. Incorrect import path                   │
│    → Check: /kg-explore <module-name>     │
│                                             │
│ 3. TypeScript configuration                │
│    → Verify: tsconfig.json paths          │
│                                             │
│ [Enter] Run diagnostics  [Esc] Dismiss     │
└─────────────────────────────────────────────┘
```

---

## 8. Smart Context Awareness

### Current State
- ✅ Project context loader
- ❌ No automatic context suggestions
- ❌ Can't see what context is loaded
- ❌ No context pruning for long sessions

### Proposed Improvements

#### 8.1 Context Inspector
**Priority: HIGH**

See what the AI knows:

```
> /context

┌─ Current Context ───────────────────────────┐
│                                             │
│ 📁 Project Context (loaded 2h ago)         │
│ ├─ Files scanned: 234                      │
│ ├─ Key files identified: 45                │
│ └─ Structure: src/, tests/, docs/          │
│                                             │
│ 💬 Conversation Context                    │
│ ├─ Messages: 47 (using 89k tokens)        │
│ ├─ Active since: 1h 23m ago                │
│ └─ Focus: Authentication system            │
│                                             │
│ 🧠 Knowledge Graph                         │
│ ├─ Entities: 156                           │
│ ├─ Relationships: 423                      │
│ └─ Last update: 2m ago                     │
│                                             │
│ 📋 Files in Context (top 5)                │
│ 1. auth.ts (referenced 12 times)           │
│ 2. session.ts (referenced 8 times)         │
│ 3. config.ts (referenced 5 times)          │
│ 4. user.ts (referenced 3 times)            │
│ 5. middleware.ts (referenced 2 times)      │
│                                             │
│ /context-refresh to reload                 │
│ /context-clear to reset                    │
└─────────────────────────────────────────────┘
```

#### 8.2 Auto-context Suggestions
**Priority: MEDIUM**

Suggest relevant context:

```
┌─ 💡 Context Suggestion ─────────────────────┐
│                                             │
│ You mentioned "database migration" but I   │
│ don't have your database schema loaded.    │
│                                             │
│ Would you like me to:                      │
│ 1. Load database files (schema/, migrations/)│
│ 2. Query knowledge graph for DB entities   │
│ 3. Continue without DB context             │
│                                             │
│ [1/2/3 to choose]                          │
└─────────────────────────────────────────────┘
```

#### 8.3 Context Pruning
**Priority: MEDIUM**

Manage context in long sessions:

```
┌─ ⚠️  Context Size Warning ──────────────────┐
│                                             │
│ This conversation is using 165k tokens     │
│ (82% of limit). Consider:                  │
│                                             │
│ 1. Start fresh session                     │
│    → Keeps summary of current work         │
│                                             │
│ 2. Summarize & compress                    │
│    → Reduces to ~50k tokens                │
│                                             │
│ 3. Remove old messages                     │
│    → Select which to keep                  │
│                                             │
│ 4. Continue anyway                         │
│    → May hit limits soon                   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 9. Agent Marketplace & Templates

### Current State
- ✅ Agent templates can be exported
- ❌ No marketplace or sharing
- ❌ No template ratings/reviews
- ❌ Hard to discover good agents

### Proposed Improvements

#### 9.1 Template Browser
**Priority: MEDIUM**

```
> /templates-browse

┌─ Agent Templates ───────────────────────────┐
│ [↑/↓] Navigate [Enter] Details [I] Install │
├─────────────────────────────────────────────┤
│                                             │
│ > 🔍 Code Reviewer Pro                     │
│   ⭐⭐⭐⭐⭐ (243 installs)                  │
│   Reviews code for best practices, bugs,   │
│   and security issues. Supports 15 langs.  │
│   Tags: code-review, security, quality     │
│                                             │
│   💻 Test Generator                        │
│   ⭐⭐⭐⭐☆ (156 installs)                   │
│   Generates comprehensive test suites      │
│   with edge cases and mocks.               │
│   Tags: testing, tdd, automation           │
│                                             │
│   📚 Documentation Writer                  │
│   ⭐⭐⭐⭐⭐ (189 installs)                  │
│   Creates clear, comprehensive docs        │
│   with examples and diagrams.              │
│   Tags: documentation, markdown            │
│                                             │
│ [S] Search [F] Filter [C] Categories       │
└─────────────────────────────────────────────┘
```

#### 9.2 Template Details
**Priority: MEDIUM**

```
> /template-view code-reviewer-pro

┌─ Template: Code Reviewer Pro ───────────────┐
│                                             │
│ 🔍 Code Reviewer Pro                       │
│ Version: 2.1.0 • Author: @devtools         │
│ ⭐⭐⭐⭐⭐ 4.8/5 (243 reviews)               │
│                                             │
│ Description:                                │
│ Professional code reviewer that checks for │
│ best practices, potential bugs, security   │
│ vulnerabilities, and suggests improvements.│
│                                             │
│ Features:                                   │
│ • Multi-language support (15 languages)    │
│ • Security vulnerability detection         │
│ • Performance optimization suggestions     │
│ • Style guide compliance                   │
│ • Automated fix suggestions                │
│                                             │
│ Requirements:                               │
│ • Node.js 18+                              │
│ • Knowledge graph enabled                  │
│                                             │
│ Recent Reviews:                             │
│ ⭐⭐⭐⭐⭐ "Best code reviewer I've used!"  │
│ ⭐⭐⭐⭐☆ "Good but needs Python support"    │
│                                             │
│ [I] Install [R] Read More [B] Back         │
└─────────────────────────────────────────────┘
```

#### 9.3 Template Collections
**Priority: LOW**

Curated sets of agents:

```
> /collections

Agent Collections
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Startup Starter Pack (5 agents)
   Everything to build an MVP fast
   → code-agent, test-agent, deploy-agent, ...

🔒 Security Toolkit (4 agents)
   Comprehensive security analysis
   → security-scanner, penetration-tester, ...

📱 Frontend Masters (6 agents)
   Build beautiful UIs
   → shadcn-expert, tailwind-pro, react-specialist, ...

🧪 Testing Suite (3 agents)
   Complete test coverage
   → unit-tester, e2e-tester, coverage-analyzer, ...

[Enter number to install collection]
```

---

## 10. Advanced Search & Discovery

### Current State
- ❌ No full-text search across conversations
- ❌ Can't find past solutions
- ❌ No semantic search

### Proposed Improvements

#### 10.1 Universal Search
**Priority: HIGH**

Search everything:

```
> /search "authentication bug"

┌─ Search Results ────────────────────────────┐
│                                             │
│ 📝 Conversations (3)                       │
│ ├─ Auth Bug Fix Session (2h ago)          │
│ │  ...user logged out unexpectedly...      │
│ ├─ JWT Implementation (1d ago)             │
│ │  ...authentication token validation...   │
│ └─ Login Flow Refactor (3d ago)            │
│    ...session authentication system...     │
│                                             │
│ 🤖 Agents (2)                              │
│ ├─ auth-specialist                         │
│ └─ security-auditor                        │
│                                             │
│ 📄 Files (5)                               │
│ ├─ src/lib/auth.ts                         │
│ ├─ src/middleware/auth.ts                  │
│ └─ docs/authentication.md                  │
│                                             │
│ 💡 Knowledge (12)                          │
│ ├─ Entity: AuthService                    │
│ ├─ Solution: JWT refresh token pattern    │
│ └─ Discovery: Session timeout fix          │
│                                             │
│ [Enter] to refine • [Tab] to cycle types  │
└─────────────────────────────────────────────┘
```

#### 10.2 Semantic Search
**Priority: MEDIUM**

Find by meaning, not keywords:

```
> /search-semantic "how do I prevent users from being logged out"

┌─ Similar Conversations ─────────────────────┐
│                                             │
│ 🎯 High Relevance (95%)                    │
│ "Authentication Bug Fix"                   │
│ Fixed session timeout issue that caused    │
│ unexpected logouts. Solution: increased    │
│ session duration and added refresh logic.  │
│ → 2h ago                                   │
│                                             │
│ 🎯 Medium Relevance (72%)                  │
│ "JWT Token Management"                     │
│ Implemented token refresh mechanism to     │
│ maintain user sessions.                    │
│ → 1d ago                                   │
│                                             │
│ 🎯 Low Relevance (45%)                     │
│ "User Session Tracking"                    │
│ Added session tracking in database.        │
│ → 3d ago                                   │
│                                             │
└─────────────────────────────────────────────┘
```

#### 10.3 Pattern Recognition
**Priority: LOW**

Find recurring patterns:

```
> /patterns

┌─ Discovered Patterns ───────────────────────┐
│                                             │
│ 🔁 Common Workflows                        │
│                                             │
│ 1. Bug Fix Pattern (used 12 times)        │
│    research → code → test → deploy         │
│    Avg time: 45m                           │
│                                             │
│ 2. Feature Development (used 8 times)      │
│    coordinator → research → code → test    │
│    Avg time: 2h 15m                        │
│                                             │
│ 3. Refactoring (used 5 times)              │
│    code → test → review                    │
│    Avg time: 1h 30m                        │
│                                             │
│ 💡 Tip: Save as template                  │
│ → /workflow-save bug-fix-pattern           │
└─────────────────────────────────────────────┘
```

---

## 11. Streaming & Real-time Feedback

### Current State
- ✅ Token streaming works
- ❌ No indication of what's happening during delays
- ❌ Can't see partial tool results
- ❌ No streaming for multi-step operations

### Proposed Improvements

#### 11.1 Enhanced Streaming Indicators
**Priority: HIGH**

Show what's happening during streaming:

```
┌─ Agent Response ────────────────────────────┐
│                                             │
│ Let me analyze the authentication system.. │
│                                             │
│ [⣾ Reading auth.ts...]                     │
│                                             │
│ I've found the issue in the session handl▊ │
│                                             │
│ ↓ 2.3k tokens • 3.4s • Thinking...         │
└─────────────────────────────────────────────┘
```

**Streaming States:**
- `[⣾ Reading...]` - File operation
- `[⣽ Searching...]` - Search operation
- `[⣻ Executing...]` - Bash command
- `[⢿ Querying...]` - Knowledge graph query
- `[⣷ Thinking...]` - LLM generation

#### 11.2 Partial Results
**Priority: MEDIUM**

Show tool results as they complete:

```
┌─ Running Tests ─────────────────────────────┐
│                                             │
│ $ npm test                                 │
│                                             │
│ ✓ auth.test.ts (12 tests) - 2.3s           │
│ ⣾ session.test.ts (running...)             │
│ ○ user.test.ts (pending)                   │
│ ○ middleware.test.ts (pending)             │
│                                             │
│ Tests: 12 passed, 0 failed (so far)        │
│ Time: 2.3s elapsed                         │
│                                             │
│ [Esc] to interrupt                         │
└─────────────────────────────────────────────┘
```

#### 11.3 Progress Estimation
**Priority: LOW**

Estimate time remaining:

```
┌─ Large Operation in Progress ───────────────┐
│                                             │
│ Analyzing entire codebase...               │
│                                             │
│ ████████████████████░░░░ 80%               │
│                                             │
│ Processed: 187/234 files                   │
│ Elapsed: 2m 15s                            │
│ Estimated remaining: 34s                   │
│                                             │
│ Current: src/lib/knowledge/KnowledgeGraph.ts│
│                                             │
└─────────────────────────────────────────────┘
```

---

## 12. Multimodal Input & File Handling

### Current State
- ❌ Text input only
- ❌ No clipboard image support
- ❌ No drag-and-drop files
- ❌ No screenshot capabilities
- ❌ Can't paste code with formatting

### Proposed Improvements

#### 12.1 Clipboard Image Pasting
**Priority: HIGH**

Paste images directly from clipboard:

```
> [User presses Ctrl+V with image in clipboard]

┌─ 📷 Image Pasted ───────────────────────────┐
│                                             │
│ screenshot_2024.png (1.2 MB)               │
│ Dimensions: 1920x1080                      │
│                                             │
│ [▓▓▓▓▓▓▓▓▓░░] Uploading... 85%            │
│                                             │
│ What would you like to do?                 │
│ 1. Analyze this image                      │
│ 2. Extract text (OCR)                      │
│ 3. Generate code from design               │
│ 4. Compare with another image              │
│ 5. Save to project                         │
│                                             │
│ Or just ask me about it!                   │
└─────────────────────────────────────────────┘

> What's in this screenshot?

I can see a login form with the following elements:
- Email input field
- Password input field
- "Remember me" checkbox
- "Sign in" button (blue, rounded corners)
...
```

**Implementation:**
```typescript
// Detect clipboard image
useInput((input, key) => {
  if (key.ctrl && input === 'v') {
    const clipboardContent = await clipboard.read();

    if (clipboardContent.type === 'image') {
      const tempPath = await saveImageTemp(clipboardContent);
      setState({ pendingImage: tempPath });
      // Trigger vision model (GPT-4V, Claude with vision)
    }
  }
});
```

#### 12.2 Drag and Drop Files
**Priority: MEDIUM**

Terminal file drop support (where supported):

```
> [User drags file into terminal]

┌─ 📎 File Dropped ───────────────────────────┐
│                                             │
│ 3 files detected:                          │
│ • error-log.txt (45 KB)                    │
│ • screenshot.png (2.1 MB)                  │
│ • config.json (3 KB)                       │
│                                             │
│ How can I help with these files?           │
│ > Analyze error log                        │
│   Extract data from config                 │
│   Review screenshot                        │
│   Compare files                            │
│   Custom action...                         │
│                                             │
└─────────────────────────────────────────────┘
```

#### 12.3 Rich Clipboard Support
**Priority: MEDIUM**

Handle different clipboard content types:

```
> [Ctrl+V with code from VS Code]

┌─ 📋 Code Pasted ────────────────────────────┐
│                                             │
│ TypeScript code detected (45 lines)        │
│ Language: TypeScript                       │
│ Syntax: ✓ Valid                            │
│                                             │
│ What would you like to do?                 │
│ 1. Review this code                        │
│ 2. Explain what it does                    │
│ 3. Find bugs                               │
│ 4. Optimize performance                    │
│ 5. Write tests                             │
│ 6. Save to file                            │
│                                             │
│ Or ask me anything about it!               │
└─────────────────────────────────────────────┘
```

**Supported Clipboard Types:**
- 📷 Images (PNG, JPG, GIF, WebP)
- 📝 Formatted code (with syntax highlighting)
- 📊 Tables (CSV, TSV, Excel paste)
- 🔗 URLs (auto-fetch and analyze)
- 📄 Files/paths
- 🎨 Design mockups

#### 12.4 Screenshot Integration
**Priority: LOW**

Built-in screenshot capture:

```
> /screenshot

┌─ 📸 Screenshot Mode ────────────────────────┐
│                                             │
│ Select screenshot type:                    │
│ 1. Full screen                             │
│ 2. Window selection                        │
│ 3. Area selection                          │
│ 4. Timed capture (5s delay)               │
│                                             │
│ [1-4 to select] [Esc to cancel]           │
└─────────────────────────────────────────────┘

> [User selects area]

✓ Screenshot captured!
→ Automatically attached to conversation
→ What should I analyze in this screenshot?
```

#### 12.5 File Reference System
**Priority: MEDIUM**

Quick file referencing:

```
> Can you review @auth.ts and compare it to @session.ts?

┌─ 📎 Files Referenced ───────────────────────┐
│ • auth.ts (234 lines)                      │
│ • session.ts (156 lines)                   │
│ ✓ Loaded into context                      │
└─────────────────────────────────────────────┘

Let me analyze both files...

[Agent reads and compares files]
```

**@ Syntax:**
- `@filename` - Reference file from project
- `@/path/to/file` - Absolute path reference
- `@clipboard` - Reference clipboard content
- `@last` - Reference last uploaded image/file

---

## 13. Permission & Trust System

### Current State
- ❌ No permission prompts for dangerous operations
- ❌ No trusted project paths
- ❌ No persistent permission preferences
- ❌ All operations require manual approval

### Proposed Improvements

#### 13.1 Smart Permission Prompts
**Priority: HIGH**

Multi-option permission system for sensitive operations:

```
┌─ ⚠️  Permission Required ───────────────────┐
│                                             │
│ Agent wants to run:                        │
│ $ npm install @anthropic-ai/sdk           │
│                                             │
│ This will modify package.json and install │
│ external dependencies.                     │
│                                             │
│ What would you like to do?                 │
│                                             │
│ [Y] Yes, allow this once                   │
│ [A] Yes, allow for this session            │
│ [T] Always trust npm install (this project)│
│ [N] No, deny this operation                │
│ [E] Edit command before running            │
│ [?] More info about this command           │
│                                             │
│ Press key to choose                        │
└─────────────────────────────────────────────┘
```

**Permission Levels:**
- **Once** - Single operation only
- **Session** - Until TUI closes/restarts
- **Project** - Always for this project path
- **Global** - Always for any project (dangerous!)

**Storage:**
```typescript
interface PermissionPreference {
  projectPath: string;
  operation: string; // e.g., "npm install", "rm", "bash"
  allowed: boolean;
  scope: 'once' | 'session' | 'project' | 'global';
  createdAt: Date;
  expiresAt?: Date;
}

// Stored in ~/.selek/permissions.json
```

#### 13.2 Trusted Projects
**Priority: HIGH**

Save and manage trusted project paths:

```
> [First time in new project]

┌─ 🔒 New Project Detected ───────────────────┐
│                                             │
│ Project: /Users/dev/my-awesome-app         │
│                                             │
│ This appears to be a new project.          │
│ Would you like to trust this directory?    │
│                                             │
│ ℹ️  Trusted projects:                      │
│ • Allow file operations without prompts    │
│ • Remember permission preferences          │
│ • Enable automatic context loading         │
│                                             │
│ Trust level:                                │
│ > [F] Full trust (minimal prompts)         │
│   [P] Partial trust (confirm dangerous ops)│
│   [R] Read-only (no file modifications)    │
│   [U] Untrusted (prompt for everything)    │
│                                             │
│ You can change this later with /trust      │
└─────────────────────────────────────────────┘
```

**Trust Levels:**
- **Full Trust** - Like your own project, minimal prompts
- **Partial Trust** - Confirm dangerous operations only
- **Read-Only** - Can read but not modify
- **Untrusted** - Prompt for every operation

**Stored Configuration:**
```json
{
  "trustedProjects": [
    {
      "path": "/Users/dev/my-project",
      "trustLevel": "full",
      "addedAt": "2024-01-15T10:30:00Z",
      "permissions": {
        "fileWrite": true,
        "fileDelete": false,
        "bashExecution": "prompt",
        "npmInstall": true
      }
    }
  ]
}
```

#### 13.3 Permission History
**Priority: MEDIUM**

Track and review past permission decisions:

```
> /permissions

┌─ Permission History ────────────────────────┐
│                                             │
│ Project: /Users/dev/my-project (Full Trust)│
│                                             │
│ Recent Decisions:                           │
│ ✓ npm install - Allowed (session)          │
│   2 minutes ago                             │
│                                             │
│ ✓ writeFile → auth.ts - Allowed (project)  │
│   15 minutes ago                            │
│                                             │
│ ✗ rm -rf node_modules - Denied             │
│   1 hour ago                                │
│   → Used safer: npm ci instead              │
│                                             │
│ [R] Revoke session permissions              │
│ [C] Clear history                           │
│ [E] Edit trust level                        │
└─────────────────────────────────────────────┘
```

#### 13.4 Dangerous Operation Warnings
**Priority: HIGH**

Extra warnings for high-risk operations:

```
┌─ 🚨 DANGEROUS OPERATION ────────────────────┐
│                                             │
│ Agent wants to DELETE files:               │
│ $ rm src/database/migrations/*.ts          │
│                                             │
│ ⚠️  This will permanently delete:          │
│ • 12 migration files                       │
│ • ~2,500 lines of code                     │
│                                             │
│ ⚠️  These files are tracked in git         │
│                                             │
│ 💡 Safer alternatives:                     │
│ • Move to backup folder instead            │
│ • Create git branch first                  │
│ • Archive before deleting                  │
│                                             │
│ Type "DELETE" to confirm:                  │
│ >                                          │
│                                             │
│ [Esc] Cancel                                │
└─────────────────────────────────────────────┘
```

**Dangerous Operations:**
- File deletion (`rm`, `del`)
- Mass operations (`rm -rf`, `git reset --hard`)
- Package installation (external code)
- Database operations (`DROP TABLE`, migrations)
- System commands (`shutdown`, `reboot`)
- Network operations (external APIs)

#### 13.5 Context-Aware Permissions
**Priority: MEDIUM**

Smarter prompts based on operation context:

```
┌─ 🤖 Smart Permission ───────────────────────┐
│                                             │
│ Agent wants to run tests:                  │
│ $ npm test                                 │
│                                             │
│ ℹ️  Context:                               │
│ • Tests last ran: 10 minutes ago (✓ passed)│
│ • No test files modified since             │
│ • Same command ran 3 times today           │
│                                             │
│ 💡 Recommendation: ALLOW                   │
│ Tests are safe and this is a repeat action │
│                                             │
│ [Y] Yes (auto-allow tests this session)    │
│ [N] No, skip tests                         │
│ [V] View test files first                  │
│                                             │
│ Quick approve: Press Space                 │
└─────────────────────────────────────────────┘
```

**Smart Factors:**
- Operation frequency (common = safer)
- Time since last run
- File changes since last run
- Git status (uncommitted changes = riskier)
- Project trust level
- Historical success rate

#### 13.6 Permission Templates
**Priority: LOW**

Pre-configured permission sets for different scenarios:

```
> /trust-template

┌─ Trust Templates ───────────────────────────┐
│                                             │
│ Choose a permission template:               │
│                                             │
│ > 🚀 Active Development                    │
│   Full file access, bash allowed, auto npm │
│   Best for: Your own projects              │
│                                             │
│   🔍 Code Review                           │
│   Read-only, no modifications, safe only   │
│   Best for: Reviewing external code        │
│                                             │
│   🧪 Experimentation                       │
│   Sandbox mode, isolated environment       │
│   Best for: Testing new libraries          │
│                                             │
│   🔒 Production Access                     │
│   Minimal permissions, confirm everything  │
│   Best for: Live systems                   │
│                                             │
│ [C] Custom template...                     │
└─────────────────────────────────────────────┘
```

#### 13.7 Revocation & Reset
**Priority: MEDIUM**

Easy way to reset permissions:

```
> /trust-revoke

┌─ Revoke Permissions ────────────────────────┐
│                                             │
│ What would you like to revoke?             │
│                                             │
│ [S] All session permissions (this run only)│
│     → 3 active session permissions          │
│                                             │
│ [P] Project trust (this directory)         │
│     → /Users/dev/my-project (Full Trust)   │
│                                             │
│ [A] All trusted projects                   │
│     → 5 trusted projects                    │
│                                             │
│ [R] Reset to defaults                      │
│     → Remove all custom permissions         │
│                                             │
│ [B] Back                                   │
└─────────────────────────────────────────────┘
```

---

## 14. Accessibility & Customization

### Current State
- ❌ No theme customization
- ❌ No color blindness support
- ❌ No keyboard shortcut customization
- ❌ No layout customization

### Proposed Improvements

#### 14.1 Theme System
**Priority: MEDIUM**

Customizable color schemes:

```
> /theme

┌─ Theme Selection ───────────────────────────┐
│                                             │
│ > Default (Current)                        │
│   Cyan accents, warm text                  │
│   [Preview showing current colors]         │
│                                             │
│   High Contrast                            │
│   Better for low-light environments        │
│   Bold colors, clear boundaries            │
│                                             │
│   Minimal                                  │
│   Reduced colors, focus on content         │
│   Grayscale with subtle accents            │
│                                             │
│   Colorblind-friendly                      │
│   Deuteranopia-optimized palette           │
│   Blue/orange instead of red/green         │
│                                             │
│   Custom                                   │
│   → /theme-customize                       │
│                                             │
└─────────────────────────────────────────────┘
```

#### 14.2 Keyboard Shortcuts
**Priority: MEDIUM**

Customizable key bindings:

```
> /shortcuts

┌─ Keyboard Shortcuts ────────────────────────┐
│ [Click to edit]                             │
├─────────────────────────────────────────────┤
│                                             │
│ Navigation                                  │
│ • Ctrl+T     Show/hide todos               │
│ • Ctrl+O     Show/hide thinking            │
│ • Ctrl+P     Command palette               │
│                                             │
│ Actions                                     │
│ • Ctrl+K     Clear input                   │
│ • Ctrl+L     Clear screen                  │
│ • Esc        Interrupt/Cancel              │
│                                             │
│ Agents                                      │
│ • Alt+A      Agent list                    │
│ • Alt+N      New agent                     │
│                                             │
│ [R] Reset to defaults                      │
│ [E] Edit shortcut                          │
└─────────────────────────────────────────────┘
```

#### 14.3 Layout Customization
**Priority: LOW**

Flexible panel layouts:

```
> /layout

┌─ Layout Options ────────────────────────────┐
│                                             │
│ > Classic (Current)                        │
│   ┌─────────┬──────────┐                   │
│   │  Chat   │  Sidebar │                   │
│   │         │  Agents  │                   │
│   │         │  Status  │                   │
│   └─────────┴──────────┘                   │
│                                             │
│   Focused                                  │
│   ┌──────────────────┐                     │
│   │      Chat        │                     │
│   │                  │                     │
│   │   (fullscreen)   │                     │
│   └──────────────────┘                     │
│                                             │
│   Dashboard                                │
│   ┌────────┬────────┬────────┐             │
│   │ Agents │  Chat  │  Graph │             │
│   │ Status │        │   KG   │             │
│   └────────┴────────┴────────┘             │
│                                             │
│ [S] Save custom layout                     │
└─────────────────────────────────────────────┘
```

---

## Implementation Priority Matrix

### Phase 1: Foundation (Weeks 1-2)
**Must Have - Immediate Impact**

1. ✅ **Tool Usage Transparency** - Real-time tool display
2. ✅ **Enhanced Status Line** - Token usage, timing
3. ✅ **Session Switcher** - Quick session management
4. ✅ **Context Inspector** - See what AI knows
5. ✅ **Universal Search** - Find anything fast
6. ✅ **Clipboard Image Pasting** - Ctrl+V for images
7. ✅ **Smart Permission System** - Multi-option prompts
8. ✅ **Trusted Projects** - Save trusted paths

### Phase 2: Visibility (Weeks 3-4)
**High Value - Enhances Core UX**

9. ✅ **Knowledge Graph Visualization** - Mini graph view
10. ✅ **Agent Pipeline View** - Multi-agent coordination
11. ✅ **Performance Metrics** - Token & cost tracking
12. ✅ **Smart Error Recovery** - Auto-fix suggestions
13. ✅ **Interactive Onboarding** - First-run experience
14. ✅ **Rich Clipboard Support** - Code, files, URLs
15. ✅ **Permission History** - Track decisions

### Phase 3: Advanced Features (Weeks 5-6)
**Nice to Have - Power User Features**

16. ⚠️ **Agent Communication Log** - See agent handoffs
17. ⚠️ **Template Browser** - Discover & share agents
18. ⚠️ **Semantic Search** - Find by meaning
19. ⚠️ **Undo/Rollback** - Reverse failed operations
20. ⚠️ **Theme System** - Customization options
21. ⚠️ **Drag and Drop** - File drop support
22. ⚠️ **Context-Aware Permissions** - Smart prompts

### Phase 4: Polish (Weeks 7-8)
**Future Enhancements**

23. 💡 **Pattern Recognition** - Learn workflows
24. 💡 **Graph Query Language** - Advanced KG queries
25. 💡 **Layout Customization** - Flexible panels
26. 💡 **Progress Estimation** - ETA for operations
27. 💡 **Template Collections** - Curated agent sets
28. 💡 **File Reference System** - @ syntax for files
29. 💡 **Screenshot Integration** - Built-in capture
30. 💡 **Permission Templates** - Pre-configured sets
31. 💡 **Permission Revocation** - Easy reset

---

## Success Metrics

### User Satisfaction
- ✅ Users can explain what Selek is doing at any moment
- ✅ 90% of errors self-resolve with suggestions
- ✅ Users discover features within first 5 minutes
- ✅ Session switching takes < 3 seconds

### Performance
- ✅ Tool calls visible within 50ms
- ✅ Context loading < 1 second
- ✅ Search results < 500ms
- ✅ No UI lag during streaming

### Engagement
- ✅ 80% of users explore knowledge graph
- ✅ 60% create custom agents
- ✅ 40% use multiple sessions
- ✅ 30% install community templates

---

## Technical Considerations

### Dependencies Needed
```json
{
  "ansi-escapes": "^5.0.0",       // Advanced terminal control
  "terminal-kit": "^3.0.0",       // Rich TUI components
  "blessed": "^0.1.81",           // Alternative UI framework
  "ink-table": "^3.0.0",          // Table components
  "ink-spinner": "^5.0.0",        // Better spinners
  "ink-gradient": "^3.0.0",       // Gradient text
  "chalk-animation": "^2.0.0",    // Animated text
  "clipboardy": "^3.0.0",         // Clipboard access
  "node-screenshots": "^0.1.0",   // Screenshot capture
  "sharp": "^0.32.0",             // Image processing
  "file-type": "^18.0.0",         // Detect file types
  "iterm2-version": "^4.1.0"      // iTerm2 image protocol
}
```

### State Management
- Consider Zustand or Redux for complex state
- Separate UI state from business logic
- Use React Context for theme/layout
- Persistent preferences in ~/.selek/config

### Performance Optimizations
- Virtual scrolling for long message lists
- Debounced renders for streaming
- Memoize expensive components
- Lazy load knowledge graph data

---

## Next Steps

1. **User Research**
   - Survey current users about pain points
   - A/B test new features
   - Gather feedback on mockups

2. **Prototype**
   - Build high-fidelity mockups
   - Test with 5-10 users
   - Iterate based on feedback

3. **Implement Phase 1**
   - Start with tool transparency
   - Add status line enhancements
   - Implement session switcher

4. **Measure & Iterate**
   - Track usage analytics
   - Monitor error rates
   - Gather qualitative feedback

---

**Built with user experience in mind** ✨
