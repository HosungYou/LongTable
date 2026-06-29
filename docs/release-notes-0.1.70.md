# LongTable 0.1.70

LongTable 0.1.70 makes `$longtable-interview` pressure-first instead of
approval-first. The generated Codex and Claude skills now ask one direct
research pressure question at a time, without returning to the older
recommended-answer and accept/revise/reject flow.

## Changes

- Replaces the `$longtable-interview` recommended-answer frame with a
  `Tension:` plus `Pressure question:` frame.
- Forbids option menus, numbered choices, and approval prompts inside the
  grilling interview loop.
- Delays LongTable MCP/state writes until after the researcher answers or
  explicitly asks to record a decision.
- Extends the grilling-interview smoke test so generated skills fail if they
  reintroduce recommended-answer or accept/revise/reject language.

## Migration

Use `$longtable-interview` when the researcher wants a direct pressure
interview over a plan, claim, method, evidence standard, manuscript, or
LongTable product decision. Use `$longtable-start` or normal Researcher
Checkpoints when structured choices are the desired surface.

## Verification

- `npm run build`
- `npm run smoke:grilling-interview`
- `npm run release:check`
