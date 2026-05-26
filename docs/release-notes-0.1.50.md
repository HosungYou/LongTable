# LongTable 0.1.50 Release Notes

## Summary

LongTable 0.1.50 extends Researcher Checkpoint rendering so the durable
`QuestionRecord -> DecisionRecord` contract supports single choice, multi
choice, researcher-supplied Other text, and free-text checkpoints without
making provider-specific UI the product contract.

## Question Contract

- Adds `DecisionRecord.selectedOptions` so multi-choice checkpoint answers keep
  every selected value while the legacy `selectedOption` field remains the
  first selected value for compatibility.
- Extends `createWorkspaceQuestion` and `answerWorkspaceQuestion` to normalize
  `single_choice`, `multi_choice`, and `free_text` answers through one state
  path.
- Preserves researcher-supplied Other/free-text content as auditable
  `selectedValues` and `otherText`.
- Rejects structured `otherText` unless the answer explicitly selects the Other
  sentinel, preventing accidental extra decisions from loose form fields.

## Provider Rendering

- Codex numbered fallback now supports comma-separated multi-choice answers and
  a no-option free-text prompt.
- Codex provider rendering maps `QuestionPrompt.type` to the numbered fallback
  selection mode.
- Claude provider rendering uses AskUserQuestion-compatible choice payloads for
  single and multi-choice checkpoints, including `multiSelect` for
  multi-choice.
- Claude free-text checkpoints no longer emit a fake choice list; they return a
  text fallback with `nativeStructured: false`.

## MCP Surface

- `create_question` and `elicit_question` accept explicit `type`, `allowOther`,
  and `otherLabel` inputs.
- MCP elicitation schemas render multi-choice answers as arrays and free-text
  answers as plain strings.
- MCP no longer sets a default first option in the elicitation schema, so
  required checkpoints avoid silent default selection.
- `append_decision` accepts string, string array, or structured answer payloads
  with optional rationale and Other text.

## Documentation

- Updates Researcher Checkpoint docs to describe prompt type, multi-choice
  answer storage, and Other/free-text audit behavior.
- Updates Question Runtime and Numbered Checkpoint Protocol docs to keep
  provider-native UI as transport, not core product semantics.
- Refreshes MCP run snippets to `@longtable/mcp@0.1.50`.

## Verification

- `npm test`
- `npm run release:check`
- `git diff --check`
- Read-only architecture review returned `SHIP` after the Claude free-text and
  Other-text contract gaps were fixed.

## Package Alignment

- Workspace packages are aligned on version `0.1.50`.
- Internal `@longtable/*` dependencies are pinned to `0.1.50`.
