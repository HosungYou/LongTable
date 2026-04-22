# LongTable 0.1.26 Release Notes

## Researcher-Facing UX

- Root README now centers researchers as the primary audience.
- Researcher Checkpoints are documented as Codex UI-first when setup enables
  MCP plus checkpoint UI.
- Required checkpoints are now described as blocking `ask`, mode, panel, team,
  and debate commands until the researcher records a decision.
- The older clarification-card product term has been removed in favor of
  focused follow-up questions.

## Agent Team Routing

- `lt team:` and `lt debate:` now route natural-language requests into team or
  debate execution.
- Less explicit multi-perspective requests use checkpoint classifier stakes to
  choose panel, team, or debate.
- Team and debate continue to write durable file-backed artifacts under
  `.longtable/team/<id>/`.

## Removed Console Surface

- Removed the local team console surface and related setup state.
- Team/debate execution no longer depends on a live local console; the artifact
  directory and `.longtable/` state remain the source of truth.

## Verification

- `npm test`
- repository and local setup searches confirm no remaining console-surface
  references in source, docs, or active setup state.
