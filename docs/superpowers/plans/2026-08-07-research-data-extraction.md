# Research Data Extraction Implementation Plan

**Goal:** Make research-variable extraction a first-class, reproducible phase between corpus freeze and analysis.

**Constraints:** Keep the engine corpus-neutral; persist no credentials or licensed full text; require evidence provenance and DecisionRecords at protected checkpoints; use deterministic code for validation, comparison, conflict detection, adjudication, hashing, and readiness.

## Task 1: Lock the public contract with failing tests

- Extend the institutional workflow smoke test with the approved stage sequence and five new hard-stop codes.
- Add `scripts/smoke-data-extraction.mjs` covering profile freeze/hash, required evidence, double extraction, conflict detection, adjudication, dataset freeze, idempotent replay, and pre-analysis blocking.
- Add the targeted smoke command to `package.json` and run it once to record the expected red state.

## Task 2: Implement the extraction domain

- Add typed extraction profiles, records, evidence, conflicts, adjudications, reliability summaries, and dataset freezes.
- Canonicalize and SHA-256 hash profiles and frozen datasets.
- Validate field types, categorical values, required fields, evidence provenance, profile hashes, and independent extractor identity.
- Detect field-level conflicts deterministically, adjudicate them, and reject freeze while required work or conflicts remain.
- Export the module and pass the targeted smoke test.

## Task 3: Integrate stages, checkpoints, and storage

- Insert extraction plan, pilot, extraction, adjudication, and data-freeze stages after corpus freeze.
- Add the five extraction hard stops to checkpoint and resume coverage.
- Extend the project scaffold with extraction-profile, pilot, extracted, adjudicated, analysis-ready, record, conflict, adjudication, and freeze paths.
- Update model-budget policy so mechanical extraction validation/comparison does not consume model calls.
- Run institutional workflow, checkpoint, project-store/E2E, and data-extraction tests.

## Task 4: Add one researcher-facing command surface

- Extend `longtable research` with `freeze-extraction`, `extract`, `adjudicate-extraction`, and `freeze-data` commands using JSON inputs and JSON outputs.
- Ensure each command writes or validates only declared project artifacts and is safe to replay.
- Add CLI/E2E assertions for help text, artifacts, rejection paths, and successful freeze.

## Task 5: Make reports and manuscripts extraction-aware

- Add extraction profile/hash, design, reliability, conflicts/adjudications, missingness, and data-freeze provenance to report/manuscript inputs and rendered outputs.
- Update workflow, acceptance-audit, and command documentation.
- Run reporting and manuscript package tests.

## Task 6: Verify and amend PR #24

- Run `npm test`, `npm run pack:check`, `git diff --check`, and secret/path audits.
- Commit cohesive changes, push the existing branch, update the draft PR body with the extraction amendment, and verify CI success.
- Return to the empirical research project only after the product workflow is green.
