# Researcher Checkpoints

## Name

LongTable should not expose `AskUserQuestionTool` as its product concept.

The LongTable name is **Researcher Checkpoint**.

Provider-native tools can still be used:

- Claude Code may expose a structured AskUserQuestion-style surface.
- Codex may expose a numbered-choice or terminal-style fallback.
- A future web app may render the same prompt as a form.

But the product-level concept is not the provider tool. The concept is the
moment where LongTable refuses to convert unresolved research judgment into a
silent AI decision.

## Why Not Just "Ask User Question"

`AskUserQuestion` is a transport primitive. It says that the model can ask the
user something.

LongTable needs a stronger contract:

- why the question appears now
- what research risk it protects
- which options are offered
- whether an answer is required or advisory
- how the answer changes state
- how the answer is linked to panel output, evidence, and later decisions

Without that contract, the platform can claim it has questions while still
closing too quickly.

## Relationship To OMX

OMX uses AskUserQuestion-style interactions mostly as structured workflow
checkpoints:

- planning feedback
- approval before execution
- configuration choices
- consensus-plan approval

The useful pattern is not the name of the tool. The useful pattern is that
high-stakes transitions become explicit, clickable, and stateful.

LongTable adopts that pattern but narrows it for research:

- the trigger is research commitment, not only workflow approval
- the options must preserve real researcher agency
- unanswered questions remain visible in `CURRENT.md`
- answers become `DecisionRecord`s, not just ephemeral approvals

## Lifecycle

```text
Research risk detected
  -> Researcher Checkpoint generated
  -> QuestionRecord written
  -> provider renders structured/native/numbered question
  -> researcher answers
  -> DecisionRecord appended
  -> linked invocation/panel/evidence updated
  -> CURRENT.md regenerated
```

## Record Model

LongTable currently stores checkpoints through these records:

- `QuestionRecord`: the pending or answered prompt
- `QuestionPrompt`: title, question, options, rationale, required flag, preferred surfaces
- `QuestionAnswer`: selected value, label, optional rationale, provider, surface
- `DecisionRecord`: durable commitment made from the answer
- `InvocationRecord`: panel or role call that produced the checkpoint

The technical name may stay `QuestionRecord`. The product name should be
Researcher Checkpoint.

## Trigger Policy

Ask proactively when one of these conditions is true:

- a research question is being frozen
- a theory anchor is being selected
- method, measurement, or analysis design is being committed
- tacit researcher context is being inferred
- a panel result would otherwise be collapsed into a single recommendation
- evidence is missing but the system is about to proceed
- the work is moving toward external submission, preregistration, or public sharing
- a product concept, platform term, README positioning, or checkpoint policy is being renamed or made authoritative

Do not ask just because asking is possible. Low-stakes drafting, private notes,
or reversible formatting changes can be logged without interruption.

## Meta-Decision Checkpoints

A **Meta-Decision Checkpoint** is required when LongTable itself is making a
platform decision that will shape future behavior.

Examples:

- naming or renaming a LongTable concept
- changing the README's product positioning
- changing question/checkpoint policy
- changing provider behavior for Codex or Claude Code
- deciding whether a transport primitive should become product language

This exists because platform language can quietly become product architecture.
For example, deciding to call the question layer `Researcher Checkpoint` should
not be committed without an explicit researcher decision.

## Other Option

Every Researcher Checkpoint that could be incomplete should expose an `other`
path.

LongTable supports this in state with:

- `allowOther: true`
- `otherLabel`
- a free-text answer normalized as `selectedValues: ["other"]`

The UI or fallback rendering must make this visible. It is not enough for
`allowOther` to exist internally if the researcher cannot see that they can
reject the offered categories.

## Question Quality

A good Researcher Checkpoint has:

- a short title
- a concrete reason for appearing now
- one focused question
- two to four meaningful options
- an `other` option when the offered categories may not cover the researcher's judgment
- an optional rationale field
- a clear record target

Bad checkpoint patterns:

- asking for generic approval after the AI has already decided
- offering one obviously correct option and several weak alternatives
- asking multiple unrelated questions at once
- asking what the system could inspect itself
- blocking without explaining the stakes

## Provider Mapping

| LongTable concept | Claude Code | Codex | Future MCP/Web |
| --- | --- | --- | --- |
| Researcher Checkpoint | native structured question when available | numbered choice fallback | structured transport |
| QuestionRecord | shared state | shared state | shared state |
| DecisionRecord | shared state | shared state | shared state |
| CURRENT.md pending view | regenerated file | regenerated file | regenerated file |

## Product Test

LongTable has not really implemented Researcher Checkpoints unless all of these
are true:

- the checkpoint appears before closure, not after
- the options are meaningful and non-manipulative
- `other` is visible when `allowOther` is true
- the reason for asking is visible
- pending questions survive session restart
- the answer becomes a decision record
- panel/evidence outputs can link back to the decision
