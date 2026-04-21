# LongTable

LongTable is a researcher-centered workspace for working with Codex or Claude
Code across long research projects.

It helps a researcher keep goals, decisions, open tensions, evidence, and
authorship visible across sessions. The core contract lives in LongTable project
state. Provider-specific surfaces, such as Codex skills or Claude Code skills,
are adapters.

## What It Does

- creates a durable research workspace with `.longtable/` state
- keeps a human-readable `CURRENT.md` view of the project
- routes requests through research roles such as reviewer, methods critic, and
  measurement auditor
- activates **Researcher Checkpoints** when a decision needs clarification
- supports panel-style disagreement before a claim or design choice is committed
- treats scholarly evidence and citation support as first-class research objects

## System Map

LongTable is not a single prompt. It is a set of small systems that keep research
work inspectable across Codex and Claude Code.

| System | What It Protects | Where It Lives |
| --- | --- | --- |
| Research workspace | continuity across sessions | `.longtable/`, `CURRENT.md` |
| Role router | the right research perspective at the right moment | generated Codex/Claude skills, CLI modes |
| Panel orchestration | visible disagreement before closure | `PanelPlan`, `PanelResult`, `InvocationRecord` |
| Researcher Checkpoints | proactive human judgment at high-stakes moments | `QuestionRecord`, provider question UI, numbered fallback |
| Decision log | what the researcher actually committed to | `DecisionRecord` |
| Evidence policy | scholar-first search and citation fit | evidence docs, future search adapters |
| Provider adapters | native-feeling Codex/Claude entrypoints | generated skills and runtime artifacts |
| MCP transport | structured state access for provider runtimes | `@longtable/mcp`, `longtable-state` |
| Doctor | installation and project-state health | `longtable doctor` |

## Install

```bash
npm install -g @longtable/cli
```

The npm install only installs the `longtable` command. It does not write Codex
skills, MCP config, hooks, tmux state, or provider runtime files. Those require
explicit setup approval because they change files outside the npm package.

## Start

Recommended Codex setup:

```bash
longtable setup --provider codex
```

This permission-first setup asks which runtime surfaces LongTable may install:
CLI only, skills, skills + MCP, or skills + MCP + advisory sentinel. Each option
shows why it matters and what tradeoff it introduces.

The older researcher-profile setup remains available when you want a more
personalized profile interview:

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

When a request approaches a research commitment, LongTable should not silently
continue. It should surface a **Researcher Checkpoint**: a concise question with
clear options, a reason for asking, and a durable record in project state.

When a request contains several smaller tacit choices, LongTable uses a
**Clarification Card** instead of one broad checkpoint. The card groups focused
questions, marks recommended options, and records each answer as a durable
question/decision pair. CLI runs prefer terminal selector UI; plain-text and
non-interactive runs fall back to numbered choices.

You can also call LongTable directly from the shell when you want an explicit
debuggable route:

```bash
longtable ask --prompt "I need to narrow this project into a defensible study."
longtable clarify --prompt "Update the rubric using the selected exemplars."
longtable sentinel --prompt "Should I define a new measurement construct?"
```

## Runtime Surfaces

LongTable has three runtime levels:

| Surface | Use it for | Requires |
| --- | --- | --- |
| Standard chat | Portable LongTable skills, checkpoints, and CLI commands | Codex or Claude |
| Research HUD | Persistent view of goals, blockers, pending checkpoints, and decisions | tmux |
| Research console | Role panes for tmux-backed team discussion plus HUD | tmux |

Tmux is optional. LongTable's research contract must work without it. When tmux
is available, it can make choices and open tensions more visible:

```bash
longtable hud --watch
longtable hud --tmux
longtable team --tmux --prompt "Review this measurement plan before I commit it."
longtable team --debate --prompt "Review this measurement plan before I commit it."
```

Install tmux:

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux
```

Team mode is panel discussion, not just parallel execution. LongTable opens
role-specific panes and writes logs under `.longtable/team/<id>/` so the
researcher can inspect disagreement before deciding what to do next.

Use `longtable team --debate` when the disagreement itself should become a
durable research artifact. Debate runs use a fixed five-round protocol:
independent review, cross-review, rebuttal, convergence, and coordinator
synthesis/checkpoint. The canonical record is written under
`.longtable/team/<id>/`; tmux is optional.

## Provider Surfaces

LongTable should feel native in Codex and Claude Code, but the native files are
adapters. The source of truth remains the LongTable role registry and project
state.

Codex skills:

```bash
longtable init --flow interview --provider codex --install-skills
longtable codex install-skills
```

After installation, reopen Codex if needed and invoke LongTable naturally:

```text
longtable: help me narrow this project
lt panel: review this methods section
use the LongTable methods critic on this design
```

If your Codex build exposes skill shortcuts, `$longtable` is the explicit entry.
Do not use `/prompts`; current Codex builds may reject it.

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

## MCP Transport

LongTable includes an optional MCP server named `longtable-state`.

The MCP layer is not the LongTable core and does not replace `.longtable/`.
It exposes structured tools over the existing project state so Codex, Claude
Code, or another MCP-capable runtime can inspect and update LongTable records
without scraping Markdown.

Install or inspect provider config:

```bash
longtable mcp install --provider all
longtable mcp install --provider codex --write
longtable mcp install --provider claude --write
```

By default, `longtable mcp install` only prints the config snippets. It writes
to provider config files only when `--write` is present.

Default config targets:

- Codex: `~/.codex/config.toml`
- Claude Code: `~/.claude/settings.json`

The server can also be run directly:

```bash
npx -y @longtable/mcp@0.1.19
longtable-state --self-test
```

Current tools:

- `read_project`
- `read_session`
- `inspect_workspace`
- `pending_questions`
- `evaluate_checkpoint`
- `create_question`
- `render_question`
- `append_decision`
- `regenerate_current`

The practical advantage is architectural rather than visual: MCP gives provider
runtimes typed access to project/session state, checkpoint evaluation,
QuestionRecord creation, DecisionRecord append, and `CURRENT.md` regeneration.
The durable source of truth remains `.longtable/`.

## Researcher Checkpoints

LongTable adapts the idea behind Claude's AskUserQuestion-style interaction and
OMX's structured approval checkpoints, but names it for research work:
**Researcher Checkpoint**.

A Researcher Checkpoint is not a generic "are you sure?" prompt. It appears when
the system is about to treat uncertainty as settled, for example:

- freezing a research question
- choosing a theory anchor
- committing to a method or measurement design
- interpreting tacit researcher context
- deciding whether a panel result needs evidence, revision, or closure
- naming or changing a LongTable platform concept
- preparing external submission, preregistration, or public sharing

The ideal shape is:

```text
Researcher Checkpoint
Why now: this choice changes the downstream study design.
Question: What should LongTable treat as the next human decision?
Options: revise / gather evidence / proceed / defer / other
Record: QuestionRecord -> DecisionRecord
```

Provider behavior differs:

- Claude Code can use native structured question surfaces when available.
- Codex uses numbered choices and strict parsing as the stable fallback.
- Both providers write the same LongTable state records.

This is the main difference from a plain AskUserQuestion tool. The UI is only the
transport; the LongTable product contract is proactive, research-aware
checkpointing with durable decision records.

If a checkpoint allows `other`, that option must be visible to the researcher.
Hidden `allowOther` support is not enough because it still pressures the
researcher into the system's categories.

Natural-language checkpoint triggers are handled by the shared checkpoint
package, not by provider-specific prompt text. LongTable classifies cues such as
submission, method design, measurement, evidence verification, authorship, and
platform-language changes into a `CheckpointSignal`; the checkpoint policy then
decides whether the question is blocking or advisory.

When you need to record a checkpoint directly:

```bash
longtable question --prompt "We are about to finalize the measurement plan."
longtable question --provider codex --print --prompt "We are about to finalize the measurement plan."
longtable question --provider claude --print --prompt "We are about to finalize the measurement plan."
longtable decide --question <id> --answer evidence --rationale "Need scale validity support first."
```

If the checkpoint is required, LongTable treats the workspace as blocked for
normal `ask`, mode, and panel commands until `longtable decide` records an
answer. The pending question remains visible in `CURRENT.md` and `doctor`.
`--print` renders the provider transport: numbered prompt for Codex, structured
question payload for Claude. In Codex/plain-text fallback, `longtable decide`
accepts either the visible number (`1`) or the stable option value
(`evidence`).

## Health Check

Use `doctor` when you want to confirm that LongTable is wired into both provider
surfaces and that the current project state is alive:

```bash
longtable doctor
longtable doctor --fix
longtable doctor --json
```

`longtable status` is the same top-level health check. It reports:

- global setup and provider runtime artifacts
- Codex skill installation and legacy prompt files
- Claude Code skill installation
- the current `.longtable/` workspace, recent invocations, pending questions, and
  recorded decisions

If something is missing, the output includes the next command to run.
`--fix` repairs safe mechanical issues: missing Codex/Claude skill files, stale
legacy Codex prompt files, and provider runtime artifacts when a setup profile
already exists. It does not invent a researcher profile; run `longtable init`
first if setup is missing.

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
longtable team --debate --prompt "Review this measurement plan." --role editor,measurement_auditor --json
```

Panel review creates a provider-neutral `PanelPlan` and a planned `PanelResult`.
It does not require native subagents, Claude-only question tools, or a persistent
team runtime. When provider-native orchestration is unavailable, LongTable uses a
stable sequential fallback so Codex and Claude Code can share the same research
semantics.

When panel review runs inside a LongTable project workspace, LongTable appends an
`InvocationRecord` to `.longtable/state.json` and refreshes `CURRENT.md` with the
recent invocation summary. It also creates a pending follow-up `QuestionRecord`
so the researcher can explicitly decide what happens next.

Record that decision with:

```bash
longtable decide --answer evidence --rationale "Need citation support before continuing."
```

This panel follow-up is also a Researcher Checkpoint. It is how LongTable avoids
turning a multi-role review into an invisible AI decision.

For deeper agent-to-agent disagreement, `longtable team --debate` records a
five-round debate and creates a debate follow-up checkpoint. It is still a
researcher-centered harness: the debate can surface conflict, but the researcher
answers the final decision.

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
npm run release:check
npm run typecheck
npm run build
```

## Docs

- [Command Surface](docs/LONGTABLE-COMMAND-SURFACE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [MCP Transport](docs/MCP.md)
- [Question Runtime](docs/QUESTION-RUNTIME.md)
- [Checkpoint Triggering](docs/CHECKPOINT-TRIGGERING.md)
- [Researcher Checkpoints](docs/RESEARCHER-CHECKPOINTS.md)
- [Release Process](docs/RELEASE-PROCESS.md)
- [Docs Language Policy](docs/DOCS-LANGUAGE-POLICY.md)
- [Invocation Log](docs/INVOCATION-LOG.md)
- [Doctor Status](docs/DOCTOR.md)
- [Checkpointing](docs/CHECKPOINTING.md)
- [Memory](docs/MEMORY.md)
- [Evidence Policy](docs/EVIDENCE-POLICY.md)
- [Research Search](docs/RESEARCH-SEARCH.md)
