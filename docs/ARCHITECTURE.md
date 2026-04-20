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

## Layers

### 1. Core Layer

- domain objects
- state transitions
- checkpoint policy engine
- decision log model

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

### 4. Interaction Layer

- setup
- checkpoint prompts
- review mode
- submit mode

## Key Principle

Coordinator decides `what kind of research act is happening`; adapter decides `how the platform asks and records it`.
