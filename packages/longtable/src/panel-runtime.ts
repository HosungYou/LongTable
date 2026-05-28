import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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

function workerTaskPrompt(fallback: PanelFallback, worker: PanelWorkerRecord): string {
  return [
    "LongTable native panel worker",
    "",
    `Role: ${worker.label} (${worker.role})`,
    `Invocation: ${fallback.invocationRecord.id}`,
    `Panel plan: ${fallback.plan.id}`,
    "",
    "Instructions:",
    "- Work read-only unless the researcher explicitly asked for drafting.",
    "- Do not expose or persist hidden reasoning, private tool traces, or chain-of-thought.",
    "- Persist only the structured final role output to the result path below.",
    "- Return JSON matching this shape:",
    "  {\"role\":\"...\",\"label\":\"...\",\"status\":\"completed\",\"summary\":\"...\",\"claims\":[],\"objections\":[],\"openQuestions\":[],\"evidenceRefs\":[]}",
    "",
    `Result path: ${worker.resultPath}`,
    `Log path: ${worker.logPath}`,
    "",
    "Research object:",
    fallback.plan.prompt
  ].join("\n");
}

const PANEL_WORKER_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["role", "label", "status"],
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
  return [
    "#!/usr/bin/env bash",
    "set +e",
    `printf 'started_at=%s\\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" > ${shellQuote(worker.logPath)}`,
    `if [ -f ${shellQuote(run.stopFilePath)} ]; then`,
    `  printf 'stop_requested_before_launch\\n' >> ${shellQuote(worker.logPath)}`,
    "  exit 0",
    "fi",
    [
      "codex exec",
      "-s read-only",
      `-C ${shellQuote(run.workingDirectory)}`,
      "--skip-git-repo-check",
      `--output-schema ${shellQuote(run.outputSchemaPath)}`,
      `-o ${shellQuote(worker.resultPath)}`,
      "-",
      `< ${shellQuote(worker.taskPath)}`,
      ">/dev/null 2>/dev/null"
    ].join(" "),
    "code=$?",
    `printf '{"exitCode":%s,"completedAt":"%s"}\\n' "$code" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" > ${shellQuote(worker.exitCodePath ?? `${worker.resultPath}.exit.json`)}`,
    `printf 'exit_code=%s\\n' "$code" >> ${shellQuote(worker.logPath)}`,
    `if [ "$code" -ne 0 ] && [ ! -s ${shellQuote(worker.resultPath)} ]; then`,
    `  node -e 'const fs=require("fs"); const [path,role,label,code]=process.argv.slice(1); fs.writeFileSync(path, JSON.stringify({role,label,status:"error",error:\`codex exec exited ${"${code}"}\`}, null, 2)+"\\n");' ${shellQuote(worker.resultPath)} ${role} ${label} "$code"`,
    "fi",
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
  await mkdir(taskDirectory, { recursive: true });
  await mkdir(resultDirectory, { recursive: true });
  await mkdir(logDirectory, { recursive: true });
  await mkdir(launcherDirectory, { recursive: true });

  const runStatus = options.initialStatus ?? "planned";
  const workers: PanelWorkerRecord[] = options.fallback.plan.members.map((member, index) => {
    const workerId = `worker-${index + 1}-${member.role}`;
    return {
      id: workerId,
      role: member.role,
      label: member.label,
      required: member.required,
      status: plannedWorkerStatus(runStatus),
      taskPath: join(taskDirectory, `${workerId}.md`),
      resultPath: join(resultDirectory, `${workerId}.json`),
      logPath: join(logDirectory, `${workerId}.log`),
      launcherPath: join(launcherDirectory, `${workerId}.sh`),
      exitCodePath: join(resultDirectory, `${workerId}.exit.json`),
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
    outputSchemaPath: join(runDirectory, "panel-worker-output.schema.json"),
    stopFilePath: join(runDirectory, "stop-requested"),
    aggregateResultPath: join(runDirectory, "panel-result.json"),
    workers,
    diagnostics: options.diagnostics ?? []
  };

  await writeJsonAtomic(join(runDirectory, "schema.json"), {
    schemaVersion: 1,
    kind: "longtable.panelWorkerRun",
    note: "Durable worker state stores task/status/result metadata, not hidden reasoning or raw tool traces."
  });
  await writeJsonAtomic(run.outputSchemaPath, PANEL_WORKER_OUTPUT_SCHEMA);
  await Promise.all(workers.map((worker) => writeFile(worker.taskPath, workerTaskPrompt(options.fallback, worker), "utf8")));
  await writePanelWorkerRun(run);
  return run;
}

export async function readPanelWorkerRun(workingDirectory: string, runId: string): Promise<PanelWorkerRun> {
  return normalizePanelWorkerRun(JSON.parse(await readFile(panelWorkerRunPath(workingDirectory, runId), "utf8")) as PanelWorkerRun);
}

function normalizePanelWorkerRun(run: PanelWorkerRun): PanelWorkerRun {
  const launcherDirectory = run.launcherDirectory ?? join(run.runDirectory, "launchers");
  const resultDirectory = run.resultDirectory ?? join(run.runDirectory, "results");
  return {
    ...run,
    launcherDirectory,
    outputSchemaPath: run.outputSchemaPath ?? join(run.runDirectory, "panel-worker-output.schema.json"),
    stopFilePath: run.stopFilePath ?? join(run.runDirectory, "stop-requested"),
    workers: run.workers.map((worker) => ({
      ...worker,
      launcherPath: worker.launcherPath ?? join(launcherDirectory, `${worker.id}.sh`),
      exitCodePath: worker.exitCodePath ?? join(resultDirectory, `${worker.id}.exit.json`),
      diagnostics: worker.diagnostics ?? []
    }))
  };
}

export async function writePanelWorkerRun(run: PanelWorkerRun): Promise<void> {
  await writeJsonAtomic(join(run.runDirectory, "run.json"), {
    ...run,
    updatedAt: nowIso()
  });
}

function parseWorkerResult(worker: PanelWorkerRecord): PanelMemberResult | null {
  if (!existsSync(worker.resultPath)) {
    return null;
  }
  const parsed = JSON.parse(readFileSyncUtf8(worker.resultPath)) as Partial<PanelMemberResult>;
  return {
    role: parsed.role ?? worker.role,
    label: parsed.label ?? worker.label,
    status: parsed.status ?? "completed",
    summary: parsed.summary,
    claims: parsed.claims,
    objections: parsed.objections,
    openQuestions: parsed.openQuestions,
    evidenceRefs: parsed.evidenceRefs,
    error: parsed.error
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
    return "resumable";
  }
  if (workers.some((worker) => worker.status === "stop_requested")) {
    return "stop_requested";
  }
  if (workers.every((worker) => worker.status === "stopped" || worker.status === "completed")) {
    return "stopped";
  }
  return "running";
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
  return status === "completed" || status === "stopped" || status === "degraded";
}

function launchWorkerPane(run: PanelWorkerRun, worker: PanelWorkerRecord): string {
  const command = `bash ${shellQuote(worker.launcherPath!)}`;
  try {
    return execFileSync(
      "tmux",
      [
        "new-window",
        "-d",
        "-P",
        "-F",
        "#{pane_id}",
        "-n",
        `lt-${worker.id.slice(0, 12)}`,
        command
      ],
      { encoding: "utf8" }
    ).trim();
  } catch {
    const sessionName = `longtable-${run.id}-${worker.id}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);
    return execFileSync(
      "tmux",
      [
        "new-session",
        "-d",
        "-P",
        "-F",
        "#{pane_id}",
        "-s",
        sessionName,
        command
      ],
      { encoding: "utf8" }
    ).trim();
  }
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

  const tmuxAvailable = commandAvailable("tmux");
  const codexAvailable = commandAvailable("codex");
  if (!tmuxAvailable || !codexAvailable) {
    const unavailable = [
      tmuxAvailable ? null : "tmux:unavailable",
      codexAvailable ? null : "codex:unavailable"
    ].filter((entry): entry is string => Boolean(entry));
    const nextRun: PanelWorkerRun = {
      ...run,
      status: "degraded",
      updatedAt: nowIso(),
      diagnostics: [...run.diagnostics, ...unavailable, "Native worker launch degraded; use sequential_fallback or resume when local runtime is available."],
      workers: run.workers.map((worker) => worker.status === "completed"
        ? worker
        : {
            ...worker,
            status: "pending",
            updatedAt: nowIso(),
            diagnostics: appendDiagnostic(worker.diagnostics, "Launch skipped because tmux or codex is unavailable.")
          })
    };
    await writePanelWorkerRun(nextRun);
    return nextRun;
  }

  const launchedAt = nowIso();
  const workers = await Promise.all(run.workers.map(async (worker) => {
    if (worker.status !== "pending" && worker.status !== "stopped" && worker.status !== "failed") {
      return worker;
    }
    const launchable = {
      ...worker,
      launcherPath: worker.launcherPath ?? join(run.launcherDirectory, `${worker.id}.sh`),
      exitCodePath: worker.exitCodePath ?? join(run.resultDirectory, `${worker.id}.exit.json`)
    } satisfies PanelWorkerRecord;
    await writeWorkerLauncher(run, launchable);
    try {
      const paneId = launchWorkerPane(run, launchable);
      return {
        ...launchable,
        status: "running",
        paneId: paneId || launchable.paneId,
        startedAt: launchedAt,
        updatedAt: launchedAt,
        diagnostics: appendDiagnostic(launchable.diagnostics, "Launched with tmux/codex read-only native worker command.")
      } satisfies PanelWorkerRecord;
    } catch (error) {
      return {
        ...launchable,
        status: "failed",
        updatedAt: nowIso(),
        error: error instanceof Error ? error.message : String(error),
        diagnostics: appendDiagnostic(launchable.diagnostics, "tmux launch failed before worker result was created.")
      } satisfies PanelWorkerRecord;
    }
  }));

  const nextRun: PanelWorkerRun = {
    ...run,
    workers,
    status: statusFromWorkers(workers),
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
      return {
        ...worker,
        status: result.status === "error" ? "failed" : "completed",
        completedAt: result.status === "error" ? worker.completedAt : updatedAt,
        updatedAt,
        error: result.error
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
    updatedAt
  };
  if (nextRun.status === "completed") {
    const aggregate: PanelResult = {
      id: createId("panel_result"),
      planId: run.planId,
      createdAt: updatedAt,
      updatedAt,
      provider: run.provider,
      surface: "native_workers",
      status: "completed",
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
    updatedAt,
    workers: run.workers.map((worker) => {
      if (worker.status === "completed") {
        return worker;
      }
      if (worker.paneId && commandAvailable("tmux")) {
        try {
          execFileSync("tmux", ["kill-pane", "-t", worker.paneId], { stdio: "ignore" });
        } catch {
          // A missing pane is handled as a stopped worker below.
        }
      }
      return {
        ...worker,
        status: worker.paneId ? "stop_requested" : "stopped",
        updatedAt,
        diagnostics: appendDiagnostic(worker.diagnostics, "Stop requested through LongTable panel runtime.")
      } satisfies PanelWorkerRecord;
    })
  };
  await writePanelWorkerRun(nextRun);
  return nextRun;
}

export async function resumePanelWorkerRun(run: PanelWorkerRun): Promise<PanelWorkerRun> {
  const updatedAt = nowIso();
  await rm(run.stopFilePath, { force: true });
  const nextRun: PanelWorkerRun = {
    ...run,
    status: "planned",
    updatedAt,
    workers: run.workers.map((worker) => worker.status === "completed"
      ? worker
      : {
          ...worker,
          status: "pending",
          paneId: undefined,
          error: undefined,
          updatedAt,
          diagnostics: appendDiagnostic(worker.diagnostics, "Resume requested; worker is ready to be relaunched.")
        })
  };
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
