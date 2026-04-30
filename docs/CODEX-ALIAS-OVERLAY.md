# Codex Skill Surface

## Decision

LongTable's Codex-native surface is generated Codex skills, not `/prompts`
slash commands.

Current Codex CLI builds may keep prompt files under `~/.codex/prompts/`, but
they do not necessarily expose `/prompts:...` in the interactive command parser.
Therefore `/prompts` must be treated as legacy/experimental and must not be
documented as the promised user experience.

## Target Surface

Install:

```bash
longtable codex install-skills
```

Generated files:

```text
~/.codex/skills/
  longtable/SKILL.md
  longtable-interview/SKILL.md
  longtable-methods/SKILL.md
  longtable-measure/SKILL.md
  longtable-theory/SKILL.md
  longtable-reviewer/SKILL.md
  longtable-voice/SKILL.md
```

The compact surface above is the default. The legacy full surface remains
available with `longtable codex install-skills --surface full`.

Expected user-facing invocation:

```text
longtable: help me narrow this project
lt explore: where should I start?
lt panel: review this methods section
use the LongTable methods critic on this design
```

When a Codex build exposes explicit skill shortcuts, `$longtable` is the manual
entrypoint.

## Why

The product behavior should match how users actually invoke Codex capabilities.
Prompt files are not enough if the active Codex build rejects `/prompts`.

Generated skills also better match the Claude Code plugin/skill model:

- one native entrypoint such as `longtable`
- a small compact set of role-specific shortcuts backed by router behavior
- natural-language triggers
- provider-specific files generated from one LongTable role registry

## Legacy Prompt Files

`longtable codex install-prompts` remains available only as a compatibility
bridge. It may write files under `~/.codex/prompts/`, but LongTable must not
promise that those files become slash commands.

Use this only for local experiments:

```bash
longtable codex install-prompts
```

## Product Rule

The guaranteed Codex path is:

1. `longtable init --provider codex --install-skills`
2. `longtable start`
3. open Codex in the project directory
4. invoke naturally with `longtable: ...`, `lt review: ...`, or `lt panel: ...`

The shell commands `longtable ask`, `longtable review --role ...`, and
`longtable panel --json` remain scriptable/debuggable surfaces, not the primary
researcher UX.
