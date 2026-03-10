# Diverga v11.0.0 — Simplification Release

**Release Date**: 2026-03-10
**Previous Version**: v10.3.2
**Breaking Changes**: Yes

---

## Overview

Diverga v11.0.0 is a major simplification release that reduces complexity by 45% while preserving all core research methodology capabilities. Inspired by the principle that **simplicity drives adoption**, this release consolidates 44 agents into 24 focused specialists, eliminates multi-platform overhead, and streamlines the entire runtime infrastructure.

**Key Numbers:**
- Agents: 44 → 24 (-45%)
- CLAUDE.md: 59KB → 12KB (-79%)
- Platforms: 3 → 1 (Claude Code exclusive)
- MCP backends: 2 → 1 (SQLite only)
- Files removed: 153
- Lines removed: 42,334

---

## Breaking Changes

### Platform Support
- **Removed**: Codex CLI support (`.codex/` directory, 47 SKILL.md files, GPT model routing)
- **Removed**: OpenCode support (`.opencode/` directory, TypeScript plugin, hooks)
- **Removed**: All cross-platform install scripts and adapter templates
- **Now exclusive to**: Claude Code (plugin marketplace or local install)

### Agent Consolidation
20 agents were merged into surviving agents or removed. If you reference agent IDs directly, update your workflows:

| Removed Agent | Now Part Of | Migration |
|---|---|---|
| A3 (Devil's Advocate) | A2 (Theory & Critique Architect) | Use `diverga:a2` with critique mode |
| A4 (Ethics Advisor) | X1 (Research Guardian) | Use `diverga:x1` |
| A6 (Visualizer) | A2 (Theory & Critique Architect) | Use `diverga:a2` with visualization |
| B3 (Effect Size) | C5 (Meta-Analysis Master) | Use `diverga:c5` |
| B4 (Research Radar) | Removed | Use general LLM capabilities |
| B5 (PDF Processor) | I3 (RAG Builder) | Use `diverga:i3` |
| C4 (Materials) | C1 (Quantitative Design) | Use `diverga:c1` |
| C6 (Data Guard) | C5 (Meta-Analysis Master) | Use `diverga:c5` |
| C7 (Error Prevention) | C5 (Meta-Analysis Master) | Use `diverga:c5` |
| D1 (Sampling) | C1/C2/C3 (Design agents) | Use design agent for your paradigm |
| D3 (Observation) | D2 (Data Collection Specialist) | Use `diverga:d2` |
| E4 (Code Generator) | E1 (Quantitative Analysis) | Use `diverga:e1` |
| E5 (Sensitivity) | C5 + E1 | Meta-analysis: `diverga:c5`, Primary: `diverga:e1` |
| F1 (Consistency) | G2 (Publication Specialist) | Use `diverga:g2` |
| F2 (Checklist) | G2 (Publication Specialist) | Use `diverga:g2` |
| F3 (Reproducibility) | G2 (Publication Specialist) | Use `diverga:g2` |
| F4 (Bias Detection) | X1 (Research Guardian) | Use `diverga:x1` |
| G3 (Peer Review) | G2 (Publication Specialist) | Use `diverga:g2` |
| G4 (Pre-registration) | G2 (Publication Specialist) | Use `diverga:g2` |
| H1 (Ethnography) | C2 (Qualitative Design) | Use `diverga:c2` |
| H2 (Action Research) | C2 (Qualitative Design) | Use `diverga:c2` |

### Infrastructure
- **Removed**: YAML/JSON state backend. SQLite WAL is now the only backend.
- **Removed**: `DIVERGA_BACKEND` environment variable (no longer needed)
- **Changed**: Context7 MCP removed from `.mcp.json` (move to global settings if needed)
- **Changed**: Hooks unified into single `prereq-enforcer.mjs` (was `checkpoint-enforcer.mjs` + `skill-interceptor.mjs`)

---

## New Features

### X1 Research Guardian (New Agent)
A cross-cutting agent combining A4 (Ethics) and F4 (Bias Detection). Available at any research stage with no prerequisites. Covers:
- IRB/ethics review support (Belmont Report, APA Ethics, GDPR)
- QRP screening (p-hacking, HARKing, selective reporting)
- Qualitative trustworthiness (credibility, transferability, dependability, confirmability)

### Enhanced Surviving Agents
Agents that absorbed capabilities are now more powerful:
- **A2** now includes devil's advocate critique and framework visualization
- **C1** now includes experimental materials development and sampling strategy
- **C2** now covers ethnography and action research
- **C5** is a complete meta-analysis pipeline (data integrity + effect size + sensitivity)
- **G2** is a full publication specialist (writing + peer review + pre-registration + checklists + reproducibility)

### Streamlined CLAUDE.md
System prompt reduced from 59KB to 12KB. Detailed content moved to:
- `docs/AGENT-TRIGGERS.md` — Auto-trigger keyword reference
- `docs/AGENT-PREREQUISITES.md` — Checkpoint dependency map
- `docs/HUMANIZATION.md` — G5→G6→F5 pipeline details
- `docs/DEVELOPER.md` — Development and plugin structure

---

## Installation

### Fresh Install (Claude Code)
```bash
# Plugin Marketplace
/plugin marketplace add https://github.com/HosungYou/Diverga
/plugin install diverga
/diverga:setup
```

### Upgrade from v10.x
```bash
# Remove old plugin
/plugin uninstall diverga

# Clear old state (optional but recommended)
rm -rf ~/.claude/skills/diverga-*
rm -rf ~/.claude/plugins/diverga

# Reinstall
/plugin marketplace add https://github.com/HosungYou/Diverga
/plugin install diverga
/diverga:setup
```

**Note**: Existing research state (`.research/`, `research/`) is preserved. SQLite databases auto-migrate from YAML if you had v9.x state.

---

## Agent Reference (24 Agents)

| ID | Name | Model | Category |
|---|---|---|---|
| a1 | Research Question Refiner | Opus | A - Foundation |
| a2 | Theory & Critique Architect | Opus | A - Foundation |
| a5 | Paradigm Advisor | Opus | A - Foundation |
| b1 | Literature Scout | Sonnet | B - Literature |
| b2 | Quality Appraiser | Sonnet | B - Literature |
| c1 | Quantitative Design & Sampling | Opus | C - Design |
| c2 | Qualitative Design (Ethnography/AR) | Opus | C - Design |
| c3 | Mixed Methods Design | Opus | C - Design |
| c5 | Meta-Analysis Master | Opus | C - Design |
| d2 | Data Collection Specialist | Sonnet | D - Collection |
| d4 | Instrument Developer | Opus | D - Collection |
| e1 | Quantitative Analysis & Code Gen | Opus | E - Analysis |
| e2 | Qualitative Coding | Opus | E - Analysis |
| e3 | Mixed Methods Integration | Opus | E - Analysis |
| f5 | Humanization Verifier | Haiku | F - Quality |
| g1 | Journal Matcher | Sonnet | G - Publication |
| g2 | Publication Specialist | Sonnet | G - Publication |
| g5 | Academic Style Auditor | Sonnet | G - Publication |
| g6 | Academic Style Humanizer | Opus | G - Publication |
| i0 | SR Pipeline Orchestrator | Opus | I - SR Pipeline |
| i1 | Paper Retrieval | Sonnet | I - SR Pipeline |
| i2 | Screening Assistant | Sonnet | I - SR Pipeline |
| i3 | RAG Builder | Haiku | I - SR Pipeline |
| x1 | Research Guardian | Sonnet | X - Cross-Cutting |

---

## Acknowledgements

This release was informed by comparative analysis with [K-Dense AI's claude-scientific-skills](https://github.com/K-Dense-AI/claude-scientific-skills), which demonstrated that simplicity and accessibility are key drivers of adoption in AI-assisted research tooling.
