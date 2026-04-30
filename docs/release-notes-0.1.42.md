# LongTable 0.1.42 Release Notes

## Summary

LongTable 0.1.42 refines `$longtable-interview` so the project-start interview
stays quiet, detailed, and researcher-paced while still producing durable
First Research Shape state.

## Interview Runtime Changes

- `$longtable-interview` no longer treats a fixed number of usable turns as
  enough to summarize. Interview readiness is now content-based and requires an
  explicit `readyToSummarize` signal on a non-thin turn.
- `append_interview_turn` records optional `readyToSummarize` and
  `readinessRationale` fields so the transition into First Research Shape
  confirmation is inspectable in `.longtable/state.json`.
- Active interview context is no longer repeated on ordinary `UserPromptSubmit`
  turns. It appears for explicit `$longtable-interview` invocations and
  research-state closure prompts.
- Pending checkpoints from other threads no longer interrupt the active
  interview. They are surfaced as separate unresolved items and become blocking
  only when the researcher is confirming, saving, or recording a research
  decision.
- Added MCP `cancel_interview` for explicit researcher cancellation without
  pretending the interview produced a confirmed First Research Shape.

## Confirmation UX

- First Research Shape confirmation now follows the researcher's language when a
  Korean shape is detected, including options such as `저장/확정`, `한 질문 더`,
  `수정`, and `열어두기`.
- Provider skills now document one-question-at-a-time as a soft interview norm:
  each follow-up should focus on one main uncertainty without becoming a
  mini-questionnaire.

## Packaging

- Workspace packages are aligned on version `0.1.42`.
- MCP install snippets point to `@longtable/mcp@0.1.42`.

## Verification

- `npm run release:check`
- MCP self-test includes `cancel_interview`
- Codex skills reinstall includes the updated `$longtable-interview` guidance
