# LongTable 0.1.69

LongTable 0.1.69 separates `$grill-me` from `$longtable-interview`.
`$longtable-interview` remains the LongTable research pressure-interview
surface, but it no longer advertises or captures grill-me requests.

## Changes

- Removes `grill-me-style` routing language from generated Codex and Claude
  `$longtable-interview` skills.
- Narrows `$longtable-interview` to research plans, claims, methods, evidence
  standards, manuscripts, and LongTable product decisions.
- Extends the grilling-interview smoke test so generated LongTable skills fail
  if they advertise `grill-me`.

## Migration

Use `$longtable-interview` for LongTable research-state pressure interviews.
Use a separate `$grill-me` skill for code, product, architecture,
implementation, or operational pressure interviews.

## Verification

- `npm run smoke:grilling-interview`
- `npm run release:check`
