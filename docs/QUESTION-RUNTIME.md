# Question Runtime

## Decision

LongTable owns the checkpoint and question semantics, but provider adapters own the presentation surface.

This means the core system decides:

- whether a question is required
- why the question is required
- whether the answer is blocking
- how the answer updates decision log, working state, or explicit state

Provider adapters decide:

- whether Claude Code should use `AskUserQuestion`
- whether Codex should use numbered checkpoint text
- whether a future UI should use a form, modal, or terminal selector

## Contract

The shared contract is `QuestionPrompt -> QuestionAnswer -> QuestionRecord`.

`QuestionPrompt` is provider-neutral. It carries the checkpoint key, question text, options, required/blocking posture, source, rationale, and preferred surfaces.

`QuestionAnswer` is normalized. Claude native choices, Codex numbered responses, and future web form selections should all become the same shape before they update LongTable state.

`QuestionRecord` is durable lifecycle state. It exists so a required question is not inferred from prompt text alone.

## Provider Mapping

### Claude Code

Claude should prefer native structured questions when available.

Flow:

1. checkpoint engine resolves `blocking` and runtime guidance
2. Claude adapter converts the checkpoint into `AskUserQuestion` input
3. Claude Code presents the native question surface
4. the selected answer is normalized into LongTable state

LongTable should not replace Claude Code's native question surface with a custom terminal UI when the native tool is available.

### Codex

Codex should use LongTable-owned numbered checkpoints unless a reliable structured question surface is available.

Flow:

1. checkpoint engine resolves `blocking` and runtime guidance
2. Codex adapter renders numbered options with strict parsing
3. invalid answers re-prompt
4. the selected answer is normalized into LongTable state

## What Must Stay Shared

- checkpoint activation logic
- required/recommended/log-only policy
- mandatory question generation
- answer normalization contract
- decision log semantics
- explicit state update rules

## What May Differ

- visual UI
- wording around the platform affordance
- how the answer is collected
- whether the platform blocks with a native tool or with a numbered prompt

## Repository Boundary

This does not require separate GitHub repositories for Claude and Codex.

The correct boundary is package-level:

- `@longtable/core` defines the question contract
- `@longtable/checkpoints` decides when questions are required
- `@longtable/provider-claude` maps to `AskUserQuestion`
- `@longtable/provider-codex` maps to numbered checkpoint interaction

Splitting repositories would make it easier for provider-specific behavior to drift into product semantics.

## MCP Position

MCP can make runtime integration more robust, but it should be adopted after this contract is stable.

Useful MCP candidates:

- read LongTable project/session state
- write normalized question records
- append decision records
- expose checkpoint evaluation as a tool

MCP should not become the source of truth for checkpoint semantics. It should be a transport and integration layer over `@longtable/core` and `@longtable/checkpoints`.
