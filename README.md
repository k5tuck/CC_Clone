# Local-Agent-TS
A TypeScript-based local Claude-style Agent framework with file & bash tools, CLI, Docker setup, and Postgres/MongoDB backends.

## What this repo includes
- TypeScript agent server (Express) and a CLI.
- Tool functions: `readFile`, `writeFile`, `searchFiles`, `blobSearch`, `bashExec`.
- Dockerfile and `docker-compose.yml` with Postgres and MongoDB for reproducible local dev.
- `README` with instructions for macOS (Apple Silicon).

---

## Quick answer to your first question
**Q:** Is there any way to upload and run the file every time the CLI opens? Do I need a custom CLI?  
**A:** You do NOT strictly need a custom CLI if you only want a script to run when your shell opens — you can add a shell command to your shell startup file (`~/.zshrc` or `~/.zprofile`) to run a script or to launch the CLI. Typical options:

1. **Run on every new shell session (simple):** add a command to `~/.zshrc`:
   ```bash
   # ~/.zshrc
   # run the local-agent CLI when opening a new shell (non-blocking)
   (cd /path/to/local-agent-ts && pnpm cli) &
   ```
   This will run `pnpm cli` every time a new shell opens; it starts in background — not ideal for heavy tasks.

2. **Per-directory auto-run:** use `direnv` to run environment-specific scripts when you `cd` into a project directory. This is safer and more controlled.

3. **Create a lightweight global CLI:** this repo includes a CLI target (`local-agent`) that can be installed globally via `npm link` or `pnpm link`. Then you can call it explicitly or add a shell alias/function.

4. **Terminal-level startup command:** tools like iTerm2 and macOS Terminal allow you to set a command to run for new windows/tabs.

5. **Launch at login (macOS, background service):** use `launchd` (`~/Library/LaunchAgents`) to run a background process on login.

**Recommendation:** Create the small Node CLI (provided) and install it globally with `pnpm link` or `npm link`. Use `direnv` for per-project auto-run or explicitly invoke `local-agent` from your terminal. Avoid running heavy processes on every shell open.

---

## Setup (macOS — Apple Silicon / M4 Max)
These commands assume a fresh macOS environment.

1. **Install Homebrew (if needed):**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. **Install Node (use brew-managed node) and pnpm:**
```bash
brew install node
npm install -g pnpm
```

3. **Install TypeScript & dev tools**
```bash
pnpm install
pnpm build
```

4. **Local LLM options (Apple Silicon):**
- **Ollama** or **LM Studio** provide native Apple Silicon support for local inference. Install per their docs; both expose HTTP endpoints you can call from the agent.
- Alternatively, use a containerized LLM runtime (if available) or a remote LLM endpoint and set `LLM_ENDPOINT` in `.env`.

Set `LLM_ENDPOINT` in `.env` (example provided in `.env.example`).

---

## Install & Run Locally (dev)
1. Clone:
```bash
git clone <this-repo> local-agent-ts
cd local-agent-ts
pnpm install
```

2. Run dev server (uses ts-node-dev):
```bash
pnpm dev
# server listening on http://localhost:3000
```

3. Try prompt:
```bash
curl -X POST http://localhost:3000/prompt -H "Content-Type: application/json" -d '{"prompt":"Show me files matching package.json"}'
```

4. Use CLI:
```bash
pnpm cli
# or after `pnpm build` and `pnpm link`:
npm link
local-agent
```

---

## Docker & Reproducibility
You can build and run the app and databases via docker-compose:
```bash
docker compose up --build
```
This will bring up:
- `local-agent-app` (container)
- `postgres` (postgres:15)
- `mongo` (mongo:6)

The Node container mounts the repo — for production, build artifacts in the image.

---

## Integrations
### Cursor & Code Integration
- Cursor or VS Code can be connected to this local codebase. Open the folder in the editor.
- Use the CLI or integrated terminal to run `pnpm dev`.
- Add editor tasks to run the server or tests.

### Database usage
- Postgres: `postgres://agent:agentpass@localhost:5432/agentdb`
- Mongo: default on `mongodb://localhost:27017`
- Both services are exposed on the host via `docker-compose.yml`.

---

## Security Notes
- `bashExec` uses a simple blacklist; **this is not secure** for multi-user or production environments.
- Running arbitrary shell commands from an LLM is risky — restrict tools and require explicit human approval in prod.
- Consider sandboxing with containers or a restricted user.

---

## Extending / Next steps
- Add authentication and tool permissioning.
- Implement an LLM adapter to produce structured tool-calls (JSON schema).
- Add persistent tool call logs to Postgres and vector memory storage (e.g., Milvus or Pinecone).

---

## Files of interest
- `src/lib/agent.ts` — core orchestration
- `src/lib/tools.ts` — tools (read/write/search/bash)
- `src/cli.ts` — interactive CLI
- `docker-compose.yml` — Postgres + Mongo + app
- `Dockerfile` — Node Dockerfile

---

Happy to refine any part of this project or produce a variant for full Rust/Go/Python backends.
