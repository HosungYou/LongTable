# LongTable Command Surface

## Decision

The researcher-facing surface should center on two setup steps:

- `longtable setup`
- `longtable start`

After that, most work should continue in natural language from inside the
project directory.

## Why

The earlier surface was too developer-centered:

- `--prompt`
- `--role`
- `--panel`
- provider-specific hidden commands

Those options remain useful for debugging, scripting, and reproducible tests,
but they should not be the main mental model for researchers.

LongTable's primary surface should answer three questions:

1. What runtime permissions has the researcher approved?
   Use `longtable setup`.
2. What project is starting now?
   Use `longtable start`.
3. Where does the work continue?
   Open Codex or Claude Code inside the generated project directory.

## Current Primary Surface

- `longtable setup`
- `longtable start`
- `longtable resume`
- natural in-session forms such as `lt explore: ...`, `lt review: ...`, and
  `lt panel: ...`

Supporting surfaces:

- `longtable roles`
- `longtable ask`
- `longtable question`
- `longtable decide`
- `longtable panel`
- `longtable search`
- `longtable codex install-skills`
- `longtable claude install-skills`

The important distinction is:

- `setup` and `start` are shell setup commands
- Codex or Claude Code is opened inside the project directory
- the actual research conversation should then proceed in natural language

## Surface Roles

### `longtable setup`

Global setup:

- provider
- install scope
- runtime surfaces
- intervention level
- project workspace preference

`longtable init` remains a deprecated compatibility alias and should not be
documented as the primary researcher path.

### `longtable start`

Project start interview:

- project name
- project path
- current goal
- current blocker
- research object
- gap/tacit risk
- protected decision
- requested perspectives
- disagreement visibility

It creates:

- project directory
- `.longtable/project.json`
- `.longtable/current-session.json`
- `.longtable/state.json`
- `.longtable/sessions/`
- project `AGENTS.md`
- `CURRENT.md`

### `longtable ask`

Direct natural-language assistance inside an existing project directory.

If the prompt contains an explicit collaboration directive such as
`lt panel: ...`, `lt team: ...`, or `lt debate: ...`, `ask` delegates to the
matching panel, team, or debate path. If the request is less explicit but asks
for multiple perspectives, LongTable uses checkpoint classifier stakes to route
to the lightest adequate surface: panel for ordinary role disagreement, team for
high-stakes cross-review, and debate for external-facing or deeply contested
choices.

Short forms such as `lt explore: ...`, `lt review: ...`, and `lt methods: ...`
are based on the LongTable directive parser and role router. They are not
separate agent source files. Codex and Claude skills can expose the same natural
language surface when installed.

If the workspace has a required pending Researcher Checkpoint, `ask` is blocked
until `longtable decide` records an answer.

When a project prompt contains tacit choices, `ask` first asks focused
follow-up questions. In an interactive terminal, LongTable uses selector UI and
records answers immediately. In non-interactive contexts, it records pending
required questions and prints the questions so the researcher can answer with
`longtable decide`.

### `longtable clarify`

Creates focused follow-up questions from task context:

```bash
longtable clarify --prompt "Update the rubrics using the selected best submissions."
longtable clarify --provider codex --print --prompt "Check LongTable question UX."
```

The command detects knowledge gaps that LongTable should not infer silently,
creates one `QuestionRecord` per gap, marks recommended options, and prefers the
most convenient renderer available:

- native structured question UI when the provider reliably exposes it
- terminal selector UI in the CLI
- numbered checkpoint fallback for non-interactive or plain-text surfaces

### `longtable question`

Writes a pending Researcher Checkpoint from natural-language decision context:

```bash
longtable question --prompt "We are about to finalize the measurement plan."
longtable question --provider codex --print --prompt "We are about to finalize the measurement plan."
longtable question --provider claude --print --prompt "We are about to finalize the measurement plan."
```

The command uses the shared checkpoint trigger classifier. It records:

- checkpoint key
- question text
- options
- required/advisory posture
- rationale
- preferred provider surfaces

Required questions block normal `ask`, mode, panel, team, and debate commands
until answered.
`--print` renders the provider transport without asking the researcher to know
provider internals.

### `longtable decide`

Answers a pending Researcher Checkpoint and appends a `DecisionRecord`:

```bash
longtable decide --question <id> --answer evidence --rationale "Need citation support before continuing."
```

If no question id is supplied, LongTable answers the most recent pending
question.

### `longtable panel`

Structured multi-role review.

In the current architecture, `panel` does not require native subagents or Claude
skills:

- creates a `PanelPlan`
- creates a provider-neutral `InvocationIntent`
- uses `sequential_fallback` as the stable execution surface
- exposes planned `PanelResult` through `--json`
- exposes the provider runtime prompt through `--print`
- appends an `InvocationRecord` when run inside a LongTable workspace
- creates a follow-up `QuestionRecord`
- links the later `DecisionRecord` after `longtable decide`

Examples:

```bash
longtable panel --prompt "review this methods section" --json
longtable review --role methods_critic,measurement_auditor --panel --prompt "review this methods section" --json
longtable decide --answer evidence --rationale "Need citation support before continuing."
```

### `longtable team`

File-backed agent-team review. The default `team` path is not only parallel role
listing; it records independent review, cross-review, and a coordinator
synthesis/checkpoint.

Examples:

```bash
longtable team --prompt "review this measurement plan" --role editor,measurement_auditor --json
longtable team --debate --prompt "debate this study design" --role theory_critic,methods_critic --json
```

`team --debate` adds rebuttal and convergence rounds. See
`docs/AGENT-TEAM-README.md` for user-facing guidance and
`docs/TEAM-DEBATE-ORCHESTRATION.md` for the artifact contract.

### `longtable search`

Scholar-first evidence search for literature discovery, citation checking,
publication metadata, and research decisions that need external support.

Examples:

```bash
longtable search setup
longtable search doctor --json
longtable search probe --doi "10.1016/example" --publisher elsevier
longtable search --query "trust calibration measurement" --intent measurement
longtable search --query "trust calibration measurement" --publisher-access --json
longtable search --query "trust calibration citation support" --intent citation --record
```

The command routes to scholarly metadata sources, normalizes results as
evidence cards, deduplicates and ranks them, and optionally records the run
under `.longtable/evidence/`. Missing credentials block non-interactive full
router runs unless `--allow-partial` is supplied.

`search setup`, `search doctor`, and `search probe` configure publisher access
without storing secrets. They read environment variables for Elsevier, Springer
Nature, Wiley, and Taylor & Francis, verify DOI entitlement where possible, and
store only non-secret capability status under `~/.longtable/search-capabilities.json`.

### `longtable roles`

Lists the research perspectives LongTable can consult.

## Provider Adapter Installation

Codex:

```bash
longtable codex install-skills
```

This generates Codex `SKILL.md` files under `~/.codex/skills/longtable-*`.
When an explicit trigger is needed, use the installed `$longtable` skill entry
if the current Codex build exposes skills that way. `/prompts` is not a stable
LongTable product surface because some Codex builds do not expose custom prompt
files as slash commands.

Claude Code:

```bash
longtable claude install-skills
```

This generates Claude Code `SKILL.md` files under `~/.claude/skills/longtable-*`.
The provider surface may look OMC-like, but role definitions are generated from
LongTable's shared registry.

### `longtable resume`

Regenerates `CURRENT.md` from machine-readable state and prints the current
workspace status.

## Non-Goals

The primary LongTable path is not:

- `/prompts:longtable`
- `longtable review --prompt ... --role ...` as the default user experience
- native provider subagent execution as the only panel path

Those surfaces may exist, but they should remain supporting paths rather than
the onboarding model.
