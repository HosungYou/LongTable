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
longtable doctor --fix
longtable doctor --json
longtable codex hook-doctor --json
```

`doctor` and `status` are equivalent at the top level.
Advanced tests and custom installs can pass separate paths with
`--codex-dir`, `--claude-dir`, `--codex-prompts-dir`, `--codex-runtime-path`,
and `--claude-runtime-path`.

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
- active hard-stop blockers and whether Codex `Stop` would block now
- stale or unrelated pending question/obligation counts
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
- active hard-stop blockers that require decide, clear, defer, or DecisionRecord action
- healthy state with no immediate action needed

## Repair Mode

`longtable doctor --fix` repairs issues that do not require researcher judgment:

- install missing Codex skills
- install missing Claude Code skills
- remove stale legacy Codex prompt files
- regenerate Codex and Claude runtime artifacts from an existing setup profile

It does not create a setup profile. If setup is missing, run:

```bash
longtable setup --provider codex
```

This is intentional. Setup contains provider permissions and intervention
posture that should not be guessed by an automated repair command.

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
- Stop hard-stop: clear
- stale/unrelated pending questions: 0
- stale/unrelated pending obligations: 0

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

## Hard-stop diagnostics

`longtable doctor --json`, `longtable status --json`, and
`longtable codex hook-doctor --json` report the current Codex hook coverage and
LongTable Stop verdict. The additive fields are:

- `stopWouldBlock` / `hardStop.stopWouldBlock`
- `activeBlockers[]` with blocker id, type, scope, source, prompt/reason, and command hints
- `staleOrUnrelatedPendingQuestionCount`
- `nextActions[]`

Diagnostics are read-only unless `--fix` is used for install/trust repair.
Answer, clear, or explicitly defer hard-stop blockers with rationale before
treating a Research Specification change as settled.
