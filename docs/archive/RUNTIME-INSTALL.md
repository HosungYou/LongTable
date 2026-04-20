# Runtime Install

## Goal

`longtable-setup` should be able to write generated runtime config artifacts without directly mutating provider-native config files.

## Managed Paths

- setup output: `~/.longtable/setup.json`
- Codex runtime config: `~/.longtable/runtime/codex/longtable.toml`
- Claude runtime config: `~/.longtable/runtime/claude/longtable.json`

## Why This Layer Exists

- it preserves a clean migration boundary between refactoring contracts and production runtimes
- it avoids overwriting `.codex` or `.claude` state too early
- it makes the install surface testable before provider-native integration

## CLI Surface

- `longtable-setup init --write`
- `longtable-setup init --write --install`
- `longtable-setup install`

`--install` implies that setup output must exist as a stable artifact because runtime config references its path.

## Migration Rule

Generated runtime config is the first integration surface.

Provider-native config rewiring is a later patch after:

1. runtime artifact generation is stable
2. setup path is stable
3. checkpoint semantics are stable
