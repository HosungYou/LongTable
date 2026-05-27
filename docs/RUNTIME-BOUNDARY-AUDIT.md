# Runtime Boundary Audit

## Purpose

This document records LongTable's boundary with Codex and Claude Code. The core
question is not "can LongTable make the provider obey every instruction?" It is:

> Where can LongTable reliably protect research judgment without becoming a
> heavy wrapper that fights the provider's execution model?

## Thesis

LongTable should remain a thin governance layer. It should not try to replace
Codex, Claude Code, or their task-completion behavior. It should intervene only
when a research judgment is becoming unclear, hidden, or prematurely settled.

The product goal is alignment between:

- the researcher's explicit knowledge and intention
- durable project state
- AI inference and execution
- the research direction that will become hard to undo later

When those four are aligned, LongTable should stay light. When they diverge,
LongTable should stop, surface the conflict, and ask for human clarity or use
durable project state when it is clearly more specific than the current prompt.

## What Can Be Enforced

Markdown files, provider skills, hooks, MCP, and CLI state do not have equal
force. Treat them as different enforcement layers.

| Layer | What it can do | What it cannot guarantee |
|---|---|---|
| README/docs | Define product policy and shared language | Force a provider to stop |
| Generated skills | Bias the agent toward LongTable behavior | Override the provider's wrapper logic |
| Hook context | Inject short state or warning context | Reliably carry long deliberation or philosophy |
| Hook deny/block | Stop selected tool actions or prompt flows | Replace human judgment or provider runtime policy |
| MCP elicitation | Create and render durable checkpoint questions | Guarantee the client accepts native UI |
| CLI/state gates | Persist `QuestionRecord -> DecisionRecord` and block LongTable commands | Block every possible non-LongTable action |
| File-backed artifacts | Preserve panel/interview records for later review | Make the record self-interpreting without quality rules |

Therefore, `.md` changes are necessary but not sufficient. Hard or near-hard
behavior belongs in hooks, MCP, CLI gates, and state transitions.

## Must-Stop Research Commitments

LongTable should ask and stop before acting when the next step would change or
settle any of these four commitment families:

1. Research question or scope
2. Theory frame or construct map
3. Measurement, coding, or extraction standard
4. Method design or analysis strategy

These are not merely "important topics." They are ontology-forming decisions:
they define what exists in the study, what counts as evidence, and which
inferences become legitimate. Missing one of these questions is a worse failure
than asking one extra question.

## Stop Scope

LongTable now treats hard-stop as narrower than `required`. A full stop is
reserved for unresolved Researcher Checkpoints or obligations that can change
the Research Specification question, scope, construct map, method/analysis,
evidence boundary, or protected decisions.

That does not mean LongTable should freeze the whole machine forever. Product,
setup, hook, documentation, release, npm, git, and simulation-test work should
not be blocked just because an unrelated required question exists. Research
state changes that depend on the unresolved hard-stop still must wait.

This is stricter than only blocking `.longtable/` state writes, and it is
justified because Codex can otherwise complete many downstream actions before
the unresolved research decision is visible. The cost is interruption. The
benefit is avoiding false closure.

Product and engineering tasks are different. LongTable product work, hook
debugging, setup, docs, and release tasks should not create research-state
`QuestionRecord`s. They may still use ordinary engineering checks before
irreversible actions such as npm publish, git tag, or GitHub release.

## Low-Risk Assumption Rule

For low-risk, reversible, or presentational gaps, LongTable should proceed with
explicit assumptions rather than stop. This rule exists for three reasons:

- Codex is built to complete user-requested work; excessive interruption fights
  that wrapper instead of helping it.
- Many missing details are not research commitments and can be revised cheaply.
- Stating assumptions keeps epistemic trace without turning every ambiguity into
  a checkpoint.

The rule is not "guess silently." It is:

```text
Proceed only if the assumption is reversible, low-stakes, and visible.
Ask and stop if the assumption would change research commitments.
```

## Overengineering Risks

LongTable becomes too heavy when it optimizes for visible governance instead of
research judgment. Current risk areas:

- hook noise that exposes internal harness text
- too many state files or records that the researcher cannot interpret
- panels that claim "discussion" but only show a short synthesis
- broad trigger rules that mistake product work for research commitments
- repeated pending checkpoints that appear without a clear decision context

The countermeasure is not removing governance. It is making each intervention
earn its cost:

- one focused question
- visible decision context
- meaningful options
- durable record only when the answer matters later
- quiet default for product/tooling and low-risk work

## Minimal Product Surface

These surfaces remain justified, but each must stay scoped.

| Surface | Keep? | Reason | Scope limit |
|---|---:|---|---|
| Researcher Checkpoint | Yes | It is the durable stop mechanism for protected research decisions | Required only for high-risk commitments |
| Interview | Yes | It creates the first project specification and prevents empty setup | Must produce inspectable state, not just philosophical chat |
| Panel/debate | Yes | It makes disagreement visible before synthesis | Needs concise role records and a decision prompt |
| Search/access | Yes | Research claims need evidence and access provenance | Should be invoked when evidence matters, not always-on |
| Release hooks | Yes | Public package releases are irreversible engineering actions | Engineering checks only; no research-state checkpoint |

So the question is not whether to delete Researcher Checkpoints, search/access,
or release hooks. The question is whether they stay narrow enough that
LongTable remains a harness rather than a second agent framework.

## Claude Code Comparison Baseline

Claude Code has strong native skill and structured-question affordances, but
provider-native affordances are not the product contract. LongTable should use
them as transport.

| Concern | Claude Code style | LongTable boundary |
|---|---|---|
| Skills | Strong behavior hints | Generated skills remain soft policy |
| Structured questions | Useful native UI when available | LongTable still owns checkpoint semantics |
| Hooks | Deterministic runtime intervention | Use only for high-signal state or block cases |
| Agent/team work | Can run provider-native tasks | LongTable needs structured deliberation records |
| Memory | Provider-dependent | `.longtable/` remains canonical state |

The comparison suggests LongTable should not add a large always-on harness. It
should keep provider-specific transports thin and make `.longtable/` state the
only durable source of truth.

## First Research Shape Quality

`$longtable-start` may produce a useful First Research Shape:

- handle
- current goal
- current blocker
- research object
- gap risk
- protected decision
- open questions
- next action
- confidence

That is enough to orient a later AI session, but it is not a closure artifact.
If an AI reviews only the First Research Shape, it can understand the broad
direction and the next move, but it may not recover the researcher's full
ontology, evidence boundaries, philosophical commitments, or why one alternative
was rejected.

The interview is strongest when it does two things:

- asks concrete, sometimes philosophical questions that expose the researcher's
  actual judgment
- stores a concise specification that later agents can inspect without reading
  the entire chat

The quality gap is compression. A very rich interview can collapse into a thin
First Research Shape. LongTable addresses this by treating Research
Specification as the default substantive artifact. First Research Shape can feed
that artifact, but it is not a required gate when the specification fields are
already clear:

- scope boundary
- construct ontology
- theory commitments and rejected alternatives
- measurement/coding commitments
- evidence and access boundaries
- epistemic conflicts between researcher intent, AI inference, and project state
- panel/debate decisions that changed the direction

This layer does not make setup heavier. It is created inside
`$longtable-start` through MCP `summarize_research_specification`, displayed
as a Research Specification Preview, and confirmed through
`confirm_research_specification`. If the researcher only wants the shorter
handle layer, `confirm_first_research_shape` remains available as an explicit
short-stop path.

When the researcher chooses `ask_one_more` or `revise_section` at the
specification checkpoint, LongTable must not drift into open-ended discussion
and silently end. It should answer or revise the missing part, then return to
the Research Specification Preview. This is the harness guarantee: a discussion
may deepen, but the artifact boundary remains visible.

## Ontology Harness Boundary

LongTable's ontology work should be carried by durable research artifacts, not
by provider personality or a hidden prompt.

| Layer | Ontology role | Harness rule |
|---|---|---|
| First Research Shape | Short handle for resume and orientation | Useful but optional; not closure |
| Research Specification | Scope, constructs, distinctions, coding, evidence/access, epistemic alignment | Default substantive interview artifact |
| QuestionRecord | A focused human judgment that must be answered before a research commitment moves | Use only for research commitments; optional `commitmentFamily` and `epistemicBasis` help audit the commitment without creating a full ontology layer |
| DecisionRecord | The selected answer and rationale that changed state | Must link to the commitment it settles and copy the question metadata when present |
| CURRENT.md | Researcher-readable projection of current state | Must expose missing or draft specification state |
| MCP/provider UI | Transport for state changes and elicitation | Must not own semantics |

This keeps LongTable aligned with the researcher's ontology while avoiding a
large always-on wrapper. The system becomes stronger not by adding more agents,
but by making the few artifact transitions inspectable and hard to confuse.

## Operating Rule

LongTable should follow this rule across Codex and Claude Code:

```text
If the next action would settle research ontology, evidence standards, or
interpretive authority, ask and stop.

If the next action is reversible execution, proceed with visible assumptions.

If human knowledge, AI inference, and durable project state conflict, prefer the
most explicit durable state; if that state is not explicit enough, ask the
researcher for clarity.
```

## Next Engineering Implications

1. Keep advisory hook output silent.
2. Keep product/tooling prompts out of research-state checkpoint creation.
3. Keep the Research Specification artifact after First Research Shape quality
   is evaluated, and render it in `CURRENT.md` so later agents can inspect the
   actual scope, ontology, theory, coding, method, evidence/access, and
   epistemic alignment commitments.
4. Treat `ask_one_more` and `revise_section` at Research Specification
   confirmation as a return-to-preview obligation.
5. Add tests for whole-work-unit stop behavior when required checkpoints are
   active.
6. Keep release hooks as engineering safeguards, not research checkpoints.
7. Keep state files interpretable; avoid adding durable records that have no
   researcher-facing meaning.
