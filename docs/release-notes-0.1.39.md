# LongTable 0.1.39 Release Notes

## Skill Surface

- Codex and Claude skill installation now defaults to a compact surface:
  `longtable`, `longtable-interview`, `longtable-methods`,
  `longtable-measure`, `longtable-theory`, `longtable-reviewer`, and
  `longtable-voice`.
- The legacy full surface remains available with
  `longtable codex install-skills --surface full` and
  `longtable claude install-skills --surface full`.
- Compact installation prunes previously installed LongTable full-surface skill
  directories so `$` autocomplete is not cluttered by obsolete role entries.

## Hook Behavior

- `UserPromptSubmit` no longer creates required Researcher Checkpoints for
  LongTable product, UX, setup, skill, release, or hook-engineering prompts.
- Research-content prompts can still create follow-up question checkpoints when
  the prompt itself asks LongTable to surface missing research questions.

## State Hygiene

- Added `longtable prune-questions` to remove cleared false-positive checkpoint
  records while preserving answered decisions and real research history.
- The prune command supports `--dry-run`, `--cwd`, and `--json`.

## Packaging

- Workspace packages are aligned on version `0.1.39`.
- MCP install snippets point to `@longtable/mcp@0.1.39`.
