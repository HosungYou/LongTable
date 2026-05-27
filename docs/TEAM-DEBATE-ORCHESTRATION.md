# Panel Debate Orchestration

LongTable team execution is disabled. The current collaborative surface is `panel`.
Explicit debate-language requests use panel debate records, not a separate team
command.

Use these replacements:

```bash
longtable panel --prompt "Review this measurement plan." --role editor,measurement_auditor --json
longtable panel --prompt "Keep unresolved disagreement visible before I decide." --visibility always_visible --json
longtable ask --prompt "lt debate: Debate this measurement plan before I commit." --json
```

Panel debate artifacts are written under `.longtable/panel/<id>/`. The older
`.longtable/team/<id>/` artifact contract is retained only as historical context
for existing workspaces that already contain those records. New help, provider
skills, and routing should not recommend `longtable team` or
`longtable team --debate`.
