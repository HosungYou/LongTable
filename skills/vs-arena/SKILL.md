---
name: vs-arena
description: VS Arena - Multi-agent methodology debate with epistemological personas
version: "11.1.2"
---

# VS Arena — Multi-Agent Methodology Debate

**Skill ID**: vs-arena
**Version**: 11.1.0
**Purpose**: Replace single-agent VS with genuine multi-agent diversity through epistemological persona debate

## Overview

VS Arena dispatches 3 methodology experts with distinct epistemological commitments to independently recommend research methodologies. Unlike classic VS (where one agent generates 3 options), VS Arena uses physically separate agents with `cannotRecommend` constraints that force genuinely divergent search spaces.

**Academic basis**:
- "More agents is less" (arxiv:2602.03794) — 2 diverse agents > 16 homogeneous
- Persona-based differentiation improves collective output (arxiv:2410.12853)
- Constraint-based exclusion > positive persona framing (arxiv:2511.11789)

---

## 6-Stage Process

### Stage 1: Context Collection

Gather research context using the Diverga memory system:

```
Required context:
- research_question: [from CP_RESEARCH_DIRECTION or user input]
- paradigm: [from CP_PARADIGM_SELECTION or user input]
- research_field: [e.g., Education, Psychology, HRD]
- target_journal: [if available]
- key_variables: [if available]
```

Use `diverga_project_status` to read existing context. If missing, use AskUserQuestion to collect.

### Stage 2: Persona Selection

Select 3 of 5 personas based on research question signals:

| Persona | ID | Best When |
|---------|-----|-----------|
| Post-Positivist | V1 | Causal questions, measurement, generalization needed |
| Critical Theorist | V2 | Power dynamics, equity, social justice focus |
| Pragmatist | V3 | Applied problems, "what works" questions |
| Interpretivist | V4 | Meaning-making, lived experience, understanding |
| Transformative | V5 | Marginalized populations, participatory, social change |

**Selection rules**:
- Always include at least one persona whose paradigm differs from CP_PARADIGM_SELECTION
- If paradigm is "quantitative": include V1 + V4 + one of V2/V3/V5
- If paradigm is "qualitative": include V4 + V1 + one of V2/V3/V5
- If paradigm is "mixed": include V3 + two of V1/V2/V4/V5
- If no paradigm set: include V1 + V3 + V4 (maximum paradigmatic spread)

### Stage 3: Parallel Dispatch

Spawn 3 Task agents in background with persona-specific prompts:

```
For each selected persona (e.g., V1, V3, V4):

Task(
  subagent_type="diverga:v{N}",
  model="opus",
  run_in_background=true,
  prompt="""
  Research context:
  - Question: {research_question}
  - Field: {research_field}
  - Paradigm: {paradigm}
  - Variables: {key_variables}
  - Target journal: {target_journal}

  Read your persona definition in agents/v{N}.md.
  Read config/personas.json for your cannotRecommend constraints.
  Provide exactly ONE methodology recommendation following your output format.
  """
)
```

Wait for all 3 to complete before proceeding.

### Stage 4: T-Score Calibration

For each recommendation, cross-validate the T-Score:

1. Read the recommended methodology name
2. If `journal_search_by_field` MCP tool is available:
   - Search OpenAlex for methodology frequency in the research field
   - Adjust T-Score based on actual publication frequency
3. If not available, use the persona's self-reported T-Score range

### Stage 5: Cross-Critique (Optional)

If `vs_arena.cross_critique` is enabled in `diverga-config.json`:

For each persona, send the other two recommendations via `diverga_message_send`:

```
diverga_message_send(
  from="v1",
  to="v2",
  message="Critique this recommendation from your perspective: [V2's recommendation]"
)
```

Each persona writes a 2-3 sentence critique of each other recommendation. Include critiques in the final presentation.

### Stage 6: Presentation

Present all 3 recommendations via AskUserQuestion (CHECKPOINT: CP_METHODOLOGY_APPROVAL):

```
## VS Arena: Methodology Recommendations

### Option A: [V1 Post-Positivist Recommendation]
**Methodology**: [name]
**T-Score**: [score] (calibrated)
**Rationale**: [brief]
[Cross-critique from V3 and V4 if enabled]

### Option B: [V3 Pragmatist Recommendation]
**Methodology**: [name]
**T-Score**: [score] (calibrated)
**Rationale**: [brief]
[Cross-critique from V1 and V4 if enabled]

### Option C: [V4 Interpretivist Recommendation]
**Methodology**: [name]
**T-Score**: [score] (calibrated)
**Rationale**: [brief]
[Cross-critique from V1 and V3 if enabled]

Which methodology would you like to proceed with? (A/B/C)
```

WAIT for user selection. Record decision via `diverga_mark_checkpoint`.

---

## Configuration

VS Arena is configured in `config/diverga-config.json`:

```json
{
  "vs_arena": {
    "enabled": false,
    "team_size": 3,
    "cross_critique": false
  }
}
```

Enable via `/diverga:setup` or by editing config directly.

---

## Integration with Classic VS

- VS Arena is **OFF by default**
- When enabled, agents C1, C2, C3 delegate methodology selection to VS Arena instead of internal VS
- Classic single-agent VS remains available when VS Arena is disabled
- VS Arena respects all existing checkpoints and prerequisites

---

## Agent Teams Mode (when available)

When Agent Teams is enabled, VS Arena uses direct inter-persona debate:

### Teams Flow
1. Orchestrator creates team: `TeamCreate("vs-arena-debate")`
2. Spawn 3 persona teammates (selected V1-V5 based on research question)
3. Each persona independently analyzes the research question
4. Cross-critique round: each persona challenges the others via `SendMessage`
5. Personas refine their recommendations based on feedback
6. Lead synthesizes all positions at CP_METHODOLOGY_APPROVAL
7. Present to user with full debate transcript

### Subagent Flow (fallback)
(existing behavior — coordinator mediates all exchange)

The skill file works identically in both modes. The orchestrator decides
which execution path to use based on environment and config.

---

## Backward Compatibility

- No changes to existing agent behavior when VS Arena is disabled
- VS Arena adds 5 persona agents (V1-V5) to the agent catalog
- Total agent count: 24 core + 5 persona = 29
- Persona agents are only invoked through VS Arena orchestration
