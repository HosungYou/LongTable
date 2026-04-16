# Diverga Managed Runtime Bridge

## Goal

Add a minimal integration path from the refactoring repo's generated artifacts into the current Diverga runtime without rewriting the production runtime model in one patch.

## Managed Artifacts

- setup output: `~/.diverga/setup.json`
- Codex runtime config: `~/.diverga/runtime/codex/diverga.toml`
- Claude runtime config: `~/.diverga/runtime/claude/diverga.json`

## Current Branch Scope

This branch only implements the Codex-side installer bridge.

- `packages/codex-setup` detects existing managed artifacts
- the installer can import profile and checkpoint defaults
- `~/.codex/diverga/config.yaml` records the managed artifact paths

## Why This Is Safe

- it does not overwrite Claude runtime behavior
- it does not redirect the main runtime to a new config source
- it keeps generated artifacts and production runtime loosely coupled

## Next Patch

1. add a Claude-side reader for `~/.diverga/runtime/claude/diverga.json`
2. decide whether the Claude runtime should read generated artifacts directly or through an adapter shim
3. only then consider replacing legacy config sources
