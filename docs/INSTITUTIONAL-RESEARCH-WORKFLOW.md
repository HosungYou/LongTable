# Institutional Research Workflow

This is the researcher-facing operating contract for the integrated `longtable research` surface. It covers reproducible academic-database retrieval, document screening, lawful full-text intake, reporting, and manuscript rendering. It does not automate authentication, decide an ambiguous inclusion rule, or convert a pilot into production without a recorded researcher decision.

## Method boundary

Use two related but distinct evidence streams for a demand-supply mismatch study:

1. **Demand corpus:** procurement notices, commissioned-research topics, policy documents, and employer demand documents. Treat this as a document-analysis population with an explicit sampling frame, inclusion criteria, extraction matrix, pilot coding, agreement/adjudication, and missing-document audit. Do not call this corpus a PRISMA literature search.
2. **Supply and scholarly corpus:** training-course metadata and scholarly records from selected academic databases. The academic search can use the workflow below and can produce review-flow artifacts when its count invariants pass.

The two streams meet only after each has its own stable unit of analysis and codebook. A conceptual framework may then map demanded competencies and problem types to supplied curricula, learning protocols, and measured competency outcomes. This separation prevents procurement demand from being mistaken for scholarly evidence and prevents course availability from being mistaken for effectiveness.

## One research surface

Initialize the canonical folders before the pilot:

```bash
longtable research init --cwd "<project>"
longtable research pilot --run-id <run-id> --protocol-reference draft-1 --cwd "<project>"
```

The pilot creates one compact search-strategy checkpoint. MCP elicitation is attempted first. Decline, timeout, unsupported transport, or transport error records the failed attempt and renders the same checkpoint as numbered text; it does not infer an answer.

After the researcher approves a protocol revision:

```bash
longtable research freeze --protocol-file protocol-revision.json --cwd "<project>"
longtable research ingest-export --file export.csv --database web-of-science --format csv --cwd "<project>"
longtable research screen --decisions-file screening-decisions.json --cwd "<project>"
longtable research acquire --candidate-path paper.pdf --vault-root "<external-vault>" --paper-id <id> \
  --acquisition-method researcher_manual_upload --access-basis researcher_provided \
  --version accepted-manuscript --project-inclusion included --screening-state fulltext_included \
  --cwd "<project>"
longtable research freeze-extraction --profile-file extraction-profile.json --cwd "<project>"
longtable research extract --profile-file extraction-profile.json --records-file extraction-records.json --cwd "<project>"
longtable research adjudicate-extraction --profile-file extraction-profile.json \
  --adjudications-file adjudications.json --cwd "<project>"
longtable research freeze-data --profile-file extraction-profile.json --freeze-file data-freeze.json --cwd "<project>"
longtable research report --input-file report-input.json --cwd "<project>"
longtable research package --input-file manuscript-input.json --profile-file apa7.json \
  --output-path manuscript/review.docx --cwd "<project>"
```

`freeze` writes immutable, numbered revisions. The same revision and content is idempotent; different content cannot overwrite an existing revision number. `ingest-export` stores the original export under its SHA-256, then produces normalized and deduplicated derivatives. Re-ingesting identical bytes does not create a second raw artifact. `screen` appends versioned decisions and ignores an identical decision ID on replay.

Metadata identifies research units; it is not the coded research dataset. `freeze-extraction` locks the unit of analysis, variables, value types, evidence requirements, double-extraction rule, and reliability threshold. `extract` validates independent records and detects field-level conflicts. `adjudicate-extraction` records a human resolution with evidence. `freeze-data` refuses unresolved conflict, incomplete double extraction, below-threshold reliability, or missing required evidence, then writes a deterministic analysis-ready dataset hash.

## Mandatory checkpoints and resume rule

| Event | Immediate action | Resume evidence |
|---|---|---|
| Login, MFA, CAPTCHA, or expired session | Stop at the last safe cursor | Researcher restores access and records a linked DecisionRecord |
| Terms or access basis is unclear | Stop before retrieval | Researcher records the permitted route or excludes the route |
| Query drift, result cap, export mismatch, or changed download pattern | Stop production | Researcher approves a protocol amendment or corrective action |
| Ambiguous screening rule or human-AI disagreement | Preserve both decisions; do not collapse | Adjudication decision linked to the QuestionRecord |
| Missing full-text threshold exceeded | Stop full-text screening | Revised acquisition plan or approved limitation |
| Analysis method changes | Stop synthesis | Approved analysis-method DecisionRecord |
| Corpus freeze is absent | Refuse analysis | Frozen corpus receipt |
| Extraction profile is unfrozen or a coding rule is ambiguous | Stop extraction | Approved profile or rule revision linked to a DecisionRecord |
| Pilot reliability is below threshold | Stop production extraction | Revised pilot/codebook or approved threshold decision |
| Double extraction conflicts remain | Preserve both records | Evidence-backed adjudication |
| Extracted-data freeze is absent | Refuse analysis and manuscript rendering | Deterministic dataset freeze linked to a DecisionRecord |

Every stage advances only with a `StageReceipt`. A blocked run resumes only when the DecisionRecord references both the blocking checkpoint key and QuestionRecord ID. Replaying resume from the same blocked state with the same timestamp and decision produces the same state.

## Canonical project artifacts

```text
<project>/
  protocol/
    research-question.yaml
    search-protocol.yaml
    inclusion-exclusion.yaml
    database-profiles/
    extraction-profiles/
    amendments/protocol-revision-0001.json
  data/
    00_raw-exports/
    01_normalized/
    02_deduplicated/
    03_title-abstract-screening/
    04_fulltext-screening/
    05_extraction-pilot/
    06_extracted/
    07_adjudicated/
    08_analysis-ready/
  corpus/
    papers.jsonl
    acquisition-ledger.jsonl
    pdf-manifest.jsonl
    screening-decisions.jsonl
    extraction-records.jsonl
    extraction-conflicts.jsonl
    extraction-adjudications.jsonl
    manual-action-queue.csv
  audit/
    stage-receipts.jsonl
    checkpoints.jsonl
    decisions.jsonl
    exclusions.jsonl
    deviations.jsonl
    failures.jsonl
    extracted-data-freezes.jsonl
  reports/
  manuscript/
  analysis/
  references/
```

The Research PDF Vault must be outside the project. The project retains only a Vault-relative manifest locator, SHA-256, access basis, acquisition method, version, and screening state; the approved institution storage profile resolves the external Vault root at runtime. Placeholder, partial, corrupt, symbolic-link, absolute-path, or token-bearing PDF intake is rejected.

## Final researcher report and paper mapping

The report command generates a researcher audit report, count table, deterministic review-flow SVG, systematic-review Methods/Results text, and provenance records.

| Research artifact | Direct manuscript use |
|---|---|
| Frozen protocol and exact database queries | Methods: information sources, search strategy, eligibility criteria |
| Database yields and raw-export hashes | Methods/Results: search dates, yields, export reconciliation |
| Screening ledger and exclusion reasons | Methods: selection process; Results: study selection and exclusions |
| PDF manifest and missing-text audit | Methods: retrieval routes; Results/Limitations: reports not retrieved |
| Count-invariant report and review-flow SVG | Results table and study-flow figure |
| Deviation and DecisionRecord ledger | Protocol amendments and deviations |
| Analysis-readiness table | Analysis plan, missing statistics, dependency and author-contact needs |
| Extraction profile, reliability, conflict/adjudication, and data-freeze ledger | Methods: data items and coding; Results: reliability, missingness, and final analytic dataset |
| Paragraph/table provenance map | Internal audit before submission |

Planned work renders future-tense protocol language. Completed work renders past-tense Methods and observed Results. Rendering fails when count equations do not balance or when database execution, full-text verification, extracted-data freeze, or analysis approval is absent.

The review-flow output is an internal deterministic representation, not a claim that every document corpus is a systematic review. Final reporting should be checked against the [PRISMA 2020 checklist and flow materials](https://www.prisma-statement.org/prisma-2020) and, for literature-search reporting, the [PRISMA-S extension](https://doi.org/10.1186/s13643-020-01542-z).

## Word profiles

The included `apa7-memory` profile fixes a working-manuscript layout: US Letter, one-inch margins, Times New Roman 12 pt, double spacing, top-right page numbers, title page, 0.5-inch first-line indents, and 0.5-inch hanging reference indents. It is a declared working profile, not a substitute for a named journal's current author instructions.

The Korean profile is explicitly `provisional_until_journal_rules_verified`. A named target-journal profile should be approved only after recording its aims and scope, author instructions, article type, recent reference-paper pattern, table/figure conventions, and template hash. User templates are accepted only with a matching SHA-256.

## Live institution smoke gate

Production eligibility requires a researcher-owned login, an approved institution profile, deterministic recipe replay, and a live smoke run:

```bash
longtable research live-smoke --run-id <id> --record-count 5 --pdf-count 1 \
  --researcher-approved --profile-approved --calibrated --replay-passed --cwd "<project>"
```

The gate accepts 5-20 metadata records and one or two permitted PDFs. Anything larger is not a smoke run. The receipt records the counts and eligibility decision; it never stores credentials, cookies, session tokens, MFA material, or authentication headers.

## Researcher closeout

Before manuscript submission, the researcher receives and reviews:

1. frozen protocol revision and amendments;
2. database-by-database yield and export reconciliation;
3. unresolved issues, recovered failures, exclusions, and deviations;
4. corpus and PDF-manifest invariants;
5. analysis-readiness and required-action list;
6. manuscript profile status and unresolved citation fields;
7. artifact provenance map and security-audit result.

This closeout is the final checkpoint. The automation prepares the evidence package; the researcher remains responsible for methodological interpretation, journal fit, and submission.
