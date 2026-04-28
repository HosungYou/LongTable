# LongTable 0.1.38 Release Notes

## Hook Behavior

- `UserPromptSubmit` no longer auto-creates required Researcher Checkpoints for
  LongTable engineering explanation or diagnostic prompts, such as asking why a
  hook fired, how the agent system works, or whether a simulation reproduces an
  interruption.
- LongTable engineering execution prompts remain suppressed from researcher
  checkpoint generation, preserving the 0.1.37 behavior.
- Research closure prompts that are not LongTable engineering diagnostics still
  surface protected-decision checkpoints when the workspace state requires them.

## Simulation Coverage

- Added Codex hook smoke cases for malformed skill autocomplete text
  (`$longlongtable`), Korean agent-system explanation prompts, and Korean hook
  simulation/debug prompts.
- The smoke suite verifies that these prompts produce no hook context and do not
  persist false-positive checkpoint records.

## Packaging

- Workspace packages are aligned on version `0.1.38`.
- MCP install snippets point to `@longtable/mcp@0.1.38`.
