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
frames each turn as `Tension:` followed by one `Pressure question:` and waits
for a direct answer. It can use Research Specification state when present, but
it does not require one before asking the next pressure question.

It continues only while the next question can produce a new decision, sharper
boundary, stronger evidence standard, or clearer open tension, and stops when
remaining questions repeat the same tension without producing a new decision.
`$longtable-interview` is the only packaged pressure-interview skill; legacy
`$critical-interview` skill folders are removed during skill install.

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

## Journal-Grounded Reviewer

`longtable-reviewer` and `--role reviewer` are the compact surface for
peer-review, editor-style, and venue-fit feedback. The reviewer role combines
Journal Editor and Venue Strategist lenses with scholar-research evidence
instead of requiring a separate visible editor skill.

If a target journal is named, journal-fit claims require a Journal Profile:
aims/scope, author guidance, recent article patterns, and article type
expectations. Reference papers should be compared through a Reference Pattern
Matrix covering decision structure, paper flow, standardized terminology,
Figure/Table conventions, and APA 7 style expectations.

```bash
longtable review --role reviewer --prompt "Evaluate this manuscript positioning."
longtable panel --role reviewer,measurement_auditor --prompt "Compare journal fit and reviewer risk."
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
