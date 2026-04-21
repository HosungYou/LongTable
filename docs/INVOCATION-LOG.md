# Invocation Log

## Decision

LongTable records role and panel invocations in `.longtable/state.json`.

This is the next step after provider-native skill installation. Skills make
LongTable easier to call, but invocation records make those calls inspectable
after the session.

## What Gets Recorded

The implemented path is panel planning:

```bash
longtable panel --prompt "Review this methods section." --json
```

When this command runs inside a LongTable project workspace, LongTable appends an
`InvocationRecord` to:

```text
.longtable/state.json
```

The invocation record includes:

- `InvocationIntent`: what the user asked for
- `PanelPlan`: which roles were selected and why
- `PanelResult`: current planned panel result
- provider and execution surface
- degradation/fallback reason when native team execution is not used

Panel planning also creates a pending `QuestionRecord` asking what human decision
should follow the panel review. The `PanelResult` links to that question through
`linkedQuestionRecordIds`.

`CURRENT.md` is regenerated after the append and shows:

- recent LongTable invocations
- pending decision questions
- the `longtable decide` command needed to answer them

## Recording A Decision

Answer a pending decision question with:

```bash
longtable decide --question <question-id> --answer evidence --rationale "Need citation support before continuing."
```

If `--question` is omitted, LongTable answers the most recent pending question.

The answer does three things:

1. marks the `QuestionRecord` as `answered`
2. appends a `DecisionRecord` to `decisionLog`
3. links the decision back to the panel `InvocationRecord` through
   `PanelResult.linkedDecisionRecordIds`

## Why This Matters

This closes the gap between a natural-language skill trigger and durable project
memory.

Without invocation records, a panel call only exists in the conversation. With
invocation records, the project can later answer:

- Which roles were consulted?
- Was this a native team execution or sequential fallback?
- What decision or checkpoint should this invocation connect to?
- Did a later claim depend on a previous panel result?

## Current Scope

Implemented:

- panel invocation logging
- `CURRENT.md` recent invocation summary
- pending panel follow-up `QuestionRecord`
- `longtable decide` for answering pending questions
- `QuestionRecord -> DecisionRecord -> InvocationRecord` linking
- backward-compatible state loading for older `.longtable/state.json` files

Not yet implemented:

- logging every natural-language skill activation
- storing native provider subagent transcripts

The next expansion should apply the same lifecycle to every natural-language
skill activation, not only explicit panel planning.
