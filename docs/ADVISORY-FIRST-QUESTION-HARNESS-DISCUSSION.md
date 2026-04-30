# Advisory-First Question Harness Discussion

## Purpose

This discussion records the product and engineering direction for LongTable's
question harness after the 0.1.39 compact skill surface release. The first
implementation ships in 0.1.40.

The main decision is to separate "LongTable should notice a missing question"
from "LongTable should stop the researcher with a required checkpoint." The
system should think about questions often, but interrupt rarely.

## Discussion Summary

LongTable's Researcher Checkpoint is not just a question in chat. It is a
stateful execution-control mechanism:

```text
QuestionRecord
-> provider transport such as MCP elicitation or numbered fallback
-> pending state
-> researcher answer
-> DecisionRecord
-> CURRENT.md and state sync
```

A normal response question is lighter:

```text
assistant response
-> optional advisory questions
-> no pending state
-> no hook re-surfacing
-> no DecisionRecord
```

The platform should prefer normal response questions for missing context and
use checkpoints only when the assistant would otherwise settle a research
commitment on behalf of the researcher.

## Interview Handoff And Quiet Hook Policy

The advisory-first principle also applies to `$longtable-interview`. A pending
Researcher Checkpoint from another thread should not hijack the interview. It can
be shown as a separate unresolved checkpoint, but it becomes blocking only when
the researcher is confirming, saving, or recording a research decision.

The interview should be quiet during normal turns. `UserPromptSubmit` should not
repeat active-interview context after every researcher message. It should surface
that context only for explicit `$longtable-interview` invocations, First Research
Shape confirmation, or other research-state closure prompts.

Each interview answer is recorded through `append_interview_turn` when MCP is
available. The durable record stores the question, answer, reflection, quality,
follow-up need, and any readiness rationale. This trace supports later work by
making the eventual First Research Shape inspectable rather than treating it as a
chat-only summary.

Interview closure is content-based, not turn-count-based. LongTable should not
summarize merely because three usable turns have occurred. It should summarize
only when the trace contains enough context to support later research work:

- research object
- focal uncertainty
- construct or boundary
- evidence, material, or first inspection target
- protected decision
- concrete next action

Some projects may be ready quickly; others may need ten or more turns. If these
elements are still vague, LongTable should ask one more natural-language question
instead of forcing a First Research Shape.

The one-question-at-a-time rule is a soft interview norm, not a brittle
validator. A follow-up should focus on one main uncertainty and wait for the
researcher, while still allowing a short sentence that names nearby tensions for
context. The failure to avoid is turning an interview turn into a numbered
questionnaire or bundling several separately answerable questions into one
prompt.

The final confirmation should be the first structured option UI in the interview.
When the researcher's language is Korean, labels should be shown in Korean, with
options such as `저장/확정`, `한 질문 더`, `수정`, and `열어두기`. If the
researcher explicitly cancels the interview, the active interview hook should be
marked `cancelled`; casual topic shifts should not cancel durable state.

The earlier eager checkpoint policy created false positives in product and
tooling conversations. Examples included LongTable skill-surface design,
hook-debugging, release work, and documentation requests. These should not
create required Researcher Checkpoints because they are not research-content
commitments by the researcher.

## Target Pipeline

The next harness should use a staged decision pipeline:

```text
User prompt
-> context bundle
-> scenario classification
-> research-stakes scoring
-> question opportunity extraction
-> commitment and closure detection
-> surface decision
-> response, advisory questions, or required checkpoint
-> state and evaluation feedback
```

The key output decision is one of:

- `continue_with_assumptions`
- `ask_advisory_questions`
- `create_required_checkpoint`

This should not be a keyword-only detector. Keywords can provide weak cues, but
the final surface decision should depend on scenario, stakes, reversibility,
and whether the model would otherwise choose for the researcher.

## Required Checkpoint Conditions

Create a required checkpoint only when all of the following are true:

- The request is about research content, not LongTable product/tooling work.
- The next action would settle or materially change a research commitment.
- The commitment affects construct definition, measurement rule, method,
  analysis assumption, ethics/participant risk, authorship voice, or external
  submission.
- The researcher has not already provided the needed decision in the current
  prompt.

Common required-checkpoint cases:

- Freezing a research construct or theoretical boundary.
- Treating a measurement proxy as valid for an outcome.
- Choosing an analysis/modeling assumption that changes interpretation.
- Applying a disputed protected decision to a manuscript.
- Moving to submission, preregistration, public sharing, or IRB-sensitive use.

Do not create a required checkpoint for:

- Product UX, hooks, skill surface, MCP, installation, release, or documentation
  discussion.
- Reversible drafting or formatting.
- Requests that only ask for a plan, explanation, diagnostic, or comparison.
- Advisory question lists where the user has not asked the model to commit an
  answer.

## Action Items

1. Split question generation into advisory and required paths.
   - Advisory questions appear in the assistant response and do not create
     pending `QuestionRecord`s.
   - Required checkpoints create durable `QuestionRecord`s only after the
     policy confirms research commitment risk.

2. Add a scenario classifier before checkpoint generation.
   - Required scenario labels: `product_tooling_discussion`,
     `research_exploration`, `measurement_design`, `methods_design`,
     `manuscript_revision`, `analysis_commitment`, `ethics_risk`,
     `submission_or_publication`.
   - `product_tooling_discussion` must be a negative gate for required
     checkpoints.

3. Add commitment and reversibility detection.
   - Distinguish "explain/plan/discuss" from "apply/finalize/submit/record."
   - Treat reversible drafts as advisory unless protected research decisions are
     being silently settled.

4. Update existing policy docs.
   - Revise `QUESTION-POLICY.md` sections that say every detected knowledge gap
     should trigger a required question.
   - Revise `CHECKPOINT-TRIGGERING.md` so meta/product decisions are handled as
     ordinary product governance, not Researcher Checkpoints in research
     workspaces.

5. Expand regression tests.
   - False positives: product UX discussion, compact skill-surface discussion,
     hook debugging, release work, documentation requests, and "동의해. 그렇게
     진행한다면..." in a product-design context.
   - True positives: manuscript finalization that settles a protected research
     decision, measurement proxy commitment, analysis assumption commitment, and
     ethics/IRB-sensitive commitment.

6. Keep state hygiene.
   - Preserve answered `DecisionRecord`s.
   - Prune false-positive cleared questions with `longtable prune-questions`.
   - Do not store advisory questions as pending state.

## Procedure To Reach The Goal

1. Define the classifier contract.
   - Input: prompt, workspace session, protected decision, current blocker,
     pending questions, and invocation context.
   - Output: scenario label, stakes score, commitment level, reversibility, and
     recommended surface.

2. Implement the negative gate first.
   - If scenario is product/tooling/documentation/release/setup, return
     `continue_with_assumptions` or `ask_advisory_questions`, never
     `create_required_checkpoint`.

3. Implement advisory-first follow-up generation.
   - Allow LongTable to surface missing research questions in normal responses
     without writing state.
   - Limit advisory questions to the smallest set that would change the next
     step, usually one to three.

4. Restrict required checkpoint creation.
   - Create state only when the classifier confirms non-reversible research
     commitment risk.
   - Keep the existing `QuestionRecord -> DecisionRecord` lifecycle for those
     cases.

5. Update docs and release notes.
   - Make advisory-first the canonical policy.
   - Treat provider UI, MCP elicitation, and numbered prompts as transports for
     required checkpoints only.

6. Run release gates.
   - Run build, smoke tests, question audit, role audit, typecheck, and pack
     dry-run through `npm run release:check`.
   - Install locally and verify real hook behavior in a LongTable workspace.

## Evaluation Method

Evaluate the new harness with a labeled prompt corpus:

- False-positive product/tooling prompts should produce no pending
  `QuestionRecord`.
- Advisory research prompts should produce response-level questions only.
- Required research commitment prompts should produce pending
  `QuestionRecord`s and explain the protected research risk.
- Existing answered decisions should remain untouched.

Minimum acceptance checks:

```text
product/tooling prompt
-> hook output: none or non-blocking context
-> pendingQuestions: 0

advisory research prompt
-> assistant response includes necessary questions
-> pendingQuestions: 0

required commitment prompt
-> exactly one focused required checkpoint unless multiple independent
   commitments are explicitly requested
-> pendingQuestions > 0
-> checkpoint rationale names the research risk
```

Operational metrics:

- False-positive checkpoint rate on product/tooling prompts: 0 in the smoke
  corpus.
- Advisory-to-required ratio: advisory should be the majority surface for
  exploratory and planning prompts.
- Required checkpoint precision: every required checkpoint should identify a
  concrete research commitment, not only a cue word.
- State hygiene: `longtable doctor` should report no stale pending questions
  after test cleanup, and `longtable prune-questions --dry-run` should be empty
  after false-positive pruning.

## Locked Decision

Advisory questions should remain response-only.

They should not be stored as non-pending audit events in `.longtable/state.json`
for the first implementation. This keeps the state ledger reserved for
decisions, required checkpoints, artifacts, and other durable research
commitments. If later evaluation shows that advisory-question recall needs an
audit trail, add that as a separate feature with explicit storage and pruning
policy rather than mixing it into the checkpoint lifecycle.

The remaining implementation choice is only the exact naming of classifier
return types; it should not change the response-only advisory policy.

## Implementation Status

0.1.40 implements the first pass:

- Codex hook product/tooling prompts are a negative gate for required
  checkpoints.
- Research exploration can surface response-only advisory questions.
- Required checkpoint creation is limited to research-domain commitment prompts.
- Knowledge-gap and tacit-assumption classifier rules are advisory by default.
- Regression tests cover the prior false-positive classes discussed here.
