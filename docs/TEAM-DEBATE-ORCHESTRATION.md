# Panel Debate Orchestration

`longtable team` is not a public command surface. The current collaborative surface is `panel`.
Explicit debate-language requests use panel debate records, not a separate team
command.

Use these replacements:

```bash
longtable panel --prompt "Review this measurement plan." --role editor,measurement_auditor --json
longtable panel --provider codex --native-workers --prompt "Review this measurement plan." --json
longtable panel --prompt "Keep unresolved disagreement visible before I decide." --visibility always_visible --json
longtable ask --prompt "lt debate: Debate this measurement plan before I commit." --json
```

`--native-workers` is a LongTable-native Codex runtime option for durable role
worker execution. It does not make `longtable team` public again. Native worker
outputs must be recorded as final `PanelResult` role summaries and evidence
references before `longtable handoff`; hidden reasoning, raw tool traces, and
tmux logs stay out of researcher-facing state.

Panel debate artifacts are written under `.longtable/panel/<id>/`. The older
`.longtable/team/<id>/` artifact contract is retained only as historical context
for existing workspaces that already contain those records. New help, provider
skills, and routing should not recommend `longtable team` or
`longtable team --debate`.
