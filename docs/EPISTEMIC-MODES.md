# Epistemic Modes

## Purpose

이 문서는 LongTable가 언제 질문을 열어두고, 언제 결론을 허용하고, 언제 멈춤을 강제해야 하는지 정의한다.

핵심 목표는 premature closure를 막고, mode에 따라 다른 수준의 carefulness를 허용하는 것이다.

## Modes

### `explore`

목적:
- 문제를 열어두기
- tension과 ambiguity를 드러내기

기본 규칙:
- recommendation보다 questions를 우선
- action item보다 unresolved issue를 먼저 제시
- checkpoint는 `none` 또는 `log_only`

출력 기대:
- unasked questions
- open tensions
- possible framings

### `review`

목적:
- 현재 구조를 비판적으로 점검하기

기본 규칙:
- critique를 synthesis보다 우선
- “왜 이게 틀릴 수 있는가”를 반드시 포함
- checkpoint는 보통 `recommended`

출력 기대:
- weaknesses
- blind spots
- assumptions under strain

### `critique`

목적:
- 반론, 대안, 위험을 전면화하기

기본 규칙:
- agreement보다 challenge 우선
- conclusion을 닫기보다 instability를 드러냄
- confidence가 낮으면 명시적으로 말함

출력 기대:
- why this may be wrong
- what is missing
- what would change the conclusion

### `draft`

목적:
- 서술, 정리, 요약, 초안 형성

기본 규칙:
- structure 제공 가능
- 단, unresolved doubt를 지우면 안 됨
- checkpoint는 `log_only` 또는 `recommended`

출력 기대:
- clear structure
- authorial trace preservation
- flagged uncertainties

### `commit`

목적:
- 연구자가 실제로 결정을 내리는 순간

기본 규칙:
- blocking checkpoint 가능
- explicit decision log 필수
- open tensions 요약 제공

출력 기대:
- decision options
- stakes
- why this requires human commitment

### `submit`

목적:
- 외부 제출, 공유, 배포 직전

기본 규칙:
- strongest checkpoint level
- provenance and artifact review required
- unresolved issues remain visible

출력 기대:
- final review
- risk summary
- release/submission readiness

## Mode Policy

- `explore`에서는 closure를 늦춘다
- `review`와 `critique`에서는 disagreement를 정상화한다
- `draft`에서는 fluency보다 narrative trace를 보호한다
- `commit`과 `submit`에서만 strong closure를 허용한다

## Product Implication

지금 Codex/OMX가 보이는 문제는 대부분 mode confusion이다.

- explore인데 commit처럼 정리해버림
- critique인데 draft처럼 매끈하게 요약함
- uncertainty가 있는데 submit처럼 결론을 냄

따라서 LongTable는 모든 응답에서 먼저 mode를 인지하거나, 최소한 internal mode policy를 적용해야 한다.
