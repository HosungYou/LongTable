import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const tmp = mkdtempSync(join(tmpdir(), "longtable-panel-workers-"));
const projectPath = join(tmp, "project");
const setupPath = join(tmp, "setup.json");
const runtimePath = join(tmp, "runtime.toml");
const fakeBin = join(tmp, "fake-bin");
const fakeTmuxLog = join(tmp, "fake-tmux.log");
const fakeCodexLog = join(tmp, "fake-codex.log");
mkdirSync(fakeBin, { recursive: true });

writeFileSync(join(fakeBin, "tmux"), `#!/usr/bin/env node
const { appendFileSync } = require("fs");
const { execSync } = require("child_process");
const log = process.env.LONGTABLE_FAKE_TMUX_LOG;
const args = process.argv.slice(2);
if (log) appendFileSync(log, JSON.stringify(args) + "\\n");
if (args[0] === "new-window" || args[0] === "new-session") {
  const command = args[args.length - 1];
  if (process.env.LONGTABLE_FAKE_TMUX_NO_RUN !== "1") {
    execSync(command, { stdio: "ignore", env: process.env });
  }
  console.log("%fake-pane-" + Date.now());
  process.exit(0);
}
if (args[0] === "display-message") {
  console.log("%fake-pane");
  process.exit(0);
}
if (args[0] === "kill-pane") {
  process.exit(0);
}
process.exit(0);
`);
chmodSync(join(fakeBin, "tmux"), 0o755);

writeFileSync(join(fakeBin, "codex"), `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync } = require("fs");
const log = process.env.LONGTABLE_FAKE_CODEX_LOG;
const args = process.argv.slice(2);
if (log) appendFileSync(log, JSON.stringify(args) + "\\n");
const outputIndex = args.indexOf("-o");
if (outputIndex < 0 || !args[outputIndex + 1]) {
  process.exit(2);
}
const task = readFileSync(0, "utf8");
const roleMatch = task.match(/Role: (.+) \\(([^)]+)\\)/);
const label = roleMatch?.[1] ?? "Reviewer";
const role = roleMatch?.[2] ?? "reviewer";
writeFileSync(args[outputIndex + 1], JSON.stringify({
  role,
  label,
  status: "completed",
  summary: "Fake Codex worker completed a structured role review.",
  claims: ["Native worker output was normalized into PanelResult shape."],
  objections: [],
  openQuestions: [],
  evidenceRefs: ["fake-codex-worker"]
}, null, 2) + "\\n");
process.exit(0);
`);
chmodSync(join(fakeBin, "codex"), 0o755);

const fakeEnv = {
  ...process.env,
  PATH: `${fakeBin}:${process.env.PATH}`,
  LONGTABLE_FAKE_TMUX_LOG: fakeTmuxLog,
  LONGTABLE_FAKE_CODEX_LOG: fakeCodexLog
};

function runCli(args, options = {}) {
  return execFileSync("node", [cli, ...args], {
    cwd: tmp,
    encoding: "utf8",
    env: fakeEnv,
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

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
}

function assertThrowsSync(fn, expectedMessage, label) {
  try {
    fn();
  } catch (error) {
    const message = error.stderr?.toString() || error.message || String(error);
    assertIncludes(message, expectedMessage, label);
    return error;
  }
  throw new Error(`${label}: expected command to throw`);
}

const help = runCli(["--help"]);
assertIncludes(help, "longtable panel status --run", "help includes panel status");
assertIncludes(help, "longtable panel stop --run", "help includes panel stop");
assertIncludes(help, "longtable panel resume --run", "help includes panel resume");
assertIncludes(help, "--wait [ms]", "help includes bounded wait option");
assert(!help.includes("longtable team"), "help must not advertise public longtable team");

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
  "--name", "Panel Workers Smoke",
  "--goal", "Verify native panel worker CLI lifecycle.",
  "--blocker", "Need status stop resume contract.",
  "--research-object", "study_design",
  "--gap-risk", "suspected_tacit_assumptions",
  "--protected-decision", "method",
  "--perspectives", "auto",
  "--disagreement", "always_visible",
  "--no-interview",
  "--json"
]);

const panel = JSON.parse(runCli([
  "panel",
  "--cwd", projectPath,
  "--provider", "codex",
  "--native-workers",
  "--wait", "2000",
  "--prompt", "Review this test panel with native worker lifecycle state.",
  "--json"
]));
assertEqual(panel.plan.preferredSurface, "native_workers", "native worker preferred surface");
assertEqual(panel.plan.fallbackSurface, "sequential_fallback", "native worker fallback surface");
assertEqual(panel.execution.nativeParallel, "longtable_native_workers", "native worker execution marker");
assert(panel.nativeRun?.id, "native worker run id is present");
assertEqual(panel.nativeRun.status, "completed", "native worker run completes during bounded wait");
assert(panel.recordedPanelResult?.evidenceRecordIds?.length > 0, "completed native worker run records workspace evidence");
assert(panel.nativeRun.workers.length > 0, "native worker tasks are present");
const runFile = join(projectPath, ".longtable", "panel-runs", panel.nativeRun.id, "run.json");
assert(existsSync(runFile), "native worker run file exists");
assert(existsSync(panel.nativeRun.aggregateResultPath), "native worker aggregate panel result exists");
const firstTask = panel.nativeRun.workers[0].taskPath;
assertIncludes(readFileSync(firstTask, "utf8"), "Do not expose or persist hidden reasoning", "task forbids hidden reasoning persistence");
assertIncludes(readFileSync(fakeTmuxLog, "utf8"), "new-window", "tmux launch was requested");
const codexLog = readFileSync(fakeCodexLog, "utf8");
assertIncludes(codexLog, "exec", "codex exec was requested");
assertIncludes(codexLog, "read-only", "codex exec uses read-only sandbox");
assertIncludes(codexLog, "--output-schema", "codex exec receives output schema");

const status = JSON.parse(runCli([
  "panel", "status",
  "--cwd", projectPath,
  "--run", panel.nativeRun.id,
  "--json"
]));
assertEqual(status.id, panel.nativeRun.id, "panel status returns same run id");
assertEqual(status.requestedSurface, "native_workers", "panel status preserves native surface");
assertEqual(status.status, "completed", "panel status refreshes completed native worker run");
const handoff = JSON.parse(runCli(["handoff", "--cwd", projectPath, "--json"]));
const handoffText = readFileSync(handoff.path, "utf8");
assertIncludes(handoffText, "Native worker note", "handoff includes native worker guidance");
assertIncludes(handoffText, "fake-codex-worker", "handoff preserves native worker evidence refs");
runCli(["decide", "--cwd", projectPath, "--question", panel.questionRecord.id, "--answer", "defer", "--json"]);

const stoppablePanel = JSON.parse(runCli([
  "panel",
  "--cwd", projectPath,
  "--provider", "codex",
  "--native-workers",
  "--prompt", "Create a native worker run that can be stopped before a result is produced.",
  "--json"
], {
  env: {
    ...fakeEnv,
    LONGTABLE_FAKE_TMUX_NO_RUN: "1"
  }
}));
assertEqual(stoppablePanel.nativeRun.status, "running", "native worker run starts running when launched asynchronously");
assert(stoppablePanel.nativeRun.workers.some((worker) => worker.paneId), "async native worker run records pane ids");

const stopped = JSON.parse(runCli([
  "panel", "stop",
  "--cwd", projectPath,
  "--run", stoppablePanel.nativeRun.id,
  "--json"
]));
assert(stopped.status === "stop_requested" || stopped.status === "stopped", "panel stop records stop-requested or stopped run");
assert(stopped.workers.every((worker) => worker.status === "stopped" || worker.status === "stop_requested" || worker.status === "completed"), "panel stop marks incomplete workers stopped or stop-requested");

const resumed = JSON.parse(runCli([
  "panel", "resume",
  "--cwd", projectPath,
  "--run", stoppablePanel.nativeRun.id,
  "--wait", "2000",
  "--json"
]));
assertEqual(resumed.status, "completed", "panel resume relaunches pending workers and waits for completion");
assert(resumed.workers.every((worker) => worker.status === "completed"), "panel resume completes all relaunched workers");

const teamTmp = mkdtempSync(join(tmpdir(), "longtable-no-public-team-"));
const teamError = assertThrowsSync(
  () => execFileSync("node", [cli, "team", "--cwd", teamTmp, "--prompt", "Review as a team", "--json"], {
    cwd: tmp,
    encoding: "utf8",
    env: fakeEnv,
    stdio: "pipe"
  }),
  "Unknown command: team",
  "public longtable team remains unavailable"
);
assertEqual(teamError.status, 1, "public longtable team exit code");
assertEqual(teamError.stdout.toString(), "", "public longtable team stdout");
assertEqual(existsSync(join(teamTmp, ".longtable", "team")), false, "public longtable team creates no team artifacts");

console.log("panel workers smoke passed");
