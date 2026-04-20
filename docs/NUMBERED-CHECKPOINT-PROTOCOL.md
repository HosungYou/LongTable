# Numbered Checkpoint Protocol

## Purpose

Codex-like environments may not provide a native structured question widget. LongTable therefore needs a provider-neutral blocking checkpoint interaction.

This is a fallback and compatibility contract, not a reason to avoid native structured question tools in providers that support them.

## Baseline Contract

```text
CHECKPOINT: Methodology Commitment

1. Quantitative quasi-experimental design
2. Qualitative multiple-case study
3. Mixed methods sequential explanatory design

Reply with one number only: 1, 2, or 3.
```

## Rules

- required checkpoints must not accept free-form confirmation
- only a parseable answer is accepted
- invalid answer triggers re-prompt
- accepted answer is logged with timestamp and rationale if provided
- no silent default for blocking checkpoints

## Optional Extension

For advanced users:

```text
Reply with:
- one number only, or
- one number plus a short rationale on the next line
```

## Why This Matters

It creates a single checkpoint contract that can work in Claude, Codex, and future web interfaces.

Claude can present the same contract through `AskUserQuestion`; Codex can present it through numbered text and strict parsing. Both paths must normalize to the same decision record.
