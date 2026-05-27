# LongTable 0.1.52 Release Notes

Planned patch release for Codex Stop hard-stop behavior and hook diagnostics.

## Changes

- Adds provider-neutral hard-stop metadata and verdict collection for pending `QuestionRecord` and `LongTableQuestionObligation` state.
- Wires Codex `Stop` to block only active hard-stop blockers that affect the Research Specification question, scope, constructs, method, evidence boundary, or protected decisions.
- Keeps stale/product/tooling pending questions out of `Stop` blocking unless they are explicitly marked as hard-stop.
- Narrows `PostToolUse`: successful no-op Bash stays quiet, unrelated nonzero Bash no longer hard-blocks, and LongTable research-state mutations are denied only while a hard-stop blocker exists.
- Removes the noisy managed `PostToolUse` status message from new Codex hook installs.
- Extends `doctor --json`, `codex status --json`, and `codex hook-doctor --json` with `stopWouldBlock`, `activeBlockers`, stale/unrelated pending question count, hook coverage, hook trust, and next actions.

## Verification

Run before publishing:

```bash
npm ci
npm run build
npm run smoke:hooks
npm run test
npm run release:check
npm run pack:check
```

Publishing to npm or creating a GitHub release still requires explicit release authority.
