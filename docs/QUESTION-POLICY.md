# Question Policy

## Purpose

이 문서는 LongTable가 언제 질문해야 하는지, 언제 질문 없이 진행해도 되는지, 그리고 어떤 질문을 우선해야 하는지 정의한다.

## Core Principle

좋은 시스템은 항상 많은 질문을 하는 시스템이 아니다.

하지만 더 중요한 건, 질문해야 할 순간에 질문하지 않는 시스템은 위험하다는 점이다.

LongTable에서 이 질문 장치는 **Researcher Checkpoint**라고 부른다.

Claude Code의 AskUserQuestion-style UI나 Codex의 numbered-choice fallback은
transport일 뿐이다. LongTable의 제품 계약은 "질문할 수 있음"이 아니라,
연구적 책임이 넘어가기 전에 연구자의 판단을 적극적으로 확인하고 그 답을
state에 남기는 것이다.

## Must-Ask Conditions

아래 조건에서는 질문을 생략하면 안 된다.

1. 연구의 핵심 결정이 바뀔 수 있을 때
2. ambiguity가 높고 결론이 여러 방향으로 갈릴 수 있을 때
3. 사용자의 가치 판단이 필요한 순간일 때
4. tacit knowledge를 inference로 해석하고자 할 때
5. 결과를 매끄럽게 만들면 서사가 사라질 위험이 있을 때
6. 외부 제출, 공유, 출판 책임이 걸린 순간일 때

## Question Types

### Clarifying Questions

무엇을 말했는지 분명하지 않을 때.

예:
- 지금 우선순위가 속도인가 신중함인가?
- 여기서 “인간이 했다”는 느낌은 승인인가 서사인가?

### Boundary Questions

어디까지를 AI가 다뤄도 되는지 확인할 때.

예:
- 이 결정은 AI가 제안만 해야 하나, 비교까지 해도 되나?
- 글쓰기에서 어디까지 보정해도 된다고 보는가?

### Tension Questions

둘 이상의 가치가 충돌할 때.

예:
- novelty와 defensibility 중 무엇을 더 우선할 것인가?
- 자율성과 통제 중 어떤 위험을 더 크게 보는가?

### Narrative Questions

연구자의 흔적을 살리기 위해 묻는 질문.

예:
- 이 프로젝트에서 당신의 개인적 경험은 어디에 들어 있는가?
- 이 결정을 당신답게 만드는 맥락은 무엇인가?

## Minimum Question Rule

아래 경우에는 최소 2개의 질문을 먼저 제시하고 바로 결론을 내리지 않는다.

- mode가 `explore`일 때
- 철학적/가치적 갈등이 핵심일 때
- tacit knowledge를 다루고 있을 때
- 사용자가 “토론”, “성찰”, “탐구”를 요청했을 때

## Researcher Checkpoint Shape

좋은 Researcher Checkpoint는 아래 구조를 가진다.

```text
Researcher Checkpoint
Decision context: 지금 닫으면 downstream research choice가 바뀐다.
Question: 무엇을 LongTable가 다음 인간 결정으로 취급해야 하는가?
Options: revise / gather evidence / proceed / defer
Record: QuestionRecord -> DecisionRecord
```

필수 속성:

- 질문이 필요한 맥락을 짧게 설명한다.
- 하나의 판단만 묻는다.
- 선택지는 2-4개로 제한한다.

## Focused Follow-up Questions

When the prompt contains multiple tacit decisions, LongTable should not collapse
them into one generic checkpoint. It should ask a grouped set of focused choice
questions for each knowledge gap LongTable would otherwise have to infer.

Default policy:

- trigger on every detected knowledge gap, not only high-stakes research
  commitments
- ask as many focused questions as the task requires
- mark the recommended option visibly
- prefer native structured UI when a provider reliably exposes it
- prefer terminal selector UI in the CLI
- fall back to numbered checkpoint text with strict parsing when no richer
  renderer is available

The question group is still provider-neutral. LongTable decides what must be
asked; Claude, Codex, terminal, and future web renderers decide how it is shown.
- 선택지가 실제로 의미 있는 trade-off를 가져야 한다.
- 답변은 `QuestionRecord`를 answered 상태로 바꾸고 `DecisionRecord`를 만든다.
- pending question은 `CURRENT.md`에 남아야 한다.

## Proactive Triggering

Researcher Checkpoint는 사용자가 "필요하면 질문해"라고 말했을 때만 나오는
것이 아니다. 아래 순간에는 proactive하게 나타나야 한다.

- 연구 질문을 freeze하려 할 때
- theory anchor, method, measurement, analysis plan을 commit하려 할 때
- tacit knowledge를 AI가 추론으로 채우려 할 때
- panel disagreement가 synthesis 하나로 접힐 위험이 있을 때
- evidence 없이 다음 단계로 진행하려 할 때
- 외부 제출, preregistration, public sharing이 가까워질 때
- LongTable의 제품명, README positioning, provider behavior, checkpoint policy를 확정하려 할 때

단, reversible draft나 low-stakes formatting처럼 책임이 넘어가지 않는 작업은
interrupt보다 log-only가 낫다.

## Meta-Decision Checkpoint

LongTable 자체에 관한 결정도 Researcher Checkpoint 대상이다.

특히 아래 결정은 사용자의 생각과 시스템의 생각이 일치하는지 먼저 확인해야 한다.

- 새로운 제품 개념명 확정
- README의 핵심 positioning 변경
- 질문/체크포인트 정책 변경
- Claude/Codex provider behavior 변경
- provider-native tool 이름을 LongTable 제품 언어로 가져올지 여부

이 경우 질문은 "승인하시겠습니까?"가 아니라 선택지를 가진 판단이어야 한다.

예:

```text
Researcher Checkpoint
Decision context: 이 이름은 README, docs, provider skills 전체에 퍼지는 제품 언어가 됩니다.
Question: LongTable의 질문 장치 이름을 무엇으로 확정할까요?
Options: Researcher Checkpoint / Research Judgment Checkpoint / Reflective Checkpoint / other
```

## Other Option Rule

`allowOther: true`인 질문은 반드시 researcher-facing 선택지에도 `other`를 보여야 한다.

내부 record만 `allowOther`를 갖고 화면에는 보이지 않는 것은 실패다. 사용자는
제시된 선택지가 자신의 판단을 포착하지 못한다고 말할 수 있어야 한다.

## Anti-Pattern

- 질문할 필요가 있는데 action item으로 덮기
- ambiguity가 큰데 단일 recommendation을 먼저 주기
- 사용자가 명시하지 않은 선호를 사실처럼 전제하기
- “필요한 질문이 있냐”고 묻고 실제론 아무 질문도 하지 않기
- `allowOther`가 있는데 화면에는 other를 보여주지 않기
- AI가 이미 결론을 정한 뒤 형식적 승인만 받기
- 옵션이 한 방향으로 편향되어 researcher agency를 약화시키기

## Product Implication

Codex/OMX 환경에서는 execution bias가 강하므로, LongTable는 question bias를 의도적으로 보정해야 한다.

즉 좋은 질문 정책은 단순 UX 개선이 아니라 governance 장치다.

OMX의 AskUserQuestion 패턴에서 차용할 점은 clickable UI가 아니라
stateful checkpoint다. LongTable는 이를 연구자의 판단 리듬에 맞춰
Researcher Checkpoint로 재해석한다.
