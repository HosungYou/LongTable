# Research Data Extraction Design

**Status:** Approved by the researcher on 2026-08-07  
**Scope:** Extend the institutional research workflow in PR #24 so metadata acquisition and research-variable extraction are distinct, auditable phases.

## Problem

The current workflow freezes the eligible corpus and moves directly to analysis. That preserves source acquisition but does not prove how study- or document-level variables were extracted, compared between extractors, adjudicated, or frozen. Metadata is not research data: citation, procurement, and course metadata identify units; research data are the coded variables used in tables, graphs, models, and manuscript claims.

## Approved workflow

```text
metadata import and source-document acquisition
-> corpus screening and corpus freeze
-> extraction profile/codebook checkpoint
-> extraction pilot
-> reliability checkpoint
-> double extraction
-> conflict detection and adjudication
-> extracted-data freeze
-> analysis and synthesis
```

The engine is corpus-neutral. An `ExtractionProfile` declares the unit of analysis, field definitions, allowed values, evidence requirements, version, approving DecisionRecord, and deterministic hash. A profile may represent scholarly studies, procurement documents, training courses, or another declared corpus; current-study vocabulary must not be hard-coded into the runtime.

## Data model

- `ExtractionFieldDefinition`: stable field ID, label, value type, required flag, allowed values, and whether source evidence is mandatory.
- `ExtractionProfile`: stable ID/version, corpus type, unit of analysis, fields, approval provenance, frozen timestamp, and SHA-256 profile hash.
- `ExtractionRecord`: unit ID, profile/hash, extractor identity and human/AI type, field values, evidence spans, source artifact IDs, timestamp, and lifecycle status.
- `ExtractionConflict`: unit/field pair, compared record IDs, conflicting values, and open/resolved state.
- `ExtractionAdjudication`: conflict ID, final value, rationale, adjudicator, evidence, timestamp, and DecisionRecord when the resolution changes a protected rule.
- `ExtractedDatasetFreeze`: profile hash, included adjudicated records, unresolved-conflict count, completeness and reliability results, artifact hash, approving DecisionRecord, and freeze timestamp.

Raw licensed full text, browser credentials, cookies, and session tokens remain outside `.longtable`. Extraction records keep bounded evidence locators or short evidence spans and artifact provenance.

## Invariants and hard stops

Analysis cannot begin unless:

1. the extraction profile is frozen and linked to a DecisionRecord;
2. the pilot meets the declared reliability threshold;
3. required double extraction is complete;
4. required fields and evidence are present;
5. every material conflict is adjudicated; and
6. the extracted dataset is frozen with a deterministic hash.

The workflow adds hard stops for an unfrozen schema, ambiguous extraction rule, below-threshold reliability, unresolved double-extraction conflict, and missing extracted-data freeze. Resume requires an answer-linked DecisionRecord through the existing checkpoint system.

## Storage layout

The scaffold adds durable extraction paths without silently treating screened documents as analysis-ready data:

```text
protocol/extraction-profiles/
data/05_extraction-pilot/
data/06_extracted/
data/07_adjudicated/
data/08_analysis-ready/
corpus/extraction-records.jsonl
corpus/extraction-conflicts.jsonl
corpus/extraction-adjudications.jsonl
audit/extracted-data-freezes.jsonl
```

## Researcher-facing surface

The single `longtable research` surface gains commands to freeze an extraction profile, validate/import extraction records, adjudicate conflicts, and freeze the extracted dataset. Reports and manuscript packages state the extraction profile/hash, extractor design, reliability statistic/threshold, conflicts, adjudications, missingness, and data-freeze identifier so the Methods and Results sections can reuse the audit trail.

## Verification

Tests must prove deterministic profile and dataset hashes; required evidence validation; independent record comparison; conflict and adjudication behavior; hard-stop coverage and decision-linked resume; idempotent replay; scaffold paths; and rejection of analysis before extracted-data freeze. Existing workflow, credential-safety, export, screening, reporting, packaging, and full E2E tests must remain green.
