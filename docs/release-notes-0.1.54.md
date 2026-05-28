# LongTable 0.1.54

LongTable 0.1.54 adds a shared Research Specification readiness gate for the
`$longtable-start` to `$longtable-interview` handoff.

## Changes

- Adds provider-neutral Research Specification readiness states:
  `no_spec`, `shape_only`, `structurally_incomplete`,
  `draft_pending_confirmation`, `deferred`, and `confirmed`.
- Keeps First Research Shape as a handle/resume layer instead of treating it as
  a post-start interview unlock.
- Routes MCP `begin_interview`, Research Specification read/confirm outputs,
  CLI inspection, and Codex hook context through the same readiness semantics.
- Makes draft or deferred Research Specification confirmation visible as a
  next action instead of a silent failure.
- Adds a Mermaid architecture record for the readiness pipeline, state machine,
  entity map, and adapter boundary.
- Updates Codex and Claude generated skill guidance to use MCP
  `readiness.usableForInterview` when available.

## Verification

- `npm test`
- `npm run release:check`
- Research Specification readiness smoke cases
- Codex hook smoke
