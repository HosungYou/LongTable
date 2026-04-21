# Team Debate Orchestration

## Decision

LongTable team debate is an inspectable research-harness protocol, not a
general worker-team runtime. It exists to slow closure by making role
disagreement visible before a researcher commits to a claim, design, draft, or
submission path.

The v1 execution model is file-backed by default. Tmux is an optional display
and live-note surface; it is not the source of truth.

## Command Surface

```bash
longtable team --debate --prompt "Review this measurement plan." --role editor,measurement_auditor,theory_critic
longtable team --debate --tmux --prompt "Review this measurement plan."
longtable team --debate --json --prompt "Review this measurement plan."
```

The v1 protocol uses fixed five-round debate. `--rounds 5` is accepted for
explicitness; other round counts are intentionally rejected until the protocol
has enough evaluation evidence.

## Artifact Contract

Each run writes a durable record under `.longtable/team/<teamId>/`:

```text
prompt.txt
plan.json
run.json
invocation.json
checkpoint.json
synthesis.json
round-1-independent/
round-2-cross-review/
round-3-rebuttal/
round-4-convergence/
```

The artifact directory is the canonical debate record. If the command runs
inside a LongTable workspace, LongTable also appends an `InvocationRecord` and a
pending `QuestionRecord` to `.longtable/state.json`, then refreshes `CURRENT.md`.
Workspace loading uses the current directory where `.longtable/` is found as
the authoritative project root, so moved or synced workspaces do not write to an
old absolute `projectPath` from another machine.

## Five-Round Protocol

1. Independent review
   - each role states claims, objections, open questions, evidence needs, tacit
     assumptions, and checkpoint triggers
2. Cross-review
   - each role challenges the likely blind spots of the other roles
3. Rebuttal and revision
   - each role revises or preserves its position after critique
4. Convergence and unresolved gaps
   - each role states what it can accept and what must remain open
5. Coordinator synthesis and checkpoint
   - LongTable records consensus, disagreement, unresolved gaps, and a
     researcher-facing checkpoint

The default stop policy is fixed completion. LongTable does not stop early when
roles appear to agree because premature consensus is one of the risks the
protocol is meant to expose.

## Researcher Authority

Team debate must not answer the final decision for the researcher. The expected
end state is:

```text
role debate -> synthesis -> Researcher Checkpoint -> DecisionRecord
```

The checkpoint asks whether to revise, gather evidence, proceed with risk, keep
the issue open, or enter another decision. This preserves LongTable's
researcher-centered contract while still allowing autonomous role disagreement
to surface.

## Tmux Behavior

When `--tmux` is passed, LongTable opens a tmux session with a coordinator pane
and role panes. The panes can add live role logs, but the file-backed run remains
the durable record. Tmux should never become mandatory for team debate.

## Non-Goals

- no worker queue
- no mailbox protocol
- no hidden agent-to-agent private transcript
- no autonomous final decision
- no replacement for `QuestionRecord -> DecisionRecord`
