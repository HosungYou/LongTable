import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const { buildPanelFallback } = await import(pathToFileURL(join(repoRoot, "packages", "longtable", "dist", "panel.js")).href);
const {
  createPanelWorkerRun,
  launchPanelWorkerRun,
  readPanelWorkerRun,
  shutdownPanelWorkerRun,
  waitForPanelWorkerRun,
  writePanelWorkerRun
} = await import(pathToFileURL(join(repoRoot, "packages", "longtable", "dist", "panel-runtime.js")).href);
const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
const tmp = mkdtempSync(join(tmpdir(), "longtable-panel-workers-"));
const projectPath = join(tmp, "project");
const setupPath = join(tmp, "setup.json");
const runtimePath = join(tmp, "runtime.toml");
const fakeBin = join(tmp, "fake-bin");
const fakeGitBin = join(tmp, "fake-git-bin");
const fakeTmuxLog = join(tmp, "fake-tmux.log");
const fakeCodexLog = join(tmp, "fake-codex.log");
mkdirSync(fakeBin, { recursive: true });
mkdirSync(fakeGitBin, { recursive: true });

writeFileSync(join(fakeBin, "tmux"), `#!/usr/bin/env node
const { appendFileSync } = require("fs");
const { execSync } = require("child_process");
const log = process.env.LONGTABLE_FAKE_TMUX_LOG;
const args = process.argv.slice(2);
if (log) appendFileSync(log, JSON.stringify(args) + "\\n");
if (args[0] === "split-window" || args[0] === "new-window" || args[0] === "new-session") {
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

writeFileSync(join(fakeGitBin, "git"), `#!/usr/bin/env node
const { spawnSync } = require("child_process");
const realGit = ${JSON.stringify(realGit)};
const args = process.argv.slice(2);
if (
  process.env.LONGTABLE_FAIL_GIT_BRANCH &&
  args[0] === "worktree" &&
  args[1] === "add" &&
  args.includes(process.env.LONGTABLE_FAIL_GIT_BRANCH)
) {
  console.error("simulated worktree branch failure");
  process.exit(128);
}
const result = spawnSync(realGit, args, { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
`);
chmodSync(join(fakeGitBin, "git"), 0o755);

writeFileSync(join(fakeBin, "codex"), `#!/usr/bin/env node
const { appendFileSync, existsSync, readFileSync } = require("fs");
const { join } = require("path");
const log = process.env.LONGTABLE_FAKE_CODEX_LOG;
const args = process.argv.slice(2);
if (log) appendFileSync(log, JSON.stringify(args) + "\\n");
const cwdIndex = args.indexOf("-C");
const workdir = cwdIndex >= 0 ? args[cwdIndex + 1] : process.cwd();
const task = readFileSync(0, "utf8");
const roleMatch = task.match(/Role: (.+) \\(([^)]+)\\)/);
const label = roleMatch?.[1] ?? "Reviewer";
const role = roleMatch?.[2] ?? "reviewer";
const blocked = task.includes("blocked-role-output");
const dirtyPath = join(workdir, "dirty-visible.txt");
const dirtyClaim = existsSync(dirtyPath) ? "dirty-visible:" + readFileSync(dirtyPath, "utf8").trim() : "";
console.log(JSON.stringify({
  role,
  label,
  status: blocked ? "blocked" : "completed",
  summary: blocked
    ? "Fake Codex worker reported a blocked role review."
    : "Fake Codex worker completed a structured role review.",
  claims: blocked ? [] : ["Native worker output was normalized into PanelResult shape.", dirtyClaim].filter(Boolean),
  objections: [],
  openQuestions: blocked ? ["Required evidence is missing."] : [],
  evidenceRefs: ["fake-codex-worker"],
  error: blocked ? "blocked-role-output" : "",
  hiddenReasoning: "hidden-native-worker-chain-should-not-persist",
  rawToolLog: "raw-native-worker-tool-log-should-not-persist"
}, null, 2));
process.exit(0);
`);
chmodSync(join(fakeBin, "codex"), 0o755);

const fakeEnv = {
  ...process.env,
  PATH: `${fakeBin}:${process.env.PATH}`,
  TMUX: process.env.TMUX ?? "/tmp/fake-longtable-tmux,1,0",
  TMUX_PANE: process.env.TMUX_PANE ?? "%fake-leader",
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

function initGitProject(path) {
  execFileSync("git", ["init"], { cwd: path, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "LongTable Smoke"], { cwd: path, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "longtable-smoke@example.invalid"], { cwd: path, stdio: "ignore" });
  execFileSync("git", ["add", "-A"], { cwd: path, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "initial longtable smoke project"], { cwd: path, stdio: "ignore" });
}

async function withFakeRuntimeEnv(callback) {
  const saved = new Map();
  for (const key of ["PATH", "TMUX", "TMUX_PANE", "LONGTABLE_FAIL_GIT_BRANCH"]) {
    saved.set(key, process.env[key]);
  }
  process.env.PATH = fakeEnv.PATH;
  process.env.TMUX = fakeEnv.TMUX;
  process.env.TMUX_PANE = fakeEnv.TMUX_PANE;
  delete process.env.LONGTABLE_FAIL_GIT_BRANCH;
  try {
    return await callback();
  } finally {
    for (const [key, value] of saved.entries()) {
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  }
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

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
}

function assertThrowsSync(fn, expectedMessage, label) {
  try {
    fn();
  } catch (error) {
    const message = [
      error.stdout?.toString(),
      error.stderr?.toString(),
      error.message || String(error)
    ].filter(Boolean).join("\n");
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

writeFileSync(join(projectPath, "dirty-visible.txt"), "committed-baseline\n");
initGitProject(projectPath);
writeFileSync(join(projectPath, "dirty-visible.txt"), "leader-dirty-change\n");

const nonGitProjectPath = join(tmp, "non-git-project");
runCli([
  "start",
  "--setup", setupPath,
  "--path", nonGitProjectPath,
  "--name", "Panel Workers Non Git Smoke",
  "--goal", "Verify native panel worker fail-fast behavior.",
  "--blocker", "Need explicit bridge failure without quiet fallback.",
  "--research-object", "study_design",
  "--gap-risk", "suspected_tacit_assumptions",
  "--protected-decision", "method",
  "--perspectives", "auto",
  "--disagreement", "always_visible",
  "--no-interview",
  "--json"
]);
const failFastPanel = JSON.parse(runCli([
  "panel",
  "--cwd", nonGitProjectPath,
  "--provider", "codex",
  "--native-workers",
  "--wait", "2000",
  "--prompt", "Fail fast when the native worker bridge cannot provision git worktrees.",
  "--json"
]));
assertEqual(failFastPanel.nativeRun.status, "failed", "native worker bridge fails fast without a git workspace");
assertEqual(failFastPanel.nativeRun.bridgeStatus, "preflight_failed", "preflight failure is explicit in bridge status");
assertEqual(failFastPanel.execution.bridgeStatus, "preflight_failed", "preflight failure is explicit in execution summary");
assertIncludes(failFastPanel.nativeRun.bridgeFailureReason, "git:working-directory-unavailable", "preflight failure explains git workspace requirement");
assertEqual(failFastPanel.execution.sequentialFallbackExecuted, false, "failed native worker bridge does not quietly execute sequential fallback");
assertEqual(failFastPanel.recordedPanelResult, null, "failed native worker bridge records no completed panel result");
assert(failFastPanel.nativeRun.workers.every((worker) => worker.executionState === "preflight_failed"), "preflight failure is reflected on every worker");

const outsideWorkspacePath = join(tmp, "outside-longtable-workspace");
mkdirSync(outsideWorkspacePath, { recursive: true });
const codexLogBeforeOutsideWorkspace = existsSync(fakeCodexLog) ? readFileSync(fakeCodexLog, "utf8") : "";
assertThrowsSync(
  () => runCli([
    "panel",
    "--cwd", outsideWorkspacePath,
    "--provider", "codex",
    "--native-workers",
    "--prompt", "Native workers outside a LongTable workspace must fail without fallback."
  ]),
  "native workers require an existing LongTable workspace",
  "non-json native worker request outside a workspace does not fall through to sequential fallback"
);
const codexLogAfterOutsideWorkspace = existsSync(fakeCodexLog) ? readFileSync(fakeCodexLog, "utf8") : "";
assertEqual(codexLogAfterOutsideWorkspace, codexLogBeforeOutsideWorkspace, "non-json missing-workspace native worker request does not invoke codex fallback");

const claudeNativeWorkersPanel = JSON.parse(runCli([
  "panel",
  "--cwd", projectPath,
  "--provider", "claude",
  "--native-workers",
  "--prompt", "Claude provider should not launch LongTable-native Codex workers.",
  "--json"
]));
assertEqual(claudeNativeWorkersPanel.plan.preferredSurface, "sequential_fallback", "Claude native worker flag falls back to sequential panel surface");
assertEqual(claudeNativeWorkersPanel.execution.nativeParallel, "not_requested", "Claude provider does not request native Codex workers");
assertEqual(claudeNativeWorkersPanel.execution.nativeRunCreated, false, "Claude provider native worker flag creates no native worker run");
assertEqual(claudeNativeWorkersPanel.nativeRun, null, "Claude provider native worker flag returns no native run");
runCli(["decide", "--cwd", projectPath, "--question", claudeNativeWorkersPanel.questionRecord.id, "--answer", "defer", "--json"]);

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
assertEqual(panel.nativeRun.bridgeStatus, "completed", "native worker bridge status completes during bounded wait");
assert(panel.recordedPanelResult?.evidenceRecordIds?.length > 0, "completed native worker run records workspace evidence");
assert(panel.nativeRun.workers.length > 0, "native worker tasks are present");
const firstWorker = panel.nativeRun.workers[0];
assert(firstWorker.worktreePath && existsSync(firstWorker.worktreePath), "native worker has a writable worktree");
assert(firstWorker.mailboxPath && existsSync(firstWorker.mailboxPath), "native worker has a mailbox file");
assert(firstWorker.taskStatePath && existsSync(firstWorker.taskStatePath), "native worker has a task lifecycle file");
assertEqual(firstWorker.cleanupStatus, "retained", "completed native worker panes/worktrees are retained until shutdown");
assertEqual(firstWorker.executionState, "result_ready", "completed native worker records result-ready execution state");
assertEqual(firstWorker.runtime?.transport, "tmux", "native worker records tmux runtime transport");
assertEqual(firstWorker.runtime?.splitCommand, "split-window", "native worker records split-window launch");
assertEqual(firstWorker.runtime?.retainPane, true, "native worker records retained pane lifecycle");
assertIncludes(firstWorker.taskPath, firstWorker.worktreePath, "native worker task path is inside the worker worktree");
assertIncludes(firstWorker.resultPath, firstWorker.worktreePath, "native worker result path is inside the worker worktree");
assertIncludes(firstWorker.logPath, firstWorker.worktreePath, "native worker log path is inside the worker worktree");
assertIncludes(firstWorker.launcherPath, firstWorker.worktreePath, "native worker launcher path is inside the worker worktree");
assertIncludes(firstWorker.mailboxPath, firstWorker.worktreePath, "native worker mailbox path is inside the worker worktree");
assertIncludes(firstWorker.taskStatePath, firstWorker.worktreePath, "native worker task state path is inside the worker worktree");
assertIncludes(readFileSync(join(firstWorker.worktreePath, ".longtable-worker", `${firstWorker.id}.json`), "utf8"), panel.nativeRun.id, "native worker worktree receives lifecycle marker");
const runFile = join(projectPath, ".longtable", "panel-runs", panel.nativeRun.id, "run.json");
assert(existsSync(runFile), "native worker run file exists");
assert(existsSync(panel.nativeRun.aggregateResultPath), "native worker aggregate panel result exists");
const aggregateResultText = readFileSync(panel.nativeRun.aggregateResultPath, "utf8");
assertIncludes(aggregateResultText, "fake-codex-worker", "native worker aggregate preserves evidence refs");
assertIncludes(aggregateResultText, "dirty-visible:leader-dirty-change", "native worker sees tracked leader workspace changes in its worktree");
assertNotIncludes(aggregateResultText, "hidden-native-worker-chain-should-not-persist", "native worker aggregate strips hidden reasoning");
assertNotIncludes(aggregateResultText, "raw-native-worker-tool-log-should-not-persist", "native worker aggregate strips raw tool logs");
const rawWorkerResultText = readFileSync(firstWorker.resultPath, "utf8");
assertNotIncludes(rawWorkerResultText, "hidden-native-worker-chain-should-not-persist", "raw worker result strips hidden reasoning");
assertNotIncludes(rawWorkerResultText, "raw-native-worker-tool-log-should-not-persist", "raw worker result strips raw tool logs");
const outputSchema = JSON.parse(readFileSync(panel.nativeRun.outputSchemaPath, "utf8"));
for (const key of Object.keys(outputSchema.properties)) {
  assert(outputSchema.required.includes(key), `strict output schema requires ${key}`);
}
const firstTask = panel.nativeRun.workers[0].taskPath;
assertIncludes(readFileSync(firstTask, "utf8"), "Do not expose or persist hidden reasoning", "task forbids hidden reasoning persistence");
assertIncludes(readFileSync(firstTask, "utf8"), '"error":""', "task includes strict-schema error field");
const tmuxLog = readFileSync(fakeTmuxLog, "utf8");
assertIncludes(tmuxLog, "split-window", "tmux split-window launch was requested");
assertNotIncludes(tmuxLog, "new-window", "tmux new-window launch is not used");
const codexLog = readFileSync(fakeCodexLog, "utf8");
assertIncludes(codexLog, "exec", "codex exec was requested");
assertIncludes(codexLog, "workspace-write", "codex exec grants workspace-write to worker worktrees");
assertNotIncludes(codexLog, "read-only", "codex exec no longer uses read-only sandbox");
assert(!codexLog.includes('"-o"'), "codex exec does not write result files from inside the worker sandbox");
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
assertEqual(status.execution.bridgeStatus, "completed", "panel status execution summary preserves completed bridge status");
const handoff = JSON.parse(runCli(["handoff", "--cwd", projectPath, "--json"]));
const handoffText = readFileSync(handoff.path, "utf8");
assertIncludes(handoffText, "Native worker note", "handoff includes native worker guidance");
assertIncludes(handoffText, "fake-codex-worker", "handoff preserves native worker evidence refs");
runCli(["decide", "--cwd", projectPath, "--question", panel.questionRecord.id, "--answer", "defer", "--json"]);

const blockedPanel = JSON.parse(runCli([
  "panel",
  "--cwd", projectPath,
  "--provider", "codex",
  "--native-workers",
  "--wait", "2000",
  "--prompt", "Return a blocked-role-output from the native workers.",
  "--json"
]));
assertEqual(blockedPanel.nativeRun.status, "blocked", "blocked worker output keeps native run blocked");
assertEqual(blockedPanel.recordedPanelResult.status, "blocked", "blocked worker output records blocked panel status");
assert(blockedPanel.nativeRun.workers.every((worker) => worker.status === "blocked"), "blocked worker outputs are not collapsed to completed");
const blockedAggregateText = readFileSync(blockedPanel.nativeRun.aggregateResultPath, "utf8");
assertIncludes(blockedAggregateText, "Required evidence is missing.", "blocked aggregate preserves worker open question");
assertNotIncludes(blockedAggregateText, "hidden-native-worker-chain-should-not-persist", "blocked aggregate strips hidden reasoning");
assertNotIncludes(blockedAggregateText, "raw-native-worker-tool-log-should-not-persist", "blocked aggregate strips raw tool logs");
const blockedHandoff = JSON.parse(runCli(["handoff", "--cwd", projectPath, "--json"]));
const blockedHandoffText = readFileSync(blockedHandoff.path, "utf8");
assertIncludes(blockedHandoffText, "Native worker note", "blocked handoff includes native worker guidance");
assertIncludes(blockedHandoffText, "blocked", "blocked handoff preserves blocked panel status");
assertIncludes(blockedHandoffText, "Required evidence is missing.", "blocked handoff preserves blocked worker question");
assertIncludes(blockedHandoffText, "fake-codex-worker", "blocked handoff preserves native worker evidence refs");
runCli(["decide", "--cwd", projectPath, "--question", blockedPanel.questionRecord.id, "--answer", "defer", "--json"]);

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
for (const worker of stopped.workers) {
  writeFileSync(worker.resultPath, JSON.stringify({
    role: worker.role,
    label: worker.label,
    status: "completed",
    summary: "stale-before-resume",
    claims: ["stale-before-resume"],
    objections: [],
    openQuestions: [],
    evidenceRefs: [],
    error: ""
  }, null, 2));
}

const resumed = JSON.parse(runCli([
  "panel", "resume",
  "--cwd", projectPath,
  "--run", stoppablePanel.nativeRun.id,
  "--wait", "2000",
  "--json"
]));
assertEqual(resumed.status, "completed", "panel resume relaunches pending workers and waits for completion");
assert(resumed.workers.every((worker) => worker.status === "completed"), "panel resume completes all relaunched workers");
const resumedAggregateText = readFileSync(resumed.aggregateResultPath, "utf8");
assertNotIncludes(resumedAggregateText, "stale-before-resume", "panel resume ignores stale worker results from prior attempts");
const resumedWorktrees = resumed.workers.map((worker) => worker.worktreePath).filter(Boolean);
const shutdown = JSON.parse(runCli([
  "panel", "shutdown",
  "--cwd", projectPath,
  "--run", stoppablePanel.nativeRun.id,
  "--json"
]));
assertEqual(shutdown.status, "stopped", "panel shutdown transitions the run to stopped after cleanup");
assertEqual(shutdown.bridgeStatus, "shutdown", "panel shutdown records bridge shutdown status");
assertEqual(shutdown.execution.bridgeStatus, "shutdown", "panel shutdown execution summary preserves shutdown bridge status");
assert(shutdown.workers.every((worker) => worker.cleanupStatus === "removed"), "panel shutdown removes worker worktrees");
for (const worktreePath of resumedWorktrees) {
  assertEqual(existsSync(worktreePath), false, "panel shutdown removes the writable worker worktree from disk");
}

await withFakeRuntimeEnv(async () => {
  const legacyFallback = buildPanelFallback({
    prompt: "Verify legacy resumable runs normalize worker artifact paths into worktrees.",
    provider: "codex",
    roleFlag: "reviewer",
    visibility: "always_visible",
    nativeWorkers: true
  });
  const legacyRun = await createPanelWorkerRun({
    workingDirectory: projectPath,
    fallback: legacyFallback,
    initialStatus: "planned"
  });
  const legacyWorker = legacyRun.workers[0];
  await writePanelWorkerRun({
    ...legacyRun,
    status: "stopped",
    workers: [{
      ...legacyWorker,
      status: "stopped",
      taskPath: join(legacyRun.taskDirectory, `${legacyWorker.id}.md`),
      resultPath: join(legacyRun.resultDirectory, `${legacyWorker.id}.json`),
      logPath: join(legacyRun.logDirectory, `${legacyWorker.id}.log`),
      launcherPath: join(legacyRun.launcherDirectory, `${legacyWorker.id}.sh`),
      exitCodePath: join(legacyRun.resultDirectory, `${legacyWorker.id}.exit.json`),
      mailboxPath: join(legacyRun.mailboxDirectory, `${legacyWorker.id}.jsonl`),
      taskStatePath: join(legacyRun.taskDirectory, `${legacyWorker.id}.state.json`)
    }]
  });
  const normalizedLegacyRun = await readPanelWorkerRun(projectPath, legacyRun.id);
  const normalizedLegacyWorker = normalizedLegacyRun.workers[0];
  assertIncludes(normalizedLegacyWorker.taskPath, normalizedLegacyWorker.worktreePath, "legacy stopped run task path normalizes into worker worktree");
  assertIncludes(normalizedLegacyWorker.resultPath, normalizedLegacyWorker.worktreePath, "legacy stopped run result path normalizes into worker worktree");

  const collisionFallback = buildPanelFallback({
    prompt: "Verify a pre-existing worker branch does not block worktree provisioning.",
    provider: "codex",
    roleFlag: "reviewer",
    visibility: "always_visible",
    nativeWorkers: true
  });
  const collisionRun = await createPanelWorkerRun({
    workingDirectory: projectPath,
    fallback: collisionFallback,
    initialStatus: "planned"
  });
  for (const worker of collisionRun.workers) {
    execFileSync("git", ["branch", worker.worktreeBranch, "HEAD"], { cwd: projectPath, stdio: "ignore" });
  }
  const launched = await launchPanelWorkerRun(collisionRun);
  const completed = await waitForPanelWorkerRun(launched, 2000);
  assertEqual(completed.status, "completed", "pre-existing worker branch collision is recovered by attaching the worktree to the branch");
  assert(completed.workers.every((worker) => worker.status === "completed"), "branch collision recovery completes all workers");
  assert(completed.workers.every((worker) => worker.worktreeCommit), "branch collision recovery records worker commits");
  await shutdownPanelWorkerRun(completed);
});

await withFakeRuntimeEnv(async () => {
  const partialFallback = buildPanelFallback({
    prompt: "Verify partial worktree provisioning failure stays explicit.",
    provider: "codex",
    roleFlag: "reviewer,methods_critic",
    visibility: "always_visible",
    nativeWorkers: true
  });
  const partialRun = await createPanelWorkerRun({
    workingDirectory: projectPath,
    fallback: partialFallback,
    initialStatus: "planned"
  });
  process.env.PATH = `${fakeGitBin}:${fakeEnv.PATH}`;
  process.env.LONGTABLE_FAIL_GIT_BRANCH = partialRun.workers[1].worktreeBranch;
  const launched = await launchPanelWorkerRun(partialRun);
  const failed = await waitForPanelWorkerRun(launched, 2000);
  assertEqual(failed.status, "failed", "partial worktree provisioning failure leaves the run failed");
  assertEqual(failed.bridgeStatus, "failed", "partial provisioning failure is explicit in bridge status");
  assertEqual(failed.workers[0].status, "completed", "partial provisioning preserves completed worker output");
  assertEqual(failed.workers[1].status, "failed", "partial provisioning marks the failing worker failed");
  assertEqual(failed.workers[1].executionState, "provision_failed", "partial provisioning records provision failure state");
  assert(failed.bridgeFailureReason, "partial provisioning failure records bridge failure reason");
  await shutdownPanelWorkerRun(failed);
});

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
