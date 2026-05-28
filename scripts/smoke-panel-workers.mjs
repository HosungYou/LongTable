import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const tmp = mkdtempSync(join(tmpdir(), "longtable-panel-workers-"));
const projectPath = join(tmp, "project");
const setupPath = join(tmp, "setup.json");
const runtimePath = join(tmp, "runtime.toml");

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
  "--prompt", "Review this test panel with native worker lifecycle state.",
  "--json"
]));
assertEqual(panel.plan.preferredSurface, "native_workers", "native worker preferred surface");
assertEqual(panel.plan.fallbackSurface, "sequential_fallback", "native worker fallback surface");
assertEqual(panel.execution.nativeParallel, "longtable_native_workers", "native worker execution marker");
assert(panel.nativeRun?.id, "native worker run id is present");
assertEqual(panel.nativeRun.status, "planned", "native worker run starts planned");
assert(panel.nativeRun.workers.length > 0, "native worker tasks are present");
const runFile = join(projectPath, ".longtable", "panel-runs", panel.nativeRun.id, "run.json");
assert(existsSync(runFile), "native worker run file exists");
const firstTask = panel.nativeRun.workers[0].taskPath;
assertIncludes(readFileSync(firstTask, "utf8"), "Do not expose or persist hidden reasoning", "task forbids hidden reasoning persistence");

const status = JSON.parse(runCli([
  "panel", "status",
  "--cwd", projectPath,
  "--run", panel.nativeRun.id,
  "--json"
]));
assertEqual(status.id, panel.nativeRun.id, "panel status returns same run id");
assertEqual(status.requestedSurface, "native_workers", "panel status preserves native surface");

const stopped = JSON.parse(runCli([
  "panel", "stop",
  "--cwd", projectPath,
  "--run", panel.nativeRun.id,
  "--json"
]));
assert(stopped.status === "stop_requested" || stopped.status === "stopped", "panel stop records stop-requested or stopped run");
assert(stopped.workers.every((worker) => worker.status === "stopped" || worker.status === "stop_requested" || worker.status === "completed"), "panel stop marks incomplete workers stopped or stop-requested");

const resumed = JSON.parse(runCli([
  "panel", "resume",
  "--cwd", projectPath,
  "--run", panel.nativeRun.id,
  "--json"
]));
assertEqual(resumed.status, "running", "panel resume records running run");
assert(resumed.workers.some((worker) => worker.status === "pending"), "panel resume leaves incomplete workers pending launch");

const teamTmp = mkdtempSync(join(tmpdir(), "longtable-no-public-team-"));
const teamError = assertThrowsSync(
  () => execFileSync("node", [cli, "team", "--cwd", teamTmp, "--prompt", "Review as a team", "--json"], {
    cwd: tmp,
    encoding: "utf8",
    stdio: "pipe"
  }),
  "Unknown command: team",
  "public longtable team remains unavailable"
);
assertEqual(teamError.status, 1, "public longtable team exit code");
assertEqual(teamError.stdout.toString(), "", "public longtable team stdout");
assertEqual(existsSync(join(teamTmp, ".longtable", "team")), false, "public longtable team creates no team artifacts");

console.log("panel workers smoke passed");
