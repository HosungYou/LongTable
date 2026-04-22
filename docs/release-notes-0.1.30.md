# LongTable 0.1.30 Release Notes

## Summary

LongTable 0.1.30 extends `longtable search` with access-aware publisher
configuration for licensed scholarly content.

## Technical Changes

- Added publisher access capability probing for Elsevier / ScienceDirect,
  Springer Nature, Wiley, and Taylor & Francis.
- Added `longtable search setup`, `longtable search doctor`, and
  `longtable search probe --doi <doi>` for non-secret credential and
  entitlement checks.
- Added `longtable search --publisher-access` to enrich evidence cards with
  publisher access status when user-provided credentials allow it.
- Added access and verification depth fields to evidence cards so metadata,
  abstract, legal full text, licensed snippets, denied access, and unknown
  license states are distinguishable.
- Made citation support more conservative: metadata-only and abstract-only
  results no longer claim full-paper verification.

## Verification

- `npm run release:check`
- CLI smoke coverage for publisher access probing and search doctor output
- Pack dry-run confirms `dist/search/publisher-access.*` ships with
  `@longtable/cli`
