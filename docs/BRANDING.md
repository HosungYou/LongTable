# Branding

## Decision

The product, repository, package scope, CLI command, and managed runtime path now use `LongTable` consistently.

## Public Surface

- product name: `LongTable`
- GitHub repository: `HosungYou/LongTable`
- npm scope: `@longtable/*`
- researcher-facing command: `longtable`
- managed runtime path: `~/.longtable/`

## Packaging Rule

Only `@longtable/cli` defines the primary researcher-facing command surface.

Supporting packages such as `@longtable/setup` and `@longtable/provider-codex` may stay publishable as libraries, but they should not become the default install story for researchers.

## Naming Rule

When a new artifact is introduced:

- use `LongTable` for product and repository references
- use `@longtable/*` for package scope
- use `longtable` for shell command examples
- use `~/.longtable/` for managed runtime files

Do not introduce new legacy aliases or phased branding language.
