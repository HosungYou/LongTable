# In-Codex Setup

## Goal

LongTable should let a researcher begin setup without leaving Codex, but this must not become the primary promised onboarding path until it is proven to work on the user's real Codex build.

## Constraint

Codex custom prompts are the easiest in-session entry point, but they are not a full plugin runtime by themselves.
So in-session setup must be treated as a guided overlay, not as a hidden replacement for the setup package.

## Current Approach

When the user's Codex build exposes installed prompt files, `/prompts:longtable-init` can handle the conversational side:

- one question at a time
- numbered choices
- explicit `None of the above` fallback
- no premature closure

Persistence still belongs to the setup/runtime layer.

The first implementation therefore ends with one of two outcomes:

1. the researcher gets the exact `longtable codex persist-init ... --install-prompts` command to persist setup
2. the researcher gets a strict JSON block and can pipe it into `longtable codex persist-init --stdin --install-prompts`

## Why This Is Acceptable

The priority is to make setup possible from inside Codex without pretending the underlying persistence layer does not exist.

That keeps the system honest:

- conversation happens in-session
- persistence remains explicit
- the researcher still sees what is being written

## Product rule

The default onboarding story should still be:

- `longtable init`
- then `longtable start`
- then `cd "<project-path>" && codex`

The important distinction is:

- `init` and `start` are terminal commands
- the research conversation begins after Codex is opened inside the created project directory

In-Codex setup is an optional integration path, not the baseline user journey.

## Next Step

The current persistence bridge is `longtable codex persist-init`.

If this path proves useful, the next evolution is not more prompt complexity.
It is a dedicated persistence bridge that Codex can call directly from the LongTable init flow without making the researcher manually retype setup fields.
