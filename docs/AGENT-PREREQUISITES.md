# Agent Prerequisite Map

Each agent has prerequisite checkpoints that MUST be completed before execution, and own checkpoints triggered during execution.

## Full Prerequisite Map

| Agent | Prerequisites (must be completed) | Own Checkpoints (triggered during execution) |
|-------|----------------------------------|---------------------------------------------|
| A1 | (entry point) | CP_RESEARCH_DIRECTION, CP_VS_001, CP_VS_003 |
| A2 | CP_RESEARCH_DIRECTION | CP_THEORY_SELECTION, CP_VS_001, CP_VS_002, CP_VS_003 |
| A3 | CP_RESEARCH_DIRECTION | CP_VS_001, CP_VS_003 |
| A4 | (none) | (none) |
| A5 | (entry point) | CP_PARADIGM_SELECTION |
| A6 | CP_RESEARCH_DIRECTION | CP_VISUALIZATION_PREFERENCE |
| B1 | CP_RESEARCH_DIRECTION | CP_SCREENING_CRITERIA, CP_SEARCH_STRATEGY, CP_VS_001 |
| B2 | CP_RESEARCH_DIRECTION | CP_QUALITY_REVIEW |
| B3 | (none) | (none) |
| B4 | (none) | (none) |
| B5 | (none) | (none) |
| C1 | CP_PARADIGM_SELECTION, CP_RESEARCH_DIRECTION | CP_METHODOLOGY_APPROVAL, CP_VS_001, CP_VS_003 |
| C2 | CP_PARADIGM_SELECTION, CP_RESEARCH_DIRECTION | CP_METHODOLOGY_APPROVAL, CP_VS_001 |
| C3 | CP_PARADIGM_SELECTION, CP_RESEARCH_DIRECTION | CP_METHODOLOGY_APPROVAL, CP_INTEGRATION_STRATEGY |
| C5 | CP_RESEARCH_DIRECTION, CP_METHODOLOGY_APPROVAL | CP_ANALYSIS_PLAN |
| C6 | CP_METHODOLOGY_APPROVAL | (none) |
| C7 | CP_METHODOLOGY_APPROVAL | (none) |
| D1 | CP_METHODOLOGY_APPROVAL | CP_SAMPLING_STRATEGY |
| D2 | CP_METHODOLOGY_APPROVAL | CP_SAMPLING_STRATEGY |
| D4 | CP_METHODOLOGY_APPROVAL | CP_METHODOLOGY_APPROVAL |
| E1 | CP_METHODOLOGY_APPROVAL | CP_ANALYSIS_PLAN |
| E2 | CP_METHODOLOGY_APPROVAL | CP_CODING_APPROACH, CP_THEME_VALIDATION |
| E3 | CP_METHODOLOGY_APPROVAL | CP_INTEGRATION_STRATEGY |
| E5 | CP_METHODOLOGY_APPROVAL | (none) |
| G1 | (entry point) | CP_JOURNAL_PRIORITIES, CP_JOURNAL_SELECTION |
| G3 | (none) | (none) |
| G5 | (none) | CP_HUMANIZATION_REVIEW |
| G6 | CP_HUMANIZATION_REVIEW | CP_HUMANIZATION_VERIFY |
| H1 | CP_PARADIGM_SELECTION | CP_METHODOLOGY_APPROVAL |
| H2 | CP_PARADIGM_SELECTION | CP_METHODOLOGY_APPROVAL |
| I0 | (none) | All SCH_* |
| I1 | (none) | SCH_DATABASE_SELECTION, SCH_API_KEY_VALIDATION |
| I2 | SCH_DATABASE_SELECTION | SCH_SCREENING_CRITERIA |
| I3 | SCH_SCREENING_CRITERIA | SCH_RAG_READINESS |

---

## Checkpoint Dependency Order

Resolve prerequisites from lowest level first:

```
Level 0 (entry points):
  CP_RESEARCH_DIRECTION, CP_PARADIGM_SELECTION,
  CP_JOURNAL_PRIORITIES, CP_JOURNAL_SELECTION

Level 1:
  CP_THEORY_SELECTION, CP_METHODOLOGY_APPROVAL

Level 2:
  CP_ANALYSIS_PLAN, CP_SCREENING_CRITERIA, CP_SAMPLING_STRATEGY,
  CP_CODING_APPROACH, CP_THEME_VALIDATION, CP_INTEGRATION_STRATEGY,
  CP_QUALITY_REVIEW

Level 3:
  SCH_DATABASE_SELECTION, SCH_API_KEY_VALIDATION,
  CP_HUMANIZATION_REVIEW, CP_VS_001, CP_VS_002, CP_VS_003

Level 4:
  SCH_SCREENING_CRITERIA, CP_HUMANIZATION_VERIFY

Level 5:
  SCH_RAG_READINESS
```

---

## Ad-hoc Invocation Protocol

When an agent is invoked directly (e.g., `/diverga:c5`):

1. Look up the agent's prerequisites in the table above
2. For any incomplete prerequisite, trigger AskUserQuestion to resolve it
3. Resolve in dependency order (lowest level first)
4. Only begin the agent's core work after ALL prerequisites pass

## Multi-Agent Simultaneous Invocation

When natural language triggers multiple agents at once:

1. Collect the union of all triggered agents' prerequisites
2. Deduplicate and sort by dependency order
3. Resolve each prerequisite via AskUserQuestion (max 4 at a time)
4. After all prerequisites pass, execute agents in parallel
5. Each agent's own checkpoints still trigger AskUserQuestion during execution
