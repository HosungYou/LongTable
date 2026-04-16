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
- `~/.codex/diverga/config.yaml` records the managed artifact paths
- `src/runtime/managed-bridge.ts` provides a Claude-side reader shim for `~/.diverga/runtime/claude/diverga.json`

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

This keeps the next patch focused on runtime adoption rather than path conventions.

## Next Patch

1. decide whether the Claude runtime should read generated artifacts directly or through an adapter shim
2. wire one Claude entry point to `detectManagedClaudeBridge()`
3. only then consider replacing legacy config sources
