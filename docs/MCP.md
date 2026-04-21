# MCP Transport

## Decision

LongTable includes an optional MCP server named `longtable-state`.

MCP is a structured transport layer. It is not the source of truth, and it does
not own checkpoint semantics. The source of truth remains:

- `.longtable/project.json`
- `.longtable/current-session.json`
- `.longtable/state.json`
- `CURRENT.md` as the regenerated human-readable view

## Why It Exists

Provider-native skills and prompts are useful entrypoints, but they are not a
stable data API. MCP gives Codex, Claude Code, and future runtimes a typed way
to interact with LongTable state.

The main benefits are:

- avoid Markdown scraping when reading project state
- expose checkpoint evaluation as a callable tool
- create pending `QuestionRecord` objects from provider runtimes
- render a question for the current provider transport
- append normalized `DecisionRecord` objects
- regenerate `CURRENT.md` after state changes

## Server

Package:

```text
@longtable/mcp
```

Server key:

```text
longtable-state
```

Direct run:

```bash
npx -y @longtable/mcp@0.1.19
longtable-state --self-test
```

## Install Surface

The CLI prints MCP config by default:

```bash
longtable mcp install --provider all
```

It writes provider config only when explicitly requested:

```bash
longtable mcp install --provider codex --write
longtable mcp install --provider claude --write
```

Default paths:

- Codex: `~/.codex/config.toml`
- Claude Code: `~/.claude/settings.json`

## Tool Contract

The first tool set is intentionally narrow:

- `read_project`: read project metadata and managed file paths
- `read_session`: read the current session record
- `inspect_workspace`: summarize workspace state and optionally read
  `CURRENT.md` and project `AGENTS.md`
- `pending_questions`: list pending Researcher Checkpoints
- `evaluate_checkpoint`: classify natural-language context without writing
  state
- `create_question`: create a pending `QuestionRecord`
- `render_question`: render the selected question for Codex or Claude transport
- `append_decision`: answer a pending question and append a `DecisionRecord`
- `regenerate_current`: rebuild `CURRENT.md` from machine-readable state

## Access Boundary

The MCP server should stay constrained to LongTable-managed state:

- `.longtable/`
- `CURRENT.md`
- project `AGENTS.md`

It should not become a general filesystem or research search server.

## Relationship To Core

The dependency direction is:

```text
@longtable/core
@longtable/memory
@longtable/checkpoints
@longtable/provider-*
@longtable/cli project-state helpers
  -> @longtable/mcp
```

Core packages define semantics. MCP exposes those semantics to provider runtimes.

If MCP behavior and core behavior ever disagree, core wins.

## Open Limits

The MCP layer is a transport hardening step, not the final runtime:

- it does not yet provide OAuth or remote deployment
- it does not own scholarly search connectors
- it does not replace provider skills
- it does not guarantee that a provider will automatically call the tools
  without runtime guidance

Provider skills and runtime instructions should still tell the model when to
call `longtable-state`, especially before crossing a required Researcher
Checkpoint.
