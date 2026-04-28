# LongTable 0.1.34 Release Notes

## Interview and Checkpoint UX

- `$longtable-interview` no longer creates a fresh active interview hook when a
  confirmed First Research Shape already exists. It returns a compact resume
  response instead, so Codex does not expose a large state dump or reopen setup.
- `summarize_interview` stores the provisional First Research Shape without
  pre-creating a required confirmation obligation. The final structured UI
  remains owned by `confirm_first_research_shape`.
- `confirm_first_research_shape` skips MCP elicitation when the shape is already
  confirmed and repairs the matching interview hook to `confirmed`.
- Canceled or declined MCP elicitation for First Research Shape confirmation now
  clears the generated required question instead of leaving a pending checkpoint
  that repeatedly blocks later turns.

## Codex Hook Behavior

- `SessionStart` hook output is now compact when there is no pending required
  checkpoint or obligation. It confirms that LongTable context was restored
  without dumping the full current goal, blocker, and protected-decision text on
  every Codex launch.
- The native Codex `Stop` hook no longer blocks merely because an interview is
  active. Active interviews still surface as context on session or prompt
  events, but waiting for researcher input is not treated as permission to
  continue the turn automatically.
- Protected-research-decision option labels now stay short. The full guarded
  judgment is carried in the option description and decision context rather than
  being copied into the selectable label.

## Packaging

- Workspace packages are aligned on version `0.1.34`.
- MCP install snippets should point to `@longtable/mcp@0.1.34`.
