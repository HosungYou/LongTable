# Question Policy

## Purpose

이 문서는 LongTable가 언제 질문해야 하는지, 언제 질문 없이 진행해도 되는지, 그리고 어떤 질문을 우선해야 하는지 정의한다.

## Core Principle

좋은 시스템은 항상 많은 질문을 하는 시스템이 아니다.

하지만 더 중요한 건, 질문해야 할 순간에 질문하지 않는 시스템은 위험하다는 점이다.

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

## Anti-Pattern

- 질문할 필요가 있는데 action item으로 덮기
- ambiguity가 큰데 단일 recommendation을 먼저 주기
- 사용자가 명시하지 않은 선호를 사실처럼 전제하기
- “필요한 질문이 있냐”고 묻고 실제론 아무 질문도 하지 않기

## Product Implication

Codex/OMX 환경에서는 execution bias가 강하므로, LongTable는 question bias를 의도적으로 보정해야 한다.

즉 좋은 질문 정책은 단순 UX 개선이 아니라 governance 장치다.
