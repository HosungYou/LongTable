# Repo Structure

## Recommended Long-Term Shape

```text
LongTable/
  packages/
    longtable-core/
    longtable-provider-claude/
    longtable-provider-codex/
    longtable-checkpoints/
    longtable-memory/
    longtable-setup/
  docs/
  schemas/
  adapters/
  tests/
```

## Package Roles

- `longtable-core`: domain logic and contracts
- `longtable-provider-claude`: Claude-specific adapter
- `longtable-provider-codex`: Codex-specific adapter
- `longtable-checkpoints`: checkpoint policy engine
- `longtable-memory`: state, inferred hypotheses, tensions
- `longtable-setup`: onboarding and install flows

## Current Scaffold

The refactoring workspace now includes:

- workspace root `package.json`
- `packages/longtable-core` as the shared type and contract layer
- `packages/longtable-checkpoints` as the first real engine package
- `packages/longtable-memory` with research-state and summary scaffolds
- `packages/longtable-setup` with onboarding and numbered-checkpoint scaffolds
- `packages/longtable-provider-codex` with numbered checkpoint adapter scaffolds
- `packages/longtable-provider-claude` with structured checkpoint adapter scaffolds
- root `schemas/` for researcher profile, checkpoint policy, and research state

## Rule

Provider directories must not become the source of truth.
