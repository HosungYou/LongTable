# LongTable Research Institutional Workflow Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before claiming completion.

**Goal:** Implement the approved, reproducible institutional-database research workflow behind one LongTable Research surface, with durable hard stops, immutable production protocols, deterministic corpus processing, one canonical Research PDF Vault, and manuscript-ready outputs.

**Architecture:** Extend `@longtable/scholar-research` into the provider-neutral execution core. Keep database and institution behavior behind typed adapters; route required decisions through existing LongTable QuestionRecord/DecisionRecord and MCP elicitation; expose the integrated workflow as `longtable research` while retaining `scholar-research` as a compatibility alias. Machine-readable protocol, corpus, audit, and provenance files are canonical; reports and Word files are deterministic renderings.

**Tech Stack:** TypeScript 5.6, Node.js 18+, MCP SDK/Zod, existing LongTable core/checkpoint/CLI packages, deterministic CSV/RIS/NBIB/JSON parsers, SHA-256, JSONL/YAML/Markdown/HTML, and DOCX packaging through the bundled document runtime selected during Task 14.

**Global Constraints:** Preserve user edits in `.longtable/state.json` and `CURRENT.md`. Never persist credentials, cookies, session tokens, MFA material, authentication headers, or licensed PDF bytes in project state or Git. No CAPTCHA/paywall/access-control bypass. Use deterministic code for pagination, parsing, deduplication, counts, PRISMA, and rendering. A production run requires an approved InstitutionProfile and frozen ProtocolRevision. Every hard stop must persist a QuestionRecord and reject resume until a linked DecisionRecord exists. Each task begins with a failing smoke/contract test, implements the smallest passing behavior, runs targeted verification, and creates an atomic commit.

---

## Tranche 1 — Core run, protocol, receipt, adapter, and checkpoint contracts

### Task 1: Define institutional-research domain contracts

**Files:**
- Create: `packages/longtable-scholar-research/src/workflow-types.ts`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-institutional-workflow.mjs`
- Modify: `package.json`

**Step 1: Write the failing contract test**

Assert that the package exports the exact stage sequence, hard-stop codes, retryable codes, run/protocol/profile constructors, and safe profile validator. The test must instantiate this minimal boundary:

```ts
const revision = research.createProtocolRevision({
  id: "protocol-1",
  revision: 1,
  decisionRecordId: "decision-1",
  databases: ["wos"],
  queries: { wos: "TS=(hackathon AND competency)" },
  filters: { years: [2015, 2026], languages: ["en", "ko"], publicationTypes: ["article"] }
});
assert(Object.isFrozen(revision));
assertEqual(research.nextResearchStage("PILOT"), "PROTOCOL_CHECKPOINT");
```

**Step 2: Run the test to verify it fails**

Run: `npm run build --workspace @longtable/scholar-research && node scripts/smoke-institutional-workflow.mjs`
Expected: FAIL because `workflow-types.js` exports do not exist.

**Step 3: Implement the contracts**

Define and export:

```ts
export const RESEARCH_STAGES = [
  "SETUP", "PILOT", "PROTOCOL_CHECKPOINT", "PRODUCTION_SEARCH",
  "EXPORT_AUDIT", "TITLE_ABSTRACT_SCREENING", "FULLTEXT_PLAN_CHECKPOINT",
  "FULLTEXT_ACQUISITION", "FULLTEXT_SCREENING", "CORPUS_FREEZE_CHECKPOINT",
  "ANALYSIS", "SYNTHESIS", "RESEARCHER_REPORT", "MANUSCRIPT_PACKAGE"
] as const;

export type ResearchRunStatus = "planned" | "running" | "blocked" | "completed" | "failed";
export interface ProtocolRevision { readonly id: string; readonly revision: number; readonly frozenAt: string; readonly decisionRecordId: string; readonly protocolHash: string; readonly databases: readonly string[]; readonly queries: Readonly<Record<string, string>>; readonly filters: Readonly<SearchFilters>; }
export interface StageReceipt { readonly id: string; readonly runId: string; readonly stage: ResearchStage; readonly protocolRevisionId: string; readonly inputArtifactIds: readonly string[]; readonly outputArtifactIds: readonly string[]; readonly cursor: string; readonly createdAt: string; }
```

Also define ResearchRun, InstitutionProfile, ArtifactProvenance, capability names, database-adapter interfaces, hard-stop codes, retryable-event codes, canonical constructors, SHA-256 protocol hashing, deep freezing, and a validator that rejects forbidden secret-like profile keys.

**Step 4: Register and run the smoke test**

Add `smoke:institutional-workflow` before `typecheck` in root `npm test`.

Run: `npm run smoke:institutional-workflow && npm run typecheck --workspace @longtable/scholar-research`
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json packages/longtable-scholar-research/src/index.ts packages/longtable-scholar-research/src/workflow-types.ts scripts/smoke-institutional-workflow.mjs
git commit -m "feat(research): define institutional workflow contracts"
```

### Task 2: Implement receipt-backed state transitions and real hard stops

**Files:**
- Create: `packages/longtable-scholar-research/src/workflow-state.ts`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-institutional-workflow.mjs`

**Step 1: Add failing transition tests**

Test valid advancement, invalid stage skipping, safe-cursor persistence, hard-stop creation, and resume rejection without an answer-linked decision. Include this assertion:

```ts
const blocked = research.blockResearchRun(run, {
  code: "EXPORT_COUNT_MISMATCH",
  questionRecordId: "question-1",
  safeCursor: "wos:page:3"
});
assertThrows(() => research.resumeResearchRun(blocked, []), /DecisionRecord/);
```

**Step 2: Verify failure**

Run: `npm run smoke:institutional-workflow`
Expected: FAIL because transition functions are absent.

**Step 3: Implement state-machine guards**

Implement `advanceResearchRun`, `blockResearchRun`, and `resumeResearchRun`. Advancement requires a StageReceipt for the current stage. Resume requires a DecisionRecord whose `id` matches the blocking QuestionRecord's `decisionRecordId` and whose checkpoint key matches the stop. Keep the last safe cursor stable across repeated identical failures.

**Step 4: Verify**

Run: `npm run smoke:institutional-workflow && npm run typecheck --workspace @longtable/scholar-research`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/longtable-scholar-research/src/index.ts packages/longtable-scholar-research/src/workflow-state.ts scripts/smoke-institutional-workflow.mjs
git commit -m "feat(research): enforce receipt-backed hard stops"
```

### Task 3: Create the canonical local project scaffold and append-only stores

**Files:**
- Create: `packages/longtable-scholar-research/src/project-store.ts`
- Modify: `packages/longtable-scholar-research/src/protocol.ts`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-institutional-workflow.mjs`

**Step 1: Add a failing filesystem test**

Create a temporary project; assert the complete `protocol/`, `data/`, `corpus/`, `audit/`, `reports/`, `manuscript/`, `analysis/`, `references/`, and `.longtable/research-runs/` contract. Verify that append helpers write newline-delimited records and refuse mutation of an already frozen protocol revision.

**Step 2: Verify failure**

Run: `npm run smoke:institutional-workflow`
Expected: FAIL on missing directories/store functions.

**Step 3: Implement deterministic stores**

Implement `buildResearchProjectLayout`, `writeResearchProjectScaffold`, `appendJsonlRecord`, `readJsonlRecords`, `writeFrozenProtocolRevision`, and `readLatestProtocolRevision`. Write atomically through a same-directory temporary file plus rename for snapshots; use append-only JSONL for receipts, checkpoints, decisions, exclusions, deviations, and failures.

**Step 4: Verify and commit**

Run: `npm run smoke:institutional-workflow && npm run typecheck`

```bash
git add packages/longtable-scholar-research/src/index.ts packages/longtable-scholar-research/src/project-store.ts packages/longtable-scholar-research/src/protocol.ts scripts/smoke-institutional-workflow.mjs
git commit -m "feat(research): scaffold canonical research projects"
```

---

## Tranche 2 — MCP-first search-strategy and freeze UX

### Task 4: Build adaptive checkpoint cards and QuestionRecord mappings

**Files:**
- Create: `packages/longtable-scholar-research/src/checkpoints.ts`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Modify: `packages/longtable-scholar-research/package.json`
- Test: `scripts/smoke-institutional-checkpoints.mjs`
- Modify: `package.json`

**Step 1: Add failing checkpoint tests**

Test one compact search-strategy card, progressive database multi-select only after `modify_databases`, pilot-freeze, full-text plan, corpus freeze, access ambiguity, screening conflict, and analysis-method questions. Required records must set `hardStop: true`, the correct `hardStopScope`, and `preferredSurfaces: ["mcp_elicitation", "numbered"]`.

**Step 2: Verify failure**

Run: `npm run build && node scripts/smoke-institutional-checkpoints.mjs`
Expected: FAIL because builders do not exist.

**Step 3: Implement pure checkpoint builders**

Add `@longtable/core` as a workspace dependency and depend on its types only. Generate stable checkpoint keys from run ID, protocol revision, stage, and stop code. Never choose a default response after cancel, decline, timeout, or unsupported MCP transport.

**Step 4: Register, verify, and commit**

Run: `npm run smoke:institutional-checkpoints && npm run typecheck`

```bash
git add package.json package-lock.json packages/longtable-scholar-research/package.json packages/longtable-scholar-research/src/checkpoints.ts packages/longtable-scholar-research/src/index.ts scripts/smoke-institutional-checkpoints.mjs
git commit -m "feat(research): add MCP-first research checkpoint cards"
```

### Task 5: Expose one `longtable research` surface with compatibility aliases

**Files:**
- Modify: `packages/longtable/src/cli.ts`
- Modify: `packages/longtable-mcp/src/server.ts`
- Modify: `packages/longtable/README.md`
- Modify: `docs/LONGTABLE-COMMAND-SURFACE.md`
- Test: `scripts/smoke-institutional-checkpoints.mjs`

**Step 1: Add failing CLI/MCP routing tests**

Assert `longtable research doctor|init|status|checkpoint` works, `longtable scholar-research ...` delegates to the same handlers with a deprecation field, and MCP `elicit_question` persists then reuses the same pending QuestionRecord on fallback.

**Step 2: Verify failure**

Run: `npm run build && node scripts/smoke-institutional-checkpoints.mjs`
Expected: FAIL on the `research` command.

**Step 3: Implement routing**

Rename the internal handler to `runLongTableResearch`; map both command names to it. Add `research` to command parsing/help. Do not expose database-specific commands as new top-level surfaces. Reuse existing MCP elicitation rather than creating a second question transport.

**Step 4: Verify and commit**

Run: `npm run smoke:institutional-checkpoints && npm run smoke:scholar-research && npm run typecheck`

```bash
git add packages/longtable/src/cli.ts packages/longtable-mcp/src/server.ts packages/longtable/README.md docs/LONGTABLE-COMMAND-SURFACE.md scripts/smoke-institutional-checkpoints.mjs
git commit -m "feat(research): expose one integrated research surface"
```

---

## Tranche 3 — Deterministic corpus/export pipeline

### Task 6: Implement sanitized export parsers and golden fixtures

**Files:**
- Create: `packages/longtable-scholar-research/src/export-parsers.ts`
- Create: `packages/longtable-scholar-research/fixtures/exports/crossref.json`
- Create: `packages/longtable-scholar-research/fixtures/exports/pubmed.nbib`
- Create: `packages/longtable-scholar-research/fixtures/exports/scopus.ris`
- Create: `packages/longtable-scholar-research/fixtures/exports/wos.csv`
- Create: `packages/longtable-scholar-research/fixtures/exports/expected-records.json`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-export-parsers.mjs`
- Modify: `package.json`

**Step 1: Write failing golden tests**

Assert identical canonical bibliographic records for DOI, title, authors, year, abstract, database source, source record ID, and export artifact hash. Include quoted CSV fields, folded RIS lines, multi-valued NBIB tags, missing DOI, Korean text, and empty export rejection.

**Step 2: Verify failure**

Run: `npm run build --workspace @longtable/scholar-research && node scripts/smoke-export-parsers.mjs`
Expected: FAIL on parser imports.

**Step 3: Implement parsers without model calls**

Implement `parseCsvExport`, `parseRisExport`, `parseNbibExport`, `parseJsonExport`, and `parseExportArtifact`. Return records plus parse rejections with explicit reasons; never discard malformed rows silently.

**Step 4: Register, verify, and commit**

Run: `npm run smoke:export-parsers && npm run typecheck --workspace @longtable/scholar-research`

```bash
git add package.json packages/longtable-scholar-research/src packages/longtable-scholar-research/fixtures/exports scripts/smoke-export-parsers.mjs
git commit -m "feat(research): parse scholarly exports deterministically"
```

### Task 7: Normalize, deduplicate, and enforce corpus invariants

**Files:**
- Create: `packages/longtable-scholar-research/src/corpus.ts`
- Create: `packages/longtable-scholar-research/src/invariants.ts`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-corpus-pipeline.mjs`
- Modify: `package.json`

**Step 1: Add failing deterministic and property-style tests**

Test DOI normalization, exact DOI merge, exact normalized title/year fallback, version links, duplicate provenance, stable IDs, order-independent output, and all four approved count equations. Test that PRISMA eligibility is false when any equation fails.

**Step 2: Verify failure**

Run: `npm run build --workspace @longtable/scholar-research && node scripts/smoke-corpus-pipeline.mjs`
Expected: FAIL on corpus imports.

**Step 3: Implement the pipeline**

Implement pure `normalizeRecords`, `deduplicateRecords`, `calculateCorpusCounts`, and `verifyCorpusInvariants`. Keep every source link and rejection/exclusion basis. Sort canonical output by stable paper ID.

**Step 4: Register, verify, and commit**

Run: `npm run smoke:corpus-pipeline && npm run typecheck`

```bash
git add package.json packages/longtable-scholar-research/src/corpus.ts packages/longtable-scholar-research/src/invariants.ts packages/longtable-scholar-research/src/index.ts scripts/smoke-corpus-pipeline.mjs
git commit -m "feat(research): build auditable canonical corpora"
```

---

## Tranche 4 — Research PDF Vault integration

### Task 8: Intake lawful PDFs into one canonical vault

**Files:**
- Create: `packages/longtable-scholar-research/src/pdf-vault.ts`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-pdf-vault.mjs`
- Modify: `package.json`

**Step 1: Add failing vault tests**

Use synthetic PDF bytes. Assert SHA-256 identity, one canonical file per hash, project manifest references rather than copies, access-basis requirement, placeholder/partial/corrupt PDF rejection, and no licensed bytes beneath the project directory.

**Step 2: Verify failure**

Run: `npm run build --workspace @longtable/scholar-research && node scripts/smoke-pdf-vault.mjs`
Expected: FAIL on vault imports.

**Step 3: Implement safe intake**

Implement `inspectPdfCandidate`, `intakeResearchPdf`, `buildPdfManifestRecord`, and `verifyPdfManifest`. The caller supplies a configured absolute vault root; reject vault roots inside the project and canonical paths outside the root. Record paperId, SHA, source URL, acquisition method, access basis, version, inclusion state, and screening state—never auth material.

**Step 4: Register, verify, and commit**

Run: `npm run smoke:pdf-vault && npm run typecheck`

```bash
git add package.json packages/longtable-scholar-research/src/pdf-vault.ts packages/longtable-scholar-research/src/index.ts scripts/smoke-pdf-vault.mjs
git commit -m "feat(research): integrate the canonical Research PDF Vault"
```

---

## Tranche 5 — Database adapters, supervised browser execution, and institution calibration

### Task 9: Implement capability contracts and institution-profile approval

**Files:**
- Create: `packages/longtable-scholar-research/src/adapters.ts`
- Create: `packages/longtable-scholar-research/src/institutions.ts`
- Create: `packages/longtable-scholar-research/fixtures/institutions/psu-sanitized.json`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-institution-adapters.mjs`
- Modify: `package.json`

**Step 1: Add failing contract tests**

Run a fake adapter through open, authentication verification, query, filters, result count, export, export verification, full-text resolution, permitted download, suspend, and resume. Assert unsupported capabilities are explicit. Assert an institution remains ineligible until calibration receipt, fixture replay, live smoke receipt, and profile-approval DecisionRecord all exist.

**Step 2: Verify failure**

Run: `npm run build && node scripts/smoke-institution-adapters.mjs`
Expected: FAIL on adapter/profile imports.

**Step 3: Implement typed layers**

Add adapter registry, capability result union, sanitized InstitutionProfile loader/validator, and `assessProductionEligibility`. The PSU fixture contains database IDs, access modes, resolver patterns, export defaults, result caps, storage references, and verification dates only.

**Step 4: Register, verify, and commit**

Run: `npm run smoke:institution-adapters && npm run typecheck`

```bash
git add package.json packages/longtable-scholar-research/src/adapters.ts packages/longtable-scholar-research/src/institutions.ts packages/longtable-scholar-research/src/index.ts packages/longtable-scholar-research/fixtures/institutions scripts/smoke-institution-adapters.mjs
git commit -m "feat(research): add database and institution adapter contracts"
```

### Task 10: Implement accessibility-first browser recipes and calibration replay

**Files:**
- Create: `packages/longtable-scholar-research/src/browser-recipes.ts`
- Create: `packages/longtable-scholar-research/fixtures/browser/wos-results.html`
- Create: `packages/longtable-scholar-research/fixtures/browser/wos-export.html`
- Create: `packages/longtable-scholar-research/fixtures/browser/signatures.json`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-browser-recipes.mjs`
- Modify: `package.json`

**Step 1: Add failing replay tests**

Assert semantic landmark matching, page-signature hashing, bounded coordinate fallback only after a matching signature, export-count extraction, and hard stops for login, MFA/CAPTCHA, session expiry, changed signatures, changed download patterns, terms ambiguity, and result caps.

**Step 2: Verify failure**

Run: `npm run build && node scripts/smoke-browser-recipes.mjs`
Expected: FAIL on recipe imports.

**Step 3: Implement replayable recipes**

Implement pure recipe validation/replay over sanitized accessibility snapshots. Add executor action/result types without embedding a browser vendor. Production execution accepts only approved recipe version + matching signature; generic exploration is flagged `pilot_or_calibration_only`.

**Step 4: Register, verify, and commit**

Run: `npm run smoke:browser-recipes && npm run typecheck`

```bash
git add package.json packages/longtable-scholar-research/src/browser-recipes.ts packages/longtable-scholar-research/src/index.ts packages/longtable-scholar-research/fixtures/browser scripts/smoke-browser-recipes.mjs
git commit -m "feat(research): add supervised browser recipe replay"
```

---

## Tranche 6 — Screening and adjudication

### Task 11: Implement title/abstract and full-text screening ledgers

**Files:**
- Create: `packages/longtable-scholar-research/src/screening.ts`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-screening.mjs`
- Modify: `package.json`

**Step 1: Add failing screening tests**

Test decisions `include`, `exclude`, `pending`, and `full_text_needed_for_screening`; rule/codebook versions; human and AI actor attribution; exclusion reasons; weak/missing abstract routing; batch cache keys; and deterministic candidate counts.

**Step 2: Verify failure**

Run: `npm run build && node scripts/smoke-screening.mjs`
Expected: FAIL on screening imports.

**Step 3: Implement screening records and reducers**

Implement stable screening decision IDs, append-only decision validation, latest-decision reduction, candidate selection, and full-text missing-threshold calculation. Do not call an LLM from these reducers.

**Step 4: Register, verify, and commit**

Run: `npm run smoke:screening && npm run typecheck`

```bash
git add package.json packages/longtable-scholar-research/src/screening.ts packages/longtable-scholar-research/src/index.ts scripts/smoke-screening.mjs
git commit -m "feat(research): add reproducible screening ledgers"
```

### Task 12: Enforce human–AI conflict and method-change checkpoints

**Files:**
- Modify: `packages/longtable-scholar-research/src/screening.ts`
- Modify: `packages/longtable-scholar-research/src/checkpoints.ts`
- Modify: `packages/longtable-scholar-research/src/workflow-state.ts`
- Test: `scripts/smoke-screening.mjs`

**Step 1: Add failing conflict tests**

Assert that human–AI disagreement, ambiguous rules, excess missing full text, analysis-method changes, and corpus freeze requirements create the correct hard stop and cannot advance or resume without the linked decision.

**Step 2: Verify failure**

Run: `npm run smoke:screening`
Expected: FAIL on conflict resolution behavior.

**Step 3: Implement conflict aggregation**

Bundle repeated conflicts by checkpoint key, retain all affected paper IDs in the audit record, and ask one MCP question. Implement explicit adjudication application that writes a new screening decision rather than mutating prior decisions.

**Step 4: Verify and commit**

Run: `npm run smoke:screening && npm run smoke:institutional-checkpoints && npm run typecheck`

```bash
git add packages/longtable-scholar-research/src/screening.ts packages/longtable-scholar-research/src/checkpoints.ts packages/longtable-scholar-research/src/workflow-state.ts scripts/smoke-screening.mjs
git commit -m "feat(research): hard-stop ambiguous screening decisions"
```

---

## Tranche 7 — Reporting, PRISMA, references, Word, and journal renderers

### Task 13: Render deterministic researcher and PRISMA reports

**Files:**
- Create: `packages/longtable-scholar-research/src/reporting.ts`
- Create: `packages/longtable-scholar-research/src/prisma.ts`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-research-reporting.mjs`
- Modify: `package.json`

**Step 1: Add failing snapshot tests**

Build a synthetic completed review and assert researcher report sections, exact database yields, recovered failures, unresolved actions, protocol deviations, analysis readiness, PRISMA count table, and SVG flow. Assert planned runs use future tense and completed runs use past tense. Assert rendering is blocked when invariants fail.

**Step 2: Verify failure**

Run: `npm run build && node scripts/smoke-research-reporting.mjs`
Expected: FAIL on renderer imports.

**Step 3: Implement deterministic renderers**

Render Markdown, JSON, CSV count table, and SVG from canonical artifacts only. Add ArtifactProvenance entries for every report/table/figure and stable sorting so reruns match byte-for-byte except where the caller explicitly changes the rendering timestamp.

**Step 4: Register, verify, and commit**

Run: `npm run smoke:research-reporting && npm run typecheck`

```bash
git add package.json packages/longtable-scholar-research/src/reporting.ts packages/longtable-scholar-research/src/prisma.ts packages/longtable-scholar-research/src/index.ts scripts/smoke-research-reporting.mjs
git commit -m "feat(research): render auditable researcher and PRISMA reports"
```

### Task 14: Render references, manuscript sections, and APA 7 Word packages

**Files:**
- Create: `packages/longtable-scholar-research/src/references.ts`
- Create: `packages/longtable-scholar-research/src/manuscript.ts`
- Create: `packages/longtable-scholar-research/src/word-renderer.ts`
- Create: `packages/longtable-scholar-research/src/render-profiles.ts`
- Create: `packages/longtable-scholar-research/fixtures/render-profiles/apa7.json`
- Create: `packages/longtable-scholar-research/fixtures/render-profiles/korean-journal.json`
- Modify: `packages/longtable-scholar-research/package.json`
- Modify: `packages/longtable-scholar-research/src/index.ts`
- Test: `scripts/smoke-manuscript-package.mjs`
- Modify: `package.json`

**Step 1: Inspect and lock the local document runtime**

Run the workspace dependency loader and `scripts/generate_longtable_bjet_apa7.py` inspection. Record the selected maintained DOCX library and exact package version in `packages/longtable-scholar-research/package.json`; do not invent OOXML when a supported local runtime exists.

**Step 2: Add failing reference and Word tests**

Assert deterministic CSL JSON, RIS, BibTeX, APA 7 references, unresolved-citation report, systematic-review Methods/Results, meta-analysis readiness tables, paragraph/table provenance map, valid DOCX ZIP structure, APA 7 memory/template profile, Korean-journal profile, and user-supplied template-profile validation.

**Step 3: Verify failure**

Run: `npm run build && node scripts/smoke-manuscript-package.mjs`
Expected: FAIL on renderer imports.

**Step 4: Implement renderers**

Generate content only from approved state. Refuse to claim an unexecuted database, unavailable full text, or unapproved analysis. Store hashes and source artifact IDs for every paragraph, table, and figure. Keep the source profile declarative so a target journal can be added without changing research state.

**Step 5: Register, verify, and commit**

Run: `npm run smoke:manuscript-package && npm run typecheck`

```bash
git add package.json package-lock.json packages/longtable-scholar-research/package.json packages/longtable-scholar-research/src packages/longtable-scholar-research/fixtures/render-profiles scripts/smoke-manuscript-package.mjs
git commit -m "feat(research): render APA7 and journal manuscript packages"
```

---

## Tranche 8 — Failure, security, token-budget, E2E, and live-smoke gates

### Task 15: Add failure injection, security scans, and model-call budgets

**Files:**
- Create: `packages/longtable-scholar-research/src/retry.ts`
- Create: `packages/longtable-scholar-research/src/model-budget.ts`
- Create: `scripts/smoke-research-failures.mjs`
- Create: `scripts/audit-research-artifacts.mjs`
- Modify: `package.json`

**Step 1: Add failing fault tests**

Inject network timeout, delayed export, partial download, corrupt PDF, empty export, count mismatch, placeholder file, interrupted run, missing DOI, session expiry, result cap, and OneDrive hydration delay. Assert bounded retries for approved retryable events, one aggregated advisory, no retry for hard stops, idempotent resume, and zero model calls for mechanical stages.

**Step 2: Add failing security tests**

Seed synthetic credential/cookie/token/auth-header keys, licensed byte markers, and absolute path leaks. Assert audit failure. Assert clean fixtures pass and report exact artifact IDs without printing secret values.

**Step 3: Implement retry and budget guards**

Use deterministic capped exponential schedules returned as data rather than sleeping in tests. Implement stage budgets and cache keys from artifact hash + rule/codebook version + prompt version + model version.

**Step 4: Register, verify, and commit**

Run: `npm run smoke:research-failures && node scripts/audit-research-artifacts.mjs --fixtures && npm run typecheck`

```bash
git add package.json packages/longtable-scholar-research/src/retry.ts packages/longtable-scholar-research/src/model-budget.ts scripts/smoke-research-failures.mjs scripts/audit-research-artifacts.mjs
git commit -m "test(research): enforce failure security and token budgets"
```

### Task 16: Complete the synthetic review and live institution smoke gate

**Files:**
- Create: `scripts/e2e-institutional-review.mjs`
- Create: `docs/INSTITUTIONAL-RESEARCH-WORKFLOW.md`
- Modify: `README.md`
- Modify: `Spec.md`
- Modify: `package.json`
- Test: `scripts/e2e-institutional-review.mjs`

**Step 1: Write the failing end-to-end scenario**

Run a synthetic request through setup, pilot, protocol checkpoint, frozen production, export audit, title/abstract screening, full-text plan, PDF Vault intake, full-text screening, corpus freeze, analysis readiness, researcher report, PRISMA, references, and Word package. Simulate MCP cancellation followed by numbered fallback, process interruption/resume, and a protocol amendment. Assert no duplicate artifact and deterministic rerender.

**Step 2: Verify failure**

Run: `npm run build && node scripts/e2e-institutional-review.mjs`
Expected: FAIL until all layers are connected.

**Step 3: Wire the integrated coordinator and CLI commands**

Add `research pilot`, `research freeze`, `research ingest-export`, `research screen`, `research acquire`, `research report`, and `research package` subcommands behind the single surface. The live-smoke command permits 5–20 records, one metadata export, and one or two permitted PDFs only; it writes a receipt and requires researcher approval before setting production eligibility.

**Step 4: Document the researcher workflow**

Document login ownership, MCP checkpoints, numbered fallback, artifact locations, resume behavior, PDF Vault configuration, profile calibration, live-smoke limits, researcher final report, manuscript package, and the security boundary. Link the approved design and this implementation plan from `Spec.md`.

**Step 5: Run full verification**

Run:

```bash
npm test
npm run pack:check
node scripts/audit-research-artifacts.mjs --repo .
git diff --check
git status --short
```

Expected: all tests pass; no secrets/licensed PDFs/path leaks; only the user's pre-existing `.longtable/state.json` and `CURRENT.md` modifications remain outside implementation commits.

**Step 6: Commit**

```bash
git add README.md Spec.md package.json docs/INSTITUTIONAL-RESEARCH-WORKFLOW.md packages/longtable packages/longtable-mcp packages/longtable-scholar-research scripts/e2e-institutional-review.mjs
git commit -m "feat(research): complete institutional review workflow"
```

---

## Completion Audit

Before marking the implementation complete:

1. Map every acceptance criterion in design section 20 to at least one passing automated assertion and one canonical artifact.
2. Confirm every hard-stop code has a creation, MCP/fallback, decision, and resume test.
3. Confirm every deterministic stage has a zero-model-call assertion.
4. Confirm every rendered count, paragraph, table, figure, and reference has ArtifactProvenance.
5. Confirm protocol revisions are frozen, raw exports are immutable after intake, and repeated resume/rerender operations are idempotent.
6. Confirm the Research PDF Vault is the only PDF byte store and project manifests contain references only.
7. Confirm a new institution cannot enter production without calibration, replay fixtures, live smoke, and profile approval.
8. Run `rg -n "TODO|TBD|FIXME|placeholder" packages/longtable-scholar-research packages/longtable-mcp packages/longtable scripts docs/INSTITUTIONAL-RESEARCH-WORKFLOW.md` and resolve any implementation placeholders introduced by this plan.
9. Review `git diff --stat`, `git diff --check`, and all commits while excluding the user's existing `.longtable/state.json` and `CURRENT.md` edits.
