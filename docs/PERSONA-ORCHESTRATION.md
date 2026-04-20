# Persona Orchestration

## Decision

`role trigger taxonomy`, `routing policy`, `response disclosure`, `language policy`는 각각 별도 문서로 쪼개지 않는다.

이 네 항목은 모두 `persona orchestration`의 한 메커니즘이므로, **하나의 활성 설계 문서**로 유지한다.

## Why

별도 문서 4개로 나누면 지금 저장소의 문제를 더 키운다.

- 문서 수가 이미 과도하다
- 개념은 분리돼도 구현은 한 지점에서 연결된다
- role routing과 disclosure, language policy는 함께 바뀐다

따라서 LongTable에서는 아래 네 항목을 하나의 계약으로 다룬다.

1. canonical role taxonomy
2. natural-language routing
3. response disclosure
4. bilingual language policy
5. panel invocation and inspectable disagreement

## Canonical roles

내부 key는 영어로 유지한다.

- `editor`
- `reviewer`
- `theory_critic`
- `methods_critic`
- `measurement_auditor`
- `ethics_reviewer`
- `voice_keeper`
- `venue_strategist`

이 key는:

- code
- schema
- logs
- runtime artifacts

에서 canonical source가 된다.

## Synonym map

사용자 입력은 영어와 한국어 둘 다 지원한다.

예시:

- `editor`
  - `editor`
  - `journal editor`
  - `편집자`
  - `저널 편집자`
- `reviewer`
  - `reviewer`
  - `peer reviewer`
  - `리뷰어`
  - `심사자`
- `methods_critic`
  - `method`
  - `methodology`
  - `research design`
  - `방법론`
  - `연구 설계`
- `measurement_auditor`
  - `measurement`
  - `scale`
  - `validity`
  - `reliability`
  - `측정`
  - `척도`
  - `타당도`
  - `신뢰도`

## Routing policy

### 1. explicit natural language

사용자가 자연어로 특정 관점을 요구하면 그 role은 명시적으로 호출된 것으로 본다.

예:

- `BJET 편집자 관점으로 봐줘`
- `리뷰어처럼 약점을 말해줘`
- `방법론적으로 까다롭게 검토해줘`

### 2. implicit auto-call

사용자가 특정 역할명을 말하지 않아도, 의미적으로 강하게 연결된 표현이 있으면 auto-call 가능하다.

예:

- 저널 적합성 -> `editor`
- 척도 타당도 -> `measurement_auditor`
- IRB, 윤리 -> `ethics_reviewer`

단, auto-call은 다음 조건을 따른다.

- 기본 synthesis를 대체하지 않는다
- 어떤 role이 호출됐는지 짧게 공개한다
- 한 번에 너무 많은 role을 부르지 않는다

### 3. ambiguous case confirmation

애매한 경우는 닫지 말고 확인 질문을 우선한다.

예:

- 사용자가 `검토해줘`라고만 했을 때
- `편집자 관점`인지 `리뷰어 관점`인지 불분명할 때

이 경우 LongTable은 먼저 짧게 확인한다.

## Response disclosure

role이 하나라도 호출되면, 응답 초반에 짧게 공개한다.

예:

- `LongTable consulted: Journal Editor, Methods Critic`

이 disclosure는:

- hidden routing을 줄이고
- researcher trust를 높이며
- 합성 결과가 어디서 왔는지 보이게 한다

## Output model

기본값은 `LongTable synthesis`다.

선택적으로 아래를 추가할 수 있다.

- `panel opinions`
- `conflict summary`
- `deliberation trace`
- `decision prompt`

즉 LongTable은:

- 하나의 책임 있는 인터페이스를 유지하면서
- 필요할 때만 구조화된 disagreement를 보여준다

## Panel orchestration

Panel orchestration is the multi-role version of persona orchestration.

It is not the same as a persistent agent team. LongTable does not need worker mailboxes, task claims, heartbeats, or tmux panes to support useful panel review.

The panel coordinator should:

1. select roles from the canonical role registry
2. build a `PanelPlan`
3. collect role outputs through the strongest available provider surface
4. fall back to sequential role passes when native parallel agents are unavailable
5. synthesize the result without hiding disagreement
6. record enough structured data for technical inspection

Panel discussion is inspectable through records such as:

- selected role
- role prompt or role contract version
- role output summary
- claims, objections, or open questions raised by that role
- disagreement with other roles
- synthesis decision
- provider surface used
- fallback/native execution mode

Panel discussion must not expose raw hidden reasoning, private tool traces, or provider chain-of-thought. The inspectable artifact is a structured deliberation record, not an internal transcript.

## Language policy

- input: bilingual
- internal keys: English
- output: user language follow

즉 한국어로 말해도 routing이 가능해야 하고, 내부 구현은 영어 key로 일관되게 유지해야 한다.

## Current implementation boundary

현재 `packages/longtable`에는 첫 구현이 들어가 있다.

- canonical role definitions
- Korean/English synonym map
- explicit + implicit routing
- ambiguous review signal
- disclosure insertion
- panel/conflict/deliberation prompt shaping

하지만 아직 이것은 **real multi-agent panel runtime**이 아니다.

지금은 Codex wrapper prompt를 shaping하는 1차 구현이다.

다음 구현 범위는 provider-neutral panel contract와 sequential fallback이다. 그 다음에 Claude generated skills, Codex native subagent usage, MCP transport를 붙인다.

LongTable should grow toward panel orchestration, not general team orchestration.
