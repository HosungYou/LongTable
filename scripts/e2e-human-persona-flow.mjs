import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const tmp = mkdtempSync(join(tmpdir(), "longtable-human-persona-e2e-"));

const researcher = {
  field: "human-AI decision support",
  careerStage: "doctoral",
  experienceLevel: "intermediate",
  preferredCheckpointIntensity: "strong",
  humanAuthorshipSignal: "I keep construct boundaries and unresolved doubt visible in my own words.",
  preferredEntryMode: "review",
  weakestDomain: "measurement",
  panelPreference: "show_on_conflict",
  projectName: "Algorithm Aversion Manuscript",
  goal: "Revise a journal article about algorithm aversion without overstating citation evidence.",
  blocker: "The manuscript may treat metadata or abstracts as if they were full-text evidence.",
  checkpointQuestion: "What evidence standard should LongTable require before treating a citation slot as filled?"
};

function runCli(args, options = {}) {
  return execFileSync("node", [cli, ...args], {
    cwd: tmp,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, expected, message) {
  assert(text.includes(expected), `${message}: expected to include "${expected}"`);
}

const setupPath = join(tmp, "persona-setup.json");
const runtimePath = join(tmp, "persona-runtime.toml");
const setup = JSON.parse(runCli([
  "codex",
  "persist-init",
  "--answers-json",
  JSON.stringify({
    flow: "interview",
    provider: "codex",
    field: researcher.field,
    careerStage: researcher.careerStage,
    experienceLevel: researcher.experienceLevel,
    preferredCheckpointIntensity: researcher.preferredCheckpointIntensity,
    humanAuthorshipSignal: researcher.humanAuthorshipSignal,
    preferredEntryMode: researcher.preferredEntryMode,
    weakestDomain: researcher.weakestDomain,
    panelPreference: researcher.panelPreference
  }),
  "--path",
  setupPath,
  "--runtime-path",
  runtimePath,
  "--json"
]));

assert(setup.setup.profileSeed.field === researcher.field, "setup should preserve researcher field");
assert(setup.setup.profileSeed.humanAuthorshipSignal === researcher.humanAuthorshipSignal, "setup should preserve human authorship signal");
assert(
  setup.setup.initialState.narrativeTraces.some((trace) => trace.id === "setup-human-authorship-signal"),
  "setup should record a human-authorship narrative trace"
);

const projectPath = join(tmp, "persona-project");
const start = JSON.parse(runCli([
  "start",
  "--setup",
  setupPath,
  "--name",
  researcher.projectName,
  "--path",
  projectPath,
  "--goal",
  researcher.goal,
  "--blocker",
  researcher.blocker,
  "--research-object",
  "manuscript",
  "--gap-risk",
  "suspected_tacit_assumptions",
  "--protected-decision",
  "evidence_citation",
  "--perspectives",
  "editor,reviewer,measurement_auditor",
  "--disagreement",
  "show_on_conflict",
  "--no-interview",
  "--json"
]));

assert(start.session.currentGoal === researcher.goal, "start should preserve persona goal");
assert(start.session.currentBlocker === researcher.blocker, "start should preserve persona blocker");
assert(start.session.protectedDecision === "evidence_citation", "start should preserve protected evidence decision");
assert(start.session.requestedPerspectives.includes("editor"), "start should preserve requested editor perspective");
assert(start.session.requestedPerspectives.includes("reviewer"), "start should preserve requested reviewer perspective");

const currentPath = join(projectPath, "CURRENT.md");
const agentsPath = join(projectPath, "AGENTS.md");
const statePath = join(projectPath, ".longtable", "state.json");
const projectJsonPath = join(projectPath, ".longtable", "project.json");
const sessionJsonPath = join(projectPath, ".longtable", "current-session.json");

for (const path of [currentPath, agentsPath, statePath, projectJsonPath, sessionJsonPath]) {
  assert(existsSync(path), `expected workspace artifact to exist: ${path}`);
}

const current = readFileSync(currentPath, "utf8");
const agents = readFileSync(agentsPath, "utf8");
const project = readJson(projectJsonPath);
const session = readJson(sessionJsonPath);
const state = readJson(statePath);

assertIncludes(current, researcher.goal, "CURRENT.md should show the persona goal");
assertIncludes(current, "Protected decision: evidence_citation", "CURRENT.md should show protected evidence decision");
assertIncludes(current, "Research object: manuscript", "CURRENT.md should show manuscript research object");
assertIncludes(agents, "Treat researcher interaction as the primary task.", "AGENTS.md should preserve researcher-first behavior");
assertIncludes(agents, researcher.goal, "AGENTS.md should include persona goal");
assert(project.globalSetupSummary.humanAuthorshipSignal === researcher.humanAuthorshipSignal, "project metadata should preserve human authorship signal");
assert(session.currentBlocker === researcher.blocker, "session metadata should preserve persona blocker");
assert(state.explicitState.humanAuthorshipSignal === researcher.humanAuthorshipSignal, "state should preserve human authorship signal");
assert(state.workingState.currentGoal === researcher.goal, "state should preserve working goal");
assert(
  state.openTensions.some((tension) => tension.includes("metadata or abstracts")),
  "state should preserve the persona's evidence tension"
);

const question = JSON.parse(runCli([
  "question",
  "--cwd",
  projectPath,
  "--prompt",
  "The researcher is about to cite algorithm-aversion studies while worrying that metadata-only records may be overread.",
  "--title",
  "Citation Evidence Standard",
  "--text",
  researcher.checkpointQuestion,
  "--required",
  "--provider",
  "codex",
  "--json"
]));

assert(question.question.status === "pending", "question should create a pending researcher checkpoint");
assert(question.question.prompt.required === true, "question should be required");
assert(question.question.prompt.question === researcher.checkpointQuestion, "question should preserve researcher-facing text");

const decision = JSON.parse(runCli([
  "decide",
  "--cwd",
  projectPath,
  "--question",
  question.question.id,
  "--answer",
  "full_text_quote",
  "--rationale",
  "The researcher explicitly requires a quote or claim extracted from full text before marking citation support as filled.",
  "--provider",
  "codex",
  "--json"
]));

assert(decision.question.status === "answered", "decide should answer the checkpoint");
assert(decision.decision.selectedOption === "full_text_quote", "decision should preserve the human evidence standard");

const reviewPrompt = runCli([
  "review",
  "--cwd",
  projectPath,
  "--role",
  "editor",
  "--prompt",
  "Evaluate whether this manuscript framing is journal-ready without hiding evidence uncertainty.",
  "--print"
]);

assertIncludes(reviewPrompt, "LongTable consulted: Journal Editor", "review prompt should foreground editor role");
assertIncludes(
  reviewPrompt,
  "Journal Editor: Assesses venue fit, framing strength, and editorial salience.",
  "review prompt should include editor judgment criteria"
);
assertIncludes(reviewPrompt, researcher.goal, "review prompt should include persona project context");
assertIncludes(reviewPrompt, researcher.blocker, "review prompt should include persona blocker");
assertIncludes(reviewPrompt, researcher.humanAuthorshipSignal, "review prompt should preserve human authorship signal");

const panelPrompt = runCli([
  "panel",
  "--cwd",
  projectPath,
  "--role",
  "editor,reviewer",
  "--prompt",
  "Review the contribution claim and show disagreement if editor and reviewer standards diverge.",
  "--print"
]);

assertIncludes(panelPrompt, "Journal Editor", "panel prompt should include editor role");
assertIncludes(panelPrompt, "Reviewer", "panel prompt should include reviewer role");
assertIncludes(panelPrompt, "Panel opinions by role", "panel prompt should request visible role opinions");
assertIncludes(panelPrompt, researcher.goal, "panel prompt should include persona project context");

const doctor = JSON.parse(runCli(["scholar-research", "doctor", "--json"]));
const connectorNames = doctor.connectors.map((connector) => connector.name);
assert(!connectorNames.includes("Unpaywall"), "scholar-research should not include Unpaywall");
assert(doctor.safety.paywallBypassAllowed === false, "scholar-research should disable paywall bypass");
assert(doctor.citationSlotFilledRequiresFullTextQuote === true, "scholar-research should require full-text quote support");

const scaffold = JSON.parse(runCli([
  "scholar-research",
  "scaffold",
  "--cwd",
  projectPath,
  "--run-id",
  "human-persona-e2e",
  "--json"
]));

for (const path of Object.values(scaffold.files)) {
  assert(existsSync(path), `scholar-research scaffold should create ${path}`);
}

let unpaywallRejected = false;
try {
  runCli(["search", "--query", "algorithm aversion", "--source", "unpaywall", "--json"]);
} catch (error) {
  const output = `${error.stdout?.toString() ?? ""}${error.stderr?.toString() ?? ""}`;
  unpaywallRejected = output.includes("Unknown search source: unpaywall");
}
assert(unpaywallRejected, "search should reject Unpaywall for this persona flow");

console.log(JSON.stringify({
  projectPath,
  researcher: {
    field: researcher.field,
    careerStage: researcher.careerStage,
    weakestDomain: researcher.weakestDomain,
    panelPreference: researcher.panelPreference
  },
  checkpoint: {
    id: question.question.id,
    status: decision.question.status,
    answer: decision.decision.summary
  },
  scholarResearch: {
    connectors: connectorNames,
    scaffoldRun: scaffold.runId
  }
}, null, 2));
