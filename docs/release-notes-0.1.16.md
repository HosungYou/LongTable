# LongTable 0.1.16 Release Notes

## Summary

This patch release prepares LongTable for permission-first setup and lightweight
gap/tacit sentinel checks.

## Added

- `longtable setup --provider codex|claude`
  - permission-first setup for provider runtime surfaces
  - explicit approval for skills, MCP, advisory sentinel, and team mode
  - setup choices explain why they matter and what tradeoff they introduce
- `longtable sentinel --prompt "..."`
  - classifies measurement, theory, method, evidence, tacit-assumption, and
    authorship risks
  - can record unconfirmed inferred hypotheses into `.longtable/state.json`
- `longtable hud`
  - renders current workspace goal, blocker, pending questions, recent decisions,
    and invocation counts
  - `--watch` refreshes the terminal

## Clarified

- `npm install -g @longtable/cli` installs the CLI only.
- Codex/Claude skills, MCP config, hooks, and sentinel behavior are
  runtime changes and require explicit setup approval.

## Verification

Before release:

```bash
npm run test
npm run pack:check
```

## Operational Record

Release execution notes, npm WebAuthn/security-key authentication behavior, and
the lockfile integrity incident are documented in
[`RELEASE-POSTMORTEM-0.1.16.md`](./RELEASE-POSTMORTEM-0.1.16.md).
