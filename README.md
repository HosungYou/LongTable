# LongTable

LongTable is a research harness for working with AI across long scholarly
projects. It is designed to help researchers slow down at important moments,
make assumptions visible, preserve decisions, and keep evidence, theory,
measurement, and authorship traceable across sessions.

LongTable is not a chatbot replacement and not a prompt collection. It is a
small research workspace system that runs through a CLI, provider skills,
optional MCP state and checkpoint transport, and file-backed panel or team
review artifacts.

## Why LongTable Exists

AI can make research feel faster, but speed can hide weak decisions. LongTable
tries to protect the moments where a researcher should pause:

- narrowing a research question
- choosing a theory anchor
- defining a construct or measurement strategy
- selecting a method or analysis plan
- deciding whether evidence actually supports a claim
- preserving the researcher's own authorship and judgment
- preparing a manuscript, preregistration, submission, or public release

The goal is not to ask more questions all the time. The goal is to ask the
right question when an unresolved gap, tacit assumption, or high-stakes
commitment is about to become project memory.

## Philosophy

LongTable's simplest claim is:

> Help the researcher decide more slowly, more clearly, and more traceably.

That means LongTable should not rush to produce a polished answer when the
research problem itself is still unstable. It should first help the researcher
notice what is being assumed, what is missing, what is being committed, and what
will become hard to undo later.

Five short principles guide the system:

- **State before agents.** The center of LongTable is the research state: goals,
  blockers, open questions, decisions, evidence, and unresolved tensions. Agents
  are useful only when they improve that state.
- **Tension before synthesis.** Good research often needs disagreement before
  closure. LongTable should surface plausible objections before smoothing them
  into a single answer.
- **Questions before commitments.** When theory, method, measurement, evidence,
  or authorship choices are about to become settled, LongTable should ask a
  clear question instead of silently proceeding.
- **Trace before trust.** A decision is more useful when the researcher can see
  why it was made, what alternatives were considered, and what uncertainty
  remains.
- **Adapters are not the product.** Codex skills, Claude Code skills, and MCP
  are surfaces. The durable product contract is the `.longtable/`
  workspace and the researcher's recorded judgment.

In one sentence:

> LongTable is a thin but strict harness for protecting research judgment, not a
> larger machine for replacing it.

## What LongTable Gives You

- A durable `.longtable/` workspace for each research project
- A human-readable `CURRENT.md` status page regenerated from project state
- Provider-native Codex and Claude Code skills when you approve installation
- Researcher Checkpoints for decisions that should not be skipped silently,
  shown as UI prompts when the provider supports them and as numbered fallback
  text otherwise
- Focused follow-up questions for smaller tacit choices inside a task
- Perspective-based review from viewpoints such as reviewer, editor, methods critic,
  theory critic, measurement auditor, ethics reviewer, venue strategist, and
  voice keeper
- Panel, team, and debate modes that preserve visible disagreement before synthesis
- Optional MCP access to LongTable state for provider runtimes
- `doctor` and `status` commands for checking installation and workspace health

## Install

```bash
npm install -g @longtable/cli
```

The npm install only installs the `longtable` command. It does not write Codex
skills, Claude skills, MCP configuration, hooks, or provider runtime files.
Those require explicit setup approval.

Check the installed package:

```bash
npm list -g @longtable/cli --depth=0
which longtable
```

## The Recommended Flow

LongTable has two main setup steps:

1. `longtable setup` decides what LongTable is allowed to install.
2. `longtable start` creates or enters a research workspace.

### 1. Configure Runtime Support

For Codex:

```bash
longtable setup --provider codex
```

For Claude Code:

```bash
longtable setup --provider claude
```

`setup` asks permission-focused questions:

- Where may LongTable install runtime support?
- Which surfaces should be enabled?
- How strongly may LongTable interrupt research decisions?
- Should LongTable create a project workspace now?

Each option includes a short explanation of why the choice matters, what you
get, and the tradeoff. Setup intentionally avoids heavy researcher-profile
questions such as field, career stage, or weakest domain. Those should be
inferred later or asked only when the project context makes them relevant.

`longtable init` still exists as a deprecated compatibility alias, but new users
should use `longtable setup`.

### 2. Create A Project Workspace

```bash
longtable start
cd "<project-path>"
codex
```

For Claude Code:

```bash
longtable start
cd "<project-path>"
claude
```

`start` asks project-specific questions:

- What is the project called?
- Where should the project live?
- What is the current goal?
- What is the current blocker?
- What kind of research object are you working on?
- What kind of gap or tacit assumption risk is present?
- Which kind of decision should LongTable avoid skipping?
- Which perspectives should be consulted?
- How visible should perspective disagreement be?

This creates:

```text
<project>/
  AGENTS.md
  CURRENT.md
  .longtable/
    project.json
    current-session.json
    state.json
    sessions/
```

`AGENTS.md` gives runtime guidance to Codex or Claude. `CURRENT.md` is the
human-facing status page. The source of truth is the machine-readable state in
`.longtable/`.

### 3. Resume Later

```bash
cd "<project-path>"
longtable resume
codex
```

`resume` regenerates `CURRENT.md` from state and prints the current project
status.

## Everyday Use

Most LongTable work should happen in natural language inside the project
directory. Codex and Claude Code can expose LongTable through provider-specific
skills, but the research workflow should feel the same: say what you are trying
to decide, and let LongTable route the request to the right research
perspectives.

Natural language first:

```text
Help me narrow this into a defensible study.
Use the methods critic on this design.
Before I commit this argument, show me the disagreement.
Check whether this measurement construct is defensible.
What evidence would a reviewer expect here?
```

For larger tasks, the most useful pattern is to ask LongTable to coordinate
perspectives for you. In Codex, this may be an explicit `$longtable` skill
shortcut when your runtime exposes skills. In Claude Code, use the same wording
through `longtable`, `lt panel`, or the generated skill triggers.

```text
$longtable: deploy a research team to review this measurement plan, show the
main disagreements, and ask me what decision should be recorded before you
revise it.

$longtable: use editor, reviewer, methods, measurement, and voice perspectives
to evaluate this manuscript section. Do not collapse disagreement too early.

$longtable: debate the theory framework and measurement strategy, identify
unstated assumptions, and ask me what decision should be recorded before moving
forward.
```

This is the everyday LongTable path: ask for the work you need, and name the
kind of tension you want surfaced. LongTable should route the request, coordinate
the relevant perspectives, preserve disagreement, and create a Researcher
Checkpoint when the next step depends on your judgment.

Explicit LongTable directives are available when you want a clearer route into
the router:

```text
lt explore: help me narrow this research question
lt review: what is weak in this claim?
lt methods: where is this design vulnerable?
lt theory: does this framework overreach?
lt measurement: do these scales support the construct?
lt editor: how should I position this for a journal?
lt panel: show disagreement before I commit this argument
```

Provider skill shortcuts may also be available after setup. In Codex, explicit
skill entries may appear as `$longtable` or role-specific entries such as
`$longtable-editor`, depending on the runtime. In Claude Code, the generated
skills use trigger phrases such as `longtable`, `lt review`, `lt panel`,
`editor`, or `measurement auditor`. Do not treat any slash-command form as the
LongTable contract unless your provider explicitly exposes it.

## Researcher Checkpoints

A Researcher Checkpoint is a structured pause before LongTable treats a decision
as settled. For Codex users, UI Researcher Checkpoints are a core LongTable
feature, but they are active only when setup enables MCP plus checkpoint UI:

```bash
longtable setup --provider codex --surfaces skills_mcp --checkpoint-ui strong
```

When enabled and approved in Codex, LongTable uses MCP elicitation to show a UI
prompt for required decisions. The form should ask for the decision only;
rationale is optional project memory, not a second required field.

Good checkpoint shape:

```text
Researcher Checkpoint
Decision context: This measurement choice will shape the validity of the paper.
Question: What should LongTable treat as the next human decision?
Options:
1. Use an established instrument
2. Define a new construct
3. Keep both open until more evidence is reviewed
4. Other
Record: QuestionRecord -> DecisionRecord
```

LongTable may ask a checkpoint around:

- research-question narrowing
- theory choice
- measurement or instrument selection
- method or analysis design
- evidence and citation support
- authorship, voice, and researcher intent
- venue positioning
- submission, preregistration, or public sharing

Required checkpoints block ordinary `ask`, mode, panel, team, and debate work
until the researcher records a decision. That blocking behavior is intentional:
LongTable should not turn an unresolved research commitment into project memory.

The checkpoint should be concrete. Instead of asking "Why now?", LongTable
should name the decision at stake:

```text
Which measurement path should LongTable preserve before drafting the methods section?

1. Use the existing trust calibration scale
2. Compare two candidate instruments first
3. Define the construct before selecting a scale
4. Other
```

So the user-facing order is:

```text
natural request -> checkpoint UI when available -> numbered/CLI fallback when needed
```

## Focused Follow-up Questions

Not every pause deserves a blocking checkpoint. Some tasks contain several small
assumptions rather than one large decision. In that case LongTable should ask a
small set of focused follow-up questions and continue once the missing context
is recorded.

User-facing examples:

```text
Which audience should this revision optimize for?
Which construct definition should I keep visible while drafting?
Should LongTable prioritize speed, caution, or preserving alternatives here?
```

The CLI form is mainly for tests and plain terminal runs:

```bash
longtable clarify --prompt "Update the rubric using the selected exemplars."
```

Interactive surfaces should prefer structured UI. Plain text and non-interactive
contexts fall back to numbered options.

## Research Perspectives

Research perspectives are the viewpoints LongTable can bring into a decision.
They are not separate products and not separate personalities. Provider skills
are generated from these perspectives so Codex or Claude Code can foreground
one when the user's request calls for it.

Common perspectives:

| Perspective | What it checks |
| --- | --- |
| `reviewer` | likely peer-review objections and missing support |
| `editor` | venue fit, contribution shape, and framing |
| `methods_critic` | design logic and methodological defensibility |
| `measurement_auditor` | construct validity, scale choice, and evidence quality |
| `theory_critic` | conceptual coherence, anchor theory fit, and overreach |
| `ethics_reviewer` | consent, representation, IRB, and trust harms |
| `voice_keeper` | authorship, narrative trace, and the researcher's own voice |
| `venue_strategist` | journal or conference positioning tradeoffs |

Natural perspective requests:

```text
Reviewer view: what would a skeptical reviewer reject?
Editor view: is this positioned for the right journal?
Measurement auditor: do these measures support the construct?
Voice keeper: does this still sound like my argument?
```

If you want to inspect the installed registry, use:

```bash
longtable roles
```

That command is a discovery and debugging surface. Normal research use should
not require learning role ids first.

## Panel, Team, And Debate

Most users should ask for role disagreement in natural language. Shell commands
exist beside the natural form for scripts, tests, and reproducible debugging:

| Natural request | CLI equivalent |
| --- | --- |
| Use a LongTable panel to review this methods section before I commit it. | `longtable panel --prompt "Review this methods section." --json` |
| Use an agent team so the editor and measurement auditor inspect each other's concerns. | `longtable team --prompt "Review this measurement plan." --role editor,measurement_auditor --json` |
| Debate this theory framework and keep unresolved disagreement visible. | `longtable team --debate --prompt "Review this measurement plan." --role editor,measurement_auditor --json` |

- **Panel** is a fast multi-perspective review. It foregrounds role-specific
  objections before synthesis.
- **Team** is the default explicit agent-team path. Roles first review
  independently, then cross-review one another before coordinator synthesis and
  checkpoint.
- **Debate** is for deeper disagreement. It adds rebuttal and convergence
  rounds before the final checkpoint.

When the user explicitly asks for a team or debate, LongTable should route there
directly. When the request is less explicit, LongTable uses the checkpoint
classifier's stakes signal to choose the lightest adequate surface: panel for
ordinary multi-perspective disagreement, team for high-stakes cross-review, and
debate for external-facing or deeply contested choices.

LongTable records interaction depth so the output does not overclaim what
happened:

- `independent`: panel-style role outputs
- `cross_reviewed`: roles inspected another role's contribution
- `debated`: cross-review plus rebuttal and convergence

Team and debate results are written under `.longtable/team/<id>/`. They can
surface conflict, but the researcher still answers the final decision.

For user-facing guidance on which surface to choose, see
[`docs/AGENT-TEAM-README.md`](docs/AGENT-TEAM-README.md).

## Provider Adapters And Skills

LongTable can install provider-native skills after setup approval. These skills
are adapters generated from the shared LongTable perspective registry. They are
not the source of truth, and they are not a second role system.

Codex:

```bash
longtable setup --provider codex --install-scope user --surfaces skills --intervention balanced --workspace later
longtable codex install-skills
```

Claude Code:

```bash
longtable setup --provider claude --install-scope user --surfaces skills --intervention balanced --workspace later
longtable claude install-skills
```

After installation, reopen the provider if needed and use natural language:

```text
longtable: help me narrow this project
lt panel: review this methods section
use the LongTable methods critic on this design
```

If your Codex build exposes explicit skill shortcuts, `$longtable` is the manual
entry and role-specific shortcuts such as `$longtable-editor` may foreground one
perspective. Claude Code uses generated skill files under `~/.claude/skills`
with trigger phrases rather than a LongTable-specific slash-command contract.

Legacy Codex prompt files are not the recommended surface. Do not rely on
`/prompts`; current Codex builds may reject custom prompt files as slash
commands.

## MCP Transport

LongTable includes an optional MCP server named `longtable-state`.

MCP is not the source of truth. It gives compatible provider runtimes typed
access to existing LongTable state instead of scraping Markdown.

Inspect config snippets:

```bash
longtable mcp install --provider all
```

Write provider config:

```bash
longtable mcp install --provider codex --write
longtable mcp install --provider claude --write
```

Default config targets:

- Codex: `~/.codex/config.toml`
- Claude Code: `~/.claude/settings.json`

Run the server directly:

```bash
npx -y @longtable/mcp@0.1.29
longtable-state --self-test
```

Current MCP tools include:

- `read_project`
- `read_session`
- `inspect_workspace`
- `pending_questions`
- `evaluate_checkpoint`
- `create_question`
- `elicit_question`
- `render_question`
- `append_decision`
- `regenerate_current`

Codex UI Researcher Checkpoints are opt-in. To allow LongTable's MCP server to
surface form-style checkpoint prompts in Codex, use setup with MCP plus
checkpoint UI:

```bash
longtable setup --provider codex --surfaces skills_mcp --checkpoint-ui strong
```

For direct MCP configuration:

```bash
longtable mcp install --provider codex --checkpoint-ui strong --write
```

This enables Codex MCP elicitation approval in the selected Codex config. If
Codex does not support or allow elicitation, LongTable keeps the same
`QuestionRecord` pending and falls back to numbered checkpoint text plus
`longtable decide`.

When the MCP tool surface is available, LongTable skills should call
`elicit_question` first. `longtable question --print` is the CLI fallback for
clients that cannot show, accept, or approve MCP elicitation.

## Evidence And Scholarly Search

LongTable does not treat research search as generic web scraping. When research
claims, literature discovery, citation verification, or publication metadata
matter, `longtable search` routes the query through scholarly metadata sources,
normalizes results into evidence cards, deduplicates overlapping records, ranks
them, and labels citation-support depth.

Implemented scholarly routes include:

- Crossref
- arXiv
- OpenAlex
- Semantic Scholar
- PubMed/NCBI
- ERIC
- DOAJ
- Unpaywall

Some sources require local environment configuration. OpenAlex uses
`OPENALEX_API_KEY`; Unpaywall uses `LONGTABLE_CONTACT_EMAIL`; Semantic Scholar
and NCBI can use optional keys for more reliable or higher-rate access.

The important policy is claim-level support. A source can be useful background
while still failing to support the specific sentence attached to it.

```bash
longtable search --query "trust calibration measurement" --intent measurement --record
longtable search --query "does this citation support my claim?" --intent citation --source all --json
```

## Health Checks

Use `doctor` or `status` when something feels out of sync:

```bash
longtable doctor
longtable doctor --fix
longtable doctor --json
longtable status
```

These commands inspect:

- setup records
- provider runtime artifacts
- Codex and Claude skills
- MCP configuration
- current workspace state
- pending questions
- recent decisions

`--fix` repairs safe mechanical issues when setup approval already exists. It
does not invent permission. If setup is missing, run `longtable setup`.

## Command Reference

Primary commands:

```bash
longtable setup
longtable start
longtable resume
longtable doctor
longtable status
```

Research commands for explicit shell use:

```bash
longtable ask --prompt "..."
longtable explore --prompt "..."
longtable review --prompt "..."
longtable critique --prompt "..."
longtable draft --prompt "..."
longtable commit --prompt "..."
longtable panel --prompt "..."
longtable sentinel --prompt "..."
longtable search --query "..."
```

Natural-language and provider-skill use should usually come before these shell
routes. The shell routes are still useful for reproducible runs, tests, and
debugging.

Checkpoint commands:

```bash
longtable clarify --prompt "..."
longtable question --prompt "..."
longtable decide --answer <value>
```

Runtime and provider commands:

```bash
longtable team --prompt "..."
longtable team --debate --prompt "..."
longtable codex install-skills
longtable claude install-skills
longtable mcp install --provider all
longtable mcp install --provider codex --checkpoint-ui strong --write
```

Advanced and inspection commands:

```bash
longtable roles
longtable review --role methods_critic --prompt "..."
longtable codex persist-init --stdin
```

Legacy compatibility commands:

```bash
longtable init
longtable codex install-prompts
```

`init` remains a deprecated alias for `setup`. Codex prompt files are legacy;
provider skills are the preferred adapter surface.

## Workspace Files

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Runtime guidance for Codex or Claude inside the project |
| `CURRENT.md` | Human-readable current project status |
| `.longtable/project.json` | Stable project identity |
| `.longtable/current-session.json` | Current session cursor |
| `.longtable/state.json` | Layered working memory, tensions, questions, decisions, and invocations |
| `.longtable/sessions/` | Historical session snapshots |
| `.longtable/evidence/` | Recorded evidence search runs and evidence cards |
| `.longtable/team/<id>/` | Team or debate artifacts when team mode is used |

## Design Principles

- Researcher judgment stays primary; AI suggestions are support, not ownership.
- AI output should not silently become project truth.
- Gaps and tacit assumptions should be named when they matter, but not inflated
  into fake certainty.
- Disagreement should remain visible until the researcher resolves it.
- Checkpoints should interrupt commitments, not every conversation.
- Provider-specific tools are adapters; `.longtable/` state is the contract.
- Setup should ask for permissions, not a full biography.
- Project start should ask what research object and decision risk are active.

## Development

```bash
npm install
npm run build
npm run typecheck
npm run test
npm run pack:check
```

Useful release checks:

```bash
npm run release:check
git diff --check
```

## Documentation

- [Command Surface](docs/LONGTABLE-COMMAND-SURFACE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [MCP Transport](docs/MCP.md)
- [Question Runtime](docs/QUESTION-RUNTIME.md)
- [Checkpoint Triggering](docs/CHECKPOINT-TRIGGERING.md)
- [Researcher Checkpoints](docs/RESEARCHER-CHECKPOINTS.md)
- [Agent Team](docs/AGENT-TEAM-README.md)
- [Doctor Status](docs/DOCTOR.md)
- [Memory](docs/MEMORY.md)
- [Evidence Policy](docs/EVIDENCE-POLICY.md)
- [Research Search](docs/RESEARCH-SEARCH.md)
- [Release Process](docs/RELEASE-PROCESS.md)
