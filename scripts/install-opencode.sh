#!/bin/bash
#
# Diverga OpenCode Installer v10.3.0
# Installs Diverga for OpenCode with MCP server support
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/HosungYou/Diverga/main/scripts/install-opencode.sh | bash
#

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

REPO_URL="https://github.com/HosungYou/Diverga.git"
DEST_DIR="$HOME/.config/opencode/plugins/diverga"
CONFIG_DIR="$HOME/.config/opencode"
OPENCODE_DIR="$HOME/.opencode"

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          Diverga Installer for OpenCode v10.3.0              ║"
echo "║          44 agents · MCP integration · Human checkpoints     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Clone repository
echo -e "${BLUE}[INFO]${NC} Cloning Diverga repository..."
TMP_DIR="/tmp/diverga-opencode-$$"
git clone --depth 1 "$REPO_URL" "$TMP_DIR" 2>/dev/null

PLUGIN_SRC="$TMP_DIR/.opencode/plugins/diverga"

# Check source exists
if [ ! -d "$PLUGIN_SRC" ]; then
    echo -e "${RED}[!]${NC} OpenCode plugin not found in repository"
    rm -rf "$TMP_DIR"
    exit 1
fi

# Step 1: Install plugin
echo -e "${BLUE}[1/4]${NC} Installing plugin to $DEST_DIR..."
mkdir -p "$DEST_DIR"

# Try to build if npm is available
if command -v npm &> /dev/null; then
    echo -e "${BLUE}[INFO]${NC} Building TypeScript plugin..."
    cd "$PLUGIN_SRC"

    if npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null; then
        # Copy compiled files + source
        cp -r "$PLUGIN_SRC/dist/"* "$DEST_DIR/" 2>/dev/null || true
        cp "$PLUGIN_SRC/package.json" "$DEST_DIR/" 2>/dev/null || true
        # Also copy source for reference
        mkdir -p "$DEST_DIR/hooks"
        cp -r "$PLUGIN_SRC/hooks/"*.ts "$DEST_DIR/hooks/" 2>/dev/null || true
        cp -r "$PLUGIN_SRC/"*.ts "$DEST_DIR/" 2>/dev/null || true
        echo -e "${GREEN}[✓]${NC} TypeScript build successful"
    else
        echo -e "${YELLOW}[!]${NC} Build failed, copying source files..."
        cp -r "$PLUGIN_SRC/"* "$DEST_DIR/"
    fi
else
    echo -e "${YELLOW}[!]${NC} npm not found, copying source files..."
    cp -r "$PLUGIN_SRC/"* "$DEST_DIR/"
fi

# Step 2: Copy MCP server files
echo -e "${BLUE}[2/4]${NC} Installing MCP servers..."
MCP_SRC="$TMP_DIR/mcp"
MCP_DEST="$DEST_DIR/mcp"

if [ -d "$MCP_SRC" ]; then
    mkdir -p "$MCP_DEST"
    cp "$MCP_SRC/diverga-server.js" "$MCP_DEST/" 2>/dev/null || true
    cp "$MCP_SRC/journal-server.js" "$MCP_DEST/" 2>/dev/null || true
    cp "$MCP_SRC/agent-prerequisite-map.json" "$MCP_DEST/" 2>/dev/null || true
    cp "$MCP_SRC/package.json" "$MCP_DEST/" 2>/dev/null || true

    # Copy subdirectories
    if [ -d "$MCP_SRC/servers" ]; then
        cp -r "$MCP_SRC/servers" "$MCP_DEST/"
    fi
    if [ -d "$MCP_SRC/lib" ]; then
        cp -r "$MCP_SRC/lib" "$MCP_DEST/"
    fi

    # Install MCP dependencies
    if command -v npm &> /dev/null; then
        cd "$MCP_DEST" && npm install --silent 2>/dev/null || true
    fi

    echo -e "${GREEN}[✓]${NC} MCP servers installed (diverga + journal)"
else
    echo -e "${YELLOW}[!]${NC} MCP server source not found, skipping"
fi

# Step 3: Copy root configuration files
echo -e "${BLUE}[3/4]${NC} Installing configuration files..."

# oh-my-opencode.json → ~/.config/opencode/
if [ -f "$TMP_DIR/.opencode/oh-my-opencode.json" ]; then
    mkdir -p "$CONFIG_DIR"
    cp "$TMP_DIR/.opencode/oh-my-opencode.json" "$CONFIG_DIR/oh-my-opencode.json"
    echo -e "${GREEN}[✓]${NC} oh-my-opencode.json installed"
elif [ -f "$TMP_DIR/adapters/oh-my-opencode.template.json" ]; then
    mkdir -p "$CONFIG_DIR"
    cp "$TMP_DIR/adapters/oh-my-opencode.template.json" "$CONFIG_DIR/oh-my-opencode.json"
    echo -e "${GREEN}[✓]${NC} oh-my-opencode.json installed (from template)"
fi

# opencode.jsonc → ~/.opencode/ (MCP server configuration)
if [ -f "$TMP_DIR/.opencode/opencode.jsonc" ]; then
    mkdir -p "$OPENCODE_DIR"
    cp "$TMP_DIR/.opencode/opencode.jsonc" "$OPENCODE_DIR/opencode.jsonc"
    echo -e "${GREEN}[✓]${NC} opencode.jsonc installed (MCP server config)"
fi

# Step 4: Verify installation
echo -e "${BLUE}[4/4]${NC} Verifying installation..."
ERRORS=0

if [ ! -f "$DEST_DIR/package.json" ]; then
    echo -e "${YELLOW}[!]${NC} Plugin package.json missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "$MCP_DEST" ] && [ -f "$MCP_DEST/diverga-server.js" ]; then
    echo -e "${GREEN}[✓]${NC} MCP: diverga-server.js present"
else
    echo -e "${YELLOW}[!]${NC} MCP: diverga-server.js missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "$MCP_DEST" ] && [ -f "$MCP_DEST/journal-server.js" ]; then
    echo -e "${GREEN}[✓]${NC} MCP: journal-server.js present"
else
    echo -e "${YELLOW}[!]${NC} MCP: journal-server.js missing"
    ERRORS=$((ERRORS + 1))
fi

# Cleanup
rm -rf "$TMP_DIR"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}[✓] Installation complete! All components verified.${NC}"
else
    echo -e "${YELLOW}[!] Installation complete with $ERRORS warning(s).${NC}"
fi

echo ""
echo "Components installed:"
echo "  Plugin:     $DEST_DIR"
echo "  MCP:        $MCP_DEST"
echo "  Config:     $CONFIG_DIR/oh-my-opencode.json"
echo "  MCP Config: $OPENCODE_DIR/opencode.jsonc"
echo ""
echo "Usage:"
echo "  opencode \"diverga:list\"           # List all 44 agents"
echo "  opencode \"diverga:setup\"          # Initialize research project"
echo "  opencode \"diverga:help\"           # Show help guide"
echo "  opencode \"diverga:memory status\"  # Check memory system"
echo ""
echo "MCP Servers (auto-start via opencode.jsonc):"
echo "  diverga   — 16 tools (checkpoint, memory, comm)"
echo "  journal   — 6 tools (OpenAlex + Crossref)"
echo "  humanizer — 4 tools (G5/G6/F5 pipeline)"
echo "  context7  — Documentation lookup"
echo ""
echo "Documentation: https://github.com/HosungYou/Diverga"
