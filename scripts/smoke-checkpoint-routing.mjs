import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const { classifyCheckpointTrigger } = await import(join(repoRoot, "packages", "longtable-checkpoints", "dist", "index.js"));
const {
  answerWorkspaceQuestion,
  createWorkspaceQuestion,
  loadProjectContextFromDirectory
} = await import(join(repoRoot, "packages", "longtable", "dist", "index.js"));
const { renderQuestionRecordPrompt } = await import(join(repoRoot, "packages", "longtable-provider-codex", "dist", "index.js"));

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function classify(prompt, fallbackMode) {
  return classifyCheckpointTrigger(prompt, {
    fallbackMode,
    unresolvedTensions: ["research detail"]
  });
}

const exploration = classify(
  "I want to explore trust calibration but I am not sure whether the gap is theory, measurement, or study design. Please help me narrow it.",
  "explore"
);
assertEqual(exploration.signal.checkpointKey, "knowledge_gap_probe", "exploration checkpoint key");
assertEqual(exploration.requiresQuestionBeforeClosure, true, "exploration requires question");

const panel = classify(
  "The panel disagrees about whether calibration should be treated as a cognitive mismatch or a relational trust issue. Synthesize and choose the best framing.",
  "review"
);
assertEqual(panel.signal.checkpointKey, "panel_disagreement_resolution", "panel checkpoint key");
assertEqual(panel.requiresQuestionBeforeClosure, true, "panel requires question");

const draft = classify(
  "Please polish this paragraph for clarity without changing the research claim.",
  "draft"
);
assertEqual(draft.signal.checkpointKey, "evidence_claim", "draft evidence key");
assertEqual(draft.advisoryOnly, true, "draft remains advisory");

const tmp = mkdtempSync(join(tmpdir(), "longtable-checkpoint-routing-"));
const setupPath = join(tmp, "setup.json");
const runtimePath = join(tmp, "runtime.toml");

function runCli(args) {
  return execFileSync("node", [cli, ...args], {
    cwd: tmp,
    encoding: "utf8"
  });
}

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

runCli([
  "start",
  "--setup", setupPath,
  "--path", tmp,
  "--name", "Checkpoint Routing Smoke",
  "--goal", "Test checkpoint routing",
  "--blocker", "research detail",
  "--research-object", "study_design",
  "--gap-risk", "known_gap",
  "--protected-decision", "method",
  "--perspectives", "auto",
  "--disagreement", "always_visible",
  "--json"
]);

const created = JSON.parse(runCli([
  "question",
  "--cwd", tmp,
  "--provider", "codex",
  "--prompt", "The panel disagrees about framing. Synthesize and choose the best framing.",
  "--json"
]));

assertEqual(created.question.prompt.checkpointKey, "panel_disagreement_resolution", "created question checkpoint key");
assertEqual(created.question.prompt.preferredSurfaces[0], "mcp_elicitation", "codex preferred surface");

const context = await loadProjectContextFromDirectory(tmp);
if (!context) {
  throw new Error("Smoke workspace context was not created.");
}

const decided = await answerWorkspaceQuestion({
  context,
  questionId: created.question.id,
  answer: "surface_disagreement",
  provider: "codex",
  surface: "mcp_elicitation"
});

assertEqual(decided.question.answer?.surface, "mcp_elicitation", "accepted MCP surface");

const overridden = await createWorkspaceQuestion({
  context,
  prompt: "Theory and construct words should not override the explicit checkpoint.",
  checkpointKey: "explore_runtime_guidance",
  question: "Which uncertainty should LongTable resolve first?",
  questionOptions: [
    { value: "surface_tensions", label: "Surface tensions first" },
    { value: "gather_context", label: "Gather context first" }
  ],
  displayReason: "The UI should ask the concrete decision instead of exposing internal trigger rationale.",
  required: false,
  provider: "codex"
});
assertEqual(overridden.question.prompt.checkpointKey, "explore_runtime_guidance", "explicit checkpoint override");
assertEqual(overridden.question.prompt.options[0]?.value, "surface_tensions", "explicit option override");
const rendered = renderQuestionRecordPrompt(overridden.question).prompt;
if (rendered.includes("Why now:")) {
  throw new Error("Codex question fallback should not render repeated Why now lines.");
}
if (!rendered.includes("Decision context: The UI should ask the concrete decision")) {
  throw new Error("Codex question fallback should render the display reason.");
}

const teamTmp = mkdtempSync(join(tmpdir(), "longtable-team-cross-review-"));
const team = JSON.parse(execFileSync("node", [
  cli,
  "team",
  "--cwd", teamTmp,
  "--prompt", "Review this measurement plan as an agent team.",
  "--role", "editor,measurement_auditor",
  "--json"
], {
  cwd: teamTmp,
  encoding: "utf8"
}));
assertEqual(team.run.interactionDepth, "cross_reviewed", "team interaction depth");
assertEqual(team.run.roundCount, 3, "team round count");
const crossRound = team.run.rounds.find((round) => round.kind === "cross_review");
if (!crossRound?.contributions.every((contribution) => typeof contribution.respondsToContributionId === "string")) {
  throw new Error("Team cross-review contributions must reference independent contributions.");
}

const debateTmp = mkdtempSync(join(tmpdir(), "longtable-team-debate-"));
const debate = JSON.parse(execFileSync("node", [
  cli,
  "team",
  "--cwd", debateTmp,
  "--prompt", "Debate this measurement plan before I commit.",
  "--role", "editor,measurement_auditor",
  "--debate",
  "--json"
], {
  cwd: debateTmp,
  encoding: "utf8"
}));
assertEqual(debate.run.interactionDepth, "debated", "debate interaction depth");
assertEqual(debate.run.roundCount, 5, "debate round count");

const naturalTeam = JSON.parse(execFileSync("node", [
  cli,
  "ask",
  "--cwd", mkdtempSync(join(tmpdir(), "longtable-natural-team-")),
  "--prompt", "lt team: Review this measurement plan before I commit it.",
  "--json"
], {
  cwd: tmpdir(),
  encoding: "utf8"
}));
assertEqual(naturalTeam.run.interactionDepth, "cross_reviewed", "natural team interaction depth");

const naturalDebate = JSON.parse(execFileSync("node", [
  cli,
  "ask",
  "--cwd", mkdtempSync(join(tmpdir(), "longtable-natural-debate-")),
  "--prompt", "lt debate: Review this measurement plan before I commit it.",
  "--json"
], {
  cwd: tmpdir(),
  encoding: "utf8"
}));
assertEqual(naturalDebate.run.interactionDepth, "debated", "natural debate interaction depth");

const stakesRoute = JSON.parse(execFileSync("node", [
  cli,
  "ask",
  "--cwd", mkdtempSync(join(tmpdir(), "longtable-stakes-route-")),
  "--prompt", "Use multiple perspectives to review this submission plan. The editor and reviewer disagree about the public framing.",
  "--json"
], {
  cwd: tmpdir(),
  encoding: "utf8"
}));
assertEqual(stakesRoute.run.interactionDepth, "debated", "external-facing disagreement routes to debate");

console.log("checkpoint routing smoke passed");
