# Decision Lifecycle

## Principle

중요한 연구 결정은 prompt text 안에 묻히지 않고 decision log로 남아야 한다.

## Flow

1. checkpoint engine이 blocking 또는 recommended 여부를 결정한다
2. researcher가 선택하거나 거부한다
3. accepted decision은 decision record로 기록된다
4. state update가 필요한 경우 explicit state 또는 study contract가 갱신된다
5. artifact가 생성되면 provenance record가 연결된다

## Rule

- inferred hypothesis는 confirmation 없이 decision record가 되지 않는다
- high-stakes artifact는 provenance를 남긴다
- submit mode에서는 최근 decision lineage가 함께 요약된다
