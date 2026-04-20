# Codex Adapter

## Position

Codex adapter는 provider-native question widget에 의존하지 않는다.

## Baseline

- numbered checkpoint prompt
- strict parsing
- invalid input reprompt
- mode-aware blocking

## Responsibilities

- checkpoint policy 결과를 Codex-friendly prompt surface로 변환
- epistemic mode와 question policy를 runtime guidance header로 변환
- numbered response parsing
- blocking checkpoint wrapper 제공
- `explore`에서는 최소 질문 수와 open tension을 먼저 드러냄
- `review`/`critique`에서는 `why this may be wrong`를 숨기지 않음
- `commit`/`submit`에서는 human commitment stakes를 명시함

## Non-Goal

Codex runtime semantics가 LongTable core contract를 정의해서는 안 된다.
