# Repository Policy

## Current Stage

This repository is in the architecture and refactoring stage.

The primary goal is to stabilize product language, contracts, and migration boundaries before implementation spreads across runtime repositories.

## Default Branch

Use `main` as the only default branch during the current stage.

## Branch Creation Rule

Do not create feature branches unless one of the following becomes true:

- implementation starts for a real package boundary
- a prototype adapter needs isolated experimentation
- a migration back into the main LongTable repository is being prepared

## Commit Policy

- keep commits document-focused and decision-oriented
- separate architecture decisions from implementation experiments
- avoid mixing provider-neutral contracts with provider-specific implementation details in the same commit when possible

## Pull Request Policy

If this repository later gains a remote and PR workflow:

- open PRs for package prototypes and implementation work
- keep document-only refinements small and scoped
- require migration impact to be recorded when a decision affects runtime behavior

## Relationship To Production

This repository should not be treated as the production release branch.

Production deployment logic stays in the current LongTable runtime until migration decisions are approved and explicitly ported.
