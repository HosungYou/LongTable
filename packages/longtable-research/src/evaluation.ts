import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const SCHOLAR_RESEARCH_EVALUATION_TASKS = [
  { id: "pinpoint-1", family: "pinpoint_retrieval" },
  { id: "pinpoint-2", family: "pinpoint_retrieval" },
  { id: "pinpoint-3", family: "pinpoint_retrieval" },
  { id: "pinpoint-4", family: "pinpoint_retrieval" },
  { id: "discovery-1", family: "open_topic_venue" },
  { id: "discovery-2", family: "open_topic_venue" },
  { id: "discovery-3", family: "open_topic_venue" },
  { id: "fulltext-1", family: "fulltext_claim_extraction" },
  { id: "fulltext-2", family: "fulltext_claim_extraction" },
  { id: "fulltext-3", family: "fulltext_claim_extraction" },
  { id: "visual-e2e-1", family: "visual_manuscript_e2e" },
  { id: "visual-e2e-2", family: "visual_manuscript_e2e" }
] as const;

export interface ScholarResearchEvaluationPlan {
  schema: "longtable.scholar-research-evaluation-plan";
  version: 1;
  createdAt: string;
  planId: string;
  layers: ["fixtures", "replay", "prospective"];
  repeatsPerFrozenCondition: 3;
  taskSplit: {
    engineering: string[];
    calibration: string[];
    lockedHoldout: string[];
  };
  tasks: typeof SCHOLAR_RESEARCH_EVALUATION_TASKS;
  replayCases: Array<{
    threadId: string;
    posture: "replay_only";
    criteria: string[];
  }>;
  conditions: ["workflow_off", "workflow_on", "frontier_ceiling"];
  qualityHardGates: string[];
  productivityMetrics: string[];
  promotionRule: string;
}

export const EVALUATION_QUALITY_GATES = [
  "unsupportedFinalClaim",
  "wrongSourceVersionOrCitation",
  "visualDistortion",
  "prohibitedAccess",
  "preapprovalMutation"
] as const;

export const PROSPECTIVE_TRIAL_PROTECTED_STAGES = [
  "legal-access-boundary",
  "source-version-provenance",
  "quality-hard-gates"
] as const;

export interface ScholarResearchEvaluationObservation {
  schema: "longtable.scholar-research-evaluation-observation";
  version: 1;
  observationId: string;
  planId: string;
  taskId: string;
  layer: "fixture" | "replay" | "prospective";
  condition: "workflow_off" | "workflow_on" | "frontier_ceiling";
  crossoverPairId?: string;
  provider: string;
  model: string;
  modelVersion: string;
  corpusCutoff: string;
  permissionsProfile: string;
  stageProfile: string[];
  startedAt: string;
  acceptedArtifactAt?: string;
  completedAt: string;
  quality: Record<typeof EVALUATION_QUALITY_GATES[number], boolean>;
  metrics: {
    elapsedMs: number;
    activeHumanMs: number;
    interruptionCount: number;
    repeatedQuestionCount: number;
    contextSwitchCount: number;
    reworkCount: number;
    toolCallCount: number;
    tokenCount?: number;
    monetaryCost?: number;
    abandoned: boolean;
    researcherEffort?: number;
    researcherTrust?: number;
  };
  artifactRefs: string[];
  notes: string[];
}

export interface ScholarResearchEvaluationReport {
  schema: "longtable.scholar-research-evaluation-report";
  version: 1;
  planId: string;
  createdAt: string;
  observationCount: number;
  prospectiveCount: number;
  matchedProspectivePairs: number;
  conditionSummary: Array<{
    condition: ScholarResearchEvaluationObservation["condition"];
    observations: number;
    qualityPasses: number;
    qualityPassRate: number;
    medianElapsedMs?: number;
    medianActiveHumanMs?: number;
    medianInterruptions?: number;
    medianEffort?: number;
    medianTrust?: number;
  }>;
  ablations: Array<{
    stage: string;
    matchedPairs: number;
    verdict: "retain" | "simplify_or_opt_in" | "remove_candidate" | "insufficient_evidence";
    qualityLossWhenRemoved: number;
    medianActiveHumanMsDeltaWhenEnabled?: number;
    medianElapsedMsDeltaWhenEnabled?: number;
    medianEffortDeltaWhenEnabled?: number;
    medianTrustDeltaWhenEnabled?: number;
    reason: string;
  }>;
  promotionEligible: boolean;
  limitations: string[];
}

export interface ProspectiveTrialConfig {
  schema: "longtable.prospective-trial-config";
  version: 1;
  planId: string;
  trialId: string;
  taskId: string;
  researchQuestion: string;
  targetJournal: string;
  provider: string;
  model: string;
  modelVersion: string;
  corpusCutoff: string;
  permissionsProfile: string;
  crossoverSeed: string;
  workflowOnStages: string[];
  workflowOffStages: string[];
}

export interface ProspectiveTrialProtocol {
  schema: "longtable.prospective-trial-protocol";
  version: 1;
  planId: string;
  trialId: string;
  taskId: string;
  createdAt: string;
  researchQuestion: string;
  targetJournal: string;
  provider: string;
  model: string;
  modelVersion: string;
  corpusCutoff: string;
  permissionsProfile: string;
  crossoverSeedHash: string;
  conditionOrder: Array<{
    index: number;
    condition: "workflow_off" | "workflow_on";
    stageProfile: string[];
    crossoverPairId: string;
  }>;
}

export interface ProspectiveTrialSession {
  schema: "longtable.prospective-trial-session";
  version: 1;
  planId: string;
  trialId: string;
  sessionId: string;
  conditionIndex: number;
  condition: "workflow_off" | "workflow_on";
  stageProfile: string[];
  crossoverPairId: string;
  startedAt: string;
  status: "running" | "completed";
  completedAt?: string;
  observationId?: string;
  resultHash?: string;
}

export interface ProspectiveTrialSessionResult {
  schema: "longtable.prospective-trial-session-result";
  version: 1;
  acceptedArtifactAt?: string;
  activeHumanMs: number;
  interruptionCount: number;
  repeatedQuestionCount: number;
  contextSwitchCount: number;
  reworkCount: number;
  toolCallCount: number;
  tokenCount?: number;
  monetaryCost?: number;
  abandoned: boolean;
  researcherEffort?: number;
  researcherTrust?: number;
  quality: ScholarResearchEvaluationObservation["quality"];
  artifactRefs: string[];
  notes: string[];
}

export interface ProspectiveTrialTaskCapsule {
  schema: "longtable.prospective-trial-task-capsule";
  version: 1;
  planId: string;
  trialId: string;
  sessionId: string;
  conditionIndex: number;
  condition: "workflow_off" | "workflow_on";
  taskId: string;
  researchQuestion: string;
  targetJournal: string;
  provider: string;
  model: string;
  modelVersion: string;
  corpusCutoff: string;
  permissionsProfile: string;
  stageProfile: string[];
  protectedStages: string[];
  instruction: string;
}

function normalizePlanId(value: string): string {
  return value.trim().replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "") || "scholar-evaluation";
}

function normalizeTrialId(value: string): string {
  return value.trim().replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "") || "prospective-trial";
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function uniqueStages(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function prospectiveTrialDirectory(cwd: string, planId: string, trialId: string): string {
  return join(
    observationDirectory(cwd, planId),
    "trials",
    normalizeTrialId(trialId)
  );
}

function validateProspectiveTrialConfig(config: ProspectiveTrialConfig): string[] {
  const errors: string[] = [];
  if (config.schema !== "longtable.prospective-trial-config" || config.version !== 1) {
    errors.push("Unsupported prospective trial config schema or version.");
  }
  for (const [field, value] of [
    ["planId", config.planId],
    ["trialId", config.trialId],
    ["taskId", config.taskId],
    ["researchQuestion", config.researchQuestion],
    ["targetJournal", config.targetJournal],
    ["provider", config.provider],
    ["model", config.model],
    ["modelVersion", config.modelVersion],
    ["corpusCutoff", config.corpusCutoff],
    ["permissionsProfile", config.permissionsProfile],
    ["crossoverSeed", config.crossoverSeed]
  ] as const) {
    if (typeof value !== "string" || !value.trim()) errors.push(`${field} is required.`);
  }
  if (!Array.isArray(config.workflowOnStages) || uniqueStages(config.workflowOnStages).length === 0) {
    errors.push("workflowOnStages must contain at least one stage.");
  }
  if (!Array.isArray(config.workflowOffStages) || uniqueStages(config.workflowOffStages).length === 0) {
    errors.push("workflowOffStages must contain at least one stage.");
  }
  const on = uniqueStages(config.workflowOnStages).sort();
  const off = uniqueStages(config.workflowOffStages).sort();
  if (JSON.stringify(on) === JSON.stringify(off)) {
    errors.push("workflowOnStages and workflowOffStages must differ.");
  }
  return errors;
}

function validateProspectiveTrialSessionResult(
  result: ProspectiveTrialSessionResult
): string[] {
  const errors: string[] = [];
  if (result.schema !== "longtable.prospective-trial-session-result" || result.version !== 1) {
    errors.push("Unsupported prospective trial session result schema or version.");
  }
  for (const field of [
    "activeHumanMs",
    "interruptionCount",
    "repeatedQuestionCount",
    "contextSwitchCount",
    "reworkCount",
    "toolCallCount"
  ] as const) {
    const value = result[field];
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`${field} must be finite and non-negative.`);
    }
  }
  for (const field of ["tokenCount", "monetaryCost"] as const) {
    const value = result[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      errors.push(`${field} must be finite and non-negative when supplied.`);
    }
  }
  for (const field of ["researcherEffort", "researcherTrust"] as const) {
    const value = result[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 1 || value > 7)) {
      errors.push(`${field} must be between 1 and 7 when supplied.`);
    }
  }
  for (const gate of EVALUATION_QUALITY_GATES) {
    if (typeof result.quality?.[gate] !== "boolean") {
      errors.push(`Quality gate ${gate} must be a boolean failure flag.`);
    }
  }
  if (!Array.isArray(result.artifactRefs) || result.artifactRefs.length === 0 ||
      result.artifactRefs.some((value) => typeof value !== "string" || !value.trim())) {
    errors.push("artifactRefs must contain at least one non-empty reference.");
  }
  if (!Array.isArray(result.notes) ||
      result.notes.some((value) => typeof value !== "string")) {
    errors.push("notes must be an array of strings.");
  }
  const passed = EVALUATION_QUALITY_GATES.every((gate) => result.quality?.[gate] === false);
  if (result.abandoned && result.acceptedArtifactAt) {
    errors.push("An abandoned session cannot record acceptedArtifactAt.");
  }
  if (!result.abandoned && passed && !result.acceptedArtifactAt) {
    errors.push("A completed quality-passing session requires acceptedArtifactAt.");
  }
  if ((!passed || result.abandoned) && result.acceptedArtifactAt) {
    errors.push("acceptedArtifactAt is allowed only for a non-abandoned quality-passing session.");
  }
  if (result.acceptedArtifactAt && !Number.isFinite(Date.parse(result.acceptedArtifactAt))) {
    errors.push("acceptedArtifactAt must be a valid timestamp.");
  }
  return errors;
}

export function buildScholarResearchEvaluationPlan(input: {
  planId?: string;
  createdAt?: string;
  replayThreadId?: string;
} = {}): ScholarResearchEvaluationPlan {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const ids = SCHOLAR_RESEARCH_EVALUATION_TASKS.map((task) => task.id);
  return {
    schema: "longtable.scholar-research-evaluation-plan",
    version: 1,
    createdAt,
    planId: normalizePlanId(input.planId ?? `evaluation-${createdAt.slice(0, 10)}`),
    layers: ["fixtures", "replay", "prospective"],
    repeatsPerFrozenCondition: 3,
    taskSplit: {
      engineering: ids.slice(0, 4),
      calibration: ids.slice(4, 8),
      lockedHoldout: ids.slice(8)
    },
    tasks: SCHOLAR_RESEARCH_EVALUATION_TASKS,
    replayCases: [{
      threadId: input.replayThreadId ?? "019f56ab-4f4e-7f13-9bc0-8c8d15966e0d",
      posture: "replay_only",
      criteria: [
        "separate performed procedure from proposed claim-control model",
        "judge whether each figure or table is necessary for its research claim",
        "measure expert recovery of question, denominator, key value, and conclusion within 10-20 seconds",
        "detect main-text versus supplement redundancy",
        "require editable vector output and journal-policy-compatible visual grammar"
      ]
    }],
    conditions: ["workflow_off", "workflow_on", "frontier_ceiling"],
    qualityHardGates: [
      "unsupported_final_claim",
      "wrong_source_version_or_citation",
      "visual_distortion",
      "prohibited_access",
      "preapproval_mutation"
    ],
    productivityMetrics: [
      "time_to_accepted_artifact",
      "active_human_time",
      "interruptions",
      "repeated_questions",
      "context_switches",
      "rework",
      "abandonment",
      "researcher_effort",
      "researcher_trust"
    ],
    promotionRule: "Only prospective conversational E2E evidence may promote, simplify, or remove a default stage; quality hard gates must pass before efficiency is compared."
  };
}

export async function writeScholarResearchEvaluationPlan(input: {
  cwd: string;
  planId?: string;
  replayThreadId?: string;
}): Promise<{ plan: ScholarResearchEvaluationPlan; path: string }> {
  const plan = buildScholarResearchEvaluationPlan(input);
  const directory = resolve(input.cwd, ".longtable", "evaluations", plan.planId);
  const path = join(directory, "evaluation-plan.json");
  await mkdir(directory, { recursive: true });
  await writeFile(path, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  return { plan, path };
}

function observationDirectory(cwd: string, planId: string): string {
  return resolve(cwd, ".longtable", "evaluations", normalizePlanId(planId));
}

export async function createProspectiveTrialProtocol(input: {
  cwd: string;
  configPath: string;
}): Promise<{
  protocol: ProspectiveTrialProtocol;
  path: string;
}> {
  const config = JSON.parse(
    await readFile(resolve(input.configPath), "utf8")
  ) as ProspectiveTrialConfig;
  const errors = validateProspectiveTrialConfig(config);
  if (errors.length > 0) {
    throw new Error(`Prospective trial config is invalid: ${errors.join(" ")}`);
  }
  const planDirectory = observationDirectory(input.cwd, config.planId);
  const plan = JSON.parse(
    await readFile(join(planDirectory, "evaluation-plan.json"), "utf8")
  ) as ScholarResearchEvaluationPlan;
  if (config.planId !== plan.planId) {
    throw new Error("Prospective trial config planId does not match the evaluation plan.");
  }
  if (!plan.tasks.some((task) => task.id === config.taskId)) {
    throw new Error(`Task ${config.taskId} is not declared in the evaluation plan.`);
  }

  const seedHash = hash(`${config.crossoverSeed}\0${config.trialId}\0${config.taskId}`);
  const firstCondition: "workflow_off" | "workflow_on" =
    Number.parseInt(seedHash.slice(0, 2), 16) % 2 === 0 ? "workflow_off" : "workflow_on";
  const secondCondition = firstCondition === "workflow_off" ? "workflow_on" : "workflow_off";
  const protectedStages = [...PROSPECTIVE_TRIAL_PROTECTED_STAGES];
  const onStages = uniqueStages([...protectedStages, ...config.workflowOnStages]);
  const offStages = uniqueStages([...protectedStages, ...config.workflowOffStages]);
  const stages = {
    workflow_on: onStages,
    workflow_off: offStages
  } as const;
  const pairId = `${normalizePlanId(config.planId)}:${normalizeTrialId(config.trialId)}`;
  const conditionOrder: ProspectiveTrialProtocol["conditionOrder"] = [
    {
      index: 0,
      condition: firstCondition,
      stageProfile: stages[firstCondition],
      crossoverPairId: pairId
    },
    {
      index: 1,
      condition: secondCondition,
      stageProfile: stages[secondCondition],
      crossoverPairId: pairId
    }
  ];
  const expected = {
    schema: "longtable.prospective-trial-protocol" as const,
    version: 1 as const,
    planId: plan.planId,
    trialId: normalizeTrialId(config.trialId),
    taskId: config.taskId.trim(),
    researchQuestion: config.researchQuestion.trim(),
    targetJournal: config.targetJournal.trim(),
    provider: config.provider.trim(),
    model: config.model.trim(),
    modelVersion: config.modelVersion.trim(),
    corpusCutoff: config.corpusCutoff.trim(),
    permissionsProfile: config.permissionsProfile.trim(),
    crossoverSeedHash: seedHash,
    conditionOrder
  };
  const directory = prospectiveTrialDirectory(input.cwd, config.planId, config.trialId);
  const path = join(directory, "protocol.json");
  await mkdir(directory, { recursive: true });
  try {
    const existing = JSON.parse(await readFile(path, "utf8")) as ProspectiveTrialProtocol;
    const { createdAt: _existingCreatedAt, ...existingFrozen } = existing;
    if (JSON.stringify(existingFrozen) !== JSON.stringify(expected)) {
      throw new Error(
        `Prospective trial ${expected.trialId} already exists with different frozen inputs.`
      );
    }
    return { protocol: existing, path };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const protocol: ProspectiveTrialProtocol = {
    ...expected,
    createdAt: new Date().toISOString()
  };
  await writeFile(path, `${JSON.stringify(protocol, null, 2)}\n`, "utf8");
  return { protocol, path };
}

async function readProspectiveTrialProtocol(input: {
  cwd: string;
  planId: string;
  trialId: string;
}): Promise<{ protocol: ProspectiveTrialProtocol; directory: string }> {
  const directory = prospectiveTrialDirectory(input.cwd, input.planId, input.trialId);
  const protocol = JSON.parse(
    await readFile(join(directory, "protocol.json"), "utf8")
  ) as ProspectiveTrialProtocol;
  if (protocol.planId !== normalizePlanId(input.planId) ||
      protocol.trialId !== normalizeTrialId(input.trialId)) {
    throw new Error("Prospective trial protocol identity does not match the requested trial.");
  }
  return { protocol, directory };
}

function prospectiveSessionPath(directory: string, conditionIndex: number): string {
  return join(directory, "sessions", `session-${conditionIndex}.json`);
}

export async function startProspectiveTrialSession(input: {
  cwd: string;
  planId: string;
  trialId: string;
  conditionIndex: number;
}): Promise<{
  session: ProspectiveTrialSession;
  path: string;
  taskCapsule: ProspectiveTrialTaskCapsule;
  taskCapsulePath: string;
}> {
  const { protocol, directory } = await readProspectiveTrialProtocol(input);
  const assigned = protocol.conditionOrder.find((entry) => entry.index === input.conditionIndex);
  if (!assigned) throw new Error("conditionIndex must be 0 or 1.");
  const sessionsDirectory = join(directory, "sessions");
  const path = prospectiveSessionPath(directory, input.conditionIndex);
  const taskCapsulePath = join(
    sessionsDirectory,
    `session-${input.conditionIndex}-task.json`
  );
  await mkdir(sessionsDirectory, { recursive: true });
  try {
    const existing = JSON.parse(await readFile(path, "utf8")) as ProspectiveTrialSession;
    const taskCapsule = JSON.parse(
      await readFile(taskCapsulePath, "utf8")
    ) as ProspectiveTrialTaskCapsule;
    return { session: existing, path, taskCapsule, taskCapsulePath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const sessionId = `${protocol.trialId}-${input.conditionIndex}`;
  const session: ProspectiveTrialSession = {
    schema: "longtable.prospective-trial-session",
    version: 1,
    planId: protocol.planId,
    trialId: protocol.trialId,
    sessionId,
    conditionIndex: input.conditionIndex,
    condition: assigned.condition,
    stageProfile: assigned.stageProfile,
    crossoverPairId: assigned.crossoverPairId,
    startedAt: new Date().toISOString(),
    status: "running"
  };
  const taskCapsule: ProspectiveTrialTaskCapsule = {
    schema: "longtable.prospective-trial-task-capsule",
    version: 1,
    planId: protocol.planId,
    trialId: protocol.trialId,
    sessionId,
    conditionIndex: input.conditionIndex,
    condition: assigned.condition,
    taskId: protocol.taskId,
    researchQuestion: protocol.researchQuestion,
    targetJournal: protocol.targetJournal,
    provider: protocol.provider,
    model: protocol.model,
    modelVersion: protocol.modelVersion,
    corpusCutoff: protocol.corpusCutoff,
    permissionsProfile: protocol.permissionsProfile,
    stageProfile: assigned.stageProfile,
    protectedStages: [...PROSPECTIVE_TRIAL_PROTECTED_STAGES],
    instruction: "Produce one accepted research artifact for the frozen question and journal. Record human burden and hard-gate failures; do not bypass access controls or mutate approved research scope."
  };
  await writeFile(path, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  await writeFile(taskCapsulePath, `${JSON.stringify(taskCapsule, null, 2)}\n`, "utf8");
  return { session, path, taskCapsule, taskCapsulePath };
}

export async function finishProspectiveTrialSession(input: {
  cwd: string;
  planId: string;
  trialId: string;
  conditionIndex: number;
  resultPath: string;
}): Promise<{
  session: ProspectiveTrialSession;
  path: string;
  observation: ScholarResearchEvaluationObservation;
  observationsPath: string;
}> {
  const { protocol, directory } = await readProspectiveTrialProtocol(input);
  const path = prospectiveSessionPath(directory, input.conditionIndex);
  const session = JSON.parse(await readFile(path, "utf8")) as ProspectiveTrialSession;
  const result = JSON.parse(
    await readFile(resolve(input.resultPath), "utf8")
  ) as ProspectiveTrialSessionResult;
  const resultErrors = validateProspectiveTrialSessionResult(result);
  if (resultErrors.length > 0) {
    throw new Error(`Prospective trial result is invalid: ${resultErrors.join(" ")}`);
  }
  const resultHash = hash(JSON.stringify(result));
  const observationId = `prospective-${protocol.trialId}-${input.conditionIndex}`;
  if (session.status === "completed") {
    if (session.resultHash !== resultHash || session.observationId !== observationId) {
      throw new Error(`Session ${session.sessionId} is already completed with a different result.`);
    }
    const observationsPath = join(observationDirectory(input.cwd, input.planId), "observations.jsonl");
    const observation = (await readFile(observationsPath, "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ScholarResearchEvaluationObservation)
      .find((entry) => entry.observationId === observationId);
    if (!observation) throw new Error(`Completed session ${session.sessionId} has no observation.`);
    return { session, path, observation, observationsPath };
  }
  const completedAt = new Date().toISOString();
  const elapsedMs = Date.parse(completedAt) - Date.parse(session.startedAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new Error("Session startedAt is invalid or later than completion time.");
  }
  if (result.activeHumanMs > elapsedMs) {
    throw new Error("activeHumanMs cannot exceed wall-clock session elapsed time.");
  }
  if (result.acceptedArtifactAt &&
      (Date.parse(result.acceptedArtifactAt) < Date.parse(session.startedAt) ||
       Date.parse(result.acceptedArtifactAt) > Date.parse(completedAt))) {
    throw new Error("acceptedArtifactAt must fall within the session window.");
  }
  const observation: ScholarResearchEvaluationObservation = {
    schema: "longtable.scholar-research-evaluation-observation",
    version: 1,
    observationId,
    planId: protocol.planId,
    taskId: protocol.taskId,
    layer: "prospective",
    condition: session.condition,
    crossoverPairId: session.crossoverPairId,
    provider: protocol.provider,
    model: protocol.model,
    modelVersion: protocol.modelVersion,
    corpusCutoff: protocol.corpusCutoff,
    permissionsProfile: protocol.permissionsProfile,
    stageProfile: session.stageProfile,
    startedAt: session.startedAt,
    ...(result.acceptedArtifactAt ? { acceptedArtifactAt: result.acceptedArtifactAt } : {}),
    completedAt,
    quality: result.quality,
    metrics: {
      elapsedMs,
      activeHumanMs: result.activeHumanMs,
      interruptionCount: result.interruptionCount,
      repeatedQuestionCount: result.repeatedQuestionCount,
      contextSwitchCount: result.contextSwitchCount,
      reworkCount: result.reworkCount,
      toolCallCount: result.toolCallCount,
      ...(result.tokenCount !== undefined ? { tokenCount: result.tokenCount } : {}),
      ...(result.monetaryCost !== undefined ? { monetaryCost: result.monetaryCost } : {}),
      abandoned: result.abandoned,
      ...(result.researcherEffort !== undefined
        ? { researcherEffort: result.researcherEffort }
        : {}),
      ...(result.researcherTrust !== undefined
        ? { researcherTrust: result.researcherTrust }
        : {})
    },
    artifactRefs: result.artifactRefs,
    notes: result.notes
  };
  const observationTempPath = join(directory, "sessions", `session-${input.conditionIndex}-observation.json`);
  await writeFile(observationTempPath, `${JSON.stringify(observation, null, 2)}\n`, "utf8");
  const recorded = await recordScholarResearchEvaluationObservation({
    cwd: input.cwd,
    planId: input.planId,
    observationPath: observationTempPath
  });
  const completedSession: ProspectiveTrialSession = {
    ...session,
    status: "completed",
    completedAt,
    observationId,
    resultHash
  };
  await writeFile(path, `${JSON.stringify(completedSession, null, 2)}\n`, "utf8");
  return {
    session: completedSession,
    path,
    observation: recorded.observation,
    observationsPath: recorded.path
  };
}

export async function readProspectiveTrialStatus(input: {
  cwd: string;
  planId: string;
  trialId: string;
}): Promise<{
  protocol: ProspectiveTrialProtocol;
  sessions: Array<ProspectiveTrialSession | null>;
  nextConditionIndex: number | null;
}> {
  const { protocol, directory } = await readProspectiveTrialProtocol(input);
  const sessions: Array<ProspectiveTrialSession | null> = [];
  for (const condition of protocol.conditionOrder) {
    try {
      sessions.push(JSON.parse(
        await readFile(prospectiveSessionPath(directory, condition.index), "utf8")
      ) as ProspectiveTrialSession);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      sessions.push(null);
    }
  }
  const running = sessions.find((session) => session?.status === "running");
  const unstarted = sessions.findIndex((session) => session === null);
  return {
    protocol,
    sessions,
    nextConditionIndex: running?.conditionIndex ?? (unstarted >= 0 ? unstarted : null)
  };
}

function qualityPassed(observation: ScholarResearchEvaluationObservation): boolean {
  return EVALUATION_QUALITY_GATES.every((gate) => observation.quality[gate] === false);
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function validateScholarResearchEvaluationObservation(
  observation: ScholarResearchEvaluationObservation
): string[] {
  const errors: string[] = [];
  if (observation.schema !== "longtable.scholar-research-evaluation-observation" ||
      observation.version !== 1) errors.push("Unsupported evaluation observation schema or version.");
  for (const [field, value] of [
    ["observationId", observation.observationId],
    ["planId", observation.planId],
    ["taskId", observation.taskId],
    ["provider", observation.provider],
    ["model", observation.model],
    ["modelVersion", observation.modelVersion],
    ["corpusCutoff", observation.corpusCutoff],
    ["permissionsProfile", observation.permissionsProfile],
    ["startedAt", observation.startedAt],
    ["completedAt", observation.completedAt]
  ] as const) {
    if (!value?.trim()) errors.push(`${field} is required.`);
  }
  if (!["fixture", "replay", "prospective"].includes(observation.layer)) {
    errors.push("Invalid evaluation layer.");
  }
  if (!["workflow_off", "workflow_on", "frontier_ceiling"].includes(observation.condition)) {
    errors.push("Invalid evaluation condition.");
  }
  if (!observation.stageProfile?.length) errors.push("At least one enabled-stage label is required.");
  if (!observation.artifactRefs?.length) errors.push("At least one artifact reference is required.");
  for (const gate of EVALUATION_QUALITY_GATES) {
    if (typeof observation.quality?.[gate] !== "boolean") {
      errors.push(`Quality gate ${gate} must be a boolean failure flag.`);
    }
  }
  for (const field of [
    "elapsedMs",
    "activeHumanMs",
    "interruptionCount",
    "repeatedQuestionCount",
    "contextSwitchCount",
    "reworkCount",
    "toolCallCount"
  ] as const) {
    const value = observation.metrics?.[field];
    if (!Number.isFinite(value) || value < 0) errors.push(`Metric ${field} must be finite and non-negative.`);
  }
  for (const field of ["researcherEffort", "researcherTrust"] as const) {
    const value = observation.metrics?.[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 1 || value > 7)) {
      errors.push(`${field} must be between 1 and 7 when supplied.`);
    }
  }
  const startedAt = Date.parse(observation.startedAt);
  const completedAt = Date.parse(observation.completedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) {
    errors.push("startedAt and completedAt must be valid timestamps.");
  } else if (completedAt < startedAt) {
    errors.push("completedAt cannot precede startedAt.");
  }
  if (observation.acceptedArtifactAt) {
    const acceptedAt = Date.parse(observation.acceptedArtifactAt);
    if (!Number.isFinite(acceptedAt)) {
      errors.push("acceptedArtifactAt must be a valid timestamp.");
    } else if (Number.isFinite(startedAt) && Number.isFinite(completedAt) &&
      (acceptedAt < startedAt || acceptedAt > completedAt)) {
      errors.push("acceptedArtifactAt must fall within the observation window.");
    }
  }
  if (!observation.metrics.abandoned && qualityPassed(observation) && !observation.acceptedArtifactAt) {
    errors.push("A non-abandoned quality-passing observation requires acceptedArtifactAt.");
  }
  return errors;
}

export async function recordScholarResearchEvaluationObservation(input: {
  cwd: string;
  planId: string;
  observationPath: string;
}): Promise<{ observation: ScholarResearchEvaluationObservation; path: string }> {
  const directory = observationDirectory(input.cwd, input.planId);
  const planPath = join(directory, "evaluation-plan.json");
  const plan = JSON.parse(await readFile(planPath, "utf8")) as ScholarResearchEvaluationPlan;
  const observation = JSON.parse(
    await readFile(resolve(input.observationPath), "utf8")
  ) as ScholarResearchEvaluationObservation;
  if (observation.planId !== plan.planId) throw new Error("Observation planId does not match the evaluation plan.");
  const errors = validateScholarResearchEvaluationObservation(observation);
  if (errors.length > 0) throw new Error(`Evaluation observation is invalid: ${errors.join(" ")}`);
  const observationsPath = join(directory, "observations.jsonl");
  let existing: ScholarResearchEvaluationObservation[] = [];
  try {
    existing = (await readFile(observationsPath, "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ScholarResearchEvaluationObservation);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const prior = existing.find((entry) => entry.observationId === observation.observationId);
  if (prior) {
    if (JSON.stringify(prior) !== JSON.stringify(observation)) {
      throw new Error(`Observation ${observation.observationId} already exists with different content.`);
    }
    return { observation: prior, path: observationsPath };
  }
  await appendFile(observationsPath, `${JSON.stringify(observation)}\n`, "utf8");
  return { observation, path: observationsPath };
}

function summarizeCondition(
  condition: ScholarResearchEvaluationObservation["condition"],
  observations: ScholarResearchEvaluationObservation[]
): ScholarResearchEvaluationReport["conditionSummary"][number] {
  const selected = observations.filter((entry) => entry.condition === condition);
  const passes = selected.filter(qualityPassed);
  return {
    condition,
    observations: selected.length,
    qualityPasses: passes.length,
    qualityPassRate: selected.length > 0 ? passes.length / selected.length : 0,
    ...(median(passes.map((entry) => entry.metrics.elapsedMs)) !== undefined
      ? { medianElapsedMs: median(passes.map((entry) => entry.metrics.elapsedMs)) }
      : {}),
    ...(median(passes.map((entry) => entry.metrics.activeHumanMs)) !== undefined
      ? { medianActiveHumanMs: median(passes.map((entry) => entry.metrics.activeHumanMs)) }
      : {}),
    ...(median(passes.map((entry) => entry.metrics.interruptionCount)) !== undefined
      ? { medianInterruptions: median(passes.map((entry) => entry.metrics.interruptionCount)) }
      : {}),
    ...(median(passes.flatMap((entry) => entry.metrics.researcherEffort === undefined ? [] : [entry.metrics.researcherEffort])) !== undefined
      ? { medianEffort: median(passes.flatMap((entry) => entry.metrics.researcherEffort === undefined ? [] : [entry.metrics.researcherEffort])) }
      : {}),
    ...(median(passes.flatMap((entry) => entry.metrics.researcherTrust === undefined ? [] : [entry.metrics.researcherTrust])) !== undefined
      ? { medianTrust: median(passes.flatMap((entry) => entry.metrics.researcherTrust === undefined ? [] : [entry.metrics.researcherTrust])) }
      : {})
  };
}

function buildAblations(observations: ScholarResearchEvaluationObservation[]): ScholarResearchEvaluationReport["ablations"] {
  const prospective = observations.filter(
    (entry) => entry.layer === "prospective" && entry.crossoverPairId
  );
  const protectedStages = new Set<string>(PROSPECTIVE_TRIAL_PROTECTED_STAGES);
  const stages = [...new Set(prospective.flatMap((entry) => entry.stageProfile))]
    .filter((stage) => !protectedStages.has(stage))
    .sort();
  return stages.map((stage) => {
    const pairs = new Map<string, ScholarResearchEvaluationObservation[]>();
    for (const observation of prospective) {
      const id = observation.crossoverPairId!;
      pairs.set(id, [...(pairs.get(id) ?? []), observation]);
    }
    const matched = [...pairs.values()].flatMap((entries) => {
      const enabled = entries.find((entry) => entry.stageProfile.includes(stage));
      const disabled = entries.find((entry) => !entry.stageProfile.includes(stage));
      return enabled && disabled ? [{ enabled, disabled }] : [];
    });
    const qualityLossWhenRemoved = matched.filter(
      ({ enabled, disabled }) => qualityPassed(enabled) && !qualityPassed(disabled)
    ).length;
    const activeDeltas = matched
      .filter(({ enabled, disabled }) => qualityPassed(enabled) && qualityPassed(disabled))
      .map(({ enabled, disabled }) => enabled.metrics.activeHumanMs - disabled.metrics.activeHumanMs);
    const elapsedDeltas = matched
      .filter(({ enabled, disabled }) => qualityPassed(enabled) && qualityPassed(disabled))
      .map(({ enabled, disabled }) => enabled.metrics.elapsedMs - disabled.metrics.elapsedMs);
    const effortDeltas = matched.flatMap(({ enabled, disabled }) =>
      enabled.metrics.researcherEffort !== undefined &&
      disabled.metrics.researcherEffort !== undefined
        ? [enabled.metrics.researcherEffort - disabled.metrics.researcherEffort]
        : []
    );
    const trustDeltas = matched.flatMap(({ enabled, disabled }) =>
      enabled.metrics.researcherTrust !== undefined &&
      disabled.metrics.researcherTrust !== undefined
        ? [enabled.metrics.researcherTrust - disabled.metrics.researcherTrust]
        : []
    );
    const activeDelta = median(activeDeltas);
    const elapsedDelta = median(elapsedDeltas);
    const effortDelta = median(effortDeltas);
    const trustDelta = median(trustDeltas);
    let verdict: ScholarResearchEvaluationReport["ablations"][number]["verdict"] = "insufficient_evidence";
    let reason = "At least three matched prospective crossover pairs are required.";
    if (matched.length >= 3) {
      if (qualityLossWhenRemoved > 0) {
        verdict = "retain";
        reason = "Removing the stage caused at least one non-compensatory quality failure.";
      } else if (
        ((activeDelta ?? 0) > 0 || (elapsedDelta ?? 0) > 0) &&
        effortDelta !== undefined && effortDelta >= 0 &&
        trustDelta !== undefined && trustDelta <= 0
      ) {
        verdict = "remove_candidate";
        reason = "The enabled stage added time or human burden without observed hard-gate or trust benefit in matched prospective pairs.";
      } else {
        verdict = "simplify_or_opt_in";
        reason = "No hard-gate loss was observed; keep only if its marginal interpretive value is confirmed by researchers.";
      }
    }
    return {
      stage,
      matchedPairs: matched.length,
      verdict,
      qualityLossWhenRemoved,
      ...(activeDelta !== undefined ? { medianActiveHumanMsDeltaWhenEnabled: activeDelta } : {}),
      ...(elapsedDelta !== undefined ? { medianElapsedMsDeltaWhenEnabled: elapsedDelta } : {}),
      ...(effortDelta !== undefined ? { medianEffortDeltaWhenEnabled: effortDelta } : {}),
      ...(trustDelta !== undefined ? { medianTrustDeltaWhenEnabled: trustDelta } : {}),
      reason
    };
  });
}

export async function writeScholarResearchEvaluationReport(input: {
  cwd: string;
  planId: string;
}): Promise<{ report: ScholarResearchEvaluationReport; path: string }> {
  const directory = observationDirectory(input.cwd, input.planId);
  const observationsPath = join(directory, "observations.jsonl");
  let observations: ScholarResearchEvaluationObservation[] = [];
  try {
    observations = (await readFile(observationsPath, "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ScholarResearchEvaluationObservation);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const prospective = observations.filter((entry) => entry.layer === "prospective");
  const pairGroups = new Map<string, ScholarResearchEvaluationObservation[]>();
  for (const observation of prospective.filter((entry) => entry.crossoverPairId)) {
    const pairId = observation.crossoverPairId!;
    pairGroups.set(pairId, [...(pairGroups.get(pairId) ?? []), observation]);
  }
  const matchedPairs = [...pairGroups.values()].filter((entries) =>
    entries.some((entry) => entry.condition === "workflow_off") &&
    entries.some((entry) => entry.condition === "workflow_on")
  );
  const ratedMatchedPairs = matchedPairs.filter((entries) =>
    entries
      .filter((entry) => entry.condition === "workflow_off" || entry.condition === "workflow_on")
      .every((entry) =>
        entry.metrics.researcherEffort !== undefined &&
        entry.metrics.researcherTrust !== undefined
      )
  );
  const report: ScholarResearchEvaluationReport = {
    schema: "longtable.scholar-research-evaluation-report",
    version: 1,
    planId: normalizePlanId(input.planId),
    createdAt: new Date().toISOString(),
    observationCount: observations.length,
    prospectiveCount: prospective.length,
    matchedProspectivePairs: matchedPairs.length,
    conditionSummary: (["workflow_off", "workflow_on", "frontier_ceiling"] as const)
      .map((condition) => summarizeCondition(condition, observations)),
    ablations: buildAblations(observations),
    promotionEligible: matchedPairs.length >= 3 &&
      ratedMatchedPairs.length === matchedPairs.length,
    limitations: [
      ...(matchedPairs.length < 3
        ? ["Fewer than three complete prospective crossover pairs are recorded."]
        : []),
      ...(ratedMatchedPairs.length < matchedPairs.length
        ? ["Some matched prospective pairs lack researcher effort or trust ratings."]
        : []),
      ...(!prospective.some((entry) => entry.condition === "workflow_off")
        ? ["No prospective workflow-off condition is recorded."]
        : []),
      ...(!prospective.some((entry) => entry.condition === "workflow_on")
        ? ["No prospective workflow-on condition is recorded."]
        : [])
    ]
  };
  const path = join(directory, "evaluation-report.json");
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { report, path };
}
