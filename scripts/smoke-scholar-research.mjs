import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
}

const scholar = await import(join(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));
const compatibility = await import(join(repoRoot, "packages", "longtable-research-search", "dist", "index.js"));
const codex = await import(join(repoRoot, "packages", "longtable-provider-codex", "dist", "index.js"));
const claude = await import(join(repoRoot, "packages", "longtable-provider-claude", "dist", "index.js"));
const personas = await import(join(repoRoot, "packages", "longtable", "dist", "personas.js"));

assertEqual(compatibility.SCHOLAR_RESEARCH_SKILL_NAME, scholar.SCHOLAR_RESEARCH_SKILL_NAME, "compatibility package re-export");
assertEqual(scholar.SCHOLAR_RESEARCH_SKILL_NAME, "scholar-research", "canonical skill name");
assert(scholar.SCHOLAR_RESEARCH_FAILURE_REASONS.includes("restricted_access"), "restricted access failure reason");
assert(scholar.SCHOLAR_RESEARCH_FAILURE_REASONS.includes("robots_or_terms_blocked"), "robots/terms failure reason");
assert(scholar.SCHOLAR_RESEARCH_SLOT_STATUSES.includes("filled"), "filled slot status");
assert(scholar.SCHOLAR_RESEARCH_SLOT_STATUSES.includes("blocked"), "blocked slot status");

const readiness = scholar.assessScholarResearchReadiness({
  LONGTABLE_CONTACT_EMAIL: "researcher@example.test",
  OPENALEX_API_KEY: "test-openalex",
  CORE_API_KEY: "test-core"
});
assertEqual(readiness.safety.paywallBypassAllowed, false, "paywall bypass must be disabled");
assertEqual(readiness.safety.institutionLoginAutomationAllowed, false, "institution login automation must be disabled");
assert(readiness.connectors.some((connector) => connector.name === "Crossref" && connector.status === "ready"), "Crossref readiness");
assert(readiness.connectors.some((connector) => connector.name === "Unpaywall" && connector.status === "ready"), "Unpaywall readiness");
assert(readiness.connectors.some((connector) => connector.name === "CORE" && connector.status === "ready"), "CORE readiness");

const fixture = scholar.buildScholarResearchSmokeFixture();
assertEqual(fixture.length, 10, "smoke fixture size");
assertEqual(fixture.filter((item) => item.category === "oa_pdf").length, 3, "OA PDF fixture count");
assertEqual(fixture.filter((item) => item.category === "restricted_fallback").length, 2, "restricted fallback fixture count");
assertEqual(fixture.filter((item) => item.category === "korean_institutional_report").length, 1, "Korean report fixture count");

const cwd = mkdtempSync(join(tmpdir(), "longtable-scholar-smoke-"));
try {
  const scaffold = JSON.parse(execFileSync("node", [
    cli,
    "scholar-research",
    "scaffold",
    "--cwd", cwd,
    "--run-id", "smoke-run",
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  }));
  assert(scaffold.runDir.endsWith(join(".longtable", "research-runs", "smoke-run")), "scaffold run dir");
  assert(existsSync(join(cwd, ".longtable", "research-runs", "smoke-run", "journal.md")), "journal scaffold exists");
  assert(existsSync(join(cwd, ".longtable", "research-runs", "smoke-run", "evidence-ledger.md")), "evidence ledger scaffold exists");
  assert(existsSync(join(cwd, ".longtable", "research-runs", "smoke-run", "citation-slot-matrix.md")), "citation slot scaffold exists");
} finally {
  rmSync(cwd, { recursive: true, force: true });
}

const doctor = JSON.parse(execFileSync("node", [
  cli,
  "doctor",
  "--json"
], {
  cwd: repoRoot,
  encoding: "utf8",
  env: {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    LONGTABLE_CONTACT_EMAIL: "researcher@example.test",
    OPENALEX_API_KEY: "test-openalex",
    CORE_API_KEY: "test-core"
  }
}));
assert(doctor.scholarResearch, "doctor should include scholarResearch readiness");
assertEqual(doctor.scholarResearch.safety.paywallBypassAllowed, false, "doctor safety gate");

const roles = personas.listRoleDefinitions();
const codexSkillNames = codex.buildCodexSkillSpecs(roles, "compact").map((skill) => skill.name);
assert(codexSkillNames.includes("critical-interview"), "Codex skill bundle includes critical-interview");
assert(codexSkillNames.includes("scholar-research"), "Codex skill bundle includes scholar-research");
const codexCritical = codex.buildCodexSkillSpecs(roles, "compact").find((skill) => skill.name === "critical-interview");
assertEqual(codexCritical.disableModelInvocation, true, "Codex critical-interview disables model invocation");
const codexScholar = codex.buildCodexSkillSpecs(roles, "compact").find((skill) => skill.name === "scholar-research");
assert(codexScholar.body.join("\n").includes("Do not bypass paywalls"), "Codex scholar-research states safety boundary");

const claudeSkillNames = claude.buildClaudeSkillSpecs(roles, "compact").map((skill) => skill.name);
assert(claudeSkillNames.includes("critical-interview"), "Claude skill bundle includes critical-interview");
assert(claudeSkillNames.includes("scholar-research"), "Claude skill bundle includes scholar-research");

console.log("scholar research smoke passed");
