import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const onboarding = await import(join(repoRoot, "packages", "longtable-setup", "dist", "onboarding.js"));
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

const activeText = [
  readFileSync(join(repoRoot, "packages", "longtable-setup", "src", "onboarding.ts"), "utf8"),
  readFileSync(join(repoRoot, "packages", "longtable-setup", "dist", "onboarding.js"), "utf8")
].join("\n");
if (activeText.includes("Before we begin, which research field")) {
  throw new Error("Deprecated research-field setup prompt is still present.");
}

console.log("setup/start smoke passed");
