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

const conflictDecisions = [
  research.createScreeningDecision({
    ...base,
    paperId: "paper-8",
    actor: "human",
    actorId: "reviewer-hy",
    decision: "include",
    rationale: "The paper meets the protocol criteria.",
    decidedAt: "2026-08-06T05:20:00.000Z"
  }),
  research.createScreeningDecision({
    ...base,
    paperId: "paper-8",
    actor: "ai",
    actorId: "screening-model",
    modelVersion: "model-2026-08",
    promptVersion: "screening-prompt-v1",
    decision: "exclude",
    reasonCode: "wrong_intervention",
    rationale: "The model interpreted the intervention as an ordinary course.",
    decidedAt: "2026-08-06T05:21:00.000Z"
  }),
  research.createScreeningDecision({
    ...base,
    paperId: "paper-9",
    actor: "human",
    actorId: "reviewer-hy",
    decision: "exclude",
    reasonCode: "wrong_outcome",
    rationale: "No workplace competency outcome is measured.",
    decidedAt: "2026-08-06T05:22:00.000Z"
  }),
  research.createScreeningDecision({
    ...base,
    paperId: "paper-9",
    actor: "ai",
    actorId: "screening-model",
    modelVersion: "model-2026-08",
    promptVersion: "screening-prompt-v1",
    decision: "include",
    rationale: "The model inferred a competency outcome from broad learning language.",
    decidedAt: "2026-08-06T05:23:00.000Z"
  })
];
const conflicts = research.detectHumanAiScreeningConflicts(conflictDecisions);
assert.deepEqual(conflicts.map((conflict) => conflict.paperId), ["paper-8", "paper-9"]);
assert(conflicts.every((conflict) => conflict.humanDecisionId && conflict.aiDecisionId));

const conflictBundle = research.bundleScreeningConflicts({
  runId: "run-screening",
  protocolRevisionId: "protocol-1",
  conflicts,
  createdAt: "2026-08-06T05:24:00.000Z"
});
assert.deepEqual(conflictBundle.auditRecord.paperIds, ["paper-8", "paper-9"]);
assert.equal(conflictBundle.question.prompt.checkpointKey, "institutional:run-screening:protocol-1:FULLTEXT_SCREENING:HUMAN_AI_SCREENING_CONFLICT");
assert.equal(conflictBundle.question.hardStop, true);

const screeningRun = research.createResearchRun({
  id: "run-screening",
  createdAt: "2026-08-06T05:19:00.000Z",
  stage: "FULLTEXT_SCREENING",
  protocolRevisionId: "protocol-1",
  institutionProfileId: "psu-sanitized"
});
const blockedRun = research.blockResearchRunForQuestion(
  screeningRun,
  "HUMAN_AI_SCREENING_CONFLICT",
  conflictBundle.question,
  "screening:paper-7"
);
assert.equal(blockedRun.status, "blocked");
assert.throws(() => research.resumeResearchRun(blockedRun, []), /DecisionRecord/i);
const resumedRun = research.resumeResearchRun(blockedRun, [{
  id: "decision-screening-conflict",
  checkpointKey: conflictBundle.question.prompt.checkpointKey,
  questionRecordId: conflictBundle.question.id
}]);
assert.equal(resumedRun.status, "running");

const adjudicatedLedger = research.applyScreeningAdjudication(conflictDecisions, {
  ...base,
  paperId: "paper-8",
  actor: "human",
  actorId: "adjudicator-hy",
  decision: "include",
  rationale: "Full-text review confirms the intervention is an intensive challenge protocol.",
  evidenceArtifactIds: ["pdf-paper-8"],
  decidedAt: "2026-08-06T05:25:00.000Z",
  adjudicatesDecisionIds: conflicts[0].decisionIds
});
assert.equal(adjudicatedLedger.length, conflictDecisions.length + 1);
assert.equal(conflictDecisions.length, 4);
assert.equal(research.reduceLatestScreeningDecisions(adjudicatedLedger, "title_abstract").get("paper-8").actorId, "adjudicator-hy");

assert.equal(research.evaluateFulltextMissingThreshold({ sought: 10, retrieved: 9, maximumMissingRate: 0.1 }).status, "supported");
const missingThreshold = research.evaluateFulltextMissingThreshold({ sought: 10, retrieved: 8, maximumMissingRate: 0.1 });
assert.equal(missingThreshold.status, "hard_stop");
assert.equal(missingThreshold.code, "FULLTEXT_MISSING_THRESHOLD_EXCEEDED");

const ambiguity = research.buildScreeningRuleAmbiguityCheckpoint({
  runId: "run-screening",
  protocolRevisionId: "protocol-1",
  ruleVersion: "eligibility-v1",
  ambiguity: "Hackathon-like challenge weeks are not explicitly covered.",
  affectedPaperIds: ["paper-10", "paper-11"],
  createdAt: "2026-08-06T05:26:00.000Z"
});
assert.equal(ambiguity.prompt.checkpointKey, "institutional:run-screening:protocol-1:TITLE_ABSTRACT_SCREENING:SCREENING_RULE_AMBIGUOUS");
assert.equal(ambiguity.hardStopScope, "construct");

console.log("screening ledger tests passed");
