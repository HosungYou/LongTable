# Agent and Skill Invocation Review

## Decision

LongTable should not restore Diverga's old agent system as the canonical runtime.

The useful part of Diverga was not the packaging itself. It was the contract shape:

- role definitions with explicit trigger language
- checkpoint prerequisites before high-impact actions
- provider-specific skill files generated from one canonical registry
- a structured state layer that records questions, decisions, and invocation outcomes

LongTable should keep role and checkpoint semantics in shared packages, then project those semantics into Claude Code and Codex through adapters.

## Current State

LongTable already has a provider-neutral foundation:

- personas and routing in `packages/longtable/src/personas.ts` and `packages/longtable/src/persona-router.ts`
- checkpoint policy in `packages/longtable-checkpoints`
- Claude question rendering in `packages/longtable-provider-claude`
- Codex numbered checkpoint rendering in `packages/longtable-provider-codex`
- generated Codex skills in `packages/longtable-provider-codex`
- generated Claude skills in `packages/longtable-provider-claude`

The remaining layer is a complete invocation result contract and state log.

Today, `routePersonas()` can say which LongTable role should shape the answer, and provider adapters can generate skill files from the same role registry. Panel planning now appends `InvocationRecord` entries to `.longtable/state.json` when run inside a LongTable project workspace. It also creates a pending follow-up `QuestionRecord`; `longtable decide` answers that question, appends a `DecisionRecord`, and links the decision back to the panel invocation.

## Diverga Findings

Legacy Diverga's real invocation contract lived in per-agent skill files such as `skills/a1/SKILL.md`, `skills/b1/SKILL.md`, and `skills/x1/SKILL.md`.

The rest of the system mostly packaged or enforced that contract:

- `plugin.json` and `.claude-plugin/plugin.json` pointed Claude at skills and MCP config.
- `hooks/prereq-enforcer.mjs` blocked `Agent` and `Skill` calls when prerequisite checkpoints were missing.
- `mcp/agent-prerequisite-map.json` described prerequisite relationships.
- `.mcp.json` and `mcp/diverga-server.js` exposed checkpoint, memory, and communication tools.

LongTable should copy these semantics, not the old agent taxonomy wholesale.

## OMX Findings

OMX v0.14.0 is stronger than the current LongTable integration in three areas:

- it installs skills and native agent config from one source of truth
- it treats MCP tools as structured transport over state
- it records user questions as durable lifecycle records

LongTable should adopt those control-plane patterns.

LongTable should not copy OMX's worker claims, mailbox protocol, or broad
magic-keyword orchestration. Those are useful for a multi-agent execution
platform, but they would make LongTable too agent-centered.

## Target Architecture

Add a provider-neutral invocation layer:

- `RoleDefinition`: canonical role metadata, triggers, disclosure, and checkpoint posture
- `InvocationIntent`: normalized request to consult or execute one or more roles
- `InvocationResult`: normalized outcome, including provider surface, degraded fallback, and decision records
- `ProviderCapabilities`: capability probe for Claude Code and Codex surfaces

The provider adapters should translate `InvocationIntent` into their own surfaces:

- Claude Code: generated `.claude/skills/longtable-*` files and native structured question payloads when available
- Codex: generated `.codex/skills/longtable-*` files, with numbered checkpoint fallback
- MCP: structured read/write/evaluate tools over LongTable state, not a replacement for core semantics

## Recommended Adoption

Adopt from Diverga:

- skill file contract shape
- prerequisite enforcement semantics
- alias resolution and entry-point role idea
- explicit bypass flag only for coordinated panel execution

Adopt from OMX:

- one repo-owned catalog projected into generated runtime files
- atomic state writes and normalized MCP registry setup
- durable question records
- docs-first research and prompt contract tests

Do not adopt:

- checkpoint logic based on agent identity
- a 24-agent static taxonomy as the product model
- prompt or skill files as source of truth
- hidden broad keyword dispatch
- MCP as the canonical implementation of checkpoint semantics

## Implementation Sequence

1. Add `InvocationIntent`, `PanelResult`, and `ProviderCapabilities` to the shared core contract. Done.
2. Generate Claude skill bundles from the canonical role registry. Done.
3. Generate Codex skill bundles from the canonical role registry. Done.
4. Append panel `InvocationRecord` entries to `.longtable/state.json`. Done.
5. Link panel follow-up questions and decisions to invocation records. Done.
6. Add `longtable-state` MCP as structured transport for project/session reads, checkpoint evaluation, question records, decision append, and `CURRENT.md` regeneration.
7. Add doctor checks that verify provider installations without treating either provider as canonical.

This keeps Claude Code and Codex behavior aligned without forcing them to use identical native mechanisms.
