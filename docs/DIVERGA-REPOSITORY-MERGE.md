# Diverga Repository Merge

## Decision

LongTable can be moved onto the existing `HosungYou/Diverga` repository without splitting GitHub repositories.

The safest path is not a blind force push. It is a tagged replacement release:

1. preserve the current Diverga repository state with a tag
2. create a migration branch
3. replace the product surface with the LongTable monorepo contents
4. verify build/typecheck
5. tag the new LongTable-on-Diverga state
6. push branch and tags
7. only then decide whether `main` should move to the new state

## Why This Shape

LongTable's product contract should stay unified.

Claude Code and Codex differ at the adapter layer, not at the research/checkpoint logic layer. Splitting repositories would make checkpoint policy, memory semantics, and decision logging more likely to drift.

## Recommended Tag Plan

Before replacement:

```bash
git tag diverga-pre-longtable-YYYYMMDD
git push origin diverga-pre-longtable-YYYYMMDD
```

After replacement and verification:

```bash
git tag longtable-migration-YYYYMMDD
git push origin longtable-migration-YYYYMMDD
```

If the migration should become the default branch, merge the migration branch into `main` or move `main` only after reviewing the diff and confirming no legacy artifact needs to be preserved.

## Overwrite Policy

Allowed:

- replacing the root README/product contract
- replacing package structure
- archiving old Diverga-specific docs under `docs/archive/diverga-legacy/`
- changing package names from Diverga to LongTable

Not allowed without an explicit preservation pass:

- losing release history without a tag
- deleting unpublished design notes that explain current behavior
- moving provider-specific behavior into core LongTable semantics
- forcing Claude and Codex into separate checkpoint policy implementations

## MCP Position

MCP is useful, but it should be added as an integration layer after the core contract is stable.

The useful MCP surface for LongTable is:

- read project context
- read current session
- evaluate checkpoint policy
- write pending/answered question records
- append decision records
- regenerate `CURRENT.md`

MCP should not replace the npm packages as the source of truth. The packages should remain canonical, and MCP tools should call into those packages.

## First MCP Candidate

The first practical MCP server should be `longtable-state`.

Minimal tools:

- `longtable_read_project`
- `longtable_read_session`
- `longtable_evaluate_checkpoint`
- `longtable_write_question_record`
- `longtable_append_decision`
- `longtable_regenerate_current`

This would make Claude/Codex integration more robust because the runtime can mutate state through structured tools instead of relying only on generated prompt text.

## Local Repository Notes

Observed local repositories:

- `/Users/hosung/diverga-integration` tracks `https://github.com/HosungYou/Diverga`
- `/Users/hosung/long-table-refactoring-sync` tracks `https://github.com/HosungYou/LongTable.git`

Replacement work should happen on a dedicated branch in `/Users/hosung/diverga-integration`, not directly on `main`.
