# LongTable Hook Redesign Plan

## 핵심 입장

LongTable의 훅은 연구 지식을 주입하는 계층이 아니라, 연구자의 판단을 보호하는 **deterministic control layer**여야 한다.  
따라서 훅은 "무엇을 추천할 것인가"가 아니라 "무엇을 강제하고, 무엇을 기록하고, 무엇을 줄일 것인가"를 담당해야 한다.

## 현재 구조의 핵심 문제

현재 LongTable는 checkpoint enforcement, memory auto-injection, team dispatch bypass 등 강한 orchestration 철학을 갖고 있지만, 이 구조가 그대로 확장되면 세 가지 문제가 커진다.

1. **컨텍스트 과부하**: 상시 주입되는 메모리와 규칙이 세션 시작 비용을 높인다.
2. **오케스트레이션 과잉**: 훅이 많아질수록 agent team과 일반 호출의 차이가 복잡해진다.
3. **지식-규율 혼재 위험**: 향후 훅이 이론/방법론까지 담당하기 시작하면 설명 가능성과 유지보수성이 무너진다.

## 남겨야 할 훅

### 1. `state-summary-loader`

- 역할: 현재 프로젝트의 최소 상태를 로드
- 포함 정보: 연구 질문, 현재 단계, 최근 결정 3개, 열린 질문 3개
- 제한: 500-1000 tokens 이내
- 이유: 연구자는 "어디까지 했는지"를 잊기 쉽고, 이 기능은 실제 신뢰를 준다.

### 2. `checkpoint-enforcer`

- 역할: REQUIRED checkpoint 미통과 상태에서 특정 행위를 hard-block
- 적용: 연구 방향 확정, 이론 선택, 방법론 승인, 분석 계획 승인
- 이유: LongTable의 핵심 차별점은 바로 이 구조적 정지점이다.

### 3. `decision-log-writer`

- 역할: 중요 결정과 그 근거를 자동 기록
- 기록 예: 선택된 이론, 버린 대안, 승인 시각, 승인 주체, 근거 요약
- 이유: 연구자에게 필요한 것은 "추천"보다도 "나중에 그 결정을 다시 설명할 수 있는가"이다.

### 4. `artifact-provenance-recorder`

- 역할: 어떤 문헌, 어떤 로그, 어떤 버전의 산출물이 현재 결과에 연결되어 있는지 기록
- 적용: 문헌 검색 결과, 척도 초안, 설계안, 분석 코드, 문서 초안
- 이유: 연구 윤리, 재현성, IRB/논문 대응에 직접적으로 중요하다.

### 5. `context-compactor`

- 역할: 컨텍스트 길이가 커질 때 자동으로 압축 요약본으로 전환
- 원칙: 세부 텍스트 전체를 싣지 않고 state와 unresolved questions만 남김
- 이유: 비용 절감과 장기 세션 안정성에 필수다.

## 제거하거나 축소해야 할 훅

### 1. `always-on full memory injection`

- 제거 이유: 긴 프로젝트 컨텍스트를 매 호출마다 넣는 것은 비용이 너무 크다.
- 대체: `state-summary-loader + on-demand retrieval`

### 2. `methodology recommendation hooks`

- 제거 이유: 훅이 quantitative/qualitative/mixed 추천을 담당하면 지식 계층과 규율 계층이 섞인다.
- 대체: 명시적 agent call 또는 retrieval module

### 3. `theory recommendation hooks`

- 제거 이유: 이론 선택은 checkpoint 대상이지 hook 자동화 대상이 아니다.
- 대체: theory module + A2 계열 deliberation

### 4. `broad keyword auto-dispatch hooks`

- 축소 이유: "meta-analysis", "theory", "journal" 같은 넓은 트리거는 오탐 가능성이 높다.
- 대체: 얇은 classifier 또는 coordinator-first routing

### 5. `team-bypass as general escape hatch`

- 축소 이유: 현재의 `DIVERGA_TEAM_DISPATCH=1`는 유용하지만 남용되면 checkpoint 철학을 약화시킨다.
- 대체: orchestrator-approved review mode에만 제한적으로 허용

## 권장 훅 구조

```text
Session Start
  -> state-summary-loader
  -> if needed: context-compactor summary restore

User Action
  -> checkpoint-enforcer
  -> allowed? yes/no

If allowed
  -> explicit agent or coordinator dispatch
  -> artifact-provenance-recorder
  -> decision-log-writer (if decision event)

Long Session
  -> context-compactor
```

## 훅과 에이전트의 경계

훅이 해야 할 일:

- 상태 확인
- 차단
- 기록
- 압축
- provenance 보존

에이전트가 해야 할 일:

- 이론 제안
- 방법론 비교
- 척도 추천
- 반론 생성
- 논문 초안 작성

이 경계가 흐려지면 LongTable는 연구 하네스가 아니라 과잉 자동화된 assistant로 다시 후퇴한다.

## 우선 구현 순서

1. `checkpoint-enforcer`를 최소 checkpoint 집합으로 축소
2. `state-summary-loader`를 1KB 이내 요약 구조로 재설계
3. `decision-log-writer`와 `artifact-provenance-recorder`를 핵심 기록층으로 승격
4. `always-on memory injection` 제거
5. `team dispatch bypass`를 review-only mode로 제한

## 한 문장 요약

LongTable의 훅은 더 똑똑해져야 하는 것이 아니라, 더 **작고 엄격하고 예측 가능하게** 재설계되어야 한다.
