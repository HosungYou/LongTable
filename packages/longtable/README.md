# @longtable/cli

The researcher-facing LongTable CLI for Codex and Claude.

## Install

```sh
npm install -g @longtable/cli@next
longtable setup
```

Setup installs exactly two skills:

- `$longtable` — bounded research diagnosis, Research Brief, workspace state, and Research Assurance routing
- `$longtable-research` — journal discovery, lawful evidence acquisition, extraction, synthesis, editable visuals, and Verified Research Package

Deprecated `--surface full` is accepted for compatibility but still installs only these two skills and prunes obsolete LongTable start, interview, panel, and role folders.

## Canonical commands

```sh
longtable status --cwd .
longtable assure --prompt "Review the unresolved evidence risk." --json
longtable research run --brief research-brief.json --cwd .
longtable research resume --pdf-dir ./lawful-pdfs --pdf-access manual_legitimate_access --cwd .
longtable research record-journal-profile --profile target-journal-profile.json --cwd .
longtable research verify --cwd . --json
```

`longtable panel` and `longtable scholar-research` remain one-release aliases. Historical `PanelPlan`, `PanelResult`, and `.longtable/research-runs/` records are not rewritten.

## Completion boundary

`completed` requires a read-back Verified Research Package with the Research Brief, human-accepted target-journal profile, lawful access plan, corpus and evidence manifests, synthesis, human-reviewed editable visuals, Research Assurance records, limitations, reproduction command, hashes, and passing verification report.

## Safety

LongTable supports public OA, lawful user-supplied PDFs, licensed TDM, and manual institutional-browser handoff. It does not automate institutional login or store credentials, cookies, or tokens, and it does not bypass paywalls, WAFs, robots controls, VPN restrictions, or proxies.

## Development

```sh
npm run build --workspace @longtable/cli
npm run typecheck --workspace @longtable/cli
```
