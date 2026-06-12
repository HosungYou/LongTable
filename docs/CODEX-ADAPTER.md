# Codex Adapter

## Position

Codex adapter는 provider-native question widget에 의존하지 않는다. LongTable
QuestionRecord가 canonical state이고, Codex UI는 가능한 transport 중 하나다.

## Baseline

- numbered checkpoint prompt
- strict parsing
- invalid input reprompt
- mode-aware blocking

## Structured UI Transport

Codex can surface MCP elicitation prompts when the client exposes granular MCP
elicitations. LongTable uses that only as a presentation layer:

1. create a durable QuestionRecord first
2. request MCP form elicitation from the client
3. append a DecisionRecord when the user accepts the form
4. return the same numbered checkpoint fallback when popup or elicitation
   transport is unavailable, declined, canceled, or unsupported

`supportsStructuredQuestions` must not be set to `true` merely because LongTable
can render a structured schema. It should reflect a verified provider/client
capability. For Codex, the stable contract remains durable QuestionRecord /
DecisionRecord state with optional tmux popup, MCP elicitation, terminal
selector, or numbered rendering.

`$longtable-start` is the Codex research-start skill. `$longtable-interview` is
post-start and must route to `$longtable-start` when no usable Research
Specification exists.

Routing rule: in attached tmux sessions where the OMX question renderer is
available, the adapter should try `longtable question --question <id> --surface
tmux_popup --provider codex` first for an existing Researcher Checkpoint. If the
popup transport is unavailable, use MCP elicitation when the
`mcp__longtable_state__.elicit_question` tool is visible and approved. Numbered
Decision Card text is the final fallback when popup and MCP elicitation are
unavailable, unsupported, declined, canceled, or blocked by client policy.

Codex UI checkpoints are opt-in. Setup may enable them only when the researcher
chooses `--checkpoint-ui interactive` or `--checkpoint-ui strong` with an MCP
runtime surface. The config change is explicit because it writes:

```toml
approval_policy = { granular = { sandbox_approval = false, rules = false, mcp_elicitations = true } }
```

If the client does not support elicitation or the transport fails, LongTable
keeps the pending `QuestionRecord` and returns the numbered fallback plus the
`longtable decide` next action. If the researcher explicitly cancels or declines
the final First Research Shape confirmation, LongTable clears that generated
required question so a canceled form does not keep blocking the session.

## Terminal Popup Boundary

LongTable does not require tmux for Codex. The current Codex checkpoint ladder
is attached tmux popup, MCP elicitation, terminal selector, then numbered
Decision Card fallback. Interactive terminal selectors require TTY input and
output.

The OMX-style popup renderer is optional Codex terminal transport requiring an
attached tmux session and the `omx` command. It must not redefine the LongTable
question contract; accepted popup answers are normalized back into the durable
`QuestionRecord -> DecisionRecord` flow with `surface: "tmux_popup"`.

## Responsibilities

- checkpoint policy 결과를 Codex-friendly prompt surface로 변환
- optional MCP elicitation을 LongTable QuestionRecord/DecisionRecord에 연결
- epistemic mode와 question policy를 runtime guidance header로 변환
- numbered response parsing
- blocking checkpoint wrapper 제공
- `explore`에서는 최소 질문 수와 open tension을 먼저 드러냄
- `review`/`critique`에서는 `why this may be wrong`를 숨기지 않음
- `commit`/`submit`에서는 human commitment stakes를 명시함

## Non-Goal

Codex runtime semantics가 LongTable core contract를 정의해서는 안 된다.
