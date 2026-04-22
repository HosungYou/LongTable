# LongTable 0.1.31 Release Notes

## Summary

LongTable 0.1.31 redesigns `longtable start` as an adaptive research start
interview and replaces the fragile raw-key terminal selector with a renderer
adapter backed by `@clack/prompts`.

## Technical Changes

- Added a `PromptRenderer` layer for CLI prompts, with Clack-backed
  `text`, `select`, `multiselect`, cancel handling, and non-TTY fallback.
- Removed the manual `readline` raw-mode arrow renderer that redrew menus via
  cursor-up escape sequences and naive line counts.
- Changed `longtable start` from a fixed nine-question setup survey to a
  scene/problem-first adaptive interview.
- Added `StartInterviewSession`, `StartInterviewTurn`, and
  `StartInterviewSignal` session state for preserving interview turns without
  turning them into checkpoint `QuestionRecord`s.
- Added lightweight inference for early lenses such as phenomenon, audience,
  artifact, evidence, tacit assumption, decision risk, and voice.
- Replaced deprecated taxonomy-style start questions such as "knowledge gap,
  coding rule gap, or data gap" with scene/material/evidence-oriented open
  questions.
- Updated MCP package version constants, npm package metadata, package-lock
  workspace dependency versions, README snippets, MCP docs, and search
  user-agent strings to `0.1.31`.

## Fallback Behavior

- Interactive terminals use the Clack renderer.
- Non-TTY starts continue to work through line-based stdin prompts.
- `QuestionRecord` remains reserved for researcher checkpoints; start
  interview turns persist in session and working state instead.

## Verification

- `npm test`
- `npm run build`
- `npm run smoke:setup`
- `npm run smoke:checkpoints`
- `npm run smoke:search`
- `npm run typecheck`
