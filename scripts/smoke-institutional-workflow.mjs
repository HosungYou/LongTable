import { strict as assert } from "node:assert";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(resolve(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));

const expectedStages = [
  "SETUP",
  "PILOT",
  "PROTOCOL_CHECKPOINT",
  "PRODUCTION_SEARCH",
  "EXPORT_AUDIT",
  "TITLE_ABSTRACT_SCREENING",
  "FULLTEXT_PLAN_CHECKPOINT",
  "FULLTEXT_ACQUISITION",
  "FULLTEXT_SCREENING",
  "CORPUS_FREEZE_CHECKPOINT",
  "DATA_EXTRACTION_PLAN_CHECKPOINT",
  "DATA_EXTRACTION_PILOT",
  "DATA_EXTRACTION",
  "DATA_EXTRACTION_ADJUDICATION",
  "EXTRACTED_DATA_FREEZE_CHECKPOINT",
  "ANALYSIS",
  "SYNTHESIS",
  "RESEARCHER_REPORT",
  "MANUSCRIPT_PACKAGE"
];

const expectedHardStops = [
  "LOGIN_REQUIRED",
  "MFA_OR_CAPTCHA_REQUIRED",
  "SESSION_EXPIRED",
  "TERMS_OR_ACCESS_UNCLEAR",
  "QUERY_DRIFT_DETECTED",
  "DATABASE_RESULT_CAP_REACHED",
  "EXPORT_COUNT_MISMATCH",
  "DOWNLOAD_PATTERN_CHANGED",
  "UI_SIGNATURE_CHANGED",
  "SCREENING_RULE_AMBIGUOUS",
  "HUMAN_AI_SCREENING_CONFLICT",
  "FULLTEXT_MISSING_THRESHOLD_EXCEEDED",
  "ANALYSIS_METHOD_CHANGE",
  "CORPUS_FREEZE_REQUIRED",
  "EXTRACTION_SCHEMA_UNFROZEN",
  "EXTRACTION_RULE_AMBIGUOUS",
  "EXTRACTION_RELIABILITY_BELOW_THRESHOLD",
  "DOUBLE_EXTRACTION_CONFLICT",
  "EXTRACTED_DATA_FREEZE_REQUIRED"
];

const expectedRetryableEvents = [
  "TRANSIENT_NETWORK_TIMEOUT",
  "DELAYED_EXPORT_GENERATION",
  "INCOMPLETE_DOWNLOAD",
  "TEMPORARY_PAGE_RENDER_FAILURE",
  "FILE_PROVIDER_HYDRATION_DELAY"
];

assert.deepEqual(research.INSTITUTIONAL_RESEARCH_STAGES, expectedStages);
assert.deepEqual(research.INSTITUTIONAL_RESEARCH_HARD_STOPS, expectedHardStops);
assert.deepEqual(research.INSTITUTIONAL_RESEARCH_RETRYABLE_EVENTS, expectedRetryableEvents);
assert.equal(research.nextInstitutionalResearchStage("PILOT"), "PROTOCOL_CHECKPOINT");
assert.equal(research.nextInstitutionalResearchStage("MANUSCRIPT_PACKAGE"), undefined);

const revision = research.createProtocolRevision({
  id: "protocol-1",
  revision: 1,
  frozenAt: "2026-08-06T00:00:00.000Z",
  decisionRecordId: "decision-1",
  databases: ["wos"],
  queries: { wos: "TS=(hackathon AND competency)" },
  filters: {
    years: [2015, 2026],
    languages: ["en", "ko"],
    publicationTypes: ["article"]
  }
});

assert.equal(revision.id, "protocol-1");
assert.equal(revision.protocolHash.length, 64);
assert(Object.isFrozen(revision));
assert(Object.isFrozen(revision.databases));
assert(Object.isFrozen(revision.queries));
assert(Object.isFrozen(revision.filters));
assert.throws(() => revision.databases.push("scopus"), TypeError);

const sameRevision = research.createProtocolRevision({
  id: "protocol-1-copy",
  revision: 1,
  frozenAt: "2026-08-07T00:00:00.000Z",
  decisionRecordId: "decision-2",
  databases: ["wos"],
  queries: { wos: "TS=(hackathon AND competency)" },
  filters: {
    years: [2015, 2026],
    languages: ["en", "ko"],
    publicationTypes: ["article"]
  }
});
assert.equal(revision.protocolHash, sameRevision.protocolHash);

const profile = research.createInstitutionProfile({
  id: "psu",
  institutionName: "Pennsylvania State University",
  approvedDecisionRecordId: "decision-profile",
  databases: [{ databaseId: "wos", accessMode: "browser_sso" }],
  storage: { pdfVaultRoot: "/research-pdf-vault" },
  checkpointPolicy: "mcp_first",
  calibratedAt: "2026-08-06T00:00:00.000Z",
  lastVerifiedAt: "2026-08-06T00:00:00.000Z"
});
assert.equal(profile.id, "psu");
assert(Object.isFrozen(profile));

assert.throws(() => research.createInstitutionProfile({
  id: "unsafe",
  institutionName: "Unsafe University",
  approvedDecisionRecordId: "decision-unsafe",
  databases: [],
  storage: { pdfVaultRoot: "/research-pdf-vault" },
  checkpointPolicy: "mcp_first",
  calibratedAt: "2026-08-06T00:00:00.000Z",
  lastVerifiedAt: "2026-08-06T00:00:00.000Z",
  sessionToken: "must-not-persist"
}), /forbidden authentication material/i);

assert.deepEqual(research.INSTITUTIONAL_RESEARCH_CAPABILITIES, [
  "open",
  "verifyAuthenticated",
  "submitQuery",
  "applyFilters",
  "readResultCount",
  "exportMetadata",
  "verifyExport",
  "resolveFulltext",
  "downloadPermittedPdf",
  "suspend",
  "resume"
]);

const run = research.createResearchRun({
  id: "run-1",
  createdAt: "2026-08-06T01:00:00.000Z",
  stage: "PILOT",
  protocolRevisionId: revision.id,
  institutionProfileId: profile.id
});
assert.equal(run.status, "planned");
assert(Object.isFrozen(run));

const pilotReceipt = research.createStageReceipt({
  id: "receipt-pilot",
  runId: run.id,
  stage: "PILOT",
  protocolRevisionId: revision.id,
  inputArtifactIds: ["pilot-input"],
  outputArtifactIds: ["pilot-output"],
  cursor: "wos:pilot:complete",
  createdAt: "2026-08-06T01:05:00.000Z"
});
const checkpointRun = research.advanceResearchRun(run, pilotReceipt, "2026-08-06T01:05:00.000Z");
assert.equal(checkpointRun.stage, "PROTOCOL_CHECKPOINT");
assert.equal(checkpointRun.status, "running");
assert.equal(checkpointRun.latestSafeCursor, "wos:pilot:complete");
assert(Object.isFrozen(checkpointRun));

assert.throws(() => research.advanceResearchRun(checkpointRun, pilotReceipt), /current stage/i);

const blocked = research.blockResearchRun(checkpointRun, {
  code: "QUERY_DRIFT_DETECTED",
  questionRecordId: "question-1",
  checkpointKey: "run-1:protocol-1:PROTOCOL_CHECKPOINT:QUERY_DRIFT_DETECTED",
  safeCursor: "wos:pilot:complete",
  blockedAt: "2026-08-06T01:06:00.000Z"
});
assert.equal(blocked.status, "blocked");
assert.equal(blocked.blockingQuestionRecordId, "question-1");
assert.equal(blocked.blockingCode, "QUERY_DRIFT_DETECTED");
assert.equal(blocked.latestSafeCursor, "wos:pilot:complete");

const repeatedBlock = research.blockResearchRun(blocked, {
  code: "QUERY_DRIFT_DETECTED",
  questionRecordId: "question-1",
  checkpointKey: "run-1:protocol-1:PROTOCOL_CHECKPOINT:QUERY_DRIFT_DETECTED",
  safeCursor: "wos:pilot:unexpected-later-cursor",
  blockedAt: "2026-08-06T01:07:00.000Z"
});
assert.equal(repeatedBlock.latestSafeCursor, "wos:pilot:complete");

assert.throws(() => research.resumeResearchRun(blocked, []), /DecisionRecord/i);
assert.throws(() => research.resumeResearchRun(blocked, [{
  id: "decision-unrelated",
  checkpointKey: "another-checkpoint",
  questionRecordId: "question-1"
}]), /DecisionRecord/i);

const resumed = research.resumeResearchRun(blocked, [{
  id: "decision-resume",
  checkpointKey: "run-1:protocol-1:PROTOCOL_CHECKPOINT:QUERY_DRIFT_DETECTED",
  questionRecordId: "question-1"
}], "2026-08-06T01:08:00.000Z");
assert.equal(resumed.status, "running");
assert.equal(resumed.stage, "PROTOCOL_CHECKPOINT");
assert.equal(resumed.blockingQuestionRecordId, undefined);
assert.equal(resumed.blockingCode, undefined);
assert.equal(resumed.latestSafeCursor, "wos:pilot:complete");

const terminalRun = research.createResearchRun({
  id: "run-terminal",
  createdAt: "2026-08-06T02:00:00.000Z",
  stage: "MANUSCRIPT_PACKAGE",
  protocolRevisionId: revision.id,
  institutionProfileId: profile.id
});
const terminalReceipt = research.createStageReceipt({
  id: "receipt-terminal",
  runId: terminalRun.id,
  stage: "MANUSCRIPT_PACKAGE",
  protocolRevisionId: revision.id,
  inputArtifactIds: ["manuscript-source"],
  outputArtifactIds: ["manuscript-docx"],
  cursor: "package:complete",
  createdAt: "2026-08-06T02:05:00.000Z"
});
const completed = research.advanceResearchRun(terminalRun, terminalReceipt);
assert.equal(completed.status, "completed");
assert.equal(completed.stage, "MANUSCRIPT_PACKAGE");

const projectRoot = await mkdtemp(resolve(tmpdir(), "longtable-institutional-project-"));
try {
  const layout = research.buildResearchProjectLayout(projectRoot);
  await research.writeResearchProjectScaffold(projectRoot);

  const expectedDirectories = [
    layout.protocol.root,
    layout.protocol.databaseProfiles,
    layout.protocol.extractionProfiles,
    layout.protocol.amendments,
    layout.data.rawExports,
    layout.data.normalized,
    layout.data.deduplicated,
    layout.data.titleAbstractScreening,
    layout.data.fulltextScreening,
    layout.data.extractionPilot,
    layout.data.extracted,
    layout.data.adjudicated,
    layout.data.analysisReady,
    layout.corpus.root,
    layout.audit.root,
    layout.reports,
    layout.manuscript,
    layout.analysis,
    layout.references,
    layout.researchRuns
  ];
  for (const directory of expectedDirectories) {
    assert.equal((await stat(directory)).isDirectory(), true, `missing scaffold directory: ${directory}`);
  }

  await research.appendJsonlRecord(layout.audit.stageReceipts, pilotReceipt);
  await research.appendJsonlRecord(layout.audit.stageReceipts, terminalReceipt);
  const storedReceipts = await research.readJsonlRecords(layout.audit.stageReceipts);
  assert.deepEqual(storedReceipts.map((entry) => entry.id), ["receipt-pilot", "receipt-terminal"]);

  const revisionPath = await research.writeFrozenProtocolRevision(layout, revision);
  assert.equal((await stat(revisionPath)).isFile(), true);
  assert.equal(await research.writeFrozenProtocolRevision(layout, revision), revisionPath);
  assert.equal((await research.readLatestProtocolRevision(layout)).protocolHash, revision.protocolHash);

  const changedRevision = research.createProtocolRevision({
    id: "protocol-1-changed",
    revision: 1,
    frozenAt: "2026-08-08T00:00:00.000Z",
    decisionRecordId: "decision-changed",
    databases: ["wos"],
    queries: { wos: "TS=(hackathon AND capability)" },
    filters: {
      years: [2015, 2026],
      languages: ["en", "ko"],
      publicationTypes: ["article"]
    }
  });
  await assert.rejects(
    research.writeFrozenProtocolRevision(layout, changedRevision),
    /immutable/i
  );
} finally {
  await rm(projectRoot, { recursive: true, force: true });
}

console.log("institutional workflow contracts smoke passed");
