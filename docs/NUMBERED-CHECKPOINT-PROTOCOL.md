# Numbered Checkpoint Protocol

## Purpose

Codex-like environments may not provide a native structured question widget. LongTable therefore needs a provider-neutral blocking checkpoint interaction.

This is the Codex-compatible transport for LongTable's **Researcher Checkpoint**
concept.

This is a fallback and compatibility contract, not a reason to avoid native structured question tools in providers that support them.

## Baseline Contract

```text
CHECKPOINT: Methodology Commitment

1. Quantitative quasi-experimental design
2. Qualitative multiple-case study
3. Mixed methods sequential explanatory design

Reply with one number only: 1, 2, or 3.
```

The baseline protocol is single-choice. When `QuestionPrompt.type` is
`multi_choice`, the fallback asks for one or more numbers separated by commas
and normalizes every selected option into `selectedValues` and
`DecisionRecord.selectedOptions`. When the type is `free_text`, the fallback
does not render a numbered choice list; it asks for a concise free-text answer
and preserves that text in `selectedValues` and `otherText`.

The legacy `DecisionRecord.selectedOption` field remains a first selected value
for compatibility. New consumers should read `selectedOptions` when cardinality
matters.

## Rules

- required checkpoints must not accept free-form confirmation
- only a parseable answer is accepted
- invalid answer triggers re-prompt
- accepted answer is logged with timestamp and rationale if provided
- no silent default for blocking checkpoints
- `longtable decide --answer <value>` must accept both the visible number and
  the stable option value, because the numbered prompt is the researcher-facing
  contract in Codex-compatible runtimes

## Optional Extension

For advanced users:

```text
Reply with:
- one number only, or
- one number plus a short rationale on the next line
```

## Why This Matters

It creates a single checkpoint contract that can work in Claude, Codex, and future web interfaces.

Claude can present the same Researcher Checkpoint through `AskUserQuestion`;
Codex can present it through numbered text and strict parsing. Both paths must
normalize to the same decision record, so a researcher choosing `1` must not be
recorded as an opaque `other` answer.
