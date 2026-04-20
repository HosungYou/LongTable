# LongTable Command Surface

## Decision

LongTable의 researcher-facing 표면은 아래 두 단계가 중심이어야 합니다.

- `longtable init`
- `longtable start`

그리고 그 다음 작업은 프로젝트 디렉토리 안에서 이어집니다.

## Why

이전 표면은 너무 개발자 중심이었습니다.

- `--prompt`
- `--role`
- `--panel`
- `/prompts:...`

이런 표면은 디버그나 고급 사용에는 의미가 있지만, 연구자에게는 “어떻게 시작해야 하는지”를 알려주지 못합니다.

그래서 LongTable의 표면은 명령 카탈로그가 아니라 다음 질문에 답해야 합니다.

1. 너는 누구인가?  
   -> `longtable init`
2. 지금 무엇을 시작하려는가?  
   -> `longtable start`
3. 그 작업은 어디서 계속되는가?  
   -> 생성된 프로젝트 디렉토리

## Current primary surface

- `longtable init`
- `longtable start`
- `longtable resume`
- `longtable roles`
- `longtable ask`

여기서 중요한 구분은 다음과 같습니다.

- `init`와 `start`는 셸 명령
- `codex`는 프로젝트 디렉토리 안에서 여는 세션
- 실제 연구 대화는 그 다음부터 자연어로 진행

## Surface roles

### `longtable init`

글로벌 setup.

- 연구자 프로필
- challenge 강도
- 저자성/서사 기본값
- 기본 mode/panel preference

### `longtable start`

프로젝트 시작 인터뷰.

- 프로젝트 이름
- 프로젝트 위치
- 현재 목표
- 현재 blocker
- 필요한 관점
- disagreement 가시성

그리고 아래를 생성합니다.

- 프로젝트 디렉토리
- `.longtable/project.json`
- `.longtable/current-session.json`
- `.longtable/state.json`
- `.longtable/sessions/`
- 프로젝트용 `AGENTS.md`
- `CURRENT.md`

### `longtable roles`

LongTable이 어떤 관점을 호출할 수 있는지 짧게 설명합니다.

### `longtable ask`

이미 만들어진 프로젝트 디렉토리 안에서 자연어로 바로 도움을 받는 경로입니다.

### `longtable resume`

기존 프로젝트 디렉토리로 돌아왔을 때 machine-readable state에서 `CURRENT.md`를 재생성하고, 현재 상태를 다시 보여주는 경로입니다.

## Non-goal

LongTable의 주 경로는 현재 다음이 아닙니다.

- `/prompts:longtable`
- `longtable review --prompt ... --role ...`

이들은 존재할 수 있지만, 기본 onboarding surface가 되어서는 안 됩니다.

## Product rule

연구자에게 약속하는 기본 경로는 항상 이 순서여야 합니다.

1. `longtable init`
2. `longtable start`
3. `cd "<project-path>" && codex`

그 외 표면은 보조적이거나 고급 표면입니다.
