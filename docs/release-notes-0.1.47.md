# LongTable 0.1.47 Release Notes

## Summary

LongTable 0.1.47 adds lightweight audit metadata to the durable
`QuestionRecord -> DecisionRecord` lifecycle. The release keeps the existing
record names and avoids a new ontology wrapper, while making checkpoint logs
more inspectable for workflow reliability and reproducibility.

## Checkpoint Audit Metadata

- Adds optional `commitmentFamily` metadata to `QuestionRecord` and
  `DecisionRecord`.
- Adds optional `epistemicBasis` metadata to `QuestionRecord` and
  `DecisionRecord`.
- Copies present metadata from the answered `QuestionRecord` into the linked
  `DecisionRecord`.
- Keeps inference conservative: commitment family is primarily derived from the
  checkpoint key, and unclear metadata is omitted instead of guessed.

## MCP Surface

- Extends `create_question` and `elicit_question` to accept explicit
  `commitmentFamily` and `epistemicBasis` values.
- Keeps provider UI as transport only; the durable state remains the source of
  truth.

## Documentation

- Documents the metadata as AI engineering audit state, not a full ontology
  layer.
- Updates runtime boundary and researcher-checkpoint docs to preserve the
  Research Specification as the substantive ontology artifact.
- Refreshes MCP run snippets to `@longtable/mcp@0.1.47`.

## Verification

- `npm test`
- `npm run pack:check`

## Package Alignment

- Workspace packages are aligned on version `0.1.47`.
- Internal `@longtable/*` dependencies are pinned to `0.1.47`.
