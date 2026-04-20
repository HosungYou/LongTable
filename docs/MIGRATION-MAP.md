# Migration Map

## Immediate Documents

- `README.md`
- `PRD.md`
- `Spec.md`
- `AGENTS.md`
- `RELATIONSHIP.md`
- `docs/ARCHITECTURE.md`
- `docs/CHECKPOINTING.md`
- `docs/MEMORY.md`
- `docs/PROVIDER-STRATEGY.md`
- `docs/STUDY-CONTRACT.md`
- `docs/PERSONA-ORCHESTRATION.md`
- `docs/QUESTION-RUNTIME.md`
- `docs/DIVERGA-REPOSITORY-MERGE.md`
- `docs/LONGTABLE-COMMAND-SURFACE.md`
- `docs/CODEX-ALIAS-OVERLAY.md`
- `docs/IN-CODEX-SETUP.md`

## Existing Inputs To Preserve

- `docs/philosophy/LongTable_Researcher_Centered_Engineering_Philosophy_OnePager.md`
- `docs/hooks/LongTable_Hook_Redesign_Plan_OnePager.md`
- `docs/bjet-framework/LongTable_BJET_Theoretical_Framework_OnePager.md`

## Archived Documents

The following are preserved as design history under `docs/archive/` rather than active contract:

- `docs/archive/REPO-STRUCTURE.md`
- `docs/archive/NPM-RELEASE-AND-DEPLOYMENT.md`
- `docs/archive/GITHUB-SETUP.md`
- `docs/archive/REPOSITORY-POLICY.md`
- `docs/archive/RELEASE-CHECKLIST.md`
- `docs/archive/SETUP-PACKAGE-RELEASE.md`
- `docs/archive/RUNTIME-INSTALL.md`
- `docs/archive/PLUGIN-STRENGTH-EVALUATION.md`
- `docs/archive/DIVERGA-MIGRATION-PATCH.md`
- `docs/archive/IMPLEMENTATION-ROADMAP.md`

## Active Secondary Documents

- `docs/ONBOARDING.md`
- `docs/RESEARCHER-PROFILE.md`
- `docs/INTERACTION-MODES.md`
- `docs/NUMBERED-CHECKPOINT-PROTOCOL.md`
- `docs/DECISION-LOG-SCHEMA.md`
- `docs/SETUP-STRATEGY.md`
- `docs/DECISION-LIFECYCLE.md`
- `docs/CODEX-ADAPTER.md`
- `docs/CODEX-RUNTIME-GUIDANCE-INJECTION.md`
- `docs/CODEX-LIVE-TEST-PATH.md`
- `docs/CLAUDE-COMPATIBILITY.md`
- `docs/CLAUDE-RUNTIME-ADOPTION-DECISION.md`
- `docs/EPISTEMIC-MODES.md`
- `docs/QUESTION-POLICY.md`
- `docs/CLOSURE-BIAS-EVALUATION-PROTOCOL.md`

## Migration Sequence

1. lock product language in PRD
2. lock technical boundaries in Spec
3. define checkpoint and memory contracts
4. define provider adapters
5. define generated runtime install artifacts
6. only then modify runtime repos

## Refactoring Rule

If a design decision changes trust, checkpoints, setup, or memory semantics, document it here before implementing it elsewhere.
