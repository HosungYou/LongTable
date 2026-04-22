# LongTable 0.1.22 Release Notes

## Summary

This patch upgrades Researcher Checkpoints for Codex while keeping LongTable's
state contract provider-neutral. Codex can now opt in to MCP elicitation UI for
Researcher Checkpoints, but `QuestionRecord -> DecisionRecord` remains the
source of truth and numbered fallback remains available.

## Changed

- Added `elicit_question` to `@longtable/mcp`.
- Added Codex setup support for `--checkpoint-ui off|interactive|strong`.
- Added explicit Codex MCP elicitation approval when checkpoint UI is enabled:
  `approval_policy = { granular = { mcp_elicitations = true } }`.
- Kept Codex `supportsStructuredQuestions` false; MCP elicitation is a
  transport capability, not the canonical question protocol.
- Added knowledge-gap and tacit-assumption checkpoint triggers.
- Removed the persistent HUD command surface from the CLI.
- Updated `doctor` and `status` to report Codex MCP configuration and MCP
  elicitation approval.
- Updated README and MCP/Codex docs to describe UI checkpoint opt-in and
  fallback behavior.

## Verification

```bash
npm run release:check
node packages/longtable-mcp/dist/server.js --self-test
node packages/longtable/dist/cli.js mcp install --provider codex --checkpoint-ui strong
node packages/longtable/dist/cli.js doctor --json
```
