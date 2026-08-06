import { strict as assert } from "node:assert";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(resolve(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));

function record(overrides) {
  return {
    title: "Default title",
    authors: ["Kim, Mina"],
    year: 2024,
    abstract: "A sufficiently informative abstract.",
    keywords: [],
    sourceDatabase: "web_of_science",
    sourceRecordId: "WOS:default",
    sourceRow: 2,
    exportArtifactSha256: "a".repeat(64),
    ...overrides
  };
}

const records = [
  record({ title: "Hackathons & Workplace Capability", doi: "https://doi.org/10.1000/HACK.1", sourceRecordId: "WOS:1" }),
  record({ title: "Hackathons and workplace capability", doi: "10.1000/hack.1", sourceDatabase: "scopus", sourceRecordId: "SCOPUS:1", exportArtifactSha256: "b".repeat(64) }),
  record({ title: "직무역량 해커톤 연구", year: 2025, doi: undefined, sourceRecordId: "WOS:2" }),
  record({ title: "직무역량  해커톤 연구!", year: 2025, doi: undefined, sourceDatabase: "kci", sourceRecordId: "KCI:2", exportArtifactSha256: "c".repeat(64) }),
  record({ title: "Design challenge learning", year: 2023, doi: "10.1000/version.a", sourceRecordId: "WOS:3" }),
  record({ title: "Design challenge learning", year: 2023, doi: "10.1000/version.b", sourceDatabase: "crossref", sourceRecordId: "10.1000/version.b", exportArtifactSha256: "d".repeat(64) })
];

const normalized = research.normalizeBibliographicRecords(records);
assert.equal(normalized[0].doi, "10.1000/hack.1");
assert.equal(normalized[0].normalizedTitle, "hackathons workplace capability");
assert.equal(normalized[2].normalizedTitle, "직무역량 해커톤 연구");

const forward = research.deduplicateBibliographicRecords(normalized);
const reverse = research.deduplicateBibliographicRecords(research.normalizeBibliographicRecords([...records].reverse()));
assert.deepEqual(reverse, forward);
assert.equal(forward.papers.length, 4);
assert.equal(forward.duplicateLinks.length, 2);
assert.equal(forward.versionLinks.length, 1);
assert.equal(forward.versionLinks[0].reason, "same_title_year_different_identifier");

const doiPaper = forward.papers.find((paper) => paper.doi === "10.1000/hack.1");
assert(doiPaper);
assert.equal(doiPaper.sourceLinks.length, 2);
assert.equal(doiPaper.paperId.length, 30);
assert.deepEqual(doiPaper.sourceLinks.map((link) => link.sourceDatabase), ["scopus", "web_of_science"]);
assert(forward.duplicateLinks.every((link) => link.basis.length > 0));
assert(forward.papers.every((paper) => paper.provenanceBasis.length > 0));

const validCounts = {
  identified: 8,
  normalized: 7,
  parseRejected: 1,
  unique: 4,
  duplicateLinks: 3,
  titleAbstractScreened: 4,
  fulltextCandidates: 2,
  titleAbstractExcluded: 1,
  titleAbstractPending: 1,
  fulltextSought: 2,
  fulltextRetrieved: 1,
  fulltextNotRetrieved: 1,
  fulltextAssessed: 1,
  finalIncluded: 1,
  fulltextExcluded: 0,
  unresolved: 0
};

const validAudit = research.verifyCorpusInvariants(validCounts);
assert.equal(validAudit.passed, true);
assert.equal(validAudit.prismaEligible, true);
assert.equal(validAudit.equations.length, 5);
assert(validAudit.equations.every((equation) => equation.passed));

for (const field of ["identified", "normalized", "titleAbstractScreened", "fulltextSought", "fulltextAssessed"]) {
  const invalid = research.verifyCorpusInvariants({ ...validCounts, [field]: validCounts[field] + 1 });
  assert.equal(invalid.passed, false, `${field} mutation should fail an invariant`);
  assert.equal(invalid.prismaEligible, false);
  assert(invalid.equations.some((equation) => !equation.passed));
}

assert.throws(
  () => research.verifyCorpusInvariants({ ...validCounts, finalIncluded: -1 }),
  /non-negative integer/i
);

console.log("corpus normalization and invariant tests passed");
