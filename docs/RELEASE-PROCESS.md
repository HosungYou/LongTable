# Release Process

## Version Range

Current hardening work remains in the `0.1.x` line. Use patch releases for
packaging, provider adapters, checkpoint policy, documentation, and CI hardening.

Reserve `0.2.0` for richer interactive question sessions, stronger
provider-native question rendering, and scholarly search adapters. The `0.1.x`
line may include the basic `longtable question -> longtable decide` lifecycle
and optional MCP transport when they remain provider-neutral and
backward-compatible.

## Required Checks

Before tagging a release, run:

```bash
npm ci
npm run release:check
```

`release:check` runs:

- workspace typecheck
- workspace build
- npm pack dry-run for publishable workspaces

The root build and typecheck scripts intentionally run workspaces in dependency
order. Do not switch them back to generic `--workspaces` ordering unless package
references are changed to source-level project references.

## Tagging

For the `0.1.x` line:

```bash
git tag v0.1.10
git push origin main --tags
```

The release workflow publishes all public workspaces when a `v0.1.*` tag is
pushed. It requires `NPM_TOKEN` to be configured in GitHub repository secrets.
Packages are published in dependency order: core, memory, checkpoints, setup,
provider adapters, CLI, then MCP.

## Package Contract

All `@longtable/*` packages should stay version-aligned during `0.1.x`.
Internal package dependencies should use the exact same version.

The publishable packages are:

- `@longtable/core`
- `@longtable/memory`
- `@longtable/checkpoints`
- `@longtable/setup`
- `@longtable/provider-codex`
- `@longtable/provider-claude`
- `@longtable/cli`
- `@longtable/mcp`

## Release Notes

Each release note should call out:

- checkpoint behavior changes
- provider behavior changes
- state schema or `.longtable/` changes
- CLI surface changes
- known limitations
- verification commands
