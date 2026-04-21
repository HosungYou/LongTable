# LongTable 0.1.17 Release Notes

Note: `0.1.17` was published but immediately superseded by `0.1.18`, which
adds workspace state preservation for unknown top-level memory fields. Use
`0.1.18` or later.

## Summary

This patch release adds file-backed autonomous team debate orchestration. The
feature extends `longtable team` from role-pane launch support into a fixed
five-round debate protocol that preserves disagreement and turns the result into
a Researcher Checkpoint.

## Added

- `longtable team --debate`
  - creates a durable debate record under `.longtable/team/<id>/`
  - runs a fixed five-round protocol: independent review, cross-review,
    rebuttal, convergence, and synthesis/checkpoint
  - supports `--json` for machine-readable run records
  - supports `--tmux` as an optional live role-pane surface
- `TeamDebateRun`, `TeamDebateRound`, `TeamDebateContribution`, and
  `TeamDebateSynthesis` core contracts
- debate-linked `InvocationRecord` support through `teamDebateRun`
- `docs/TEAM-DEBATE-ORCHESTRATION.md`

## Clarified

- Team debate is a research harness, not a general agent-worker runtime.
- Debate artifacts are the canonical record; tmux panes are optional UX.
- Autonomous role disagreement must end in a researcher-facing checkpoint rather
  than an AI-selected final decision.

## Fixed

- LongTable workspace loading now treats the directory where `.longtable/` is
  found as the authoritative project path. This keeps moved or synced workspaces
  from writing state to an old absolute path from another machine.

## Verification

Before release:

```bash
npm ci
npm run test
npm run pack:check
longtable team --debate --prompt "Review this measurement plan" --role editor,measurement_auditor --json
```
