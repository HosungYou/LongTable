# Panel Collaboration README

LongTable panel review is the primary collaborative surface. It makes role disagreement inspectable before the researcher commits to a claim, design, measurement plan, draft, or submission move.

LongTable team execution is disabled. Do not use `longtable team` or `longtable team --debate` for new work; route team-style requests through the panel surface and explicit debate-language requests through panel debate.

## Natural-Language First

Ask for the interaction you need inside the provider:

```text
Use a LongTable panel to review this methods section before I commit it.
Use editor and measurement-auditor perspectives as a panel before I revise.
Show unresolved disagreement before I decide how to frame this theory section.
lt debate: Argue both sides before I commit this measurement plan.
```

LongTable should route these requests to the panel surface and create a Researcher Checkpoint when the next step depends on the researcher's judgment. Explicit `lt debate:` requests create panel debate records under `.longtable/panel/`.

## Which Surface To Use

| Need | Natural request | CLI equivalent | Interaction depth |
| --- | --- | --- | --- |
| Multi-role review | Use a LongTable panel to review this before I commit it. | `longtable panel --prompt "..."` | independent |
| Team-style concern inspection | Use editor and measurement perspectives as a panel. | `longtable panel --role editor,measurement_auditor --prompt "..."` | independent |
| Structured disagreement | Keep unresolved disagreement visible before I decide. | `longtable panel --visibility always_visible --prompt "..."` | independent |
| Explicit debate | `lt debate: Argue both sides before I commit this plan.` | `longtable ask --prompt "lt debate: ..."` | debated |

Use `panel` whenever LongTable should coordinate multiple perspectives. The panel record should disclose consulted roles, disagreement, decision options, and the researcher-facing checkpoint.

## Scriptable Panel Review

Use the shell form when you need JSON, tests, or reproducible records:

```bash
longtable panel \
  --prompt "Review this measurement plan before I commit it." \
  --role editor,measurement_auditor \
  --json
```

The stable panel surface is `sequential_fallback`; native provider subagents are optional and must normalize back to the same panel record.

## Reading The Output

Check these fields first:

- `execution.stableSurface`: should be `sequential_fallback`
- `result.interactionDepth`: `independent` for panel review
- `run.interactionDepth`: `debated` for explicit panel debate
- `plan.members`: the consulted LongTable roles
- `questionRecord`: the pending Researcher Checkpoint

Direct team execution remains disabled; compatibility wording must not become the visible command surface again.
