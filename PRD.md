# LongTable Refactoring PRD

## Product Name

LongTable Refactoring: Researcher-Centered Harness

## Vision

LongTable는 많은 에이전트를 가진 연구 보조 도구가 아니라, 연구자의 판단을 보호하고 기록하고 확장하는 research harness가 되어야 한다.

## Problem

현재 LongTable는 강력한 아이디어를 갖고 있지만, 제품의 중심이 다음 두 축 사이에서 흔들린다.

1. `agent orchestration richness`
2. `researcher trust and methodological legitimacy`

현 상태의 핵심 문제는 다음과 같다.

- mode collapse를 막는 철학은 강하지만, 실제 UX는 에이전트와 체크포인트 중심으로 과도하게 무겁다.
- checkpoint가 연구자 맥락보다 agent prerequisite에 묶여 있어 기계적으로 작동한다.
- memory와 hook이 비용과 컨텍스트를 많이 소모할 수 있다.
- Claude Code 중심 구조가 강해 provider-neutral product로 확장하기 어렵다.
- 연구자에게 실제로 중요한 것은 agent catalog보다 state, decision log, unresolved question이다.

## Product Thesis

LongTable의 차별점은 "더 많은 자동화"가 아니라 다음 세 가지의 결합이어야 한다.

- `adaptive checkpointing`
- `researcher profile aware governance`
- `traceable research state`

## Target Users

### Primary

- 사회과학, 교육학, 심리학, HRD, 경영학 연구자
- 박사과정생, 초기 경력 연구자, 설계/측정 단계에서 흔들리는 연구자

### Secondary

- 지도교수와 연구 방법론 강의 담당자
- AI를 연구 설계에 사용하는 학제간 연구자

## Jobs To Be Done

- 내가 지금 연구의 어디에 있는지 빠르게 복원하고 싶다.
- 중요한 결정에서 AI가 밀어붙이지 못하게 하고 싶다.
- 이론, 방법론, 측정, 분석의 정합성을 유지하고 싶다.
- 내가 왜 이 결정을 했는지 나중에 설명할 수 있어야 한다.
- 문헌, 설계, 초안, 분석을 하나의 상태 시스템 안에서 추적하고 싶다.

## Design Principles

- `state-first, not agent-first`
- `commitment checkpoints, not interruption checkpoints`
- `small always-on context, large on-demand retrieval`
- `deterministic hooks, interpretive agents`
- `provider adapters, not provider lock-in`

## Non-Goals

- 모든 연구 판단의 자동화
- 모든 연구자에게 동일한 checkpoint 강제
- Claude/Codex 특정 플랫폼 UX를 제품 정의로 삼기
- 초기 단계에서 완전한 웹 앱 구축

## Key Capabilities

### 1. Researcher Profile

- quick setup + progressive calibration
- novice / intermediate / advanced
- novelty vs defensibility preference
- checkpoint tolerance and governance preference

### 2. Adaptive Checkpoint Engine

- universal checkpoints
- adaptive checkpoints
- task mode awareness: explore / review / critique / draft / commit / submit

### 3. Memory Model

- explicit state
- inferred hypotheses
- open tensions
- decision log
- artifact provenance

### 4. Provider Strategy

- Claude adapter
- Codex adapter
- future web app adapter

## Product Modes

- `Explore`: 자유 탐색, checkpoint 최소화
- `Review`: 비판, 비교, 팀 리뷰
- `Draft`: 초안 생성, provenance 기록 중심
- `Commit`: 연구적 커밋 발생, checkpoint 강화
- `Submit`: 외부화 직전, strongest governance

## Initial Deliverables

### Phase 1

- refactoring architecture docs complete
- provider-neutral core schema 정의
- checkpoint taxonomy 재정의
- memory schema 재정의
- Claude/Codex adapter 경계 정의

### Phase 2

- Codex-compatible harness implementation
- Codex-compatible orchestration integration
- numbered checkpoint interaction spec

### Phase 3

- lightweight researcher-facing UI or web app
- profile editor
- checkpoint dashboard
- decision timeline

## Success Metrics

- 세션 시작 컨텍스트 로드 비용 감소
- REQUIRED checkpoint 수 감소와 의미 명확성 증가
- 연구자 onboarding 완료율
- checkpoint 수용률과 override 필요성 감소
- state restoration 성공률
- 사용자 보고 신뢰도 상승

## Immediate Product Decision

웹 앱은 장기적으로 유의미하지만, 현재 1차 목표는 아니다.  
우선순위는 `provider-neutral harness core + Codex/Claude adapters`이며, Codex 쪽은 기존 Codex-native orchestration patterns를 참고하되 LongTable 고유의 researcher-centered logic를 중심에 둔다.
