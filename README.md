# LongTable

LongTable is a researcher-centered workspace for long scholarly projects. It
helps a researcher keep research questions, construct boundaries, method
choices, evidence standards, authorship judgments, and open tensions traceable
across AI-assisted sessions.

LongTable is not a chatbot replacement and not a prompt collection. It is a
small research workspace system that runs through a CLI, provider skills,
optional MCP state and checkpoint transport, and panel collaboration records.

LongTable also exposes a narrow Codex hard-stop guard: unresolved Research
Specification blockers can block session stop until the researcher decides,
clears, or explicitly defers them. Product, setup, documentation, release, and
hook-engineering prompts are not hard-stop blockers by default.

Codex, Claude Code, and other providers remain the execution environments.
LongTable provides the durable research state, generated provider skills,
Researcher Checkpoints, and command-line tools that keep important decisions
from disappearing into chat history.

## Core Workflow

Use one shell setup step and one provider-native research-start step.

```bash
npm install -g @longtable/cli
longtable setup --provider codex
cd "<research-folder>"
codex
```

Inside the provider, start the project with:

```text
$longtable-start
```

Run pressure interviews with the LongTable grilling surface:

```text
$longtable-interview
```

Required routing:

- `$longtable-start` is the research-start surface.
- `$longtable-interview` is the grilling interview surface.
- It does not require a Research Specification before asking the next pressure
  question.
- It frames each turn as `Tension:` followed by one `Pressure question:` and
  waits for a direct answer.
- If only a First Research Shape exists, LongTable continues through
  `$longtable-start` until a Research Specification is created or explicitly
  kept open.

`longtable start` remains a shell fallback for scripts and automation. It is not
the main research-start experience.

## What Gets Created

A LongTable workspace lives in the research project folder:

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

- `AGENTS.md`: provider runtime guidance for this research workspace
- `CURRENT.md`: human-readable current state, regenerated from LongTable state
- `.longtable/project.json`: stable project identity
- `.longtable/current-session.json`: current session cursor
- `.longtable/state.json`: layered memory, questions, decisions, interview
  turns, evidence records, First Research Shape, and Research Specification
- `.longtable/sessions/`: session snapshots

## Start vs Interview

`$longtable-start` asks open, natural-language questions. It should not begin
with a questionnaire, reader/reviewer contribution framing, or fixed
theory/method/measurement categories. It asks one question at a time, records
turns when MCP/state tools are available, and creates the durable Research
Specification when the interview has enough material.

The First Research Shape is only a short handle for resuming early work. The
substantive artifact is the Research Specification. It should preserve scope,
construct ontology, theory framing, coding and measurement rules, method
options, evidence and access requirements, epistemic alignment, protected
decisions, open questions, next actions, and confidence.

`$longtable-interview` is a relentless sharpening interview for a research plan,
argument, method, manuscript, evidence standard, or product decision. It inspects
`CURRENT.md`, `.longtable/`, supplied documents, and cited evidence first when
those can answer the question. Then it names `Tension:` and asks one
`Pressure question:`.

The interview continues only while the next question can produce a new decision,
sharper boundary, stronger evidence standard, or clearer open tension. It stops
when remaining questions repeat the same tension without producing a new
decision. `$longtable-interview` is the only packaged pressure-interview skill;
legacy `$critical-interview` skill folders are removed during skill install.

Multiple interviews append to the same workspace state. A later interview may
propose or apply a Research Specification patch, append a DecisionRecord, or
record an open tension. It should not silently overwrite conflicting research
commitments.

## Question UI

LongTable owns the question semantics. Providers own presentation.

The durable lifecycle is:

```text
Researcher Checkpoint -> QuestionRecord -> DecisionRecord
```

Supported transports:

- MCP/native structured elicitation when the provider exposes it
- terminal selector when the CLI has interactive TTY input and output
- numbered/plain-text fallback everywhere else

Tmux is not required for LongTable core behavior. If a future Codex terminal
popup borrows an OMX-style tmux renderer, it must be documented as an optional
Codex transport that requires an attached tmux session and falls back to the
standard LongTable question path.

## Common Commands

```bash
longtable setup --provider codex
longtable doctor
longtable status --cwd "<project-path>"
longtable resume --cwd "<project-path>"
longtable roles
longtable question --prompt "<decision context>"
longtable decide --question <id> --answer <value>
longtable spec read --cwd "<project-path>"
longtable search --query "<topic>"
longtable panel --prompt "review this measurement plan" --json
```

Provider skill installation is explicit:

```bash
longtable codex install-skills
longtable claude install-skills
longtable mcp install --provider all
```

## Panel Collaboration

Panel is LongTable's public collaboration surface. Use it when role disagreement
matters before a research commitment becomes project memory.

```text
$longtable: run a panel review of this measurement plan, keep disagreement
visible, and ask me what decision should be recorded before revising it.

lt panel: show theory, methods, measurement, reviewer, and voice disagreements
before I commit this argument.
```

Scriptable equivalents:

```bash
longtable panel --prompt "review this measurement plan" --role editor,measurement_auditor --json
longtable panel --visibility always_visible --prompt "keep unresolved disagreement visible" --json
longtable ask --prompt "lt debate: debate this study design before I commit" --json
```

Team-style requests route through panel. Explicit debate-language requests
write panel debate records under `.longtable/panel/`. LongTable team execution
is disabled for new work, and `.longtable/team/` is historical state only.

## Journal Editor and Venue Fit

`longtable-editor` is intentionally a thin role adapter. It foregrounds the
Journal Editor perspective and must disclose `LongTable consulted: Journal
Editor`, but it is not allowed to invent knowledge about a named target journal.

If a target journal is named, LongTable should not claim journal fit from role
intuition alone. A fit judgment needs a journal profile: aims/scope, author
guidance, recent article patterns, and article type expectations. Without that
profile, the editor judgment should either ask whether to run scholarly/venue
search or label fit as provisional.

Useful command surfaces:

```bash
longtable review --role editor --prompt "Evaluate this manuscript positioning."
longtable panel --role editor,reviewer --prompt "Compare journal fit and reviewer risk."
longtable search --intent venue --query "<journal or venue context>"
longtable scholar-research scaffold --cwd "<project-path>" --json
```

Treat journal fit as a risk rubric, not an acceptance prediction. A useful
editor pass separates scope fit, contribution fit, method/evidence norm fit,
editorial salience, and citation/evidence risk, and marks unsupported claims as
provisional.

## Researcher Checkpoints

LongTable asks and waits when a research commitment is about to become settled:

- research question or scope
- theory frame or construct map
- measurement, coding, or extraction standard
- method design or analysis strategy
- evidence access or citation standard
- authorship, voice, submission, or public-sharing decision

For low-risk, reversible, or presentational choices, LongTable should proceed
with explicit assumptions instead of interrupting.

## Development

```bash
npm ci
npm run build
npm run test
npm run release:check
```

Useful smoke checks:

```bash
npm run smoke:setup
npm run smoke:checkpoints
npm run smoke:hooks
npm run smoke:research-spec-audit
npm run smoke:question-audit
npm run pack:check
```

## Release

LongTable packages are version-aligned under `@longtable/*`.

Before publishing:

```bash
npm run release:check
git diff --check
```

After publishing, verify the registry:

```bash
npm view @longtable/cli version dist-tags --json
npm view @longtable/mcp version dist-tags --json
npm install -g @longtable/cli@<version>
longtable --help
```

Actual npm publish and GitHub release creation require explicit release
authority. Local implementation and verification can be completed before that
external step.

## Codex Stop hard-stop

LongTable Codex hooks now expose a narrow hard-stop verdict. `Stop` blocks only
Research Specification-affecting pending questions or obligations, while
product/tooling/docs/release work remains non-blocking unless explicitly marked
as a hard-stop research decision. `PostToolUse` stays quiet for no-op Bash and no
longer hard-blocks unrelated nonzero Bash failures.

Inspect the current verdict with `longtable codex hook-doctor --json` or
`longtable doctor --json`; both report hook coverage/trust, `stopWouldBlock`,
`activeBlockers`, stale pending-question counts, and next actions.
