# Selek Conversational TUI - Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- pnpm or npm
- Ollama running locally (or remote endpoint)

### 1. Install Dependencies

```bash
# Navigate to your Selek directory
cd Selek

# Install new dependencies
pnpm install ink ink-text-input ink-spinner ink-box chalk better-sqlite3 uuid node-fetch

# Or with npm
npm install ink ink-text-input ink-spinner ink-box chalk better-sqlite3 uuid node-fetch

# Install types
pnpm install -D @types/node @types/react
```

### 2. File Setup

Create the following directory structure:

```bash
mkdir -p src/lib/streaming
mkdir -p src/lib/history
mkdir -p src/tui/components
mkdir -p src/tui/integration
```

### 3. Add the Files

Copy the following files from the artifacts to your project:

**Streaming Components:**
- `StreamingClient.ts` → `src/lib/streaming/StreamingClient.ts`
- `ResponseBuffer.ts` → `src/lib/streaming/ResponseBuffer.ts`

**History Management:**
- `ConversationHistoryManager.ts` → `src/lib/history/ConversationHistoryManager.ts`

**Integration:**
- `OrchestratorBridge.ts` → `src/tui/integration/OrchestratorBridge.ts`

**Main TUI:**
- `conversational-tui.tsx` → `src/tui/conversational-tui.tsx`

### 4. Update package.json

Add new scripts:

```json
{
  "scripts": {
    "tui": "tsx src/tui/conversational-tui.tsx",
    "tui:classic": "tsx src/tui.tsx",
    "tui:dev": "tsx watch src/tui/conversational-tui.tsx"
  }
}
```

### 5. Configure Environment

Make sure your `.env` file has:

```bash
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3.1:latest
```

### 6. Run!

```bash
# Start the conversational TUI
pnpm tui

# Or with npm
npm run tui
```

---

## 🎯 Usage

### Basic Interaction

1. **Chat naturally:**
   ```
   You: What is TypeScript?
   Assistant: [Streams response...]
   ```

2. **Request tasks:**
   ```
   You: Implement a user authentication system
   Assistant: 🤖 Analyzing task and coordinating agents...
   ```

3. **Use commands:**
   ```
   You: /help
   Assistant: [Shows help text]
   ```

### Available Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/agents` | List active agents |
| `/clear` | Clear conversation history |
| `/stats` | Show statistics |
| `/export [format]` | Export conversation (json, markdown, txt) |

### Tips

- **Streaming responses** appear token-by-token with a cursor (▊)
- **Press Enter** to send your message
- **Ctrl+C** to exit at any time
- Messages are automatically saved to conversation history
- Context is maintained across the conversation

---

## 🔧 Troubleshooting

### "Connection failed" error
- Ensure Ollama is running: `ollama serve`
- Check OLLAMA_ENDPOINT in your .env file
- Test with: `curl http://localhost:11434/api/tags`

### "Module not found" errors
- Run `pnpm install` again
- Check that all files are in correct locations
- Verify tsconfig.json includes proper paths

### Streaming not working
- Check Ollama model is downloaded: `ollama list`
- Pull model if needed: `ollama pull llama3.1:latest`
- Try with a smaller model: `ollama pull llama3.1:8b`

### TypeScript errors
- Update paths in tsconfig.json:
  ```json
  {
    "compilerOptions": {
      "paths": {
        "@/*": ["./src/*"]
      }
    }
  }
  ```

---

## 🎨 Customization

### Change Theme Colors

Edit `src/tui/conversational-tui.tsx`:

```typescript
// Change user message color
<Text color="cyan">  // Try: green, blue, magenta, yellow

// Change assistant message color
<Text color="white">  // Try: cyan, green, blue

// Change streaming cursor
<Text color="cyan">▊</Text>  // Try: yellow, green, blue
```

### Adjust Streaming Speed

Edit `src/lib/streaming/ResponseBuffer.ts`:

```typescript
constructor(options: {
  flushInterval?: number;  // Lower = faster (default: 50ms)
  minChunkSize?: number;   // Higher = chunkier (default: 10)
  maxDelay?: number;       // Lower = more responsive (default: 100ms)
} = {})
```

### Change Context Window

Edit `src/lib/history/ConversationHistoryManager.ts`:

```typescript
async getContext(conversationId: string, maxTokens: number = 8000) {
  // Increase for longer context: 16000, 32000, etc.
}
```

---

## 🧪 Testing

### Test Streaming
```typescript
// Test with a simple question
"What is 2+2?"

// Should see tokens appear one by one
```

### Test Task Detection
```typescript
// Should trigger agent coordination
"Implement a login form"
"Create a database schema"
"Optimize this function"
```

### Test Commands
```bash
/help       # Shows help
/agents     # Lists agents
/stats      # Shows statistics
/export md  # Exports conversation
```

---

## 📊 Performance Tuning

### For Slower Machines
```bash
# Use smaller model
OLLAMA_MODEL=llama3.1:8b pnpm tui

# Reduce buffer interval
# Edit ResponseBuffer constructor:
flushInterval: 100  // Instead of 50
```

### For Faster Machines
```bash
# Use larger model
OLLAMA_MODEL=llama3.1:70b pnpm tui

# Decrease buffer interval
flushInterval: 25  // For snappier responses
```

---

## 🔄 Migration from Old TUI

### Keep Both Versions

The old menu-based TUI is preserved:

```bash
# Run new conversational TUI
pnpm tui

# Run classic menu TUI
pnpm tui:classic
```

### Migrate Conversations

```typescript
// Coming soon: Migration tool
pnpm migrate:conversations
```

---

## 📚 Next Steps

### Phase 2: Enhanced UI (Optional)
- [ ] Add syntax highlighting for code blocks
- [ ] Add file preview for tool operations
- [ ] Add progress bars for long operations
- [ ] Add multi-line input support

### Phase 3: Advanced Features (Optional)
- [ ] SQLite persistence (replace in-memory)
- [ ] Full-text search in history
- [ ] Export with syntax highlighting
- [ ] Conversation branching

---

## 🐛 Known Issues

1. **Input backspace on some terminals:** May not render correctly
   - Workaround: Use Ctrl+W to delete words

2. **Very long messages:** May cause layout issues
   - Workaround: Messages automatically truncate at display time

3. **Rapid typing:** May miss characters on slow terminals
   - Workaround: Type at normal pace or increase buffer size

---

## 💡 Pro Tips

1. **Start conversations with context:**
   ```
   "I'm working on a TypeScript project with Express and MongoDB..."
   ```

2. **Be specific with tasks:**
   ```
   "Implement a JWT authentication system with refresh tokens"
   ```
   Instead of:
   ```
   "Make auth"
   ```

3. **Use commands efficiently:**
   ```
   /agents              # Quick check on active agents
   /stats               # Monitor conversation growth
   /export markdown     # Save important conversations
   ```

4. **Chain tasks naturally:**
   ```
   You: Create a user model
   Assistant: [Creates model]
   You: Now add validation
   Assistant: [Adds validation]
   ```

---

## 🆘 Support

- **GitHub Issues:** https://github.com/k5tuck/Selek/issues
- **Documentation:** See README.md and Claude.md
- **Discussions:** GitHub Discussions tab

---

**Happy Coding! 🚀**