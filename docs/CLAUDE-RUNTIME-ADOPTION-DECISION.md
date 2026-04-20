# Claude Runtime Adoption Decision

## Question

Claude production runtime이 LongTable-managed runtime bridge를 실제 행동 규칙으로 소비해야 하는가, 아니면 setup/dashboard 수준의 read-only bridge로 남겨야 하는가?

## Short Answer

지금 당장은 `full adoption`으로 가면 안 된다.

권고안은 다음과 같다.

1. `read-only bridge`를 유지한다.
2. 그 위에 `opt-in advisory adoption`을 추가한다.
3. 계약 안정화와 비교 평가가 끝난 뒤에만 `selective runtime consumption`으로 확장한다.

즉 지금의 정답은 `not yet, but not never`다.

## Why This Matters

Claude runtime은 현재 LongTable의 가장 깊은 production surface다.

여기서 managed artifact를 너무 빨리 직접 소비하면 아래 위험이 커진다.

- legacy Claude behavior가 조용히 바뀜
- checkpoint semantics가 migration artifact에 종속됨
- runtime source of truth가 다시 provider 쪽으로 새어 나감
- refactoring repo에서 의도한 researcher-centered governance가 충분히 검증되기 전에 productionized 됨

반대로 끝까지 read-only로만 두면, refactoring에서 만든 question policy, epistemic mode, narrative trace 철학이 실제 사용자 행동으로 내려오지 못한다.

따라서 중간 단계가 필요하다.

## Options

### Option A. Read-Only Only

설명:
- setup가 managed artifact를 감지한다
- dashboard가 bridge 상태를 보여준다
- runtime behavior는 바뀌지 않는다

장점:
- 가장 안전하다
- production regression 가능성이 낮다
- migration 설명이 단순하다

단점:
- 실제 behavior change가 없다
- question policy와 narrative trace가 display metadata로 축소된다
- refactoring 가치가 runtime에 반영되지 않는다

판단:
- 단기 안전장치로는 적절
- 장기 전략으로는 부족

### Option B. Opt-In Advisory Adoption

설명:
- Claude runtime이 managed artifact를 읽을 수는 있다
- 하지만 hard checkpoint rules를 직접 덮어쓰지 않는다
- 대신 다음 같은 advisory layer만 주입한다:
  - explore에서 질문 우선
  - review에서 `why this may be wrong`
  - draft에서 narrative trace preservation
  - submit 전 human commitment reminder

장점:
- production risk가 비교적 낮다
- refactoring 철학이 실제 behavior에 들어간다
- adoption scope를 명확히 제한할 수 있다

단점:
- 두 개의 logic path가 한동안 공존한다
- hard semantics와 soft semantics가 분리되어 다소 복잡해진다

판단:
- 현재 가장 적절한 권고안

### Option C. Full Runtime Consumption

설명:
- Claude production runtime이 managed artifact를 primary governance source처럼 사용한다
- runtime guidance, checkpoint posture, authorship signal을 직접 runtime rule로 사용한다

장점:
- refactoring contract와 production behavior가 빠르게 수렴한다
- duplication이 줄어든다

단점:
- regression 위험이 가장 크다
- production Claude runtime이 refactoring artifact 포맷에 직접 종속된다
- source of truth 경계가 다시 흐려질 수 있다

판단:
- 지금은 시기상조

## Recommended Decision

`Option B. Opt-In Advisory Adoption`

이 결정의 의미는 아래와 같다.

- managed artifact는 production Claude runtime의 `governance hint`가 될 수 있다
- 하지만 `hard checkpoint authority`가 되어서는 안 된다
- provider-native config와 현재 Claude plugin behavior를 즉시 대체하지 않는다
- question policy와 narrative trace는 먼저 `advisory runtime layer`로 들어간다

## What Can Be Adopted Now

아래 항목은 지금 Claude production runtime에 얇게 연결해도 된다.

- `defaultInteractionMode`
- `runtimeGuidance.askAtLeastTwoQuestionsInExplore`
- `runtimeGuidance.requireWhyMayBeWrongInReview`
- `runtimeGuidance.preserveNarrativeTraceInDraft`
- `profileSeed.humanAuthorshipSignal`

이들은 behavior bias를 조정하지만, checkpoint authority를 직접 바꾸지는 않는다.

## What Must Not Be Adopted Yet

아래 항목은 아직 직접 runtime authority로 쓰면 안 된다.

- managed artifact가 legacy Claude checkpoint definitions를 직접 override하는 것
- managed artifact 부재를 runtime failure처럼 취급하는 것
- `.longtable` artifact를 Claude production config의 primary source로 격상하는 것
- runtime guidance를 hook bypass처럼 사용하는 것

## Allowed Patch Scope

다음 패치는 허용된다.

1. Claude prompt assembly의 한 지점에서 advisory guidance를 읽기
2. `explore/review/draft/commit/submit`에 따라 질문/반론/서사 보존 bias를 주입하기
3. dashboard와 setup에서 imported guidance를 더 명확히 표시하기

다음 패치는 아직 허용되지 않는다.

1. Claude-native config loading path를 `.longtable/runtime/claude/longtable.json`으로 교체
2. managed artifact가 없으면 Claude runtime behavior를 degraded mode로 바꾸기
3. hook-level checkpoint enforcement를 managed artifact 값으로 즉시 재정의하기

## Decision Criteria For Moving Beyond Advisory Adoption

아래가 충족되면 더 강한 adoption을 검토할 수 있다.

- closure-bias evaluation에서 Claude/Codex/OMX 비교 결과가 충분히 축적됨
- question policy와 epistemic mode가 실제로 도움이 된다는 evidence가 있음
- narrative trace preservation이 문체 장식이 아니라 researcher trust에 기여함
- integration branch에서 advisory adoption 후 regression이 없음을 확인함

## Product Meaning

이 결정은 보수적이기만 한 선택이 아니다.

이 결정은 LongTable가 `production convenience`보다 `researcher trust`를 우선한다는 선언이다.

Claude runtime은 refactoring repo를 따라가야 하지만, 한 번에 종속되어서는 안 된다.
