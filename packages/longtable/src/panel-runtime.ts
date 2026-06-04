import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { appendFile, chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  PanelMemberResult,
  PanelResult,
  PanelWorkerRecord,
  PanelWorkerRun,
  PanelWorkerRunStatus,
  PanelWorkerStatus
} from "@longtable/core";
import type { PanelFallback } from "./panel.js";

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function commandAvailable(command: string): boolean {
  try {
    execFileSync("sh", ["-lc", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function appendDiagnostic(existing: string[], diagnostic: string): string[] {
  return existing.includes(diagnostic) ? existing : [...existing, diagnostic];
}

function panelRunsDirectory(workingDirectory: string): string {
  return join(workingDirectory, ".longtable", "panel-runs");
}

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._/-]/g, "-").replace(/\/+/g, "/").slice(0, 180);
}

function workerSafeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 80);
}

function gitOutput(workingDirectory: string, args: string[]): string {
  return execFileSync("git", args, { cwd: workingDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function currentGitCommit(workingDirectory: string): string | undefined {
  try {
    return gitOutput(workingDirectory, ["rev-parse", "HEAD"]);
  } catch {
    return undefined;
  }
}

async function appendLifecycleEvent(
  run: PanelWorkerRun,
  event: { workerId?: string; type: NonNullable<PanelWorkerRun["workers"][number]["executionState"]> | "run_created" | "preflight_failed" | "worktree_provisioned" | "worker_launched" | "worker_result" | "worker_failed" | "stop_requested" | "resume_requested" | "shutdown_requested" | "cleanup_failed"; message: string; path?: string }
): Promise<void> {
  if (!run.eventLogPath) {
    return;
  }
  await mkdir(dirname(run.eventLogPath), { recursive: true });
  await appendFile(run.eventLogPath, `${JSON.stringify({ id: createId("event"), createdAt: nowIso(), ...event })}\n`, "utf8");
}

export function panelWorkerRunDirectory(workingDirectory: string, runId: string): string {
  return join(panelRunsDirectory(workingDirectory), runId);
}

export function panelWorkerRunPath(workingDirectory: string, runId: string): string {
  return join(panelWorkerRunDirectory(workingDirectory, runId), "run.json");
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
}

function workerRuntimeDirectory(worker: PanelWorkerRecord): string {
  return join(worker.worktreePath ?? dirname(worker.resultPath), ".longtable-worker");
}

function workerRuntimePaths(worktreePath: string): {
  taskPath: string;
  resultPath: string;
  logPath: string;
  launcherPath: string;
  exitCodePath: string;
  mailboxPath: string;
  taskStatePath: string;
} {
  const workerDirectory = join(worktreePath, ".longtable-worker");
  return {
    taskPath: join(workerDirectory, "task.md"),
    resultPath: join(workerDirectory, "result.json"),
    logPath: join(workerDirectory, "worker.log"),
    launcherPath: join(workerDirectory, "launch.sh"),
    exitCodePath: join(workerDirectory, "result.exit.json"),
    mailboxPath: join(workerDirectory, "mailbox.jsonl"),
    taskStatePath: join(workerDirectory, "state.json")
  };
}

function shouldNormalizeWorkerRuntimePaths(run: PanelWorkerRun, worker: PanelWorkerRecord): boolean {
  if (worker.status === "completed" || worker.status === "blocked" || worker.status === "running") {
    return false;
  }
  return run.status === "planned" ||
    run.status === "failed" ||
    run.status === "stopped" ||
    run.status === "stop_requested" ||
    run.status === "resumable";
}

function workerTaskPrompt(run: PanelWorkerRun, worker: PanelWorkerRecord): string {
  return [
    "LongTable native panel worker",
    "",
    `Role: ${worker.label} (${worker.role})`,
    `Invocation: ${run.invocationId}`,
    `Panel plan: ${run.planId}`,
    "",
    "Instructions:",
    "- Work inside the assigned writable worker worktree; do not mutate the leader checkout directly.",
    "- Do not expose or persist hidden reasoning, private tool traces, or chain-of-thought.",
    "- Persist only the structured final role output to the result path below.",
    "- Return JSON matching this shape:",
    "  {\"role\":\"...\",\"label\":\"...\",\"status\":\"completed\",\"summary\":\"...\",\"claims\":[],\"objections\":[],\"openQuestions\":[],\"evidenceRefs\":[],\"error\":\"\"}",
    "",
    `Result path: ${worker.resultPath}`,
    `Log path: ${worker.logPath}`,
    worker.worktreePath ? `Writable worker worktree: ${worker.worktreePath}` : "",
    worker.mailboxPath ? `Worker mailbox: ${worker.mailboxPath}` : "",
    worker.taskStatePath ? `Worker task lifecycle state: ${worker.taskStatePath}` : "",
    "",
    "Research object:",
    run.prompt
  ].join("\n");
}

const PANEL_WORKER_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["role", "label", "status", "summary", "claims", "objections", "openQuestions", "evidenceRefs", "error"],
  properties: {
    role: { type: "string" },
    label: { type: "string" },
    status: { enum: ["completed", "blocked", "error"] },
    summary: { type: "string" },
    claims: { type: "array", items: { type: "string" } },
    objections: { type: "array", items: { type: "string" } },
    openQuestions: { type: "array", items: { type: "string" } },
    evidenceRefs: { type: "array", items: { type: "string" } },
    error: { type: "string" }
  }
};

function launcherScript(run: PanelWorkerRun, worker: PanelWorkerRecord): string {
  const role = shellQuote(worker.role);
  const label = shellQuote(worker.label);
  const stdoutPath = `${worker.resultPath}.stdout`;
  const worktreePath = worker.worktreePath ?? run.workingDirectory;
  const commitPath = `${worker.resultPath}.commit`;
  return [
    "#!/usr/bin/env bash",
    "set +e",
    `printf 'started_at=%s\\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" > ${shellQuote(worker.logPath)}`,
    `mkdir -p ${shellQuote(join(worktreePath, ".longtable-worker"))}`,
    `printf '{"workerId":%s,"runId":%s,"startedAt":"%s"}\\n' ${shellQuote(JSON.stringify(worker.id))} ${shellQuote(JSON.stringify(run.id))} "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" > ${shellQuote(join(worktreePath, ".longtable-worker", `${worker.id}.json`))}`,
    `if [ -f ${shellQuote(run.stopFilePath)} ]; then`,
    `  printf 'stop_requested_before_launch\\n' >> ${shellQuote(worker.logPath)}`,
    "  exit 0",
    "fi",
    [
      "codex exec",
      "-s workspace-write",
      `-C ${shellQuote(worktreePath)}`,
      "--skip-git-repo-check",
      `--output-schema ${shellQuote(run.outputSchemaPath)}`,
      "-",
      `< ${shellQuote(worker.taskPath)}`,
      `> ${shellQuote(stdoutPath)} 2>/dev/null`
    ].join(" "),
    "code=$?",
    `if [ -s ${shellQuote(stdoutPath)} ]; then`,
    `  node -e 'const fs=require("fs"); const [stdoutPath,resultPath]=process.argv.slice(1); const parsed=JSON.parse(fs.readFileSync(stdoutPath,"utf8").trim()); const strings=(value)=>Array.isArray(value)?value.filter((entry)=>typeof entry==="string"):[]; const status=["completed","blocked","error"].includes(parsed.status)?parsed.status:"error"; const sanitized={role:typeof parsed.role==="string"?parsed.role:"",label:typeof parsed.label==="string"?parsed.label:"",status,summary:typeof parsed.summary==="string"?parsed.summary:"",claims:strings(parsed.claims),objections:strings(parsed.objections),openQuestions:strings(parsed.openQuestions),evidenceRefs:strings(parsed.evidenceRefs),error:typeof parsed.error==="string"?parsed.error:""}; fs.writeFileSync(resultPath, JSON.stringify(sanitized, null, 2)+"\\n");' ${shellQuote(stdoutPath)} ${shellQuote(worker.resultPath)}`,
    "  parse_code=$?",
    `  rm -f ${shellQuote(stdoutPath)}`,
    `  if [ "$parse_code" -ne 0 ]; then code=1; fi`,
    "fi",
    `printf '{"exitCode":%s,"completedAt":"%s"}\\n' "$code" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" > ${shellQuote(worker.exitCodePath ?? `${worker.resultPath}.exit.json`)}`,
    `printf 'exit_code=%s\\n' "$code" >> ${shellQuote(worker.logPath)}`,
    `if [ "$code" -ne 0 ] && [ ! -s ${shellQuote(worker.resultPath)} ]; then`,
    `  node -e 'const fs=require("fs"); const [path,role,label,code]=process.argv.slice(1); fs.writeFileSync(path, JSON.stringify({role,label,status:"error",summary:"",claims:[],objections:[],openQuestions:[],evidenceRefs:[],error:\`codex exec exited ${"${code}"}\`}, null, 2)+"\\n");' ${shellQuote(worker.resultPath)} ${role} ${label} "$code"`,
    "fi",
    `if git -C ${shellQuote(worktreePath)} status --porcelain >/tmp/longtable-worker-status.$$ 2>/dev/null && [ -s /tmp/longtable-worker-status.$$ ]; then`,
    `  git -C ${shellQuote(worktreePath)} add -A >/dev/null 2>&1`,
    `  git -C ${shellQuote(worktreePath)} -c user.name='LongTable Panel Worker' -c user.email='longtable-panel-worker@example.invalid' commit -m ${shellQuote(`longtable panel worker ${worker.id}`)} >/dev/null 2>&1`,
    "fi",
    `rm -f /tmp/longtable-worker-status.$$`,
    `git -C ${shellQuote(worktreePath)} rev-parse HEAD > ${shellQuote(commitPath)} 2>/dev/null`,
    "exit $code",
    ""
  ].join("\n");
}

function plannedWorkerStatus(runStatus: PanelWorkerRunStatus): PanelWorkerStatus {
  return runStatus === "planned" ? "pending" : "running";
}

export async function createPanelWorkerRun(options: {
  workingDirectory: string;
  fallback: PanelFallback;
  initialStatus?: PanelWorkerRunStatus;
  diagnostics?: string[];
}): Promise<PanelWorkerRun> {
  const createdAt = nowIso();
  const runId = createId("panel_run");
  const runDirectory = panelWorkerRunDirectory(options.workingDirectory, runId);
  const taskDirectory = join(runDirectory, "tasks");
  const resultDirectory = join(runDirectory, "results");
  const logDirectory = join(runDirectory, "logs");
  const launcherDirectory = join(runDirectory, "launchers");
  const worktreeDirectory = join(runDirectory, "worktrees");
  const mailboxDirectory = join(runDirectory, "mailbox");
  await mkdir(runDirectory, { recursive: true });
  await mkdir(worktreeDirectory, { recursive: true });

  const runStatus = options.initialStatus ?? "planned";
  const workers: PanelWorkerRecord[] = options.fallback.plan.members.map((member, index) => {
    const workerId = `worker-${index + 1}-${member.role}`;
    const worktreePath = join(worktreeDirectory, workerSafeName(workerId));
    const paths = workerRuntimePaths(worktreePath);
    return {
      id: workerId,
      role: member.role,
      label: member.label,
      required: member.required,
      status: plannedWorkerStatus(runStatus),
      taskPath: paths.taskPath,
      resultPath: paths.resultPath,
      logPath: paths.logPath,
      launcherPath: paths.launcherPath,
      exitCodePath: paths.exitCodePath,
      worktreePath,
      worktreeBranch: safeName(`longtable/panel/${runId}/${workerId}`),
      mailboxPath: paths.mailboxPath,
      taskStatePath: paths.taskStatePath,
      cleanupStatus: "not_started",
      executionState: "not_started",
      updatedAt: createdAt,
      diagnostics: []
    };
  });

  const run: PanelWorkerRun = {
    schemaVersion: 1,
    id: runId,
    createdAt,
    updatedAt: createdAt,
    invocationId: options.fallback.invocationRecord.id,
    planId: options.fallback.plan.id,
    provider: options.fallback.invocationRecord.provider,
    prompt: options.fallback.plan.prompt,
    mode: options.fallback.plan.mode,
    visibility: options.fallback.plan.visibility,
    requestedSurface: "native_workers",
    fallbackSurface: "sequential_fallback",
    status: runStatus,
    workingDirectory: options.workingDirectory,
    runDirectory,
    taskDirectory,
    resultDirectory,
    logDirectory,
    launcherDirectory,
    worktreeDirectory,
    mailboxDirectory,
    eventLogPath: join(runDirectory, "events.jsonl"),
    outputSchemaPath: join(runDirectory, "panel-worker-output.schema.json"),
    stopFilePath: join(runDirectory, "stop-requested"),
    aggregateResultPath: join(runDirectory, "panel-result.json"),
    bridgeStatus: runStatus === "planned" ? "not_requested" : "running",
    sequentialFallbackAvailable: true,
    workers,
    diagnostics: options.diagnostics ?? []
  };

  await writeJsonAtomic(join(runDirectory, "schema.json"), {
    schemaVersion: 1,
    kind: "longtable.panelWorkerRun",
    note: "Durable worker state stores task/status/result metadata, not hidden reasoning or raw tool traces."
  });
  await writeJsonAtomic(run.outputSchemaPath, PANEL_WORKER_OUTPUT_SCHEMA);
  await appendLifecycleEvent(run, { type: "run_created", message: "LongTable native worker bridge run created." });
  await writePanelWorkerRun(run);
  return run;
}

export async function readPanelWorkerRun(workingDirectory: string, runId: string): Promise<PanelWorkerRun> {
  return normalizePanelWorkerRun(JSON.parse(await readFile(panelWorkerRunPath(workingDirectory, runId), "utf8")) as PanelWorkerRun);
}

function normalizePanelWorkerRun(run: PanelWorkerRun): PanelWorkerRun {
  const launcherDirectory = run.launcherDirectory ?? join(run.runDirectory, "launchers");
  const resultDirectory = run.resultDirectory ?? join(run.runDirectory, "results");
  const worktreeDirectory = run.worktreeDirectory ?? join(run.runDirectory, "worktrees");
  const mailboxDirectory = run.mailboxDirectory ?? join(run.runDirectory, "mailbox");
  return {
    ...run,
    launcherDirectory,
    worktreeDirectory,
    mailboxDirectory,
    eventLogPath: run.eventLogPath ?? join(run.runDirectory, "events.jsonl"),
    bridgeStatus: run.bridgeStatus ?? bridgeStatusFromRunStatus(run.status),
    sequentialFallbackAvailable: run.sequentialFallbackAvailable ?? true,
    outputSchemaPath: run.outputSchemaPath ?? join(run.runDirectory, "panel-worker-output.schema.json"),
    stopFilePath: run.stopFilePath ?? join(run.runDirectory, "stop-requested"),
    workers: run.workers.map((worker) => {
      const worktreePath = worker.worktreePath ?? join(worktreeDirectory, workerSafeName(worker.id));
      const runtimePaths = workerRuntimePaths(worktreePath);
      const normalizePaths = shouldNormalizeWorkerRuntimePaths(run, worker);
      return {
        ...worker,
        taskPath: normalizePaths ? runtimePaths.taskPath : worker.taskPath,
        resultPath: normalizePaths ? runtimePaths.resultPath : worker.resultPath,
        logPath: normalizePaths ? runtimePaths.logPath : worker.logPath,
        launcherPath: normalizePaths ? runtimePaths.launcherPath : worker.launcherPath ?? join(launcherDirectory, `${worker.id}.sh`),
        exitCodePath: normalizePaths ? runtimePaths.exitCodePath : worker.exitCodePath ?? join(resultDirectory, `${worker.id}.exit.json`),
        worktreePath,
        worktreeBranch: worker.worktreeBranch ?? safeName(`longtable/panel/${run.id}/${worker.id}`),
        mailboxPath: normalizePaths ? runtimePaths.mailboxPath : worker.mailboxPath ?? join(mailboxDirectory, `${worker.id}.jsonl`),
        taskStatePath: normalizePaths ? runtimePaths.taskStatePath : worker.taskStatePath ?? join(run.taskDirectory, `${worker.id}.state.json`),
        cleanupStatus: worker.cleanupStatus ?? "not_started",
        executionState: worker.executionState ?? "not_started",
        diagnostics: worker.diagnostics ?? []
      };
    })
  };
}

export async function writePanelWorkerRun(run: PanelWorkerRun): Promise<void> {
  await writeJsonAtomic(join(run.runDirectory, "run.json"), {
    ...run,
    updatedAt: nowIso()
  });
  await Promise.all(run.workers.map((worker) => worker.taskStatePath
    && existsSync(dirname(worker.taskStatePath))
    && (!worker.worktreePath || existsSync(worker.worktreePath))
    ? writeJsonAtomic(worker.taskStatePath, {
        workerId: worker.id,
        status: worker.status,
        executionState: worker.executionState,
        paneId: worker.paneId,
        runtime: worker.runtime,
        worktreePath: worker.worktreePath,
        worktreeBranch: worker.worktreeBranch,
        worktreeCommit: worker.worktreeCommit,
        cleanupStatus: worker.cleanupStatus,
        failureReason: worker.failureReason,
        error: worker.error,
        updatedAt: worker.updatedAt
      })
    : Promise.resolve()));
}

function parseWorkerResult(worker: PanelWorkerRecord): PanelMemberResult | null {
  if (!existsSync(worker.resultPath)) {
    return null;
  }
  const parsed = JSON.parse(readFileSyncUtf8(worker.resultPath)) as Partial<PanelMemberResult>;
  const roleMismatch = typeof parsed.role === "string" && parsed.role !== worker.role;
  const labelMismatch = typeof parsed.label === "string" && parsed.label !== worker.label;
  const identityError = [
    roleMismatch ? `role mismatch: expected ${worker.role}, received ${parsed.role}` : "",
    labelMismatch ? `label mismatch: expected ${worker.label}, received ${parsed.label}` : ""
  ].filter(Boolean).join("; ");
  return {
    role: worker.role,
    label: worker.label,
    status: identityError ? "error" : parsed.status ?? "completed",
    summary: parsed.summary,
    claims: parsed.claims,
    objections: parsed.objections,
    openQuestions: parsed.openQuestions,
    evidenceRefs: parsed.evidenceRefs,
    error: identityError || parsed.error
  };
}

function readFileSyncUtf8(path: string): string {
  return readFileSync(path, "utf8");
}

function statusFromWorkers(workers: PanelWorkerRecord[]): PanelWorkerRunStatus {
  if (workers.every((worker) => worker.status === "completed")) {
    return "completed";
  }
  if (workers.some((worker) => worker.status === "running")) {
    return "running";
  }
  if (workers.some((worker) => worker.status === "failed")) {
    return "failed";
  }
  if (workers.some((worker) => worker.status === "blocked")) {
    return "blocked";
  }
  if (workers.some((worker) => worker.status === "stop_requested")) {
    return "stop_requested";
  }
  if (workers.every((worker) => worker.status === "stopped" || worker.status === "completed")) {
    return "stopped";
  }
  return "running";
}

function bridgeStatusFromRunStatus(status: PanelWorkerRunStatus): NonNullable<PanelWorkerRun["bridgeStatus"]> {
  return status === "planned" || status === "resumable" ? "not_requested" : status;
}

function bridgeStatusFromWorkers(
  status: PanelWorkerRunStatus,
  workers: PanelWorkerRecord[]
): NonNullable<PanelWorkerRun["bridgeStatus"]> {
  if (status === "failed" && workers.every((worker) => worker.executionState === "preflight_failed")) {
    return "preflight_failed";
  }
  return bridgeStatusFromRunStatus(status);
}

function tmuxPaneAlive(paneId: string): boolean {
  if (!commandAvailable("tmux")) {
    return false;
  }
  try {
    execFileSync("tmux", ["display-message", "-p", "-t", paneId, "#{pane_id}"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function terminalStatus(status: PanelWorkerRunStatus): boolean {
  return status === "completed" || status === "blocked" || status === "stopped" || status === "degraded" || status === "failed";
}

function preflightNativeWorkerBridge(run: PanelWorkerRun): string[] {
  const failures = [
    commandAvailable("tmux") ? null : "tmux:unavailable",
    commandAvailable("codex") ? null : "codex:unavailable",
    commandAvailable("git") ? null : "git:unavailable"
  ].filter((entry): entry is string => Boolean(entry));
  if (!process.env.TMUX && !process.env.TMUX_PANE) {
    failures.push("tmux:attached-pane-unavailable");
  }
  try {
    execFileSync("tmux", ["display-message", "-p", "#{pane_id}"], { stdio: "ignore" });
  } catch {
    failures.push("tmux:current-pane-unavailable");
  }
  try {
    gitOutput(run.workingDirectory, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    failures.push("git:working-directory-unavailable");
  }
  return failures;
}

function applyLeaderTrackedChanges(run: PanelWorkerRun, worker: PanelWorkerRecord): string | undefined {
  if (!worker.worktreePath) {
    return undefined;
  }
  const patch = execFileSync("git", ["diff", "--binary", "HEAD"], {
    cwd: run.workingDirectory,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (patch.length === 0) {
    return undefined;
  }
  try {
    execFileSync("git", ["apply", "--check", "--whitespace=nowarn", "-"], {
      cwd: worker.worktreePath,
      input: patch,
      stdio: ["pipe", "ignore", "pipe"]
    });
    execFileSync("git", ["apply", "--whitespace=nowarn", "-"], {
      cwd: worker.worktreePath,
      input: patch,
      stdio: ["pipe", "ignore", "pipe"]
    });
    return "Leader tracked workspace changes were applied to the worker worktree before launch.";
  } catch (error) {
    try {
      execFileSync("git", ["apply", "--reverse", "--check", "--whitespace=nowarn", "-"], {
        cwd: worker.worktreePath,
        input: patch,
        stdio: ["pipe", "ignore", "pipe"]
      });
      return "Leader tracked workspace changes were already present in the worker worktree before launch.";
    } catch {
      throw error;
    }
  }
}

async function markBridgePreflightFailed(run: PanelWorkerRun, failures: string[]): Promise<PanelWorkerRun> {
  const updatedAt = nowIso();
  const reason = failures.join(", ");
  const nextRun: PanelWorkerRun = {
    ...run,
    status: "failed",
    bridgeStatus: "preflight_failed",
    bridgeFailureReason: reason,
    updatedAt,
    diagnostics: [...run.diagnostics, ...failures, "Native worker bridge preflight failed; sequential fallback was not executed implicitly."],
    workers: run.workers.map((worker) => ({
      ...worker,
      status: worker.status === "completed" ? worker.status : "failed",
      executionState: "preflight_failed",
      failureReason: reason,
      error: reason,
      updatedAt,
      diagnostics: appendDiagnostic(worker.diagnostics, "Native worker bridge preflight failed before launch.")
    }))
  };
  await appendLifecycleEvent(nextRun, { type: "preflight_failed", message: reason });
  await writePanelWorkerRun(nextRun);
  return nextRun;
}

async function provisionWorkerWorktree(run: PanelWorkerRun, worker: PanelWorkerRecord): Promise<PanelWorkerRecord> {
  if (!worker.worktreePath || !worker.worktreeBranch) {
    throw new Error(`missing worktree metadata for ${worker.id}`);
  }
  await mkdir(dirname(worker.worktreePath), { recursive: true });
  if (!existsSync(worker.worktreePath)) {
    try {
      gitOutput(run.workingDirectory, ["worktree", "add", worker.worktreePath, "-b", worker.worktreeBranch, "HEAD"]);
    } catch (firstError) {
      try {
        gitOutput(run.workingDirectory, ["worktree", "add", worker.worktreePath, worker.worktreeBranch]);
      } catch {
        throw firstError;
      }
    }
  }
  const commit = currentGitCommit(worker.worktreePath);
  const snapshotDiagnostic = applyLeaderTrackedChanges(run, worker);
  await mkdir(workerRuntimeDirectory(worker), { recursive: true });
  await writeFile(worker.mailboxPath ?? join(workerRuntimeDirectory(worker), "mailbox.jsonl"), "", { flag: "a" });
  await appendLifecycleEvent(run, {
    workerId: worker.id,
    type: "worktree_provisioned",
    message: `Worker worktree provisioned at ${worker.worktreePath}.`,
    path: worker.worktreePath
  });
  return {
    ...worker,
    worktreeCommit: commit,
    cleanupStatus: "retained",
    executionState: "provisioned",
    diagnostics: snapshotDiagnostic
      ? appendDiagnostic(
          appendDiagnostic(worker.diagnostics, "Writable git worktree provisioned for LongTable native worker."),
          snapshotDiagnostic
        )
      : appendDiagnostic(worker.diagnostics, "Writable git worktree provisioned for LongTable native worker.")
  };
}

async function writeWorkerTask(run: PanelWorkerRun, worker: PanelWorkerRecord): Promise<void> {
  await mkdir(workerRuntimeDirectory(worker), { recursive: true });
  await writeFile(worker.taskPath, workerTaskPrompt(run, worker), "utf8");
}

async function clearWorkerAttemptArtifacts(worker: PanelWorkerRecord): Promise<void> {
  const paths = [
    worker.resultPath,
    `${worker.resultPath}.stdout`,
    `${worker.resultPath}.commit`,
    worker.exitCodePath,
    worker.logPath
  ].filter((path): path is string => typeof path === "string" && path.length > 0);
  await Promise.all(paths.map((path) => rm(path, { force: true })));
}

function launchWorkerPane(run: PanelWorkerRun, worker: PanelWorkerRecord): string {
  const command = `cd ${shellQuote(worker.worktreePath ?? run.workingDirectory)} && bash ${shellQuote(worker.launcherPath!)}`;
  const args = [
    "split-window",
    "-d",
    "-P",
    "-F",
    "#{pane_id}"
  ];
  if (process.env.TMUX_PANE) {
    args.push("-t", process.env.TMUX_PANE);
  }
  args.push(command);
  const paneId = execFileSync("tmux", args, { encoding: "utf8" }).trim();
  if (paneId) {
    try {
      execFileSync("tmux", ["set-option", "-p", "-t", paneId, "remain-on-exit", "on"], { stdio: "ignore" });
    } catch {
      // Pane retention is best-effort on older tmux versions; the pane id is still recorded.
    }
  }
  return paneId;
}

async function writeWorkerLauncher(run: PanelWorkerRun, worker: PanelWorkerRecord): Promise<void> {
  if (!worker.launcherPath) {
    return;
  }
  await writeFile(worker.launcherPath, launcherScript(run, worker), "utf8");
  await chmod(worker.launcherPath, 0o755);
}

export async function launchPanelWorkerRun(run: PanelWorkerRun): Promise<PanelWorkerRun> {
  if (terminalStatus(run.status) || run.status === "stop_requested") {
    return run;
  }

  const preflightFailures = preflightNativeWorkerBridge(run);
  if (preflightFailures.length > 0) {
    return markBridgePreflightFailed(run, preflightFailures);
  }

  const launchedAt = nowIso();
  const workers: PanelWorkerRecord[] = [];
  for (const worker of run.workers) {
    if (worker.status !== "pending" && worker.status !== "stopped" && worker.status !== "failed") {
      workers.push(worker);
      continue;
    }
    try {
      const provisioned = await provisionWorkerWorktree(run, {
        ...worker,
        launcherPath: worker.launcherPath ?? join(run.launcherDirectory, `${worker.id}.sh`),
        exitCodePath: worker.exitCodePath ?? join(run.resultDirectory, `${worker.id}.exit.json`),
        executionState: "provisioning"
      });
      const launchable = {
        ...provisioned,
        executionState: "launching"
      } satisfies PanelWorkerRecord;
      await writeWorkerTask(run, launchable);
      await writeWorkerLauncher(run, launchable);
      const paneId = launchWorkerPane(run, launchable);
      const launchedWorker = {
        ...launchable,
        status: "running",
        paneId: paneId || launchable.paneId,
        runtime: {
          transport: "tmux",
          paneId: paneId || launchable.paneId,
          paneTarget: process.env.TMUX_PANE,
          splitCommand: "split-window",
          retainPane: true,
          launchedAt
        },
        executionState: "running",
        startedAt: launchedAt,
        updatedAt: launchedAt,
        diagnostics: appendDiagnostic(launchable.diagnostics, "Launched in a retained current-window tmux split pane with Codex workspace-write scoped to the worker worktree.")
      } satisfies PanelWorkerRecord;
      await appendLifecycleEvent(run, {
        workerId: worker.id,
        type: "worker_launched",
        message: `Worker launched in tmux split pane ${paneId}.`,
        path: launchable.worktreePath
      });
      workers.push(launchedWorker);
    } catch (error) {
      const failedWorker = {
        ...worker,
        status: "failed",
        executionState: worker.worktreePath && existsSync(worker.worktreePath) ? "launch_failed" : "provision_failed",
        failureReason: error instanceof Error ? error.message : String(error),
        updatedAt: nowIso(),
        error: error instanceof Error ? error.message : String(error),
        diagnostics: appendDiagnostic(worker.diagnostics, "Native worker bridge provisioning or tmux launch failed before worker result was created.")
      } satisfies PanelWorkerRecord;
      await appendLifecycleEvent(run, {
        workerId: worker.id,
        type: "worker_failed",
        message: failedWorker.error ?? "worker launch failed",
        path: worker.worktreePath
      });
      workers.push(failedWorker);
    }
  }

  const nextRun: PanelWorkerRun = {
    ...run,
    workers,
    status: statusFromWorkers(workers),
    bridgeStatus: bridgeStatusFromWorkers(statusFromWorkers(workers), workers),
    bridgeFailureReason: workers.find((worker) => worker.status === "failed")?.error,
    updatedAt: nowIso()
  };
  await writePanelWorkerRun(nextRun);
  return nextRun;
}

export async function refreshPanelWorkerRun(run: PanelWorkerRun): Promise<{
  run: PanelWorkerRun;
  memberResults: PanelMemberResult[];
}> {
  const updatedAt = nowIso();
  const memberResults: PanelMemberResult[] = [];
  const workers = run.workers.map((worker) => {
    try {
      const result = parseWorkerResult(worker);
      if (!result) {
        if (worker.status === "stop_requested") {
          const stopped = !worker.paneId || !tmuxPaneAlive(worker.paneId);
          return stopped
            ? {
                ...worker,
                status: "stopped",
                updatedAt,
                diagnostics: appendDiagnostic(worker.diagnostics, "Stop-requested worker reconciled after pane exit.")
              } satisfies PanelWorkerRecord
            : worker;
        }
        if (worker.status === "running" && worker.paneId && !tmuxPaneAlive(worker.paneId)) {
          return {
            ...worker,
            status: "failed",
            updatedAt,
            error: "Worker pane is no longer active and no result file was produced.",
            diagnostics: appendDiagnostic(worker.diagnostics, "Stale tmux pane detected without a structured result file.")
          } satisfies PanelWorkerRecord;
        }
        return worker;
      }
      memberResults.push(result);
      const nextStatus: PanelWorkerStatus =
        result.status === "error" ? "failed" : result.status === "blocked" ? "blocked" : "completed";
      const commitPath = `${worker.resultPath}.commit`;
      const worktreeCommit = existsSync(commitPath)
        ? readFileSyncUtf8(commitPath).trim()
        : worker.worktreePath
        ? currentGitCommit(worker.worktreePath)
        : worker.worktreeCommit;
      return {
        ...worker,
        status: nextStatus,
        executionState: nextStatus === "completed" || nextStatus === "blocked" ? "result_ready" : "launch_failed",
        completedAt: nextStatus === "failed" ? worker.completedAt : updatedAt,
        worktreeCommit,
        updatedAt,
        error: result.error,
        failureReason: nextStatus === "failed" ? result.error : worker.failureReason
      } satisfies PanelWorkerRecord;
    } catch (error) {
      return {
        ...worker,
        status: "failed",
        updatedAt,
        error: error instanceof Error ? error.message : String(error),
        diagnostics: [...worker.diagnostics, "Worker result file could not be parsed."]
      } satisfies PanelWorkerRecord;
    }
  });

  const nextRun: PanelWorkerRun = {
    ...run,
    workers,
    status: statusFromWorkers(workers),
    bridgeStatus: bridgeStatusFromWorkers(statusFromWorkers(workers), workers),
    bridgeFailureReason: workers.find((worker) => worker.status === "failed")?.error,
    updatedAt
  };
  if (nextRun.status === "completed" || nextRun.status === "blocked") {
    const aggregate: PanelResult = {
      id: createId("panel_result"),
      planId: run.planId,
      createdAt: updatedAt,
      updatedAt,
      provider: run.provider,
      surface: "native_workers",
      status: nextRun.status,
      interactionDepth: "independent",
      memberResults,
      linkedQuestionRecordIds: [],
      linkedDecisionRecordIds: []
    };
    await writeJsonAtomic(nextRun.aggregateResultPath, aggregate);
  }
  await writePanelWorkerRun(nextRun);
  return { run: nextRun, memberResults };
}

export async function requestPanelWorkerStop(run: PanelWorkerRun): Promise<PanelWorkerRun> {
  if (run.status === "completed") {
    return run;
  }
  const updatedAt = nowIso();
  await writeFile(run.stopFilePath, `${updatedAt}\n`, "utf8");
  const nextRun: PanelWorkerRun = {
    ...run,
    status: "stop_requested",
    bridgeStatus: "stop_requested",
    updatedAt,
    workers: run.workers.map((worker) => {
      if (worker.status === "completed") {
        return worker;
      }
      let stopped = !worker.paneId;
      if (worker.paneId && commandAvailable("tmux")) {
        try {
          execFileSync("tmux", ["kill-pane", "-t", worker.paneId], { stdio: "ignore" });
          stopped = true;
        } catch {
          stopped = true;
        }
      }
      return {
        ...worker,
        status: stopped ? "stopped" : "stop_requested",
        executionState: stopped ? "stopped" : "stopping",
        runtime: worker.runtime
          ? { ...worker.runtime, stoppedAt: updatedAt }
          : worker.paneId
          ? { transport: "tmux", paneId: worker.paneId, retainPane: true, stoppedAt: updatedAt }
          : worker.runtime,
        updatedAt,
        diagnostics: appendDiagnostic(worker.diagnostics, "Stop requested through LongTable panel runtime.")
      } satisfies PanelWorkerRecord;
    })
  };
  await appendLifecycleEvent(nextRun, { type: "stop_requested", message: "Stop requested through LongTable panel runtime." });
  await writePanelWorkerRun(nextRun);
  return nextRun;
}

export async function resumePanelWorkerRun(run: PanelWorkerRun): Promise<PanelWorkerRun> {
  const updatedAt = nowIso();
  await rm(run.stopFilePath, { force: true });
  await Promise.all(run.workers
    .filter((worker) => worker.status !== "completed")
    .map((worker) => clearWorkerAttemptArtifacts(worker)));
  const nextRun: PanelWorkerRun = {
    ...run,
    status: "planned",
    bridgeStatus: "not_requested",
    bridgeFailureReason: undefined,
    updatedAt,
    workers: run.workers.map((worker) => worker.status === "completed"
      ? worker
      : {
          ...worker,
          status: "pending",
          paneId: undefined,
          error: undefined,
          failureReason: undefined,
          executionState: "not_started",
          updatedAt,
          diagnostics: appendDiagnostic(worker.diagnostics, "Resume requested; worker is ready to be relaunched.")
        })
  };
  await appendLifecycleEvent(nextRun, { type: "resume_requested", message: "Resume requested; incomplete workers are ready to relaunch." });
  await writePanelWorkerRun(nextRun);
  return nextRun;
}

export async function shutdownPanelWorkerRun(run: PanelWorkerRun): Promise<PanelWorkerRun> {
  const updatedAt = nowIso();
  await writeFile(run.stopFilePath, `${updatedAt}\n`, "utf8");
  const workers: PanelWorkerRecord[] = [];
  for (const worker of run.workers) {
    let cleanupStatus = worker.cleanupStatus ?? "not_started";
    let cleanupError: string | undefined;
    if (worker.paneId && commandAvailable("tmux")) {
      try {
        execFileSync("tmux", ["kill-pane", "-t", worker.paneId], { stdio: "ignore" });
      } catch {
        // A missing pane is already shut down for LongTable lifecycle purposes.
      }
    }
    if (worker.worktreePath && existsSync(worker.worktreePath) && commandAvailable("git")) {
      try {
        gitOutput(run.workingDirectory, ["worktree", "remove", "--force", worker.worktreePath]);
        cleanupStatus = "removed";
      } catch (error) {
        cleanupStatus = "failed";
        cleanupError = error instanceof Error ? error.message : String(error);
        await appendLifecycleEvent(run, {
          workerId: worker.id,
          type: "cleanup_failed",
          message: cleanupError,
          path: worker.worktreePath
        });
      }
    }
    workers.push({
      ...worker,
      status: worker.status === "completed" ? "completed" : "stopped",
      executionState: cleanupStatus === "failed" ? "cleanup_failed" : "shutdown",
      shutdownRequestedAt: updatedAt,
      cleanupStatus,
      error: cleanupError ?? worker.error,
      failureReason: cleanupError ?? worker.failureReason,
      runtime: worker.runtime
        ? { ...worker.runtime, shutdownAt: updatedAt }
        : worker.paneId
        ? { transport: "tmux", paneId: worker.paneId, retainPane: true, shutdownAt: updatedAt }
        : worker.runtime,
      updatedAt,
      diagnostics: appendDiagnostic(worker.diagnostics, "Shutdown requested through LongTable panel runtime.")
    });
  }
  const nextRun: PanelWorkerRun = {
    ...run,
    status: workers.some((worker) => worker.cleanupStatus === "failed") ? "failed" : "stopped",
    bridgeStatus: workers.some((worker) => worker.cleanupStatus === "failed") ? "failed" : "shutdown",
    bridgeFailureReason: workers.find((worker) => worker.cleanupStatus === "failed")?.error,
    workers,
    updatedAt
  };
  await appendLifecycleEvent(nextRun, { type: "shutdown_requested", message: "Shutdown requested; panes killed and worker worktrees removed when possible." });
  await writePanelWorkerRun(nextRun);
  return nextRun;
}

export async function waitForPanelWorkerRun(run: PanelWorkerRun, timeoutMs: number): Promise<PanelWorkerRun> {
  const deadline = Date.now() + timeoutMs;
  let current = run;
  while (Date.now() <= deadline) {
    const refreshed = await refreshPanelWorkerRun(current);
    current = refreshed.run;
    if (terminalStatus(current.status) || current.status === "resumable") {
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const timedOut: PanelWorkerRun = {
    ...current,
    updatedAt: nowIso(),
    diagnostics: appendDiagnostic(current.diagnostics, `wait-timeout:${timeoutMs}ms`)
  };
  await writePanelWorkerRun(timedOut);
  return timedOut;
}
