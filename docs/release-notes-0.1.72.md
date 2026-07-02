# LongTable 0.1.72

LongTable 0.1.72 makes `longtable-reviewer` the compact evidence-backed
journal review surface. The reviewer role now carries peer-review objections,
Journal Editor fit judgment, Venue Strategist tradeoffs, and scholar-research
evidence workflow without adding a separate visible editor skill to the compact
surface.

## Changes

- Expands the Reviewer role to cover journal-grounded fit risks and missing
  evidence, not only peer-review objections.
- Adds a Journal-grounded reviewer workflow to generated Codex and Claude
  `longtable-reviewer` skills.
- Adds the same workflow to `longtable review --role reviewer --print` and the
  legacy `longtable-reviewer` prompt alias.
- Requires reviewer feedback to use a `Journal Profile` and, when reference
  papers are available or recoverable, a `Reference Pattern Matrix`.
- Documents checks for decision structure, paper flow, standardized
  terminology, Figure/Table conventions, and APA 7 style expectations.

## Migration

Use `longtable-reviewer` or `longtable review --role reviewer` for journal-fit,
editor-style, and peer-review feedback. `--role editor` remains available as an
explicit role lens, but the compact reviewer surface now owns the evidence-backed
journal review workflow.

## Verification

- `npm run smoke:role-audit`
- `npm run release:check`
