# LongTable Research Runtime

## Decision

LongTable Research is the consolidated journal-to-artifact workflow behind
`$longtable-research` and `longtable research`. The
researcher-facing skill surface is limited to `$longtable` and
`$longtable-research`; journal editor, venue strategist, methods critic, evidence
verifier, and visual auditor remain internal lenses.

The canonical automation surface is:

```text
longtable research run
longtable research resume
longtable research status --run-id <id>
longtable research explain --run-id <id> --stage <stage>
longtable research verify --run-id <id>
```

`run` automatically attempts bounded public-OA acquisition for collected cards
that explicitly assert legal full-text availability and provide an HTTPS route.
Use `--no-auto-oa` to disable it. Automatic acquisition:

- sends no credentials, cookies, or institution session state;
- validates every redirect and rejects credential-bearing, non-HTTPS,
  non-standard-port, loopback, private, local, and reserved network targets;
- limits redirect count, duration, and bytes;
- requires a PDF signature before parsing;
- stores public bytes only in the global content-addressed cache;
- records requested/final URL, HTTP status, source route, hash, parser output,
  and a typed acquisition event;
- continues after individual failures when the acquired corpus remains usable.

No login, WAF, robots, proxy, VPN, or paywall bypass is attempted. If all
asserted OA routes fail, the run stops at the access/corpus checkpoint and
preserves the distinction between `restricted_access`, `download_failed`, and
`parse_failed`.

`status` reads the durable bundle. `explain` returns one stage's state and
append-only events. `verify` performs independent file readback over event
continuity, completed-stage hashes, full-text byte hashes, derived provenance,
licensed/private storage isolation, strict filled citation slots, visual
contracts, editable-source hashes, mechanical QA, portfolio completeness, and
the final handoff. A paused run may pass its materialized checks with an
explicit incompleteness warning; only a completed run is required to prove the
entire stage set and handoff.

Stage subcommands may exist for diagnosis and recovery, but are not the normal
user journey.

Before implementation, a proposed or approved visual contract can be checked
without mutating the run:

```text
longtable research validate-visual-contract --contract <file> --json
```

The human decision is then recorded as a durable workflow event:

```text
longtable research record-visual-review \
  --contract <file> --review <file>
```

For a manuscript that requires multiple visuals, freeze the complete contract
set before any individual approval:

```text
longtable research register-visual-portfolio --plan <file>
```

The version-1 portfolio plan declares one run, one portfolio ID, and at least
two unique Visual Evidence Contract IDs. Registering a different plan under the
same run is rejected. The `visual_contract` stage completes only after every
declared contract is human-approved. Each contract is then rendered with
`render-visual`; `verify` and `handoff` complete only after every declared
Figure, Table, or Diagram has an accepted four-lens and timed-reader review.
This prevents one accepted figure from standing in for manuscript-level visual
verification.

Approval requires all four human checks to pass. Rejection keeps the workflow
at the same checkpoint with the rationale intact; approval advances only to the
renderer boundary.

Approved contracts are implemented and reviewed through:

```text
longtable research render-visual \
  --contract-id <id> --request <file>
longtable research record-render-review --review <file>
```

The initial allowlist contains only `longtable-svg-v1`. It renders editable,
grayscale-safe SVG for exact-lookup tables, bar/line/point figures, and
performed-versus-proposed diagrams. Every output is bound to the exact data
snapshot, request, and editable-source hashes. The renderer also writes a
placement manifest and mechanical QA report. Mechanical success advances only
to `awaiting_human`; it never substitutes for domain, statistical, journal, or
timed-reader review.

## Durable Workflow

The versioned stage order is:

```text
scope -> topic -> venue -> collect -> fulltext -> extract -> synthesize
      -> visual_contract -> implement -> render -> verify -> handoff
```

Each run owns a `ResearchBundle`, an append-only event log, and a derived state
snapshot under `.longtable/research-runs/<run-id>/`. The CLI is the only
canonical mutator. A provider receives a bounded task packet and may return only
a schema-valid proposed patch.

`run` and `resume` are idempotent. A completed stage is not repeated when its
input hash is unchanged. Changed input creates a new event and invalidates
dependent derived state rather than silently overwriting provenance.

## Responsibility Boundary

Deterministic CLI responsibilities:

- network policy, concurrency, source rate limits, retries, and circuit breakers
- hashes, cache keys, version linkage, and deduplication
- PDF parsing, OCR routing, and stable locators
- schema validation, event append, state derivation, and checkpoint enforcement
- allowlisted rendering plus mechanical visual checks

Model responsibilities:

- query expansion and relevance judgment
- claim-evidence interpretation
- venue and journal-pattern synthesis
- visual evidence contract proposals
- bounded narrative synthesis

Metadata, an abstract, or a discovered PDF URL never counts as full-text
verification.

## Researcher Checkpoints

Scholar research adds only five blocking event classes:

1. Scope Contract or an amendment to it, including target-venue selection
2. access or corpus boundary
3. evidence that changes direction or claim strength
4. Visual Evidence Contract
5. external upload, publication, or submission

Theory, method, measurement, and analysis changes are instances of class 3,
not additional checkpoint types. Routine records use adaptive stratified
sampling; final claims, final visuals, journal exemplars, conflicts, OCR or
low-confidence evidence, ambiguous versions, and access ambiguity receive
complete human review.

## Strict Evidence Contract

A citation slot is `filled` only when it includes the claim, an evidence span, a
stable locator, source version or content hash, access class, and the relation
between evidence and slot. Conflicting evidence remains represented.

Synthesis is also structured rather than accepted as unconstrained prose. Each
claim has a stable ID, role, reading order, and one or more reviewed citation
slot IDs. A different provider verifies every proposed claim, then a human
accepts, rejects, or preserves disagreement before `synthesize` completes.

A visual specimen also requires the page render, bounding box, caption, and
surrounding context. Unsupported final claims, wrong source/version/citation,
visual distortion, prohibited access, or mutation before required approval are
non-compensatory failures.

## Visual Contract

Target-journal examples are used to derive a `VisualGrammar`, not copied as
artwork. A human approves a declarative `VisualEvidenceContract`; an allowlisted
renderer then produces editable source, a data snapshot, environment/version
metadata, journal-sized exports, and a placement manifest. Word or LaTeX
placement happens only after approval.

### Human-readable professional visual principles

The Paper B replay establishes a reusable visual decision standard:

1. **Necessity before polish.** Every main-text visual answers one analytical
   question and maps to a manuscript claim. Audit completeness alone is a
   supplement function.
2. **Scientific unit before glyph.** Independent reports, estimands, repeated
   conditions, denominators, uncertainty, and validation scope remain visibly
   distinct. Heterogeneous estimands are never joined into one range or rank.
3. **Performed and proposed are separate layers.** A methods diagram must not
   present a normative claim-control model as a procedure that was performed.
4. **One main-text reading path.** A reader should recover the question,
   denominator, key value or relation, and conclusion in 10–20 seconds.
5. **Direct labels over legend travel.** Redundant markers, icons, colors, and
   keys are removed unless each encoding adds non-duplicated scientific
   meaning. Grayscale and print accessibility are defaults.
6. **Honest scale and uncertainty.** Axes do not manufacture contrast; observed
   ranges are not styled as confidence intervals; small denominators are
   printed and never allowed to look stronger than large denominators.
7. **Evidence hierarchy before performance ranking.** Rows are organized by
   relevance and validation scope, then stable identifiers such as
   author–year—not by favorable outcome magnitude.
8. **Main text and supplement have different jobs.** The main text supports
   interpretation; the supplement preserves every study, condition, interval,
   identifier, and locator needed for audit.
9. **Placement is part of meaning.** The visual appears near its first
   interpretive use, with a short lead-in stating the question, pattern to read,
   and prohibited inference.
10. **Journal grammar is evidenced.** Each exemplar includes source/version,
    access class, page render, bounding box, caption, and surrounding context.
    The grammar is abstracted; artwork is not copied.
11. **Editable and reproducible delivery.** Final outputs preserve editable
    vector or table source, exact data snapshot, renderer/version, journal-sized
    export, and placement manifest.
12. **Human validation is a hard gate.** Domain meaning, visual/statistical
    integrity, journal fit, and actual reader comprehension are separately
    checked. A mechanically valid render is not a successful visual.

An approved contract therefore fails validation unless it declares grayscale
and color-vision safety, a meaningful text alternative, a readable minimum font
size, and distinct plans for domain, statistical, journal, and reader review.
Journal exemplars also fail when their page, bounding box, observed pattern, or
source/version/access provenance is missing.

Selection rule:

- use a **table** for exact lookup and multi-field audit;
- use a **figure** for a defensible pattern or comparison;
- use a **diagram** for a process or conceptual relation, with performed and
  proposed content visibly separated.

If a visual does not outperform a short paragraph or compact table on accepted
artifact time, active human effort, comprehension, or error prevention, remove
it from the default workflow.

## Evaluation And Removal Rule

Evaluation has three layers:

1. deterministic fixtures
2. replay, including task `019f56ab-4f4e-7f13-9bc0-8c8d15966e0d`
3. prospective conversational end-to-end trials

Replay is evidence about reproducibility, not live access or implementation
coverage. Only prospective trials can promote or remove a default workflow.
Quality gates are non-compensatory. Efficiency is evaluated only after quality
passes, using time to accepted artifact, active human time, interruption count,
repeated questions, context switches, rework, abandonment, effort, and trust.
A stage that adds no marginal quality or safety value and harms these measures
must be simplified, made opt-in, or removed.

The executable evaluation surfaces are:

```text
longtable research replay-paper-b \
  --source-root <frozen-case> --output-dir <dir> \
  --exemplar-manifest <file> [--human-review <file>]
longtable research eval-record \
  --plan-id <id> --observation <file>
longtable research eval-report --plan-id <id>
longtable research trial-create --config <file>
longtable research trial-start \
  --plan-id <id> --trial-id <id> --condition-index <0|1>
longtable research trial-finish \
  --plan-id <id> --trial-id <id> --condition-index <0|1> --result <file>
longtable research trial-status \
  --plan-id <id> --trial-id <id>
```

`trial-create` freezes the human-supplied question, target journal, provider,
model/version, corpus cutoff, permissions profile, and two stage profiles.
Condition order is deterministic from a hashed crossover seed. Every profile
automatically retains the legal-access boundary, source-version provenance,
and non-compensatory quality gates; those controls cannot enter the stage
removal analysis. `trial-start` emits a bounded task capsule, and
`trial-finish` converts the measured result into an immutable prospective
observation. Repeated create, start, and finish calls are idempotent.

Promotion requires at least three complete workflow-on/workflow-off crossover
pairs with effort and trust ratings. Three unpaired observations are not
sufficient. A stage becomes a removal candidate only when its absence produces
no hard-gate loss and its presence adds time or human burden without effort or
trust benefit.

The Paper B replay recomputes the frozen 148-report Figure 7 values, recovers
the prior human decisions, validates located target-journal exemplars, renders
an editable SVG, and runs mechanical QA. `replayMechanicsPassed` remains
separate from the final `qualityGatePassed`: the latter stays false until the
new render has an explicit human review. Replay never counts as prospective or
holdout evidence.

The initial calibration suite contains twelve tasks: four pinpoint retrieval,
three open topic/venue discovery, three full-text claim/extraction, and two
visual/manuscript end-to-end tasks. Frozen conditions are repeated three times.
High-impact gold records are independently double-reviewed and adjudicated;
engineering, calibration, and locked holdout sets remain separate.

## Delivery Sequence

1. `ResearchBundle`, event log, state derivation, and resume
2. existing scholarly search adapters connected to `collect`
3. legal full-text acquisition, parse/OCR, and locator validation
4. strict extraction and bounded provider task packets
5. visual contract, deterministic rendering, and verification
6. Paper B replay and one prospective end-to-end trial
7. connector expansion only after the workflow survives the productivity gate
