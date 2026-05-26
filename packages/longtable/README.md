# @longtable/cli

Researcher-facing CLI for LongTable.

LongTable keeps scholarly project state in `.longtable/` and exposes generated
provider skills for Codex and Claude Code. The CLI installs setup, state,
checkpoint, search, and diagnostic tooling. It does not replace the provider.

## Install

```bash
npm install -g @longtable/cli
```

## Primary Flow

```bash
longtable setup --provider codex
cd "<research-folder>"
codex
```

Then invoke:

```text
$longtable-start
```

`$longtable-start` creates or resumes the workspace, asks open research-start
questions, and stores a Research Specification when there is enough material.

After a Research Specification exists, use:

```text
$longtable-interview
```

`$longtable-interview` is post-start. It uses option-first follow-up choices for
spec revisions, checkpoint resolution, evidence boundaries, coding rules, method
choices, and protected decisions. If no usable Research Specification exists, it
must route to `$longtable-start`.

## Workspace Artifacts

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

- `CURRENT.md`: human-readable current project state
- `.longtable/state.json`: durable memory, questions, decisions, interview
  turns, evidence records, First Research Shape, and Research Specification
- `QuestionRecord -> DecisionRecord`: the durable checkpoint lifecycle

Provider UI is transport. LongTable supports MCP/native structured elicitation,
interactive TTY selector surfaces, and numbered/plain-text fallback. Tmux is not
required for LongTable core behavior.

## Commands

```bash
longtable setup --provider codex
longtable doctor
longtable status --cwd "<project-path>"
longtable resume --cwd "<project-path>"
longtable roles
longtable question --prompt "<decision context>"
longtable decide --question <id> --answer <value>
longtable spec read --cwd "<project-path>"
longtable search --query "<topic>"
```

`longtable start` remains available for scripted workspace creation with
`--no-interview --json`, but it is not the primary research-start surface.

## Development

```bash
npm run build --workspace @longtable/cli
npm run typecheck --workspace @longtable/cli
```
