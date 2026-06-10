# LongTable Handoff

Generated: 2026-06-10T05:45:00Z
Project: LongTable
Project path: /Volumes/External SSD/Projects/LongTable

## Current Objective
- Goal: Review LongTable checkpoint behavior, version alignment, and workspace policy
- Blocker: Step 5 freeze handoff package is ready; artifact integrity and handoff continuity checks are the remaining Step 5 closeout.
- Next action: Run Step 5 handoff integrity verification, sync handoff artifacts, and confirm readiness for next operational step.

## Research Specification Status
- No Research Specification is available yet.
- Start or resume `$longtable-start` before treating the project direction as settled.

## Latest Panel Or Discussion
- No panel invocation is recorded yet.
- Start with `lt panel: <what needs review>` or `longtable panel --prompt "..." --json`.

## Pending Researcher Decisions
- decision_mq7lwboi_5f7gtb: What should LongTable treat as the final freeze condition before Step 4 external-ready packaging? (proceed)

## Unincorporated Evidence
- No unincorporated evidence records.

## Proposed Specification Patches
- No proposed Research Specification patches.

## Open Questions
- What would make the current blocker (`Step 5 freeze handoff package is ready; artifact integrity and handoff continuity checks are the remaining Step 5 closeout.`) usable for operational continuation without forcing a final research question yet?
- How should Step 5 freeze handoff evidence be consumed in downstream tooling when no panel invocation exists?

## Stop Condition
- Stop when the next research decision is either confirmed by the researcher, preserved as an explicit open tension, or represented as a proposed Research Specification patch waiting for confirmation.

## Provider-Neutral Path
- Use this only when OMX is not installed or when the researcher wants a plain CLI/native-agent workflow.

1. Open the project in Codex or Claude Code.
2. Use `$longtable-start` if no usable Research Specification exists; otherwise use `$longtable-interview` or `lt panel: ...` for the next bounded decision.
3. When a panel or native worker run produces real role outputs, persist the structured result:
   `longtable panel record --invocation <id> --result-file <path> --json`
   Native worker outputs should be final role summaries only: summary, claims, objections, open questions, and evidence refs.
4. Inspect unincorporated evidence:
   `longtable spec unincorporated --cwd <project-path>`
5. Propose a Research Specification patch before applying a changed research direction:
   `longtable spec propose --cwd <project-path> --spec-file updated-spec.json --rationale "Panel/discussion handoff"`
6. Apply only after the researcher confirms the decision:
   `longtable spec apply --cwd <project-path> --patch-id <spec_patch_id>`

## Optional OMX Path
Use this only when OMX is installed. The handoff packet can be pasted into `$ralplan` for a plan/test-spec pass, then `$ralph` can execute the approved work until verification. LongTable should remain the research-state source of truth; OMX is only the execution loop.

Suggested OMX prompt:
```text
$ralplan: Use the LongTable handoff below as the research-state contract. Produce a PRD/test-spec style execution plan, preserve unresolved panel disagreements, and do not change the Research Specification without a LongTable checkpoint.
```

Then, after the plan is accepted:
```text
$ralph: Execute the approved LongTable handoff plan. Verify artifacts, then record any panel evidence or spec patch through LongTable commands.
```
