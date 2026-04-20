# Checkpointing

## Central Principle

Checkpoint는 "중요한 순간"이 아니라 "연구적 책임이 넘어가는 순간"에만 강해야 한다.

## Taxonomy

### Universal Required

- ethics or consent commitment
- final measurement commitment
- final analysis plan commitment
- external submission or preregistration

### Adaptive Required

- research question freeze
- theory anchor selection
- methodology selection
- scope reduction

### Recommended

- alternative comparison
- review conclusions
- humanization review
- journal prioritization

### Log Only

- draft generation
- review team output
- exploratory branching

## Inputs

- researcher profile
- task mode
- artifact stakes
- current stage

## Output Example

```yaml
checkpoint_decision:
  id: theory_anchor_selection
  level: adaptive_required
  reason: "novice profile + commit mode + theory affects downstream design"
```

## Codex Note

Codex checkpoints must work without native structured question UI. Numbered choice plus strict parsing is the baseline interaction contract.
