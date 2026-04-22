# LongTable 0.1.18 Release Notes

## Summary

This patch release supersedes `0.1.17` with file-backed autonomous team debate
orchestration plus workspace-state preservation fixes. The feature extends
`longtable team` into a fixed five-round debate protocol that preserves
disagreement and turns the result into a Researcher Checkpoint.

## Added

- `longtable team --debate`
  - creates a durable debate record under `.longtable/team/<id>/`
  - runs a fixed five-round protocol: independent review, cross-review,
    rebuttal, convergence, and synthesis/checkpoint
  - supports `--json` for machine-readable run records
- `TeamDebateRun`, `TeamDebateRound`, `TeamDebateContribution`, and
  `TeamDebateSynthesis` core contracts
- debate-linked `InvocationRecord` support through `teamDebateRun`
- `docs/TEAM-DEBATE-ORCHESTRATION.md`

## Fixed

- LongTable workspace loading now treats the directory where `.longtable/` is
  found as the authoritative project path. This keeps moved or synced workspaces
  from writing state to an old absolute path from another machine.
- Workspace state append now preserves unknown top-level memory fields, such as
  operational memory, instead of narrowing state to the currently typed fields.

## Clarified

- Team debate is a research harness, not a general agent-worker runtime.
- Debate artifacts are the canonical record.
- Autonomous role disagreement must end in a researcher-facing checkpoint rather
  than an AI-selected final decision.

## Verification

Before release:

```bash
npm ci
npm run test
npm run pack:check
longtable team --debate --prompt "Review this measurement plan" --role editor,measurement_auditor --json
```
