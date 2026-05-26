# LongTable 0.1.51

LongTable 0.1.51 separates the research-start surface from post-start
interviews.

## What Changed

- Adds `$longtable-start` as the provider-native research-start skill.
- Repositions `$longtable-interview` as a post-start, option-first follow-up
  interview after a usable Research Specification exists.
- Requires `$longtable-interview` to route to `$longtable-start` when no
  Research Specification exists or when only a First Research Shape exists.
- Rewrites README and command-surface docs around the canonical workflow:
  `longtable setup -> $longtable-start -> $longtable-interview`.
- Documents question UI as transport over `QuestionRecord -> DecisionRecord`.
- Clarifies that tmux is not required for LongTable core behavior. Any future
  OMX-style Codex popup must be optional, attached-tmux-only, and backed by the
  normal fallback path.

## Compatibility

`longtable start` remains available for scripts and automation. Existing MCP
interview tools continue to support the start flow; the user-facing skill name
is now `$longtable-start`.
