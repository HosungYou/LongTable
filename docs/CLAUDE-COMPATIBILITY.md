# Claude Compatibility

## Goal

기존 Claude-first LongTable 흐름을 새 contract에 맞춰 재해석하기 위한 호환성 문서다.

## Mapping

- structured question flow -> adapter presentation concern through native `AskUserQuestion` when available
- existing hook surface -> deterministic governance layer
- existing agent taxonomy -> optional orchestration layer
- epistemic modes -> structured guidance sections
- question policy -> mandatory questions + minimum-question threshold
- narrative trace preservation -> explicit runtime instruction, not implicit style hope

## Guardrail

Claude-specific affordance가 core contract로 새어 나오지 않게 유지한다.

Claude Code의 native question tool은 버리지 않는다. LongTable core는 checkpoint activation과 decision semantics를 소유하고, Claude adapter는 그 결과를 native structured question input으로 변환한다.
