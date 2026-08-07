import { strict as assert } from "node:assert";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(resolve(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));

const counts = {
  identified: 12,
  normalized: 11,
  parseRejected: 1,
  unique: 9,
  duplicateLinks: 2,
  titleAbstractScreened: 9,
  fulltextCandidates: 5,
  titleAbstractExcluded: 3,
  titleAbstractPending: 1,
  fulltextSought: 5,
  fulltextRetrieved: 4,
  fulltextNotRetrieved: 1,
  fulltextAssessed: 4,
  finalIncluded: 2,
  fulltextExcluded: 2,
  unresolved: 0
};

const input = {
  run: {
    id: "run-reporting",
    createdAt: "2026-08-06T06:00:00.000Z",
    updatedAt: "2026-08-06T07:00:00.000Z",
    status: "completed",
    stage: "RESEARCHER_REPORT",
    protocolRevisionId: "protocol-1",
    institutionProfileId: "psu-sanitized"
  },
  protocol: {
    id: "protocol-1",
    revision: 1,
    frozenAt: "2026-08-06T06:10:00.000Z",
    decisionRecordId: "decision-protocol-1",
    databases: ["web-of-science", "scopus"],
    queries: {
      "web-of-science": "TS=(hackathon AND workplace competency)",
      scopus: "TITLE-ABS-KEY(hackathon AND workplace competency)"
    },
    filters: { years: [2015, 2026], languages: ["English", "Korean"], publicationTypes: ["Article"] },
    protocolHash: "a".repeat(64)
  },
  counts,
  databaseYields: [
    { databaseId: "scopus", searchedAt: "2026-08-06T06:31:00.000Z", resultCount: 5, exportedCount: 5 },
    { databaseId: "web-of-science", searchedAt: "2026-08-06T06:30:00.000Z", resultCount: 7, exportedCount: 7 }
  ],
  failures: [{ code: "DELAYED_EXPORT_GENERATION", count: 1, resolution: "retry_succeeded" }],
  unresolvedIssues: [],
  deviations: [{ id: "deviation-1", description: "One export was regenerated.", decisionRecordId: "decision-export-1" }],
  analysisReadiness: "ready",
  extraction: {
    profileId: "extraction-v1", profileHash: "b".repeat(64), corpusType: "scholarly_study", unitOfAnalysis: "included study",
    doubleExtractionRequired: true, recordCount: 4, unitCount: 2, reliabilityStatistic: "cohens_kappa",
    reliabilityThreshold: 0.8, reliabilityObserved: 0.9, conflictCount: 1, adjudicatedCount: 1,
    missingRequiredValueCount: 0, datasetFreezeId: "freeze-v1", datasetHash: "c".repeat(64)
  },
  requiredActions: ["Archive the frozen corpus with the manuscript package."],
  generatedArtifacts: ["corpus/frozen-corpus.jsonl"],
  inputArtifactIds: ["corpus-frozen-1", "screening-ledger-1"],
  renderTimestamp: "2026-08-06T07:30:00.000Z",
  generatorVersion: "0.1.72"
};

const first = research.renderResearchOutputs(input);
const second = research.renderResearchOutputs(input);
assert.deepEqual(first, second, "fixed state and timestamp must render byte-for-byte deterministically");
assert.match(first.researcherReportMarkdown, /## Protocol and databases/);
assert.match(first.researcherReportMarkdown, /web-of-science/);
assert.match(first.researcherReportMarkdown, /## Database yields/);
assert.match(first.researcherReportMarkdown, /## Failures and recoveries/);
assert.match(first.researcherReportMarkdown, /## Unresolved issues/);
assert.match(first.researcherReportMarkdown, /## Deviations/);
assert.match(first.researcherReportMarkdown, /## Analysis readiness/);
assert.match(first.researcherReportMarkdown, /## Research-data extraction/);
assert.match(first.systematicReviewMarkdown, /extraction-v1/);
assert.match(first.researcherReportMarkdown, /## Required researcher actions/);
assert.match(first.researcherReportMarkdown, /## Generated artifacts/);
assert.match(first.prismaCountTableMarkdown, /Identified records.*12/);
assert.match(first.prismaFlowSvg, /<svg/);
assert.match(first.prismaFlowSvg, /Studies included in review/);
assert.equal(first.artifactProvenance.length, 4);
assert(first.artifactProvenance.every((entry) => entry.protocolRevisionId === "protocol-1"));
assert(first.artifactProvenance.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));

const planned = research.renderSystematicReviewNarrative({ status: "planned", protocol: input.protocol, counts });
assert.match(planned.methodsMarkdown, /will be searched/);
assert.equal(planned.resultsMarkdown, undefined);
const completed = research.renderSystematicReviewNarrative({ status: "completed", protocol: input.protocol, counts });
assert.match(completed.methodsMarkdown, /were searched/);
assert.match(completed.resultsMarkdown, /Twelve records were identified/);

assert.throws(() => research.renderResearchOutputs({
  ...input,
  counts: { ...counts, finalIncluded: 3 }
}), /corpus count invariants/i);

console.log("research reporting tests passed");
