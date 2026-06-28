# LongTable 0.1.66

LongTable 0.1.66 unifies the follow-up and critical interview surfaces.
`$longtable-interview` is now the single interview entrypoint, while
`$critical-interview` remains as a compatibility alias for its critical mode.

## Changes

- Adds Critical Interview Mode to `$longtable-interview` for grill-me-style
  pressure testing.
- Preserves ordinary option-first follow-up after a usable Research
  Specification exists.
- Keeps ordinary no-spec follow-up routed to `$longtable-start`.
- Converts `$critical-interview` into a thin compatibility alias instead of a
  separate interview contract.
- Documents the unified interview surface in the root README, command-surface
  docs, and npm CLI README.

## Verification

- `npm run smoke:setup`
- `npm run smoke:scholar-research`
- `bun tmp/check-no-excuse-rules.ts packages/longtable-provider-codex/src/skills.ts packages/longtable-provider-claude/src/skills.ts`
- `npm run release:check`
