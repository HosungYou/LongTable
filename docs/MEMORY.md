# Memory

## Memory Principle

Memory should preserve research continuity without turning every session into a bloated prompt.

## Core Layers

### Explicit State

Only user-confirmed facts and approved decisions.

Examples:

- target venue
- selected theory anchor
- approved methodology
- confirmed preferences

### Working State

The mutable task cursor for the active session.

Examples:

- current goal
- current blocker
- next action
- open questions
- active mode

Rule:

- working state is operational, not canonical truth
- it may change frequently without implying a durable commitment

### Inferred Hypotheses

System interpretations that are not yet confirmed.

Examples:

- user may prefer defensibility over novelty
- user may want stronger checkpointing around measurement

Each hypothesis must include:

- evidence
- confidence
- status

Rules:

- inferred hypotheses do not become explicit state without confirmation
- inferred hypotheses should decay or expire if they stop being useful

### Open Tensions

Unresolved tradeoffs that matter to the project.

Examples:

- novelty vs rigor
- agency vs assistance
- orchestration richness vs cost

Rule:

- tensions are preserved until they are explicitly resolved, not silently smoothed over

## Narrative Traces

Narrative traces are not a separate truth layer.

They preserve how human authorship is signaled across the research process.

Examples:

- a setup-time statement about what makes writing feel human
- a decision record that reveals the researcher’s judgment path
- a note that a specific lived experience should remain visible in prose

Important rule:

- narrative trace can be explicit or inferred
- inferred trace still remains an inference, not a fact

## Tacit Knowledge Policy

Tacit knowledge must not be written directly into explicit state.

Recommended handling:

- confirmed researcher commitments -> explicit state
- current operating context -> working state
- interpreted preference or style signal -> inferred hypotheses
- authorship cues and judgment path -> narrative traces
- unresolved philosophical conflict -> open tensions

This is the main defense against false certainty around tacit knowledge.

## Loading Policy

- always load explicit state summary
- always load working state summary
- load inferred hypotheses only when relevant
- load open tensions at commitment checkpoints
- keep human-facing resume artifacts short enough that a returning session can load them quickly

## Resume Artifact

The canonical human-facing root artifact is:

- `CURRENT.md`

It is a generated view, not the source of truth.

The canonical machine-readable files are:

- `.longtable/project.json`
- `.longtable/current-session.json`
- `.longtable/state.json`

## Update Policy

- `AGENTS.md` is stable runtime guidance and should rarely change
- `.longtable/current-session.json` is the primary session cursor and should be updated during work
- `.longtable/state.json` is the layered memory record and should be updated as the session evolves
- `.longtable/sessions/*.json` stores append-only historical snapshots
- `CURRENT.md` should be regenerated from machine-readable state rather than edited by hand

## Anti-Patterns

- dumping entire project history into every session
- promoting tacit interpretations directly into explicit facts
- using the human-facing artifact as the canonical state
- keeping multiple root resume files with overlapping roles
