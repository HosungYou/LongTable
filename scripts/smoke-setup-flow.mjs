import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const onboarding = await import(join(repoRoot, "packages", "longtable-setup", "dist", "onboarding.js"));
const rootPackage = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const tmp = mkdtempSync(join(tmpdir(), "longtable-setup-smoke-"));

function runCli(args, options = {}) {
  return execFileSync("node", [cli, ...args], {
    cwd: tmp,
    encoding: "utf8",
    ...options
  });
}

const interviewQuestionIds = onboarding.buildQuickSetupFlow("interview").map((question) => question.id);
const forbiddenSetupQuestions = [
  "field",
  "careerStage",
  "experienceLevel",
  "humanAuthorshipSignal",
  "weakestDomain",
  "panelPreference"
];

for (const forbidden of forbiddenSetupQuestions) {
  if (interviewQuestionIds.includes(forbidden)) {
    throw new Error(`Deprecated setup question still appears: ${forbidden}`);
  }
}

const setupPath = join(tmp, "setup.json");
const runtimePath = join(tmp, "runtime.toml");
const setupJson = JSON.parse(runCli([
  "setup",
  "--provider", "codex",
  "--install-scope", "none",
  "--surfaces", "cli_only",
  "--intervention", "balanced",
  "--workspace", "later",
  "--setup-path", setupPath,
  "--runtime-path", runtimePath,
  "--json"
]));

if (setupJson.setup.profileSeed.field !== "unspecified") {
  throw new Error("Setup should default field to unspecified.");
}
if (setupJson.setup.initialState.explicitState.installScope !== "none") {
  throw new Error("Setup did not record installScope.");
}
if (setupJson.setup.initialState.explicitState.runtimeSurfaces !== "cli_only") {
  throw new Error("Setup did not record runtime surface.");
}
if (setupJson.setup.initialState.explicitState.officialStartSurface !== "$longtable-interview") {
  throw new Error("Setup should point researchers to $longtable-interview.");
}
if (["t", "muxMode"].join("") in setupJson.setup.initialState.explicitState) {
  throw new Error("Setup should not record a console-specific mode.");
}
if ("runtimeTarget" in setupJson.runtime) {
  throw new Error("install-scope none should not write provider runtime files.");
}

const initSetupPath = join(tmp, "init-setup.json");
const initRuntimePath = join(tmp, "init-runtime.toml");
const initOutput = runCli([
  "init",
  "--provider", "codex",
  "--install-scope", "none",
  "--surfaces", "cli_only",
  "--intervention", "advisory",
  "--workspace", "later",
  "--setup-path", initSetupPath,
  "--runtime-path", initRuntimePath,
  "--json"
], {
  stdio: ["ignore", "pipe", "pipe"]
});
const initJson = JSON.parse(initOutput);
if (initJson.setup.initialState.explicitState.installScope !== "none") {
  throw new Error("Deprecated init alias did not route to permission-first setup.");
}

const projectPath = join(tmp, "project");
const startJson = JSON.parse(runCli([
  "start",
  "--setup", setupPath,
  "--name", "Smoke Project",
  "--path", projectPath,
  "--goal", "Plan a measurement study",
  "--blocker", "Need to avoid tacit assumptions",
  "--research-object", "measurement_instrument",
  "--gap-risk", "suspected_tacit_assumptions",
  "--protected-decision", "measurement",
  "--perspectives", "measurement_auditor",
  "--disagreement", "show_on_conflict",
  "--no-interview",
  "--json"
]));

if (startJson.session.researchObject !== "measurement_instrument") {
  throw new Error("start did not persist researchObject.");
}
if (startJson.session.gapRisk !== "suspected_tacit_assumptions") {
  throw new Error("start did not persist gapRisk.");
}
if (startJson.session.protectedDecision !== "measurement") {
  throw new Error("start did not persist protectedDecision.");
}

const current = readFileSync(join(projectPath, "CURRENT.md"), "utf8");
if (!current.includes("Research object: measurement_instrument")) {
  throw new Error("CURRENT.md does not show the research object.");
}
if (current.includes("knowledge gap, a coding rule gap, or a data gap")) {
  throw new Error("CURRENT.md still uses the deprecated taxonomy-style start question.");
}
if (current.includes("reader need to understand differently") || current.includes("reader or reviewer")) {
  throw new Error("CURRENT.md should not ask reader/reviewer contribution during early start.");
}
if (!current.includes("usable first research handle")) {
  throw new Error("CURRENT.md should point toward a first research handle.");
}

const activeText = [
  readFileSync(join(repoRoot, "packages", "longtable-setup", "src", "onboarding.ts"), "utf8"),
  readFileSync(join(repoRoot, "packages", "longtable-setup", "dist", "onboarding.js"), "utf8")
].join("\n");
if (activeText.includes("Before we begin, which research field")) {
  throw new Error("Deprecated research-field setup prompt is still present.");
}

const movedStart = runCli([
  "start"
], {
  stdio: ["ignore", "pipe", "pipe"]
});
if (!movedStart.includes("$longtable-interview")) {
  throw new Error("Interactive longtable start should direct researchers to $longtable-interview.");
}

const skillsDir = join(tmp, "codex-skills");
const installOutput = runCli(["codex", "install-skills", "--dir", skillsDir]);
if (!installOutput.includes("longtable-interview")) {
  throw new Error("Codex skill install should include longtable-interview.");
}
if (!installOutput.includes("longtable-methods") || !installOutput.includes("longtable-measure")) {
  throw new Error("Compact Codex skill install should include short role shortcuts.");
}
if (installOutput.includes("longtable-methods-critic") || installOutput.includes("longtable-panel")) {
  throw new Error("Compact Codex skill install should not expose full role or panel shortcuts by default.");
}
const interviewSkill = readFileSync(join(skillsDir, "longtable-interview", "SKILL.md"), "utf8");
if (!interviewSkill.includes("First Research Shape")) {
  throw new Error("longtable-interview skill should document First Research Shape.");
}
if (!interviewSkill.includes("Do not begin with reader/reviewer")) {
  throw new Error("longtable-interview skill should forbid early reader/reviewer prompts.");
}
if (!interviewSkill.includes("Closure Readiness") || !interviewSkill.includes("never stop merely because a fixed number of turns has passed")) {
  throw new Error("longtable-interview skill should document content-based closure readiness.");
}
if (!interviewSkill.includes("append_interview_turn") || !interviewSkill.includes("readyToSummarize")) {
  throw new Error("longtable-interview skill should document durable turn recording and readiness signals.");
}
if (!interviewSkill.includes("one main uncertainty") || !interviewSkill.includes("mini-questionnaire")) {
  throw new Error("longtable-interview skill should softly document one-question-at-a-time behavior.");
}
const mcpInstall = JSON.parse(runCli([
  "mcp",
  "install",
  "--provider", "codex",
  "--checkpoint-ui", "strong",
  "--json"
]));
if (mcpInstall.packageSpec !== `@longtable/mcp@${rootPackage.version}`) {
  throw new Error(`MCP install snippet should use package version ${rootPackage.version}.`);
}
const fullSkillsDir = join(tmp, "codex-skills-full");
const fullInstallOutput = runCli(["codex", "install-skills", "--surface", "full", "--dir", fullSkillsDir]);
if (!fullInstallOutput.includes("longtable-methods-critic") || !fullInstallOutput.includes("longtable-panel")) {
  throw new Error("Full Codex skill install should preserve the full skill surface.");
}

console.log("setup/start smoke passed");
