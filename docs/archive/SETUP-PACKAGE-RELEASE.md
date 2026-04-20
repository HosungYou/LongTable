# Setup Package Release

## Package

`@longtable/setup`

## Publish Surface

- package entry: `dist/index.js`
- CLI entry: `longtable-setup`
- examples shipped in package

## Minimum Release Steps

1. run `npm install`
2. run `npm run typecheck`
3. run `npm run build`
4. verify `longtable-setup init ... --json`
5. verify `longtable-setup init ... --write --json`
6. verify `longtable-setup init ... --write --install --json`
7. verify `longtable-setup show --json`
8. verify `longtable-setup install --json`
9. confirm README and examples match the actual output shape

## Manual Test Commands

Workspace validation:

```bash
npm install
npm run typecheck
npm run build
```

Package smoke tests:

```bash
node packages/longtable-setup/dist/cli.js init --json
node packages/longtable-setup/dist/cli.js init --write --json
node packages/longtable-setup/dist/cli.js init --write --install --json
node packages/longtable-setup/dist/cli.js show --json
node packages/longtable-setup/dist/cli.js install --json
```

## Release Hygiene

- update `packages/longtable-setup/README.md` whenever CLI flags or output paths change
- update the root `README.md` whenever the recommended workspace test path changes
- prefer `npm pack` before first publish or version bumps
- keep examples in `packages/longtable-setup/examples/` aligned with actual generated output

## Current Release Position

This package is now scaffolded as publish-ready inside the refactoring repo.

It now includes a LongTable-managed runtime installer surface that writes generated config under `~/.longtable/runtime/` without overwriting provider-native config files directly.

It should still be smoke-tested from a packed tarball before first public publish.
