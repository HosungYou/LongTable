---
name: diverga
description: |
  Diverga Dashboard - Live configuration status and feature overview.
  24 specialized agents across 9 categories for social science research.
  VS methodology prevents mode collapse. Human checkpoints enforce human-in-the-loop decisions.
  Triggers: /diverga, diverga dashboard, diverga status
version: "12.0.2"
---

# Diverga Dashboard

When the user runs `/diverga` (the base command), display a live configuration dashboard.

## Instructions

Display the following dashboard by reading live configuration and environment state. Use plain text output (no tool calls needed for display — just output the text directly).

### Step 1: Display ASCII Logo

Output this exact logo block:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║             ██████╗ ██╗██╗   ██╗███████╗██████╗  ██████╗  █████╗              ║
║             ██╔══██╗██║██║   ██║██╔════╝██╔══██╗██╔════╝ ██╔══██╗             ║
║             ██║  ██║██║██║   ██║█████╗  ██████╔╝██║  ███╗███████║             ║
║             ██║  ██║██║╚██╗ ██╔╝██╔══╝  ██╔══██╗██║   ██║██╔══██║             ║
║             ██████╔╝██║ ╚████╔╝ ███████╗██║  ██║╚██████╔╝██║  ██║             ║
║             ╚═════╝ ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝             ║
║                                                                               ║
║              * Diverge from the Modal · Discover the Exceptional              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Step 2: Read Configuration

Read `config/diverga-config.json` (relative to the plugin directory at `~/.claude/plugins/diverga/config/diverga-config.json`). Extract:
- `human_checkpoints.level` or infer from `human_checkpoints.enabled` + `human_checkpoints.required`
- `hud.preset` if present
- `language`
- `version`
- `runtime_bridge.enabled` and `runtime_bridge.runtime_config_path` if present

If config file doesn't exist, show "Not configured — run /diverga:setup"

### Step 3: Check Project Status

Check if `.research/project-state.yaml` exists in the current working directory.
- If exists: read project name, current stage, and checkpoint status
- If not: show "No active project"

### Step 4: Check API/MCP Status

Check these environment variables and report status:
- `SEMANTIC_SCHOLAR_API_KEY` — for paper retrieval
- `OPENALEX_EMAIL` — for OpenAlex polite pool
- `SCOPUS_API_KEY` — for Scopus access
- `WOS_API_KEY` — for Web of Science access
- `GROQ_API_KEY` — for LLM screening (recommended)
- `ANTHROPIC_API_KEY` — for Claude API screening
- `OPENAI_API_KEY` — for OpenAI screening
- `GEMINI_API_KEY` — for Gemini visualization

For each: show "configured" if set, "not set" if unset, with setup hint.

### Step 5: Display Dashboard

Combine all information into this format:

```
SYSTEM STATUS
  Version:     11.0.0
  Agents:      24 agents across 9 categories (A-G, I, X)
  Status:      Ready

CONFIGURATION
  Checkpoint:  [level from config or "Full (default)"]
  HUD Preset:  [preset from config or "research (default)"]
  VS Method:   Enabled
  Runtime Bridge: [enabled -> path | disabled]

PROJECT
  Active:      [project name or "No active project"]
  Stage:       [stage or "-"]
  Memory:      [healthy/no project]

API STATUS (Paper Retrieval)
  Semantic Scholar:   [configured/not set -> export SEMANTIC_SCHOLAR_API_KEY=...]
  OpenAlex:           [configured (email: ...)/not set -> export OPENALEX_EMAIL=your@email.com]
  Scopus:             [configured/not set -> export SCOPUS_API_KEY=...]
  Web of Science:     [configured/not set -> export WOS_API_KEY=...]

LLM PROVIDERS (Batch Screening via I2)
  Groq:               [configured/not set -> export GROQ_API_KEY=...]
                      llama-3.3-70b — $0.01/100 papers (recommended)
  Anthropic API:      [configured/not set -> export ANTHROPIC_API_KEY=...]
                      claude-haiku-4-5 — $0.15/100 papers
  OpenAI:             [configured/not set -> export OPENAI_API_KEY=...]
                      gpt-4o-mini — ~$0.02/100 papers

MCP INTEGRATIONS
  Zotero:             [detected/not available -> /diverga:setup for guidance]
  Claude Code Browser: [detected/not available]
  Gemini:             [configured/not set -> export GEMINI_API_KEY=...]

QUICK ACTIONS
  /diverga:setup     Initial configuration
  /diverga:doctor    System diagnostics
  /diverga:help      All 24 agents & commands
  /diverga:memory    Project context & status
  /diverga:hud       HUD display settings
  "Start a systematic review on [topic]"  -> Begin research
```

### Step 6: Offer MCP Setup Guidance (if requested)

If the user asks about Zotero MCP setup, provide:

```
Zotero MCP enables:
- Auto-import retrieved papers into Zotero library
- Collection management during screening (Included/Excluded)
- Bibliography generation in any citation style
- Citation insertion during manuscript writing

Setup:
1. Install Zotero desktop app (zotero.org)
2. Install Zotero MCP server
3. Add to Claude Code MCP config
4. Restart Claude Code
```

If the user asks about Claude Code Browser:

```
Claude Code Browser enables:
- Automated search queries on institutional databases (WoS, Scopus, ERIC)
- Guided export from university-licensed portals
- Semi-automated paper collection from any web-based database

Status: Available if Chrome extension is installed.
No additional setup needed.
```

## Implementation Notes

- Use Bash tool to check environment variables: `echo $VARIABLE_NAME`
- Use Read tool to check config file existence and contents
- If `runtime_bridge.enabled` exists, show the Claude managed runtime path and note that it is a generated Diverga-managed artifact
- Use Glob tool to check for `.research/project-state.yaml`
- Display everything as formatted text output
- The dashboard is READ-ONLY — it doesn't modify any files
- If any check fails, show graceful fallback (e.g., "Unable to determine" instead of errors)
