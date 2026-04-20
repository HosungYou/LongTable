# @longtable/cli

Researcher-facing CLI for LongTable.

LongTable is designed around a simple contract:

1. seed the researcher profile once
2. create a workspace for each project
3. continue the research conversation inside that workspace

## Install

```bash
npm install -g @longtable/cli
```

## Primary Flow

```bash
longtable init --flow interview
longtable start
cd "<project-path>"
codex
```

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

## Validation

```bash
npm install
npm run typecheck
npm run build
```
