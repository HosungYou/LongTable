import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cliPath = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const mcpPath = join(repoRoot, "packages", "longtable-mcp", "dist", "server.js");
const research = await import(resolve(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));
const longtable = await import(resolve(repoRoot, "packages", "longtable", "dist", "index.js"));

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

function runCli(args, cwd = repoRoot) {
  return execFileSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
}

const canonicalDoctor = JSON.parse(runCli(["research", "doctor", "--json"]));
const compatibilityDoctor = JSON.parse(runCli(["scholar-research", "doctor", "--json"]));
assert.equal(canonicalDoctor.surface, "longtable-research");
assert.equal(canonicalDoctor.compatibilityAlias, undefined);
assert.equal(compatibilityDoctor.surface, "longtable-research");
assert.equal(compatibilityDoctor.compatibilityAlias, "scholar-research");
assert.equal(compatibilityDoctor.deprecated, true);
assert.deepEqual(compatibilityDoctor.connectors, canonicalDoctor.connectors);

const mcpSelfTest = JSON.parse(execFileSync("node", [mcpPath, "--self-test"], { cwd: repoRoot, encoding: "utf8" }));
assert(mcpSelfTest.tools.includes("elicit_question"));
assert.equal(mcpSelfTest.institutionalResearch.hardStopInputs, true);
assert.deepEqual(mcpSelfTest.institutionalResearch.fallbackSurfaces, ["mcp_elicitation", "numbered"]);

const workspaceRoot = mkdtempSync(join(tmpdir(), "longtable-institutional-checkpoint-"));
try {
  const initialized = JSON.parse(runCli(["research", "init", "--cwd", workspaceRoot, "--json"], workspaceRoot));
  assert.equal(initialized.surface, "longtable-research");
  assert.equal(initialized.layout.root, workspaceRoot);

  const setupPath = join(workspaceRoot, "setup.json");
  const runtimePath = join(workspaceRoot, "runtime.toml");
  runCli([
    "setup",
    "--provider", "codex",
    "--install-scope", "none",
    "--surfaces", "cli_only",
    "--intervention", "balanced",
    "--workspace", "later",
    "--setup-path", setupPath,
    "--runtime-path", runtimePath,
    "--json"
  ], workspaceRoot);
  runCli([
    "start",
    "--setup", setupPath,
    "--path", workspaceRoot,
    "--name", "Institutional Checkpoint Smoke",
    "--goal", "Verify checkpoint reuse",
    "--blocker", "Production requires a protocol decision",
    "--research-object", "study_design",
    "--gap-risk", "known_gap",
    "--protected-decision", "method",
    "--perspectives", "auto",
    "--disagreement", "show_on_conflict",
    "--no-interview",
    "--json"
  ], workspaceRoot);

  const context = await longtable.loadProjectContextFromDirectory(workspaceRoot);
  assert(context);
  const questionInput = {
    context,
    prompt: "Freeze the institutional search protocol before production.",
    title: "Pilot freeze",
    question: "Freeze this protocol?",
    type: "single_choice",
    checkpointKey: "institutional:run-1:protocol-1:PROTOCOL_CHECKPOINT:PILOT_FREEZE",
    questionOptions: [{ value: "freeze", label: "Freeze" }, { value: "revise", label: "Revise" }],
    required: true,
    hardStop: true,
    hardStopScope: "method",
    commitmentFamily: "method",
    epistemicBasis: "mixed"
  };
  const first = await longtable.createWorkspaceQuestion(questionInput);
  const fallbackRetry = await longtable.createWorkspaceQuestion(questionInput);
  assert.equal(fallbackRetry.question.id, first.question.id);
  const state = await longtable.loadWorkspaceState(context);
  assert.equal(state.questionLog.filter((entry) => entry.prompt.checkpointKey === questionInput.checkpointKey).length, 1);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

for (const [index, code] of research.INSTITUTIONAL_RESEARCH_HARD_STOPS.entries()) {
  const question = research.buildOperationalHardStopCheckpoint({
    runId: `run-hard-stop-${index}`,
    protocolRevisionId: "protocol-hard-stop-1",
    stage: "SETUP",
    code,
    issue: `Synthetic audit issue for ${code}.`,
    safeCursor: `cursor:${index}`,
    createdAt: `2026-08-06T11:${String(index).padStart(2, "0")}:00.000Z`
  });
  assert.deepEqual(question.prompt.preferredSurfaces, ["mcp_elicitation", "numbered"]);
  const fallback = research.deliverCheckpointWithFallback(question, {
    status: "unsupported",
    message: "Synthetic MCP transport unavailable.",
    attemptedAt: `2026-08-06T11:${String(index).padStart(2, "0")}:01.000Z`,
    fallbackAt: `2026-08-06T11:${String(index).padStart(2, "0")}:02.000Z`
  });
  assert.equal(fallback.delivery.attempts.at(-1).status, "fallback_rendered");
  const run = research.createResearchRun({
    id: `run-hard-stop-${index}`,
    createdAt: `2026-08-06T11:${String(index).padStart(2, "0")}:00.000Z`,
    protocolRevisionId: "protocol-hard-stop-1"
  });
  const blocked = research.blockResearchRunForQuestion(run, code, fallback.question, `cursor:${index}`);
  assert.throws(() => research.resumeResearchRun(blocked, []), /DecisionRecord/i);
  const resumed = research.resumeResearchRun(blocked, [{
    id: `decision-hard-stop-${index}`,
    checkpointKey: fallback.question.prompt.checkpointKey,
    questionRecordId: fallback.question.id
  }], `2026-08-06T11:${String(index).padStart(2, "0")}:03.000Z`);
  assert.equal(resumed.status, "running");
  assert.equal(resumed.resumedByDecisionRecordId, `decision-hard-stop-${index}`);
}

console.log("institutional checkpoint contracts smoke passed");
