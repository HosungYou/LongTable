# @longtable/mcp

MCP transport for LongTable workspace state, `$longtable-start`,
`$longtable-interview`, and
Researcher Checkpoints.

This package does not own LongTable state. It exposes structured tools over the
existing `.longtable/` source of truth.

Server name:

```text
longtable-state
```

Run:

```bash
npx -y @longtable/mcp@next
```

Self-test:

```bash
longtable-state --self-test
```

Codex UI Researcher Checkpoints are opt-in from the CLI:

```bash
longtable mcp install --provider codex --checkpoint-ui strong --write
```

Modern MCP clients receive `input_required`; the server does not hold a
60-second elicitation request open. The 2025 compatibility shim uses a 24-hour
per-round watchdog by default. In either era, interruption leaves the same
pending `QuestionRecord` resumable instead of creating a replacement.

Provider guidance should use interview tools for `$longtable-start`.
`$longtable-interview` is post-start and should route back to
`$longtable-start` when no usable Research Specification exists:

- `create_workspace`
- `begin_interview`
- `append_interview_turn`
- `summarize_interview`
- `cancel_interview`
- `confirm_first_research_shape`

For later Researcher Checkpoints, provider guidance should use
`elicit_question` first when the MCP tool is available. `longtable
question --print` is only the CLI fallback transport.
