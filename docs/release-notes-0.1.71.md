# LongTable 0.1.71

LongTable 0.1.71 compresses `$longtable-interview` into a smaller positive
contract. The generated Codex and Claude skills now describe the interview as a
compact pressure loop instead of centering the guidance on what to avoid.

## Changes

- Replaces prohibition-first interview wording with a compact loop:
  read state, name `Tension:`, ask one `Pressure question:`, then wait.
- Keeps the direct-answer behavior while removing option-menu and approval
  wording from the generated interview skill body.
- Updates setup and grilling smoke tests to require the compact contract.
- Updates README and command-surface docs to match the minimized interview
  language.

## Migration

No command changes. Use `$longtable-interview` as before; the generated skill
now carries fewer instructions and a stronger output shape.

## Verification

- `npm run build`
- `npm run smoke:setup`
- `npm run smoke:grilling-interview`
- `npm run release:check`
