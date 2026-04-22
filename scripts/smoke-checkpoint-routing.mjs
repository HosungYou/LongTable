import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const { classifyCheckpointTrigger } = await import(join(repoRoot, "packages", "longtable-checkpoints", "dist", "index.js"));
const {
  answerWorkspaceQuestion,
  loadProjectContextFromDirectory
} = await import(join(repoRoot, "packages", "longtable", "dist", "index.js"));

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

console.log("checkpoint routing smoke passed");
