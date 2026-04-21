# Lightweight Runtime Sentinel and Tmux Console

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

4. Tmux experience
   - `standard`: no tmux
   - `hud`: status/checkpoint/gap pane when tmux is available
   - `console`: research console with main pane, HUD pane, and team discussion
     support

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

## Tmux Console Model

Tmux is an enhanced research console, not the LongTable engine.

### Standard Chat Mode

Use provider-native chat and LongTable CLI commands. This is the default and the
most portable mode.

### Research HUD Mode

Open a small tmux pane with:

- project goal
- current blocker
- pending checkpoint count
- recent inferred hypotheses
- open tensions
- recent decision tail

### Research Console Mode

Open a tmux session with:

- main researcher pane
- HUD pane
- optional role panes for panel/team discussion
- coordinator pane that tells the researcher how to synthesize or continue

The first implementation may launch role-specific Codex wrapper runs in tmux
panes and write logs under `.longtable/team/<id>/`. Later versions can add a
second-stage automatic synthesis step over those logs.

## Non-Goals

- Do not make tmux mandatory.
- Do not make team mode the default.
- Do not hide provider config writes inside npm installation.
- Do not treat role/agent identity as the checkpoint source. Checkpoints remain
  tied to research commitment semantics.

## Release Scope

For the next patch release:

1. Add `longtable setup --provider codex` as a permission-first wrapper around
   existing setup/install surfaces.
2. Add `longtable sentinel --prompt ...` for explicit classifier checks and
   state notes.
3. Add `longtable hud --watch` and `longtable hud --tmux`.
4. Add `longtable team --tmux --prompt ...` to open role-specific research
   discussion panes.
5. Update README and release notes to clarify that npm install does not alter
   provider runtime state.
