import { strict as assert } from "node:assert";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(resolve(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));

const profileInput = {
  id: "procurement-extraction-v1",
  version: 1,
  corpusType: "document_corpus",
  unitOfAnalysis: "unique procurement project",
  approvedDecisionRecordId: "decision-extraction-profile",
  frozenAt: "2026-08-07T00:00:00.000Z",
  doubleExtractionRequired: true,
  reliability: { statistic: "cohens_kappa", threshold: 0.8, observed: 0.9 },
  fields: [
    { id: "hackathon_protocol", label: "Hackathon protocol", valueType: "boolean", required: true, evidenceRequired: true },
    { id: "competency", label: "Target competency", valueType: "categorical", required: true, evidenceRequired: true, allowedValues: ["digital", "collaboration", "problem_solving"] },
    { id: "participants", label: "Participants", valueType: "number", required: false, evidenceRequired: false }
  ]
};

const profile = research.createExtractionProfile(profileInput);
const sameProfile = research.createExtractionProfile({ ...profileInput, id: "copy", frozenAt: "2026-08-08T00:00:00.000Z" });
assert.equal(profile.profileHash.length, 64);
assert.equal(profile.profileHash, sameProfile.profileHash);
assert(Object.isFrozen(profile));

function record(id, extractorId, competency) {
  return {
    id,
    unitId: "bid-001",
    profileId: profile.id,
    profileHash: profile.profileHash,
    extractor: { id: extractorId, type: extractorId === "human-1" ? "human" : "ai" },
    extractedAt: "2026-08-07T01:00:00.000Z",
    status: "submitted",
    values: [
      { fieldId: "hackathon_protocol", value: true, evidence: [{ sourceArtifactId: "artifact-bid-001", locator: "p. 4", quote: "해커톤 방식의 집중형 문제해결" }] },
      { fieldId: "competency", value: competency, evidence: [{ sourceArtifactId: "artifact-bid-001", locator: "p. 5", quote: "디지털 문제해결 역량" }] }
    ]
  };
}

const first = research.validateExtractionRecord(profile, record("extraction-1", "human-1", "digital"));
const second = research.validateExtractionRecord(profile, record("extraction-2", "ai-1", "problem_solving"));
assert.throws(() => research.validateExtractionRecord(profile, {
  ...record("bad", "ai-2", "digital"),
  values: [{ fieldId: "hackathon_protocol", value: true, evidence: [] }]
}), /required field|evidence/i);

const conflicts = research.detectExtractionConflicts(profile, [first, second]);
assert.equal(conflicts.length, 1);
assert.equal(conflicts[0].fieldId, "competency");
assert.equal(research.assessExtractionReadiness(profile, [first, second], [], []).code, "DOUBLE_EXTRACTION_CONFLICT");
assert.equal(research.assessExtractionReadiness(profile, [], [], []).code, "EXTRACTED_DATA_FREEZE_REQUIRED");
assert.throws(() => research.freezeExtractedDataset({
  id: "freeze-1",
  profile,
  records: [first, second],
  conflicts,
  adjudications: [],
  decisionRecordId: "decision-freeze",
  frozenAt: "2026-08-07T02:00:00.000Z"
}), /unresolved conflict/i);

const adjudication = research.adjudicateExtractionConflict(profile, conflicts[0], {
  id: "adjudication-1",
  finalValue: "digital",
  rationale: "The explicit competency label governs.",
  adjudicatorId: "human-2",
  adjudicatedAt: "2026-08-07T01:30:00.000Z",
  evidence: [{ sourceArtifactId: "artifact-bid-001", locator: "p. 5" }]
});
const frozen = research.freezeExtractedDataset({
  id: "freeze-1",
  profile,
  records: [first, second],
  conflicts,
  adjudications: [adjudication],
  decisionRecordId: "decision-freeze",
  frozenAt: "2026-08-07T02:00:00.000Z"
});
const replay = research.freezeExtractedDataset({
  id: "freeze-copy",
  profile,
  records: [second, first],
  conflicts,
  adjudications: [adjudication],
  decisionRecordId: "decision-other",
  frozenAt: "2026-08-08T02:00:00.000Z"
});
assert.equal(frozen.datasetHash.length, 64);
assert.equal(frozen.datasetHash, replay.datasetHash);
assert.equal(frozen.unresolvedConflictCount, 0);
assert.equal(research.assessExtractionReadiness(profile, [first, second], conflicts, [adjudication]).status, "ready");

const lowReliability = research.createExtractionProfile({
  ...profileInput,
  id: "low-reliability",
  reliability: { statistic: "cohens_kappa", threshold: 0.8, observed: 0.6 }
});
assert.equal(research.assessExtractionReadiness(lowReliability, [first, second], [], []).code, "EXTRACTION_RELIABILITY_BELOW_THRESHOLD");

console.log("research data extraction tests passed");
