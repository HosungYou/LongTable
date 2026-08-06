import {
  INSTITUTIONAL_RESEARCH_HARD_STOPS,
  nextInstitutionalResearchStage,
  type InstitutionalResearchHardStop,
  type InstitutionalResearchStage,
  type ResearchRun,
  type StageReceipt
} from "./workflow-types.js";

export interface CreateResearchRunInput {
  readonly id: string;
  readonly createdAt?: string;
  readonly stage?: InstitutionalResearchStage;
  readonly protocolRevisionId?: string;
  readonly institutionProfileId?: string;
}

export interface CreateStageReceiptInput extends StageReceipt {}

export interface BlockResearchRunInput {
  readonly code: InstitutionalResearchHardStop;
  readonly questionRecordId: string;
  readonly checkpointKey: string;
  readonly safeCursor: string;
  readonly blockedAt?: string;
}

export interface ResearchDecisionRecordReference {
  readonly id: string;
  readonly checkpointKey: string;
  readonly questionRecordId: string;
}

function now(): string {
  return new Date().toISOString();
}

function immutable<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      immutable(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function requireText(value: string | undefined, label: string): string {
  if (!value?.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

export function createResearchRun(input: CreateResearchRunInput): ResearchRun {
  const createdAt = input.createdAt ?? now();
  return immutable({
    id: requireText(input.id, "Research run ID"),
    createdAt,
    updatedAt: createdAt,
    status: "planned",
    stage: input.stage ?? "SETUP",
    ...(input.protocolRevisionId ? { protocolRevisionId: input.protocolRevisionId } : {}),
    ...(input.institutionProfileId ? { institutionProfileId: input.institutionProfileId } : {})
  });
}

export function createStageReceipt(input: CreateStageReceiptInput): StageReceipt {
  requireText(input.id, "StageReceipt ID");
  requireText(input.runId, "StageReceipt run ID");
  requireText(input.protocolRevisionId, "StageReceipt protocol revision ID");
  requireText(input.cursor, "StageReceipt cursor");
  return immutable({
    ...input,
    inputArtifactIds: [...input.inputArtifactIds],
    outputArtifactIds: [...input.outputArtifactIds]
  });
}

function assertReceiptMatchesRun(run: ResearchRun, receipt: StageReceipt): void {
  if (run.status === "blocked") {
    throw new Error("A blocked research run requires a linked DecisionRecord before it can advance.");
  }
  if (run.status === "completed" || run.status === "failed") {
    throw new Error(`A ${run.status} research run cannot advance.`);
  }
  if (receipt.runId !== run.id) {
    throw new Error("StageReceipt belongs to a different research run.");
  }
  if (receipt.stage !== run.stage) {
    throw new Error(`StageReceipt must complete the current stage ${run.stage}.`);
  }
  if (run.protocolRevisionId && receipt.protocolRevisionId !== run.protocolRevisionId) {
    throw new Error("StageReceipt protocol revision does not match the research run.");
  }
}

export function advanceResearchRun(
  run: ResearchRun,
  receipt: StageReceipt,
  advancedAt = now()
): ResearchRun {
  assertReceiptMatchesRun(run, receipt);
  const nextStage = nextInstitutionalResearchStage(run.stage);
  return immutable({
    ...run,
    updatedAt: advancedAt,
    status: nextStage ? "running" : "completed",
    stage: nextStage ?? run.stage,
    latestSafeCursor: receipt.cursor
  });
}

export function blockResearchRun(run: ResearchRun, input: BlockResearchRunInput): ResearchRun {
  if (!INSTITUTIONAL_RESEARCH_HARD_STOPS.includes(input.code)) {
    throw new Error(`Unknown institutional research hard stop: ${input.code}`);
  }
  requireText(input.questionRecordId, "Blocking QuestionRecord ID");
  requireText(input.checkpointKey, "Blocking checkpoint key");
  requireText(input.safeCursor, "Safe cursor");
  if (run.status === "completed" || run.status === "failed") {
    throw new Error(`A ${run.status} research run cannot be blocked.`);
  }

  const repeatedStop = run.status === "blocked" &&
    run.blockingCode === input.code &&
    run.blockingQuestionRecordId === input.questionRecordId &&
    run.blockingCheckpointKey === input.checkpointKey;

  return immutable({
    ...run,
    updatedAt: input.blockedAt ?? now(),
    status: "blocked",
    blockingQuestionRecordId: input.questionRecordId,
    blockingCode: input.code,
    blockingCheckpointKey: input.checkpointKey,
    latestSafeCursor: repeatedStop ? run.latestSafeCursor : input.safeCursor
  });
}

export function resumeResearchRun(
  run: ResearchRun,
  decisions: readonly ResearchDecisionRecordReference[],
  resumedAt = now()
): ResearchRun {
  if (run.status !== "blocked") {
    throw new Error("Only a blocked research run can resume.");
  }
  const questionRecordId = requireText(run.blockingQuestionRecordId, "Blocking QuestionRecord ID");
  const checkpointKey = requireText(run.blockingCheckpointKey, "Blocking checkpoint key");
  const decision = decisions.find((candidate) =>
    Boolean(candidate.id.trim()) &&
    candidate.questionRecordId === questionRecordId &&
    candidate.checkpointKey === checkpointKey
  );
  if (!decision) {
    throw new Error("A linked DecisionRecord is required before this research run can resume.");
  }

  const {
    blockingQuestionRecordId: _question,
    blockingCode: _code,
    blockingCheckpointKey: _checkpoint,
    ...safeRun
  } = run;
  return immutable({
    ...safeRun,
    updatedAt: resumedAt,
    status: "running",
    resumedByDecisionRecordId: decision.id
  });
}
