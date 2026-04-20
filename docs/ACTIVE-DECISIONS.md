# Active Decisions

## Purpose

이 문서는 최근 LongTable 설계 대화에서 새롭게 확정된 질문, 답, 의사결정을 짧게 고정한다.

세부 구현은 각 패키지와 supporting docs에 흩어질 수 있지만, 아래 결정은 현재 researcher-facing product contract로 본다.

## Recent Questions And Decisions

### 1. LongTable는 어디서 시작되어야 하는가?

질문:

- `longtable start`를 Codex 안에서 치게 할 것인가?
- 아니면 Codex 바깥에서 작업공간을 먼저 만들게 할 것인가?

결정:

- 기본 경로는 **터미널에서 `longtable start`를 먼저 실행**하는 것이다.
- 그 다음 생성된 프로젝트 디렉토리로 이동해 `codex`를 연다.

이유:

- Codex 채팅 안에서 `longtable start`를 입력하면, 현재 Codex build에서는 셸 명령이 아니라 일반 자연어 요청으로 해석될 가능성이 높다.
- LongTable은 먼저 프로젝트 작업공간과 세션 memory seed를 만들고, 그 디렉토리의 `AGENTS.md`와 `.longtable/` 파일을 통해 Codex가 LongTable behavior를 읽게 하는 편이 더 신뢰할 수 있다.

### 2. setup은 한 번만 하는가, 매번 하는가?

질문:

- setup과 project start를 분리할 것인가?
- 아니면 setup 한 번에 모든 프로젝트 정보까지 다 받을 것인가?

결정:

- `longtable init`은 **1회성 글로벌 setup**이다.
- `longtable start`는 **프로젝트/세션 시작 인터뷰**다.

글로벌 setup은 다음만 다룬다.

- 연구자 프로필
- challenge 강도
- 저자성/서사 기본값

프로젝트 시작 인터뷰는 다음만 다룬다.

- 프로젝트 이름
- 프로젝트 디렉토리 위치
- 현재 목표
- 현재 blocker
- 필요한 관점
- disagreement 가시성

### 3. 프로젝트 디렉토리는 누가 결정하는가?

질문:

- LongTable이 디렉토리를 자동으로 고정할 것인가?
- 사용자가 자기 로컬 환경에 맞게 고를 수 있어야 하는가?

결정:

- 사용자가 결정한다.

보조 원칙:

- LongTable은 기본 제안을 줄 수 있지만, 위치를 강제하지 않는다.
- 인터뷰 문구도 “프로젝트가 살아갈 부모 디렉토리”를 더 명확히 드러내야 한다.

### 4. disagreement는 기본적으로 숨길 것인가?

질문:

- LongTable은 하나의 synthesis만 보여야 하는가?
- 아니면 관점 충돌도 드러나야 하는가?

결정:

- 기본 계약은 하나의 책임 있는 synthesis다.
- 그러나 사용자가 원하면 panel disagreement는 기본적으로 visible할 수 있다.
- 현재 설계에서는 setup과 session preference로 `always_visible`을 선택할 수 있다.

### 5. 자연어만으로도 LongTable이 충분히 호출되는가?

질문:

- Codex native slash command가 약한 환경에서 LongTable을 어떻게 명시적으로 부를 것인가?

결정:

- 현재 Codex build에서는 native custom slash command를 기본 경로로 약속하지 않는다.
- 대신 **workspace-first + explicit text invocation**을 쓴다.

예:

- `lt explore: ...`
- `lt review: ...`
- `lt panel: ...`
- `lt editor: ...`
- `lt methods: ...`

### 6. 명령형 CLI surface는 얼마나 researcher-friendly해야 하는가?

질문:

- `longtable review --prompt ... --role ...` 같은 표면을 README 전면에 둘 것인가?

결정:

- 아니다.
- 이런 표면은 고급/디버그 surface로만 남긴다.
- researcher-facing 주 경로는:

1. `longtable init`
2. `longtable start`
3. `cd "<project-path>"`
4. `codex`

### 7. factual claim에는 증거를 강제해야 하는가?

질문:

- LongTable이 기본 Codex보다 더 정확하고 덜 hallucination-prone하려면 어떤 규칙이 필요한가?

결정:

- 그렇다.
- factual, current, external claim에는 source가 필요하다.
- source를 붙일 수 없으면 claim을 `inference` 또는 `estimate`로 라벨링해야 한다.

자세한 규칙은 `docs/EVIDENCE-POLICY.md`를 따른다.

### 8. 재방문 시 continuity를 어떻게 유지할 것인가?

질문:

- 사용자가 세션을 닫고 나중에 다시 돌아올 때, 무엇이 남아 있어야 하는가?

결정:

- 프로젝트 workspace는 지속되어야 한다.
- 최소한 아래 산출물이 있어야 한다.

- `CURRENT.md`
- `.longtable/current-session.json`
- `.longtable/state.json`

그리고 LongTable은 `resume` surface를 제공해야 한다.

보조 원칙:

- root의 human-facing resume artifact는 하나만 유지한다.
- `CURRENT.md`는 source of truth가 아니라 machine-readable state에서 재생성되는 view다.
- `AGENTS.md`는 runtime instruction으로 남기고, human-facing orientation 역할을 겸하지 않는다.

## Product Guardrails

- LongTable은 Codex native UX를 과장해서 약속하지 않는다.
- LongTable은 researcher-facing 기본 표면과 개발자용 고급 표면을 분리한다.
- LongTable은 숨은 자동 개입보다 disclosure된 routing을 선호한다.
- LongTable은 질문을 더 많이 던지되, factual claim에는 더 엄격해져야 한다.
