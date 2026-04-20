# LongTable

LongTable is a researcher-centered workspace for working with Codex or Claude
Code across long research projects.

It helps a researcher keep goals, decisions, open tensions, evidence, and
authorship visible across sessions. The core contract lives in LongTable project
state. Provider-specific surfaces, such as Codex prompt aliases or Claude skills,
are adapters.

## What It Does

- creates a durable research workspace with `.longtable/` state
- keeps a human-readable `CURRENT.md` view of the project
- routes requests through research roles such as reviewer, methods critic, and
  measurement auditor
- activates checkpoints when a decision needs clarification
- supports panel-style disagreement before a claim or design choice is committed
- treats scholarly evidence and citation support as first-class research objects

## Install

```bash
npm install -g @longtable/cli
```

## Start

Seed your researcher profile once:

```bash
longtable init --flow interview --provider codex
```

Create a project workspace:

```bash
longtable start
cd "<project-path>"
codex
```

For Claude Code, choose Claude during setup and open the project with Claude
Code instead:

```bash
longtable init --flow interview --provider claude
longtable start
cd "<project-path>"
claude
```

Return to an existing project:

```bash
cd "<project-path>"
longtable resume
codex
```

## Everyday Use

Most work should happen in natural language inside the project directory.

Useful short forms:

```text
lt explore: help me narrow this research question
lt review: what is weak in this claim?
lt methods: where is this design vulnerable?
lt editor: how should I position this for a journal?
lt panel: show disagreement before I commit this argument
```

These forms are handled by the LongTable router. They are not separate source
files or separate agent definitions. The router maps the phrase to a mode,
detects relevant research roles, and then uses the strongest installed provider
surface.

You can also call LongTable directly from the shell when you want an explicit
debuggable route:

```bash
longtable ask --prompt "I need to narrow this project into a defensible study."
```

## Provider Surfaces

LongTable should feel native in Codex and Claude Code, but the native files are
adapters. The source of truth remains the LongTable role registry and project
state.

Codex prompt aliases:

```bash
longtable init --flow interview --provider codex --install-prompts
longtable codex install-prompts
```

After installation, use prompt aliases such as:

```text
/prompts:longtable help me narrow this project
/prompts:longtable-panel review this methods section
/prompts:longtable-methods check whether my design matches the question
```

Claude Code skills:

```bash
longtable init --flow interview --provider claude --install-skills
longtable claude install-skills
```

After installation, invoke LongTable naturally in Claude Code:

```text
longtable: help me narrow this project
lt review: what is weak in this claim?
lt panel: show disagreement before I commit this argument
use the LongTable methods critic on this design
```

This mirrors the OMX/OMC pattern: commands and skills are entrypoints, while the
workflow logic stays in shared runtime state.

## Agent Roles

LongTable roles are research perspectives. They can be triggered naturally by
the request, through provider skills, or through an explicit CLI flag for
testing. List available roles with:

```bash
longtable roles
```

Common roles:

- `reviewer`: likely peer-review objections
- `theory_critic`: conceptual fit and overreach
- `methods_critic`: design logic and methodological defensibility
- `measurement_auditor`: construct validity, scales, and evidence quality
- `editor`: venue fit and framing
- `voice_keeper`: authorship, tone, and narrative trace
- `venue_strategist`: journal or conference positioning

Natural role requests:

```text
Use the methods critic on this design.
Reviewer view: what would a hostile reviewer reject?
Editor view: is this positioned for the right journal?
Measurement auditor: do these scales support the construct?
```

Explicit CLI role calls are mainly for testing, scripts, or reproducible runs:

```bash
longtable review --role methods_critic --prompt "Review this design."
longtable critique --role theory_critic --prompt "Challenge this framework."
```

## Panel / Team-Style Review

Use a panel when the work needs visible disagreement from multiple research
roles.

Natural panel requests:

```text
lt panel: review this methods section
Show me reviewer, methods critic, and measurement auditor disagreement.
Before I commit this argument, run a LongTable panel.
```

Explicit CLI panel calls:

```bash
longtable panel --prompt "Review this methods section." --json
longtable review --role methods_critic,measurement_auditor --panel --prompt "Review this design." --json
```

Panel review creates a provider-neutral `PanelPlan` and a planned `PanelResult`.
It does not require native subagents, Claude-only question tools, or a persistent
team runtime. When provider-native orchestration is unavailable, LongTable uses a
stable sequential fallback so Codex and Claude Code can share the same research
semantics.

## Evidence

LongTable should not behave like a generic web scraper. For research questions,
the intended search path is scholar-first:

- arXiv
- Crossref
- OpenAlex
- Semantic Scholar
- PubMed/NCBI
- ERIC
- DOAJ
- Unpaywall

These sources should be used when the researcher asks for literature discovery,
citation verification, publication metadata, or evidence-backed decisions. They
should not be called for every question.

Citation support should be checked explicitly. A source may be useful background
without supporting the specific claim attached to it.

## Workspace Shape

`longtable start` creates a minimal project root:

```text
<project>/
  AGENTS.md
  CURRENT.md
  .longtable/
    project.json
    current-session.json
    state.json
    sessions/
```

`AGENTS.md` and `CURRENT.md` are runtime-facing views. The source of truth is the
machine-readable state under `.longtable/`.

## Development

```bash
npm install
npm run typecheck
npm run build
```

## Docs

- [Command Surface](docs/LONGTABLE-COMMAND-SURFACE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Question Runtime](docs/QUESTION-RUNTIME.md)
- [Checkpointing](docs/CHECKPOINTING.md)
- [Memory](docs/MEMORY.md)
- [Evidence Policy](docs/EVIDENCE-POLICY.md)
- [Research Search](docs/RESEARCH-SEARCH.md)
