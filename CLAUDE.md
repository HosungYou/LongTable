# CLAUDE.md

# Diverga v10.3.1 (Platform Hook Enforcement + OpenCode Full Parity)

**Beyond Modal: AI Research Assistant That Thinks Creatively**

**v10.3.1**: Platform Hook Enforcement — Claude Code PreToolUse hooks (`checkpoint-enforcer.mjs`, `skill-interceptor.mjs`) intercept every `diverga:*` agent call at platform level, enforcing prerequisite checkpoints via shared `prereq-checker.mjs`. Soft block pattern (always `continue: true` with warning injection). OpenCode full feature parity: 44 agents, MCP-first checkpoint enforcement, 3-layer memory, HUD, setup wizard, humanization/review pipelines, 49 keyword triggers. Lazy init creates checkpoint skeleton on first run.
**v10.3.0**: Journal Intelligence MCP — New `journal-server.js` MCP server with 6 tools (OpenAlex + Crossref APIs) for real-time journal data. G1 Journal Matcher overhauled with checkpoint-based pipeline (CP_JOURNAL_PRIORITIES + CP_JOURNAL_SELECTION). Setup wizard adds OpenAlex email configuration (Step 2). 4 MCP servers total.
**v10.2.0**: Humanization Pipeline v3.1 — Rich Checkpoint v2.0 (section-level scores, 6 options per checkpoint), Balanced (Fast) mode (merged L1-3 pass), G5+F5 parallel execution, target score auto-stop, section-selective humanization. `/diverga:humanize` v1.1.0.
**v10.1.1**: Typographic Character Enforcement — Unicode em dash (—), en dash (–), smart quotes (" " ' ') mandated across G6 output and F5 verification. ASCII `--` is a FAIL condition. Zotero MCP removed from `.mcp.json`.
**v10.1.0**: `/diverga:humanize` Orchestration Skill — Multi-pass 4-layer pipeline orchestrator with mandatory AskUserQuestion checkpoints between every pass. Enforces sequential G5→G6→F5 execution with OMC autonomous mode defense. Supports conservative (L1-2), balanced (L1-3), aggressive (L1-4) modes. Pipeline v3.0 with CP_PASS1/2/3_REVIEW checkpoints.
**v10.0.0**: Discourse-Level Detection & 4-Layer Humanization — G5/G6/F5 v3.0, 28 AI patterns across 7 domains (D1-D4 discourse patterns), 13 quantitative metrics, v3.0 composite scoring (6 components), Layer 4 DT1-DT4 discourse transformation, perturbation naturalization, 7 discipline profiles, section-conditional weights. Requires Humanizer MCP v3.0.0.
**v9.2.1**: Zero-Setup MCP — All 3 MCP servers (diverga, humanizer, context7) auto-register via plugin `.mcp.json`. No manual settings.json needed. Uses uvx/npx/bundle strategy from oh-my-claudecode.
**v9.2.0**: MCP Tool Integration — Humanizer server (4 tools), G5/G6/F5 MCP integration, 5 of 6 gaps resolved, 120 tests passing.
**v9.1.0**: Humanization Pipeline v2.0 - Multi-pass iterative pipeline (vocab/structural/polish), S7-S10 structural detection, quantitative metrics (burstiness CV, MTLD), section-aware mode escalation, G5/G6/F5 v2.0, 84 TDD tests. Reference: https://github.com/HosungYou/humanizer
**v9.0.0**: Architecture — MCP 3-server split (checkpoint/memory/comm, 16 tools), SQLite WAL backend, YAML→SQLite auto-migration, agent messaging (register/send/mailbox/broadcast), dual backend via `DIVERGA_BACKEND`
**v8.5.0**: Agent Teams - Parallel agent execution via TeamCreate/TaskCreate/SendMessage, I0 Team Lead mode, 3x parallel database fetching
**v8.4.0**: Researcher Visibility & Pipeline Safety - Dual directory structure (`.research/` system + `research/` public), auto-migration, SCH_API_KEY_VALIDATION checkpoint, validateApiKeys() utility
**v8.3.0**: Cross-Platform Migration - GPT-5.3-Codex model routing, 47 individual Codex CLI SKILL.md files, updated install script, cross-platform documentation
**v8.2.0**: MCP Runtime Checkpoint Enforcement - MCP server (7 tools), SKILL.md simplification (675 lines saved), state path unification, Priority Context
**v8.1.0**: Checkpoint Enforcement Strengthening + Humanization Pipeline v2.0 - Mandatory AskUserQuestion at all checkpoints, Agent Prerequisite Map, multi-agent coordination; Multi-pass iterative pipeline, structural detection (S7-S10), quantitative metrics (burstiness CV, MTLD), section-aware mode escalation. Reference: https://github.com/HosungYou/humanizer
**v8.0.1-patch3**: 8-Dimension Diagnostic Sweep - Category I registration fix, version sync, lib/ fixes
**v8.0.1**: Installation Bug Fixes - Fixed install script path corruption, skills copy instead of symlink
**v8.0.0**: Project Visibility Enhancement - Independent HUD, simplified setup, natural language project start, docs/ auto-generation
**v7.0.0**: Memory System - 3-layer context, checkpoint auto-trigger, cross-session persistence
**v6.9.2**: Marketplace Cache Fix - Fixed cache sync issue, comprehensive troubleshooting guide
**v6.9.1**: Plugin Discovery Fix - Added version field to SKILL.md, removed orphaned directories, local symlinks
**v6.8.0**: Memory System - Persistent context preservation with semantic search and lifecycle hooks
**v6.7.0**: Systematic Review Automation - Category I agents (I0-I3) for PRISMA 2020 pipeline
**v6.6.3**: Codex CLI SKILL.md implementation - actual skill loading via `.codex/skills/`
**v6.6.2**: Multi-CLI Compatibility - unified install script, NPM package (@diverga/codex-setup)
**v6.5.0**: Parallel execution via Task tool - `Task(subagent_type="diverga:a1", ...)`
**v6.4**: Plugin Marketplace Registration - Install via `/plugin marketplace add`

## v8.0 Key Features

### 1. File Structure Redesign
- `.research/` = System-only files (hidden: HUD cache, priority context, sessions)
- `research/` = Researcher-visible state files (project-state, decisions, checkpoints, baselines)
- `docs/` = Researcher-visible documentation (auto-generated)

### 2. Independent HUD Statusline
- Completely independent of oh-my-claudecode
- Shows project name, stage, checkpoint progress, memory health
- Multiple presets: research, checkpoint, memory, minimal

### 3. Simplified Setup (2 Steps)
- Removed LLM selection (Claude Code already authenticated)
- Checkpoint level + HUD in single screen
- Auto-project detection

### 4. Natural Language Project Start
- "I want to conduct a systematic review on AI in education" → auto-detect & initialize
- Works in English and Korean

AI Research Assistant for the Complete Research Lifecycle - from question formulation to publication.

**Language**: English. Responds in Korean when user input is Korean.

---

## Installation

### Recommended Method (Local Skills - Most Reliable)

```bash
# Step 1: Clone repository
git clone https://github.com/HosungYou/Diverga.git
cd Diverga

# Step 2: Create local skill symlinks
for skill_dir in skills/*/; do
  skill_name=$(basename "$skill_dir")
  cp -r "$skill_dir" ~/.claude/skills/diverga-${skill_name}
done

# Step 3: Restart Claude Code

# Step 4: Verify
/diverga-help       # Should display help guide
```

### Alternative Method (Plugin Marketplace)

```bash
# Step 1: Add to marketplace
/plugin marketplace add https://github.com/HosungYou/Diverga

# Step 2: Install
/plugin install diverga

# Step 3: Configure
/diverga-setup
```

### Skill Access

| Method | Command | Reliability |
|--------|---------|-------------|
| **Hyphen prefix** | `/diverga-help` | ✅ Always works |
| Colon prefix | `/diverga:help` | ⚠️ Requires plugin load |

**Recommendation**: Use hyphen prefix (`/diverga-xxx`) for reliable skill invocation.

---

## v6.0 Clean Slate Changes

| Change | v5.0 (Sisyphus) | v6.0 (Human-Centered) |
|--------|-----------------|----------------------|
| **Sisyphus Protocol** | "Work never stops" | ❌ REMOVED |
| **Iron Law** | "agent OR checkpoint" | ❌ REMOVED |
| **ralph/ultrawork/ecomode** | Autonomous modes | ❌ REMOVED |
| **Human Checkpoints** | Could be bypassed | ✅ MANDATORY |
| **Model Routing** | haiku/sonnet/opus | ✅ KEPT |
| **VS Methodology** | Creative alternatives | ✅ ENHANCED |

---

## Project Overview

Diverga provides **context-persistent research support** through **44 specialized agents** across 9 categories (A-I). Unlike other AI tools that suffer from **mode collapse** (always recommending the same predictable options), Diverga uses **Verbalized Sampling (VS) methodology** to guide you toward creative, defensible research choices while maintaining research context across the entire project lifecycle in a single platform.

## Core Value Proposition

1. **Human-Centered**: AI assists, humans decide at EVERY critical point
2. **Beyond Modal**: VS methodology prevents mode collapse - creative alternatives, not obvious choices
3. **Context Persistence**: No re-explaining your research question, methodology, or decisions
4. **Single Platform**: Claude Code as your unified research environment
5. **Research Pipeline**: Structured workflow from idea to publication
6. **Tool Discovery**: Easy access to tools/platforms you didn't know existed

> **Core Principle**: "Human decisions remain with humans. AI handles what's beyond human scope."
> "인간이 할 일은 인간이, AI는 인간의 범주를 벗어난 것을 수행"

---

## Quick Start

Simply tell Diverga what you want to do:

```
"I want to conduct a systematic review on AI in education"
"메타분석 연구를 시작하고 싶어"
"Help me design an experimental study"
```

The system will:
1. Detect your paradigm
2. **ASK for confirmation** (🔴 CHECKPOINT)
3. Present VS alternatives with T-Scores
4. **WAIT for your selection**
5. Guide you through the pipeline with checkpoints

---

## Memory System (v7.0 Core Feature)

### Overview

Diverga Memory System provides **context-persistent research support** with:
- **3-Layer Context System**: Keyword-triggered, Task interceptor, CLI-based loading
- **Checkpoint Auto-Trigger**: Automatic enforcement at critical decision points
- **Cross-Session Persistence**: Decisions and progress survive session restarts
- **Decision Audit Trail**: Immutable, versioned history of all research decisions

### 3-Layer Context System

| Layer | Trigger | Description |
|-------|---------|-------------|
| **Layer 1** | Keywords | "my research", "연구 진행", "where was I" auto-load context |
| **Layer 2** | Task tool | `Task(subagent_type="diverga:*")` auto-injects context to agents |
| **Layer 3** | CLI | `/diverga:memory context` for explicit full context |

### Memory Commands

| Command | Description |
|---------|-------------|
| `/diverga:memory status` | Show project status |
| `/diverga:memory context` | Display full context |
| `/diverga:memory init` | Initialize new project |
| `/diverga:memory decision list` | List decisions |
| `/diverga:memory decision add` | Add decision |
| `/diverga:memory archive [STAGE]` | Archive completed stage |
| `/diverga:memory migrate` | Run v6.8 → v7.0 migration |

### Project Structure

```
project-root/
├── .research/                  # System files (hidden - internal use only)
│   ├── hud-state.json          # HUD cache
│   ├── priority-context.md     # Compressed context (500 chars)
│   └── sessions/               # Session records
│
├── research/                   # Researcher-visible files (public)
│   ├── project-state.yaml      # Project metadata
│   ├── decision-log.yaml       # All research decisions
│   ├── checkpoints.yaml        # Checkpoint states
│   ├── baselines/              # Stable research foundations
│   │   ├── literature/
│   │   ├── methodology/
│   │   └── framework/
│   └── changes/
│       ├── current/            # Active work
│       └── archive/            # Completed stages
│
└── docs/                       # Auto-generated documentation
```

**Migration Note (v8.3.1)**: Existing projects with files in `.research/` are automatically migrated to `research/` on first access. System-only files (hud-state.json, priority-context.md, sessions/) remain in `.research/`.

### Context Keywords (English + Korean)

**English**: "my research", "research status", "research progress", "where was I", "continue research"

**Korean**: "내 연구", "연구 진행", "연구 상태", "어디까지", "지금 단계"

---

## Human Checkpoint System (v6.0 Core Feature)

### Checkpoint Types

| Level | Icon | Behavior |
|-------|------|----------|
| **REQUIRED** | 🔴 | System STOPS - Cannot proceed without explicit approval |
| **RECOMMENDED** | 🟠 | System PAUSES - Strongly suggests approval |
| **OPTIONAL** | 🟡 | System ASKS - Defaults available if skipped |

### Required Checkpoints (🔴 MANDATORY)

| Checkpoint | When | What Happens |
|------------|------|--------------|
| CP_RESEARCH_DIRECTION | Research question finalized | Present VS options, WAIT for selection |
| CP_PARADIGM_SELECTION | Methodology approach | Ask Quantitative/Qualitative/Mixed |
| CP_THEORY_SELECTION | Framework chosen | Present alternatives with T-Scores |
| CP_METHODOLOGY_APPROVAL | Design complete | Detailed review required |

### Checkpoint Behavior

```
┌────────────────────────────────────────────────────────────────┐
│                   CHECKPOINT PROTOCOL                          │
│                                                                │
│   When AI reaches a checkpoint:                                │
│                                                                │
│   1. STOP immediately                                          │
│   2. Present options with VS alternatives                      │
│   3. WAIT for explicit human approval                          │
│   4. DO NOT proceed until approval received                    │
│   5. DO NOT assume approval based on context                   │
│                                                                │
│   [X] NEVER: "Proceeding with..." without asking              │
│   [OK] ALWAYS: "Which direction would you like to proceed?"   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Checkpoint Enforcement Protocol (MANDATORY)

### Rule 1: AskUserQuestion 도구 사용 의무
체크포인트 도달 시 반드시 `AskUserQuestion` 도구를 호출합니다.
텍스트로 묻는 것은 체크포인트 충족으로 인정되지 않습니다.

❌ 금지: "어떻게 하시겠습니까?" (텍스트 질문)
✅ 필수: AskUserQuestion 도구 호출 (구조화된 선택지)

### Rule 2: 전제조건 Gate (스킵 불가)
에이전트 호출 시, 해당 에이전트의 prerequisite 체크포인트가
이전에 사용자의 명시적 승인을 받았는지 확인합니다.
승인 이력이 없으면 해당 체크포인트부터 순서대로 진행합니다.
REQUIRED 체크포인트는 사용자 요청으로도 건너뛸 수 없습니다.

### Rule 3: Ad-hoc 호출 처리
에이전트를 직접 호출했을 때 (예: /diverga:c5):
1. Agent Prerequisite Map에서 전제조건 확인
2. 미완료 전제조건이 있으면 AskUserQuestion으로 해당 결정 요청
3. 모든 전제조건 통과 후 에이전트 본연의 작업 시작

### Rule 4: 동시 다중 에이전트 호출 처리
자연어로 다수 에이전트가 동시 트리거될 때:
1. 모든 트리거된 에이전트의 전제조건을 합집합(Union)으로 수집
2. 중복 제거 후 의존성 순서(dependency order)로 정렬
3. 각 전제조건을 순서대로 AskUserQuestion으로 질문 (한 번에 최대 4개)
4. 모든 전제조건 통과 후 에이전트들을 병렬 실행
5. 각 에이전트 실행 중 자체 체크포인트도 반드시 AskUserQuestion 호출

예시: "메타분석 설계하고 효과크기 추출도 같이" → C5 + B3 트리거
  → Union prerequisites: {CP_RESEARCH_DIRECTION, CP_METHODOLOGY_APPROVAL}
  → AskUserQuestion: CP_RESEARCH_DIRECTION 먼저
  → AskUserQuestion: CP_METHODOLOGY_APPROVAL 다음
  → 모든 통과 후 C5 + B3 병렬 실행

### Why Prompt-Level Enforcement (v8.1) + MCP Enforcement (v8.2)
Claude Code shell hooks cannot invoke AskUserQuestion tool directly (shell commands only).
CLAUDE.md and SKILL.md prompt-level instructions remain the primary enforcement mechanism.

**v9.0 MCP Server**: `diverga-server.js` provides 16 runtime tools across 3 servers (checkpoint, memory, comm).
Agents call `diverga_check_prerequisites(agent_id)` before execution and
`diverga_mark_checkpoint(cp_id, decision, rationale)` to record decisions.
State is stored in `research/` (public files) and `.research/` (system files).
With `DIVERGA_BACKEND=sqlite`, state uses SQLite WAL mode for ACID-safe parallel execution.

### Rule 5: Override Refusal
사용자가 REQUIRED 체크포인트 스킵 요청 시:
→ AskUserQuestion으로 Override Refusal Template 제시 (텍스트 거부 아님)
→ REQUIRED는 어떤 상황에서도 스킵 불가
→ 참조: `.claude/references/checkpoint-templates.md` → Override Refusal Template

### Rule 6: MCP-First Verification (v8.2)
에이전트 실행 전: `diverga_check_prerequisites(agent_id)` 호출
→ `approved: true` → 에이전트 실행 진행
→ `approved: false` → `missing` 배열의 각 체크포인트에 대해 AskUserQuestion 호출
→ MCP 미가용 시: `research/decision-log.yaml` (또는 레거시 `.research/decision-log.yaml`) 직접 읽기
→ 대화 이력은 최후 수단 (세션 간 유지 안 됨)

### Agent Prerequisite Map

| Agent | Prerequisites (반드시 완료) | Own Checkpoints (실행 중 트리거) |
|-------|---------------------------|-------------------------------|
| A1 | (진입점) | 🔴 CP_RESEARCH_DIRECTION, 🔴 CP_VS_001, 🔴 CP_VS_003 |
| A2 | CP_RESEARCH_DIRECTION | 🔴 CP_THEORY_SELECTION, 🔴 CP_VS_001, 🟠 CP_VS_002, 🔴 CP_VS_003 |
| A3 | CP_RESEARCH_DIRECTION | 🔴 CP_VS_001, 🔴 CP_VS_003 |
| A4 | (없음) | (없음) |
| A5 | (진입점) | 🔴 CP_PARADIGM_SELECTION |
| A6 | CP_RESEARCH_DIRECTION | 🟡 CP_VISUALIZATION_PREFERENCE |
| B1 | CP_RESEARCH_DIRECTION | 🟠 CP_SCREENING_CRITERIA, 🟡 CP_SEARCH_STRATEGY, 🔴 CP_VS_001 |
| B2 | CP_RESEARCH_DIRECTION | 🟠 CP_QUALITY_REVIEW |
| B3 | (없음) | (없음) |
| B4 | (없음) | (없음) |
| B5 | (없음) | (없음) |
| C1 | CP_PARADIGM_SELECTION, CP_RESEARCH_DIRECTION | 🔴 CP_METHODOLOGY_APPROVAL, 🔴 CP_VS_001, 🔴 CP_VS_003 |
| C2 | CP_PARADIGM_SELECTION, CP_RESEARCH_DIRECTION | 🔴 CP_METHODOLOGY_APPROVAL, 🔴 CP_VS_001 |
| C3 | CP_PARADIGM_SELECTION, CP_RESEARCH_DIRECTION | 🔴 CP_METHODOLOGY_APPROVAL, 🟠 CP_INTEGRATION_STRATEGY |
| C5 | CP_RESEARCH_DIRECTION, CP_METHODOLOGY_APPROVAL | 🟠 CP_ANALYSIS_PLAN |
| C6 | CP_METHODOLOGY_APPROVAL | (없음) |
| C7 | CP_METHODOLOGY_APPROVAL | (없음) |
| D1 | CP_METHODOLOGY_APPROVAL | 🟠 CP_SAMPLING_STRATEGY |
| D2 | CP_METHODOLOGY_APPROVAL | 🟠 CP_SAMPLING_STRATEGY |
| D4 | CP_METHODOLOGY_APPROVAL | 🔴 CP_METHODOLOGY_APPROVAL |
| E1 | CP_METHODOLOGY_APPROVAL | 🟠 CP_ANALYSIS_PLAN |
| E2 | CP_METHODOLOGY_APPROVAL | 🟠 CP_CODING_APPROACH, 🟠 CP_THEME_VALIDATION |
| E3 | CP_METHODOLOGY_APPROVAL | 🟠 CP_INTEGRATION_STRATEGY |
| E5 | CP_METHODOLOGY_APPROVAL | (없음) |
| G1 | (진입점) | 🟠 CP_JOURNAL_PRIORITIES, 🟠 CP_JOURNAL_SELECTION |
| G3 | (없음) | (없음) |
| G5 | (없음) | 🟠 CP_HUMANIZATION_REVIEW |
| G6 | CP_HUMANIZATION_REVIEW | 🟡 CP_HUMANIZATION_VERIFY |
| H1 | CP_PARADIGM_SELECTION | 🔴 CP_METHODOLOGY_APPROVAL |
| H2 | CP_PARADIGM_SELECTION | 🔴 CP_METHODOLOGY_APPROVAL |
| I0 | (없음) | All SCH_* |
| I1 | (없음) | 🔴 SCH_DATABASE_SELECTION, 🔴 SCH_API_KEY_VALIDATION |
| I2 | SCH_DATABASE_SELECTION | 🔴 SCH_SCREENING_CRITERIA |
| I3 | SCH_SCREENING_CRITERIA | 🟠 SCH_RAG_READINESS |

### Checkpoint Dependency Order

전제조건 해결 순서 (낮은 Level부터):

```
Level 0 (진입점): CP_RESEARCH_DIRECTION, CP_PARADIGM_SELECTION, CP_JOURNAL_PRIORITIES, CP_JOURNAL_SELECTION
Level 1: CP_THEORY_SELECTION, CP_METHODOLOGY_APPROVAL
Level 2: CP_ANALYSIS_PLAN, CP_SCREENING_CRITERIA, CP_SAMPLING_STRATEGY, CP_CODING_APPROACH, CP_THEME_VALIDATION, CP_INTEGRATION_STRATEGY, CP_QUALITY_REVIEW
Level 3: SCH_DATABASE_SELECTION, SCH_API_KEY_VALIDATION, CP_HUMANIZATION_REVIEW, CP_VS_001, CP_VS_002, CP_VS_003
Level 4: SCH_SCREENING_CRITERIA, CP_HUMANIZATION_VERIFY
Level 5: SCH_RAG_READINESS
```

---

## Core Systems

| System | Purpose | Location |
|--------|---------|----------|
| MCP Server | Runtime checkpoint enforcement + state + messaging (16 tools) | `mcp/diverga-server.js` |
| Journal MCP | Real-time journal data from OpenAlex + Crossref (6 tools) | `mcp/journal-server.js` |
| Project State | Context persistence | `research/project-state.yaml` |
| Decision Log | Human decisions | `research/decision-log.yaml` |
| Research Coordinator | Main skill definition | `.claude/skills/research-coordinator/SKILL.md` |
| Orchestrator | Agent management | `.claude/skills/research-orchestrator/SKILL.md` |

---

## MCP Server Architecture (v10.3.0)

### Overview

Diverga provides 22 MCP tools across 2 server processes: `diverga-server.js` (16 tools for checkpoint/memory/comm) and `journal-server.js` (6 tools for journal intelligence). Plus 2 external MCP servers (humanizer, context7) for a total of 4 MCP servers.

```
diverga-server.js ──→ tool-registry.js (16 tools)
      │
      ├── checkpoint-server   memory-server     comm-server
      │        │                    │                │
      │   ┌────┴────┐        ┌────┴────┐      ┌────┴────┐
      │   │  YAML   │        │  YAML   │      │  JSON   │
      │   │(default)│        │(default)│      │(default)│
      │   └─────────┘        └─────────┘      └─────────┘
      │        │                    │                │
      └── sqlite-servers.js (WAL mode, DIVERGA_BACKEND=sqlite)
```

### Dual Backend

| Backend | Env Var | Description |
|---------|---------|-------------|
| **YAML** (default) | `DIVERGA_BACKEND=yaml` | Backward-compatible with v8.x, human-readable files |
| **SQLite** (opt-in) | `DIVERGA_BACKEND=sqlite` | WAL-mode ACID transactions for parallel agent execution |

First SQLite startup auto-migrates existing YAML/JSON data (checkpoints, decisions, project state, priority context, agents, messages). Original files preserved.

### 16 MCP Tools

| Category | Tool | Description |
|----------|------|-------------|
| **Checkpoint** (3) | `diverga_check_prerequisites` | Verify agent prerequisites before execution |
| | `diverga_mark_checkpoint` | Record checkpoint decision with rationale |
| | `diverga_checkpoint_status` | Full checkpoint overview |
| **Memory** (7) | `diverga_project_status` | Read project state |
| | `diverga_project_update` | Update project state (deep merge) |
| | `diverga_decision_add` | Record research decision |
| | `diverga_decision_list` | List/filter decisions |
| | `diverga_priority_read` | Read priority context |
| | `diverga_priority_write` | Write priority context (500 char limit) |
| | `diverga_export_yaml` | Export all state as YAML |
| **Comm** (6) | `diverga_agent_register` | Register agent for messaging |
| | `diverga_agent_list` | List registered agents |
| | `diverga_message_send` | Send agent-to-agent message |
| | `diverga_message_mailbox` | Read agent inbox |
| | `diverga_message_acknowledge` | Acknowledge message receipt |
| | `diverga_message_broadcast` | Broadcast to all agents |

### Journal Intelligence MCP (v10.3.0)

New standalone MCP server (`journal-server.js`) providing real-time journal data for G1 Journal Matcher.

```
journal-server.js ──→ 6 tools
      │
      ├── OpenAlex API (primary) ── journal search, metrics, trends, authors, compare
      └── Crossref API (secondary) ── special issues, recent publications
```

**Email Configuration** (OpenAlex polite pool):
1. `OPENALEX_EMAIL` env var (highest priority)
2. `.omc/config.json` → `openalex_email` field
3. No email → works but slower rate limit

#### 6 Journal MCP Tools

| Tool | API | Description |
|------|-----|-------------|
| `journal_search_by_field` | OpenAlex | Search journals by research field, sorted by citations |
| `journal_metrics` | OpenAlex | Detailed metrics (h-index, citations, works, OA, APC) |
| `journal_publication_trends` | OpenAlex | Works/citations per year for last N years |
| `journal_editor_info` | OpenAlex | Top authors by publication count in journal |
| `journal_compare` | OpenAlex | Compare 2-5 journals side by side |
| `journal_special_issues` | Crossref | Recent themed publications and special issue content |

### G1 Journal Matcher Pipeline (v10.3.0)

G1 now operates as a checkpoint-based pipeline with MCP integration:

```
User request → journal_search_by_field + journal_metrics [parallel]
  → 🟠 CP_JOURNAL_PRIORITIES (user selects: IF/Speed/OA/Scope/Balanced)
  → Re-rank → journal_compare + journal_publication_trends [parallel]
  → 🟠 CP_JOURNAL_SELECTION (user selects journal or strategy)
  → journal_editor_info + journal_special_issues [parallel]
  → Report + Cover letter + Sequential submission plan
```

| Checkpoint | Level | Options |
|------------|-------|---------|
| CP_JOURNAL_PRIORITIES | 🟠 Recommended | IF / Speed / OA / Scope Fit / Balanced |
| CP_JOURNAL_SELECTION | 🟠 Recommended | Select journal / Multi-submit / More search / Re-search |

---

## Agent Structure (44 Agents in 9 Categories)

| Category | Count | Agents | Paradigm |
|----------|-------|--------|----------|
| **A: Foundation** | 6 | A1-ResearchQuestionRefiner, A2-TheoreticalFrameworkArchitect, A3-DevilsAdvocate, A4-ResearchEthicsAdvisor, A5-ParadigmWorldviewAdvisor, **A6-ConceptualFrameworkVisualizer** | All |
| **B: Evidence** | 5 | B1-SystematicLiteratureScout, B2-EvidenceQualityAppraiser, B3-EffectSizeExtractor, B4-ResearchRadar, **B5-ParallelDocumentProcessor** | All |
| **C: Design & Meta-Analysis** | 7 | C1-QuantitativeDesignConsultant, C2-QualitativeDesignConsultant, C3-MixedMethodsDesignConsultant, C4-ExperimentalMaterialsDeveloper, **C5-MetaAnalysisMaster**, **C6-DataIntegrityGuard**, **C7-ErrorPreventionEngine** | Paradigm-specific + Meta-analysis |
| **D: Data Collection** | 4 | D1-SamplingStrategyAdvisor, D2-InterviewFocusGroupSpecialist, D3-ObservationProtocolDesigner, D4-MeasurementInstrumentDeveloper | Method-specific |
| **E: Analysis** | 5 | E1-QuantitativeAnalysisGuide, E2-QualitativeCodingSpecialist, E3-MixedMethodsIntegration, E4-AnalysisCodeGenerator, **E5-SensitivityAnalysisDesigner** | Paradigm-specific |
| **F: Quality** | 5 | F1-InternalConsistencyChecker, F2-ChecklistManager, F3-ReproducibilityAuditor, F4-BiasTrustworthinessDetector, **F5-HumanizationVerifier** | All |
| **G: Communication** | 6 | G1-JournalMatcher, G2-AcademicCommunicator, G3-PeerReviewStrategist, G4-PreregistrationComposer, **G5-AcademicStyleAuditor**, **G6-AcademicStyleHumanizer** | All |
| **H: Specialized** | 2 | H1-EthnographicResearchAdvisor, H2-ActionResearchFacilitator | Qual |
| **I: Systematic Review Automation** | 4 | **I0-ReviewPipelineOrchestrator**, **I1-PaperRetrievalAgent**, **I2-ScreeningAssistant**, **I3-RAGBuilder** | All |

**Total: 6 + 5 + 7 + 4 + 5 + 5 + 6 + 2 + 4 = 44 agents**

### New in v6.3: Meta-Analysis Agent System (C5/C6/C7)

Based on V7 GenAI meta-analysis lessons learned:

| Agent | Purpose | Model |
|-------|---------|-------|
| **C5-MetaAnalysisMaster** | Multi-gate validation, workflow orchestration | Opus |
| **C6-DataIntegrityGuard** | Data completeness, Hedges' g calculation, SD recovery | Sonnet |
| **C7-ErrorPreventionEngine** | Pattern detection, anomaly alerts, error prevention | Sonnet |

**Authority Model**:
- C5 = Decision Authority (gate pass/fail)
- C6 = Service Provider (data integrity reports)
- C7 = Advisory (warnings, recommendations)

### New in v6.1: Humanization Pipeline Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| **G5-AcademicStyleAuditor v3.0** | AI pattern detection (28 categories, 7 domains) + 13 quantitative metrics + v3.0 composite (6 components) | Sonnet |
| **G6-AcademicStyleHumanizer v3.0** | 4-layer transformation (vocab/phrase/structure/discourse) with DT1-DT4 + perturbation naturalization | Opus |
| **F5-HumanizationVerifier v3.0** | 8 verification domains including discourse naturalness + v3.0 composite verification | Haiku |

### New in v6.2: Parallel Document Processing

| Agent | Purpose | Model |
|-------|---------|-------|
| **B5-ParallelDocumentProcessor** | Batch PDF processing with parallel workers | Opus |

### New in v6.7.0: Systematic Review Automation (Category I)

PRISMA 2020 compliant systematic literature review pipeline with automated paper retrieval, screening, and RAG building.

| Agent | Purpose | Model | Checkpoint |
|-------|---------|-------|------------|
| **I0-ReviewPipelineOrchestrator** | Pipeline coordination, stage management | Opus | - |
| **I1-PaperRetrievalAgent** | Multi-database fetching (Semantic Scholar, OpenAlex, arXiv) | Sonnet | 🔴 SCH_DATABASE_SELECTION, 🔴 SCH_API_KEY_VALIDATION |
| **I2-ScreeningAssistant** | AI-PRISMA 6-dimension screening | Sonnet | 🔴 SCH_SCREENING_CRITERIA |
| **I3-RAGBuilder** | Vector database construction (zero cost) | Haiku | 🟠 SCH_RAG_READINESS |

**Human Checkpoints**:
- 🔴 **SCH_DATABASE_SELECTION**: User must approve database selection before retrieval
- 🔴 **SCH_API_KEY_VALIDATION**: Validates API keys for selected databases; blocks if required keys missing
- 🔴 **SCH_SCREENING_CRITERIA**: User must approve inclusion/exclusion criteria
- 🟠 **SCH_RAG_READINESS**: Recommended checkpoint before RAG queries
- 🟡 **SCH_PRISMA_GENERATION**: Optional checkpoint before PRISMA flow diagram generation

---

## Model Routing (v8.0)

| Tier | Model | Agents (44 total) |
|------|-------|-------------------|
| HIGH | Opus | A1, A2, A3, A5, **B5**, C1, C2, C3, D4, E1, E2, E3, G3, **G6**, H1, H2, **I0** (17) |
| MEDIUM | Sonnet | A4, A6, B1, B2, C4, D1, D2, E5, F3, F4, G1, G2, G4, **G5**, **I1**, **I2** (16) |
| LOW | Haiku | B3, B4, D3, E4, F1, F2, **F5**, **I3** (8) |

---

## Research Types Supported

**Quantitative:**
- Experimental designs (RCT, quasi-experimental)
- Survey research
- Meta-analysis and systematic reviews
- Correlational studies
- Psychometric validation

**Qualitative:**
- Phenomenology
- Grounded theory
- Case study
- Ethnography
- Narrative inquiry
- Action research

**Mixed Methods:**
- Sequential (explanatory, exploratory)
- Convergent parallel
- Embedded design
- Transformative frameworks

---

## VS Methodology (Enhanced in v6.0)

### T-Score (Typicality Score)

| T-Score | Label | Meaning |
|---------|-------|---------|
| >= 0.7 | Common | Highly typical, safe but limited novelty |
| 0.4-0.7 | Moderate | Balanced risk-novelty |
| 0.2-0.4 | Innovative | Novel, requires strong justification |
| < 0.2 | Experimental | Highly novel, high risk/reward |

### VS Process with Human Decision

```
Stage 1: Context & Modal Identification
  └─ Identify "obvious" recommendations

Stage 2: Divergent Exploration
  ├─ Direction A (T~0.6): Safe but differentiated
  ├─ Direction B (T~0.4): Balanced novelty ⭐
  └─ Direction C (T<0.3): Innovative/experimental

Stage 3: Human Selection (🔴 CHECKPOINT)
  ├─ Present ALL options with T-Scores
  ├─ WAIT for human decision
  └─ Execute ONLY selected direction
```

---

## Tool Integrations

### Ready to Use (No Setup)
- **Excel**: Data extraction, coding → "Create extraction spreadsheet"
- **PowerPoint**: Presentations → "Create conference slides"
- **Word**: Manuscripts → "Export methods to Word"
- **Python**: Analysis → Built-in
- **Mermaid**: Diagrams → "Create PRISMA flow diagram"

### Needs Setup
- **Semantic Scholar**: API key for literature search
- **OpenAlex**: Email for polite pool
- **Zotero**: MCP server for references
- **R Scripts**: Local R installation
- **Nanobanana**: Gemini API key for visualization

---

## Paradigm Detection (Auto-Activation + Confirmation)

### Auto-Detection Triggers

**Quantitative signals:** "hypothesis", "effect size", "p-value", "experiment", "ANOVA", "regression", "가설", "효과크기", "통계"

**Qualitative signals:** "lived experience", "saturation", "themes", "phenomenology", "coding", "체험", "포화", "현상학"

**Mixed methods signals:** "sequential", "convergent", "integration", "joint display", "혼합방법", "통합"

### Confirmation (Always Ask)

When paradigm is detected, **ALWAYS ask for confirmation**:

```
"A [Quantitative] research approach has been detected from your context.
Shall we proceed with this paradigm?

 [Q] Yes, proceed with Quantitative research
 [L] No, switch to Qualitative research
 [M] No, switch to Mixed Methods
 [?] I'm not sure, I need help"
```

---

## Humanization Pipeline (v3.1 — Multi-Pass Iterative Architecture)

### Overview

Transform AI-generated academic text into natural, human-sounding prose while preserving scholarly integrity. Based on Wikipedia's AI Cleanup initiative's 24+4 pattern categories (including S7-S10 structural patterns), adapted for academic writing. v2.0 replaces single-pass with multi-pass iterative pipeline featuring quantitative metrics (burstiness CV, MTLD) and section-aware mode escalation.

**Reference Documentation**: https://github.com/HosungYou/humanizer

### Pipeline Stages (v3.0 Multi-Pass — 4-Layer)

```
Content Generation (G2/G3) --> G5 Analysis --> Checkpoint -->
  Pass 1: G6 Vocab (Layer 1-2) --> F5 Quick --> CP_PASS1_REVIEW -->
  Pass 2: G6 Structural (Layer 3) --> F5 Full --> CP_PASS2_REVIEW -->
  Pass 3: G6 Discourse (Layer 4, DT1-DT4) --> F5 Full --> CP_PASS3_REVIEW -->
  [Pass 4 optional: G6 Polish --> F5 Full --> CP_FINAL_REVIEW] -->
  Export
```

### Commands

| Command | Description |
|---------|-------------|
| `"Check AI patterns"` | Run G5 analysis, show pattern report |
| `"Humanize my draft"` | Full multi-pass pipeline with balanced mode |
| `"Humanize (conservative)"` | Minimal changes, high-risk only |
| `"Humanize (aggressive)"` | Maximum naturalness |
| `"Humanize to target: 30%"` | Target-based multi-pass pipeline |
| `"Humanize (multi-pass)"` | Explicit multi-pass with all checkpoints |
| `"Humanize (journal_safe)"` | Preset target: 30% |
| `"Humanize (conference)"` | Preset target: 40% |
| `"Export with humanization"` | Run pipeline before export |

### Transformation Modes

| Mode | Target | Layers | Best For |
|------|--------|--------|----------|
| **Conservative** | High-risk patterns only | Layer 1-2 (vocabulary + phrase) | Journal submissions |
| **Balanced** | High + medium + structural | Layer 1-3 (+ structure) | Most academic writing |
| **Balanced (Fast)** | Same as Balanced, merged pass | Layer 1-3 (single G6 call) | Same quality, fewer steps |
| **Aggressive** | All patterns + discourse | Layer 1-4 (+ discourse DT1-DT4) | Maximum naturalness |

### Checkpoints

| Checkpoint | Level | When |
|------------|-------|------|
| CP_HUMANIZATION_REVIEW | 🟠 Recommended | After G5 analysis, before transformation |
| CP_PASS1_REVIEW | 🟠 Recommended | After vocabulary pass, before structural pass (Rich Checkpoint v2.0) |
| CP_PASS2_REVIEW | 🟠 Recommended | After structural pass, before discourse pass (Rich Checkpoint v2.0) |
| CP_PASS3_REVIEW | 🟠 Recommended | After discourse pass, before optional polish (Rich Checkpoint v2.0) |
| CP_FINAL_REVIEW | 🟡 Optional | After polish pass, before export |
| CP_HUMANIZATION_VERIFY | 🟡 Optional | Post-humanization verification review |

### Typographic Character Enforcement

All G6 output MUST use proper Unicode typographic characters:
- **Em dash**: — (U+2014), NEVER `--`
- **En dash**: – (U+2013) for number ranges (years, ages, pages)
- **Smart quotes**: " " ' ' (U+201C/D, U+2018/9), NEVER straight quotes `"` `'`

F5 verification MUST flag any remaining `--` as a **FAIL condition**.

### Parallel G5+F5 Execution (v3.1)

After each G6 transform, G5 rescan and F5 verify run **in parallel** since both are read-only operations on the same G6 output. This saves latency on every pass without risk to data integrity.

```
G6 transform → [G5 rescan ‖ F5 verify] → Checkpoint
```

### Section-Selective Humanization (v3.1)

The pipeline supports the `sections` parameter to transform only specific manuscript sections (e.g., `["discussion", "conclusion"]`). Non-selected sections pass through unchanged. Users can modify section selection at any Rich Checkpoint.

### Target Score Auto-Stop (v3.1)

Users set a `target_score` (default: 30%) at STAGE 0. When the score reaches the target, the pipeline auto-recommends "Accept" at the next checkpoint. Users can always override and continue.

### Ethics Note

Humanization helps express ideas naturally—it does NOT make AI use "undetectable."
Researchers should follow institutional and journal AI disclosure policies.

See: `.claude/skills/research-coordinator/ethics/ai-writing-ethics.md`

---

## What Was Removed in v6.0

### ❌ Sisyphus Protocol
- **Was**: "Work never stops until complete"
- **Problem**: Bypassed human checkpoints
- **Now**: AI stops at every checkpoint and waits

### ❌ Iron Law of Continuation
- **Was**: "Move to next agent OR human checkpoint"
- **Problem**: "OR" made checkpoints optional
- **Now**: Checkpoint THEN next agent (sequential)

### ❌ OMC Autonomous Modes
- **Removed**: ralph, ultrawork, autopilot, ecomode
- **Problem**: These modes enabled checkpoint bypass
- **Kept**: Model routing (haiku/sonnet/opus) only

---

## GitHub Repository

https://github.com/HosungYou/Diverga

---

## Auto-Trigger Agent Dispatch (v6.4 Core Feature)

Diverga automatically detects keywords and context to activate appropriate agents via Task tool.

### Agent Invocation Pattern

When Claude Code detects trigger keywords, it automatically invokes agents:

```python
Task(
    subagent_type="diverga:<agent_id>",
    model="<opus|sonnet|haiku>",
    prompt="<research context + specific task>"
)
```

### Complete Auto-Trigger Reference

#### Category A: Foundation (6 agents)

| Agent | Trigger Keywords (EN) | 트리거 키워드 (KR) | Model |
|-------|----------------------|-------------------|-------|
| `diverga:a1` | "research question", "RQ", "refine question" | "연구 질문", "연구문제", "RQ" | opus |
| `diverga:a2` | "theoretical framework", "theory", "conceptual model" | "이론적 프레임워크", "이론적 틀" | opus |
| `diverga:a3` | "devil's advocate", "critique", "counterargument" | "반론", "비판적 검토", "반대 의견" | opus |
| `diverga:a4` | "IRB", "ethics", "informed consent", "research ethics" | "연구 윤리", "IRB", "동의서" | sonnet |
| `diverga:a5` | "paradigm", "ontology", "epistemology", "worldview" | "패러다임", "존재론", "인식론" | opus |
| `diverga:a6` | "conceptual framework", "visualize framework" | "개념적 프레임워크", "프레임워크 시각화" | sonnet |

#### Category B: Evidence (5 agents)

| Agent | Trigger Keywords (EN) | 트리거 키워드 (KR) | Model |
|-------|----------------------|-------------------|-------|
| `diverga:b1` | "systematic review", "literature search", "PRISMA" | "체계적 문헌고찰", "문헌 검색" | sonnet |
| `diverga:b2` | "quality appraisal", "RoB", "GRADE", "bias assessment" | "품질 평가", "비뚤림 평가" | sonnet |
| `diverga:b3` | "effect size", "extract effect", "Cohen's d", "Hedges' g" | "효과크기", "효과 크기 추출" | haiku |
| `diverga:b4` | "research trends", "emerging topics", "research radar" | "연구 동향", "트렌드" | haiku |
| `diverga:b5` | "batch PDF", "parallel processing", "multiple PDFs" | "PDF 일괄 처리", "병렬 처리" | opus |

#### Category C: Design & Meta-Analysis (7 agents)

| Agent | Trigger Keywords (EN) | 트리거 키워드 (KR) | Model |
|-------|----------------------|-------------------|-------|
| `diverga:c1` | "quantitative design", "experimental design", "RCT" | "양적 연구 설계", "실험 설계" | opus |
| `diverga:c2` | "qualitative design", "phenomenology", "grounded theory" | "질적 연구 설계", "현상학", "근거이론" | opus |
| `diverga:c3` | "mixed methods", "sequential design", "convergent" | "혼합방법", "혼합 연구", "통합 설계" | opus |
| `diverga:c4` | "intervention materials", "experimental materials" | "중재 자료", "실험 자료 개발" | sonnet |
| `diverga:c5` | "meta-analysis", "pooled effect", "heterogeneity" | "메타분석", "메타 분석", "통합 효과" | opus |
| `diverga:c6` | "data extraction", "PDF extract", "extract data" | "데이터 추출", "PDF 추출", "자료 추출" | sonnet |
| `diverga:c7` | "error prevention", "validation", "data check" | "오류 방지", "검증", "데이터 확인" | sonnet |

#### Category D: Data Collection (4 agents)

| Agent | Trigger Keywords (EN) | 트리거 키워드 (KR) | Model |
|-------|----------------------|-------------------|-------|
| `diverga:d1` | "sampling", "sample size", "G*Power" | "표집", "표본 크기", "샘플링" | sonnet |
| `diverga:d2` | "interview", "focus group", "interview protocol" | "인터뷰", "면담", "포커스 그룹" | sonnet |
| `diverga:d3` | "observation", "observation protocol" | "관찰", "관찰 프로토콜" | haiku |
| `diverga:d4` | "instrument", "measurement", "scale development" | "측정 도구", "척도 개발" | opus |

#### Category E: Analysis (5 agents)

| Agent | Trigger Keywords (EN) | 트리거 키워드 (KR) | Model |
|-------|----------------------|-------------------|-------|
| `diverga:e1` | "statistical analysis", "ANOVA", "regression", "SEM" | "통계 분석", "회귀", "분산분석" | opus |
| `diverga:e2` | "qualitative coding", "thematic analysis", "coding" | "질적 코딩", "주제 분석", "코딩" | opus |
| `diverga:e3` | "mixed methods integration", "joint display" | "혼합방법 통합", "통합 분석" | opus |
| `diverga:e4` | "R code", "Python code", "analysis code" | "R 코드", "Python 코드", "분석 코드" | haiku |
| `diverga:e5` | "sensitivity analysis", "robustness check" | "민감도 분석", "강건성 검증" | sonnet |

#### Category F: Quality (5 agents)

| Agent | Trigger Keywords (EN) | 트리거 키워드 (KR) | Model |
|-------|----------------------|-------------------|-------|
| `diverga:f1` | "consistency check", "internal consistency" | "일관성 검토", "내적 일관성" | haiku |
| `diverga:f2` | "checklist", "CONSORT", "STROBE", "COREQ" | "체크리스트", "보고 지침" | haiku |
| `diverga:f3` | "reproducibility", "replication", "OSF" | "재현성", "반복가능성" | sonnet |
| `diverga:f4` | "bias detection", "trustworthiness" | "편향 탐지", "신뢰성" | sonnet |
| `diverga:f5` | "humanization verify", "AI text check" | "휴먼화 검증", "AI 텍스트 확인" | haiku |

#### Category G: Communication (6 agents)

| Agent | Trigger Keywords (EN) | 트리거 키워드 (KR) | Model |
|-------|----------------------|-------------------|-------|
| `diverga:g1` | "journal match", "where to publish", "target journal" | "저널 매칭", "투고처", "학술지" | sonnet |
| `diverga:g2` | "academic writing", "manuscript", "write paper" | "학술 글쓰기", "논문 작성" | sonnet |
| `diverga:g3` | "peer review", "reviewer response", "revision" | "동료 심사", "리뷰어 응답", "수정" | sonnet |
| `diverga:g4` | "preregistration", "OSF", "pre-register" | "사전등록", "OSF" | sonnet |
| `diverga:g5` | "AI pattern", "check AI writing", "style audit" | "AI 패턴", "AI 글쓰기 검토" | sonnet |
| `diverga:g6` | "humanize", "humanization", "natural writing" | "휴먼화", "자연스러운 글쓰기" | opus |

#### Category H: Specialized (2 agents)

| Agent | Trigger Keywords (EN) | 트리거 키워드 (KR) | Model |
|-------|----------------------|-------------------|-------|
| `diverga:h1` | "ethnography", "fieldwork", "participant observation" | "민족지학", "현장연구", "참여관찰" | opus |
| `diverga:h2` | "action research", "participatory", "practitioner" | "실행연구", "참여적 연구" | opus |

#### Category I: Systematic Review Automation (4 agents)

| Agent | Trigger Keywords (EN) | 트리거 키워드 (KR) | Model |
|-------|----------------------|-------------------|-------|
| `diverga:i0` | "systematic review", "PRISMA", "literature review automation" | "체계적 문헌고찰", "프리즈마", "문헌고찰 자동화" | opus |
| `diverga:i1` | "fetch papers", "retrieve papers", "database search" | "논문 수집", "논문 검색", "데이터베이스 검색" | sonnet |
| `diverga:i2` | "screen papers", "PRISMA screening", "inclusion criteria" | "논문 스크리닝", "선별", "포함 기준" | sonnet |
| `diverga:i3` | "build RAG", "vector database", "embed documents" | "RAG 구축", "벡터 DB", "문서 임베딩" | haiku |

### Parallel Execution Groups

Diverga can run multiple agents in parallel when tasks are independent:

```
┌─────────────────────────────────────────────────────────────────┐
│                  PARALLEL EXECUTION GROUPS                       │
├─────────────────────────────────────────────────────────────────┤
│ Group 1: Research Design                                        │
│   diverga:a1 + diverga:a2 + diverga:a5                         │
│                                                                  │
│ Group 2: Literature & Evidence                                   │
│   diverga:b1 + diverga:b2 + diverga:b3                         │
│                                                                  │
│ Group 3: Meta-Analysis Pipeline                                  │
│   diverga:c5 → diverga:c6 → diverga:c7 (sequential)            │
│                                                                  │
│ Group 4: Quality Assurance                                       │
│   diverga:f1 + diverga:f3 + diverga:f4                         │
│                                                                  │
│ Group 5: Publication Prep                                        │
│   diverga:g1 + diverga:g2 + diverga:g5                         │
│                                                                  │
│ Group 6: Systematic Review Screening (NEW in v6.7)              │
│   diverga:i1 + diverga:i2 (parallel)                           │
│   diverga:i0 → diverga:i1 → diverga:i2 → diverga:i3 (pipeline) │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Teams (v8.5 Pilot)

Diverga v8.5 introduces Agent Teams support for Claude Code, enabling true parallel agent execution via native TeamCreate/TaskCreate/SendMessage primitives.

#### Available Team Patterns

| Pattern | Use Case | Agents | Speedup |
|---------|----------|--------|---------|
| **Parallel Specialists** | Literature review | B1+B2+B3 parallel → B4 synthesis | ~60% faster |
| **Pipeline** | Systematic review | I0→I1(×3)→I2→I3 | ~40% faster |
| **Competing Hypotheses** | Research design | A1+A2+A5 parallel | 3 perspectives |
| **QA Swarm** | Quality check | F1+F3+F4+F5 parallel | 4-angle review |

#### I0 Team Lead Mode

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set:
1. I0 creates `scholarag-pipeline` team
2. Spawns 3 parallel I1 instances for database search
3. Uses TaskCreate with `blockedBy` for automatic dependency management
4. Relays checkpoint approvals via SendMessage

#### Prerequisites

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable required
- Claude Code with Agent Teams support

#### Cost Considerations

- Each team member = independent session (3-5x token cost)
- For budget runs, teams automatically disabled
- I0 falls back to sequential mode when teams unavailable

### Sequential Execution Rules

Some agents must run in order:

```
Meta-Analysis Pipeline:
  diverga:c5 (orchestration)
    → diverga:c6 (extraction)
    → diverga:c7 (validation)

Humanization Pipeline (v3.0 Multi-Pass — 4-Layer):
  diverga:g5 (audit)
    → Pass 1: diverga:g6 (vocab, Layer 1-2) → diverga:g5 (rescan) → diverga:f5 (quick verify)
    → Pass 2: diverga:g6 (structural, Layer 3) → diverga:g5 (rescan) → diverga:f5 (full verify)
    → Pass 3: diverga:g6 (discourse, Layer 4 DT1-DT4) → diverga:g5 (rescan) → diverga:f5 (full verify)
    → [Pass 4: diverga:g6 (polish) → diverga:g5 (audit) → diverga:f5 (full verify)]
```

### ⚠️ Parallel Execution Prerequisite Gate

병렬 그룹 실행 전 반드시:
1. 그룹 내 모든 에이전트의 prerequisites 합집합 확인
2. 미완료 전제조건은 AskUserQuestion으로 먼저 해결
3. 모든 전제조건 통과 후에만 병렬 실행 시작

예시: Group 2 (B1 + B2 + B3) 실행 시
  → B1 requires CP_RESEARCH_DIRECTION
  → B2 requires CP_RESEARCH_DIRECTION
  → Union: {CP_RESEARCH_DIRECTION}
  → AskUserQuestion으로 확인 후 병렬 실행

### Example Auto-Trigger

**User Message**: "I want to conduct a meta-analysis on AI-assisted learning. Need to extract effect sizes from 50 PDFs."

**Diverga Auto-Detection**:
```
Detected Keywords:
- "meta-analysis" → diverga:c5 (MetaAnalysisMaster)
- "extract effect sizes" → diverga:b3 (EffectSizeExtractor)
- "50 PDFs" → diverga:b5 (ParallelDocumentProcessor)

Execution Plan:
1. [PARALLEL] diverga:c5 + diverga:b5
2. [SEQUENTIAL] diverga:c6 → diverga:c7
```

---

## Memory System Commands (v8.0)

The DIVERGA Memory System provides persistent context preservation for research lifecycle continuity.

| Command | Description |
|---------|-------------|
| `/diverga:memory search "query"` | Semantic memory search |
| `/diverga:memory status` | Memory system status |
| `/diverga:memory context` | Current project context |
| `/diverga:memory history` | Recent session history |
| `/diverga:memory stats` | Memory statistics |
| `/diverga:memory export --format md` | Export to Markdown |
| `/diverga:memory export --format json` | Export to JSON |

### Auto-Behavior (Lifecycle Hooks)

The Memory System automatically captures context at critical lifecycle events:

| Hook | Trigger | Auto-Capture |
|------|---------|--------------|
| `session_start` | Conversation begins | Loads project context, recent decisions |
| `checkpoint_reached` | Human checkpoint passed | Saves decision with rationale, T-Score |
| `session_end` | Conversation ends | Generates summary, saves session record |
| `agent_completed` | Agent finishes task | Agent output, time taken, success/failure |

### Trigger Keywords

**English**: "remember", "memory", "context", "recall", "session", "checkpoint", "decision", "persist"

**Korean**: "기억", "맥락", "세션", "체크포인트"

---

## Version History

- **v10.3.0**: Journal Intelligence MCP — New `journal-server.js` (6 tools: OpenAlex + Crossref). G1 Journal Matcher pipeline with CP_JOURNAL_PRIORITIES + CP_JOURNAL_SELECTION checkpoints. Setup wizard adds OpenAlex email step. 4 MCP servers.
- **v10.2.0**: Humanization Pipeline v3.1 — Rich Checkpoint v2.0 (section-level score tables, 6 options per checkpoint), Balanced (Fast) mode (merged L1-3 single pass), G5+F5 parallel execution, target score auto-stop, section-selective humanization. `/diverga:humanize` v1.1.0.
- **v10.1.1**: Typographic Character Enforcement — Unicode em dash/en dash/smart quotes mandated across G6 output and F5 verification. ASCII `--` is a FAIL condition. Zotero MCP removed.
- **v10.1.0**: Humanize Orchestration Skill - `/diverga:humanize` multi-pass 4-layer pipeline orchestrator with mandatory AskUserQuestion checkpoints, OMC autonomous mode defense, CP_PASS1/2/3_REVIEW checkpoints, pipeline v3.0 reference upgrade
- **v10.0.0**: Discourse-Level Detection & 4-Layer Humanization - G5/G6/F5 v3.0, 28 AI patterns (7 domains, D1-D4 discourse), 13 quantitative metrics, v3.0 composite scoring (6 components), Layer 4 DT1-DT4 discourse transformation, perturbation naturalization, 7 discipline profiles, section-conditional weights. Requires Humanizer MCP v3.0.0.
- **v9.2.1**: Zero-Setup MCP - All 4 MCP servers auto-register via plugin .mcp.json
- **v9.2.0**: MCP Tool Integration - Humanizer server (4 tools), G5/G6/F5 MCP integration
- **v9.1.0**: Humanization Pipeline v2.0 - Multi-pass iterative pipeline (vocab/structural/polish), S7-S10 structural detection, quantitative metrics (burstiness CV, MTLD), section-aware mode escalation, G5/G6/F5 v2.0, 84 TDD tests, SDD documentation. Reference: https://github.com/HosungYou/humanizer
- **v9.0.0**: Architecture — MCP 3-server split (checkpoint/memory/comm, 16 tools), SQLite WAL backend, YAML→SQLite auto-migration, agent messaging, dual backend via `DIVERGA_BACKEND`
- **v8.5.0**: Agent Teams — Parallel agent execution via TeamCreate/TaskCreate/SendMessage, I0 Team Lead mode, DX tooling (generate.js, sync-version.js, release.js, doctor.js), agents.json SSoT
- **v8.4.0**: Researcher Visibility & Pipeline Safety - Dual directory structure (`.research/` system + `research/` public), auto-migration, SCH_API_KEY_VALIDATION checkpoint
- **v8.3.0**: Cross-Platform Migration - GPT-5.3-Codex model routing, 47 individual Codex CLI SKILL.md files, updated install script, cross-platform documentation
- **v8.2.0**: MCP Runtime Checkpoint Enforcement - MCP server (7 tools), SKILL.md simplification (675 lines saved), state path unification, Priority Context, lib/memory removed
- **v8.1.0**: Checkpoint Enforcement Strengthening + Humanization Pipeline v2.0 - Mandatory AskUserQuestion, Agent Prerequisite Map, multi-agent coordination; Multi-pass iterative pipeline (3-pass: vocab/structural/polish), structural detection (S7-S10), quantitative metrics (burstiness CV, MTLD), section-aware mode escalation, score target system, F5 v2.0 with burstiness/structural/coherence verification. Reference: https://github.com/HosungYou/humanizer
- **v8.0.1**: Installation Bug Fixes - Fixed install script path corruption, skills copy instead of symlink
- **v8.0.0**: Project Visibility Enhancement - Independent HUD statusline, simplified 3-step setup, natural language project start, docs/ auto-generation
- **v7.0.0**: Memory System v2 - 3-layer context system, checkpoint auto-trigger, cross-session persistence, decision audit trail
- **v6.9.2**: Marketplace Cache Fix - Fixed cache sync issue, comprehensive troubleshooting guide
- **v6.9.1**: Plugin Discovery Fix - Added version field to SKILL.md, removed orphaned directories, local symlinks
- **v6.8.0**: Memory System - Persistent context preservation with semantic search and lifecycle hooks
- **v6.7.0**: Systematic Review Automation - Category I agents (I0-I3) for PRISMA 2020 pipeline (44 agents total)
- **v6.6.3**: Codex CLI SKILL.md Implementation - actual skill loading via `.codex/skills/`, QUANT-005 verified
- **v6.6.2**: Multi-CLI Compatibility Edition - unified install script, NPM package (@diverga/codex-setup)
- **v6.5.0**: Parallel Execution Edition - Task tool support via `/agents/` directory
- **v6.4.0**: Plugin Marketplace Edition - `/plugin marketplace add`, auto-trigger dispatch, /diverga:setup wizard
- **v6.3.0**: Meta-Analysis Agent System - C5-MetaAnalysisMaster, C6-DataIntegrityGuard, C7-ErrorPreventionEngine (40 agents total)
- **v6.2.0**: Parallel Document Processing - B5-ParallelDocumentProcessor for batch PDF handling (37 agents total)
- **v6.1.0**: Humanization Pipeline - G5-AcademicStyleAuditor, G6-AcademicStyleHumanizer, F5-HumanizationVerifier (36 agents total)
- **v6.0.1**: Agent restructuring - 33 agents with category-based naming (A1-H2)
- **v6.0.0**: Clean Slate - Removed Sisyphus/OMC modes, mandatory checkpoints
- **v5.0.0**: Sisyphus protocol, paradigm detection, 27 agents
- **v4.0.0**: Context persistence, pipeline templates, integration hub
- **v3.2.0**: OMC integration, model routing
- **v3.0.0**: Creativity modules, user checkpoints, dynamic T-Score

---

## Developer Notes

### SKILL.md Format for Claude Code Plugins

When creating skills for Claude Code plugins, the `SKILL.md` frontmatter must follow a specific format.

**Correct Format** (works):
```yaml
---
name: skill-name
description: |
  Brief description of the skill.
  Include triggers and additional info as text here.
version: "1.0.0"
---

# Skill Title

Markdown content follows...
```

**Incorrect Format** (causes "Unknown skill" error):
```yaml
---
name: skill-name
command: /plugin:skill-name       # ❌ BREAKS parsing
category: system                  # ❌ Not supported
model_tier: medium                # ❌ Not supported
triggers:                         # ❌ Not supported
  - "keyword1"
  - "keyword2"
dependencies:                     # ❌ Not supported
  required:
    - package>=1.0
---
```

**Rules**:
1. Only `name`, `description`, `version` fields are supported
2. Put extra metadata (triggers, dependencies) in description text
3. Quote version numbers: `"1.0.0"` not `1.0.0`
4. Do NOT use `command` field - it breaks skill recognition

**Testing Skills**:
```bash
# After editing SKILL.md, sync to plugin directory:
cp ".claude/skills/your-skill/SKILL.md" \
   ~/.claude/plugins/diverga/.claude/skills/your-skill/SKILL.md

# Restart Claude Code for changes to take effect
/exit
```

### Plugin Directory Structure

```
~/.claude/plugins/diverga/
├── .claude/
│   └── skills/
│       ├── memory/
│       │   └── SKILL.md          # Skill definition
│       ├── research-coordinator/
│       │   └── SKILL.md
│       └── ...
├── .claude-plugin/
│   └── marketplace.json          # Plugin metadata
└── CLAUDE.md                     # Project instructions
```
