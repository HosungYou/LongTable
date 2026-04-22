# Checkpoint Triggering

## Purpose

Researcher Checkpoints must be triggered by research context, not by a fixed
command list. A researcher should be able to write naturally, and LongTable
should detect when the request is moving from exploration into commitment.

The implementation contract is:

```text
natural language request
  -> checkpoint trigger classifier
  -> CheckpointSignal
  -> checkpoint policy
  -> runtime guidance
  -> QuestionRecord when a decision is required
```

## Current Implementation

The first trigger classifier lives in `@longtable/checkpoints`:

- `classifyCheckpointTrigger(prompt, options)`
- returns a provider-neutral `CheckpointTriggerClassification`
- carries a `CheckpointSignal`
- labels whether a question is required before closure
- records matched cues and rationale for auditability

The Codex thin wrapper now uses the classifier before generating runtime
guidance. This means prompt cues such as submission, method design, measurement,
evidence verification, named knowledge gaps, tacit assumptions, or LongTable
product-language changes can strengthen the checkpoint even when the user does
not use an explicit `lt commit:` command.

`longtable question` uses the same classifier to write a durable
`QuestionRecord`. When that record is required, normal CLI progression is
blocked until `longtable decide` records the answer.

Provider adapters render the same `QuestionRecord` through their own transport:

- Codex renders a numbered prompt with `other` visible when allowed.
- Claude renders a structured question payload that can be passed to a native
  structured question surface when available.
- MCP exposes `evaluate_checkpoint`, `create_question`, `elicit_question`, and
  `render_question` so provider runtimes can use the same checkpoint classifier
  and durable question records without scraping `CURRENT.md`.

## Trigger Families

LongTable currently recognizes these trigger families:

- `exploration`: problem framing, narrowing, brainstorming
- `review`: critique, audit, objection finding, tacit assumption probing
- `commitment`: research question, theory, method, measurement, or analysis decisions
- `submission`: journal, public release, preregistration, IRB, external sharing
- `meta_decision`: LongTable naming, README positioning, checkpoint policy, provider behavior
- `evidence`: citation, reference, source, hallucination, claim support
- `authorship`: researcher voice, narrative trace, authorship preservation
- knowledge gaps are represented as exploration checkpoints because they should
  interrupt premature narrowing before they become commitments
- `advisory`: low-confidence or low-stakes guidance

## Blocking Meaning

The classifier does not directly block execution. It produces a `CheckpointSignal`.
The checkpoint policy decides whether the signal is blocking after profile,
artifact stakes, study contract, and unresolved tensions are considered.

This separation matters:

- natural-language detection is probabilistic
- checkpoint policy is deterministic
- provider rendering is transport-specific
- `.longtable/` state remains the source of truth

## Quality Bar

A trigger is not acceptable unless it can explain:

- which cue activated it
- which checkpoint key it selected
- whether it is required before closure or advisory only
- which research risk it protects
- how the answer will become a `DecisionRecord`

If LongTable cannot explain those points, it should ask a lightweight
clarifying question or keep the action advisory instead of pretending the
decision is settled.
