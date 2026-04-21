# Architecture

## Goal

Refactor LongTable from a Claude-centered plugin architecture into a provider-neutral research harness.

## Architectural Shift

### Before

- agent-first
- provider-specific
- checkpoint tied to agent prerequisites
- heavy always-on context

### After

- state-first
- provider-neutral core
- checkpoint tied to commitment semantics
- lightweight persistent context + retrieval
- panel orchestration as structured role consultation, not long-running team management

## Layers

### 1. Core Layer

- domain objects
- state transitions
- checkpoint policy engine
- Researcher Checkpoint contract
- decision log model
- invocation intent model
- panel plan/result model
- provider capability model

### 2. Memory Layer

- explicit state
- working state
- inferred hypotheses
- open tensions
- artifact provenance

### 3. Adapter Layer

- Claude adapter
- Codex adapter
- future web app adapter
- provider-specific role or prompt surfaces generated from shared contracts

### 4. Interaction Layer

- setup
- Researcher Checkpoint prompts
- review mode
- submit mode
- panel mode

### 5. Transport Layer

- optional MCP tools
- provider runtime configuration
- generated prompt or skill files
- state read/write integration

Transport does not own LongTable semantics. It exposes shared package behavior to a provider runtime.

The first MCP transport is `longtable-state` in `@longtable/mcp`. It exposes
workspace inspection, checkpoint evaluation, question creation/rendering,
decision append, and `CURRENT.md` regeneration over the existing `.longtable/`
state contract.

## Key Principle

Coordinator decides `what kind of research act is happening`; adapter decides `how the platform asks and records it`.

For questions, this means LongTable owns the Researcher Checkpoint semantics.
Claude, Codex, MCP, or a future web app only decide whether the checkpoint is
rendered as native structured UI, numbered choices, terminal selector, or form.

## Panel Orchestration

Panel orchestration is the LongTable-native answer to multi-perspective agent work.

It is narrower than OMX Team Orchestration:

- no worker queue
- no mailbox protocol
- no tmux panes
- no heartbeat or shutdown lifecycle
- no agent identity as checkpoint source

The panel coordinator builds a `PanelPlan`, obtains role outputs, and returns a `PanelResult`.

Provider adapters may execute the plan differently:

- Codex may use native subagents when available.
- Claude Code may use generated skills or native task surfaces when available.
- Both providers must support a sequential fallback path.

The researcher should be able to inspect the panel result technically through structured records:

- role selected
- role output summary
- evidence or file references when applicable
- disagreement with other roles
- provider surface used
- fallback or native execution mode
- linked checkpoint or question record

This is not a promise to expose raw hidden reasoning. LongTable inspectability means auditable structured outputs and decision records.

## Question Layer

The question layer is not a chat habit. It is a state transition.

```text
commitment risk
  -> Researcher Checkpoint
  -> QuestionRecord
  -> provider-rendered question surface
  -> DecisionRecord
  -> refreshed CURRENT.md
```

This is where LongTable differs from directly using a provider's AskUserQuestion
tool. The native tool may render the question, but LongTable decides when the
question is required, what options are valid, and how the answer changes project
state.
