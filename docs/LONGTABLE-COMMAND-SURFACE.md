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
- provider-specific hidden commands

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
- natural in-session forms such as `lt explore: ...`, `lt review: ...`, and `lt panel: ...`

The following are supporting surfaces:

- `longtable roles`
- `longtable ask`
- `longtable panel`
- `longtable codex install-skills`
- `longtable claude install-skills`

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

`lt panel: ...`처럼 panel directive가 들어오면 `longtable panel`과 같은 provider-neutral panel plan 경로로 위임합니다.

`lt explore: ...`, `lt review: ...`, `lt methods: ...` 같은 짧은 형식은 별도 agent 파일이 아니라 LongTable directive parser와 role router에 기반합니다. Codex skill이나 Claude skill이 설치되어 있으면 같은 자연어 표면을 provider-native entrypoint로도 노출합니다.

### `longtable panel`

여러 LongTable role을 구조화된 panel로 호출하는 고급 경로입니다.

Option A 기준에서 `panel`은 native subagent나 Claude skill을 요구하지 않습니다.

- `PanelPlan`을 생성합니다.
- provider-neutral `InvocationIntent`를 생성합니다.
- stable execution surface는 `sequential_fallback`입니다.
- `--json`은 실행 가능한 계획과 planned `PanelResult`를 보여줍니다.
- `--print`는 provider runtime에 넘길 fallback prompt를 보여줍니다.
- LongTable project workspace 안에서 실행되면 `.longtable/state.json`에 `InvocationRecord`를 append하고 `CURRENT.md`를 재생성합니다.
- panel follow-up `QuestionRecord`를 생성하고, `longtable decide`로 답하면 `DecisionRecord`를 append한 뒤 invocation과 연결합니다.

예:

```bash
longtable panel --prompt "review this methods section" --json
longtable review --role methods_critic,measurement_auditor --panel --prompt "review this methods section" --json
longtable decide --answer evidence --rationale "Need citation support before continuing."
```

### Provider adapter installation

Codex:

```bash
longtable codex install-skills
```

이 명령은 `~/.codex/skills/longtable-*` 아래에 Codex `SKILL.md` 파일을 생성합니다. 명시적으로 호출해야 할 때는 `$longtable` 계열 skill entry를 사용합니다. `/prompts`는 현재 Codex 빌드에서 인식되지 않을 수 있으므로 제품 문서의 약속된 표면이 아닙니다.

Claude Code:

```bash
longtable claude install-skills
```

이 명령은 `~/.claude/skills/longtable-*` 아래에 Claude `SKILL.md` 파일을 생성합니다. OMC처럼 skill/native surface를 제공하지만, 역할 정의는 LongTable registry에서 생성된 adapter artifact입니다.

### `longtable resume`

기존 프로젝트 디렉토리로 돌아왔을 때 machine-readable state에서 `CURRENT.md`를 재생성하고, 현재 상태를 다시 보여주는 경로입니다.

## Non-goal

LongTable의 주 경로는 현재 다음이 아닙니다.

- `/prompts:longtable`
- `longtable review --prompt ... --role ...`
- native provider subagent execution as the only panel path

이들은 존재할 수 있지만, 기본 onboarding surface가 되어서는 안 됩니다.

## Product rule

연구자에게 약속하는 기본 경로는 항상 이 순서여야 합니다.

1. `longtable init`
2. `longtable start`
3. `cd "<project-path>" && codex`

그 외 표면은 보조적이거나 고급 표면입니다.
