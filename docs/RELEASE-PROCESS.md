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

After publishing a version manually, run `npm ci` again before merging or
tagging. This catches lockfile entries whose `integrity` values were generated
before the real registry tarballs existed.

```bash
npm ci
npm run test
npm run pack:check
```

## Tagging

For the `0.1.x` line:

```bash
git tag -a v0.1.19 -m "Release LongTable 0.1.19"
git push origin v0.1.19
```

The release workflow publishes all public workspaces when a `v0.1.*` tag is
pushed. It requires `NPM_TOKEN` to be configured in GitHub repository secrets.
Packages are published in dependency order: core, memory, checkpoints, setup,
provider adapters, CLI, then MCP.

If the packages were already published manually, the release workflow should
skip existing versions and still create the GitHub Release. Confirm the workflow
completed successfully before treating GitHub deployment as done.

## Manual npm Publishing

Manual publishing is useful when validating a release before tag-based
automation, or when the `NPM_TOKEN` secret is not ready. Publish from the
repository root and keep workspace order explicit:

```bash
npm publish --workspace @longtable/core --access public
npm publish --workspace @longtable/memory --access public
npm publish --workspace @longtable/checkpoints --access public
npm publish --workspace @longtable/setup --access public
npm publish --workspace @longtable/provider-codex --access public
npm publish --workspace @longtable/provider-claude --access public
npm publish --workspace @longtable/cli --access public
npm publish --workspace @longtable/mcp --access public
```

The `newhosung` npm account uses npm WebAuthn/security-key authentication for
write actions. If `npm publish` returns `EOTP` and prints an
`https://www.npmjs.com/auth/cli/...` URL, rerun the publish command in a TTY,
press Enter at the browser prompt, and complete the npm security-key/passkey
flow in the browser. Do not request or store npm passwords, recovery codes, or
tokens in chat logs.

```bash
npm publish --workspace @longtable/core --access public
# Press ENTER when npm asks to open the auth URL, then approve in the browser.
```

After manual publishing, verify registry state:

```bash
npm view @longtable/cli version dist-tags --json
npm view @longtable/core version
npm view @longtable/mcp version
npm install -g @longtable/cli@<version>
longtable sentinel --prompt "Should I define a new measurement construct?" --json
```

If `npm ci` fails with `EINTEGRITY` after publishing, compare
`package-lock.json` against `npm view <package>@<version> dist --json`. Refresh
the lockfile entries so each published `@longtable/*` package uses the registry
tarball `dist.integrity` value, then rerun `npm ci` and CI.

## GitHub Deployment Checklist

A release is not complete until all of these are true:

- the release branch or PR is pushed to GitHub
- CI passes on the PR
- the PR is marked ready and merged to `main`
- the version tag is pushed from `main`
- the Release workflow succeeds
- the GitHub Release page exists for the tag
- npm `latest` points at the intended `@longtable/cli` version
- a global install smoke test uses the published CLI

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
