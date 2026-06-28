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

Use the LongTable grilling surface for pressure interviews:

```text
$longtable-interview
```

`$longtable-interview` asks one relentless sharpening question at a time. It
states the tension, gives the recommended answer, and asks the researcher to
accept, revise, or reject it. It can use Research Specification state when
present, but it does not require one before asking the next pressure question.

It continues only while the next question can produce a new decision, sharper
boundary, stronger evidence standard, or clearer open tension, and stops when
remaining questions repeat the same tension without producing a new decision.
`$critical-interview` remains a compatibility alias, not a separate interview
contract.

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

## Journal Editor Fit Boundary

`longtable-editor` and `--role editor` foreground the Journal Editor role; they
do not invent target-journal knowledge. If a target journal is named, journal
fit claims require a journal profile: aims/scope, author guidance, recent
article patterns, and article type expectations. Without that profile,
LongTable should ask whether to run scholarly/venue search or mark fit as
provisional.

```bash
longtable review --role editor --prompt "Evaluate this manuscript positioning."
longtable panel --role editor,reviewer --prompt "Compare journal fit and reviewer risk."
longtable search --intent venue --query "<journal or venue context>"
```

Treat the result as a fit-risk rubric, not an acceptance prediction.

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
