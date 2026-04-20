# Relationship To LongTable

## Current Position

`LongTable` is not a replacement for the current `LongTable` repository.

It is an isolated architecture workspace used to design the next-generation structure without destabilizing the active codebase and deployed flows.

## Source Roles

### Current LongTable

- production-oriented runtime and packaging history
- active Claude-first behavior and existing deployment surface
- legacy checkpoint, hook, and agent orchestration behavior

### LongTable

- next architecture source of truth
- provider-neutral contracts
- researcher-centered setup and checkpoint semantics
- migration planning and package boundary definition

## Intended Flow

The expected direction is:

1. define stable contracts in this repository
2. validate package boundaries and adapter responsibilities
3. selectively port those decisions into `LongTable`
4. retire duplicated design material once migration is complete

## Non-Goals

- do not mirror the full production repo here by default
- do not publish unstable contracts directly from this workspace
- do not let Claude or Codex runtime details become the core product definition

## Merge Policy

Nothing should move into the production LongTable repository until all of the following are true:

- the product language is stable
- checkpoint and memory semantics are documented
- package boundaries are explicit
- provider-specific behavior is isolated
- migration impact is recorded in `docs/MIGRATION-MAP.md`

## Repository Strategy

This workspace may live as:

- a private standalone GitHub repository during refactoring
- a long-lived architecture lab for the main product
- or a temporary repository that feeds a later merge back into the primary LongTable repo

The default assumption should be private-first until the contracts are stable.
