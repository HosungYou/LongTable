# Release Process

## Version Range

Current hardening work remains in the `0.1.x` line. Use patch releases for
packaging, provider adapters, checkpoint policy, documentation, and CI hardening.

Reserve `0.2.0` for richer interactive question sessions, stronger
provider-native question rendering, and deeper scholarly connector
orchestration. The `0.1.x` line may include the basic `longtable question ->
longtable decide` lifecycle, legal scholarly search scaffolds, and optional MCP
transport when they remain provider-neutral and backward-compatible.

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
git tag -a v0.1.24 -m "Release LongTable 0.1.24

Technical changes:
- route Codex checkpoints through MCP elicitation first when available
- preserve numbered checkpoint fallback when elicitation is unavailable
- harden checkpoint triggers for knowledge gaps and panel disagreement collapse

Verification:
- npm run test
- npm run pack:check
- classifier simulation for MCP-first checkpoint cases"
git push origin v0.1.24
```

Annotated tag messages and GitHub Release notes should be technical and
specific. Include changed package surfaces, config/schema changes, migration or
fallback behavior, and the exact verification commands. Avoid generic release
messages when the change affects provider runtime configuration, checkpoint
policy, MCP tools, setup behavior, or state files.

The release workflow publishes all public workspaces when a `v0.1.*` tag is
pushed. It uses npm Trusted Publishing (GitHub Actions OIDC), so the publish
job does not need an `NPM_TOKEN`. Packages are published in dependency order:
core, memory, checkpoints, setup, scholar-research, research-search, provider
adapters, CLI, then MCP.

Configure one trusted publisher for each existing `@longtable/*` package in
the npm package settings, or use the logged-in npm CLI:

```bash
for pkg in \
  @longtable/core @longtable/memory @longtable/checkpoints @longtable/setup \
  @longtable/scholar-research @longtable/research-search \
  @longtable/provider-codex @longtable/provider-claude \
  @longtable/cli @longtable/mcp; do
  npm trust github "$pkg" --file release.yml \
    --repo HosungYou/LongTable --allow-publish --yes
done
```

The workflow filename is `release.yml`, the repository is
`HosungYou/LongTable`, and the trusted publisher must allow direct `npm
publish`. The workflow uses Node 24 and npm 11.5.1 or later, and already has
the required `id-token: write` permission. npm generates provenance
attestations automatically when the OIDC publish succeeds.

For a temporary rollback during migration, retain the existing GitHub
`NPM_TOKEN` secret but do not wire it back into this workflow unless the
Trusted Publishing verification fails. A token scoped to another npm
organization can authenticate but fail at publish time with a registry `404
Not Found` for `@longtable/<package>`. A token fallback can be checked with:

```bash
npm whoami
npm access list packages @longtable --json
```

If a token fallback is used, the required packages must all report
`read-write`: `@longtable/core`,
`@longtable/memory`, `@longtable/checkpoints`, `@longtable/setup`,
`@longtable/scholar-research`, `@longtable/research-search`,
`@longtable/provider-codex`, `@longtable/provider-claude`, `@longtable/cli`,
and `@longtable/mcp`. Do not revoke the temporary token until a new tag has
completed successfully through OIDC; after that, revoke it and enable npm's
package setting to require 2FA and disallow tokens.

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
npm publish --workspace @longtable/scholar-research --access public
npm publish --workspace @longtable/research-search --access public
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
- `@longtable/scholar-research`
- `@longtable/research-search`
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
