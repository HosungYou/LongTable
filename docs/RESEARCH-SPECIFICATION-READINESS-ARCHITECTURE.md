# Research Specification Readiness Architecture

## Purpose

This document is the maintainable diagram source for the `$longtable-start` to
`$longtable-interview` handoff.

It exists because the product contract is simple but easy to scatter:

- `$longtable-start` creates or continues a Research Specification.
- `$longtable-interview` is post-start and option-first only after a usable
  Research Specification exists.
- First Research Shape is a handle and resume layer, not a substitute for the
  Research Specification.

The diagrams below are source diagrams, not exported illustrations. If a PNG or
slide image is needed, generate it from this Markdown/Mermaid source and do not
treat the exported image as canonical.

## Decision

LongTable should keep one shared Research Specification readiness gate. Provider
skills, MCP tools, CLI status, hooks, and docs should all use the same readiness
meaning.

The gate answers one question:

> Can this workspace safely move from research-start into structured follow-up
> interview?

The answer is not provider-specific. Codex, Claude, MCP, terminal prompts, and
future UI surfaces may present the result differently, but they must not define
different readiness semantics.

## Pipeline

```mermaid
flowchart TD
  UserInvocation["Researcher invocation"] --> Router["Provider skill or CLI router"]
  Router --> Start{"Requested surface"}

  Start -->|"$longtable-start"| StartInterview["Open research-start interview"]
  Start -->|"$longtable-interview"| ReadinessGate["Evaluate Research Specification readiness"]

  StartInterview --> DraftSpec["Create or update Research Specification draft"]
  DraftSpec --> Confirmation["Researcher confirmation checkpoint"]
  Confirmation -->|confirmed| PersistConfirmed["Persist confirmed Research Specification"]
  Confirmation -->|timeout or deferred| PersistDraft["Persist draft and explicit pending confirmation"]
  Confirmation -->|needs more detail| ContinueStart["Ask next start question"]

  PersistConfirmed --> State[".longtable state and current session"]
  PersistDraft --> State
  ContinueStart --> State

  ReadinessGate -->|usableForInterview true| StructuredInterview["Option-first follow-up interview"]
  ReadinessGate -->|usableForInterview false| RouteBack["Route back to research-start"]
  RouteBack --> StartInterview

  State --> Current["Regenerate CURRENT.md"]
  State --> ReadinessGate
```

## Readiness States

```mermaid
stateDiagram-v2
  [*] --> no_spec
  no_spec --> shape_only: First Research Shape saved
  no_spec --> structurally_incomplete: thin spec draft saved
  shape_only --> structurally_incomplete: spec draft started
  structurally_incomplete --> draft_pending_confirmation: required gaps closed
  draft_pending_confirmation --> confirmed: researcher confirms
  draft_pending_confirmation --> deferred: confirmation timeout or explicit defer
  deferred --> draft_pending_confirmation: confirmation resumed
  confirmed --> draft_pending_confirmation: material spec patch proposed
  confirmed --> [*]

  no_spec: No Research Specification exists
  shape_only: First Research Shape exists without substantive spec
  structurally_incomplete: Spec exists but required sections are missing
  draft_pending_confirmation: Spec is complete enough to review but not confirmed
  deferred: Confirmation is still owed and must be visible
  confirmed: Structured follow-up interview may proceed
```

`confirmed` is the normal unlock state for `$longtable-interview`.
`draft_pending_confirmation` and `deferred` are not silent failures. They are
valid saved states, but the next action must say that confirmation is pending.

## Entity Map

```mermaid
erDiagram
  WORKSPACE_STATE ||--o| LONGTABLE_SESSION : "has current"
  WORKSPACE_STATE ||--o{ QUESTION_RECORD : "tracks"
  WORKSPACE_STATE ||--o{ DECISION_RECORD : "records"
  WORKSPACE_STATE ||--o| RESEARCH_SPECIFICATION : "stores"
  WORKSPACE_STATE ||--o| FIRST_RESEARCH_SHAPE : "stores"

  LONGTABLE_SESSION ||--o| RESEARCH_SPECIFICATION : "references"
  LONGTABLE_SESSION ||--o| FIRST_RESEARCH_SHAPE : "references"
  LONGTABLE_SESSION ||--o{ OBLIGATION : "owes"

  RESEARCH_SPECIFICATION ||--|| READINESS_RESULT : "evaluated as"
  QUESTION_RECORD ||--o| DECISION_RECORD : "answered by"
  DECISION_RECORD ||--o| RESEARCH_SPECIFICATION : "may patch"
  CURRENT_MD ||--|| WORKSPACE_STATE : "renders from"

  WORKSPACE_STATE {
    string projectRoot
    string currentSessionPath
    string statePath
  }

  LONGTABLE_SESSION {
    string id
    string currentGoal
    string currentBlocker
    string nextAction
  }

  RESEARCH_SPECIFICATION {
    string title
    string status
    string purpose
    string confirmedAt
  }

  READINESS_RESULT {
    string status
    boolean exists
    boolean usableForInterview
    string[] blockingGaps
    string nextAction
  }

  QUESTION_RECORD {
    string id
    boolean required
    string hardStopScope
  }

  DECISION_RECORD {
    string id
    string selectedOption
    string rationale
  }

  OBLIGATION {
    string id
    string type
    string status
  }
```

## Shared Gate Contract

The shared readiness gate should return a small structured result:

```ts
type ResearchSpecificationReadiness = {
  exists: boolean;
  status:
    | "no_spec"
    | "shape_only"
    | "structurally_incomplete"
    | "draft_pending_confirmation"
    | "deferred"
    | "confirmed";
  structuralStatus: "missing" | "incomplete" | "complete";
  confirmationStatus: "not_applicable" | "pending" | "deferred" | "confirmed";
  usableForInterview: boolean;
  blockingGaps: string[];
  nextAction: "start" | "confirm_spec" | "resume_confirmation" | "interview";
};
```

Minimum gate meaning:

- No Research Specification means `$longtable-interview` routes to
  `$longtable-start`.
- First Research Shape without a Research Specification is still incomplete.
- A structurally thin specification must keep asking start questions.
- A complete draft without confirmation is saved, but it must surface a pending
  confirmation next action.
- Only a confirmed Research Specification unlocks normal option-first interview.

## Orchestration Boundary

```mermaid
flowchart LR
  Core["Core readiness semantics"] --> CLI["CLI status and command gates"]
  Core --> MCP["MCP summarize and confirm tools"]
  Core --> Hooks["Provider hooks"]
  Core --> Skills["Generated provider skills"]
  CLI --> State[".longtable state"]
  MCP --> State
  Hooks --> State
  Skills --> State
```

Core owns readiness semantics. Adapters own presentation. State remains the
source of truth.

## Maintenance Rule

Update this document when any change affects:

- what counts as a usable Research Specification
- the `$longtable-start` terminal states
- the `$longtable-interview` precondition
- confirmation timeout or deferral behavior
- the state fields used by the readiness gate

Every such change should also add or update a smoke test that proves the gate
and at least one user-facing route agree.
