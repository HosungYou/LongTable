# @longtable/setup

Researcher onboarding and setup flows for LongTable.

## Recommended Usage

Researchers should use the unified CLI:

```bash
npm install -g @longtable/cli
longtable init --flow interview
```

This package exists so the setup flow can also be consumed programmatically or tested in isolation during development.

By default this writes:

- setup output to `~/.longtable/setup.json`
- Codex runtime config to `~/.longtable/runtime/codex/longtable.toml`
- Claude runtime config to `~/.longtable/runtime/claude/longtable.json`

The generated runtime config does not overwrite platform-native config files directly. It creates LongTable-managed runtime artifacts that can later be wired into provider-specific runtimes during migration.

## Package Role

The setup contract combines technical setup with researcher-profile calibration rather than treating installation as a purely technical step.

Global setup should answer:

- who the researcher is
- how much challenge or slowdown they want
- what makes writing still feel like theirs
- how visible disagreement should be by default

Project and session intake belongs to `longtable start`, not library-level setup helpers.

## Included Outputs

- quick setup question flow
- provider selection resolution
- persisted setup output generator
- saved setup output helpers
- runtime config installer helpers
- numbered checkpoint helpers

See `examples/` for sample Codex and Claude setup outputs.
