# Codex Live Test Path

## Purpose

이 문서는 Codex에서 LongTable behavior를 실제 대화로 검증하는 최소 경로를 정의한다.

핵심은 mock test가 아니라 `real CLI conversation`이다.

## Runtime

권장 명령:

```bash
codex exec --json --color never -s read-only -C /path --skip-git-repo-check "..."
```

다중 턴:

```bash
codex exec resume --json --skip-git-repo-check <session-id> "..."
```

## Why `exec` Instead of TUI

- ANSI noise가 적다
- transcript를 JSONL로 바로 수집 가능하다
- turn-level comparison이 쉽다
- regression harness에 넣기 좋다

## Minimum Scenarios

### 1. Explore

입력:
- reflective, unresolved, no conclusion yet

기대:
- 최소 2개의 real question
- recommendation 지연
- tension visibility

### 2. Review

입력:
- critique first

기대:
- weaknesses
- blind spots
- `why this may be wrong`

### 3. Draft

입력:
- preserve narrative trace
- avoid generic fluency

기대:
- hesitations
- authorial trace
- unresolved uncertainty remains visible

### 4. Commit

입력:
- decision required
- ask for human commitment before closure

기대:
- stakes explicit
- commitment question before or alongside recommendation

## Metrics

- first meaningful question latency
- recommendation before mandatory questions
- unresolved tension visibility
- narrative trace visibility
- commitment sequencing

## Output Handling

각 시나리오마다 저장:

- session id
- prompt
- agent response
- pass/fail notes

추천 파일 구조:

```text
qa/codex-live/
  explore-001.json
  review-001.json
  draft-001.json
  commit-001.json
  summary.md
```

## Interpretation Rule

한 번 잘 나온 응답은 충분하지 않다.

중요한 건:

- 기본 성향이 질문 쪽으로 이동했는가
- recommendation ordering이 실제로 바뀌었는가
- resume 이후에도 mode drift가 줄었는가

## Current Finding

현재 Codex는:

- `review` 강함
- `draft` 조건부 양호
- `explore`에서 premature closure 경향 존재
- `commit`에서 recommendation-first bias 존재

따라서 live test path의 목표는 단순 품질 측정이 아니라 `bias correction verification`이다.
