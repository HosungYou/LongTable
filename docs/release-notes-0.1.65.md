# LongTable 0.1.65

LongTable 0.1.65 publishes the Journal Editor venue-fit boundary in user-facing
and npm-facing documentation, and aligns release-process docs with the current
scholarly research packages.

## Changes

- Documents that `longtable-editor` and `--role editor` must not invent
  target-journal fit from role intuition alone.
- Defines the required journal profile for named-venue fit judgments:
  aims/scope, author guidance, recent article patterns, and article type
  expectations.
- Documents the provisional fallback when a target journal profile has not been
  recovered.
- Adds npm README coverage for the CLI editor-fit boundary and the
  `@longtable/scholar-research` venue-evidence role.
- Updates the release process to include `@longtable/scholar-research` and
  `@longtable/research-search` in publish order, access checks, and package
  contract.

## Verification

- `npm run release:check`
- `git diff --check`
- published npm README checks for `@longtable/cli` and
  `@longtable/scholar-research`
