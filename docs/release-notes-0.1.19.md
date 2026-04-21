# LongTable 0.1.19 Release Notes

## Summary

This patch removes the research-field question from interactive setup. Field is
now optional and defaults to `unspecified` unless the researcher provides it by
flag or through an older setup artifact.

## Fixed

- `longtable init --flow interview` no longer begins with "Before we begin,
  which research field best matches your work right now?"
- `longtable-setup init` follows the same optional-field behavior.
- Runtime config and project workspace creation preserve compatibility by
  falling back to `field: unspecified`.

## Verification

```bash
npm run build
node -e 'import("./packages/longtable-setup/dist/onboarding.js").then(m=>console.log(m.buildQuickSetupFlow("interview").map(q=>q.id)))'
node packages/longtable/dist/cli.js init --provider codex --career-stage doctoral --experience intermediate --checkpoint balanced --json --no-install
```
