# Philosophical Audit

## Purpose

이 문서는 LongTable의 최근 철학적 대화를 explicit artifact로 고정하기 위한 것이다.

목표는 세 가지다.

- 제품의 존재 이유를 기능보다 앞에 둔다
- 연구자와 시스템 사이의 책임 경계를 명시한다
- 이후 설계 변경이 이 철학과 충돌하는지 점검할 기준을 만든다

## Explicit Commitments

아래는 최근 대화에서 명시적으로 확인된 입장이다.

- LongTable는 연구를 더 빠르게 만드는 것보다 더 신중하게 만드는 비중이 더 커야 한다.
- 가장 중요한 산출물은 좋은 결정이며, 그 결정의 기록도 중요하다.
- AI의 자율성이 커지는 것은 독이 될 수 있고, 인간이 하네싱을 통해 어떤 자율성을 갖게 되는지가 더 중요하다.
- 인간이 했다는 느낌은 승인만이 아니라 서사, 개인적 경험, 흔적의 축적에서 온다.
- 초보 연구자를 돕는 기능과 숙련 연구자를 증폭하는 기능은 둘 다 필요하다.
- 글쓰기는 경계해야 하지만, 외국인 연구자나 표현 증폭의 맥락에서는 유의미한 지원 지점이 될 수 있다.

## Inferred Hypotheses

아래는 대화에서 강하게 드러났지만 아직 시스템 설계에서 추가 검증이 필요한 해석이다.

- 사용자는 speed보다 epistemic defensibility를 더 중시할 가능성이 높다.
- 사용자는 checkpoint를 단순한 차단 장치보다 narrative accountability 장치로 보길 원한다.
- 사용자는 humanization을 style correction보다 narrative trace preservation 문제로 이해한다.
- 사용자는 tacit knowledge를 추론할 수는 있어도, 사실처럼 고정하는 것에는 경계심이 있다.

## Open Tensions

- speed vs carefulness
- assistance vs automation
- human narrative vs generic fluency
- researcher autonomy vs AI initiative
- explicit governance vs tacit interpretation
- documentation richness vs cognitive burden

## Questions For The System

- 시스템은 무엇을 너무 빨리 구조화하는가?
- 시스템은 무엇을 설명 가능하게 만들고, 무엇을 오히려 숨기는가?
- 시스템은 연구자의 서사를 보존하는가, 아니면 결과만 매끄럽게 만드는가?
- checkpoint는 연구자의 판단을 보호하는가, 아니면 판단을 형식화해서 빈약하게 만드는가?
- tacit knowledge를 inference로 다룰 때, 어디서부터 오판이 되는가?
- humanization은 문체의 문제가 아니라 narrative trace의 문제라는 점을 시스템이 다룰 수 있는가?
- 글쓰기 지원은 voice amplification인가, authorship erosion인가?
- 숙련 연구자와 초보 연구자 모두에게 같은 governance가 정당한가?

## Questions For The Researcher

- 나는 어떤 순간에 AI가 연구를 대신하고 있다고 느끼는가?
- 나는 어떤 결정만큼은 반드시 내가 직접 멈춰서 승인해야 한다고 보는가?
- 나는 좋은 글보다 좋은 판단을 더 중시하는가?
- 내 연구의 인간성은 논리보다 서사에서 더 드러나는가?
- 내가 숨기고 있지만 중요한 지식은 무엇인가?
- 내가 AI에게 맡기고 싶은 것은 무엇이고, 절대 맡기고 싶지 않은 것은 무엇인가?

## Product Implications

- setup은 기술 설치가 아니라 epistemic positioning이어야 한다.
- memory는 사실 저장소만이 아니라 narrative trace를 요약하는 층을 가져야 한다.
- checkpoint는 block/allow만이 아니라 “왜 지금 멈춰야 하는가”를 설명해야 한다.
- humanization 기능은 style polishing보다 authorship preservation을 목표로 해야 한다.
- 기록은 개발자 친화적 로그가 아니라 연구자 친화적 문서로도 남아야 한다.

## Near-Term Actions

1. `Non-Negotiables.md`를 만들어 AI가 대신 결정하면 안 되는 영역을 고정한다.
2. `Failure-Modes.md`를 만들어 over-automation, false inference, narrative flattening을 명시한다.
3. memory 설계에 `narrative trace` 또는 유사 개념을 넣을지 결정한다.
4. setup 질문에 “당신의 연구에서 인간의 흔적은 무엇으로 드러나는가”에 준하는 항목을 추가할지 검토한다.
5. humanization 기능의 성공 기준을 “더 자연스러운 문장”이 아니라 “더 연구자다운 서사”로 재정의한다.
