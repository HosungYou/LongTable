# LongTable 0.1.59

LongTable 0.1.59 makes researcher checkpoints easier to answer in Codex by
showing contextual Decision Cards and by routing supported Codex sessions
through the tmux question renderer.

## Changes

- Adds `tmux_popup` as a preferred Codex checkpoint surface for pending
  `QuestionRecord` decisions.
- Adds `longtable question --surface tmux_popup` and `longtable decide
  --surface tmux_popup` transport recording for CLI checkpoint flows.
- Replaces raw slash-style option lists with Decision Cards that show the
  blocker, recommended option, concrete choices, and a fallback command.
- Generates panel and debate handoff options from the actual blocker context
  instead of forcing a fixed five-choice list.
- Adds Korean labels for Korean checkpoint prompts where the decision context
  is Korean.
- Records accepted transport status on answered checkpoint records so UI
  surface behavior can be audited after the fact.

## Verification

- `npm run release:check`
- `git diff --check`
- real tmux renderer smoke: `renderer=tmux-pane`, `transport.surface=tmux_popup`
- checkpoint routing smoke
- Codex hook smoke
- panel handoff smoke
