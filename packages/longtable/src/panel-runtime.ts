import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
  await mkdir(taskDirectory, { recursive: true });
  await mkdir(resultDirectory, { recursive: true });
  await mkdir(logDirectory, { recursive: true });

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
    aggregateResultPath: join(runDirectory, "panel-result.json"),
    workers,
    diagnostics: options.diagnostics ?? []
  };

  await writeJsonAtomic(join(runDirectory, "schema.json"), {
    schemaVersion: 1,
    kind: "longtable.panelWorkerRun",
    note: "Durable worker state stores task/status/result metadata, not hidden reasoning or raw tool traces."
  });
  await Promise.all(workers.map((worker) => writeFile(worker.taskPath, workerTaskPrompt(options.fallback, worker), "utf8")));
  await writePanelWorkerRun(run);
  return run;
}

export async function readPanelWorkerRun(workingDirectory: string, runId: string): Promise<PanelWorkerRun> {
  return JSON.parse(await readFile(panelWorkerRunPath(workingDirectory, runId), "utf8")) as PanelWorkerRun;
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
  const updatedAt = nowIso();
  const nextRun: PanelWorkerRun = {
    ...run,
    status: "stop_requested",
    updatedAt,
    workers: run.workers.map((worker) => worker.status === "completed"
      ? worker
      : {
          ...worker,
          status: worker.paneId ? "stop_requested" : "stopped",
          updatedAt,
          diagnostics: [...worker.diagnostics, "Stop requested through LongTable panel runtime."]
        })
  };
  await writePanelWorkerRun(nextRun);
  return nextRun;
}

export async function resumePanelWorkerRun(run: PanelWorkerRun): Promise<PanelWorkerRun> {
  const updatedAt = nowIso();
  const nextRun: PanelWorkerRun = {
    ...run,
    status: "running",
    updatedAt,
    workers: run.workers.map((worker) => worker.status === "completed"
      ? worker
      : {
          ...worker,
          status: "pending",
          updatedAt,
          diagnostics: [...worker.diagnostics, "Resume requested; worker is ready to be relaunched."]
        })
  };
  await writePanelWorkerRun(nextRun);
  return nextRun;
}
