# LongTable 0.1.24 Release Notes

## MCP-First Researcher Checkpoints

LongTable now treats MCP elicitation as Codex's preferred checkpoint UI when the
`elicit_question` tool is available. Generated provider guidance tells Codex to
use MCP first and reserve `longtable question --print` for clients that cannot
show, approve, or accept MCP elicitation.

Accepted MCP elicitation answers are recorded with `surface: mcp_elicitation`,
so the state layer can distinguish native MCP UI answers from numbered CLI
fallback answers.

## Trigger Classifier

- Exploration prompts that explicitly signal uncertainty or knowledge gaps are
  less likely to be mistaken for method commitments merely because they mention
  study design as one candidate.
- Panel disagreement collapse is now a required review checkpoint when the
  prompt asks LongTable to synthesize and choose a framing from unresolved role
  conflict.

## Packaging

- Workspace packages are aligned on version `0.1.24`.
- MCP install snippets now point to `@longtable/mcp@0.1.24`.
