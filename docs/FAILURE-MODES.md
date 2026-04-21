# Failure Modes

## Purpose

이 문서는 LongTable가 실패하는 전형적 방식을 미리 이름 붙이기 위한 것이다.

## Core Failure Modes

### 1. Over-Automation

시스템이 질문을 던지기보다 너무 빨리 구조화하고 결론을 낸다.

징후:
- 질문보다 계획이 먼저 나온다
- ambiguity가 exploration 없이 resolution로 치환된다
- 연구자가 생각할 시간을 잃는다

### 2. False Inference

시스템이 암묵지를 너무 자신 있게 해석한다.

징후:
- 사용자가 말하지 않은 선호를 사실처럼 취급
- narrative cue를 personality model처럼 고정
- setup/profile이 과도하게 확정적이 됨

### 3. Narrative Flattening

결과는 매끄럽지만 연구자의 서사와 흔적이 지워진다.

징후:
- 글이 generic fluent하지만 authorial trace가 약함
- 개인적 경험과 판단 경로가 사라짐
- humanization이 style smoothing으로만 작동

### 4. Checkpoint Paternalism

checkpoint가 보호 장치가 아니라 훈육 장치처럼 작동한다.

징후:
- 너무 자주 멈춘다
- explain 없이 block만 한다
- 숙련도와 맥락 차이를 반영하지 못한다

### 5. Decision Laundering

실질적으로는 AI가 방향을 정했는데, 형식상 인간 승인만 붙는다.

징후:
- 선택지가 이미 한 방향으로 강하게 편향됨
- 인간은 approve button 역할만 수행
- decision log는 남지만 real agency는 없음

Researcher Checkpoint가 이름만 있고 선택지가 약하면 이 실패 모드가 강화된다.
질문 UI가 있다는 사실보다, 옵션이 실제 연구 판단을 보존하는지가 더 중요하다.

### 6. Tool Mystification

연구자가 시스템을 이해하지 못한 채 결과만 소비한다.

징후:
- Claude/Codex/OMX/plugin 차이를 사용자가 모름
- tool capability와 limit가 설명되지 않음
- trust가 transparency가 아니라 aura에서 생김

### 7. Premature Closure

시스템이 의문점이 남아 있어도 “충분하다”고 판단하고 닫아버린다.

징후:
- 필요한 질문을 묻지 않음
- unresolved issue를 action item으로만 덮음
- critique보다 synthesis가 항상 우선됨

## Mitigations

- recommendation 전에 unresolved questions를 최소 2개 제시
- important mode에서 “why not” 반론을 강제
- inferred hypothesis는 confirmation 전 explicit state로 승격 금지
- checkpoint에서 block 이유와 stakes를 함께 제시
- Researcher Checkpoint는 하나의 focused question과 의미 있는 선택지를 가져야 함
- researcher-facing recap 문서를 자동 생성
- humanization success criteria에 narrative trace 보존 포함
