# Agent and Skill Invocation Review

## Decision

LongTable should not restore Diverga's old agent system as the canonical runtime.

The useful part of Diverga was not the packaging itself. It was the contract shape:

- role definitions with explicit trigger language
- checkpoint prerequisites before high-impact actions
- provider-specific skill or prompt files generated from one canonical registry
- a structured state layer that records questions, decisions, and invocation outcomes

LongTable should keep role and checkpoint semantics in shared packages, then project those semantics into Claude Code and Codex through adapters.

## Current State

LongTable already has a provider-neutral foundation:

- personas and routing in `packages/longtable/src/personas.ts` and `packages/longtable/src/persona-router.ts`
- checkpoint policy in `packages/longtable-checkpoints`
- Claude question rendering in `packages/longtable-provider-claude`
- Codex numbered checkpoint rendering in `packages/longtable-provider-codex`
- optional Codex prompt aliases in `packages/longtable/src/prompt-aliases.ts`

The missing layer is a real invocation contract.

Today, `routePersonas()` can say which LongTable role should shape the answer, but it does not produce an executable "call this role as a skill/agent" record. Codex prompt aliases are useful, but they are an overlay. Claude-native skill files are not yet generated from the same registry.

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

- it installs prompts, skills, and native agent config from one source of truth
- it treats MCP tools as structured transport over state
- it records user questions as durable lifecycle records

LongTable should adopt those control-plane patterns.

LongTable should not copy OMX's tmux team runtime, worker claims, mailbox protocol, or broad magic-keyword orchestration. Those are useful for a multi-agent execution platform, but they would make LongTable too agent-centered.

## Target Architecture

Add a provider-neutral invocation layer:

- `RoleDefinition`: canonical role metadata, triggers, disclosure, and checkpoint posture
- `InvocationIntent`: normalized request to consult or execute one or more roles
- `InvocationResult`: normalized outcome, including provider surface, degraded fallback, and decision records
- `ProviderCapabilities`: capability probe for Claude Code and Codex surfaces

The provider adapters should translate `InvocationIntent` into their own surfaces:

- Claude Code: generated `.claude/skills/longtable-*` files and native structured question payloads when available
- Codex: generated prompt aliases or Codex skill files when available, with numbered checkpoint fallback
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
- tmux worker orchestration
- hidden broad keyword dispatch
- MCP as the canonical implementation of checkpoint semantics

## Implementation Sequence

1. Add `InvocationIntent`, `InvocationResult`, and `ProviderCapabilities` to the shared core contract.
2. Refactor persona routing so it emits invocation intents in addition to disclosure text.
3. Generate Claude skill bundles from the canonical role registry.
4. Keep Codex prompt aliases as a convenience surface, but add capability checks and clear fallback behavior.
5. Add `longtable-state` MCP as structured transport for project/session reads, checkpoint evaluation, question records, decision append, and `CURRENT.md` regeneration.
6. Add doctor checks that verify provider installations without treating either provider as canonical.

This keeps Claude Code and Codex behavior aligned without forcing them to use identical native mechanisms.
