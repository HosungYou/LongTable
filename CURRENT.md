# CURRENT

Project: LongTable

This file is regenerated from `.longtable/current-session.json` and `.longtable/state.json`.

## Focus Now
- Current goal: Review LongTable checkpoint behavior, version alignment, and workspace policy
- Current blocker: Verify whether Researcher Checkpoints trigger correctly after the latest version update
- Research Specification: Interview Lineage and Checkpoint-Enforced Conflict Governance
- Next action: Open with the blocker, then ask LongTable to surface the first high-leverage uncertainty around "Verify whether Researcher Checkpoints trigger correctly after the latest version update".
- Perspectives: reviewer, theory_critic, methods_critic, measurement_auditor, ethics_reviewer, voice_keeper
- Disagreement: show_on_conflict

## Research Specification Status
- Status: draft. Research Specification exists, but it is not a confirmed closure point yet.
- Next protocol: update the specification, then return to `confirm_research_specification` for another preview confirmation.

## Research Specification Audit
- Current revision: spec_revision_mplv291p_ylefv6
- Status: draft
- Raw interview turns: 0
- Evidence records: 0
- Spec patches: 1
- Spec revisions: 1

### Recent Specification Changes
- v1 Applied Research Specification update: Interview Lineage and Checkpoint-Enforced Conflict Governance: replace constructOntology.coreConstructs; replace constructOntology.distinctions; replace constructOntology.termsToAvoidCollapsing

## Open Questions
- What would reduce the uncertainty around "Verify whether Researcher Checkpoints trigger correctly after the latest version update" first?
- What evidence would let you decide whether "Verify whether Researcher Checkpoints trigger correctly after the latest version update" is a knowledge gap, a coding rule gap, or a data gap?

## Recent LongTable Invocations
- panel/review via sequential_fallback: reviewer, methods_critic, measurement_auditor, theory_critic, ethics_reviewer, voice_keeper

## Restart Prompt
- "I want to continue from the Research Specification: Interview Lineage and Checkpoint-Enforced Conflict Governance."

## Research Specification
- Title: Interview Lineage and Checkpoint-Enforced Conflict Governance
- Status: draft
- Confidence: high
- Question: How should LongTable govern repeated interviews and derived Research Specification artifacts so duplicate or conflicting research commitments become explicit state, survive compaction, and force a Researcher Checkpoint before Codex continues?
- Purpose: Turn Luca’s question about MCP transport, workspace state, Researcher Checkpoints, and compaction loss into a product-backed design for lineage, conflict resolution, and hard checkpoint enforcement rather than a shallow automatic-restore feature.
- Scope boundary: First implementation should define and test the state contract for repeated interview/spec lineage, conflict detection, and enforced pending checkpoints. Automatic restore remains a supporting mechanism that rehydrates externalized state; it is not the main product guarantee by itself.
- Core constructs: interview lineage; canonical Research Specification; derived artifact; duplicate specification change; conflicting research commitment; Researcher Checkpoint; QuestionRecord; DecisionRecord; open tension; compaction-resilient state
- Key distinctions: `CURRENT.md` is a regenerated view; it must not be the merge mechanism for conflicting research commitments.; `.longtable/state.json` is the machine-readable source of truth; MCP is transport over that state, not the arbiter of semantics.; Automatic restore is rehydration of already-externalized state; conflict governance is the product guarantee.; A new interview turn, a proposed spec patch, an applied revision, and a confirmed decision are different lifecycle states and must not be collapsed.; A pending checkpoint that is merely visible is weaker than a pending checkpoint that blocks closure or research-state mutation.
- Theory anchors: state-first research memory; researcher agency over canonical commitments; auditability of research-direction changes; externalized conflict over model-context recall; provider-neutral checkpoint semantics with Codex-specific guard hooks
- Coding rules: If a repeated interview produces a materially different question, scope boundary, construct, method, evidence rule, or protected decision, LongTable must record a proposed patch or explicit conflict rather than silently overwriting the canonical spec.; If two artifacts disagree, `CURRENT.md` must surface the open tension or pending checkpoint; it must not flatten disagreement into a single unqualified summary.; A checkpoint passes only when a durable `QuestionRecord` becomes an answered `DecisionRecord` or is explicitly cleared with rationale.; A hard-stop checkpoint passes only if closure or research-state mutation is blocked while the required question/obligation is pending.; Compaction recovery passes only if the restored context points back to externalized state records, not to unstored conversational inference.
- Analysis options: Audit why the current Research Specification draft has empty `specPatches` and `specRevisions`, then decide whether draft updates should use summarize, proposed patch, applied revision, or a combined path.; Implement repeated-interview/spec diff detection that creates explicit open tensions or required `QuestionRecord`s when new interview evidence conflicts with the canonical specification.; Harden `Stop` or an equivalent closure guard so Codex cannot silently finish a research-direction-changing inquiry while unresolved required checkpoints or obligations remain.; Extend `SessionStart`/`PostCompact` restoration to include unresolved conflicts, pending checkpoints, and canonical spec cursor, not just a draft title or active interview notice.; Add smoke coverage for repeated interview conflict, checkpoint creation, checkpoint blocking, restart/compaction restoration, and state-regenerated `CURRENT.md` visibility.
- Required sources: packages/longtable/src/longtable-codex-native-hook.ts; packages/longtable/src/project-session.ts; packages/longtable-mcp/src/server.ts; scripts/smoke-codex-hooks.mjs; docs/QUESTION-RUNTIME.md; docs/RESEARCHER-CHECKPOINTS.md; .longtable/state.json; .longtable/current-session.json; CURRENT.md
- Corpus and Access Plan: Local repository and workspace state are sufficient for the first design/implementation pass.; No external publisher, web, or institutional access is required.
- Evidence standards: Separate current implemented behavior from intended contract in docs and responses.; Treat smoke tests and generated state files as evidence for whether checkpoints actually work.; Label compaction-related claims as provider-triggered hook behavior unless official provider documentation is checked.; Do not claim conflict resolution is solved until duplicate/conflicting spec updates have a durable, inspectable state path.
- Conflict rule: When repeated interviews or derived artifacts disagree on a research commitment, LongTable must preserve the disagreement as state and force a researcher decision before treating the canonical Research Specification as settled.
- Protected decision: Do not treat automatic Research Specification draft restoration as the whole solution.
- Protected decision: Do not allow repeated interviews to silently overwrite or duplicate the canonical Research Specification without lineage and conflict state.
- Protected decision: Do not claim Researcher Checkpoints work unless pending required checkpoints can block closure or research-state mutation in Codex.
- Protected decision: Do not let compaction erase unresolved conflicts by keeping them only in model context.
- Open question: Should repeated interview output create a patch against the canonical Research Specification by default, or create a separate candidate that requires explicit merge?
- Open question: What exact conflict threshold should trigger a required checkpoint rather than a log-only open tension?
- Open question: Should Codex `Stop` be hardened to block all pending required checkpoints, or only closure/research-state-settling paths?
- Open question: How should stale or unrelated checkpoints be cleared so enforcement remains strong without trapping unrelated engineering work?
- Next action: Audit current spec history behavior, especially why the existing draft has no `specPatches` or `specRevisions`.
- Next action: Design the repeated-interview lineage contract: interview turn -> evidence record -> proposed spec patch -> conflict/checkpoint -> decision -> applied revision -> regenerated CURRENT.md.
- Next action: Implement or harden checkpoint blocking for unresolved research conflicts, including `Stop` or an equivalent closure guard.
- Next action: Add smoke tests for duplicate/conflicting interview-derived specs, pending checkpoint persistence, Codex blocking behavior, and PostCompact/SessionStart restoration of unresolved conflict state.
- Next action: Update docs so Luca's question can be answered with a precise product contract: LongTable survives compaction by externalizing conflicts and decisions, not by trusting model context.

## Quick Start
- Open `codex` in this directory.
- A good first message is usually `$longtable-interview`.

## Evidence Rule
- External or current claims should carry a source link or be labeled as inference.