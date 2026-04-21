# Checkpointing

## Central Principle

Checkpoint는 "중요한 순간"이 아니라 "연구적 책임이 넘어가는 순간"에만 강해야 한다.

LongTable의 제품 언어로 이 장치는 **Researcher Checkpoint**다.
Provider-native AskUserQuestion-style UI는 가능한 표시 방식 중 하나일 뿐이며,
핵심은 질문, 선택지, 답변, 결정 기록이 함께 남는 것이다.

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

## Interaction Contract

Researcher Checkpoint는 아래 순서를 지켜야 한다.

1. commitment risk를 감지한다.
2. reason과 stakes를 짧게 설명한다.
3. 하나의 focused question을 낸다.
4. 의미 있는 선택지를 제시한다.
5. 답변 전에는 closure/recommendation을 확정하지 않는다.
6. 답변을 `DecisionRecord`로 남긴다.
7. `CURRENT.md`를 재생성해 pending/answered 상태를 노출한다.

## Codex Note

Codex checkpoints must work without native structured question UI. Numbered choice plus strict parsing is the baseline interaction contract.

## Claude Note

Claude Code can use native structured question surfaces when available. That
should improve the interaction, but it must not become the semantic source of
truth. The shared LongTable record model remains authoritative.
