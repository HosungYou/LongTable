# Decision Log Schema

## Purpose

Decision log is the historical memory of why the research moved in a certain direction.

## Minimum Record

```yaml
decision:
  id: DEC-2026-04-15-001
  timestamp: 2026-04-15T17:10:00Z
  mode: commit
  checkpoint_id: theory_anchor_selection
  selected_option: 1
  selected_label: dialogic pedagogy + epistemic agency
  rationale: "Best fit for BJET methodological framing"
  actor: user
  source: checkpoint
```

## Fields

- `checkpoint_id`
- `mode`
- `selected_option`
- `selected_label`
- `rationale`
- `actor`
- `source`

## Extensions

- evidence references
- linked artifacts
- supersedes previous decision id

## Rule

If a checkpoint changes explicit state, it must create a decision log entry.
