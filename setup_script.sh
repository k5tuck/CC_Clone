#!/bin/bash

set -e

echo "🚀 CC_Clone Multi-Agent Setup Script"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo "📦 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js >= 18.0.0 from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version is too old (need >= 18.0.0)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) found${NC}"

# Check if pnpm or npm is available
if command -v pnpm &> /dev/null; then
    PKG_MANAGER="pnpm"
    echo -e "${GREEN}✓ pnpm found${NC}"
elif command -v npm &> /dev/null; then
    PKG_MANAGER="npm"
    echo -e "${GREEN}✓ npm found${NC}"
else
    echo -e "${RED}❌ No package manager found${NC}"
    exit 1
fi

# Check if Ollama is installed
echo ""
echo "🤖 Checking Ollama installation..."
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}⚠️  Ollama is not installed${NC}"
    echo ""
    echo "To install Ollama:"
    echo "  macOS:   brew install ollama"
    echo "  Linux:   curl -fsSL https://ollama.com/install.sh | sh"
    echo "  Windows: Download from https://ollama.com/download"
    echo ""
    read -p "Continue without Ollama? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ Ollama found${NC}"
    
    # Check if Ollama is running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama is running${NC}"
        
        # List available models
        MODELS=$(ollama list | tail -n +2 | awk '{print $1}')
        if [ -z "$MODELS" ]; then
            echo -e "${YELLOW}⚠️  No models installed${NC}"
            echo ""
            echo "Recommended models:"
            echo "  ollama pull llama3.1:latest"
            echo "  ollama pull codellama:latest"
            echo ""
            read -p "Pull llama3.1:latest now? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                ollama pull llama3.1:latest
            fi
        else
            echo -e "${GREEN}✓ Available models:${NC}"
            echo "$MODELS" | sed 's/^/    /'
        fi
    else
        echo -e "${YELLOW}⚠️  Ollama is not running${NC}"
        echo "Start Ollama with: ollama serve"
    fi
fi

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p .claude/prompts
mkdir -p plans
echo -e "${GREEN}✓ Directories created${NC}"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "⚙️  Creating .env file..."
    cat > .env << 'EOF'
# Ollama Configuration
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3.1:latest

# Agent Configuration
AGENT_HOME=~/.local-agent
MAX_ITERATIONS=10

# Output Directories
PLANS_DIR=./plans
TEMPLATES_DIR=./.claude/prompts

# Execution Settings
AUTO_EXECUTE=false
DRY_RUN=false
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists (skipping)${NC}"
fi

# Create implementation agent template if it doesn't exist
if [ ! -f .claude/prompts/implementation-agent.md ]; then
    echo ""
    echo "📝 Creating implementation agent template..."
    echo "⚠️  You need to add your agent prompt template to:"
    echo "    .claude/prompts/implementation-agent.md"
    echo ""
    echo "Use the template from the earlier conversation."
    touch .claude/prompts/implementation-agent.md
    echo -e "${YELLOW}⚠️  Template placeholder created${NC}"
else
    echo -e "${GREEN}✓ Implementation agent template exists${NC}"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
$PKG_MANAGER install

# Build the project
echo ""
echo "🔨 Building project..."
$PKG_MANAGER run build

# Link CLI globally (optional)
echo ""
read -p "Link CLI globally for 'local-agent' command? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm link
    echo -e "${GREEN}✓ CLI linked globally${NC}"
    CLI_COMMAND="local-agent"
else
    CLI_COMMAND="$PKG_MANAGER cli"
fi

# Run health check
echo ""
echo "🏥 Running health check..."
if $CLI_COMMAND health 2>/dev/null; then
    echo -e "${GREEN}✓ System is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed (this is normal if Ollama isn't running)${NC}"
fi

# Print success message
echo ""
echo "=================================="
echo -e "${GREEN}✅ Setup complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start Ollama (if not running):"
echo "   ollama serve"
echo ""
echo "2. Pull a model (if needed):"
echo "   ollama pull llama3.1:latest"
echo ""
echo "3. Add your agent prompt template to:"
echo "   .claude/prompts/implementation-agent.md"
echo ""
echo "4. Run a health check:"
echo "   $CLI_COMMAND health"
echo ""
echo "5. Try spawning an agent:"
echo "   $CLI_COMMAND spawn \\"
echo "     --task \"Create a simple Express server\" \\"
echo "     --domain \"Node.js Backend\" \\"
echo "     --agents \"implementation\""
echo ""
echo "📚 See README.md for more information"
echo ""
