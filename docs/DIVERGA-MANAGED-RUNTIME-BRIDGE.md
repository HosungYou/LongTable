# Diverga Managed Runtime Bridge

## Goal

Add a minimal integration path from the refactoring repo's generated artifacts into the current Diverga runtime without rewriting the production runtime model in one patch.

## Managed Artifacts

- setup output: `~/.diverga/setup.json`
- Codex runtime config: `~/.diverga/runtime/codex/diverga.toml`
- Claude runtime config: `~/.diverga/runtime/claude/diverga.json`

## Current Branch Scope

This branch implements two minimal bridge steps.

- `packages/codex-setup` detects existing managed artifacts
- the Codex installer can import profile and checkpoint defaults
- the Codex installer can also import runtime guidance defaults such as question bias and narrative-trace preservation
- `~/.codex/diverga/config.yaml` records the managed artifact paths
- `src/runtime/managed-bridge.ts` provides a Claude-side reader shim for `~/.diverga/runtime/claude/diverga.json`
- `skills/setup/SKILL.md` now defines Claude setup-time import from managed artifacts
- `skills/diverga/SKILL.md` now exposes runtime bridge status in the dashboard

## Why This Is Safe

- it does not overwrite Claude runtime behavior
- it does not redirect the main runtime to a new config source
- it keeps generated artifacts and production runtime loosely coupled

## Claude Shim

The Claude shim does not change plugin behavior yet.

It only provides:

- managed path resolution
- `readManagedClaudeRuntimeConfig()`
- `readManagedSetupOutput()`
- `detectManagedClaudeBridge()`
- `summarizeManagedRuntimeGuidance()`

This keeps the next patch focused on runtime adoption rather than path conventions.

The first Claude adoption surface is the setup and dashboard skills:

- setup can import managed researcher profile context
- dashboard can show whether a managed runtime bridge is active

## Next Patch

1. decide whether the Claude runtime should read generated artifacts directly or through an adapter shim
2. wire one Claude entry point to `detectManagedClaudeBridge()`
3. only then consider replacing legacy config sources
