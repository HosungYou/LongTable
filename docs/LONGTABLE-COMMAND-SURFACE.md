# LongTable Command Surface

## Decision

LongTable should expose a small researcher-facing workflow:

1. `longtable setup`
2. `$longtable-start`
3. `$longtable-interview` after a Research Specification exists
4. natural in-session directives such as `lt explore:`, `lt review:`, and
   `lt panel:`

The CLI remains available for setup, diagnostics, scripted workspace creation,
state inspection, search, and tests. The main research conversation happens
inside the provider runtime.

## Primary Surfaces

### `longtable setup`

Permission and runtime setup:

- provider: Codex or Claude Code
- install scope: user, project, or none
- runtime surfaces: skills, MCP, sentinel, or CLI only
- checkpoint intervention posture
- launch guidance for the provider-native start flow

`longtable init` remains a deprecated compatibility alias.

### `$longtable-start`

Provider-native research start:

- create or resume `.longtable/`
- ask one open natural-language question at a time
- avoid early reader/reviewer contribution framing
- avoid forcing theory/method/measurement categories before the researcher has
  described the problem
- preserve interview turns when MCP/state tools are available
- store a First Research Shape only as a short resume handle
- create or update the fuller Research Specification when the interview has
  enough material
- use structured option UI only for final specification confirmation,
  short-handle stop points, or true checkpoint boundaries

### `$longtable-interview`

Post-start structured interview:

- only runs option-first when a usable Research Specification exists
- routes to `$longtable-start` when no spec exists
- treats First Research Shape without Research Specification as incomplete start
  state
- uses small bounded choice sets for spec revisions, checkpoint resolution,
  evidence boundaries, coding rules, methods choices, or protected decisions
- includes an escape hatch such as Other, free text, or one open follow-up
  question
- records changes as a Research Specification patch, DecisionRecord, or open
  tension rather than silently overwriting state

### `longtable start`

Automation fallback:

- useful for scripts and smoke tests
- can create a workspace from explicit flags
- should not be presented as the primary research-start experience

## Question Transport

LongTable state is canonical. Provider UI is transport.

Supported question surfaces:

- MCP/native structured elicitation when available
- terminal selector when interactive TTY input and output are available
- numbered/plain-text fallback everywhere else

Tmux is not a LongTable core requirement. If an OMX-style Codex popup transport
is added, it must be documented as optional, attached-tmux-only, and backed by
the standard fallback path.

## Supporting Commands

```bash
longtable resume --cwd "<project-path>"
longtable doctor
longtable status --cwd "<project-path>"
longtable roles
longtable question --prompt "<decision context>"
longtable decide --question <id> --answer <value>
longtable spec read --cwd "<project-path>"
longtable search --query "<topic>"
longtable codex install-skills
longtable claude install-skills
longtable mcp install --provider all
```

## Non-Goals

- Do not make provider-specific UI the product contract.
- Do not make tmux required for research-start or checkpoint behavior.
- Do not split start and interview into duplicated engines.
- Do not treat First Research Shape as the substantive endpoint.
