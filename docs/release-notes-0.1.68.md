# LongTable 0.1.68

LongTable 0.1.68 removes the packaged `$critical-interview` compatibility skill.
`$longtable-interview` is now the only generated pressure-interview skill for
Codex and Claude.

## Changes

- Removes `$critical-interview` from generated Codex and Claude skill bundles.
- Removes `$critical-interview` from LongTable router skill text.
- Cleans up legacy `critical-interview` skill folders during skill install and
  remove-skills commands.
- Keeps the grilling behavior in `$longtable-interview`: state the tension,
  give the recommended answer, and ask the researcher to accept, revise, or
  reject it.

## Migration

Use `$longtable-interview` for all grill-me-style or pressure-interview flows.

## Verification

- `npm run smoke:setup`
- `npm run smoke:grilling-interview`
- `npm run smoke:scholar-research`
- `npm run release:check`
