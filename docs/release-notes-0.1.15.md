# LongTable 0.1.15 Release Notes

## Summary

This patch release prepares LongTable for permission-first setup, lightweight
gap/tacit sentinel checks, and optional tmux-based research interfaces.

## Added

- `longtable setup --provider codex|claude`
  - permission-first setup for provider runtime surfaces
  - explicit approval for skills, MCP, advisory sentinel, tmux UX, and team mode
  - setup choices explain why they matter and what tradeoff they introduce
- `longtable sentinel --prompt "..."`
  - classifies measurement, theory, method, evidence, tacit-assumption, and
    authorship risks
  - can record unconfirmed inferred hypotheses into `.longtable/state.json`
- `longtable hud`
  - renders current workspace goal, blocker, pending questions, recent decisions,
    and invocation counts
  - `--watch` refreshes the terminal
  - `--tmux` opens a HUD pane inside an existing tmux session
- `longtable team --tmux`
  - opens role-specific panes for tmux-backed research panel discussion
  - writes role logs under `.longtable/team/<id>/`

## Clarified

- `npm install -g @longtable/cli` installs the CLI only.
- Codex/Claude skills, MCP config, hooks, tmux panes, and sentinel behavior are
  runtime changes and require explicit setup approval.
- Tmux is an enhanced research console, not a LongTable requirement.

## Verification

Before release:

```bash
npm run test
npm run pack:check
```
