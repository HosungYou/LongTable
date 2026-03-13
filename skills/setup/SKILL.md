---
name: setup
description: |
  Diverga v11.1 initial configuration wizard. 4-step setup.
  Sets up checkpoints, OpenAlex email, HUD, and VS Arena preferences.
  Triggers: setup, configure, 설정, install
version: "11.1.2"
---

# /diverga:setup

**Version**: 11.1.2
**Trigger**: `/diverga:setup`

## Description

Diverga v11.1 setup wizard. 4 steps: Checkpoint Level + OpenAlex Email + HUD + VS Arena.
LLM selection removed (Claude Code is already authenticated).

## Workflow

When user invokes `/diverga:setup`, execute this interactive wizard:

### Step 0: Project Detection

Check for existing project:
- If `~/.claude/plugins/diverga/config/diverga-config.json` exists with `version` field → "Existing config detected (vX.Y.Z). Upgrade to v11.1.2?"
- If `.research/` exists in CWD → "Existing research project detected."
- Otherwise → "New project setup"

### Step 1: Welcome + Checkpoint Level

Display welcome message, then ask checkpoint level using AskUserQuestion:

```
╔══════════════════════════════════════════════════════════════════╗
║                   Welcome to Diverga v11.1                      ║
║       AI Research Assistant - 24 Agents, 9 Categories           ║
╚══════════════════════════════════════════════════════════════════╝
```

```
question: "Select checkpoint level - how often should AI stop and ask for confirmation on research decisions?"
header: "Checkpoints"
options:
  - label: "Full (Recommended)"
    description: "All checkpoints enabled (2 required + 2 optional). AI stops at every critical decision."
  - label: "Minimal"
    description: "Required checkpoints only (CP_PARADIGM, CP_METHODOLOGY). Key decisions confirmed."
  - label: "Off"
    description: "Config checkpoints disabled. Hook-level REQUIRED gates still enforced. Not recommended."
```

**Note**: Regardless of this setting, the 5 hook-enforced REQUIRED checkpoints (CP_RESEARCH_DIRECTION, CP_PARADIGM_SELECTION, CP_METHODOLOGY_APPROVAL, SCH_DATABASE_SELECTION, SCH_SCREENING_CRITERIA) are always enforced by `prereq-enforcer.mjs` and cannot be disabled.

**Mapping**:
- Full → `enabled: true`, `required: ["CP_PARADIGM", "CP_METHODOLOGY"]`, `optional: ["CP_THEORY", "CP_DATA_VALIDATION"]`
- Minimal → `enabled: true`, `required: ["CP_PARADIGM", "CP_METHODOLOGY"]`, `optional: []`
- Off → `enabled: false`, `required: []`, `optional: []`

### Step 2: OpenAlex Email (Optional)

Configure email for OpenAlex polite pool (faster API responses for Journal Intelligence MCP / Agent G1).

```
question: "OpenAlex polite pool 이메일을 입력하세요 (선택사항) / Enter email for OpenAlex polite pool (optional)"
header: "OpenAlex"
options:
  - label: "Enter email"
    description: "더 빠른 API 응답 + 높은 rate limit / Faster API responses + higher rate limit"
  - label: "Skip"
    description: "이메일 없이도 작동합니다 (느린 rate limit) / Works without email (slower rate limit)"
```

**If email provided**:
- Save to `.omc/config.json`: `{ "openalex_email": "{email}" }`
- Create `.omc/` directory if not exists

**Environment variable override**:
- `OPENALEX_EMAIL` env var takes precedence over config file when set

### Step 3: HUD Configuration

```
question: "Enable Diverga HUD statusline?"
header: "HUD"
options:
  - label: "Research (Recommended)"
    description: "Shows project name, stage, checkpoint progress, memory health."
  - label: "Minimal"
    description: "Compact display with stage and progress only."
  - label: "Off"
    description: "No HUD display."
```

### Step 4: VS Arena Configuration

```
question: "Enable VS Arena - multi-agent methodology debate?"
header: "VS Arena"
options:
  - label: "Off (Recommended for beginners)"
    description: "Standard single-perspective VS methodology. Simpler workflow."
  - label: "VS Arena"
    description: "3 epistemological personas (V1-V5) debate methodology. Richer but slower."
  - label: "VS Arena + Cross-Critique"
    description: "Personas also critique each other's proposals. Most thorough, highest cost."
```

**Mapping**:
- Off → `vs_arena: { enabled: false, team_size: 3, cross_critique: false }`
- VS Arena → `vs_arena: { enabled: true, team_size: 3, cross_critique: false }`
- VS Arena + Cross-Critique → `vs_arena: { enabled: true, team_size: 3, cross_critique: true }`

### Step 5: Generate Configuration & Complete

After collecting all preferences, generate `config/diverga-config.json` **in the plugin directory** (`~/.claude/plugins/diverga/config/diverga-config.json`):

```json
{
  "version": "11.1.2",
  "llm_provider": "anthropic",
  "llm_api_key_env": "ANTHROPIC_API_KEY",
  "human_checkpoints": {
    "enabled": true,
    "required": ["CP_PARADIGM", "CP_METHODOLOGY"],
    "optional": ["CP_THEORY", "CP_DATA_VALIDATION"]
  },
  "default_paradigm": "auto",
  "language": "en",
  "model_routing": {
    "high": "opus",
    "medium": "sonnet",
    "low": "haiku"
  },
  "vs_arena": {
    "enabled": false,
    "team_size": 3,
    "cross_critique": false
  }
}
```

If OpenAlex email was provided, also generate/update `.omc/config.json`:

```json
{
  "openalex_email": "user@example.com"
}
```

Display completion:

```
╔══════════════════════════════════════════════════════════════════╗
║                  Diverga v11.1 Setup Complete!                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Configuration saved to:                                        ║
║    ~/.claude/plugins/diverga/config/diverga-config.json         ║
║                                                                  ║
║  Quick Start:                                                    ║
║  - Just describe your research in natural language               ║
║  - "I want to conduct a systematic review on AI in education"    ║
║  - Diverga will auto-detect and guide you with checkpoints       ║
║                                                                  ║
║  New in v11.1:                                                   ║
║  - VS Arena: Multi-agent methodology debate (5 personas)        ║
║  - SQLite hard-blocking hooks for REQUIRED checkpoints          ║
║  - 24 agents across 9 categories                                ║
║                                                                  ║
║  Commands:                                                       ║
║  - /diverga:help     - View all 24 agents                       ║
║  - /diverga:memory   - Memory system commands                    ║
╚══════════════════════════════════════════════════════════════════╝
```

## First-Run Detection

When a user starts a new Claude Code session and the Diverga plugin is loaded:
1. Check if `~/.claude/plugins/diverga/config/diverga-config.json` has `"version": "11.1.2"`
2. If config is missing or version is older → display:
   ```
   Diverga is installed but not configured. Run /diverga:setup to get started.
   ```
3. Do NOT auto-run the setup wizard — only display the suggestion.

## Error Handling

If config directory doesn't exist, create it:
```bash
mkdir -p ~/.claude/plugins/diverga/config
```
