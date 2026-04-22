# Question Runtime

## Decision

LongTable owns the checkpoint and question semantics, but provider adapters own the presentation surface.

The product-facing name for this layer is **Researcher Checkpoint**.
`AskUserQuestion` and numbered prompts are provider transports for that layer.

This means the core system decides:

- whether a question is required
- why the question is required
- whether the answer is blocking
- how the answer updates decision log, working state, or explicit state

Provider adapters decide:

- whether Claude Code should use `AskUserQuestion`
- whether Codex should use MCP elicitation or numbered checkpoint text
- whether a future UI should use a form, modal, or terminal selector

## Contract

The shared contract is `QuestionPrompt -> QuestionAnswer -> QuestionRecord`.

At the product level, this lifecycle is described as:

```text
Researcher Checkpoint -> QuestionRecord -> DecisionRecord
```

`QuestionPrompt` is provider-neutral. It carries the checkpoint key, question text, options, required/blocking posture, source, a short display reason, internal rationale, and preferred surfaces.

`QuestionAnswer` is normalized. Claude native choices, Codex numbered responses, and future web form selections should all become the same shape before they update LongTable state.

`QuestionRecord` is durable lifecycle state. It exists so a required question is not inferred from prompt text alone.

## Triggering

Natural-language checkpoint triggering is owned by `@longtable/checkpoints`.
The classifier converts prompt context into a `CheckpointSignal` before provider
adapters render anything.

```text
natural language
  -> classifyCheckpointTrigger
  -> CheckpointSignal
  -> resolveCheckpointPolicy
  -> resolveRuntimeGuidance
  -> provider-rendered checkpoint
```

This protects LongTable from depending only on explicit commands such as
`lt commit:`. A request about submission, measurement validity, evidence
verification, authorship, named knowledge gaps, tacit assumptions, or LongTable
platform-language changes can still activate the right checkpoint posture.

## Direct Command Surface

`longtable question` writes a pending `QuestionRecord` from natural-language
decision context:

```bash
longtable question --prompt "We are about to finalize the measurement plan."
```

Provider rendering can be inspected at the same boundary:

```bash
longtable question --provider codex --print --prompt "We are about to finalize the measurement plan."
longtable question --provider claude --print --prompt "We are about to finalize the measurement plan."
```

`longtable decide` answers that pending question and appends a `DecisionRecord`:

```bash
longtable decide --question <id> --answer evidence --rationale "Need scale validity support first."
```

Required pending questions block normal `ask`, mode, panel, team, and debate
commands in the CLI until they are answered. This gives "blocking" a concrete
runtime meaning: the system does not silently proceed through a required
checkpoint.

Provider adapters expose the same record differently:

- Codex uses MCP `elicit_question` when available, and
  `renderQuestionRecordPrompt(record)` as the numbered fallback.
- Claude uses `renderQuestionRecordInput(record)` to produce a structured
  AskUserQuestion-compatible payload.

## Provider Mapping

### Claude Code

Claude should prefer native structured questions when available.

Flow:

1. checkpoint engine resolves `blocking` and runtime guidance
2. Claude adapter converts the Researcher Checkpoint into `AskUserQuestion` input
3. Claude Code presents the native question surface
4. the selected answer is normalized into LongTable state

LongTable should not replace Claude Code's native question surface with a custom terminal UI when the native tool is available.

### Codex

Codex should use LongTable-owned MCP elicitation when that tool surface is
available and fall back to numbered checkpoints otherwise.

Flow:

1. checkpoint engine resolves `blocking` and runtime guidance
2. MCP transport requests Codex/client elicitation when `elicit_question` is available; the form asks for the decision only
3. Codex adapter renders numbered options with strict parsing as the fallback
4. invalid numbered answers re-prompt
5. the selected answer is normalized into LongTable state

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

MCP makes runtime integration more robust without replacing this contract.

`@longtable/mcp` exposes `longtable-state`, a structured transport over the
same `QuestionRecord -> DecisionRecord` lifecycle.

Current MCP tools can:

- read LongTable project/session state
- inspect pending questions
- evaluate checkpoint triggers without writing state
- write normalized question records
- elicit a Researcher Checkpoint through MCP form elicitation when the client supports it, recording accepted answers with surface `mcp_elicitation`
- render provider-specific question transport
- append decision records
- regenerate `CURRENT.md`

MCP should not become the source of truth for checkpoint semantics. It should be
a transport and integration layer over `@longtable/core` and
`@longtable/checkpoints`. If elicitation is unavailable, the same pending
QuestionRecord must be rendered as a numbered fallback and answered with
`longtable decide`.
