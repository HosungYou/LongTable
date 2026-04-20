# NPM Release and Deployment

## Current Observations

Based on the current LongTable repository review:

- root workspace name is `longtable-monorepo`
- package versions should stay aligned under `0.1.xx`
- root workspace has build and typecheck scripts
- publishable surfaces live under `@longtable/*`
- `@longtable/setup` exists as a separate package
- the unified researcher-facing CLI is `@longtable/cli`

## Interpretation

This means:

- there is a publishable npm package graph already
- setup is one package in a broader `@longtable/*` surface
- the public contract should align package names, versions, and README guidance
- the unified runtime package is `@longtable/cli`

## Recommended Packaging Strategy

### Public npm packages

- `@longtable/core`
- `@longtable/memory`
- `@longtable/checkpoints`
- `@longtable/setup`
- `@longtable/provider-codex`
- `@longtable/provider-claude` only if distribution value is real

### Internal or optional packages

- core runtime packages that are not stable yet
- experimental orchestration utilities

## Deployment Strategy

### Phase 1

- keep private refactor docs
- align package names and versions
- decide what is actually meant for npm users

### Phase 2

- publish stable setup package
- publish codex adapter package
- document install and upgrade paths

### Phase 3

- add CI release workflow
- generate changelog and provenance
- add smoke tests for installability

## Required Checks Before Publishing

- package purpose is clear
- README matches package behavior
- version matches repo state
- install path is tested on target platform
- release workflow is reproducible

## Local npm Workflow

From the workspace root:

```bash
npm install
npm run typecheck
npm run build
```

If the package exposes a CLI, run a smoke test from the built `dist/` entry before packaging.

Examples:

```bash
node packages/longtable-setup/dist/cli.js show --json
node packages/longtable-provider-codex/dist/wrapper-cli.js --print --mode explore --prompt "I want exploration, not a conclusion yet."
```

## Git Update Workflow

Use this order when the package surface changes:

1. change code
2. change the package `README.md`
3. change the root `README.md` if the workspace-level testing or install flow changed
4. run validation
5. review `git diff`
6. commit with a message that names the behavioral change
7. push the branch

Minimal command sequence:

```bash
git status
npm run typecheck
npm run build
git add <changed-files>
git commit -m "Describe the shipped behavior change"
git push origin <branch>
```

## npm Package Update Workflow

Only publish package-level surfaces that are stable enough for external users.

Recommended sequence:

1. update `version` in the target package `package.json`
2. update package README examples
3. run root validation
4. run package-specific smoke tests
5. run `npm pack` inside the package directory
6. inspect the tarball contents
7. publish when the tarball matches the intended install surface

## Publish Order

Because the package graph is layered, publish in this order:

1. `@longtable/core`
2. `@longtable/memory`
3. `@longtable/checkpoints`
4. `@longtable/setup`
5. `@longtable/provider-codex`
6. `@longtable/provider-claude`

This keeps downstream packages from pointing at unpublished internal dependencies.

Example:

```bash
cd packages/longtable-setup
npm pack
tar -tf longtable-setup-<version>.tgz
```

## README Synchronization Rule

If one of these changes, update the README in the same round:

- CLI arguments
- generated file paths
- install commands
- runtime wrapper commands
- publishable package name or scope

Do not leave the root README and package README files describing different command paths.

## Key Risk

If setup package and runtime package drift, researchers will install an outdated onboarding surface and receive the wrong mental model.
