# Provider Strategy

## Position

LongTable should not be defined by Claude Code or Codex. It should run on top of them through adapters.

## Claude

Strengths:

- plugin workflow already proven
- structured question flow is stronger
- existing LongTable implementation already lives here

Risks:

- cost
- research-user accessibility
- provider lock-in

Adoption rule:

- do not replace Claude production runtime behavior in one patch
- use managed runtime bridge as read-only first
- allow advisory adoption before any hard checkpoint authority moves
- keep generated `.longtable` artifacts as adapter inputs, not production source of truth

## Codex

Strengths:

- strong coding/runtime environment
- subagent support
- better path to open orchestration patterns

Risks:

- no guaranteed Claude-style native question widget
- checkpoint interaction must be implemented at the harness layer

## Reference Runtime Patterns

Codex ecosystem의 orchestration/runtime patterns는 참고할 수 있다.

Recommended use:

- state/hook/runtime 경계 설계 참고
- team and workflow orchestration pattern 참고
- native hook와 fallback ownership split 참고

Not recommended as:

- LongTable product definition
- LongTable의 연구 logic source of truth
- researcher profile or checkpoint semantics의 기준

## Web App

Long-term yes, short-term no.

Use adapters first. Build a web app only after the core profile/checkpoint/memory contracts are stable.
