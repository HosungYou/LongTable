import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const mcpServer = join(repoRoot, "packages", "longtable-mcp", "dist", "server.js");
const projectSession = await import(join(repoRoot, "packages", "longtable", "dist", "project-session.js"));
const tmp = mkdtempSync(join(tmpdir(), "longtable-spec-audit-smoke-"));

function runCli(args, options = {}) {
  return execFileSync("node", [cli, ...args], {
    cwd: tmp,
    encoding: "utf8",
    ...options
  });
}

function completeSpecification(overrides = {}) {
  return {
    title: "Organizational AI Adoption Factors",
    status: "draft",
    researchDirection: {
      question: "Which organization-level factors predict AI adoption in higher education?",
      purpose: "Build a defensible organization-unit evidence map.",
      scopeBoundary: "Higher-education organization-unit studies only.",
      inclusionCriteria: ["organization-unit analysis", "higher education context"],
      exclusionCriteria: ["individual-only TAM/UTAUT survey studies"]
    },
    constructOntology: {
      coreConstructs: ["organizational readiness", "leadership support"],
      distinctions: ["direction of association is coded separately from factor family"],
      termsToAvoidCollapsing: ["individual intention", "organizational adoption"]
    },
    theoryAndFraming: {
      anchors: ["organizational adoption theory"],
      alternatives: ["TAM", "UTAUT"],
      overreachRisks: ["treating individual acceptance as organizational adoption"]
    },
    measurementCoding: {
      variablesOrConstructs: ["organizational factors", "adoption outcomes"],
      evidenceTypes: ["quantitative associations", "barrier/condition reports"],
      codingRules: ["code factor family separately from directionality"],
      openStandards: ["mark theory-informed distinctions"]
    },
    methodAnalysis: {
      design: "systematic review/meta-analysis planning",
      analysisOptions: ["factor-family synthesis", "directionality coding"],
      dataSufficiencyCriteria: ["organization-unit sample or analysis"],
      unsettledChoices: ["effect-size synthesis feasibility"]
    },
    evidenceAccess: {
      requiredSources: ["peer-reviewed empirical studies"],
      accessRequirements: ["institutional or open access recorded before full-text extraction"],
      evidenceStandards: ["source-backed coding decisions"]
    },
    epistemicAlignment: {
      researcherKnowledge: ["organization-level predictors are central"],
      projectStatePriority: ["Research Specification over First Research Shape"],
      aiInferenceLimits: ["do not infer individual-level constructs as organizational factors"],
      conflictResolutionRule: "Human research commitments override panel inference."
    },
    protectedDecisions: ["organization-unit only"],
    openQuestions: ["Which evidence threshold will separate barrier reporting from predictor evidence?"],
    nextActions: ["screen for organization-unit eligibility"],
    confidence: "high",
    ...overrides
  };
}

const setupPath = join(tmp, "setup.json");
const runtimePath = join(tmp, "runtime.toml");
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
]);

const projectPath = join(tmp, "project");
runCli([
  "start",
  "--setup", setupPath,
  "--name", "Spec Audit Smoke",
  "--path", projectPath,
  "--goal", "Plan an organizational AI adoption review",
  "--blocker", "Need source-mapped Research Specification updates",
  "--no-interview",
  "--json"
]);

const context = await projectSession.loadProjectContextFromDirectory(projectPath);
if (!context) {
  throw new Error("Expected LongTable workspace context.");
}

const interview = await projectSession.beginLongTableInterview({
  context,
  provider: "codex",
  openingQuestion: "What is the research object?",
  seedAnswer: "Organization-level AI adoption factors in higher education."
});
await projectSession.appendLongTableInterviewTurn({
  context,
  hookId: interview.hook.id,
  question: "What should stay protected?",
  answer: "The corpus should remain organization-unit studies, not individual-only adoption surveys.",
  quality: "rich",
  needsFollowUp: false
});
await projectSession.appendLongTableInterviewTurn({
  context,
  hookId: interview.hook.id,
  question: "What evidence boundary matters?",
  answer: "Include both quantitative associations and barrier or condition reports, but label the distinction.",
  quality: "rich",
  needsFollowUp: false,
  readyToSummarize: true,
  readinessRationale: ["scope, evidence boundary, and protected decision are explicit"]
});

await projectSession.summarizeLongTableResearchSpecification({
  context,
  hookId: interview.hook.id,
  specification: completeSpecification()
});

let state = await projectSession.loadWorkspaceState(context);
if ((state.interviewTurns ?? []).length !== 2) {
  throw new Error("Raw interview turns were not preserved at top-level state.");
}
if (!(state.evidenceRecords ?? []).some((record) => record.rawText?.includes("organization-unit studies"))) {
  throw new Error("Interview evidence raw text was not preserved.");
}
if ((state.specRevisions ?? []).length !== 1 || (state.specPatches ?? []).length !== 1) {
  throw new Error("Initial Research Specification summary did not create audit patch/revision records.");
}
const sourceEvidenceId = state.evidenceRecords?.[0]?.id;
if (!sourceEvidenceId) {
  throw new Error("Smoke test expected at least one source evidence record.");
}

const updatedSpec = completeSpecification({
  researchDirection: {
    ...completeSpecification().researchDirection,
    scopeBoundary: "Higher-education organization-unit empirical studies; exclude individual-only acceptance models."
  }
});
const applied = await projectSession.applyResearchSpecificationPatch({
  context,
  specification: updatedSpec,
  source: "manual",
  rationale: "Smoke-test automatic specification update.",
  sourceEvidenceIds: [sourceEvidenceId]
});
if (applied.revision.index !== 2) {
  throw new Error("Applying a Research Specification update should create revision v2.");
}
if (!applied.decision?.id) {
  throw new Error("Automatic Research Specification updates should create a linked DecisionRecord.");
}

state = await projectSession.loadWorkspaceState(context);
if ((state.specRevisions ?? []).length !== 2) {
  throw new Error("Research Specification revision history was not persisted.");
}
if (!state.researchSpecification?.sectionEvidence?.["researchDirection.scopeBoundary"]?.length) {
  throw new Error("Changed specification field is missing source evidence mapping.");
}

const proposedSpec = {
  ...applied.specification,
  methodAnalysis: {
    ...applied.specification.methodAnalysis,
    analysisOptions: [
      ...applied.specification.methodAnalysis.analysisOptions,
      "Sensitivity check for theory-family coding."
    ]
  }
};
const proposed = await projectSession.proposeResearchSpecificationPatch({
  context,
  specification: proposedSpec,
  source: "reviewer",
  rationale: "Smoke-test proposed patch identity preservation.",
  sourceEvidenceIds: [sourceEvidenceId]
});
state = await projectSession.loadWorkspaceState(context);
const patchCountBeforeStoredApply = state.specPatches?.length ?? 0;
const storedApplied = await projectSession.applyResearchSpecificationPatch({
  context,
  patchId: proposed.patch.id
});
state = await projectSession.loadWorkspaceState(context);
const matchingPatches = (state.specPatches ?? []).filter((patch) => patch.id === proposed.patch.id);
if (storedApplied.patch.id !== proposed.patch.id || matchingPatches.length !== 1) {
  throw new Error("Applying a stored Research Specification patch should preserve one canonical patch id.");
}
if ((state.specPatches?.length ?? 0) !== patchCountBeforeStoredApply) {
  throw new Error("Applying a stored Research Specification patch appended a duplicate patch record.");
}
if (matchingPatches[0]?.status !== "applied" || matchingPatches[0]?.appliedRevisionId !== storedApplied.revision.id) {
  throw new Error("Stored Research Specification patch was not marked applied with the new revision id.");
}
if (storedApplied.revision.index !== 3) {
  throw new Error("Applying a stored Research Specification patch should create revision v3.");
}

await projectSession.syncCurrentWorkspaceView(context);
const current = readFileSync(join(projectPath, "CURRENT.md"), "utf8");
if (!current.includes("Research Specification Audit")) {
  throw new Error("CURRENT.md should render the Research Specification audit view.");
}
if (!current.includes("Spec revisions: 3")) {
  throw new Error("CURRENT.md audit view should show revision count.");
}
if (current.includes("Question: What should stay protected?")) {
  throw new Error("CURRENT.md should not dump raw interview transcript.");
}

const history = JSON.parse(runCli(["spec", "history", "--cwd", projectPath, "--json"]));
if (history.revisions.length !== 3 || history.evidenceRecords.length < 2) {
  throw new Error("CLI spec history should expose revisions and evidence records.");
}

const selfTest = JSON.parse(execFileSync("node", [mcpServer, "--self-test"], {
  cwd: repoRoot,
  encoding: "utf8"
}));
for (const tool of [
  "propose_research_spec_patch",
  "apply_research_spec_patch",
  "diff_research_specification",
  "read_research_spec_history",
  "find_unincorporated_evidence"
]) {
  if (!selfTest.tools.includes(tool)) {
    throw new Error(`MCP self-test is missing ${tool}.`);
  }
}

console.log("research specification audit smoke passed");
