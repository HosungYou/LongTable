# LongTable Command Surface

## Decision

LongTable should expose a small researcher-facing workflow:

1. `longtable setup`
2. `$longtable` for workspace, start/interview, governance, role, and panel routing
3. `$longtable-research` for the durable scholarly-evidence workflow
4. natural in-session directives through `$longtable`, such as `lt explore:`, `lt review:`, and
   `lt panel:`

The CLI remains available for setup, diagnostics, scripted workspace creation,
state inspection, search, and tests. The main research conversation happens
inside the provider runtime.

## Primary Surfaces

### `longtable research run|resume|validate-visual-contract`

Recovery and audit subcommands include provider patch recording, independent
extraction and synthesis verification, human citation and synthesis review,
read-only Visual Evidence Contract validation, allowlisted rendering, final
human render review, Paper B replay, and evaluation observation/report
recording. `trial-create|start|finish|status` provides a resumable prospective
crossover runner. These commands are intentionally not the default
conversational journey.

`register-visual-portfolio` freezes a manuscript-level set of Figure, Table,
and Diagram contracts. No visual-contract or final-render stage completes until
all declared items pass their respective human gates.

Durable scholarly-research automation:

- `run` creates a versioned `ResearchBundle` and append-only event log
- `resume` continues at the first non-terminal stage without repeating an
  unchanged completed stage
- `status` reads the durable bundle, `explain` scopes state and events to one
  stage, and `verify` independently reads hashes, provenance, storage
  isolation, visual QA, portfolio completion, and handoff evidence
- the stage order and five allowed blocking event classes are defined in
  `LONGTABLE-RESEARCH-RUNTIME.md`
- stage-level commands are diagnostic/recovery surfaces, not the normal journey
- legal access and strict evidence depth remain visible; metadata or abstract
  records never become full-text verified
- collected public-OA HTTPS routes are acquired automatically unless
  `--no-auto-oa` is set; redirects, network destination, byte limits, PDF
  signature, hash, and parser result are validated without credentials
- prospective trials freeze question, journal, model/version, corpus cutoff,
  permissions, and stage profiles before execution
- legal access, source-version provenance, and quality hard gates are protected
  controls, never ablation candidates
- no default stage may be removed before three complete matched crossover pairs
  with human effort and trust ratings

### `longtable setup`

Permission and runtime setup:

- provider: Codex or Claude Code
- install scope: user, project, or none
- runtime surfaces: skills, MCP, sentinel, or CLI only
- checkpoint intervention posture
- launch guidance for the provider-native start flow

`longtable init` remains a deprecated compatibility alias.

### `$longtable` start route

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

### `$longtable` pressure-interview route

LongTable grilling interview:

- can run with or without a completed Research Specification
- reads `CURRENT.md`, `.longtable/`, supplied documents, and cited evidence
  before asking when those sources can answer
- asks one relentless sharpening question at a time
- frames each turn as `Tension:` followed by `Pressure question:`
- waits for the researcher's direct answer
- continues only while the next question can produce a new decision, sharper
  boundary, stronger evidence standard, or clearer open tension
- stops when remaining questions repeat the same tension without producing a
  new decision
- removes legacy `$critical-interview` skill folders during skill install
- records changes as a Research Specification patch, DecisionRecord, or open
  tension rather than silently overwriting state

### `longtable start`

Automation fallback:

- useful for scripts and smoke tests
- can create a workspace from explicit flags
- should not be presented as the primary research-start experience

### `longtable assure` (Research Assurance)

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
longtable assure --prompt "review this methods section" --json
longtable assure --prompt "review this measurement plan" --role editor,measurement_auditor --json
longtable assure --provider codex --native-workers --wait 30000 --prompt "review this methods section" --json
longtable assure --provider codex --native-subagents --prompt "legacy native subagent request" --json
longtable assure --visibility always_visible --prompt "keep unresolved disagreement visible" --json
```

When a native worker run reaches a terminal `completed` or `blocked` state
through `longtable assure --native-workers --wait`, `longtable assure status
--wait`, or `longtable assure resume --wait`, LongTable records the normalized
`PanelResult` into workspace evidence without collapsing blocked role outputs
into completion. When a provider or external worker returns a result file
outside that lifecycle, record the structured result before asking LongTable for
a handoff or Research Specification patch:

```bash
longtable assure record --invocation <invocation_record_id> --result-file panel-result.json
```

Native worker-produced files live inside each worker git worktree under
`.longtable-worker/`. Raw worker result files are re-serialized to final role
summaries, claims, objections, open questions, and evidence references before
aggregation. They must not contain hidden reasoning, raw tool traces, or tmux
logs.

Team-style requests route through Research Assurance. Explicit debate-language requests route
to panel debate records under `.longtable/panel/`. `longtable team` is not a
public command surface. Historical `.longtable/team/` records remain readable
only as older workspace state.

### `longtable review --role reviewer`

Journal-grounded review:

- keeps peer-review objections, Journal Editor fit judgment, Venue Strategist
  tradeoffs, and scholar-research evidence under the reviewer surface
- uses `Journal Profile` before target-journal fit claims
- uses `Reference Pattern Matrix` when reference papers are available or
  recoverable
- compares decision structure, paper flow, standardized terminology,
  Figure/Table conventions, and APA 7 style expectations
- returns editor-facing contribution claim, reviewer objection,
  venue-strategy tradeoff, evidence gap, revision action, and any needed
  Researcher Checkpoint

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
longtable research run --query "<topic>" --allow-partial \
  --pdf-dir "<legitimate-pdf-folder>" --pdf-access manual_legitimate_access
longtable research resume --run-id "<run-id>" \
  --pdf-dir "<legitimate-pdf-folder>" --pdf-access private
longtable assure --prompt "<collaboration context>"
longtable assure record --invocation <id> --result-file panel-result.json
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
