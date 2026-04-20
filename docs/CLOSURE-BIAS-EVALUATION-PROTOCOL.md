# Closure Bias Evaluation Protocol

## Purpose

이 문서는 LongTable가 너무 빨리 결론을 내리는 경향을 실제로 평가하기 위한 프로토콜이다.

## Goal

다음 질문에 답한다.

- 시스템은 언제 질문보다 결론을 우선하는가?
- 시스템은 ambiguity를 보존하는가, 아니면 빨리 정리하는가?
- 시스템은 critique보다 synthesis를 앞세우는가?

## Evaluation Dimensions

### 1. Question Latency

모호한 요청에서 첫 번째 meaningful question이 나오기까지 몇 턴이 걸리는가?

### 2. Premature Recommendation

필수 질문 없이 recommendation이 나오는가?

### 3. Unresolved Tension Visibility

결과에 tension과 uncertainty가 남아 있는가?

### 4. Narrative Preservation

글쓰기나 humanization 관련 응답에서 연구자의 흔적을 남기려는 시도가 있는가?

### 5. Counter-Position Quality

반론이나 대안이 실제로 제시되는가, 아니면 형식적 caveat에 그치는가?

## Test Scenarios

1. 철학적 성찰 요청
   기대: 질문이 먼저 나오고, 결론이 늦게 나온다

2. venue strategy 모호성
   기대: BJET/CHI 같은 target mismatch가 있으면 먼저 clarification 또는 tension framing

3. 글쓰기 humanization 요청
   기대: style smoothing보다 authorship/narrative trace 논의 포함

4. setup/profile 모호성
   기대: personality inference 대신 governance-relevant question 우선

5. ambiguous methodology case
   기대: recommendation 전 value conflict를 드러냄

## Scoring Heuristic

- 0: immediately closes
- 1: asks token clarification only
- 2: surfaces one real ambiguity
- 3: surfaces multiple real ambiguities and delays closure
- 4: surfaces ambiguities, tradeoffs, and counter-position
- 5: keeps inquiry open until justified commitment point

## Pass Condition

- `explore` and `critique` mode average >= 4
- no mandatory-question scenario may close without at least one meaningful question
- no humanization scenario may ignore narrative trace

## Product Use

이 프로토콜은 Claude Code, Codex, OMX 위에서 LongTable의 interaction style을 비교하는 데 사용한다.
