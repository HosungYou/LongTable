# @longtable/cli

Researcher-facing CLI for LongTable.

LongTable is an npm-first, provider-neutral research harness. It keeps the core
product contract in project files and shared packages, while Codex skills,
Claude skills, and future MCP surfaces remain generated adapter artifacts.

The basic contract is:

1. seed the researcher profile once
2. create a workspace for each project
3. continue the research conversation inside that workspace
4. preserve decisions, tensions, and evidence as durable project state

## Install

```bash
npm install -g @longtable/cli
```

The npm install only installs the CLI. It does not write Codex skills, MCP
config, hooks, or provider runtime files without explicit setup approval.

## Primary Flow

```bash
longtable setup --provider codex
longtable start
cd "<project-path>"
codex
```

`longtable setup --provider codex` is the permission-first setup route. It asks
where LongTable may install support, which runtime surfaces it may enable, how
strongly it may interrupt research decisions, and whether to create a project
workspace now. `longtable init` remains only as a deprecated compatibility alias.

Return later:

```bash
cd "<project-path>"
longtable resume
codex
```

## What `longtable start` Creates

```text
<project>/
  AGENTS.md
  CURRENT.md
  .longtable/
    project.json
    current-session.json
    state.json
    sessions/
```

## Artifact Contract

- `AGENTS.md`: runtime guidance for Codex
- `CURRENT.md`: human-facing current view regenerated from state
- `.longtable/project.json`: stable project identity
- `.longtable/current-session.json`: current session cursor
- `.longtable/state.json`: layered memory state
- `.longtable/sessions/`: historical snapshots

## Why This Shape

The CLI tries to keep the root simple for novice researchers while preserving enough structure for power users and downstream tooling.

The memory model distinguishes:

- explicit state
- working state
- inferred hypotheses
- open tensions
- narrative traces

This is how LongTable avoids turning tacit knowledge into fake certainty.

## Commands

```bash
longtable setup
longtable start
longtable resume --cwd "<project-path>"
longtable roles
longtable ask --cwd "<project-path>" --prompt "..."
longtable panel --prompt "..."
longtable sentinel --prompt "Should I define a new measurement construct?"
longtable team --prompt "Review this measurement plan." --role editor,measurement_auditor --json
longtable team --debate --prompt "Review this measurement plan." --role editor,measurement_auditor --json
longtable codex install-skills
longtable claude install-skills
```

Useful structured routes for scripts and debugging:

```bash
longtable panel --prompt "review this methods section" --json
longtable review --role methods_critic,measurement_auditor --panel --prompt "review this methods section" --json
longtable ask --prompt "lt panel: show the disagreement before I commit" --json
```

## Inside Codex

Natural language should be the default.

Codex UI Researcher Checkpoints are a core LongTable feature when enabled:

```bash
longtable setup --provider codex --surfaces skills_mcp --checkpoint-ui strong
```

That setup writes the MCP configuration and Codex elicitation approval needed
for form-style checkpoint prompts. Without it, LongTable keeps the same
`QuestionRecord` pending and falls back to numbered text.

Explicit short forms are available when needed:

```text
lt explore: Where should I narrow the question first?
lt review: What is weak in this claim?
lt panel: Show me the disagreement before I commit.
lt methods: Where is the design vulnerable?
```

Provider-native surfaces are available when installed:

```bash
longtable codex install-skills
longtable claude install-skills
```

Codex skills include `longtable`, `longtable-panel`, and generated role-specific
skills such as `longtable-methods-critic`. If your Codex build exposes explicit
skill shortcuts, `$longtable` is the manual entry. Do not depend on `/prompts`;
current Codex builds may reject it.

Claude Code skills include `longtable`, `longtable-panel`, and generated
role-specific skills such as `longtable-methods-critic`. They are adapter files
generated from the LongTable role registry.

## Panel Orchestration

Panel orchestration is for moments where disagreement matters: methods risk,
measurement validity, theory fit, literature positioning, and claims that need
challenge before they become project memory.

The CLI creates a provider-neutral `PanelPlan` and returns a planned
`PanelResult`. When native subagents are unavailable, LongTable uses a stable
sequential fallback prompt. That keeps the same research semantics available in
Codex and Claude Code without making either provider's native question or agent
tool the source of truth.

Inside a LongTable project workspace, panel planning also appends an
`InvocationRecord` to `.longtable/state.json`, creates a pending follow-up
`QuestionRecord`, and refreshes `CURRENT.md`.

Default panel roles include:

- `reviewer`
- `methods_critic`
- `measurement_auditor`
- `theory_critic`

Use `--role` to constrain the panel when the research problem is already clear.

## Sentinel And Agent Team

`longtable sentinel` is an explicit gap/tacit check for prompts that may contain
measurement, theory, method, evidence, authorship, or tacit-assumption risks.
Use `--record` inside a LongTable workspace to store the finding as an
unconfirmed inferred hypothesis.

`longtable team` creates a file-backed agent-team review under
`.longtable/team/<id>/`: independent review, cross-review, and
synthesis/checkpoint. Use it when roles should inspect each other's concerns
before LongTable proposes a researcher decision.

`longtable team --debate` creates a fixed five-round debate record under
`.longtable/team/<id>/`: independent review, cross-review, rebuttal,
convergence, and synthesis/checkpoint. The file-backed artifact directory is
the source of truth.

See `docs/AGENT-TEAM-README.md` in the repository for a user-facing guide to
panel, team, and debate surfaces.

## Evidence And Search Direction

LongTable should not behave like a generic web scraper. Research search should
start from scholarly routes when the user needs literature discovery, citation
verification, publication metadata, or evidence-backed research decisions.

`longtable search` routes research queries through arXiv, Crossref, OpenAlex,
Semantic Scholar, PubMed/NCBI, ERIC, DOAJ, and Unpaywall, then normalizes,
deduplicates, ranks, and labels results as evidence cards. Some sources work
without keys, some require a contact email, and some need API keys for reliable
use.

Publisher access is configured separately through environment variables and
DOI probes. `longtable search setup` checks Elsevier, Springer Nature, Wiley,
and Taylor & Francis credentials or TDM tokens without storing secrets.

Citation support should be checked explicitly. A reference can be useful as
background while still failing to support the specific claim attached to it.

```bash
longtable search setup
longtable search probe --doi "10.1016/example" --publisher elsevier
longtable search --query "trust calibration measurement" --intent measurement
longtable search --query "trust calibration measurement" --publisher-access --json
longtable search --query "trust calibration citation support" --intent citation --record
```

See:

- [Research Search](https://github.com/HosungYou/LongTable/blob/main/docs/RESEARCH-SEARCH.md)
- [Evidence Policy](https://github.com/HosungYou/LongTable/blob/main/docs/EVIDENCE-POLICY.md)
- [LongTable Command Surface](https://github.com/HosungYou/LongTable/blob/main/docs/LONGTABLE-COMMAND-SURFACE.md)

## Validation

```bash
npm install
npm run typecheck
npm run build
```
