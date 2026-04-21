# LongTable Doctor

`longtable doctor` is the provider and project health check.

It exists because LongTable has two kinds of runtime surface:

- provider adapters, such as Codex skills and Claude Code skills
- project state, stored under `.longtable/`

The provider files help Codex or Claude Code notice LongTable naturally. They are
not the source of truth. The source of truth remains the LongTable role registry,
checkpoint rules, and project state.

## Commands

```bash
longtable doctor
longtable status
longtable doctor --json
```

`doctor` and `status` are equivalent at the top level.

## What It Checks

- global LongTable setup
- Codex runtime artifact
- Codex skills
- legacy Codex prompt files
- Claude runtime artifact
- Claude Code skills
- nearest `.longtable/` workspace
- recent invocation records
- pending question records
- recorded decisions

## Why This Matters

Provider-native behavior is session-dependent. A Codex build may expose skills
but reject slash prompt commands. Claude Code may offer structured questions, but
LongTable still needs a provider-neutral fallback so the same project can move
between Codex and Claude Code.

`doctor` makes this visible. It distinguishes:

- missing provider adapters
- stale legacy prompt files
- missing project state
- pending researcher decisions
- healthy state with no immediate action needed

## Expected Healthy Shape

For a machine that uses both Codex and Claude Code, a healthy install usually
looks like this:

```text
LongTable doctor
- setup: present

Codex:
- command: present
- runtime artifact: present
- skills: 12/12 installed
- missing skills: none
- legacy prompt files: 0

Claude:
- command: present
- runtime artifact: present
- skills: 12/12 installed
- missing skills: none

Workspace:
- project: <project name>
- invocations: <n>
- questions: <n> (<pending> pending, <answered> answered)
- decisions: <n>
```

If the current directory is not inside a LongTable workspace, that is not an
error. It means `doctor` can only check global provider setup until you pass
`--cwd <project>` or run it inside a project directory.

