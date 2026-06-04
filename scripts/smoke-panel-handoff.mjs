import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const tmp = mkdtempSync(join(tmpdir(), "longtable-panel-handoff-"));
const projectPath = join(tmp, "project");
const setupPath = join(tmp, "setup.json");
const runtimePath = join(tmp, "runtime.toml");
const codexSkillsDir = join(tmp, "codex-skills");
const claudeSkillsDir = join(tmp, "claude-skills");

function runCli(args, options = {}) {
  return execFileSync("node", [cli, ...args], {
    cwd: tmp,
    encoding: "utf8",
    ...options
  });
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label}: expected text to include ${expected}`);
  }
}

function assertNotIncludes(text, unexpected, label) {
  if (text.includes(unexpected)) {
    throw new Error(`${label}: expected text not to include ${unexpected}`);
  }
}

function assertThrowsSync(fn, expectedMessage, label) {
  try {
    fn();
  } catch (error) {
    const message = error.stderr?.toString() || error.message || String(error);
    assertIncludes(message, expectedMessage, label);
    return;
  }
  throw new Error(`${label}: expected command to throw`);
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
  "--path", projectPath,
  "--name", "Panel Handoff Smoke",
  "--goal", "Verify panel result persistence and continuation handoff.",
  "--blocker", "Need concrete post-panel workflow.",
  "--research-object", "study_design",
  "--gap-risk", "suspected_tacit_assumptions",
  "--protected-decision", "method",
  "--perspectives", "auto",
  "--disagreement", "always_visible",
  "--no-interview",
  "--json"
]);

runCli(["codex", "install-skills", "--surface", "compact", "--dir", codexSkillsDir]);
const codexPanelSkillPath = join(codexSkillsDir, "longtable-panel", "SKILL.md");
if (!existsSync(codexPanelSkillPath)) {
  throw new Error("compact Codex skills should include longtable-panel.");
}
const codexPanelSkill = readFileSync(codexPanelSkillPath, "utf8");
assertIncludes(codexPanelSkill, "--native-workers", "Codex panel skill native worker wording");
assertIncludes(codexPanelSkill, "Sequential fallback", "Codex panel skill fallback wording");
assertIncludes(codexPanelSkill, "PanelResult", "Codex panel skill normalized result wording");

runCli(["claude", "install-skills", "--surface", "compact", "--dir", claudeSkillsDir]);
const claudePanelSkillPath = join(claudeSkillsDir, "longtable-panel", "SKILL.md");
if (!existsSync(claudePanelSkillPath)) {
  throw new Error("compact Claude skills should include longtable-panel.");
}
const claudePanelSkill = readFileSync(claudePanelSkillPath, "utf8");
assertIncludes(claudePanelSkill, "--native-workers", "Claude panel skill native worker wording");
assertIncludes(claudePanelSkill, "Sequential fallback", "Claude panel skill fallback wording");
assertIncludes(claudePanelSkill, "PanelResult", "Claude panel skill normalized result wording");

const panel = JSON.parse(runCli([
  "panel",
  "--cwd", projectPath,
  "--provider", "codex",
  "--native-subagents",
  "--prompt", "Review whether the panel output can become actionable next work after discussion.",
  "--json"
]));

assertEqual(panel.plan.preferredSurface, "native_subagents", "legacy native subagent preferred panel surface");
assertEqual(panel.plan.fallbackSurface, "sequential_fallback", "panel fallback surface");
assertEqual(panel.execution.nativeParallel, "session_dependent", "legacy native subagent availability marker");
assertEqual(panel.execution.stableSurface, "sequential_fallback", "stable surface remains fallback");
runCli(["decide", "--cwd", projectPath, "--question", panel.questionRecord.id, "--answer", "defer", "--json"]);

const nativeWorkersPanel = JSON.parse(runCli([
  "panel",
  "--cwd", projectPath,
  "--provider", "codex",
  "--native-workers",
  "--prompt", "Review whether native panel workers can be tracked without exposing a public team surface.",
  "--json"
]));

assertEqual(nativeWorkersPanel.plan.preferredSurface, "native_workers", "native workers preferred panel surface");
assertEqual(nativeWorkersPanel.plan.fallbackSurface, "sequential_fallback", "native workers fallback surface");
assertEqual(nativeWorkersPanel.execution.nativeParallel, "longtable_native_workers", "native workers availability marker");
assertEqual(nativeWorkersPanel.execution.nativeRunCreated, true, "native workers run record created");
assertEqual(nativeWorkersPanel.nativeRun.requestedSurface, "native_workers", "native workers run surface");
runCli(["decide", "--cwd", projectPath, "--question", nativeWorkersPanel.questionRecord.id, "--answer", "defer", "--json"]);

const claudeNativeWorkersPanel = JSON.parse(runCli([
  "panel",
  "--cwd", projectPath,
  "--provider", "claude",
  "--native-workers",
  "--prompt", "Review provider gating for native workers.",
  "--json"
]));
assertEqual(claudeNativeWorkersPanel.plan.preferredSurface, "sequential_fallback", "Claude native workers request remains sequential fallback");
assertEqual(claudeNativeWorkersPanel.execution.nativeParallel, "not_requested", "Claude native workers request does not launch Codex workers");
assertEqual(claudeNativeWorkersPanel.execution.nativeRunCreated, false, "Claude native workers request creates no native worker run");
runCli(["decide", "--cwd", projectPath, "--question", claudeNativeWorkersPanel.questionRecord.id, "--answer", "defer", "--json"]);

const bothFlagsPanel = JSON.parse(runCli([
  "panel",
  "--cwd", projectPath,
  "--provider", "codex",
  "--native-workers",
  "--native-subagents",
  "--prompt", "Review deterministic precedence when both native flags are present.",
  "--json"
]));

assertEqual(bothFlagsPanel.plan.preferredSurface, "native_workers", "native workers preferred when both native flags are present");
assertEqual(bothFlagsPanel.execution.nativeParallel, "longtable_native_workers", "native workers marker when both flags are present");
runCli(["decide", "--cwd", projectPath, "--question", bothFlagsPanel.questionRecord.id, "--answer", "defer", "--json"]);

const invalidResultFile = join(projectPath, "invalid-panel-result.json");
writeFileSync(invalidResultFile, JSON.stringify({
  surface: "raw_tool_logs",
  status: "not_a_status",
  memberResults: [
    {
      role: "reviewer",
      summary: "Invalid top-level fields must not be persisted."
    }
  ]
}, null, 2));
assertThrowsSync(
  () => runCli([
    "panel",
    "record",
    "--cwd", projectPath,
    "--invocation", bothFlagsPanel.invocationRecord.id,
    "--result-file", invalidResultFile,
    "--json"
  ], { stdio: "pipe" }),
  "Invalid panel result status",
  "panel record rejects invalid result-file status"
);
writeFileSync(invalidResultFile, JSON.stringify({
  surface: "raw_tool_logs",
  status: "completed",
  memberResults: [
    {
      role: "reviewer",
      summary: "Invalid top-level surface must not be persisted."
    }
  ]
}, null, 2));
assertThrowsSync(
  () => runCli([
    "panel",
    "record",
    "--cwd", projectPath,
    "--invocation", bothFlagsPanel.invocationRecord.id,
    "--result-file", invalidResultFile,
    "--json"
  ], { stdio: "pipe" }),
  "Invalid panel result surface",
  "panel record rejects invalid result-file surface"
);

const resultFile = join(projectPath, "panel-result.json");
writeFileSync(resultFile, JSON.stringify({
  surface: "native_workers",
  synthesis: "The panel converges that discussion output must become an explicit handoff before implementation starts.",
  conflictSummary: "The methods role wants a spec patch first; the voice role wants unresolved disagreement preserved in the handoff.",
  decisionPrompt: "Should LongTable propose a Research Specification patch now or keep this as an open handoff item?",
  memberResults: [
    {
      role: "reviewer",
      label: "Reviewer",
      summary: "A reviewer would need the next action and evidence basis stated before work continues.",
      claims: ["A handoff packet reduces ambiguous continuation."],
      objections: ["A generic summary is not enough for implementation."],
      openQuestions: ["Which spec section should change first?"],
      evidenceRefs: ["panel-runs/run_fixture/results/reviewer.json"],
      hiddenReasoning: "secret-chain-should-not-persist",
      rawToolLog: "raw-tool-log-should-not-persist"
    },
    {
      role: "measurement_auditor",
      label: "Measurement Auditor",
      summary: "Panel evidence must remain traceable before it changes the specification.",
      claims: ["Unincorporated evidence should be inspectable."],
      objections: ["Direct application without confirmation would hide researcher judgment."],
      evidenceRefs: ["panel-runs/run_fixture/results/measurement_auditor.json"]
    }
  ]
}, null, 2));

const record = JSON.parse(runCli([
  "panel",
  "record",
  "--cwd", projectPath,
  "--invocation", bothFlagsPanel.invocationRecord.id,
  "--result-file", resultFile,
  "--json"
]));
if (record.evidenceRecords.length < 2) {
  throw new Error(`expected panel recording to create evidence records, got ${record.evidenceRecords.length}`);
}
const stateText = readFileSync(join(projectPath, ".longtable", "state.json"), "utf8");
assertNotIncludes(stateText, "secret-chain-should-not-persist", "panel record strips hidden reasoning fields");
assertNotIncludes(stateText, "raw-tool-log-should-not-persist", "panel record strips raw tool log fields");

const unincorporated = JSON.parse(runCli(["spec", "unincorporated", "--cwd", projectPath, "--json"]));
if (unincorporated.evidenceRecords.length < 2) {
  throw new Error("recorded panel evidence should be visible as unincorporated evidence.");
}

const handoff = JSON.parse(runCli(["handoff", "--cwd", projectPath, "--json"]));
if (!existsSync(handoff.path)) {
  throw new Error("handoff file should be written.");
}
const handoffText = readFileSync(handoff.path, "utf8");
assertIncludes(handoffText, "Provider-Neutral Path", "handoff provider-neutral section");
assertIncludes(handoffText, "Optional OMX Path", "handoff optional OMX section");
assertIncludes(handoffText, "$ralplan", "handoff ralplan guidance");
assertIncludes(handoffText, "$ralph", "handoff ralph guidance");
assertIncludes(handoffText, "longtable panel record", "handoff panel record guidance");
assertIncludes(handoffText, "Unincorporated Evidence", "handoff evidence section");
assertIncludes(handoffText, "Native worker note", "handoff native worker section");
const finalState = JSON.parse(readFileSync(join(projectPath, ".longtable", "state.json"), "utf8"));
const recordedPanel = finalState.invocations.find((invocation) => invocation.id === bothFlagsPanel.invocationRecord.id)?.panelResult;
if (!recordedPanel) {
  throw new Error("recorded panel result should remain linked to its invocation.");
}
assertIncludes(recordedPanel.linkedQuestionRecordIds, bothFlagsPanel.questionRecord.id, "recorded panel links originating question");

console.log("panel handoff smoke passed");
