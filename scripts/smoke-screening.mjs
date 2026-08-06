import { strict as assert } from "node:assert";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(resolve(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));

assert.equal(research.classifyTitleAbstractAvailability({}), "full_text_needed_for_screening");
assert.equal(research.classifyTitleAbstractAvailability({ abstract: "Short abstract." }), "full_text_needed_for_screening");
assert.equal(research.classifyTitleAbstractAvailability({ abstract: "This abstract contains enough detail to identify the population, intervention, context, and workplace competency outcome for an initial screening decision." }), "screenable");

const base = {
  stage: "title_abstract",
  ruleVersion: "eligibility-v1",
  codebookVersion: "codebook-v1",
  actor: "human",
  actorId: "reviewer-hy",
  evidenceArtifactIds: ["export-record-1"]
};

const decisions = [
  research.createScreeningDecision({
    ...base,
    paperId: "paper-1",
    decision: "include",
    rationale: "Hackathon protocol and workplace competency outcome are explicit.",
    decidedAt: "2026-08-06T05:00:00.000Z"
  }),
  research.createScreeningDecision({
    ...base,
    paperId: "paper-2",
    decision: "exclude",
    reasonCode: "wrong_context",
    rationale: "The event is a marketing competition without a learning or work context.",
    decidedAt: "2026-08-06T05:01:00.000Z"
  }),
  research.createScreeningDecision({
    ...base,
    paperId: "paper-3",
    decision: "pending",
    rationale: "Population is unclear.",
    decidedAt: "2026-08-06T05:02:00.000Z"
  }),
  research.createScreeningDecision({
    ...base,
    paperId: "paper-4",
    decision: "full_text_needed_for_screening",
    rationale: "No abstract is available.",
    decidedAt: "2026-08-06T05:03:00.000Z"
  })
];

assert(decisions.every((decision) => decision.id.startsWith("screening_")));
assert(decisions.every((decision) => decision.ruleVersion === "eligibility-v1"));
assert(decisions.every((decision) => decision.evidenceArtifactIds.length === 1));
assert.throws(() => research.createScreeningDecision({
  ...base,
  paperId: "paper-x",
  decision: "exclude",
  rationale: "Excluded without a standardized reason.",
  decidedAt: "2026-08-06T05:04:00.000Z"
}), /reason code/i);

let ledger = [];
for (const decision of decisions) ledger = research.appendScreeningDecision(ledger, decision);
assert.equal(ledger.length, 4);
ledger = research.appendScreeningDecision(ledger, decisions[0]);
assert.equal(ledger.length, 4);
assert.throws(() => research.appendScreeningDecision(ledger, { ...decisions[0], rationale: "Mutated in place" }), /append-only/i);

const laterPaperThree = research.createScreeningDecision({
  ...base,
  paperId: "paper-3",
  decision: "include",
  rationale: "A later verified metadata source clarified the population.",
  evidenceArtifactIds: ["export-record-1", "crossref-record-3"],
  decidedAt: "2026-08-06T05:10:00.000Z"
});
ledger = research.appendScreeningDecision(ledger, laterPaperThree);
const latest = research.reduceLatestScreeningDecisions(ledger, "title_abstract");
assert.equal(latest.get("paper-3").decision, "include");

assert.deepEqual(research.selectFulltextCandidateIds(["paper-1", "paper-2", "paper-3", "paper-4"], ledger), ["paper-1", "paper-3", "paper-4"]);
assert.deepEqual(research.calculateTitleAbstractScreeningCounts(["paper-1", "paper-2", "paper-3", "paper-4", "paper-5"], ledger), {
  screened: 5,
  fulltextCandidates: 3,
  excluded: 1,
  pending: 1
});

const aiDecision = research.createScreeningDecision({
  ...base,
  paperId: "paper-6",
  actor: "ai",
  actorId: "screening-model",
  modelVersion: "model-2026-08",
  promptVersion: "screening-prompt-v1",
  decision: "pending",
  rationale: "The construct mapping is ambiguous.",
  decidedAt: "2026-08-06T05:11:00.000Z"
});
assert(aiDecision.modelVersion);
assert.throws(() => research.createScreeningDecision({
  ...base,
  paperId: "paper-7",
  actor: "ai",
  actorId: "screening-model",
  decision: "pending",
  rationale: "Missing model provenance.",
  decidedAt: "2026-08-06T05:12:00.000Z"
}), /model and prompt version/i);

const cacheInput = {
  recordOrPdfHash: "a".repeat(64),
  ruleVersion: "eligibility-v1",
  codebookVersion: "codebook-v1",
  promptVersion: "screening-prompt-v1",
  modelVersion: "model-2026-08"
};
const cacheKey = research.buildScreeningCacheKey(cacheInput);
assert.equal(cacheKey.length, 64);
assert.equal(research.buildScreeningCacheKey(cacheInput), cacheKey);
assert.notEqual(research.buildScreeningCacheKey({ ...cacheInput, ruleVersion: "eligibility-v2" }), cacheKey);

console.log("screening ledger tests passed");
