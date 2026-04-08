# Changelog

All notable changes to Diverga (formerly Research Coordinator) will be documented in this file.

---

## [12.0.2] - 2026-04-08 (Team Dispatch Marker Injection + Node 20+ Compat)

### Overview

**Diverga v12.0.2** — Closes the gap between the v12.0.1 Team Dispatch Bypass mechanism and the orchestrator-style skills that are supposed to use it. Rule 7 introduced the `DIVERGA_TEAM_DISPATCH=1` prompt marker so `prereq-enforcer.mjs` can skip individual agent prerequisite checks when the user has already approved a multi-agent pipeline, but the five orchestrator skills that actually fan out to downstream agents never emitted the marker. Agent Teams pipelines (I0 systematic review, humanize, VS Arena subagent fallback, I1/I2 integrations) could therefore still be blocked by the checkpoint gate. This release aligns the skill-level dispatch patterns with the Rule 7 design intent so LLMs emit the marker consistently. The hook itself is unchanged.

Ad-hoc single agent calls such as invoking `/diverga:e1` directly remain unaffected and continue to enforce checkpoints per Rule 2-6. Only downstream agents dispatched from within an approved orchestrator skill now bypass prerequisite checks.

This release also fixes a Node 20+ compatibility issue in `scripts/dev.js` that prevented dev mode activation when an existing root symlink was present at `~/.claude/plugins/diverga`.

### Bug Fixes

- **Rule 7 marker not injected by orchestrator skills**: `skills/i0/SKILL.md`, `skills/i1/SKILL.md`, `skills/i2/SKILL.md`, `skills/humanize/SKILL.md`, and `skills/orchestrator/SKILL.md` contained `Task()` dispatch examples for downstream `diverga:*` agents but did not prepend `DIVERGA_TEAM_DISPATCH=1` to the prompt. LLMs copying these patterns would therefore trigger the prereq-enforcer hard block on agents with required checkpoints (A2, C3, C5, B2, etc.). All fifteen dispatch call sites across these five skills now explicitly include the marker, and each file carries a "Rule 7 — Team Dispatch Bypass" note that explains why the marker is required and where to read the full rule.
- **`scripts/dev.js` fails on Node 20+ with `ERR_FS_EISDIR`**: When `activate()` encountered a pre-existing symlink at the plugin root, `rmSync(path, { force: true })` refused to remove it because the symlink resolved to a directory and `recursive` was not set. Using `recursive: true` would have been unsafe if the path happened to be a real directory with user files. The fix branches on `lstatSync().isSymbolicLink()` and uses `unlinkSync` for symlinks, `rmSync({ recursive: true, force: true })` for non-symlinks. Applied in both `activate()` (step 6) and `deactivate()` (step 3).

### Modified

- `skills/i0/SKILL.md`: 9 dispatch call sites updated (i1, i2, i3 in Agent Delegation Pattern; b1, b2, c5 in Integration section; 3 parallel fetchers in Agent Teams Mode). Added Rule 7 header to the Agent Delegation Pattern and Integration with Diverga sections.
- `skills/i1/SKILL.md`: b1 dispatch in Integration with B1 section updated. Added Rule 7 note.
- `skills/i2/SKILL.md`: b2 dispatch in Integration with B2 section updated. Added Rule 7 note.
- `skills/humanize/SKILL.md`: g5, g6, f5 dispatches in Agent Spawning Rules section updated from placeholder `prompt="..."` to full marker-prefixed examples. Added Rule 7 note.
- `skills/orchestrator/SKILL.md`: VS Arena subagent fallback example expanded from single-line placeholder to multi-line marker-prefixed form. Added Rule 7 note covering both team mode and subagent mode.
- `scripts/dev.js`: Added `unlinkSync` import. Replaced `rmSync(PLUGIN_SYMLINK, { force: true })` with `lstat`-based branching in `activate()` step 6 and `deactivate()` step 3.

### Design Notes

An earlier internal proposal considered adding `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === 'true'` as a second bypass trigger in `prereq-enforcer.mjs`. This was rejected because the env var is typically set globally in `~/.claude/settings.json` and would therefore turn into a permanent checkpoint bypass for every diverga agent call, including ad-hoc single agent invocations. That would defeat the purpose of the checkpoint system, which is the primary object of study in Diverga's methodological research. The skill-level marker injection pursued here preserves the Rule 2-6 enforcement envelope for ad-hoc calls while making Rule 7 bypass automatic within orchestrator skills.

### Verification

Tested manually with the hook running against four representative agents (G1, G2, C3, E1) with `DIVERGA_HOOK_DEBUG=1`. All four returned `{"continue": true}` and emitted the debug line `Team dispatch mode, bypassing prerequisites for: <agent>` when the prompt contained `DIVERGA_TEAM_DISPATCH=1`, and the two non-entry-point agents (C3, E1) returned `BLOCKED: No checkpoint database found` when invoked without the marker from a directory without `diverga.db`. This confirms both the bypass path and the enforcement path are working as designed.

---

## [12.0.1] - 2026-03-30 (Team Dispatch Bypass)

### Overview

**Diverga v12.0.1** — Fixes Agent Teams being blocked by prerequisite enforcement. When orchestrator dispatches a team with user approval, individual agent prerequisite checks are now bypassed via `DIVERGA_TEAM_DISPATCH=1` flag.

### Bug Fixes

- **Agent Teams blocked by prereq-enforcer**: Non-entry-point agents (A2, B2, E1, etc.) were hard-blocked when dispatched as a team because no `diverga.db` existed or required checkpoints were incomplete. The orchestrator's dispatch approval now serves as the checkpoint.

### Added

- **DIVERGA_TEAM_DISPATCH flag**: prereq-enforcer.mjs (v11.2) checks for `DIVERGA_TEAM_DISPATCH=1` in agent prompt or env var, bypassing all prerequisite checks for orchestrator-approved dispatches
- **Rule 7 (Team Dispatch Bypass)**: New checkpoint rule in `docs/CHECKPOINT-RULES.md`
- **Architecture spec**: `docs/specs/2026-03-26-execution-context-architecture.md`

### Modified

- `CLAUDE.md`: Added Team Dispatch Bypass note under checkpoint types
- `research-orchestrator/SKILL.md`: Added Team Dispatch Bypass section with usage protocol

---

## [11.3.1] - 2026-03-14 (Plugin Infrastructure Fix)

### Overview

**Diverga v11.3.1** — Fixes plugin loading errors caused by hooks duplication, version drift between manifests, and deploy pipeline bugs. Resolves MCP server crashes after deployment and dev mode state corruption.

### Bug Fixes

- **Plugin hooks duplication**: Removed explicit `"hooks"` field from `plugin.json` — Claude Code auto-loads `hooks/hooks.json` from the standard location, so declaring it again caused a duplicate error
- **Version drift**: `sync-version.js` now syncs `plugin.json` and `.claude-plugin/plugin.json` alongside all other version-bearing files
- **deploy.js version bump no-op**: `bumpVersion()` now writes `package.json` before running `sync-version.js`, which reads it as source of truth
- **MCP server crash after deploy**: `refreshCache()` now runs `npm install --production` in the cache's `mcp/` directory to install `@modelcontextprotocol/sdk`
- **Dev mode state corruption**: `deactivate()` now falls back to `.dev-mode.json` state and on-disk cache discovery when `/plugin update` has overwritten markers

### Improvements

- `dev.js activate()` manages the plugin root symlink (`~/.claude/plugins/diverga`) during development
- `dev.js deactivate()` restores the previous symlink target
- Root `plugin.json` added to `DEPLOY_ALLOWLIST`
- `.research/` added to `.gitignore`

---

## [11.3.0] - 2026-03-14 (Dev Mode, Deploy Pipeline, Agent Teams)

### Overview

**Diverga v11.3.0** — Introduces selective symlink dev mode, one-command deploy pipeline, and Agent Teams integration for VS Arena. Redesigns the setup wizard as a researcher profile interview.

### Added

- **`scripts/dev.js`**: Selective symlink dev mode — links only allowlisted paths (agents, skills, mcp, hooks, config, etc.) into a dev cache, blocking build artifacts and session data from leaking into production
- **`scripts/deploy.js`**: One-command 6-stage release pipeline — pre-flight checks, build/validate, version sync, git commit/tag/push, GitHub Release, cache refresh
- **Agent Teams integration**: VS Arena can dispatch parallel persona agents via Agent Teams when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, with automatic fallback to subagents
- **Setup wizard redesign**: Researcher profile interview collecting experience level, discipline, stats software, and database access preferences — all agents adapt behavior based on the profile

### Modified

- TypeScript types: added V/X categories and Arena VS level
- CLAUDE.md, CONTRIBUTING.md, DEVELOPER.md: dev mode and Agent Teams documentation
- npm scripts: `dev:on`, `dev:off`, `dev:status`, `deploy`

---

## [11.1.2] - 2026-03-14 (Setup Wizard Fix)

### Overview

**Diverga v11.1.2** — Fixes the setup wizard to align with v11.1.1 config schema, adds first-run detection, and documents symlink-based development workflow.

### Bug Fixes

- Setup wizard synced with v11.1.1 config schema
- First-run detection added to session start
- `plugin.json` converted from symlink to regular file for Windows compatibility

### Added

- Symlink-based development guide in DEVELOPER.md

---

## [11.1.1] - 2026-03-13 (latex2omml Integration)

### Overview

**Diverga v11.1.1** — Adds `latex2omml` as an internal package for converting LaTeX math expressions to native Word equations (OMML). Integrates equation generation into G2 (Publication Specialist) and LaTeX syntax validation into G5 (Academic Style Auditor).

### Added

- **`packages/latex2omml/`**: Pure Python LaTeX-to-OMML converter
  - Recursive-descent parser supporting fractions, subscripts, superscripts, Greek letters, text mode, accents, n-ary operators, functions, square roots, and 30+ symbols
  - Zero external dependencies beyond lxml and python-docx (no Pandoc, no MS Office XSLT)
  - 36 tests covering all constructs including real-world academic equations
  - Public API: `add_display_equation()`, `add_inline_equation()`, `latex_to_omml_display()`, `latex_to_omml_inline()`

- **G2 SKILL.md**: "Word Document Generation with Native Equations" section
  - Core pattern for display and inline equations
  - Markdown-to-Word equation pipeline instructions
  - Supported LaTeX reference table
  - Journal-specific formatting guide (Elsevier/APA 7th)

- **G5 SKILL.md**: "Category 7: LaTeX Syntax Patterns" (X1-X6)
  - X1: Unclosed Math Delimiter
  - X2: Missing Braces
  - X3: Inconsistent Subscripts
  - X4: Unescaped Underscores in `\text{}`
  - X5: Double Dollar Misuse
  - X6: Invalid Commands
  - Auto-fix rules and tokenizer-based validation example

- **`pyproject.toml`**: `document` optional dependency group (`latex2omml`, `python-docx`, `lxml`)

### Modified Files

| File | Changes |
|------|---------|
| `packages/latex2omml/` | New internal package (converter, tests, pyproject.toml, README) |
| `skills/g2/SKILL.md` | Word equation generation section |
| `skills/g5/SKILL.md` | LaTeX syntax validation patterns (Category 7) |
| `pyproject.toml` | `document` optional dependency group |

---

## [10.3.2] - 2026-03-05 (Hook Path Portability Fix)

### Overview

**Diverga v10.3.2** — Fixes hardcoded `/Users/hosung/` paths in hook commands and skill instructions that prevented the checkpoint enforcement system from working for any user other than the original developer. Hook commands now use `$HOME` shell expansion for universal compatibility.

### Bug Fixes

- **`hooks/hooks.json`**: Replace hardcoded `/Users/hosung/` with `$HOME/` in hook commands — checkpoint-enforcer and skill-interceptor now resolve correctly on any machine via shell expansion
- **`skills/diverga/SKILL.md`**: Replace hardcoded config path with portable `~/` prefix
- **`skills/doctor/SKILL.md`**: Replace 5 hardcoded paths with portable `~/` references (plugin registry, config, skill directories)
- **`docs/SDD-hook-enforcement.md`**: Replace 8 hardcoded paths with portable `~/` references across all architecture documentation

### Impact

Without this fix, the v10.3.1 hook enforcement system silently failed for all users except the original developer — hooks returned `{ continue: true }` on error, making checkpoint bypass invisible. This patch ensures the PreToolUse hooks execute correctly on any system.

### Modified Files

| File | Changes |
|------|---------|
| `hooks/hooks.json` | `$HOME` instead of `/Users/hosung` in 2 command paths |
| `skills/diverga/SKILL.md` | Portable config path |
| `skills/doctor/SKILL.md` | 5 portable paths |
| `docs/SDD-hook-enforcement.md` | 8 portable paths |
| `package.json` | Version bump to 10.3.2 |

### Tests

| Suite | Tests | Status |
|-------|-------|--------|
| Hook tests (node:test) | 91 | All pass |
| checkpoint-enforcer | 25 | Pass |
| skill-interceptor | 16 | Pass |
| prereq-checker | 39 | Pass |
| checkpoint-logic lazy init | 11 | Pass |

---

## [10.3.1] - 2026-02-28 (Platform Hook Enforcement + OpenCode Full Parity)

### Overview

**Diverga v10.3.1** — Platform-level hook-based checkpoint enforcement for Claude Code and full feature parity for OpenCode. Previously, checkpoints were only enforced when the research-coordinator was invoked; direct agent calls (e.g., `Task(subagent_type="diverga:c1")`) could bypass checkpoints entirely. This release adds PreToolUse hooks that intercept every agent call at the platform level, checking prerequisites via a shared utility backed by the SSoT (`agent-prerequisite-map.json`). Soft block pattern: always `continue: true` with warning injection.

### New Features

- **Claude Code PreToolUse Hooks**: Platform-level hook enforcement via `hooks/hooks.json`:
  - `checkpoint-enforcer.mjs`: Intercepts `Task` tool calls with `diverga:*` subagent_type, checks prerequisites, injects soft-block warnings
  - `skill-interceptor.mjs`: Same pattern for `Skill` tool calls (e.g., `/diverga:c1`)
  - Always returns `continue: true` — soft block, never hard block
- **Shared Prerequisite Checker** (`mcp/lib/prereq-checker.mjs`):
  - `checkAgentPrereqs(agentId, researchDir)`: Normalize ID → load prereqs from SSoT → check YAML state → classify REQUIRED/RECOMMENDED/OPTIONAL
  - `formatWarningMessage(result)`: Generate structured warning text
  - Used by both Claude Code hooks and OpenCode hooks
- **Checkpoint Lazy Init** (`mcp/lib/checkpoint-logic.js`):
  - When both `checkpoints.yaml` and `decision-log.yaml` are absent, creates skeleton with all REQUIRED checkpoints as `pending`
  - Returns `first_run: true` flag — "missing = initialize then block" instead of "missing = pass"
- **OpenCode Full Feature Parity**:
  - **44 agents registered** (was 21) — all categories A-I complete
  - **MCP-first checkpoint enforcement** with local fallback in `checkpoint-enforcer.ts`
  - **Soft block pattern**: `{ proceed: true, message: "⚠️ ..." }` instead of hard blocks
  - **3-layer memory system** (`memory.ts`): keyword auto-detection, agent context injection, explicit commands
  - **HUD system** (`hud.ts`): 4 presets (research/checkpoint/memory/minimal), system prompt injection
  - **Setup wizard** (`setup.ts`): project detection, directory creation, MCP connectivity check
  - **Humanization pipeline** (`humanize-pipeline.ts`): G5→G6→F5 orchestration with 4 modes
  - **Review pipeline** (`review-pipeline.ts`): I0→I1→I2→I3 PRISMA 2020 pipeline
  - **49 keyword triggers** in auto-trigger.ts (English + Korean)
  - **MCP server configuration** via `opencode.jsonc` (4 servers: diverga, journal, humanizer, context7)
  - **oh-my-opencode.json** with all 44 agent triggers and 7 commands

### Breaking Changes

- OpenCode `checkpoint-enforcer.ts` now always returns `proceed: true` (was `proceed: false` for REQUIRED). Enforcement relies on warning injection + LLM compliance.
- `AGENT_PREREQUISITES` in checkpoint-enforcer.ts replaced with JSON import from `agent-prerequisite-map.json`.

### New Files

| File | Description |
|------|-------------|
| `hooks/hooks.json` | Claude Code PreToolUse hook configuration |
| `hooks/checkpoint-enforcer.mjs` | Task tool interceptor (~69 lines) |
| `hooks/skill-interceptor.mjs` | Skill tool interceptor (~58 lines) |
| `mcp/lib/prereq-checker.mjs` | Shared prerequisite checker (~115 lines) |
| `.opencode/opencode.jsonc` | OpenCode MCP server configuration |
| `.opencode/plugins/diverga/hooks/memory.ts` | 3-layer memory system (~197 lines) |
| `.opencode/plugins/diverga/hooks/hud.ts` | HUD system (~163 lines) |
| `.opencode/plugins/diverga/hooks/setup.ts` | Setup wizard (~165 lines) |
| `.opencode/plugins/diverga/hooks/humanize-pipeline.ts` | G5→G6→F5 pipeline (~121 lines) |
| `.opencode/plugins/diverga/hooks/review-pipeline.ts` | I0→I1→I2→I3 pipeline (~137 lines) |

### Modified Files

| File | Changes |
|------|---------|
| `.claude-plugin/plugin.json` | Added `hooks` field pointing to `hooks/hooks.json` |
| `mcp/lib/checkpoint-logic.js` | Added lazy init block (~20 lines) |
| `scripts/install-opencode.sh` | 4-step installer with MCP server copy + config deployment |
| `.opencode/oh-my-opencode.json` | 44 triggers, 7 commands, v10.3.1, soft enforcement |
| `.opencode/plugins/diverga/agents.ts` | 44 agents (added 23 missing: B5, C4, C6-C7, D1-D4, E5, F1-F5, G1-G2, G4-G6, I0-I3) |
| `.opencode/plugins/diverga/hooks/checkpoint-enforcer.ts` | MCP-first + JSON import + soft block |
| `.opencode/plugins/diverga/hooks/auto-trigger.ts` | 49 trigger entries for 44 agents |
| `.opencode/plugins/diverga/hooks/context-manager.ts` | js-yaml library + hydrateContext() |
| `.opencode/plugins/diverga/index.ts` | 17 new commands, memory/HUD/pipeline imports, v10.3.1 system prompt |
| `.opencode/plugins/diverga/package.json` | v10.3.1, js-yaml dependency |
| `.opencode/plugins/diverga/tsconfig.json` | resolveJsonModule, outDir, no DOM lib |
| `.opencode/plugins/diverga/types.ts` | Added `mcp` property to PluginContext |

### Hook Enforcement Architecture

```
Claude Code:
  User → Task("diverga:c1") → PreToolUse Hook
    → checkpoint-enforcer.mjs → prereq-checker.mjs
    → { continue: true, additionalContext: "⚠️ Missing CP_PARADIGM_SELECTION" }

OpenCode:
  User → keyword trigger → tool.execute.before
    → checkpoint-enforcer.ts → MCP diverga_check_prerequisites
    → { proceed: true, message: "⚠️ Missing CP_PARADIGM_SELECTION" }

Shared SSoT: agent-prerequisite-map.json
Shared State: research/checkpoints.yaml + research/decision-log.yaml
```

### Metrics

- **New files**: 10
- **Modified files**: 12
- **Lines added**: ~2,200
- **Lines modified**: ~500
- **TypeScript compilation**: Zero errors
- **Hook tests**: All scenarios pass (soft block, pass-through, entry-point)

---

## [10.3.0] - 2026-02-23 (Journal Intelligence MCP + G1 Pipeline)

### Overview

**Diverga v10.3.0** — Adds the Journal Intelligence MCP server (`journal-server.js`) with 6 tools powered by OpenAlex and Crossref APIs for real-time journal data. G1 Journal Matcher overhauled from a static, single-run agent to a checkpoint-based pipeline with MCP integration. Setup wizard updated with OpenAlex email configuration step.

### New Features

- **Journal Intelligence MCP** (`mcp/journal-server.js`): Standalone MCP server with 6 tools:
  - `journal_search_by_field`: Search journals by research field (OpenAlex)
  - `journal_metrics`: Detailed journal metrics — h-index, citations, OA, APC (OpenAlex)
  - `journal_publication_trends`: Works/citations per year trend data (OpenAlex)
  - `journal_editor_info`: Top authors by publication count in a journal (OpenAlex)
  - `journal_compare`: Compare 2-5 journals side by side (OpenAlex)
  - `journal_special_issues`: Recent themed publications (Crossref)
- **G1 Journal Matcher Pipeline v10.0.0**: Checkpoint-based pipeline with MCP integration:
  - Stage 1: `journal_search_by_field` + `journal_metrics` (parallel)
  - CP_JOURNAL_PRIORITIES: User selects priority (IF/Speed/OA/Scope/Balanced)
  - Stage 2: `journal_compare` + `journal_publication_trends` (parallel)
  - CP_JOURNAL_SELECTION: User selects journal or strategy
  - Stage 3: `journal_editor_info` + `journal_special_issues` (parallel)
  - Output: Report + Cover letter + Sequential submission plan
- **OpenAlex Email Setup** (Step 2 in `/diverga:setup`):
  - Optional email for OpenAlex polite pool (faster API + higher rate limit)
  - Saved to `.omc/config.json` → `openalex_email`
  - `OPENALEX_EMAIL` env var takes precedence

### New Checkpoints

| Checkpoint | Level | Agent | Description |
|------------|-------|-------|-------------|
| CP_JOURNAL_PRIORITIES | 🟠 Recommended | G1 | User selects journal ranking priority |
| CP_JOURNAL_SELECTION | 🟠 Recommended | G1 | User selects target journal or multi-submit strategy |

### Updated Files

| File | Changes |
|------|---------|
| `mcp/journal-server.js` | **New** — Journal Intelligence MCP server (6 tools) |
| `.mcp.json` | Added `journal` server entry (4 servers total) |
| `skills/g1/SKILL.md` | v10.0.0 — MCP pipeline, checkpoints, natural language routing |
| `mcp/agent-prerequisite-map.json` | G1 checkpoints + dependency_order + checkpoint_levels |
| `skills/setup/SKILL.md` | v10.3.0 — Added Step 2 (OpenAlex email), renumbered steps |
| `CLAUDE.md` | v10.3.0 — Journal MCP docs, G1 pipeline, version bump |
| `CHANGELOG.md` | This entry |

### MCP Server Stack (4 servers)

| Server | Tools | Strategy |
|--------|-------|----------|
| **diverga** | 16 (checkpoint/memory/comm) | `${CLAUDE_PLUGIN_ROOT}` bundle |
| **journal** | 6 (OpenAlex + Crossref) | `${CLAUDE_PLUGIN_ROOT}` bundle |
| **humanizer** | 4+ (stylometric metrics) | `uvx` from GitHub |
| **context7** | 2 (docs lookup) | `npx` from npm |

---

## [10.2.0] - 2026-02-23 (Humanization Pipeline v3.1 — Rich Checkpoints + Smart Pass Merge)

### Overview

**Diverga v10.2.0** — Major upgrade to the humanization pipeline (v3.0 to v3.1). Introduces Rich Checkpoint v2.0 with section-level score tables, Balanced (Fast) mode for merged L1-3 passes, G5+F5 parallel execution, target score auto-stop, and section-selective humanization. The `/diverga:humanize` orchestration skill is updated to v1.1.0.

### New Features

- **Rich Checkpoint v2.0**: All CP_PASSn_REVIEW checkpoints now display:
  - Section-level score table (Abstract, Introduction, Methods, Results, Discussion, Conclusion)
  - Before/after scores per section with remaining pattern counts
  - 6 options instead of 4: continue all, select sections, per-section intensity, preserve sentences, accept, diff
- **Balanced (Fast) mode**: New 5th option at CP_HUMANIZATION_REVIEW that merges Pass 1 (L1-2) and Pass 2 (L3) into a single G6 call, skipping CP_PASS1_REVIEW. Saves 1 G5 rescan + 1 F5 verify + 1 checkpoint wait.
- **G5+F5 parallel execution**: After each G6 transform, G5 rescan and F5 verify now run in parallel (both are read-only on the same output). Reduces per-pass latency.
- **Target score auto-stop**: User sets target_score at STAGE 0 (default: 30%). When target is reached, pipeline auto-recommends "Accept" at the next checkpoint. User can always override.
- **Section-selective humanization**: New `sections` parameter (e.g., `["discussion", "conclusion"]`). Non-selected sections pass through unchanged. Users can modify section selection at any Rich Checkpoint.

### Agent/Skill Updates

| Component | Version | Changes |
|-----------|---------|---------|
| `/diverga:humanize` | v1.1.0 | Rich Checkpoint v2.0, Balanced (Fast) mode, parallel G5+F5, target auto-stop, section-selective |
| G5-AcademicStyleAuditor | v9.0.0 | Added `section_scores` and `top_patterns` to output format (Section-Level Scores v3.1) |
| G6-AcademicStyleHumanizer | v9.0.0 | Added `sections` input parameter for section-selective humanization |

### Updated Files

| File | Changes |
|------|---------|
| `skills/humanize/SKILL.md` | v1.0.0 to v1.1.0 — Rich Checkpoint v2.0, Balanced (Fast), parallel G5+F5, target auto-stop, section-selective |
| `skills/g5/SKILL.md` | Added "Section-Level Scores (v3.1)" subsection with `section_scores` and `top_patterns` output |
| `skills/g6/SKILL.md` | Added `sections` optional input parameter for section-selective humanization |
| `CLAUDE.md` | v10.1.1 to v10.2.0 — Pipeline v3.1 header, Balanced (Fast) in modes table, CP_PASS3_REVIEW in checkpoints, parallel/section-selective/auto-stop notes, version history |
| `CHANGELOG.md` | This entry |

### Pipeline Changes Summary

| Improvement | Description | Savings |
|-------------|-------------|---------|
| **Balanced (Fast)** | L1-2 + L3 merged into single G6 call | 1 G5 + 1 F5 + 1 checkpoint |
| **Rich Checkpoint v2.0** | Section-level tables, 6 options | Better user control |
| **G5+F5 parallel** | Read-only agents run simultaneously | ~50% per-pass verification time |
| **Target auto-stop** | Auto-recommend accept when target met | Fewer unnecessary passes |
| **Section-selective** | Transform only specified sections | Faster, more targeted |

---

## [10.1.1] - 2026-02-23 (Typographic Enforcement + Zotero Removal)

### Overview

**Diverga v10.1.1** — Enforces proper typographic characters (Unicode em dash, en dash, smart quotes) across G6 output and F5 verification. Removes Zotero MCP from `.mcp.json`.

### Changes

- **Typographic enforcement in CLAUDE.md**: Added "Typographic Character Enforcement" subsection to Humanization Pipeline documentation
- **Zotero MCP removed**: Deleted `zotero` entry from `.mcp.json` (3 servers remain: diverga, humanizer, context7)
- **G6 SKILL.md**: "Use Proper Typographic Characters" rule already present (Section 1b)
- **Humanize SKILL.md**: "Typographic Character Mandate" block already present

### Updated Files

| File | Changes |
|------|---------|
| `CLAUDE.md` | Added typographic enforcement section, removed zotero from MCP count |
| `CHANGELOG.md` | This entry |
| `.mcp.json` | Removed `zotero` MCP server entry |

---

## [10.1.0] - 2026-02-23 (Humanize Orchestration Skill)

### Overview

**Diverga v10.1.0** — Adds the `/diverga:humanize` orchestration skill that enforces the full multi-pass 4-layer pipeline with mandatory human checkpoints between every pass. Includes pipeline v3.0 reference document upgrade and checkpoint map updates.

### New Features

- **`/diverga:humanize` skill**: Multi-pass pipeline orchestrator (545 lines) that enforces:
  - Sequential G5 → G6 → F5 execution within each pass
  - Mandatory `AskUserQuestion` at CP_HUMANIZATION_REVIEW, CP_PASS1_REVIEW, CP_PASS2_REVIEW, CP_PASS3_REVIEW, CP_FINAL_REVIEW
  - OMC autonomous mode defense (ignores ralph/ultrawork/autopilot hooks during checkpoints)
  - Mode routing: conservative (Pass 1 only), balanced (Pass 1-2), aggressive (Pass 1-3)
  - Section-aware mode escalation, diminishing returns detection, revert protocol
  - Humanizer MCP v3.0 integration (5 tools, 13 metrics)

### Updated Files

| File | Changes |
|------|---------|
| `skills/humanize/SKILL.md` | **New** — Pipeline orchestration skill |
| `mcp/agent-prerequisite-map.json` | Added CP_PASS1/2/3_REVIEW + CP_FINAL_REVIEW checkpoints |
| `humanization-pipeline.md` | v2.0 → v3.0: Pass 3 (discourse DT1-DT4), Pass 4 (polish), 4-layer pipeline states, MCP v3.0 tool integration |

---

## [10.0.0] - 2026-02-23 (Discourse-Level Detection & 4-Layer Humanization)

### Overview

**Diverga v10.0.0** — Major upgrade adding discourse-level AI detection and transformation. G5/G6/F5 agents upgraded to v3.0 with 4-layer humanization pipeline, 13 quantitative metrics, 6-component composite scoring, and DT1-DT4 discourse transformation strategies. Requires Humanizer MCP v3.0.0.

### Breaking Changes

- **G5 composite scoring**: v2.0 formula (4 components) replaced by v3.0 formula (6 components). Pattern weight reduced from 0.60 to 0.40; new discourse_penalty (0.15) and psycholinguistic_penalty (0.10) components added.
- **G6 transformation layers**: 3-layer pipeline expanded to 4-layer. New Layer 4 (Discourse) with DT1-DT4 strategies.
- **F5 verification domains**: 7 domains expanded to 8. New Domain 8 (Discourse Naturalness).
- **Multi-pass pipeline**: 2-pass (vocab/structural) expanded to 3+1 pass (vocab/structural/discourse/polish).

### Key Highlights

- **28 AI pattern categories across 7 domains**: Added Domain 7 (Discourse Patterns) with D1-D4
- **13 quantitative metrics**: 9 new metrics (hapax rate, contraction density, paragraph length variance, surprisal proxy, surprisal autocorrelation, connective diversity, pronoun density, question ratio, abstract noun ratio)
- **v3.0 composite scoring**: 6-component formula with discourse and psycholinguistic penalties
- **4-layer transformation**: Vocabulary -> Phrase -> Structure -> Discourse
- **DT1-DT4 discourse strategies**: Rhetorical move reordering, digression injection, argument structure diversification, connective reduction
- **Perturbation naturalization**: Human-like edit patterns (~74% substitution, ~18% deletion, ~8% insertion)
- **7 discipline profiles**: default, psychology, management, education, stem, humanities, social_sciences
- **Section-conditional weights**: Discussion 1.1x, Abstract 1.05x, Methods 0.8x
- **humanizer_discourse() MCP integration**: New MCP tool for discourse-level metrics

### Agent Updates

| Agent | Version | Changes |
|-------|---------|---------|
| G5-AcademicStyleAuditor | v3.0.0 | +D1-D4 discourse patterns, v3.0 composite (6 components), section-conditional weights, 7 discipline profiles, humanizer_discourse() integration |
| G6-AcademicStyleHumanizer | v3.0.0 | +Layer 4 (DT1-DT4), perturbation naturalization, 3+1 pass pipeline, section-conditional Layer escalation |
| F5-HumanizationVerifier | v3.0.0 | +Domain 8 (Discourse Naturalness), v3.0 composite verification, discourse/psycholinguistic regression checking |

### Reference Document Updates

| Document | Changes |
|----------|---------|
| `quantitative-metrics.md` | 13 metrics (9 new), v3.0 composite formula, discipline profiles |
| `detection-rules.md` | D1-D4 rules, section-conditional weights, v3.0 scoring |

### Requires

- Humanizer MCP v3.0.0 (`humanizer_discourse` tool, v3.0 composite scoring)

### Files Changed

| File | Change |
|------|--------|
| `agents/g5.md` | v3.0.0 — discourse detection, 6-component scoring |
| `agents/g6.md` | v3.0.0 — Layer 4 DT1-DT4, perturbation naturalization |
| `agents/f5.md` | v3.0.0 — Domain 8, v3.0 verification |
| `.claude-plugin/plugin.json` | Version 10.0.0 |
| `.claude/references/agents/g5/quantitative-metrics.md` | v3.0.0 — 13 metrics |
| `.claude/references/agents/g5/detection-rules.md` | v3.0.0 — D1-D4, v3.0 scoring |
| `CHANGELOG.md` | v10.0.0 entry |
| `CLAUDE.md` | Version references updated |

---

## [9.2.1] - 2026-02-23 (Zero-Setup MCP — Global Auto-Registration)

### Overview

**Diverga v9.2.1** — All MCP servers now auto-register via the plugin `.mcp.json`. Installing the Diverga plugin is all users need — no manual `settings.json` configuration required. Adopts the [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) plugin distribution strategy: `uvx` for Python servers, `npx` for Node.js servers, `${CLAUDE_PLUGIN_ROOT}` for bundled servers.

### Key Highlights

- **Zero-setup MCP stack**: Plugin install activates all 4 MCP servers automatically
- **No hardcoded paths**: Replaced `/Users/.../` paths with `uvx`/`npx` auto-install commands
- **OMC strategy adopted**: Same distribution pattern as oh-my-claudecode's `.mcp.json` + bridge servers
- **Global deployability**: Any user on any machine gets the full MCP stack by installing the plugin

### MCP Auto-Registration (`.mcp.json`)

| Server | Strategy | Tools | Install Method |
|--------|----------|-------|---------------|
| **diverga** | `${CLAUDE_PLUGIN_ROOT}` bundle | 16 tools (checkpoint/memory/comm) | Bundled in plugin |
| **humanizer** | `uvx --from git+GitHub` | 4 tools (stylometric metrics) | Auto from GitHub |
| **zotero** | `uvx zotero-mcp serve` | ~20 tools (reference management) | Auto from PyPI |
| **context7** | `npx -y @upstash/context7-mcp` | 2 tools (docs lookup) | Auto from npm |

### Distribution Strategy Reference

| Pattern | Source | Example |
|---------|--------|---------|
| `${CLAUDE_PLUGIN_ROOT}` | OMC bridge servers | `diverga-server.js` (bundled Node.js) |
| `uvx --from git+...` | GitHub direct | `humanizer-mcp` (Python, no PyPI needed) |
| `uvx <package>` | PyPI | `zotero-mcp serve` (Python) |
| `npx -y <package>` | npm | `@upstash/context7-mcp` (Node.js) |

### Files Changed

| File | Change |
|------|--------|
| `.mcp.json` | Added humanizer, zotero, context7 auto-registration |
| `CLAUDE.md` | Version bump to v9.2.1 |
| `.claude-plugin/plugin.json` | Version bump to v9.2.1 |

### Migration for Existing Users

Users with manual `settings.json` entries for humanizer, zotero, or context7 can safely remove them — the plugin handles registration automatically. Only non-Diverga servers (exa, filesystem, github, supabase) need to remain in `settings.json`.

---

## [9.2.0] - 2026-02-23 (MCP Tool Integration — Humanizer Server)

### Overview

**Diverga v9.2.0** — Adds the `humanizer` MCP server (Python, 4 tools) providing exact stylometric computation for the G5/G6/F5 humanization pipeline. Replaces LLM estimation of burstiness CV, MTLD, Fano Factor, and other quantitative metrics with algorithmic precision. Resolves 5 of 6 known gaps from the v2.0 pipeline release.

### Key Highlights

- **Humanizer MCP server**: 4 tools (`humanizer_metrics`, `humanizer_verify`, `humanizer_diff`, `humanizer_status`) via `stdio` transport
- **Precise stylometric computation**: Burstiness CV, MTLD (McCarthy & Jarvis 2010), Fano Factor, sentence length range, paragraph opener diversity, hedge density, composite AI probability scoring
- **Feedback loop** (Gap 1): `humanizer_verify` returns `needs_another_pass` with specific recommendations
- **Discipline calibration** (Gap 3): Psychology, management, education profiles with field-specific thresholds
- **Diff visualization** (Gap 5): `humanizer_diff` with per-metric deltas and improvement percentages
- **Pattern recovery detection** (Gap 6): Regression detection for opener diversity and burstiness
- **Hedge density tracking** (Gap 7): Per-sentence hedge word counting
- **120 tests passing** (84 pipeline + 36 MCP server)

### MCP Tools

| Tool | Purpose | Pipeline Stage |
|------|---------|---------------|
| `humanizer_metrics` | Full stylometric analysis | G5 Analysis |
| `humanizer_verify` | Before/after comparison, regression detection | After each G6 pass |
| `humanizer_diff` | Per-metric delta report | Checkpoint reports |
| `humanizer_status` | Readiness assessment with discipline calibration | Pipeline start |

### Agent Updates

| Agent | Change |
|-------|--------|
| **G5** (Academic Style Auditor) | Added MCP integration: calls `humanizer_metrics` and `humanizer_status` when available |
| **G6** (Academic Style Humanizer) | Added MCP integration: calls `humanizer_verify` and `humanizer_diff` after transformation |
| **F5** (Humanization Verifier) | Added MCP integration: calls `humanizer_verify` for Domains 5-6 (burstiness, structural) |
| **Humanization Pipeline** | Added MCP Tool Integration v2.1 section with tool call sequence and discipline calibration |

### Files Changed

| File | Change |
|------|--------|
| `agents/g5.md` | Added MCP Tool Integration section |
| `agents/g6.md` | Added MCP Tool Integration section |
| `agents/f5.md` | Added MCP Tool Integration section |
| `.claude/references/.../humanization-pipeline.md` | Added MCP Tool Integration v2.1 section |

### Gaps Resolved

| Gap | Status |
|-----|--------|
| Gap 1: Feedback loop | Resolved — `humanizer_verify` `needs_another_pass` |
| Gap 3: Discipline calibration | Resolved — `humanizer_status` profiles |
| Gap 5: Diff visualization | Resolved — `humanizer_diff` deltas |
| Gap 6: Pattern recovery | Resolved — regression detection |
| Gap 7: Hedge calibration | Resolved — `hedge_density` metric |
| Gap 4: Custom preservation lists | Open — future release |

### Related Repository

Humanizer MCP server: https://github.com/HosungYou/humanizer (v2.1.0)

---

## [9.0.0] - 2026-02-16 (Architecture — SQLite + MCP Server Split)

### Overview

**Diverga v9.0.0** — Major architecture release replacing the monolithic checkpoint server with a modular 3-server architecture backed by SQLite for ACID-safe parallel agent execution.

### Key Highlights

- **MCP server 3-split**: Monolithic `checkpoint-server.js` (7 tools) → modular `diverga-server.js` (16 tools) across checkpoint, memory, and comm servers
- **SQLite backend**: WAL-mode SQLite as primary store for parallel-safe operations (YAML/JSON preserved as default for backward compatibility)
- **Dual backend**: `DIVERGA_BACKEND=sqlite` env var enables SQLite; default remains YAML for seamless v8.x upgrade
- **Auto-migration**: First SQLite startup auto-imports existing YAML/JSON data (checkpoints, decisions, project state, priority context, agents, messages)
- **Agent messaging**: 6 new comm tools for inter-agent communication (register, list, send, mailbox, acknowledge, broadcast)
- **464 tests**: Comprehensive TDD coverage across 9 test suites

### Architecture

```
Layer 3: diverga-server.js ──→ tool-registry.js (16 tools)
              │
Layer 2: checkpoint-server    memory-server     comm-server
              │                    │                  │
         ┌────┴────┐         ┌────┴────┐        ┌────┴────┐
         │  YAML   │         │  YAML   │        │  JSON   │
         │(default)│         │(default)│        │(default)│
         └─────────┘         └─────────┘        └─────────┘
              │                    │                  │
         ┌────┴────────────────────┴──────────────────┴────┐
         │           sqlite-servers.js (WAL mode)          │
         │     DIVERGA_BACKEND=sqlite activates this       │
         └─────────────────────────────────────────────────┘

Layer 1: sqlite-state.js    messaging.js    constants.js  utils.js
```

### New MCP Tools (16 total, up from 7)

| Category | Tool | Description |
|----------|------|-------------|
| **Checkpoint** (3) | `diverga_check_prerequisites` | Verify agent prerequisites |
| | `diverga_mark_checkpoint` | Record checkpoint decision |
| | `diverga_checkpoint_status` | Full checkpoint overview |
| **Memory** (7) | `diverga_project_status` | Read project state |
| | `diverga_project_update` | Update project state (deep merge) |
| | `diverga_decision_add` | Record research decision |
| | `diverga_decision_list` | List/filter decisions |
| | `diverga_priority_read` | Read priority context |
| | `diverga_priority_write` | Write priority context |
| | `diverga_export_yaml` | Export all state as YAML |
| **Comm** (6) | `diverga_agent_register` | Register agent for messaging |
| | `diverga_agent_list` | List registered agents |
| | `diverga_message_send` | Send agent-to-agent message |
| | `diverga_message_mailbox` | Read agent inbox |
| | `diverga_message_acknowledge` | Acknowledge message |
| | `diverga_message_broadcast` | Broadcast to all agents |

### New Files

| File | Purpose |
|------|---------|
| `mcp/diverga-server.js` | Unified MCP entry point (replaces checkpoint-server.js) |
| `mcp/lib/tool-registry.js` | Tool definitions + dispatch routing |
| `mcp/lib/sqlite-servers.js` | SQLite-backed server factory + migration |
| `mcp/lib/sqlite-state.js` | SQLite state store (checkpoints, decisions, state) |
| `mcp/lib/messaging.js` | SQLite messaging (channels, progress, relays) |
| `mcp/lib/constants.js` | Shared CHECKPOINT_LEVELS |
| `mcp/lib/utils.js` | Shared deepMerge utility |
| `mcp/servers/checkpoint-server.js` | Checkpoint + prerequisites (YAML) |
| `mcp/servers/memory-server.js` | Project state + decisions (YAML) |
| `mcp/servers/comm-server.js` | Agent messaging (JSON) |

### Test Coverage

| Suite | Tests | Description |
|-------|-------|-------------|
| sqlite-state-v9 | 48 | SQLite state store |
| messaging-v9 | 45 | Agent messaging |
| checkpoint-server-v9 | 37 | Checkpoint server |
| memory-server-v9 | 55 | Memory server |
| comm-server-v9 | 85 | Comm server |
| tool-registry-v9 | 43 | Tool registration |
| sqlite-servers-v9 | 72 | SQLite backend + migration |
| integration-v9 | 23 | End-to-end (both backends) |
| checkpoint-server (legacy) | 56 | v8 backward compatibility |
| **Total** | **464** | **All passing** |

### Migration Guide

v8.5.0 → v9.0.0:

**Default (YAML backend — no changes needed)**:
- `.mcp.json` updated to point to `diverga-server.js` (automatic via plugin update)
- All 7 existing tool names preserved; 9 new tools available
- Existing YAML/JSON files continue working as before

**SQLite backend (opt-in)**:
```bash
export DIVERGA_BACKEND=sqlite
# First run auto-migrates existing YAML/JSON → SQLite
# DB stored at .research/diverga.db
```

### Breaking Changes

None. Default YAML backend is fully backward-compatible with v8.x.

---

## [8.5.0] - 2026-02-15 (Developer Experience & Agent Teams Pilot)

### Overview

**Diverga v8.5.0** — Developer Experience release introducing automated code generation, version synchronization, release automation, and Agent Teams pilot for parallel agent execution.

### Key Highlights

- **Single Source of Truth**: `config/agents.json` (44 agents) drives all derived files via `scripts/generate.js`
- **Version drift eliminated**: `scripts/sync-version.js` propagates version across 100+ files automatically
- **Release automation**: `scripts/release.js` — one command for version bump, sync, generate, changelog, git tag
- **Diagnostics**: `scripts/doctor.js` — 9 automated checks in <1 second
- **Agent Teams pilot**: I0 Team Lead mode with 3x parallel database fetching via native Claude Code TeamCreate/TaskCreate/SendMessage
- **Pre-commit hooks**: husky enforces version consistency and code generation freshness

### New Features

- **feat(ssot)**: `config/agents.json` — Single Source of Truth for all 44 agents
  - Full metadata: id, displayName, category, tier, model, triggers (en/ko), prerequisites, checkpoints, VS level
  - `config/agents.schema.json` for JSON Schema validation
  - Adding a new agent: edit 3 files (was 9)

- **feat(generate)**: `scripts/generate.js` — Code generation from SSoT
  - Output 1: `src/agents/definitions.generated.ts` (TypeScript agent configs)
  - Output 2: `mcp/agent-prerequisite-map.json` (checkpoint prerequisites)
  - Output 3: `AGENTS.md` (agent table between GENERATED markers)
  - `--check` mode for CI verification (idempotent)

- **feat(version)**: `scripts/sync-version.js` — Version synchronization
  - Source: `package.json` version field
  - Targets: pyproject.toml, src/index.ts, config/diverga-config.json, 53 SKILL.md, 47 Codex SKILL.md
  - Fixed drift: pyproject.toml 8.0.1→8.4.0, src/index.ts 8.1.0→8.4.0

- **feat(release)**: `scripts/release.js` — Release automation
  - `node scripts/release.js [patch|minor|major|X.Y.Z] [--dry-run]`
  - Chains: version bump → sync → generate → changelog → git commit + tag

- **feat(doctor)**: `scripts/doctor.js` — 9 diagnostic checks
  - Node.js version, git status, version consistency, agent count, SKILL.md presence, Codex SKILL.md, MCP server, TypeScript, package.json scripts

- **feat(teams)**: Agent Teams pilot (I0 Team Lead mode)
  - I0 creates `scholarag-pipeline` team with TeamCreate
  - 3 parallel I1 instances for Semantic Scholar, OpenAlex, arXiv
  - TaskCreate with `blockedBy` for automatic dependency management
  - Checkpoint approvals relayed via SendMessage
  - Fallback to sequential mode when teams unavailable
  - Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

- **feat(hooks)**: husky pre-commit hook
  - Runs `npm run precommit` (version:check + generate:check)
  - Blocks commit if version drift or stale generated files detected

### Files Added (8)

| File | Size | Purpose |
|------|------|---------|
| `config/agents.json` | 45KB | SSoT for 44 agents |
| `config/agents.schema.json` | 4.8KB | JSON Schema validation |
| `scripts/generate.js` | 18KB | Code generation from SSoT |
| `scripts/sync-version.js` | 7KB | Version synchronization |
| `scripts/release.js` | 7.6KB | Release automation |
| `scripts/doctor.js` | 7.1KB | Diagnostic tool |
| `src/agents/definitions.generated.ts` | 36KB | Generated TypeScript definitions |
| `.husky/pre-commit` | 71B | Pre-commit validation hook |

### Files Modified (Key)

| File | Changes |
|------|---------|
| `package.json` | 8 new scripts (generate, version:sync/check, release, doctor, precommit, test:all), husky devDependency |
| `pyproject.toml` | Version 8.0.1 → 8.5.0 (drift fix) |
| `src/index.ts` | Version 8.1.0 → 8.5.0 (drift fix) |
| `skills/i0/SKILL.md` | Agent Teams Team Lead Protocol section |
| `skills/research-orchestrator/SKILL.md` | Agent Teams Dispatch option |
| `CLAUDE.md` | Agent Teams v8.5 section, 4 team patterns |
| `AGENTS.md` | Regenerated table from agents.json |
| `mcp/agent-prerequisite-map.json` | Regenerated from agents.json |
| 53 `skills/*/SKILL.md` | Version sync to 8.5.0 |
| 47 `.codex/skills/*/SKILL.md` | Version sync to 8.5.0 |

### Package.json Scripts Added

```json
"generate": "node scripts/generate.js --write",
"generate:check": "node scripts/generate.js --check",
"version:sync": "node scripts/sync-version.js --fix",
"version:check": "node scripts/sync-version.js --check",
"release:patch": "node scripts/release.js patch",
"release:minor": "node scripts/release.js minor",
"release:major": "node scripts/release.js major",
"doctor": "node scripts/doctor.js"
```

### Agent Teams Patterns (4)

| Pattern | Use Case | Agents | Speedup |
|---------|----------|--------|---------|
| Parallel Specialists | Literature review | B1+B2+B3 → B4 | ~60% |
| Pipeline | Systematic review | I0→I1(×3)→I2→I3 | ~40% |
| Competing Hypotheses | Research design | A1+A2+A5 | 3 perspectives |
| QA Swarm | Quality check | F1+F3+F4+F5 | 4-angle |

### Breaking Changes

None. Full backward compatibility maintained.

### Migration Guide

v8.4.0 → v8.5.0:
- **Existing installations**: Re-run `scripts/install.sh` to get updated skills
- **Developer workflow**: Run `npm run doctor` to verify installation health
- **New workflow**: Use `npm run generate` after editing `config/agents.json`
- **Agent Teams**: Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` to enable

### Verification

```
✓ Node.js v25.2.1 (>= 18.0.0)
✓ Git repository (branch: main)
✓ Version consistency (8.5.0 across all files)
✓ Agent count: 44 agents in config/agents.json
✓ SKILL.md files: 44/44 present
✓ Codex SKILL.md: 44/44 present
✓ MCP server: checkpoint-server.js exists
✓ TypeScript: no errors
✓ Package.json: 8/8 scripts defined
Summary: 9/9 checks passed
```

---

## [8.4.0] - 2026-02-12 (Researcher Visibility & Pipeline Safety)

### Overview

**Diverga v8.4.0** - Addresses two critical usability issues: hidden research files and silent API key failures.

### Key Highlights

- **Dual directory structure**: `.research/` (system) + `research/` (researcher-visible)
- **Automatic migration**: Existing `.research/` projects auto-migrate public files on first access
- **New checkpoint**: 🔴 `SCH_API_KEY_VALIDATION` blocks pipeline when required API keys are missing
- **Full backward compatibility**: No breaking changes for existing projects

### New Features

- **feat(directory)**: Split `.research/` into dual structure
  - `.research/` → System-only files (HUD cache, priority context, sessions)
  - `research/` → Researcher-visible files (project state, decisions, checkpoints, baselines)
  - Auto-migration on first access (copies, preserves originals)

- **feat(checkpoint)**: `SCH_API_KEY_VALIDATION` checkpoint (🔴 REQUIRED)
  - Blocks I1-PaperRetrievalAgent when Scopus/WoS API keys are missing
  - AskUserQuestion with 3 options: Provide Key, Skip DB, Pause
  - `validateApiKeys()` utility function exported from checkpoint-logic.js

- **feat(hud)**: `findProjectRoot()` searches both `research/` and `.research/`
  - `loadProjectState()`, `loadCheckpoints()` try public path first
  - `calculateMemoryHealth()` checks both locations

### Files Changed (9)

- `mcp/lib/checkpoint-logic.js` - Dual-path system, migration, validateApiKeys()
- `mcp/checkpoint-server.js` - getPublicResearchDir() function
- `lib/hud/state.ts` - Dual-directory search in 4 functions
- `.opencode/plugins/diverga/hooks/context-manager.ts` - CONTEXT_PATHS updated
- `mcp/agent-prerequisite-map.json` - SCH_API_KEY_VALIDATION registered
- `.claude/references/checkpoint-templates.md` - New bilingual template
- `skills/i1/SKILL.md` - Error handling fix + checkpoint protocol
- `.claude/checkpoints/checkpoint-definitions.yaml` - New checkpoint definition
- `CLAUDE.md` - Documentation updates

### Breaking Changes

None. Full backward compatibility maintained.

---

## [8.3.0] - 2026-02-12 (Cross-Platform Migration)

### Overview

**Diverga v8.3.0** - Cross-platform migration release bringing Codex CLI and OpenCode support up to parity with Claude Code v8.2.0 feature set. Introduces 47 individual skill files, GPT-5.3-Codex model routing, and comprehensive cross-platform documentation.

### Key Highlights

- **47 individual SKILL.md files** for Codex CLI (44 agents + 3 utilities)
- **GPT-5.3-Codex model routing** across all tiers (HIGH/MEDIUM/LOW)
- **44 total agents** (Category I: ScholaRAG agents added in v6.7)
- **Cross-platform compatibility improved**: Codex CLI ~40% → ~75%, OpenCode ~20% → ~70%
- **No breaking changes** for Claude Code users

### Platform Compatibility

| Platform | v8.2.0 | v8.3.0 | Improvement |
|----------|--------|--------|-------------|
| Claude Code | 100% | 100% | - |
| Codex CLI | ~40% | **~75%** | +35% |
| OpenCode | ~20% | **~70%** | +50% |

### New Features

- **feat(codex-cli)**: 47 individual skill files in `.codex/skills/diverga-*/`
  - 44 agent skills (A1-I3) + 3 utility skills (setup, memory, help)
  - YAML frontmatter with name, description (<500 chars), metadata
  - Codex CLI Degraded Mode instructions per skill
  - Text-based checkpoint protocol (replaces MCP runtime)
  - Tool mapping tables (Claude Code → Codex CLI)
  - Bilingual triggers (English + Korean)

- **feat(models)**: GPT-5.3-Codex model routing
  - HIGH tier: o3 → `gpt-5.3-codex` (most capable agentic coding model)
  - MEDIUM tier: gpt-4.1 → `gpt-5.2-codex`
  - LOW tier: gpt-4.1-mini → `gpt-5.1-codex-mini`

- **feat(templates)**: AGENTS.md.template v8.3.0 rewrite
  - 40 → 44 agents (Category I: I0-I3 ScholaRAG agents)
  - Full Agent Prerequisite Map
  - Checkpoint Dependency Order (Level 0-5)
  - SCH_* checkpoints for systematic review automation
  - Memory system reference (.research/ directory)

- **feat(opencode)**: oh-my-opencode.template.json v8.3.0
  - I0-I3 triggers with EN+KR keywords
  - Model routing for all 44 agents
  - SCH_* checkpoints in required/recommended sections

### CLI Tool Updates

- **feat(diverga-codex.cjs)**: v6.6.1 → v8.3.0
  - 44 agents (was 40), 9 categories (was 8)
  - New `prereq` command showing Agent Prerequisite Map
  - SCH_* checkpoints added
  - Fixed agent tier assignments (A3→HIGH, B5→HIGH, F5→LOW, G6→HIGH)

- **feat(install-multi-cli.sh)**: v6.6.2 → v8.3.0
  - Copies individual `.codex/skills/` directories
  - `.research/` directory initialization
  - Node.js >= 18 version check
  - Post-install verification

### New Documentation

| File | Description |
|------|-------------|
| `docs/RELEASE-NOTES-v8.3.0.md` | Comprehensive release notes |
| `docs/CROSS-PLATFORM-GUIDE.md` | Unified guide for all platforms |
| `docs/PLATFORM-LIMITATIONS.md` | Detailed limitation specs with workarounds |

### Updated Documentation

| File | Changes |
|------|---------|
| `docs/CODEX-SKILL-SYSTEM.md` | v6.6.2 → v8.3.0, individual skills, GPT-5.3-Codex |
| `adapters/README.md` | Cross-platform compatibility table |
| `CLAUDE.md` | Research Coordinator v8.3.0 integration |

### Known Limitations (Codex CLI / OpenCode)

- No parallel agent execution (sequential only)
- No MCP runtime checkpoints (text-based behavioral enforcement)
- No AskUserQuestion structured UI (text prompts)
- No HUD statusline
- Single model session (no per-agent model isolation)

### Migration Guide

v8.2.0 → v8.3.0 migration:

**Claude Code users** (no breaking changes):
- Optional: Update AGENTS.md with `cp AGENTS.md.template AGENTS.md`
- All existing workflows continue to work

**Codex CLI users** (new platform support):
```bash
curl -sSL https://raw.githubusercontent.com/HosungYou/Diverga/main/scripts/install-multi-cli.sh | bash -s -- --codex
```

**OpenCode users** (new platform support):
```bash
curl -sSL https://raw.githubusercontent.com/HosungYou/Diverga/main/scripts/install-multi-cli.sh | bash -s -- --opencode
```

### File Summary

| Category | Count | Description |
|----------|-------|-------------|
| New Codex Skills | 47 | `.codex/skills/diverga-*/SKILL.md` |
| Updated Templates | 3 | AGENTS.md.template, oh-my-opencode.template.json, claude-settings |
| Updated CLI Tools | 2 | diverga-codex.cjs, install-multi-cli.sh |
| New Documentation | 3 | RELEASE-NOTES-v8.3.0.md, CROSS-PLATFORM-GUIDE.md, PLATFORM-LIMITATIONS.md |
| Updated Documentation | 3 | CODEX-SKILL-SYSTEM.md, adapters/README.md, CLAUDE.md |
| **Total** | **58+** | |

---

## [8.2.0] - 2026-02-12 (MCP Runtime Checkpoint Enforcement)

### Overview

**Diverga v8.2.0** — MCP Runtime Checkpoint Enforcement release introducing a 7-tool MCP server for runtime checkpoint verification, SKILL.md simplification, state path unification, and Priority Context for compression-resilient sessions.

### Key Highlights

- **MCP Checkpoint Server** — 7 runtime verification tools for checkpoint enforcement
- **SKILL.md Simplification** — 675 lines saved across 28 agents (35-line → 8-line checkpoint sections)
- **State Path Unification** — All checkpoint state under `.research/` directory
- **Priority Context** — 500-char compression-resilient summary for long sessions
- **Memory System Optimization** — Removed 104 unused Python files, replaced by MCP server

### MCP Tools

| Tool | Description |
|------|-------------|
| `diverga_check_prerequisites` | Verify agent prerequisites before execution |
| `diverga_mark_checkpoint` | Record checkpoint decision with rationale |
| `diverga_checkpoint_status` | Full checkpoint overview (passed/pending/blocked) |
| `diverga_priority_read` | Read compression-resilient priority context |
| `diverga_priority_write` | Update priority context |
| `diverga_project_status` | Full project status with research context |
| `diverga_decision_add` | Record research decisions to audit trail |

### New Enforcement Rules

- **Rule 5: Override Refusal** — REQUIRED checkpoints cannot be skipped; AskUserQuestion template presented instead of text refusal
- **Rule 6: MCP-First Verification** — `diverga_check_prerequisites(agent_id)` before execution, fallback to `.research/decision-log.yaml`

### What Changed

- `.claude/state/checkpoints.json` → `.research/checkpoints.yaml` (auto-migrated)
- 28 SKILL.md checkpoint sections simplified to MCP-based format
- `lib/memory/` (104 files) removed — replaced by MCP server (3 files, ~200 lines)
- 6 new checkpoint definitions added
- Override Refusal template added to checkpoint-templates.md

### Migration

1. `git pull origin main`
2. `cd mcp && npm install`
3. Re-sync skills if using local install
4. Restart Claude Code

### Tests

- 56 unit tests for MCP checkpoint server (100% pass)
- Zero external test dependencies (Node.js built-in `node:test`)

### Stats

- **145 files changed** | +2,825 / -27,111 lines
- **53 SKILL.md** files updated to v8.2.0
- **44 agents** with prerequisite map

---

## [8.1.0] - 2026-02-09 (Checkpoint Enforcement Strengthening)

### Overview

**Diverga v8.1.0** - Checkpoint enforcement overhaul ensuring AskUserQuestion tool
is called at every human decision point. Fixes ad-hoc and multi-agent invocation
scenarios where checkpoints were silently skipped.

### Critical Changes

- **feat(enforcement)**: Mandatory AskUserQuestion tool usage at all checkpoints
  - Text-based questions no longer count as checkpoint compliance
  - Structured options with bilingual labels (EN/KR)

- **feat(prerequisites)**: Agent Prerequisite Map with dependency ordering
  - No-skip policy: REQUIRED checkpoints cannot be bypassed
  - Ad-hoc agent calls now verify prerequisites before execution

- **feat(multi-agent)**: Parallel agent checkpoint coordination
  - Union of prerequisites collected across simultaneously triggered agents
  - Dependency-ordered sequential AskUserQuestion calls
  - Parallel execution only after all prerequisites cleared

### Files Added

| File | Description |
|------|-------------|
| `.claude/references/checkpoint-templates.md` | AskUserQuestion parameter templates for 22 checkpoints |

### Files Modified (Key)

| File | Changes |
|------|---------|
| `CLAUDE.md` | Enforcement Protocol, Agent Prerequisite Map, Dependency Order, Multi-Agent rules |
| `skills/research-coordinator/SKILL.md` | Enforcement rules overhaul, Multi-Agent Dispatch Protocol |
| `skills/{25 agents}/SKILL.md` | Checkpoint Execution Block inserted after frontmatter |
| `.opencode/plugins/diverga/types.ts` | `prerequisites` field added to AgentInfo |
| `.opencode/plugins/diverga/agents.ts` | Prerequisites data for all agents |
| `.opencode/plugins/diverga/checkpoints.ts` | Missing checkpoint definitions added |
| `.opencode/plugins/diverga/hooks/checkpoint-enforcer.ts` | AGENT_PREREQUISITES mapping + multi-agent union logic |
| `scripts/install.sh` | Version bump to 8.1.0 |
| `README.md` | Version badge update |

### Migration Guide

v8.0.x → v8.1.0 migration:
- **Existing installations**: Re-run `scripts/install.sh` to get updated skills
- **No breaking changes**: All existing workflows continue to work
- **New behavior**: AskUserQuestion tool will now fire at checkpoints
  that previously only showed text questions
- **Researcher impact**: More structured decision prompts with clickable options

---

## [8.0.2] - 2026-02-07 (Doctor Diagnostics Skill)

### New Features

- **feat(skill)**: Added `/diverga:doctor` system diagnostics skill
  - 5-layer diagnostic checks: Plugin Health, Skill Sync, Config Validity, API Keys, Project State
  - OpenClaw-style Check-Report-Fix pattern: every issue includes actionable fix command
  - Read-only diagnostics — no file modifications
  - Referenced from `/diverga` dashboard Quick Actions

### Files Added

| File | Description |
|------|-------------|
| `skills/doctor/SKILL.md` | Doctor diagnostics skill definition |

---

## [8.0.1-patch3] - 2026-02-07 (8-Dimension Diagnostic Sweep & Deep Fix)

### Overview

Comprehensive 8-dimension diagnostic sweep using multi-agent parallel analysis (version audit, agent definitions audit, build/TS diagnostics, code quality review, security review, architecture review, documentation consistency, test coverage analysis). Found and fixed 16+ issues across the entire codebase.

### Critical Fixes

- **fix(types)**: Added Category I ('I') to `CategoryId` union type, `CATEGORIES` record, and `CATEGORY_TOOLS` record in `src/agents/types.ts`
- **fix(definitions)**: Registered I0-I3 agents in `AGENT_MAPPINGS` and `AGENT_CONFIGS` in `src/agents/definitions.ts` (40→44 agents)
- **fix(index)**: Updated VERSION from '6.5.0' to '8.0.1', converted CJS `require()` to ESM `import()`, added category 'I' support in `src/index.ts`

### Version Synchronization (8 additional files)

| File | Old Version | New Version |
|------|-------------|-------------|
| `lib/index.ts` | 6.0.0 | 8.0.1 |
| `lib/agents/discovery.ts` | 6.0.0 | 8.0.1 |
| `packages/codex-setup/src/index.ts` | 6.6.1 | 8.0.1 |
| `.opencode/plugins/diverga/index.ts` | 6.6.1 | 8.0.1 |
| `.opencode/plugins/diverga/hooks/context-manager.ts` | 6.0.0 | 8.0.1 |

### Library Fixes (lib/)

- **fix(lib/types)**: Added Category I to `CATEGORIES` in `lib/agents/types.ts`
- **fix(lib/parser)**: Updated regex from `[A-H]` to `[A-I]` in `lib/agents/parser.ts` to recognize Category I agents
- **fix(lib/index)**: Converted CJS `require()` to async ESM `import()` in `initializeDiverga()`

### Documentation Fixes

- **fix(AGENTS.md)**: Updated version references from v6.7.0 to v8.0.1 in section headers
- **fix(.codex/AGENTS.md)**: Updated agent count to 44, added Category I section with I0-I3
- **fix(README.md)**: Updated agent count from 40 to 44, BibTeX version from 6.7.0 to 8.0.1
- **fix(.opencode)**: Updated agent count from 40 to 44
- **fix(lib/memory)**: Updated IMPLEMENTATION_SUMMARY.md agent count from 40 to 44

### Diagnostic Findings (Advisory)

| Dimension | Agent | Key Finding |
|-----------|-------|-------------|
| Architecture | arch-reviewer (opus) | Dual registry (src/ vs lib/) confirmed; lib/ is legacy |
| Security | security-reviewer (opus) | 5 findings, overall LOW risk; path traversal in prompt-loader |
| Code Quality | code-reviewer (opus) | 12 issues; dead code in src/, fragile YAML parser |
| Test Coverage | qa-tester (sonnet) | 168 tests, zero TypeScript test coverage |

### Verification

- `tsc --noEmit`: 0 errors
- Stale version grep (6.0.0/6.5.0/6.6.1): 0 matches in source
- Stale agent count grep (40/33 agents): 0 matches
- 14 files changed, 137 insertions, 40 deletions

---

## [8.0.1] - 2026-02-05 (Installation Bug Fixes)

### Bug Fixes

- **fix(install)**: Fixed `ensure_repo()` stdout capture bug where log messages were mixed with path output
- **fix(install)**: Changed skill installation from symlinks to file copies - symlinks to `/tmp/` broke after temporary directory cleanup

### Technical Details

| Issue | Cause | Fix |
|-------|-------|-----|
| Install script path corruption | `log_info` stdout captured in `$(ensure_repo)` | Redirect log to stderr with `>&2` |
| Skills broken after reboot | Symlinks pointed to `/tmp/diverga-install-*/` | Use `cp -r` instead of `ln -sf` |

### Installation Verification

After installing v8.0.1:
```bash
# Skills should be directories, not symlinks
ls -la ~/.claude/skills/diverga-a1
# Should show: drwxr-xr-x (directory), NOT lrwxr-xr-x -> /tmp/...
```

---

## [8.0.0] - 2026-02-04 (Project Visibility & HUD Enhancement)

### Overview

**Diverga v8.0** - Project Visibility Enhancement with independent HUD, simplified setup, natural language project initialization, and auto-generated research documentation.

This release introduces major improvements to researcher experience:
- **File Structure Redesign**: `.research/` for system files, `docs/` for researcher-visible documentation
- **Independent HUD**: Standalone statusline display completely separate from oh-my-claudecode
- **Simplified Setup**: 3-step wizard (down from 9 steps)
- **Natural Language Start**: "I want to conduct a systematic review on AI" → auto-initialize project

### New Features

#### 1. File Structure Redesign

| Directory | Purpose | Visibility |
|-----------|---------|------------|
| `.research/` | System files (state, decisions, checkpoints) | Hidden |
| `docs/` | Researcher documentation (auto-generated) | Visible |

**New docs/ structure (7 files)**:

```
docs/
├── PROJECT_STATUS.md       # Progress overview with visual indicators
├── DECISION_LOG.md         # Human-readable decision history
├── RESEARCH_AUDIT.md       # IRB/reproducibility audit trail
├── METHODOLOGY.md          # Research design summary (NEW)
├── TIMELINE.md             # Milestones and deadlines (NEW)
├── REFERENCES.md           # Key papers and frameworks (NEW)
└── README.md               # Project overview (NEW)
```

**Auto-synchronization**: When decisions are made or checkpoints completed, `docs/` files update automatically.

#### 2. Independent Diverga HUD

Completely independent statusline display for research progress - no oh-my-claudecode dependency.

**HUD Presets**:

| Preset | Display | Use Case |
|--------|---------|----------|
| `research` (default) | Stage, Checkpoints, Memory | Daily research |
| `checkpoint` | Detailed checkpoint status | Decision sessions |
| `memory` | Memory health focus | Debugging |
| `minimal` | Stage only | Clean interface |

**Display Examples**:

```
research:   🔬 AI-Ethics-HR │ Stage: foundation │ ●●○○○○○○○○○ (2/11) │ 🧠 95%
checkpoint: 🔬 AI-Ethics-HR │ Stage: foundation
            Checkpoints: ●●○○○○○○○○○ (2/11)
             ✅ CP_RESEARCH_DIRECTION │ ✅ CP_PARADIGM_SELECTION
             🔴 CP_SCOPE_DEFINITION (pending)
minimal:    🔬 AI-Ethics-HR │ foundation
```

**StatusLine Integration**:

```json
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/hud/diverga-hud.mjs"
  }
}
```

#### 3. Simplified Setup (3 Steps)

| Step | Content | Changes from v7.0 |
|------|---------|-------------------|
| 1 | Welcome + Project Detection | Same |
| 2 | Checkpoint Level + HUD + Language | Combined 6 steps into 1 |
| 3 | Apply & Complete | Same |

**Removed**:
- LLM selection (Claude Code already authenticated)
- API key configuration (not needed)
- Paradigm selection (auto-detect or ask during research)

**New Options**:
- HUD enable/disable
- HUD preset selection

#### 4. Natural Language Project Initialization

**Detection Patterns**:

| Language | Patterns |
|----------|----------|
| English | "systematic review on/about {topic}", "meta-analysis on {topic}", "literature review about {topic}" |
| Korean | "체계적 문헌고찰", "체계적 리뷰", "메타분석", "메타 분석", "문헌고찰" |

**Research Types Detected**:
- `systematic_review` (체계적 문헌고찰)
- `meta_analysis` (메타분석)
- `literature_review` (문헌고찰)
- `experimental` (실험연구)
- `qualitative` (질적연구)
- `mixed_methods` (혼합연구)

**Flow**:
```
User: "I want to conduct a systematic review on AI in education"
        │
        ▼
  Intent Detection (confidence: 0.9)
        │
        ▼
  Confirmation Prompt (bilingual)
        │
   [Yes] → Auto-create .research/ and docs/
   [No]  → Continue as normal conversation
```

#### 5. Project Detection & Loading

**Session Start Behavior**:

```
┌─────────────────────────────────────────────────────────────────┐
│ Session Start                                                    │
│        │                                                        │
│        ▼                                                        │
│ .research/ exists?                                              │
│        │                                                        │
│   YES ─┼─ NO                                                    │
│        │     │                                                  │
│        ▼     ▼                                                  │
│ Auto-load    Research intent detected?                          │
│ Show banner       │                                             │
│        │     YES ─┼─ NO                                         │
│        │          │     │                                       │
│        ▼          ▼     ▼                                       │
│ Continue      Initialize  Normal                                │
│ project       prompt      conversation                          │
└─────────────────────────────────────────────────────────────────┘
```

**Project Load Banner**:

```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ 프로젝트 로드됨: AI-Ethics-HR                                 │
├─────────────────────────────────────────────────────────────────┤
│ 🔬 Stage: foundation │ ●●○○○○○○○○○ (2/11) │ 🧠 100%             │
│                                                                 │
│ 마지막 세션: 2026-02-04                                         │
└─────────────────────────────────────────────────────────────────┘
```

### New Files

#### HUD System (`lib/hud/`)

| File | Purpose | Lines |
|------|---------|-------|
| `colors.ts` | ANSI color utilities, HUD_COLORS palette | ~80 |
| `state.ts` | HUD state management, STAGES definition | ~180 |
| `presets.ts` | 4 preset configurations (research, checkpoint, memory, minimal) | ~120 |
| `core.ts` | HUDRenderer class, rendering logic | ~200 |
| `index.ts` | Main exports, DivergaHUD facade | ~50 |

#### HUD Wrapper (`~/.claude/hud/`)

| File | Purpose | Lines |
|------|---------|-------|
| `diverga-hud.mjs` | Standalone Node.js statusLine script | ~250 |

#### Memory System Extensions (`lib/memory/src/`)

| File | Purpose | Lines |
|------|---------|-------|
| `intent_detector.py` | Natural language research intent detection | ~430 |
| `project_initializer.py` | Auto-project initialization from intent | ~440 |

#### Skill Definition (`skills/hud/`)

| File | Purpose |
|------|---------|
| `SKILL.md` | HUD skill definition for Claude Code |

### Modified Files

| File | Changes |
|------|---------|
| `lib/memory/src/doc_generator.py` | Extended from 3 to 7 docs, added STAGES, progress bar, timestamp helpers |
| `lib/memory/src/memory_api.py` | Added HUD integration, docs sync, intent detection, project init methods |
| `skills/setup/SKILL.md` | Simplified from 9 steps to 3, removed LLM selection, added HUD |
| `CLAUDE.md` | Updated to v8.0, added v8.0 Key Features section |

### API Reference

**New MemoryAPI Methods**:

```python
from lib.memory import MemoryAPI

memory = MemoryAPI(project_root=Path("."))

# HUD Integration
memory.refresh_hud()                    # Update HUD cache

# Documentation Sync
memory.sync_docs()                      # Sync all docs
memory.sync_doc("PROJECT_STATUS.md")    # Sync single doc

# Intent Detection
result = memory.detect_research_intent("I want to do a meta-analysis")
# Returns: {"is_research": True, "type": "meta_analysis", "topic": ..., "confidence": 0.9}

# Project Initialization
memory.should_init_project("systematic review on AI")  # (True, IntentResult)
memory.initialize_from_message("systematic review on AI in education")
memory.get_load_banner()                # Formatted project banner

# Auto-sync Hooks (internal)
memory._on_state_change()               # Triggered on state updates
memory._on_decision_added(decision_id)  # Triggered after add_decision()
memory._on_checkpoint_completed(cp_id)  # Triggered after record_checkpoint()
```

**Intent Detector Functions**:

```python
from lib.memory.src.intent_detector import (
    detect_intent,           # Full intent detection
    should_initialize_project,  # Check if should init
    get_suggested_prompt,    # Confirmation prompt
    ResearchType,           # Enum of research types
    IntentResult            # Detection result dataclass
)

result = detect_intent("체계적 문헌고찰을 하고 싶어요")
# IntentResult(is_research_intent=True, research_type=ResearchType.SYSTEMATIC_REVIEW,
#              topic=None, confidence=0.9, paradigm="quantitative", ...)
```

**Project Initializer Functions**:

```python
from lib.memory.src.project_initializer import (
    initialize_project,      # Explicit initialization
    initialize_from_intent,  # Initialize from IntentResult
    is_project_initialized,  # Check if already initialized
    get_project_banner       # Get load banner
)

results = initialize_project(
    project_name="AI-Education-Review",
    research_question="How does AI improve learning outcomes?",
    paradigm="quantitative",
    hud_enabled=True
)
# Creates: .research/, docs/, all state files
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `/diverga-hud status` | Show HUD status |
| `/diverga-hud preset <name>` | Change preset (research, checkpoint, memory, minimal) |
| `/diverga-hud enable` | Enable HUD |
| `/diverga-hud disable` | Disable HUD |
| `/diverga-hud setup` | Setup HUD statusline |

### Breaking Changes

- **Setup wizard simplified**: `/diverga-setup` now has 3 steps instead of 9
- **LLM selection removed**: No longer asks for LLM provider (uses Claude Code's model)
- **API key configuration removed**: Not needed in Claude Code context

### Migration Guide

v7.0 → v8.0 migration is **automatic**:

1. Existing `.research/` directories are preserved
2. `docs/` directory created automatically on first state change
3. HUD can be enabled via `/diverga-hud setup`
4. No manual migration required

**To enable v8.0 features on existing project**:

```bash
# Enable HUD (optional)
/diverga-hud setup

# Generate docs/ files
# (Automatic on next decision or checkpoint)
```

### Technical Details

**HUD System**:
- TypeScript source in `lib/hud/`
- Pure Node.js runtime script (`~/.claude/hud/diverga-hud.mjs`)
- No external dependencies
- YAML parsing for project state

**Intent Detection**:
- Bilingual support (English + Korean)
- Regex-based pattern matching
- Confidence scoring (0.0 - 1.0)
- Topic extraction from context

**Project State Files**:

| File | Format | Purpose |
|------|--------|---------|
| `.research/project-state.yaml` | YAML | Project metadata |
| `.research/decision-log.yaml` | YAML | Decision history |
| `.research/checkpoints.yaml` | YAML | Checkpoint states |
| `.research/hud-state.json` | JSON | HUD configuration |

### Verification

```
✅ Intent detector tested: "systematic review on AI" → Type: systematic_review, Confidence: 0.9
✅ HUD files exist: colors.ts, state.ts, presets.ts, core.ts, index.ts
✅ HUD wrapper exists: ~/.claude/hud/diverga-hud.mjs
✅ Doc generator has 7 files: PROJECT_STATUS, DECISION_LOG, RESEARCH_AUDIT, METHODOLOGY, TIMELINE, REFERENCES, README
✅ Memory API has new methods: refresh_hud, sync_docs, detect_research_intent, initialize_from_message
✅ Setup skill simplified: 3 steps, HUD option added
```

---

## [7.0.0] - 2026-02-03 (Memory System Global Deployment)

### Overview

**Diverga Memory System v7.0** - Complete research context persistence system with 3-layer context loading, checkpoint auto-trigger, cross-session continuity, and research documentation automation.

This release introduces a comprehensive Python library (`lib/memory/`) that enables researchers to maintain context across sessions, enforce human-in-the-loop decisions at critical checkpoints, and auto-generate research documentation.

### New Features

#### 1. 3-Layer Context System

| Layer | Trigger | Purpose |
|-------|---------|---------|
| **Layer 1: Keyword-Triggered** | "my research", "연구 진행" | Auto-load context when researcher asks |
| **Layer 2: Task Interceptor** | `Task(subagent_type="diverga:*")` | Inject full context into agent prompts |
| **Layer 3: CLI** | `/diverga:memory context` | Explicit context access |

**Bilingual Support**: 15 English + 15 Korean trigger keywords

#### 2. Checkpoint Auto-Trigger System

```yaml
Checkpoint Levels:
  🔴 REQUIRED:    Must complete before proceeding
  🟠 RECOMMENDED: Strongly suggested
  🟡 OPTIONAL:    Can skip with defaults
```

17 standard checkpoints across research workflow:
- `CP_RESEARCH_DIRECTION`, `CP_PARADIGM_SELECTION`, `CP_THEORY_SELECTION`
- `CP_METHODOLOGY_APPROVAL`, `CP_DATABASE_SELECTION`, `CP_SCREENING_CRITERIA`
- ScholaRAG-specific: `SCH_DATABASE_SELECTION`, `SCH_SCREENING_CRITERIA`, etc.

#### 3. Cross-Session Persistence

- **Session Tracking**: UUID-based session management
- **Decision Audit Trail**: Append-only, immutable decision log with versioning
- **Stage Archiving**: Timestamped archives with auto-generated summaries

#### 4. Dual-Tree Filesystem Structure

```
.research/
├── baselines/           # STABLE TREE (verified foundations)
│   ├── literature/
│   ├── methodology/
│   └── framework/
├── changes/
│   ├── current/         # WORKING TREE (in-progress)
│   └── archive/         # Completed stages
├── sessions/
├── project-state.yaml
├── decision-log.yaml
└── checkpoints.yaml
```

#### 5. Research Documentation System

- **Schema-driven artifacts**: YAML schemas define artifact dependencies
- **Jinja2-like templates**: Protocol, PRISMA diagram, manuscript templates
- **Auto-generation**: Generate artifacts based on research context

#### 6. Migration Support (v6.8 → v7.0)

```bash
# Preview changes
/diverga:memory migrate --dry-run

# Execute migration
/diverga:memory migrate
```

### New Files

#### Core Library (`lib/memory/src/`)

| File | Purpose | Lines |
|------|---------|-------|
| `models.py` | Data models (ResearchContext, Checkpoint, Decision) | ~250 |
| `context_trigger.py` | Layer 1: Keyword-triggered context | ~460 |
| `task_interceptor.py` | Layer 2: Agent context injection | ~290 |
| `checkpoint_trigger.py` | Checkpoint auto-trigger | ~300 |
| `fs_state.py` | Filesystem state management | ~200 |
| `dual_tree.py` | Dual-tree structure | ~250 |
| `archive.py` | Stage archiving | ~200 |
| `decision_log.py` | Decision audit trail | ~280 |
| `session_hooks.py` | Session lifecycle | ~250 |
| `schema.py` | Research schema definitions | ~300 |
| `templates.py` | Template engine | ~280 |
| `artifact_generator.py` | Artifact generation | ~300 |
| `cli.py` | CLI commands | ~760 |
| `migration.py` | v6.8 → v7.0 migration | ~350 |
| `memory_api.py` | Unified facade API (23 methods) | ~400 |

#### Templates (`templates/`)

| Directory | Files | Purpose |
|-----------|-------|---------|
| `systematic-review/` | 8 files | PRISMA 2020 templates |
| `meta-analysis/` | 4 files | Meta-analysis templates |
| `checkpoints/` | 1 file | 17 checkpoint definitions |

#### Documentation

| File | Purpose |
|------|---------|
| `lib/memory/README.md` | Comprehensive library documentation |
| `skills/memory/SKILL.md` | Skill definition for Claude Code |

### API Reference

**MemoryAPI** - 23 methods:

```python
from lib.memory import MemoryAPI

memory = MemoryAPI(project_root=Path("."))

# Context
memory.should_load_context("What's my research status?")  # True
memory.display_context()  # Formatted context string
memory.intercept_task("diverga:a1", prompt)  # Enriched prompt

# Session
memory.start_session()  # Returns session_id
memory.end_session()  # Saves session data

# Checkpoint
memory.check_checkpoint("a1", "task_start")  # Returns injection if triggered
memory.record_checkpoint("CP_RESEARCH_DIRECTION", "approved")

# Decision
memory.add_decision(checkpoint="CP_RESEARCH_DIRECTION",
                   selected="Meta-analysis",
                   rationale="Need quantitative synthesis")
memory.amend_decision("dec-001", new_selected="...", new_rationale="...")

# Project
memory.initialize_project(name, question, paradigm)
memory.get_project_state()
memory.archive_stage("foundation", summary="Research direction finalized")
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `/diverga:memory status` | Show project status |
| `/diverga:memory context` | Display full context |
| `/diverga:memory init --name NAME --question Q --paradigm P` | Initialize project |
| `/diverga:memory decision list` | List decisions |
| `/diverga:memory decision add` | Add decision |
| `/diverga:memory archive [STAGE]` | Archive stage |
| `/diverga:memory migrate` | Run migration |

### Breaking Changes

- **New directory structure**: `.research/` replaces `.diverga/memory/` for project state
- **Checkpoint format**: Updated YAML schema for checkpoint definitions
- **Decision log schema**: Added `context` and `metadata` fields

### Migration Guide

1. **Automatic Migration**: Run `/diverga:memory migrate` on existing projects
2. **Backup Created**: `.research-backup-v68-{timestamp}/` before migration
3. **Rollback Available**: `migrate --rollback` if issues occur

### Technical Details

**Python 3.8+ Compatible**: Uses `from __future__ import annotations`

**Dependencies**: Only stdlib (no external packages required)
- `pathlib`, `dataclasses`, `uuid`, `json`, `datetime`
- Optional: `yaml` (PyYAML) for enhanced YAML handling

**Korean Text Support**: UTF-8 encoding throughout, `ensure_ascii=False`

### Verification

```
✅ All 15 modules import successfully
✅ MemoryAPI instantiated - version 7.0.0
✅ 23 API methods available
✅ Templates render correctly
✅ Checkpoint triggers function
## [6.9.2] - 2026-02-03 (Marketplace Cache Fix)

### Overview

**Critical fix** for marketplace cache synchronization issue. When users installed Diverga via `/plugin install`, Claude Code's marketplace was pulling an outdated cached version that lacked the `version` field fix from v6.9.1.

### The Problem

```
/plugin install diverga     → (no content)
/diverga:help               → Unknown skill: diverga:help
/diverga-help               → Unknown skill: diverga-help

BUT Plugin shows as "Installed" with all skills listed!
```

### Root Cause

| Issue | Description |
|-------|-------------|
| **Marketplace Cache Lag** | GitHub marketplace doesn't update immediately after push |
| **Stale Commit** | Plugin install pulled `08b1ebb` (old) instead of `efc024a` (fixed) |
| **Missing Version Field** | Old cached version didn't have `version` in SKILL.md |

### Timeline of Discovery

```
Phase 1: Initial Investigation (2+ hours)
├─ Plugin shows installed ✅
├─ Skills listed in /plugin ✅
├─ But /diverga:help → Unknown skill ❌
└─ Compared with oh-my-claudecode (works)

Phase 2: SKILL.md Analysis (1 hour)
├─ Both OMC and Diverga have same structure
├─ Hypothesis: version field needed?
└─ Added version to all 51 files

Phase 3: Symlink Workaround (1 hour)
├─ Created ~/.claude/skills/diverga-xxx symlinks
├─ /diverga-help (hyphen) works! ✅
└─ /diverga:help (colon) still fails ❌

Phase 4: Cache Investigation (1 hour)
├─ Removed and reinstalled plugin
├─ Plugin shows installed with skills
└─ Still "Unknown skill" ❌

Phase 5: Root Cause Found (30 min)
├─ Checked cache SKILL.md - NO version field!
├─ Marketplace pulled OLD cached version
└─ Solution: Manual cache update + wait for marketplace
```

### Changes

#### 1. Comprehensive Troubleshooting Guide

New `docs/TROUBLESHOOTING-PLUGIN.md` with:
- Complete 6+ hour debugging journey
- Three identified root causes
- Multiple solution approaches
- Diagnostic commands
- SKILL.md format reference

#### 2. Updated Setup Wizard

`/diverga-setup` now includes automatic symlink installation:
```bash
# Automatically creates 51 symlinks during setup
~/.claude/skills/diverga-help → /path/to/skills/help/
```

#### 3. GitHub Action for SKILL.md Validation

`.github/workflows/validate-skills.yml` validates:
- All SKILL.md files have required fields
- Version follows semver format
- Skill count matches expected (51)

### Solutions Provided

| Solution | Method | Reliability |
|----------|--------|-------------|
| **A** | Update marketplace → Reinstall | Recommended |
| **B** | Manual cache copy | Quick fix |
| **C** | Local symlinks | Most reliable |

### Key Learnings

1. **SKILL.md requires `version` field** - Undocumented requirement discovered through debugging
2. **Marketplace has cache lag** - Wait ~10-15 min after push or click "Update marketplace"
3. **Two skill loading systems** - Plugin (colon) vs Local (hyphen) use different paths

### Verification

After fix:
```
/diverga:help     ✅ Works (colon prefix)
/diverga-help     ✅ Works (hyphen prefix)
## [6.9.1] - 2026-02-03 (Plugin Discovery Fix)

### Overview

**Critical bug fix release** resolving "Unknown skill" errors that prevented Claude Code from discovering Diverga skills. After comprehensive debugging, three root causes were identified and fixed.

### The Problem

```
❯ /diverga:help
Unknown skill: diverga:help
```

### Root Causes Identified

| Issue | Severity | Status |
|-------|----------|--------|
| Missing `version` field in SKILL.md | 🔴 CRITICAL | ✅ Fixed |
| Orphaned skill directories (`.claude/skills/`, `.codex/skills/`) | 🟡 MEDIUM | ✅ Fixed |
| Plugin cache vs local skills loading | 🟠 HIGH | ✅ Workaround |

### Changes Made

#### 1. SKILL.md Version Field

Added `version: "6.9.0"` to all 51 SKILL.md files:

**Before:**
```yaml
---
name: a1
description: |
  VS-Enhanced Research Question Refiner...
---
```

**After:**
```yaml
---
name: a1
description: |
  VS-Enhanced Research Question Refiner...
version: "6.9.0"
---
```

#### 2. Orphaned Directory Cleanup

| Directory | Action | Impact |
|-----------|--------|--------|
| `.claude/skills/` | 🗑️ Deleted | -48,000 lines |
| `.codex/skills/` | 🗑️ Deleted | -400 lines |
| `skills/` | ✅ Kept | Canonical location |

**Total**: 150 files changed, 48 insertions(+), 50,430 deletions(-)

#### 3. Local Skills Symlink Installation

Created 51 symlinks in `~/.claude/skills/` for reliable skill discovery:

```bash
~/.claude/skills/diverga-help → ~/.claude/plugins/cache/diverga/.../skills/help/
~/.claude/skills/diverga-memory → ~/.claude/plugins/cache/diverga/.../skills/memory/
# ... (51 total)
```

### Skill Access Methods

| Method | Command | Status |
|--------|---------|--------|
| **Hyphen prefix** (Recommended) | `/diverga-help` | ✅ Works reliably |
| Colon prefix (Plugin) | `/diverga:help` | ⚠️ Requires plugin load |

### Installation

```bash
# Create local skill symlinks
cd /path/to/Diverga
for skill_dir in skills/*/; do
  skill_name=$(basename "$skill_dir")
  ln -sf "$(pwd)/$skill_dir" ~/.claude/skills/diverga-${skill_name}
done

# Restart Claude Code
```

### Verification

```
/diverga-help       ✅ Should display help guide
/diverga-memory     ✅ Should show memory system
/diverga-a1         ✅ Should show Research Question Refiner
```

### Git Commit

```
efc024a fix(plugin): add required version field and remove orphaned skill directories
```

### Full Release Notes

See: `docs/releases/RELEASE_v6.9.1.md`

---

## [6.7.1] - 2026-01-31 (Documentation Synchronization)

### Overview

**Documentation sync release** aligning AGENTS.md, SKILL.md, and CLAUDE.md to v6.7.0 architecture. Ensures consistent agent counts (44), version strings, and checkpoint definitions across all core files.

### Version Alignment

| Document | Before | After |
|----------|--------|-------|
| `AGENTS.md` | v6.5 (37 agents) | **v6.7.0** (44 agents) |
| `skills/research-coordinator/SKILL.md` | v6.0.0 (27 agents) | **v6.7.0** (44 agents) |
| `skills/research-orchestrator/SKILL.md` | v2.0.0 (27 agents) | **v2.7.0** (44 agents) |
| `CLAUDE.md` | v6.7.0 | v6.7.0 + SCH_PRISMA_GENERATION |

### Agents Added to Documentation

| Agent | Name | Category | Model |
|-------|------|----------|-------|
| B5 | ParallelDocumentProcessor | Evidence | Opus |
| F5 | HumanizationVerifier | Quality | Haiku |
| G5 | AcademicStyleAuditor | Communication | Sonnet |
| G6 | AcademicStyleHumanizer | Communication | Opus |

### Checkpoints Synchronized

- CP_META_GATE (🔴) - Meta-analysis gate failure
- SCH_DATABASE_SELECTION (🔴) - Database selection for retrieval
- SCH_SCREENING_CRITERIA (🔴) - PRISMA criteria approval
- SCH_RAG_READINESS (🟠) - RAG system ready
- SCH_PRISMA_GENERATION (🟡) - PRISMA diagram generation

### Files Modified

| File | Changes |
|------|---------|
| `AGENTS.md` | v6.5→v6.7.0, 37→44 agents, B5/F5/G5/G6 |
| `skills/research-coordinator/SKILL.md` | v6.0.0→v6.7.0, Category I, SCH_* |
| `skills/research-orchestrator/SKILL.md` | v2.0.0→v2.7.0, 44 agents |
| `CLAUDE.md` | SCH_PRISMA_GENERATION checkpoint |

### Files Created

| File | Purpose |
|------|---------|
| `qa/reports/verification_report_v6.7.0.md` | Architecture verification |
| `docs/releases/RELEASE_v6.7.1.md` | Detailed release notes |

### No Breaking Changes

Documentation-only release with no code or behavioral changes.

---

## [6.7.0] - 2026-01-30 (Systematic Review Automation)

### Overview

Diverga v6.7.0 introduces **Category I: Systematic Review Automation** with 4 new agents (I0-I3) for PRISMA 2020 compliant literature review pipelines. Expands from 40 to 44 agents across 9 categories.

**Core Theme**: "Automate systematic reviews with human checkpoints at every critical decision"

### New Category: I - Systematic Review Automation (4 agents)

| Agent | Name | Model | Purpose |
|-------|------|-------|---------|
| **I0** | ReviewPipelineOrchestrator | Opus | Pipeline coordination, stage management |
| **I1** | PaperRetrievalAgent | Sonnet | Multi-database fetching (Semantic Scholar, OpenAlex, arXiv) |
| **I2** | ScreeningAssistant | Sonnet | AI-PRISMA 6-dimension screening |
| **I3** | RAGBuilder | Haiku | Vector database construction (zero cost) |

### New Human Checkpoints

| Checkpoint | Level | Trigger |
|------------|-------|---------|
| SCH_DATABASE_SELECTION | 🔴 REQUIRED | User specifies databases for paper retrieval |
| SCH_SCREENING_CRITERIA | 🔴 REQUIRED | User approves inclusion/exclusion criteria |
| SCH_RAG_READINESS | 🟠 RECOMMENDED | Before RAG queries begin |
| SCH_PRISMA_GENERATION | 🟡 OPTIONAL | Before generating PRISMA flow diagram |

### New Workflows

| Workflow | Stages | Description |
|----------|--------|-------------|
| `automated-systematic-review` | I0→I1→I2→I3 | Full PRISMA 2020 pipeline |
| `knowledge-repository-build` | I0→I1→I3 | Broad corpus (5K-15K papers, 50% threshold) |

### Agent Auto-Trigger Keywords

| Agent | English Keywords | Korean Keywords |
|-------|------------------|-----------------|
| `diverga:i0` | "systematic review", "PRISMA", "literature review automation" | "체계적 문헌고찰", "프리즈마" |
| `diverga:i1` | "fetch papers", "retrieve papers", "database search" | "논문 수집", "논문 검색" |
| `diverga:i2` | "screen papers", "PRISMA screening", "inclusion criteria" | "논문 스크리닝", "선별" |
| `diverga:i3` | "build RAG", "vector database", "embed documents" | "RAG 구축", "벡터 DB" |

### New Files

| Path | Purpose |
|------|---------|
| `.claude/skills/research-agents/I0-review-pipeline-orchestrator/SKILL.md` | Orchestrator skill |
| `.claude/skills/research-agents/I1-paper-retrieval-agent/SKILL.md` | Paper retrieval skill |
| `.claude/skills/research-agents/I2-screening-assistant/SKILL.md` | Screening skill |
| `.claude/skills/research-agents/I3-rag-builder/SKILL.md` | RAG builder skill |

### Modified Files

| File | Changes |
|------|---------|
| `CLAUDE.md` | v6.7.0, 44 agents, 9 categories, Category I section |
| `agent-registry.yaml` | v6.7.0, Category I agents, new checkpoints, workflows |

### Model Routing (Updated)

| Tier | Model | Agents (44 total) |
|------|-------|-------------------|
| HIGH | Opus | A1, A2, A3, A5, B5, C1, C2, C3, C5, D4, E1, E2, E3, G3, G6, H1, H2, **I0** (17) |
| MEDIUM | Sonnet | A4, A6, B1, B2, C4, C6, C7, D1, D2, E5, F3, F4, G1, G2, G4, G5, **I1**, **I2** (18) |
| LOW | Haiku | B3, B4, D3, E4, F1, F2, F5, **I3** (8) |

### Category Summary (v6.7.0)

| Category | Name | Count |
|----------|------|-------|
| A | Foundation | 6 |
| B | Evidence | 5 |
| C | Design & Meta-Analysis | 7 |
| D | Data Collection | 4 |
| E | Analysis | 5 |
| F | Quality | 5 |
| G | Communication | 6 |
| H | Specialized | 2 |
| **I** | **Systematic Review Automation** | **4** |
| **Total** | | **44** |

### No Breaking Changes

Existing workflows continue unchanged. Category I agents are additive.

---

## [6.6.3] - 2026-01-30 (Codex CLI SKILL.md Implementation)

### Overview

**SKILL.md files now enable actual skill loading in Codex CLI.** Previously, AGENTS.md provided only passive documentation. Now `.codex/skills/` directory contains proper SKILL.md files that Codex CLI discovers and activates.

### Key Discovery

**AGENTS.md ≠ SKILL.md**

| Feature | AGENTS.md | SKILL.md |
|---------|-----------|----------|
| Purpose | Passive documentation | Active skill definition |
| Loading | Context injection only | Skill system activation |
| Structure | Free-form Markdown | YAML frontmatter required |

### New Files

```
.codex/skills/
├── research-coordinator/
│   └── SKILL.md         # Main coordinator (40 agents)
├── meta-analysis/
│   └── SKILL.md         # C5-MetaAnalysisMaster
└── checkpoint-system/
    └── SKILL.md         # Human checkpoint enforcement
```

### QUANT-005 Test Verification

| Verification Point | Before (QUANT-004) | After (QUANT-005) |
|--------------------|---------------------|-------------------|
| Skill activation | ❌ Not present | ✅ "✅ meta-analysis 스킬 사용" |
| Checkpoint marker | ❌ Not present | ✅ "🔴 CHECKPOINT: CP_EFFECT_SIZE_SELECTION" |
| VS T-Score options | ❌ Not present | ✅ [A] T=0.65, [B] T=0.40 ⭐, [C] T=0.25 |
| Behavioral halt | ❌ Continued | ✅ "어떤 지표로 통일하시겠습니까?" |

### Documentation

- `docs/CODEX-SKILL-SYSTEM.md` - Full technical documentation
- Claude Code vs Codex CLI comparison
- Installation recommendations

### Claude Code Recommendation

Claude Code is **recommended** for full Diverga functionality:
- ✅ Task tool support (40 specialized agents)
- ✅ AskUserQuestion tool (clickable UI)
- ✅ Tool-level checkpoint enforcement
- ✅ Parallel agent execution

Codex CLI now **supported** with SKILL.md files:
- ⚠️ Behavioral checkpoints only (model-voluntary)
- ⚠️ Main model handles all work (no dedicated agents)

---

