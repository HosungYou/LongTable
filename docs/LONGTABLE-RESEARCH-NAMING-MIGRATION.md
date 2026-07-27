# LongTable Research Naming Migration

Status: adopted for `0.2.0-beta.1`.

## Problem

`scholar-research` is understandable but grammatically awkward: a scholar is a
person, while `scholarly research` is the established adjective phrase. The
name also makes the durable end-to-end pipeline sound like a search helper even
though it covers topic and venue discovery, evidence acquisition, extraction,
synthesis, visuals, verification, and handoff.

## Recommendation

Use **Research** as the public command concept:

```text
longtable research run
longtable research resume
longtable research evaluate
```

Use **LongTable Research** as the reader-facing capability label. Let
`$longtable` route ordinary conversation and expose `$longtable-research` only
when an explicit skill invocation is useful.

Use `@longtable/research` as the canonical package.

## Why This Split

- `research` is universal, short, and accurately describes the CLI workflow.
- the `longtable` namespace prevents collision with generic shell commands.
- `LongTable Research` covers discovery through verified production.
- `scholarly-research` remains available where academic specificity matters.
- the public name does not expose the implementation's internal role catalog.

## Rejected Primary Names

- `scholar-research`: grammatically awkward.
- `academic-research`: familiar but narrower than institutional and
  practitioner evidence.
- `research-evidence`: sounds like an output rather than a workflow.
- `evidence-lab`: memorable but product-like and less self-explanatory.
- `research-studio` or `research-workbench`: broad, but weak on evidence
  discipline and easily confused with the whole LongTable product.

## Compatibility Migration

The beta implements:

1. add `longtable research` as canonical;
2. keep `longtable scholar-research` as a one-release deprecation alias;
3. generate Codex and Claude skill surfaces from one canonical spec;
4. install only `$longtable-research`; accept `$scholar-research` language as a
   one-release compatibility route without leaving a third installed skill;
5. migrate docs and telemetry labels without rewriting historical run records;
6. preserve `schema`, bundle versions, and existing run paths;
7. remove aliases only after doctor reports no active old surfaces.

No rename should silently rewrite `.longtable/research-runs/` history.
