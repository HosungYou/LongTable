# Team Dispatch Bypass: Checkpoint + Agent Teams Coexistence

**Date**: 2026-03-26 (revised 2026-03-29)
**Status**: Implemented (v11.2)
**Author**: Hosung You
**Relates to**: `2026-03-19-orchestrator-redesign.md`

---

## Problem Statement

The checkpoint system (prereq-enforcer.mjs) assumes a linear research lifecycle where
decisions are made sequentially (RQ -> paradigm -> design -> analysis). Agent Teams assume
parallel execution where independent experts evaluate the same artifact simultaneously.

When Agent Teams dispatch multiple agents for manuscript review, non-entry-point agents
are hard-blocked because:
1. No `diverga.db` exists (the manuscript was not created through Diverga)
2. REQUIRED checkpoints (CP_RESEARCH_DIRECTION, CP_METHODOLOGY_APPROVAL) were never
   explicitly completed via AskUserQuestion

This is not a bug in either system. The orchestrator's dispatch decision itself serves
as the checkpoint. When the user approves a team composition, individual agent
prerequisite checks are redundant.

---

## Solution: DIVERGA_TEAM_DISPATCH Flag

A single flag that bypasses prerequisite enforcement for orchestrator-approved dispatches.

### How It Works

```
Ad-hoc call:  user -> /diverga:e1  ->  hook enforces prerequisites  ->  may block
Team dispatch: user approves team  ->  orchestrator dispatches with flag  ->  hook bypasses
```

### Implementation

**prereq-enforcer.mjs** (v11.2): After identifying a diverga agent, check for the flag
before any prerequisite logic:

```javascript
const prompt = toolInput.prompt || '';
if (process.env.DIVERGA_TEAM_DISPATCH === '1' ||
    prompt.includes('DIVERGA_TEAM_DISPATCH=1')) {
  return { continue: true };
}
```

Two detection paths:
- **Env var**: For testing or manual override (`DIVERGA_TEAM_DISPATCH=1 claude`)
- **Prompt marker**: For runtime dispatch (orchestrator includes it in agent prompt)

**research-orchestrator/SKILL.md**: When dispatching agent teams, include the marker
in the first line of the agent prompt:

```
Agent(
    subagent_type="diverga:e1",
    prompt="DIVERGA_TEAM_DISPATCH=1\n\n[actual task prompt...]"
)
```

### When to Use

- Orchestrator-approved parallel dispatch (manuscript review, multi-agent evaluation)
- VS Arena debates (V1-V5 persona agents)
- Pipeline fan-out (I0 dispatching I1 instances)

### When NOT to Use

- Ad-hoc single agent calls from the user
- Sequential pipeline stages that need checkpoint gates between them

---

## Design Rationale

### Why Not Execution Contexts?

An earlier design proposed 5 execution contexts (research, review, revision, consultation,
pipeline) with per-context enforcement policies, new DB tables, and new MCP tools.

This was overengineered. The core insight:

> The orchestrator's dispatch decision IS the checkpoint. When the user approves
> "deploy this team for review," that approval subsumes individual agent prerequisites.

The simple flag covers the same scenarios without additional complexity:

| Scenario | 5-Context System | Simple Flag | Difference |
|----------|-----------------|-------------|------------|
| Team manuscript review | review context | team flag | Same result |
| Pipeline fan-out (I0) | pipeline context | team flag | Same result |
| Ad-hoc agent call | context needed | existing hook | Same result |
| Revision response | revision context | DB has checkpoints | DB already works |
| Consultation | consultation context | use entry-point agents | Equivalent |

### What Stays the Same

- Checkpoint enforcement for ad-hoc agent calls (unchanged)
- REQUIRED checkpoint hard-block behavior (unchanged)
- Entry-point agent bypass (unchanged)
- AskUserQuestion protocol (unchanged)
- SQLite state persistence (unchanged)

---

## Files Changed

| File | Change |
|------|--------|
| `hooks/prereq-enforcer.mjs` | Added team dispatch bypass check (v11.1 -> v11.2) |
| `skills/research-orchestrator/SKILL.md` | Added Team Dispatch Bypass section |

---

## Future Considerations

If new scenarios emerge that the simple flag cannot handle, consider:
- Per-agent `context_exempt` field in the prerequisite map
- Execution context as a lightweight enhancement (not the full 5-context system)
- Orchestrator pre-seeding checkpoints with `completion_source: 'inferred'`

These should only be implemented when a concrete need arises, not preemptively.
