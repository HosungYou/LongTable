# MCP Transport

## Decision

LongTable includes an optional MCP server named `longtable-state`.

MCP is a structured transport layer. It is not the source of truth, and it does
not own checkpoint semantics. The source of truth remains:

- `.longtable/project.json`
- `.longtable/current-session.json`
- `.longtable/state.json`
- `CURRENT.md` as the regenerated human-readable view

## Why It Exists

Provider-native skills and prompts are useful entrypoints, but they are not a
stable data API. MCP gives Codex, Claude Code, and future runtimes a typed way
to interact with LongTable state.

The main benefits are:

- avoid Markdown scraping when reading project state
- expose checkpoint evaluation as a callable tool
- create pending `QuestionRecord` objects from provider runtimes
- request provider/client elicitation when the runtime supports it
- render a question for the current provider transport
- append normalized `DecisionRecord` objects
- regenerate `CURRENT.md` after state changes

## Server

Package:

```text
@longtable/mcp
```

Server key:

```text
longtable-state
```

Direct run:

```bash
npx -y @longtable/mcp@0.1.51
longtable-state --self-test
```

## Install Surface

The CLI prints MCP config by default:

```bash
longtable mcp install --provider all
```

It writes provider config only when explicitly requested:

```bash
longtable mcp install --provider codex --write
longtable mcp install --provider claude --write
```

Codex UI Researcher Checkpoints require an additional explicit opt-in because
MCP elicitation lets the server surface user-input prompts:

```bash
longtable mcp install --provider codex --checkpoint-ui strong --write
```

That writes Codex's granular MCP elicitation approval alongside the LongTable
MCP server block. Without that approval, `elicit_question` still creates the
same durable `QuestionRecord`, records the transport failure or fallback status,
and returns a numbered fallback.

Provider guidance should route checkpoint UI through MCP first when
`elicit_question` is available. The CLI command `longtable question --print` is
only the fallback transport for clients that cannot show or accept MCP
elicitation.

Default paths:

- Codex: `~/.codex/config.toml`
- Claude Code: `~/.claude/settings.json`

## Tool Contract

The first tool set is intentionally narrow:

- `read_project`: read project metadata and managed file paths
- `read_session`: read the current session record
- `inspect_workspace`: summarize workspace state and optionally read
  `CURRENT.md` and project `AGENTS.md`
- `create_workspace`: create `.longtable/` for provider-native
  `$longtable-start`
- `begin_interview`: create or resume the active LongTable interview hook
- `append_interview_turn`: record one natural-language interview turn with
  answer-quality metadata and optional content-based readiness rationale
- `summarize_interview`: store the provisional First Research Shape
- `summarize_research_specification`: store the fuller Research Specification
  after the interview has enough scope, construct ontology, theory framing,
  coding, method, evidence/access, and epistemic-alignment detail. The stored
  specification creates an audit patch and revision, links available interview
  evidence, and preserves raw interview turns in state rather than rendering the
  full transcript into `CURRENT.md`
- `read_research_specification`: read the current Research Specification and
  render the researcher-facing preview
- `propose_research_spec_patch`: store a reviewable Research Specification
  patch without applying it
- `apply_research_spec_patch`: automatically apply a proposed or inline
  Research Specification update, create a source-mapped revision, and add a
  log-only `DecisionRecord` when no explicit decision is supplied
- `diff_research_specification`: compare an inline Research Specification with
  the current workspace specification without writing state
- `read_research_spec_history`: read Research Specification revisions, patches,
  and evidence records for audit or resume
- `find_unincorporated_evidence`: list interview, panel, critic, reviewer, or
  invocation evidence not yet incorporated into a Research Specification
  revision
- `cancel_interview`: explicitly cancel an active interview without confirming a
  First Research Shape
- `confirm_first_research_shape`: request MCP form elicitation for the final
  First Research Shape confirmation when the researcher stops at the short
  handle layer; already-confirmed shapes return without opening a new form
- `confirm_research_specification`: request MCP form elicitation for the final
  Research Specification confirmation, including options to save, ask one more
  question, revise a section, or keep the draft open
- `pending_questions`: list pending Researcher Checkpoints
- `evaluate_checkpoint`: classify natural-language context without writing
  state
- `create_question`: create a pending `QuestionRecord`, optionally with
  lightweight `commitmentFamily` and `epistemicBasis` audit metadata
- `elicit_question`: create a `QuestionRecord`, request MCP form elicitation,
  and append a decision with surface `mcp_elicitation` when accepted. The MCP
  form asks for the decision only; optional rationale belongs in
  `longtable decide --rationale` or numbered fallback text. The same optional
  audit metadata is accepted here. The tool returns
  provider fallback transport when elicitation is unavailable, declined, timed
  out, or canceled
- `render_question`: render the selected question for Codex or Claude transport
- `append_decision`: answer a pending question and append a `DecisionRecord`
- `regenerate_current`: rebuild `CURRENT.md` from machine-readable state

`longtable mcp install --provider codex --write` writes approval blocks for the
full managed tool set. `longtable doctor` reports stale `@longtable/mcp`
versions and missing Research Specification tools, because an older allowlist can
make the interview stop at First Research Shape even when the newer server
package supports the specification workflow.

## Access Boundary

The MCP server should stay constrained to LongTable-managed state:

- `.longtable/`
- `CURRENT.md`
- project `AGENTS.md`

It should not become a general filesystem or research search server.

## Relationship To Core

The dependency direction is:

```text
@longtable/core
@longtable/memory
@longtable/checkpoints
@longtable/provider-*
@longtable/cli project-state helpers
  -> @longtable/mcp
```

Core packages define semantics. MCP exposes those semantics to provider runtimes.

If MCP behavior and core behavior ever disagree, core wins.

## Open Limits

The MCP layer is a transport hardening step, not the final runtime:

- it does not yet provide OAuth or remote deployment
- it does not own scholarly search connectors
- it does not replace provider skills
- it does not guarantee UI elicitation; clients must advertise and allow that
  capability
- it does not guarantee that a provider will automatically call the tools
  without runtime guidance

Provider skills and runtime instructions should still tell the model when to
call `longtable-state`, especially before crossing a required Researcher
Checkpoint.
