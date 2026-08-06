import { strict as assert } from "node:assert";
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
  "CORPUS_FREEZE_REQUIRED"
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

console.log("institutional workflow contracts smoke passed");
