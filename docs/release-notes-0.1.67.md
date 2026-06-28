# LongTable 0.1.67

LongTable 0.1.67 turns `$longtable-interview` into a simple, grill-me-style
pressure interview. The ordinary option-first branch has been removed from the
generated provider skill.

## Changes

- Makes `$longtable-interview` a LongTable grilling interview by default.
- Removes ordinary option-first follow-up routing from the interview skill.
- Stops routing `$longtable-interview` to `$longtable-start` just because no
  Research Specification exists.
- Requires each interview turn to state the tension, give a recommended answer,
  and ask the researcher to accept, revise, or reject it.
- Keeps `$critical-interview` as a compatibility alias for `$longtable-interview`.
- Adds an E2E smoke that installs generated Codex skills and verifies the
  observable grilling interview surface.

## Verification

- `npm run smoke:setup`
- `npm run smoke:grilling-interview`
- `bun tmp/check-no-excuse-rules.ts packages/longtable-provider-codex/src/skills.ts packages/longtable-provider-claude/src/skills.ts`
- `npm run release:check`
