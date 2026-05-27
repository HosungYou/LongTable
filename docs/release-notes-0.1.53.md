# LongTable 0.1.53

LongTable 0.1.53 makes Panel the only public collaboration surface.

## Changes

- Disables direct `longtable team` execution for new work.
- Routes team-style research requests through `longtable panel`.
- Routes explicit debate-language requests to panel debate records under
  `.longtable/panel/`.
- Removes `$longtable team` style examples from active provider and command
  surfaces.
- Preserves historical team/debate type compatibility for older workspace
  records.

## Verification

- `npm test`
- `npm run release:check`
- `git diff --check`
- direct `longtable team` disabled smoke
- panel debate artifact smoke
