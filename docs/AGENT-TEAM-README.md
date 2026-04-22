# Agent Team README

LongTable agent teams are for research moments where one role's judgment should
not silently win. A team makes disagreement inspectable before the researcher
commits to a claim, design, measurement plan, draft, or submission move.

LongTable is still researcher-centered. Agent teams can surface conflict, but
they do not make the final decision. The durable contract remains:

```text
role work -> synthesis -> Researcher Checkpoint -> DecisionRecord
```

## Natural-Language First

Most researchers should not start by learning shell commands. Ask for the
interaction you need inside the provider:

```text
Use a LongTable panel to review this methods section before I commit it.
Use an agent team so the editor and measurement auditor inspect each other's concerns.
Debate this theory framework and keep unresolved disagreement visible.
```

LongTable should route that request to the appropriate surface and create a
Researcher Checkpoint when the next step depends on the researcher's judgment.

## Which Surface To Use

| Need | Natural request | CLI equivalent | Interaction depth |
| --- | --- | --- | --- |
| Quick multi-role review | Use a LongTable panel to review this before I commit it. | `longtable panel --prompt "..."` | independent |
| Agent team with role cross-review | Use an agent team so the roles inspect each other's concerns. | `longtable team --prompt "..."` | cross_reviewed |
| Longer structured disagreement | Debate this and keep unresolved disagreement visible. | `longtable team --debate --prompt "..."` | debated |

Use `panel` when you need role opinions quickly. Use `team` when you want roles
to inspect each other's claims before synthesis. Use `team --debate` when the
disagreement itself is the work.

## Scriptable Team Review

Use the shell form when you need JSON, tests, or reproducible artifacts:

```bash
longtable team \
  --prompt "Review this measurement plan before I commit it." \
  --role editor,measurement_auditor \
  --json
```

The default team protocol has three steps:

1. independent review
2. cross-review
3. coordinator synthesis and checkpoint

Cross-review means each role responds to another role's independent contribution.
If the record does not show those references, it should not be called a team
review.

## Scriptable Debate Mode

```bash
longtable team --debate \
  --prompt "Debate this theory framework and measurement strategy." \
  --role theory_critic,methods_critic,measurement_auditor
```

Debate mode has five fixed steps:

1. independent review
2. cross-review
3. rebuttal and revision
4. convergence and unresolved gaps
5. coordinator synthesis and checkpoint

Use debate mode when the researcher needs to see what each role can accept, what
it rejects, and what should remain open.

## What Gets Written

Every team run writes:

```text
.longtable/team/<teamId>/
  prompt.txt
  plan.json
  run.json
  invocation.json
  checkpoint.json
  synthesis.json
  round-1-independent/
  round-2-cross-review/
```

Debate runs also write:

```text
  round-3-rebuttal/
  round-4-convergence/
```

Inside a LongTable workspace, the run is linked to `.longtable/state.json` as an
`InvocationRecord` and a pending `QuestionRecord`. The preferred researcher path
is the provider's checkpoint UI. If UI elicitation is unavailable, answer the
same pending question with the CLI fallback:

```bash
longtable decide --question <question-id> --answer <value>
```

Add `--rationale "..."` only when you want that note in the decision log.

## Reading The Output

Check these fields first:

- `execution.surface`: whether this used file-backed artifacts or another provider surface
- `run.interactionDepth`: `independent`, `cross_reviewed`, or `debated`
- `run.rounds`: the role contributions by round
- `respondsToContributionId`: proof that a cross-review responded to a prior role contribution
- `questionRecord`: the decision shown in UI or kept pending for fallback before closure

## Good Prompts

```text
Use an agent team to review this measurement plan. Show where the editor and
measurement auditor disagree before synthesis.
```

```text
Debate whether this study design can support the trust calibration claim. Keep
the theory, methods, and measurement disagreements visible.
```

```text
Run a team review before I revise this manuscript section. I want the reviewer,
voice keeper, and methods critic to inspect each other's concerns.
```

## Boundaries

Agent teams are not a general worker runtime. LongTable does not use hidden
mailboxes, worker claims, or autonomous final decisions. The goal is not to make
agents replace the researcher; it is to make role disagreement explicit enough
that the researcher can decide responsibly.
