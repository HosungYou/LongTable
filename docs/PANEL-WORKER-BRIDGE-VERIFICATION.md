# Panel Worker Bridge Verification Evidence

This note records the verification lane for the visible writable panel worker bridge. It is intentionally evidence-only: no raw tmux logs, raw Codex logs, raw tool traces, or hidden reasoning are persisted here.

## Scope

- Verify `longtable panel --native-workers` integration through the existing panel surface.
- Preserve the public command contract: no public `longtable team` command and no `.longtable/team` artifacts.
- Preserve researcher-facing handoff hygiene: `PanelResult` evidence is recorded without hidden reasoning or raw logs/traces.
- Preserve type/build/package health across the monorepo.

## Required checks

Run from the repository root after implementation lanes are integrated:

```bash
npm run build
npm run smoke:panel-workers
npm run smoke:panel-handoff
npm run typecheck
npm run test
npm run pack:check
```

## Evidence expectations

- `smoke-panel-workers` must pass and includes assertions that:
  - help output does not advertise `longtable team`;
  - native worker tasks forbid hidden reasoning persistence;
  - handoff includes native worker guidance and worker evidence references;
  - `longtable team` exits with `Unknown command: team`, writes no stdout, and creates no `.longtable/team` artifact.
- `smoke-panel-handoff` must pass and includes assertions that:
  - panel skills retain the normalized `PanelResult` contract;
  - hidden reasoning and raw tool log fields are stripped from recorded state;
  - generated handoff includes provider-neutral continuation guidance and unincorporated evidence.
- `build`, `typecheck`, `test`, and `pack:check` must pass before the bridge is considered integration-ready.

## Worker-4 run result

On 2026-06-04, worker-4 ran the verification lane in its worktree:

- `npm run build` — PASS
- `npm run smoke:panel-workers` — PASS after build generated `packages/longtable/dist/cli.js`
- `npm run smoke:panel-handoff` — PASS
- `npm run typecheck` — PASS
- `npm run test` — PASS
- `npm run pack:check` — PASS
- Direct public-surface probe: `node packages/longtable/dist/cli.js team` — PASS, exited non-zero with `Unknown command: team`
- Artifact probe: `.longtable/team` — PASS, not present
