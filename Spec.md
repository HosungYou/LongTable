# LongTable Refactoring Spec

## Scope

이 문서는 LongTable 리팩토링의 기술적 기준 문서다. 목표는 Claude-first plugin을 researcher-centered, provider-neutral harness로 재구성하는 것이다.

`LongTable` is the product, package scope, CLI command, and managed runtime identifier.

Repository framing and migration boundary are defined in `README.md`, `RELATIONSHIP.md`, and `docs/BRANDING.md`.

Active supporting docs are:

- `docs/ARCHITECTURE.md`
- `docs/ACTIVE-DECISIONS.md`
- `docs/CHECKPOINTING.md`
- `docs/EVIDENCE-POLICY.md`
- `docs/MEMORY.md`
- `docs/PROVIDER-STRATEGY.md`
- `docs/STUDY-CONTRACT.md`
- `docs/PERSONA-ORCHESTRATION.md`
- `docs/QUESTION-RUNTIME.md`
- `docs/LONGTABLE-COMMAND-SURFACE.md`
- `docs/CODEX-ALIAS-OVERLAY.md`
- `docs/IN-CODEX-SETUP.md`
- `docs/MIGRATION-MAP.md`

Historical exploration and release notes may be moved under `docs/archive/`.

## Top-Level Decisions

1. source of truth는 provider 디렉터리가 아니라 core schema와 docs에 둔다.
2. `.claude`와 `.codex`는 원본이 아니라 adapter surface다.
3. checkpoint는 agent prerequisite가 아니라 research commitment semantics에 묶는다.
4. researcher profile은 setup에서 시작하고 운영 중 보정한다.
5. Codex는 native AskUserQuestion에 의존하지 않고 numbered choice protocol로 처리한다.
6. researcher-facing execution and supporting packages should use the `longtable` identifier consistently.
7. question semantics are provider-neutral, but provider adapters may use the strongest native question surface available.

## Proposed Repository Shape

```text
LongTable/
  packages/
    longtable-core/
    longtable-provider-claude/
    longtable-provider-codex/
    longtable-memory/
    longtable-checkpoints/
    longtable-setup/
  docs/
    ARCHITECTURE.md
    CHECKPOINTING.md
    MEMORY.md
    PROVIDER-STRATEGY.md
    MIGRATION-MAP.md
  schemas/
    researcher-profile.schema.yaml
    checkpoint-policy.schema.yaml
    state.schema.yaml
  adapters/
    claude/
    codex/
```

An initial package and schema scaffold now exists to make these boundaries executable rather than purely descriptive.

Current code-level scaffolds now cover:

- shared provider-neutral core types
- checkpoint policy resolution
- memory state contracts and loading summaries
- onboarding question flow and researcher profile seeding
- numbered checkpoint prompt generation and response parsing
- setup persistence outputs
- provider-specific Codex and Claude adapter surfaces
- study contract, decision record, and artifact provenance contracts
- setup package CLI and publish-ready package metadata
- persisted setup storage path and runtime config fragment generation
- generated provider runtime config install paths under `~/.longtable/runtime`
- epistemic mode, question policy, and plugin strength evaluation docs now define how execution should be slowed or challenged when needed
- narrative trace is now treated as a first-class state artifact rather than only a prose concern
- provider adapters now map epistemic mode and question policy into runtime guidance rather than treating them as prose-only design notes
- Claude production runtime adoption is intentionally phased: read-only bridge first, opt-in advisory adoption second, stronger consumption only after evaluation
- Codex requires explicit runtime-guidance injection; artifact generation alone is not enough to change live conversation ordering
- `packages/longtable` now defines the primary researcher-facing command surface for the unified product contract
- Codex prompt aliases now provide an in-session LongTable overlay instead of forcing researchers to remember only wrapper commands
- persona routing now uses English canonical role keys with Korean/English synonym triggers and visible disclosure
- current product contract is workspace-first: `longtable start` prepares a project directory before `codex` is opened inside it
- factual, current, and external claims now require source discipline; unsupported claims must be labeled as inference or estimate
- question runtime contracts now separate shared checkpoint judgment from Claude/Codex-specific presentation surfaces

## Core Domain Objects

- `ResearcherProfile`
- `ResearchState`
- `CheckpointPolicy`
- `DecisionRecord`
- `ArtifactRecord`
- `InteractionMode`

## Researcher Profile Model

### Required fields

- field
- career_stage
- experience_level
- preferred_checkpoint_intensity
- current_project_type

### Adaptive fields

- novelty_preference
- ambiguity_tolerance
- confidence_by_domain
- ai_autonomy_preference
- explanation_depth_preference

## Checkpoint Model

### Types

- `universal_required`
- `adaptive_required`
- `recommended`
- `log_only`
- `none`

### Inputs

- researcher profile
- task mode
- artifact stakes
- current research stage
- unresolved tensions

### Output

- checkpoint level
- prompt style
- whether confirmation is blocking
- whether decision should update explicit state

## Interaction Modes

- `explore`
- `review`
- `critique`
- `draft`
- `commit`
- `submit`

Mode는 checkpoint 강도와 memory loading level에 영향을 준다.

## Hook Policy

### Keep

- state-summary-loader
- checkpoint-enforcer
- decision-log-writer
- artifact-provenance-recorder
- context-compactor

### Remove or Minimize

- always-on full memory injection
- theory recommendation hook
- methodology recommendation hook
- broad keyword auto-dispatch
- unrestricted team bypass

## Claude Adapter

- AskUserQuestion 사용 가능 시 structured choice 사용
- existing hook system 재사용 가능
- team dispatch는 mode-aware bypass로 축소
- LongTable core must decide whether the question is required; Claude only decides how the structured question is presented.

## Codex Adapter

- native structured question UI에 의존하지 않음
- numbered choice protocol 사용
- parser validates `1`, `2`, `3` style answers
- invalid input 시 재질문
- Codex-native orchestration patterns는 참고 가능하되 provider runtime이 product contract를 지배하면 안 됨
- Codex answers must normalize to the same decision/answer contract as Claude native question answers.

## Numbered Checkpoint Interaction Contract

```text
CHECKPOINT: Theory Anchor Selection

1. Dialogic pedagogy + epistemic agency
2. Activity theory + human checkpoint governance
3. Floridi agency + evaluativist epistemic cognition

Reply with one number only: 1, 2, or 3.
```

Rules:

- no implicit defaults for blocking checkpoints
- no free-form acceptance for required checkpoints
- response must be parseable
- accepted decision is written to decision log

## Web App Decision

웹 앱은 가능하지만 1차 refactor 범위에서는 제외한다.

이유:

- 연구자 UX는 중요하지만, 현재 핵심 병목은 architecture와 governance다.
- 먼저 core와 adapters를 정리해야 웹 앱이 안정적이 된다.
- 초기 단계에서는 Claude/Codex adapters만으로도 product validation이 가능하다.

## Acceptance Criteria

- root docs와 schema가 provider-neutral하게 정의된다.
- checkpoint engine이 mode-aware policy로 재정의된다.
- memory system이 explicit/inferred/tension 구조로 문서화된다.
- Claude/Codex adapter 차이가 문서에 명시된다.
- Codex adapter가 provider-neutral contract를 깨지 않도록 정의된다.
