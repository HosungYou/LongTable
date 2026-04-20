# AGENTS.md

This directory contains the refactoring source of truth for LongTable.

## Purpose

Use this directory to design the next architecture for LongTable before implementation changes are made elsewhere.

## Working Rules

- Treat `PRD.md` and `Spec.md` as the primary documents.
- Treat files under `docs/` as supporting design records.
- Do not define provider-specific behavior in a way that becomes the core product contract.
- Prefer `researcher-centered harness` language over `AI assistant` language.
- Checkpoints must be defined by research meaning, not by agent identity alone.
- Memory must distinguish `explicit state`, `inferred hypotheses`, and `open tensions`.
- `.claude` and `.codex` should be treated as adapter outputs, not as the canonical source.

## Editing Rules

- Keep documents concise and decision-oriented.
- When adding a new design document, cross-link it from `Spec.md` or `docs/MIGRATION-MAP.md`.
- Avoid inventing terminology when established language is good enough.
- If a new mechanism affects researcher trust, checkpoint behavior, or profile inference, document the rationale explicitly.

## Required Supporting Docs

- `docs/ARCHITECTURE.md`
- `docs/CHECKPOINTING.md`
- `docs/MEMORY.md`
- `docs/PROVIDER-STRATEGY.md`
- `docs/MIGRATION-MAP.md`

## Implementation Boundary

This folder is for architecture and refactoring design. Do not treat it as the production runtime.
