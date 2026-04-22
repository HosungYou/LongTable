# LongTable 0.1.25 Release Notes

## MCP Checkpoint UX

- MCP elicitation now asks for the decision only, avoiding an optional rationale
  field that could trap users in a second form field.
- Checkpoint UI copy now uses a short `Decision context` line instead of
  repeated internal `Why now` rationale.
- MCP transport attempts record status such as fallback, timeout, declined, or
  accepted while keeping `.longtable/` state as the source of truth.
- Explicit checkpoint question, option, key, and display-reason overrides are
  supported so product tests and hand-authored questions are not reclassified
  into the wrong checkpoint family.

## Agent Team Review

- `longtable team` now records a three-step cross-review protocol: independent
  review, cross-review, and coordinator synthesis/checkpoint.
- `longtable team --debate` remains the five-step debate path with rebuttal and
  convergence rounds.
- Team artifacts now expose `interactionDepth` and cross-review references so a
  user can distinguish independent panel review from actual role interaction.

## Documentation

- Added `docs/AGENT-TEAM-README.md` as a user-facing guide to panel, team, and
  debate surfaces.
- Updated README and command docs to explain when to use `panel`, `team`, and
  `team --debate`.

## Packaging

- Workspace packages are aligned on version `0.1.25`.
- MCP install snippets now point to `@longtable/mcp@0.1.25`.
