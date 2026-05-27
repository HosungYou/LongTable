# LongTable 0.1.52

LongTable 0.1.52 makes Codex `Stop` honor LongTable-owned hard-stop research
blockers while keeping product/tooling work quiet.

## What Changed

- Adds provider-neutral hard-stop metadata for `QuestionRecord` and question
  obligations.
- Adds one shared hard-stop verdict used by Codex hooks and diagnostics.
- Makes Codex `Stop` return a block decision only for pending hard-stop
  Research Specification blockers: research question/scope, constructs,
  method/analysis, evidence/access, or protected decisions.
- Keeps ordinary required questions and product/tooling prompts from becoming
  Stop blockers by default.
- Narrows `PostToolUse`: successful no-op Bash and unrelated nonzero Bash stay
  quiet; LongTable research-state mutations remain protected while a hard-stop
  is pending.
- Extends `doctor --json` and `codex status --json` / `codex hook-doctor --json`
  with `stopWouldBlock`, active blockers, stale pending counts, and next actions.

## Notes

Tmux remains optional transport only. The durable contract is still
`Researcher Checkpoint -> QuestionRecord -> DecisionRecord`; hooks consume that
state but do not replace it.
