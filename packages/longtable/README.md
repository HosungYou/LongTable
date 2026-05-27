# @longtable/cli

Researcher-facing CLI for LongTable.

LongTable keeps scholarly project state in `.longtable/` and exposes generated
provider skills for Codex and Claude Code. The CLI installs setup, state,
checkpoint, search, panel, and diagnostic tooling. It does not replace the
provider.

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
longtable panel --prompt "review this measurement plan" --json
```

`longtable start` remains available for scripted workspace creation with
`--no-interview --json`, but it is not the primary research-start surface.

## Panel Orchestration

Panel orchestration is for moments where disagreement matters: methods risk,
measurement validity, theory fit, literature positioning, and claims that need
challenge before they become project memory.

The CLI creates a provider-neutral `PanelPlan` and returns a planned
`PanelResult`. When native subagents are unavailable, LongTable uses a stable
sequential fallback prompt. That keeps the same research semantics available in
Codex and Claude Code without making either provider's native question or agent
tool the source of truth.

```bash
longtable panel --prompt "Review this measurement plan." --role editor,measurement_auditor --json
longtable panel --visibility always_visible --prompt "Keep unresolved disagreement visible." --json
longtable ask --prompt "lt debate: Review this design before I commit it." --json
```

Team-style requests route through panel. Explicit debate-language requests write
panel debate records under `.longtable/panel/`; LongTable team execution is
disabled for new work.

## Development

```bash
npm run build --workspace @longtable/cli
npm run typecheck --workspace @longtable/cli
```

## Codex hard-stop diagnostics

Codex `Stop` blocks only active LongTable hard-stop blockers: unresolved
Research Specification question, scope, construct, method, evidence, or protected
decision commitments. Use:

```bash
longtable codex hook-doctor --json
longtable codex status --json
longtable doctor --json
```

to inspect hook coverage/trust plus `stopWouldBlock`, `activeBlockers`, stale
pending-question counts, and next actions. Tmux remains an optional terminal
transport; LongTable state and hooks own the behavior.
