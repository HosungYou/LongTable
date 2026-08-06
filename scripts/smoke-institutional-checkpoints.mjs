import { strict as assert } from "node:assert";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(resolve(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));

function assertRequiredMcpCheckpoint(record, expected) {
  assert.equal(record.status, "pending");
  assert.equal(record.hardStop, true);
  assert.equal(record.hardStopScope, expected.scope);
  assert.equal(record.commitmentFamily, expected.family);
  assert.equal(record.prompt.required, true);
  assert.deepEqual(record.prompt.preferredSurfaces, ["mcp_elicitation", "numbered"]);
  assert.equal(record.transportStatus.surface, "mcp_elicitation");
  assert.equal(record.transportStatus.status, "not_attempted");
}

const strategyInput = {
  runId: "run-1",
  protocolReference: "draft-7",
  reviewType: "systematic_review",
  objective: "Map how hackathon protocols develop workplace competencies.",
  databaseGroups: {
    core: ["Web of Science", "Scopus"],
    domain: ["ERIC", "PsycINFO"],
    complementary: ["KCI", "RISS"],
    normalization: ["Crossref", "OpenAlex"],
    fulltextResolution: ["PSU Libraries", "Unpaywall"]
  },
  filters: {
    years: [2015, 2026],
    languages: ["English", "Korean"],
    publicationTypes: ["journal article", "conference paper"]
  },
  recallPrecisionPosture: "recall_first",
  accessLimitations: ["Researcher login and MFA remain manual."],
  createdAt: "2026-08-06T03:00:00.000Z"
};

const strategy = research.buildSearchStrategyCheckpoint(strategyInput);
assertRequiredMcpCheckpoint(strategy, { scope: "method", family: "method" });
assert.equal(strategy.prompt.type, "single_choice");
assert.equal(strategy.prompt.checkpointKey, "institutional:run-1:draft-7:SETUP:SEARCH_STRATEGY");
assert.deepEqual(strategy.prompt.options.map((option) => option.value), [
  "pilot",
  "modify_databases",
  "modify_scope",
  "open_detailed_wizard",
  "cancel"
]);
assert.equal(strategy.prompt.options.filter((option) => option.recommended).length, 1);
assert.match(strategy.prompt.question, /Web of Science/);
assert.match(strategy.prompt.question, /2015–2026/);
assert.equal(research.buildSearchStrategyCheckpoint(strategyInput).id, strategy.id);

const databaseSelection = research.buildDatabaseSelectionCheckpoint({
  runId: "run-1",
  protocolReference: "draft-7",
  availableDatabases: [
    { id: "wos", label: "Web of Science", group: "core", available: true },
    { id: "scopus", label: "Scopus", group: "core", available: true },
    { id: "psycinfo", label: "PsycINFO", group: "domain", available: false, limitation: "Not in current institution profile." }
  ],
  selectedDatabaseIds: ["wos", "scopus"],
  createdAt: "2026-08-06T03:01:00.000Z"
});
assertRequiredMcpCheckpoint(databaseSelection, { scope: "method", family: "method" });
assert.equal(databaseSelection.prompt.type, "multi_choice");
assert.deepEqual(databaseSelection.prompt.options.map((option) => option.value), ["wos", "scopus"]);
assert.match(databaseSelection.prompt.rationale.join(" "), /progressive disclosure/i);

const pilotFreeze = research.buildPilotFreezeCheckpoint({
  runId: "run-1",
  protocolRevisionId: "protocol-1",
  databaseYields: { wos: 120, scopus: 98 },
  estimatedOverlap: 0.31,
  missingAbstractRate: 0.08,
  relevanceSample: { relevant: 16, reviewed: 20 },
  resultCaps: [],
  queryProblems: ["Korean synonym coverage needs confirmation."],
  recommendedAmendments: ["Add 직무역량 as a Korean synonym."],
  createdAt: "2026-08-06T03:02:00.000Z"
});
assertRequiredMcpCheckpoint(pilotFreeze, { scope: "method", family: "method" });
assert.equal(pilotFreeze.prompt.checkpointKey, "institutional:run-1:protocol-1:PROTOCOL_CHECKPOINT:PILOT_FREEZE");
assert.deepEqual(pilotFreeze.prompt.options.map((option) => option.value), ["freeze_production_protocol", "revise_protocol", "cancel"]);
assert.match(pilotFreeze.prompt.question, /120/);
assert.match(pilotFreeze.prompt.question, /8\.0%/);

const specialized = [
  [research.buildAccessAmbiguityCheckpoint({ runId: "run-1", protocolRevisionId: "protocol-1", databaseId: "wos", issue: "Terms changed", createdAt: "2026-08-06T03:03:00.000Z" }), "evidence", "evidence"],
  [research.buildFulltextPlanCheckpoint({ runId: "run-1", protocolRevisionId: "protocol-1", candidateCount: 42, lawfulRoutes: ["PSU Libraries"], unresolvedCount: 3, createdAt: "2026-08-06T03:04:00.000Z" }), "evidence", "evidence"],
  [research.buildCorpusFreezeCheckpoint({ runId: "run-1", protocolRevisionId: "protocol-1", includedCount: 27, unresolvedCount: 1, createdAt: "2026-08-06T03:05:00.000Z" }), "evidence", "evidence"],
  [research.buildScreeningConflictCheckpoint({ runId: "run-1", protocolRevisionId: "protocol-1", paperIds: ["paper-1", "paper-2"], conflict: "Human include versus AI exclude", createdAt: "2026-08-06T03:06:00.000Z" }), "construct", "coding"],
  [research.buildAnalysisMethodCheckpoint({ runId: "run-1", protocolRevisionId: "protocol-1", proposedMethod: "validated semantic matching", rationale: "Bridge Korean and English constructs", createdAt: "2026-08-06T03:07:00.000Z" }), "method", "method"]
];

for (const [record, scope, family] of specialized) {
  assertRequiredMcpCheckpoint(record, { scope, family });
  assert(record.prompt.options.length >= 2);
}

console.log("institutional checkpoint contracts smoke passed");
