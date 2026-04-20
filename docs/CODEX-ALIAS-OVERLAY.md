# Codex Alias Overlay

## Decision

LongTable may support an in-Codex command layer through installed prompt files, but this layer is experimental and must not be treated as the primary promised UX.

The current target surface is:

- `/prompts:longtable-init`
- `/prompts:longtable-explore`
- `/prompts:longtable-review`
- `/prompts:longtable-panel`
- `/prompts:longtable-editor`
- `/prompts:longtable-reviewer`
- `/prompts:longtable-methods`
- `/prompts:longtable-critique`
- `/prompts:longtable-draft`
- `/prompts:longtable-commit`
- `/prompts:longtable-status`

## Why This Layer Exists

Prompt files are the lightest-weight way to attempt an in-session LongTable surface without building a full plugin runtime.

This overlay does not replace the runtime wrapper.
It complements it.

## Role Split

- `longtable start` and `longtable ask` are the primary user-facing entry points
- `longtable codex install-prompts` is an optional bridge for users whose Codex build actually exposes installed prompt files

## Current Rule

Prompt aliases are intentionally thin.
They should:

- encode LongTable mode expectations
- expose a small number of visible role-specific entry points
- keep question-first and narrative-trace behavior visible
- avoid pretending to be a full plugin runtime

They should not:

- silently redefine the core product contract
- depend on provider-only assumptions outside Codex
- be documented as guaranteed native slash commands when the user's Codex build may not expose them

## Implementation

The alias installer currently lives in `packages/longtable/src/prompt-aliases.ts`.

The user installs prompt files with:

```bash
longtable codex install-prompts
```

Status is checked with:

```bash
longtable codex status
```

## Product rule

If prompt files are installed but the user's Codex build does not expose them as slash commands, LongTable should still be fully usable through:

- `longtable start`
- `longtable ask`

Researcher trust is more important than preserving an elegant but unreliable in-Codex entry story.
