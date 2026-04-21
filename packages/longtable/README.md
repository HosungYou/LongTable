# @longtable/cli

Researcher-facing CLI for LongTable.

LongTable is an npm-first, provider-neutral research harness. It keeps the core
product contract in project files and shared packages, while Codex skills,
Claude skills, and future MCP surfaces remain generated adapter artifacts.

The basic contract is:

1. seed the researcher profile once
2. create a workspace for each project
3. continue the research conversation inside that workspace
4. preserve decisions, tensions, and evidence as durable project state

## Install

```bash
npm install -g @longtable/cli
```

The npm install only installs the CLI. It does not write Codex skills, MCP
config, hooks, tmux state, or provider runtime files without explicit setup
approval.

## Primary Flow

```bash
longtable setup --provider codex
longtable init --flow interview
longtable start
cd "<project-path>"
codex
```

`longtable setup --provider codex` is the permission-first setup route. It asks
which runtime surfaces LongTable may enable and explains why each choice matters:
CLI only, skills, skills + MCP, skills + MCP + sentinel, intervention posture,
tmux HUD/console, and team discussion mode.

Return later:

```bash
cd "<project-path>"
longtable resume
codex
```

## What `longtable start` Creates

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

## Artifact Contract

- `AGENTS.md`: runtime guidance for Codex
- `CURRENT.md`: human-facing current view regenerated from state
- `.longtable/project.json`: stable project identity
- `.longtable/current-session.json`: current session cursor
- `.longtable/state.json`: layered memory state
- `.longtable/sessions/`: historical snapshots

## Why This Shape

The CLI tries to keep the root simple for novice researchers while preserving enough structure for power users and downstream tooling.

The memory model distinguishes:

- explicit state
- working state
- inferred hypotheses
- open tensions
- narrative traces

This is how LongTable avoids turning tacit knowledge into fake certainty.

## Commands

```bash
longtable init
longtable start
longtable resume --cwd "<project-path>"
longtable roles
longtable ask --cwd "<project-path>" --prompt "..."
longtable panel --prompt "..."
longtable sentinel --prompt "Should I define a new measurement construct?"
longtable hud --watch
longtable team --tmux --prompt "Review this measurement plan."
longtable codex install-skills
longtable claude install-skills
```

Useful structured routes for scripts and debugging:

```bash
longtable panel --prompt "review this methods section" --json
longtable review --role methods_critic,measurement_auditor --panel --prompt "review this methods section" --json
longtable ask --prompt "lt panel: show the disagreement before I commit" --json
```

## Inside Codex

Natural language should be the default.

Explicit short forms are available when needed:

```text
lt explore: Where should I narrow the question first?
lt review: What is weak in this claim?
lt panel: Show me the disagreement before I commit.
lt methods: Where is the design vulnerable?
```

Provider-native surfaces are available when installed:

```bash
longtable codex install-skills
longtable claude install-skills
```

Codex skills include `longtable`, `longtable-panel`, and generated role-specific
skills such as `longtable-methods-critic`. If your Codex build exposes explicit
skill shortcuts, `$longtable` is the manual entry. Do not depend on `/prompts`;
current Codex builds may reject it.

Claude Code skills include `longtable`, `longtable-panel`, and generated
role-specific skills such as `longtable-methods-critic`. They are adapter files
generated from the LongTable role registry.

## Panel Orchestration

Panel orchestration is for moments where disagreement matters: methods risk,
measurement validity, theory fit, literature positioning, and claims that need
challenge before they become project memory.

The CLI creates a provider-neutral `PanelPlan` and returns a planned
`PanelResult`. When native subagents are unavailable, LongTable uses a stable
sequential fallback prompt. That keeps the same research semantics available in
Codex and Claude Code without making either provider's native question or agent
tool the source of truth.

Inside a LongTable project workspace, panel planning also appends an
`InvocationRecord` to `.longtable/state.json`, creates a pending follow-up
`QuestionRecord`, and refreshes `CURRENT.md`.

```bash
longtable decide --answer evidence --rationale "Need citation support before continuing."
```

Default panel roles include:

- `reviewer`
- `methods_critic`
- `measurement_auditor`
- `theory_critic`

Use `--role` to constrain the panel when the research problem is already clear.

## Sentinel, HUD, And Tmux Team

`longtable sentinel` is an explicit gap/tacit check for prompts that may contain
measurement, theory, method, evidence, authorship, or tacit-assumption risks.
Use `--record` inside a LongTable workspace to store the finding as an
unconfirmed inferred hypothesis.

`longtable hud --watch` renders a compact view of the current project goal,
blocker, pending checkpoints, recent decisions, and invocation counts.
`longtable hud --tmux` opens that view in a tmux pane.

`longtable team --tmux` opens role-specific panes for research discussion and
writes logs under `.longtable/team/<id>/`. This is panel discussion, not merely
parallel execution: role panes are prompted to state claims, objections, open
questions, and likely disagreement.

## Evidence And Search Direction

LongTable should not behave like a generic web scraper. Research search should
start from scholarly routes when the user needs literature discovery, citation
verification, publication metadata, or evidence-backed research decisions.

Planned scholarly routes include arXiv, Crossref, OpenAlex, Semantic Scholar,
PubMed/NCBI, ERIC, DOAJ, and Unpaywall. They have different setup requirements:
some work without keys, some require a contact email, and some need API keys for
reliable use.

Citation support should be checked explicitly. A reference can be useful as
background while still failing to support the specific claim attached to it.

See:

- [Research Search](https://github.com/HosungYou/LongTable/blob/main/docs/RESEARCH-SEARCH.md)
- [Evidence Policy](https://github.com/HosungYou/LongTable/blob/main/docs/EVIDENCE-POLICY.md)
- [LongTable Command Surface](https://github.com/HosungYou/LongTable/blob/main/docs/LONGTABLE-COMMAND-SURFACE.md)

## Validation

```bash
npm install
npm run typecheck
npm run build
```
