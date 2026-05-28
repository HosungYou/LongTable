# Panel Collaboration README

LongTable panel review is the primary collaborative surface. It makes role disagreement inspectable before the researcher commits to a claim, design, measurement plan, draft, or submission move.

`longtable team` is not a public command surface. Route team-style requests through the panel surface and explicit debate-language requests through panel debate.

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

The stable panel surface is `sequential_fallback`. Codex can also request
LongTable-native role workers with `--native-workers` when the local runtime
supports them; use `--wait <ms>` when a bounded call should wait for completed
role result files. Provider-native subagents through `--native-subagents`
remain a compatibility adapter. Both native paths must normalize final role
outputs back to the same panel record.

Completed native worker runs are recorded into workspace evidence by
`longtable panel --native-workers --wait`, `longtable panel status --wait`, or
`longtable panel resume --wait`. When a provider or external worker returns real
role outputs outside that lifecycle, record them before generating a
continuation packet. Result files should include final summaries, claims,
objections, open questions, and evidence refs only; do not paste hidden
reasoning, raw tool traces, or tmux logs into LongTable state:

```bash
longtable panel record \
  --invocation <invocation_record_id> \
  --result-file panel-result.json

longtable handoff --cwd "<project-path>"
```

`longtable handoff` is the bridge from discussion to work. It creates a Markdown packet from the current Research Specification, panel records, unincorporated evidence, and pending checkpoints. Users without OMX can follow the provider-neutral section directly in Codex or Claude Code. Users with OMX can paste the same packet into `$ralplan` and then use `$ralph` as an external execution loop; LongTable remains the research-state source of truth.

## Reading The Output

Check these fields first:

- `execution.stableSurface`: should be `sequential_fallback`
- `result.interactionDepth`: `independent` for panel review
- `run.interactionDepth`: `debated` for explicit panel debate
- `plan.members`: the consulted LongTable roles
- `questionRecord`: the pending Researcher Checkpoint

Direct team execution remains removed from the public command surface; compatibility wording must not become visible workflow guidance again.
