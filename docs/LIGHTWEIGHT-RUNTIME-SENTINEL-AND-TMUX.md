# Lightweight Runtime Sentinel and Tmux Team Console

## Decision

LongTable should work without tmux, native hooks, MCP, or a team runtime. Those
surfaces are optional upgrades over the same research contract:

- protect research judgment
- expose tacit assumptions and knowledge gaps
- keep decisions traceable
- ask only when a research commitment is being made

`npm install -g @longtable/cli` should install the CLI only. It should not write
provider files, Codex skills, MCP config, hooks, or tmux state without explicit
researcher approval. Skills are also runtime files under provider-owned
directories, so they belong in setup approval rather than npm postinstall.

## Setup Model

`longtable setup --provider codex` should become the recommended first command.
It asks technical permission questions before researcher-personalization
questions.

### Required Permission Questions

1. Runtime scope
   - `cli_only`: install nothing into provider runtime
   - `user`: write user-level provider support files
   - `project`: write project-level support files when supported

2. Provider surfaces
   - `skills`: generated LongTable skills
   - `mcp`: LongTable state MCP transport
   - `sentinel`: lightweight background/advisory prompt sentinel

3. Intervention posture
   - `advisory`: surface gap/tacit warnings without blocking
   - `balanced`: block only clear research commitments
   - `strong`: ask more often at theory, measurement, method, evidence, and
     authorship boundaries

4. Codex checkpoint UI
   - `off`: numbered checkpoints and terminal selectors only
   - `interactive`: use MCP elicitation UI for required Researcher Checkpoints
     when Codex supports it
   - `strong`: same UI transport, with high checkpoint intensity

5. Team discussion mode
   - `off`: no team runtime
   - `panel`: structured single-session panel only
   - `tmux_team`: role panes plus coordinator pane for research debate

Each setup option must show why it matters and what tradeoff it introduces.

## Sentinel Model

The sentinel is not a generic keyword detector. It classifies natural-language
research turns into a small set of intervention signals:

- measurement commitment
- theory commitment
- method or design commitment
- analysis-plan commitment
- evidence or citation gap
- tacit assumption risk
- authorship or narrative-trace risk
- submission or public-sharing risk

The output policy is:

```text
no action -> silent state note -> advisory nudge -> one clarifying question -> blocking checkpoint
```

The default setup recommendation is `advisory`. Blocking behavior should require
either project checkpoint intensity or an explicit setup choice.

## Tmux Team Console Model

Tmux is an optional team review console, not the LongTable engine.

### Standard Chat Mode

Use provider-native chat and LongTable CLI commands. This is the default and the
most portable mode.

### Research Console Mode

Open a tmux session with:

- main researcher pane
- optional role panes for panel/team discussion
- coordinator pane that tells the researcher how to synthesize or continue

The first implementation launches role-specific panes and writes logs under
`.longtable/team/<id>/`. The debate implementation adds a file-backed five-round
protocol so synthesis and Researcher Checkpoints are durable even when tmux is
not available.

## Researcher Checkpoint Trigger Points

LongTable should interrupt only at research-responsibility boundaries, not on a
generic keyword timer. The default trigger points are:

- a named knowledge gap before narrowing, recommending, or closing exploration
- a tacit or implicit assumption before accepting a framing, critique, or plan
- a theory, method, measurement, or analysis-plan commitment
- a claim whose evidence or citation support is uncertain
- a draft operation that may erase the researcher's authorship trace
- submission, release, public sharing, IRB, or preregistration
- product/checkpoint-policy changes that affect future LongTable behavior

The transport policy is layered:

```text
state note -> advisory nudge -> rendered question -> MCP/UI elicitation -> blocking decision
```

MCP/UI elicitation is allowed only when the provider exposes that capability and
the researcher has opted in to Codex MCP elicitation approval. Otherwise the
same QuestionRecord must remain visible through numbered fallback and
`longtable decide`.

## Non-Goals

- Do not make tmux mandatory.
- Do not make team mode the default.
- Do not keep a persistent HUD as a default or recommended research surface.
- Do not hide provider config writes inside npm installation.
- Do not treat role/agent identity as the checkpoint source. Checkpoints remain
  tied to research commitment semantics.

## Release Scope

For the next patch release:

1. Add `longtable setup --provider codex` as a permission-first wrapper around
   existing setup/install surfaces.
2. Add `longtable sentinel --prompt ...` for explicit classifier checks and
   state notes.
3. Add `--checkpoint-ui off|interactive|strong` so Codex users can opt in to
   MCP elicitation UI for Researcher Checkpoints.
4. Remove the persistent HUD command surface; use `status`, `doctor`,
   `CURRENT.md`, and pending checkpoint tools for visibility.
5. Add `longtable team --tmux --prompt ...` to open role-specific research
   discussion panes.
6. Add `longtable team --debate --prompt ...` for file-backed five-round debate.
7. Update README and release notes to clarify that npm install does not alter
   provider runtime state.
