import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(resolve(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));
const auditModule = await import(pathToFileURL(resolve(repoRoot, "scripts", "audit-research-artifacts.mjs")));

const retryable = [
  "TRANSIENT_NETWORK_TIMEOUT",
  "DELAYED_EXPORT_GENERATION",
  "INCOMPLETE_DOWNLOAD",
  "TEMPORARY_PAGE_RENDER_FAILURE",
  "FILE_PROVIDER_HYDRATION_DELAY"
];
for (const code of retryable) {
  const plan = research.buildRetryPlan({ code, maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 250 });
  assert.deepEqual(plan.delaysMs, [100, 200]);
  assert.equal(plan.maxAttempts, 3);
  assert.equal(plan.requiresResearcherDecision, false);
}

for (const code of ["SESSION_EXPIRED", "DATABASE_RESULT_CAP_REACHED", "EXPORT_COUNT_MISMATCH", "DOWNLOAD_PATTERN_CHANGED"]) {
  assert.throws(() => research.buildRetryPlan({ code, maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 250 }), /hard stop/i);
}
assert.throws(() => research.buildRetryPlan({ code: "CORRUPT_PDF", maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 200 }), /unknown/i);

const advisory = research.aggregateRetryAdvisory([
  { code: "DELAYED_EXPORT_GENERATION", attempts: 2, recovered: true },
  { code: "TRANSIENT_NETWORK_TIMEOUT", attempts: 3, recovered: false },
  { code: "DELAYED_EXPORT_GENERATION", attempts: 2, recovered: true }
]);
assert.equal(advisory.advisoryCount, 1);
assert.match(advisory.message, /DELAYED_EXPORT_GENERATION × 2/);
assert.match(advisory.message, /TRANSIENT_NETWORK_TIMEOUT × 1/);

const mechanicalStages = research.ZERO_MODEL_CALL_STAGES;
for (const stage of mechanicalStages) {
  const budget = research.modelCallBudgetForStage(stage);
  assert.equal(budget.maximumCalls, 0);
  assert.doesNotThrow(() => research.assertModelCallBudget(budget, 0));
  assert.throws(() => research.assertModelCallBudget(budget, 1), /model-call budget/i);
}
assert.equal(research.modelCallBudgetForStage("PROTOCOL_CHECKPOINT", "search_strategy_proposal").maximumCalls, 1);
assert.equal(research.modelCallBudgetForStage("PILOT", "pilot_interpretation").maximumCalls, 1);
assert.equal(research.modelCallBudgetForStage("TITLE_ABSTRACT_SCREENING", "configured_screening_batch", 20).maximumCalls, 20);
assert.throws(() => research.modelCallBudgetForStage("TITLE_ABSTRACT_SCREENING", "configured_screening_batch"), /configured screening batch/i);
const cacheInput = {
  artifactSha256: "e".repeat(64), ruleVersion: "rules-v1", codebookVersion: "codebook-v1",
  promptVersion: "prompt-v1", modelVersion: "model-v1"
};
assert.equal(research.buildModelCallCacheKey(cacheInput), research.buildModelCallCacheKey(cacheInput));
assert.notEqual(research.buildModelCallCacheKey(cacheInput), research.buildModelCallCacheKey({ ...cacheInput, promptVersion: "prompt-v2" }));

const cleanAudit = auditModule.auditResearchArtifactObjects([
  { artifactId: "artifact-clean", value: { accessBasis: "institutional_subscription", localPath: "corpus/frozen.jsonl" } }
]);
assert.equal(cleanAudit.passed, true);

const seeded = auditModule.auditResearchArtifactObjects([
  { artifactId: "artifact-credential", value: { credential: "should-never-print" } },
  { artifactId: "artifact-cookie", value: { cookie: "also-never-print" } },
  { artifactId: "artifact-token", value: { access_token: "token-never-print" } },
  { artifactId: "artifact-header", value: { authorization_header: "Bearer never-print" } },
  { artifactId: "artifact-path", value: { localPath: "/Users/researcher/private/file.pdf" } },
  { artifactId: "artifact-licensed", value: Buffer.from("%PDF-1.7\nLICENSED_FULLTEXT_DO_NOT_REDISTRIBUTE") }
]);
assert.equal(seeded.passed, false);
assert.deepEqual([...new Set(seeded.findings.map((finding) => finding.artifactId))].sort(), [
  "artifact-cookie", "artifact-credential", "artifact-header", "artifact-licensed", "artifact-path", "artifact-token"
]);
const serialized = JSON.stringify(seeded);
for (const secret of ["should-never-print", "also-never-print", "token-never-print", "Bearer never-print"]) {
  assert(!serialized.includes(secret));
}

const faultMatrix = [
  "network_timeout", "delayed_export", "partial_download", "corrupt_pdf", "empty_export", "count_mismatch",
  "placeholder_file", "interrupted_run", "missing_doi", "session_expiry", "result_cap", "onedrive_hydration_delay"
];
assert.deepEqual(research.RESEARCH_FAILURE_INJECTION_MATRIX, faultMatrix);

console.log("research failure, security, and model-budget tests passed");
