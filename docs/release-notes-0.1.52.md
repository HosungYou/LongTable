# LongTable 0.1.52

LongTable 0.1.52 turns Codex Stop into a narrow hard-stop guard for protected
research-state continuity.

## What Changed

- Adds provider-neutral optional hard-stop metadata on `QuestionRecord` and
  `LongTableQuestionObligation`.
- Adds a shared hard-stop verdict so Codex hooks and diagnostics use the same
  LongTable-owned predicate.
- Makes Codex `Stop` block only active hard-stop blockers that can affect the
  Research Specification's question, scope, constructs, method, evidence
  boundary, or protected decisions.
- Keeps stale or product/tooling-only required questions out of Stop blocking.
- Quiets managed `PostToolUse` no-op execution and narrows Bash failure blocking
  to LongTable research-state commands.
- Extends `doctor --json` and `codex status --json` with `stopWouldBlock`,
  `activeBlockers`, stale pending counts, and next actions.

## Verification

- `scripts/smoke-codex-hooks.mjs` now covers hard-stop Stop blocking, non-hard-
  stop false positives, quiet PostToolUse behavior, managed hook status noise,
  and doctor/codex status hard-stop diagnostics.

## Compatibility

Existing state remains readable. The new hard-stop fields are optional, and old
pending records are classified by narrow Research Specification-affecting
metadata such as checkpoint key and commitment family.

Public npm/GitHub release still requires explicit release authority.
