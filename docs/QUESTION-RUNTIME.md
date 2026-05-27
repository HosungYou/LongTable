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
- whether an optional Codex terminal popup is available in a tmux-attached
  runtime

## Contract

The shared contract is `QuestionPrompt -> QuestionAnswer -> QuestionRecord`.

At the product level, this lifecycle is described as:

```text
Researcher Checkpoint -> QuestionRecord -> DecisionRecord
```

`QuestionPrompt` is provider-neutral. It carries the checkpoint key, question text, prompt type (`single_choice`, `multi_choice`, or `free_text`), options, required/blocking posture, source, a short display reason, internal rationale, and preferred surfaces.

`QuestionAnswer` is normalized. Claude native choices, Codex numbered responses, MCP form arrays, and future web form selections should all become the same shape before they update LongTable state: `selectedValues` preserves all choices, `otherText` preserves researcher-supplied Other/free-text content, and the linked `DecisionRecord.selectedOption` remains a first-value compatibility field while `selectedOptions` carries the full selection.

`QuestionRecord` is durable lifecycle state. It exists so a required question is not inferred from prompt text alone. It may carry two optional inspection fields, `commitmentFamily` and `epistemicBasis`, when LongTable can state them without pretending to know more than it does.

Those fields are AI-engineering metadata, not a new always-on ontology layer:
they make logs easier to audit by showing what kind of commitment is being
settled and what kind of knowledge the prompt appears to rely on. If the basis
is not clear, the fields should stay absent. When a question is answered, the
same metadata is copied into the linked `DecisionRecord`.

LongTable may also keep a lightweight pending obligation record when the runtime
must remember that a research-facing checkpoint is still owed even before a
fresh QuestionRecord is answered. This is especially important for the
interview-to-First-Research-Shape handoff.

## Start And Interview Surfaces

`$longtable-start` is the research-start surface. It asks open natural-language
questions and creates or updates the Research Specification.

`$longtable-interview` is post-start. It can use option-first structured
questions only after a usable Research Specification exists. If no specification
exists, or if only a First Research Shape exists, `$longtable-interview` must
route to `$longtable-start`.

First Research Shape is a short handle and resume layer. It is not the
substantive endpoint.

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
  AskUserQuestion-compatible payload for choice questions. Free-text
  checkpoints are rendered as a text fallback rather than a fake choice list.

The terminal selector is available only when the process has interactive TTY
input and output. Tmux is not required for LongTable core behavior. A future
OMX-style Codex popup would be an optional transport that requires an attached
tmux session and must fall back to the same `QuestionRecord -> DecisionRecord`
path when unavailable.

## Provider Mapping

### Claude Code

Claude should prefer native structured questions when available.

Flow:

1. checkpoint engine resolves `blocking` and runtime guidance
2. Claude adapter converts choice checkpoints into `AskUserQuestion` input
3. Claude Code presents the native question surface, or LongTable uses the text fallback for free-text checkpoints
4. the selected answer is normalized into LongTable state

LongTable should not replace Claude Code's native question surface with a custom terminal UI when the native tool is available.

### Codex

Codex should use LongTable-owned MCP elicitation when that tool surface is
available and fall back to numbered checkpoints otherwise. Native Codex hooks
should be used for lifecycle timing, not for checkpoint semantics.

Flow:

1. checkpoint engine resolves `blocking` and runtime guidance
2. MCP transport requests Codex/client elicitation when `elicit_question` is available; the form asks for the decision only
3. Codex adapter renders numbered options with strict parsing as the fallback
4. invalid numbered answers re-prompt
5. the selected answer is normalized into LongTable state

Native hook support is the surrounding guard layer:

- `SessionStart` restores current research context
- `UserPromptSubmit` injects pending-checkpoint context
- `Stop` blocks silent closure only when a pending hard-stop blocker can change the Research Specification question, scope, construct map, method, evidence boundary, or protected decisions
- `PreCompact` / `PostCompact` preserve and restore compact, decision-relevant
  context around Codex compaction without creating new checkpoint semantics
- `PreToolUse` / `PostToolUse` review LongTable-relevant Bash side effects without blocking successful no-op or unrelated failed Bash commands

LongTable does not currently own Codex `PermissionRequest` hooks. Permission
policy remains a provider/runtime concern unless a future LongTable feature has
a concrete researcher-facing permission contract.

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
- store and confirm `$longtable-start` Research Specifications after the
  shorter First Research Shape layer
- preserve raw interview turns as evidence records
- propose, apply, diff, and read versioned Research Specification updates
- surface unincorporated interview/panel/critic/reviewer evidence that has not
  yet been folded into the current specification
- render provider-specific question transport
- append decision records
- regenerate `CURRENT.md`

MCP should not become the source of truth for checkpoint semantics. It should be
a transport and integration layer over `@longtable/core` and
`@longtable/checkpoints`. If elicitation is unavailable, the same pending
QuestionRecord must be rendered as a numbered fallback and answered with
`longtable decide`.

## Codex Stop hard-stop verdict

Codex `Stop` consumes the provider-neutral LongTable hard-stop verdict. A pending
question or obligation blocks closure only when it is explicitly marked
`hardStop` or is derived from old state as affecting the Research Specification
question, scope, construct map, method/analysis, evidence boundary, or protected
decisions. `required` alone is not enough. Product, setup, hook, docs, npm, git,
and release work should remain outside research-state checkpoint creation.

`PostToolUse` is deliberately narrower than `Stop`: successful no-op Bash returns
nothing, unrelated nonzero Bash is not a hard block, and LongTable research-state
mutation is denied only while an active hard-stop blocker exists.
