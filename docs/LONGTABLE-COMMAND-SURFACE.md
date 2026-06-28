# LongTable Command Surface

## Decision

LongTable should expose a small researcher-facing workflow:

1. `longtable setup`
2. `$longtable-start`
3. `$longtable-interview` after a Research Specification exists
4. natural in-session directives such as `lt explore:`, `lt review:`, and
   `lt panel:`

The CLI remains available for setup, diagnostics, scripted workspace creation,
state inspection, search, and tests. The main research conversation happens
inside the provider runtime.

## Primary Surfaces

### `longtable setup`

Permission and runtime setup:

- provider: Codex or Claude Code
- install scope: user, project, or none
- runtime surfaces: skills, MCP, sentinel, or CLI only
- checkpoint intervention posture
- launch guidance for the provider-native start flow

`longtable init` remains a deprecated compatibility alias.

### `$longtable-start`

Provider-native research start:

- create or resume `.longtable/`
- ask one open natural-language question at a time
- avoid early reader/reviewer contribution framing
- avoid forcing theory/method/measurement categories before the researcher has
  described the problem
- preserve interview turns when MCP/state tools are available
- store a First Research Shape only as a short resume handle
- create or update the fuller Research Specification when the interview has
  enough material
- use structured option UI only for final specification confirmation,
  short-handle stop points, or true checkpoint boundaries

### `$longtable-interview`

Unified structured and critical interview:

- runs ordinary option-first follow-up only when a usable Research Specification
  exists
- routes ordinary follow-up to `$longtable-start` when no spec exists
- treats First Research Shape without Research Specification as incomplete start
  state
- uses small bounded choice sets for spec revisions, checkpoint resolution,
  evidence boundaries, coding rules, methods choices, or protected decisions
- includes an escape hatch such as Other, free text, or one open follow-up
  question
- runs critical/grill-me-style requests inside the same `$longtable-interview`
  surface
- asks one relentless sharpening question at a time in critical mode
- stops critical mode when remaining questions repeat the same tension without
  producing a new decision
- treats `$critical-interview` as a compatibility alias, not a separate
  interview contract
- records changes as a Research Specification patch, DecisionRecord, or open
  tension rather than silently overwriting state

### `longtable start`

Automation fallback:

- useful for scripts and smoke tests
- can create a workspace from explicit flags
- should not be presented as the primary research-start experience

### `longtable panel`

Structured multi-role review:

- creates a `PanelPlan`
- creates a provider-neutral `InvocationIntent`
- uses `sequential_fallback` as the stable execution surface
- may launch LongTable-native role workers for Codex with `--native-workers`
  when the local runtime supports the worker backend; add `--wait <ms>` when
  the caller wants LongTable to wait briefly for completed worker result files
- may prefer `native_subagents` for Codex only when the current provider
  session exposes them; this remains a compatibility adapter, not the durable
  LongTable worker contract
- native workers and native subagents must both normalize final role outputs
  back to `PanelResult`
- exposes planned `PanelResult` through `--json`
- exposes the provider runtime prompt through `--print`
- appends an `InvocationRecord` when run inside a LongTable workspace
- creates a follow-up `QuestionRecord` when the next step depends on researcher
  judgment

Examples:

```bash
longtable panel --prompt "review this methods section" --json
longtable panel --prompt "review this measurement plan" --role editor,measurement_auditor --json
longtable panel --provider codex --native-workers --wait 30000 --prompt "review this methods section" --json
longtable panel --provider codex --native-subagents --prompt "legacy native subagent request" --json
longtable panel --visibility always_visible --prompt "keep unresolved disagreement visible" --json
```

When a native worker run reaches a terminal `completed` or `blocked` state
through `longtable panel --native-workers --wait`, `longtable panel status
--wait`, or `longtable panel resume --wait`, LongTable records the normalized
`PanelResult` into workspace evidence without collapsing blocked role outputs
into completion. When a provider or external worker returns a result file
outside that lifecycle, record the structured result before asking LongTable for
a handoff or Research Specification patch:

```bash
longtable panel record --invocation <invocation_record_id> --result-file panel-result.json
```

Native worker-produced files live inside each worker git worktree under
`.longtable-worker/`. Raw worker result files are re-serialized to final role
summaries, claims, objections, open questions, and evidence references before
aggregation. They must not contain hidden reasoning, raw tool traces, or tmux
logs.

Team-style requests route through panel. Explicit debate-language requests route
to panel debate records under `.longtable/panel/`. `longtable team` is not a
public command surface. Historical `.longtable/team/` records remain readable
only as older workspace state.

### `longtable handoff`

Continuation work packet:

- reads `CURRENT.md`, `.longtable/state.json`, Research Specification state,
  panel records, pending decisions, and unincorporated evidence
- writes a Markdown handoff under `.longtable/handoffs/` by default
- carries the latest panel/native-worker result forward as normalized
  `PanelResult` evidence, including evidence refs when roles reported them
- preserves panel/question/decision linkage fields so continuation work can see
  which checkpoint and decision made the panel result actionable
- gives a provider-neutral path for users without OMX
- includes an optional OMX path that treats `$ralplan` and `$ralph` as external
  execution loops, not as LongTable core behavior

Examples:

```bash
longtable handoff --cwd "<project-path>"
longtable handoff --cwd "<project-path>" --print
```

## Question Transport

LongTable state is canonical. Provider UI is transport.

If the prompt contains an explicit collaboration directive such as `lt panel:`
or `lt debate:`, `ask` delegates to the panel surface. If the request is less
explicit but asks for multiple perspectives, LongTable uses panel as the
lightest adequate surface so disagreement stays visible without a team command.

Supported question surfaces:

- MCP/native structured elicitation when available
- terminal selector when interactive TTY input and output are available
- numbered/plain-text fallback everywhere else

Tmux is not a LongTable core requirement. If an OMX-style Codex popup transport
is added, it must be documented as optional, attached-tmux-only, and backed by
the standard fallback path.

## Supporting Commands

```bash
longtable resume --cwd "<project-path>"
longtable doctor
longtable status --cwd "<project-path>"
longtable roles
longtable question --prompt "<decision context>"
longtable decide --question <id> --answer <value>
longtable spec read --cwd "<project-path>"
longtable search --query "<topic>"
longtable panel --prompt "<collaboration context>"
longtable panel record --invocation <id> --result-file panel-result.json
longtable handoff --cwd "<project-path>"
longtable codex install-skills
longtable claude install-skills
longtable mcp install --provider all
```

## Non-Goals

- Do not make provider-specific UI the product contract.
- Do not make tmux required for research-start or checkpoint behavior.
- Do not expose `longtable team` as a collaboration command surface.
- Do not split start and interview into duplicated engines.
- Do not treat First Research Shape as the substantive endpoint.
