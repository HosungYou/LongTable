# LongTable Research Institutional Workflow Design

Status: researcher-approved design

Date: 2026-08-06

Product surface: `LongTable Research`

Repository: `/Users/hosung/dev/LongTable`

## 1. Executive Decision

LongTable exposes one researcher-facing scholarly research surface. Internally it routes a capability tree for protocol design, scholarly discovery, institution-aware access, supervised browser execution, local corpus management, screening, systematic review, meta-analysis readiness, synthesis, and publication rendering.

One surface does not mean one monolithic `SKILL.md`. LongTable core owns research state, Researcher Checkpoints, DecisionRecords, stage transitions, and audit semantics. Database adapters, institution profiles, parsers, browser recipes, Research PDF Vault integration, and renderers remain isolated and testable internal modules.

The default access model is:

1. the researcher completes institution login and MFA;
2. LongTable uses the active authenticated browser to perform normal, permitted research actions;
3. LongTable never extracts or persists credentials, cookies, session tokens, or MFA material;
4. access ambiguity, session expiry, CAPTCHA, material protocol change, or failed invariants cause a real hard stop;
5. execution resumes only after a durable researcher decision.

## 2. Goals

- Let a researcher request one LongTable Research workflow from question formation through manuscript-ready outputs.
- Support APIs, publisher TDM routes, public scholarly services, institution link resolvers, and supervised computer use without bypassing access controls.
- Adapt to multiple institutions through reusable database adapters and declarative institution profiles.
- Preserve systematic review and meta-analysis reproducibility through pilot separation, protocol freeze, revision history, immutable manifests, and provenance.
- Minimize researcher monitoring through exception-based supervision and deterministic stage audits.
- Minimize model-token use by reserving LLM calls for interpretive research decisions.
- Store PDFs once in Research PDF Vault and reference them from research projects by stable identity and hash.
- Generate researcher reports, PRISMA artifacts, Methods, Results, supplements, reference files, and analysis-readiness packages from the same canonical artifacts.

## 3. Non-Goals

- Automating password entry, MFA completion, CAPTCHA solving, cookie export, session extraction, proxy/VPN bypass, or access-control circumvention.
- Treating metadata or abstracts as verified full-text evidence.
- Downloading every identified PDF before title/abstract screening.
- Allowing the model to change a frozen production query without a protocol amendment and researcher approval.
- Making a browser automation transcript, generated Word file, or provider-specific UI the source of truth.
- Requiring continuous researcher observation of normal pagination, export, parsing, download, or audit operations.
- Building a separate always-on autonomous research daemon in the first implementation.

## 4. Existing Product Boundaries

The design extends existing LongTable boundaries rather than introducing a parallel product:

- `@longtable/core` owns provider-neutral research and state contracts.
- `@longtable/mcp` provides structured elicitation transport over durable QuestionRecords and DecisionRecords.
- `@longtable/scholar-research` provides scholarly search and evidence-recovery capabilities.
- `@longtable/research-search` remains a deprecated compatibility package.
- `packages/longtable` owns the unified researcher-facing command surface.
- `.longtable/` remains the canonical project state.
- Research PDF Vault is an external local-first canonical PDF service, not a replacement LongTable state store.

The current `longtable-research` blanket prohibition on institution-login automation must be refined during implementation. The replacement boundary permits supervised actions inside a researcher-authenticated active browser while continuing to forbid credential automation, cookie reuse, session extraction, CAPTCHA bypass, proxy/VPN bypass, and unapproved access circumvention.

## 5. Approved Researcher Journey

```text
research request
  -> project and Research Specification recovery
  -> adaptive search-strategy proposal
  -> MCP Researcher Checkpoint
  -> small institution-aware pilot
  -> pilot yield and quality report
  -> MCP protocol-freeze checkpoint
  -> production metadata search and export
  -> export audit, normalization, and deduplication
  -> title/abstract screening
  -> potential-inclusion corpus
  -> full-text acquisition plan checkpoint
  -> lawful PDF acquisition and Research PDF Vault intake
  -> full-text screening and adjudication
  -> final-corpus freeze checkpoint
  -> systematic review or meta-analysis-readiness workflow
  -> synthesis
  -> researcher report
  -> manuscript and reproducibility package
```

Search results are not bulk-downloaded before screening. Records with absent or insufficient abstracts are sent to `full_text_needed_for_screening`; they are not silently excluded.

## 6. Architecture

```text
LongTable Research
|
+-- Research Protocol Controller
|   +-- question, scope, eligibility, information sources
|   +-- pilot and production separation
|   +-- protocol revisions and freeze
|
+-- Checkpoint and Hook Engine
|   +-- durable QuestionRecord and DecisionRecord
|   +-- MCP elicitation first
|   +-- blocking state transitions
|
+-- Discovery Capability
|   +-- APIs and official TDM
|   +-- metadata import/export
|   +-- supervised computer use
|
+-- Adapter Registry
|   +-- database adapters
|   +-- institution profiles
|   +-- browser recipes and page signatures
|
+-- Corpus Controller
|   +-- parsing, normalization, and deduplication
|   +-- acquisition and screening ledgers
|   +-- Research PDF Vault integration
|
+-- Review and Analysis
|   +-- PRISMA selection flow
|   +-- systematic review
|   +-- human validation and adjudication
|   +-- meta-analysis readiness
|
+-- Reporting and Rendering
    +-- researcher final report
    +-- Methods, Results, tables, figures, supplements
    +-- APA 7 and target-journal renderers
```

Internal capabilities are registry entries, not separate researcher-facing skills. The public skill and command surface remains LongTable Research; legacy scholarly-search commands remain compatibility aliases only.

## 7. Core Domain Records

### 7.1 ResearchRun

- `runId`
- `projectId`
- `researchType`
- `stage`
- `status`: `active | blocked | completed | failed | cancelled`
- `protocolRevisionId`
- `institutionProfileId`
- `lastSuccessfulCursor`
- `openExceptions`
- `createdAt`
- `updatedAt`

### 7.2 ProtocolRevision

- exact research question and review type
- databases and their roles
- exact queries
- date, language, publication-type, and source filters
- inclusion and exclusion criteria
- retrieval and screening policies
- model-assisted screening policy
- human-validation policy
- analysis intent
- protocol hash
- amendment rationale and linked DecisionRecord

### 7.3 StageReceipt

- `runId`
- `stage`
- institution and database
- adapter and recipe versions
- protocol revision and hash
- expected and observed counts
- input and output artifact IDs
- SHA-256 values
- invariant results
- retry summary
- completion status and next stage

### 7.4 InstitutionProfile

- institution identifier and locale
- enabled databases
- access modes
- library link resolver configuration
- permitted and prohibited actions
- export formats and result caps
- storage destinations
- checkpoint policy
- profile approval DecisionRecord
- calibration and last-verified dates

The profile never includes credentials, cookies, authentication headers, session tokens, or MFA material.

### 7.5 ArtifactProvenance

- stable artifact ID
- source stage and input IDs
- protocol revision
- generator/parser/renderer version
- local path or canonical paper ID
- SHA-256
- access basis when applicable
- creation time

## 8. Execution State Machine

```text
SETUP
  -> PILOT
  -> PROTOCOL_CHECKPOINT
  -> PRODUCTION_SEARCH
  -> EXPORT_AUDIT
  -> TITLE_ABSTRACT_SCREENING
  -> FULLTEXT_PLAN_CHECKPOINT
  -> FULLTEXT_ACQUISITION
  -> FULLTEXT_SCREENING
  -> CORPUS_FREEZE_CHECKPOINT
  -> ANALYSIS
  -> SYNTHESIS
  -> RESEARCHER_REPORT
  -> MANUSCRIPT_PACKAGE
```

Every completed transition writes a StageReceipt. A hard-stop event writes the latest safe cursor, changes the run to `blocked`, creates a QuestionRecord, attempts MCP elicitation, and rejects resume until a linked DecisionRecord authorizes the next action.

### Immediate hard stops

- `LOGIN_REQUIRED`
- `MFA_OR_CAPTCHA_REQUIRED`
- `SESSION_EXPIRED`
- `TERMS_OR_ACCESS_UNCLEAR`
- `QUERY_DRIFT_DETECTED`
- `DATABASE_RESULT_CAP_REACHED`
- `EXPORT_COUNT_MISMATCH`
- `DOWNLOAD_PATTERN_CHANGED`
- `UI_SIGNATURE_CHANGED`
- `SCREENING_RULE_AMBIGUOUS`
- `HUMAN_AI_SCREENING_CONFLICT`
- `FULLTEXT_MISSING_THRESHOLD_EXCEEDED`
- `ANALYSIS_METHOD_CHANGE`
- `CORPUS_FREEZE_REQUIRED`

### Locally retryable events

- transient network timeout
- delayed export generation
- incomplete download
- temporary page-render failure
- OneDrive/File Provider hydration delay

Retryable events use a bounded retry policy and one summarized advisory record. Repeated identical failures are bundled into one checkpoint rather than interrupting the researcher for every record.

## 9. MCP-First Researcher Checkpoints

Required checkpoints use the existing `longtable-state` MCP `elicit_question` surface first. Advisory notices and ordinary progress remain nonblocking logs. If MCP elicitation is unavailable, declined, cancelled, or times out, the same pending QuestionRecord is rendered through the numbered fallback. There is no implicit default answer.

### Search-strategy card

LongTable presents one compact proposal containing:

- review type and objective;
- recommended databases grouped as core, domain, complementary, normalization, and full-text resolution;
- time, language, publication-type, and source filters;
- recall/precision posture;
- known access limitations;
- actions: pilot, modify databases, modify scope, open detailed wizard, or cancel.

If the researcher requests database modification, a second MCP multi-select question lists databases exposed by the current institution profile and available public adapters. The detailed wizard is progressive disclosure, not the default path.

### Pilot-freeze card

After pilot execution, LongTable reports per-database yield, estimated overlap, missing-abstract rate, relevance sample, result caps, query problems, and recommended amendments. The researcher freezes the production protocol or selects a material revision. Production cannot begin without the freeze decision.

Other required MCP checkpoints cover access ambiguity, full-text acquisition planning, corpus freeze, screening conflicts, and analysis-method commitments.

## 10. Pilot and Production Separation

Pilot artifacts and production artifacts are separate. A pilot may explore UI behavior, access routes, synonyms, result caps, and small relevance samples. Pilot results cannot be silently merged into the production corpus.

Production execution requires an approved ProtocolRevision. Its databases, queries, filters, time boundaries, languages, target types, and result handling are immutable for that revision. Any material change causes a hard stop and creates a new revision linked to a DecisionRecord.

## 11. Capability, Database Adapter, and Institution Layers

### 11.1 Provider-neutral research capabilities

- `open`
- `verifyAuthenticated`
- `submitQuery`
- `applyFilters`
- `readResultCount`
- `exportMetadata`
- `verifyExport`
- `resolveFulltext`
- `downloadPermittedPdf`
- `suspend`
- `resume`

Unsupported capabilities are explicit; adapters do not improvise an unapproved alternative.

### 11.2 Database adapters

Each adapter may include:

- official API or TDM client;
- export parser;
- browser recipe;
- accessibility-first page signatures;
- result-cap and pagination rules;
- permitted full-text resolution paths;
- versioned fixtures and contract tests.

API and official TDM paths take precedence. Supervised computer use is used for normal user actions that lack an adequate supported API.

### 11.3 Institution profiles

Institution profiles select available database adapters, access modes, library link resolvers, export defaults, institution-specific result caps, storage paths, and checkpoint rules. They do not duplicate database logic.

### 11.4 New-institution calibration

```text
researcher login
  -> database and resolver discovery
  -> small supervised dry run
  -> draft profile and recipes
  -> researcher MCP approval
  -> local fixture and replay tests
  -> small live smoke test
  -> production eligibility
```

Generic computer-use exploration is allowed only in calibration or pilot. Production requires an approved profile and compatible recipe signature.

## 12. Supervised Computer-Use Contract

The researcher owns login and MFA. LongTable verifies that the intended database and authenticated page are present, loads the frozen protocol, performs the approved query and filters, reads the result count, exports metadata, verifies the file and parsed row count, writes a StageReceipt, and advances.

Recipes prefer accessibility roles, labels, headings, and stable semantic landmarks. Coordinates may be a bounded fallback inside a verified page signature; they are not the primary selector.

LongTable must not guess when a required control, result count, export dialog, full-text notice, access warning, or page signature differs from the approved recipe. It suspends and asks the researcher.

## 13. Corpus and PDF Ownership

PDFs are stored once in Research PDF Vault as canonical artifacts. Each research project stores a `pdf-manifest.jsonl` reference containing:

- `paperId`
- SHA-256
- canonical Vault-relative local path (resolved from the approved institution storage profile, without leaking a user-home absolute path)
- acquisition method and access basis
- version and source URL identifiers
- project inclusion and screening state

Licensed PDFs are not copied into each project, committed to Git, embedded in LongTable logs, or redistributed in a reproducibility package.

The default acquisition sequence is:

```text
all metadata
  -> normalize and deduplicate
  -> title/abstract screening
  -> potential-inclusion set
  -> lawful full-text resolution
  -> Research PDF Vault intake
  -> full-text screening
  -> final corpus
```

## 14. Local Project Contract

```text
research-project/
+-- protocol/
|   +-- research-question.yaml
|   +-- search-protocol.yaml
|   +-- inclusion-exclusion.yaml
|   +-- database-profiles/
|   +-- amendments/
+-- data/
|   +-- 00_raw-exports/
|   +-- 01_normalized/
|   +-- 02_deduplicated/
|   +-- 03_title-abstract-screening/
|   +-- 04_fulltext-screening/
|   +-- 05_analysis-ready/
+-- corpus/
|   +-- papers.jsonl
|   +-- acquisition-ledger.jsonl
|   +-- pdf-manifest.jsonl
|   +-- screening-decisions.jsonl
|   +-- manual-action-queue.csv
+-- audit/
|   +-- stage-receipts.jsonl
|   +-- checkpoints.jsonl
|   +-- decisions.jsonl
|   +-- exclusions.jsonl
|   +-- deviations.jsonl
|   +-- failures.jsonl
+-- reports/
+-- manuscript/
+-- analysis/
+-- references/
+-- .longtable/research-runs/
```

Raw export files are immutable after intake. Derived layers point to upstream artifact IDs and hashes.

## 15. Low-Audit and Low-Token Execution

### Deterministic execution

Pagination, export, file verification, CSV/RIS/XLS/NBIB parsing, DOI normalization, exact deduplication, checksums, PRISMA counting, tables, and flow rendering use deterministic code. They must not invoke an LLM.

### Interpretive execution

LLM use is reserved for query-concept expansion, relevance calibration, ambiguous screening, construct mapping, synthesis, and method reasoning. Material decisions still require the configured human-validation or Researcher Checkpoint policy.

### Context minimization

Each model call receives a stage-specific state slice:

- protocol hash and relevant revision fields;
- current-stage summary;
- bounded record or evidence batch;
- open exceptions;
- required output schema.

The full browser log, full run history, and unrelated PDFs are not injected. Results are cached by record/PDF hash, rule or codebook version, prompt version, and model version. Unchanged inputs are not reprocessed.

### Exception-based supervision

Normal execution records compact receipts without notifying the researcher. Recoverable errors use bounded local retry and advisory aggregation. Only hard-stop events and final reports request attention.

## 16. Deterministic Audit Invariants

At minimum:

```text
identified = normalized + parse_rejected
normalized = unique + duplicate_links
title_abstract_screened = fulltext_candidates + excluded + pending
fulltext_sought = retrieved + not_retrieved
fulltext_assessed = final_included + fulltext_excluded + unresolved
```

Additional invariants require every rejection, exclusion, unresolved item, duplicate link, acquired PDF, and protocol deviation to have an explicit basis. PRISMA rendering is blocked if count invariants fail.

## 17. Researcher Reporting and Publication Rendering

Machine-readable protocol, corpus, audit, decision, and receipt artifacts are the source of truth. Researcher-facing and publication-facing files are renderings.

### Researcher report

- databases and protocol revisions executed;
- per-database yields and export verification;
- normalization, deduplication, screening, retrieval, and final inclusion counts;
- automatic retries and recovered failures;
- unresolved access and screening items;
- protocol deviations and linked decisions;
- analysis readiness;
- required researcher actions;
- generated manuscript and reproducibility artifacts.

### Systematic-review package

- information sources;
- exact search strategy;
- selection process;
- automation and human validation;
- full-text access and missing-text handling;
- study-selection Results;
- PRISMA flow and count table;
- database yield, included-study, and full-text exclusion tables;
- PRISMA 2020 and PRISMA-S materials;
- exact search strings and amendments.

Planned runs render future-tense protocol language. Completed runs render past-tense methods and observed Results. No renderer may claim an unexecuted database, unavailable full text, or unapproved analysis.

### Meta-analysis readiness package

- study-level records;
- effect-size candidates and required statistics;
- construct mapping and evidence;
- sample and publication dependency clusters;
- missing-data and author-contact needs;
- extraction codebook;
- analysis-readiness report.

Analysis-model selection remains a Researcher Checkpoint.

### Reference and format renderers

Canonical bibliographic records generate CSL JSON, RIS, BibTeX, APA 7 references, and unresolved-citation reports. Content is then rendered through APA 7, Korean journal, international journal, or user-supplied Word-template profiles. Paragraph and table provenance maps link rendered claims and counts to source artifacts and protocol revisions.

## 18. Security and Rights Boundary

- No credential, cookie, session-token, MFA, or authentication-header persistence.
- No CAPTCHA solving or access-control bypass.
- No production run on an unapproved institution profile or incompatible page signature.
- No licensed full-text redistribution.
- No model upload of restricted/Red-lane content unless a separate explicit policy and access decision permits it.
- Secrets stay in approved credential storage and never enter `.longtable`, manifests, transcripts, fixtures, or repository history.
- Access basis and terms reference are recorded without recording authentication material.

## 19. Verification Strategy

### Local automated tests

1. provider-neutral capability contract tests;
2. export-parser golden tests using sanitized XLS, CSV, RIS, NBIB, and JSON fixtures;
3. browser-recipe replay against accessibility snapshots and local HTML fixtures;
4. hard-stop, MCP cancellation, fallback, decision, and resume tests;
5. count-invariant and property tests;
6. network, partial-download, corrupt-PDF, empty-export, count-mismatch, placeholder-file, interrupted-run, DOI-missing, session-expiry, and result-cap failure injection;
7. secret, licensed-content, and path-leak scans;
8. model-call budget tests;
9. complete synthetic review from request through Word package;
10. deterministic rerender and provenance checks.

### Model-call budgets

- pagination: zero model calls;
- export and parsing: zero;
- DOI deduplication: zero;
- PRISMA counting: zero;
- search-strategy proposal: at most one per unchanged protocol draft;
- pilot interpretation: at most one per completed pilot snapshot;
- screening: only configured batches and ambiguous items, with cache reuse.

### Live institution smoke gate

After local tests pass, the researcher logs in and approves a small smoke run: 5-20 records per database, one metadata export, one or two permitted PDFs, Research PDF Vault intake, and report rendering. Bulk production is prohibited until the institution profile and recipe receive explicit approval.

## 20. Acceptance Criteria

- Only one LongTable Research surface is exposed for the integrated workflow.
- Existing MCP elicitation is the preferred transport for required checkpoints.
- No hard-stop run can resume without a DecisionRecord.
- Approved protocol revisions are immutable during production.
- Repetitive mechanical stages consume zero model calls.
- Interrupted runs resume at the last safe cursor without duplicating artifacts.
- PRISMA and corpus count invariants pass before rendering.
- Every material record, exclusion, acquisition, and manuscript count has provenance.
- No credentials, browser sessions, secrets, or licensed PDFs enter LongTable state or Git.
- Research PDF Vault is the only canonical PDF store.
- Researcher final reports and manuscript-ready Word artifacts are generated from canonical machine-readable state.
- Rerendering the same approved state produces identical counts and traceable content.
- A new institution cannot enter production without calibration, tests, a live smoke run, and researcher approval.

## 21. Researcher-Approved Decisions

- `decision_msh9nbsk_fc52od`: researcher login followed by supervised automation.
- `decision_msh9pddd_zrc6lj`: pilot, checkpoint, then frozen production protocol.
- `decision_msh9rfum_kjz6v1`: screen metadata before potential-inclusion PDF acquisition and generate manuscript-ready outputs.
- `decision_msh9up1f_r65s1d`: Research PDF Vault is the single canonical PDF store.
- `decision_msh9wf2w_c8ovx7`: one surface with an internal capability tree.
- `decision_msh9zxqn_h63enn`: receipt-based state machine with real hard stops.
- `decision_msha2raa_0ewqpq`: adaptive single-card MCP search UX.
- `decision_msha6r03_qtd2gx`: required checkpoints use MCP first; advisory information is nonblocking.
- `decision_msha91su_rc5qiu`: capability, database, and institution adapter layers with calibration.
- `decision_mshaayqg_4jul4u`: deterministic, exception-supervised, low-token execution.
- `decision_mshahg8d_ryn4tx`: canonical artifacts with multi-profile researcher and manuscript rendering.
- `decision_mshancvj_tz6i1l`: fixture-first verification with a live institution smoke gate.

## 22. Implementation Decomposition Boundary

This design is intentionally broader than one safe implementation change. The implementation plan must decompose it into independently verifiable tranches while preserving the single product surface:

1. core run, protocol, receipt, adapter, and checkpoint contracts;
2. MCP search-strategy and freeze UX;
3. deterministic corpus/export pipeline and local artifact contract;
4. Research PDF Vault integration;
5. browser executor, database recipes, and institution calibration;
6. screening and adjudication workflow;
7. reporting, PRISMA, reference, Word, and journal renderers;
8. fixture, failure, security, token-budget, E2E, and live-smoke gates.

Each tranche requires its own implementation plan and evidence-based verification. No tranche may weaken the approved access, checkpoint, provenance, or token-budget contracts to simplify delivery.
