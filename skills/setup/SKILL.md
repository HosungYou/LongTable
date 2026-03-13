---
name: setup
description: |
  Diverga v11.0 initial configuration wizard. 3-step setup.
  Sets up checkpoints, OpenAlex email, and HUD preferences.
  Triggers: setup, configure, 설정, install
version: "11.1.1"
---

# /diverga:setup

**Version**: 11.0.0
**Trigger**: `/diverga:setup`

## Description

Diverga v11.0 setup wizard. 3 steps: Checkpoint Level + OpenAlex Email + HUD.
LLM selection removed (Claude Code is already authenticated).

## Workflow

When user invokes `/diverga:setup`, execute this interactive wizard:

### Step 0: Project Detection

Check for existing project:
- If `.research/` exists → "Existing project detected. Upgrade to v8.4.0?"
- If `config/diverga-config.json` exists with older version → "Upgrade from vX.Y.Z to v8.4.0?"
- Otherwise → "New project setup"

### Step 1: Welcome + Checkpoint Level

Display welcome message, then ask checkpoint level using AskUserQuestion:

```
╔══════════════════════════════════════════════════════════════════╗
║                   Welcome to Diverga v11.0                       ║
║       AI Research Assistant - 24 Agents, 9 Categories           ║
╚══════════════════════════════════════════════════════════════════╝
```

```
question: "Select checkpoint level - how often should AI stop and ask for confirmation on research decisions?"
header: "Checkpoints"
options:
  - label: "Full (Recommended)"
    description: "All 11 checkpoints enabled. AI stops at every critical decision."
  - label: "Minimal"
    description: "Paradigm & Methodology checkpoints only. Faster progress, key decisions confirmed."
  - label: "Off"
    description: "Autonomous mode. No checkpoints. Not recommended for research."
```

### Step 2: OpenAlex Email (Optional)

Configure email for OpenAlex polite pool (faster API responses for Journal Intelligence MCP).

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

### Step 4: VS Arena Configuration (v11.1)

```
question: "Enable VS Arena for methodology selection?"
header: "VS Arena"
options:
  - label: "Classic VS (Default)"
    description: "Single agent generates 3 methodology options using VS process."
  - label: "VS Arena"
    description: "3 persona agents with distinct epistemological commitments debate methodology choices."
  - label: "VS Arena + Cross-Critique"
    description: "VS Arena with inter-persona critique round for deeper analysis."
```

**If VS Arena or VS Arena + Cross-Critique selected**, add to config:
```json
{
  "vs_arena": {
    "enabled": true,
    "team_size": 3,
    "cross_critique": false  // true if "VS Arena + Cross-Critique"
  }
}
```

### Step 5: Generate Configuration & Complete

After collecting all preferences, generate `config/diverga-config.json`:

```json
{
  "version": "11.0.0",
  "human_checkpoints": {
    "enabled": true,
    "level": "<full|minimal|off>",
    "required": ["CP_PARADIGM", "CP_METHODOLOGY", ...],
    "optional": [...]
  },
  "hud": {
    "enabled": true,
    "preset": "<research|minimal|off>"
  },
  "language": "en",
  "model_routing": {
    "high": "opus",
    "medium": "sonnet",
    "low": "haiku"
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
║                  Diverga v11.0 Setup Complete!                    ║
╠══════════════════════════════════════════════════════════════════╣
║  Configuration saved to: config/diverga-config.json             ║
║                                                                  ║
║  Quick Start:                                                    ║
║  • Just describe your research in natural language               ║
║  • "I want to conduct a systematic review on AI in education"    ║
║  • Diverga will auto-detect and guide you with checkpoints       ║
║                                                                  ║
║  New in v11.1:                                                   ║
║  • VS Arena — multi-agent methodology debate (optional)          ║
║  • Hard-blocking checkpoint enforcement                          ║
║  • 29 agents (24 core + 5 VS Arena personas)                     ║
║                                                                  ║
║  Commands:                                                       ║
║  • /diverga:help     - View all 24 agents                       ║
║  • /diverga:memory   - Memory system commands                    ║
╚══════════════════════════════════════════════════════════════════╝
```

## Error Handling

If config directory doesn't exist, create it:
```bash
mkdir -p config
```
