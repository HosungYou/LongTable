# Codex Runtime Guidance Injection

## Goal

Codex의 기본 execution bias와 closure bias를 LongTable의 질문 정책으로 직접 보정하는 주입 경로를 정의한다.

핵심 문제는 간단하다.

- Codex는 질문을 할 수 있다
- 하지만 기본적으로는 질문보다 구조화와 recommendation을 앞세운다
- 따라서 LongTable contract를 artifact로만 쓰면 충분하지 않다

Codex에서는 `runtime guidance`가 실제 prompt assembly나 wrapper layer에 주입되어야 한다.

## Why Injection Is Needed

실제 Codex CLI 대화 테스트에서 확인된 패턴:

- `explore`: 질문보다 개념 정리와 tension mapping을 먼저 수행함
- `review`: 강함
- `draft`: narrative trace를 지키는 응답 가능
- `commit`: recommendation을 먼저 주고 commitment를 나중에 요구함

즉 능력 부족이 아니라 `default behavior ordering`의 문제다.

## Principle

Codex에서 LongTable는 다음 순서로 작동해야 한다.

1. mode 판별
2. runtime guidance 주입
3. mandatory-question enforcement
4. only then recommendation or closure

즉 `good prompting`이 아니라 `governed ordering`이 목적이다.

## Injection Layer

권장 주입 지점은 세 가지다.

### 1. Entry Prompt Wrapper

가장 우선.

역할:
- 현재 mode 삽입
- mandatory questions 삽입
- closure disposition 삽입
- narrative trace requirement 삽입

예:
- `explore` -> “recommendation 전에 최소 2개의 meaningful question을 먼저 제시하라”
- `review` -> “최종 요약 전에 why this may be wrong를 포함하라”
- `draft` -> “generic fluency보다 authorial trace preservation을 우선하라”
- `commit` -> “recommendation 전에 human commitment question을 제시하라”

### 2. Checkpoint Wrapper

blocking decision 근처에서만 적용.

역할:
- numbered checkpoint prompt 앞에 stakes 설명 삽입
- 질문 없이 recommendation이 먼저 나오지 못하게 순서 고정
- parse 실패 시 재질문 유지

### 3. Resume/Session Wrapper

다중 턴에서 필요.

역할:
- 이전 턴에서 아직 unanswered mandatory question이 있으면 그 상태를 carry
- session resume 시 mode drift를 막음
- `explore`가 다음 턴에 갑자기 `commit`처럼 닫히는 것을 방지

## What Must Be Injected

최소 필수 항목:

- `mode`
- `minimumQuestions`
- `mandatoryQuestions`
- `closureDisposition`
- `includeWhyMayBeWrong`
- `includeOpenTensions`
- `preserveNarrativeTrace`
- `surfaceHumanCommitment`

이 값들은 이미 refactoring contract에 존재한다.

## What Should Not Be Injected

- agent taxonomy 전체
- 장문의 철학 문서 원문
- 모든 checkpoint history
- 긴 memory dump

Codex는 context pollution에 약하므로, injection은 짧고 강해야 한다.

## Recommended Prompt Shape

```text
LongTable runtime guidance
- mode: explore
- closure: delay
- minimum questions before closure: 2
- include: open tensions
- ask first:
  - [question 1]
  - [question 2]

Instruction:
Do not provide a recommendation until the mandatory questions have been surfaced.
```

중요한 건 prose richness가 아니라 `ordering constraint`다.

## Mode-Specific Rules

### Explore

- recommendation 금지 until mandatory questions surfaced
- 최소 2개 질문
- open tensions 필수

### Review

- `why this may be wrong` 필수
- critique가 synthesis보다 먼저

### Draft

- narrative trace 보존
- unresolved doubt 제거 금지

### Commit

- recommendation 전에 human commitment question
- stakes 명시

### Submit

- risk summary
- remaining unresolved issue visibility
- release responsibility question

## Wrapper Strategy

Codex에서는 두 종류의 wrapper가 가능하다.

### Thin Wrapper

- shell alias 또는 launcher script
- managed artifact를 읽고
- short guidance block을 prepend해서 Codex에 전달

장점:
- 빠름
- 실험 쉬움

단점:
- runtime resume/state carry가 약함

### Session-Aware Wrapper

- managed artifact + prior session state + unanswered questions를 함께 읽음
- resume 시 mandatory questions를 유지

장점:
- LongTable 철학과 더 맞음

단점:
- 구현이 더 큼

권고:
- 먼저 thin wrapper
- 그다음 session-aware wrapper

## Test Path

실제 테스트는 `codex exec`와 `codex exec resume` 기준으로 한다.

### Phase 1. Single-Turn Tests

- explore
- review
- draft
- commit

평가:
- 질문 개수
- recommendation latency
- tension visibility
- narrative trace presence

### Phase 2. Multi-Turn Resume Tests

- explore turn 1
- resume with follow-up
- unanswered questions carry 여부 확인

### Phase 3. Checkpoint Tests

- numbered choice 제시
- recommendation ordering
- parseable decision 요구

## Pass Condition

- `explore`에서 first response가 mandatory question rule을 만족
- `commit`에서 recommendation 전에 explicit commitment question이 나옴
- `review`에서 `why this may be wrong`가 빠지지 않음
- `draft`에서 narrative trace 보존 흔적이 확인됨

## Recommended Next Patch

1. Codex thin wrapper 구현
2. managed artifact -> prompt guidance serializer 구현
3. `codex exec` 기반 regression transcripts 저장
4. pass/fail rubric을 closure-bias protocol에 연결

## Current Implementation Target

thin wrapper의 첫 구현은 `@longtable/provider-codex` 안에 둔다.

- `src/wrapper.ts`: managed setup를 읽고 guidance-aware prompt 생성
- `src/wrapper-cli.ts`: `--print` / `--exec` entry point
- 기본값은 print mode, 실제 Codex 실행은 `--exec`일 때만
