# Plugin Strength Evaluation

## Purpose

이 문서는 Claude Code, Codex, OMX 위에서 LongTable가 얼마나 강하게 실행될 수 있는지 비교하기 위한 평가 문서다.

## Evaluation Axes

### 1. Implicit Activation

명시적으로 부르지 않아도 문맥상 자연스럽게 작동하는가?

### 2. Checkpoint Enforcement

중요한 멈춤을 실제로 강제할 수 있는가?

### 3. Memory Continuity

세션 간 researcher profile, decisions, tensions를 안정적으로 유지하는가?

### 4. Question Quality

모호함이 클 때 질문으로 열어두는가, 아니면 빨리 닫아버리는가?

### 5. Narrative Preservation

연구자의 흔적과 서사를 보존하는 방향으로 지원하는가?

### 6. Platform Intimacy

플랫폼 자체와 얼마나 깊게 결합돼 있는가?

## Current Assessment

### Claude Code Plugin

강점:
- native structured interaction이 가능함
- plugin/skill 문맥이 깊게 스며듦
- 문맥상 implicit activation이 더 자연스럽다

약점:
- 비용이 큼
- 연구자에게 기술적 진입장벽이 있음
- Claude 환경에 종속되기 쉬움

### Codex Native

강점:
- 실행과 구현 속도
- provider-neutral contract를 직접 설계하기 좋음

약점:
- closure bias가 강함
- 질문보다 action으로 기울기 쉬움
- platform-native structured intimacy가 상대적으로 약함

### OMX

강점:
- orchestration, state, logs, skills가 강력함
- multi-agent/team/handoff를 풍부하게 다룰 수 있음
- 연구용 harness 계층을 올리기에 유연함

약점:
- 강력하지만 researcher에게는 투명하지 않을 수 있음
- implicit activation은 있지만 Claude plugin 같은 native intimacy는 아님
- execution completion bias가 연구 성찰을 압도할 위험이 있음

## Current Judgment

- Claude Code는 가장 deeply integrated한 실행을 제공한다
- Codex는 가장 execution-oriented하다
- OMX는 가장 orchestration-capable하지만, 그 힘이 researcher-friendly trust로 자동 전환되지는 않는다

## Key Risk

강한 실행력이 곧 좋은 연구 하네스가 되는 것은 아니다.

오히려 다음이 필요하다.

- strong execution
- strong stopping
- strong questioning
- strong narrative preservation

이 네 가지가 함께 있어야 한다.

## Product Implication

LongTable의 차별점은 “얼마나 강하게 실행되는가”가 아니라, “얼마나 신중하게 실행을 제어하는가”가 되어야 한다.
