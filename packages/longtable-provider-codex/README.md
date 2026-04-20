# @longtable/provider-codex

Codex-specific adapter logic for LongTable.

This package implements numbered checkpoint interaction and thin runtime-guidance injection rather than depending on a provider-native question widget.

## Role

This package provides the Codex adapter used by `@longtable/cli`.

It is publishable as a library package, but the primary researcher-facing command surface is `longtable`, not a standalone wrapper executable.

### Local build and test

From the workspace root:

```bash
npm install
npm run typecheck
npm run build
```

Then test the adapter directly:

```bash
node packages/longtable-provider-codex/dist/wrapper-cli.js \
  --print \
  --mode explore \
  --prompt "I want exploration, not a conclusion yet."
```

```bash
node packages/longtable-provider-codex/dist/wrapper-cli.js \
  --exec \
  --json \
  --mode review \
  --prompt "Review this claim critically."
```

If the wrapped behavior changes, update this README in the same commit.

The wrapper reads the managed setup artifact when available and prepends a short runtime-guidance block so Codex receives:

- mode
- minimum question requirements
- closure disposition
- narrative-trace preservation rules
- human commitment stakes when relevant

For the recommended setup path, pair this package with `@longtable/setup`.
