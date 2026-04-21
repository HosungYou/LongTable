# LongTable 0.1.21 Release Notes

## Summary

This patch makes the setup/start command model match LongTable's research
harness philosophy: setup asks for runtime permissions, while start asks for the
research object and the decisions that should not be allowed to settle quietly.

## Changed

- `longtable setup` is now the primary setup command.
- `longtable init` is a deprecated compatibility alias for permission-first
  setup unless full legacy automation flags are provided.
- `longtable setup` asks only permission-centered questions:
  install scope, enabled surfaces, intervention level, and workspace preference.
- `longtable start` records research object, gap/tacit risk, and protected
  decision in session state, working memory, and `CURRENT.md`.

## Verification

```bash
npm run test
npm run pack:check
node scripts/smoke-setup-flow.mjs
```
