# @longtable/mcp

MCP transport for LongTable workspace state and Researcher Checkpoints.

This package does not own LongTable state. It exposes structured tools over the
existing `.longtable/` source of truth.

Server name:

```text
longtable-state
```

Run:

```bash
npx -y @longtable/mcp@0.1.30
```

Self-test:

```bash
longtable-state --self-test
```

Codex UI Researcher Checkpoints are opt-in from the CLI:

```bash
longtable mcp install --provider codex --checkpoint-ui strong --write
```

If MCP elicitation is unavailable or not approved, the server returns the same
pending `QuestionRecord` as a numbered fallback.

Provider guidance should use `elicit_question` first when the MCP tool is
available. `longtable question --print` is only the CLI fallback transport.
