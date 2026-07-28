import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { runResearchSearch } from "./run.js";
import { buildScholarResearchRunScaffold, writeScholarResearchRunScaffold } from "./protocol.js";
import {
  acquirePublicOaFullText,
  ingestPdfDirectory,
  readFullTextManifest,
  type FullTextAccessClass,
  type FullTextManifestRecord,
  type ParsedPdfDocument,
  type PublicOaAcquisitionEvent,
  type PublicOaFetch
} from "./fulltext.js";
import {
  citationSlotsFromProviderPatch,
  prepareExtractionTaskPackets,
  prepareSynthesisTaskPacket,
  synthesisProposalFromProviderPatch,
  type AdjudicationRecord,
  type HumanCitationReview,
  type HumanSynthesisReview,
  type ProviderVerification,
  type ProviderSynthesisVerification,
  type PreparedExtractionTasks,
  type PreparedSynthesisTask,
  type SynthesisClaim
} from "./extraction.js";
import {
  validateVisualEvidenceContract,
  validateVisualPortfolioPlan,
  type HumanRenderedVisualReview,
  type HumanVisualContractReview,
  type VisualEvidenceContract,
  type VisualPortfolioPlan
} from "./visual-contract.js";
import {
  renderVisualArtifact,
  type MechanicalVisualQa,
  type VisualRenderManifest,
  type VisualRenderRequest
} from "./render.js";
import {
  buildResearchBrief,
  renderResearchBriefMarkdown,
  validateResearchBrief,
  type ResearchBrief
} from "./research-brief.js";
import {
  validateTargetJournalProfile,
  type TargetJournalProfile
} from "./journal-profile.js";
import {
  buildLawfulAccessPlan,
  validateLawfulAccessPlan,
  type LawfulAccessPlan
} from "./access-plan.js";
import type { EvidenceRun, RunResearchSearchInput, SearchFetch } from "./types.js";

export const SCHOLAR_RESEARCH_BUNDLE_VERSION = "1.0.0";

export const SCHOLAR_RESEARCH_STAGES = [
  "scope",
  "topic",
  "venue",
  "collect",
  "fulltext",
  "extract",
  "synthesize",
  "visual_contract",
  "implement",
  "render",
  "verify",
  "handoff"
] as const;

export type ScholarResearchStage = typeof SCHOLAR_RESEARCH_STAGES[number];
export type ScholarResearchStageStatus = "pending" | "running" | "awaiting_provider" | "awaiting_human" | "completed" | "blocked";
export type ScholarResearchWorkflowStatus =
  | "running"
  | "paused"
  | "waiting_for_checkpoint"
  | "completed"
  | "failed";

export type ScholarResearchCheckpointClass =
  | "scope_contract"
  | "access_corpus_boundary"
  | "evidence_direction_or_claim_strength"
  | "visual_evidence_contract"
  | "external_action";

export interface ScholarResearchStageState {
  stage: ScholarResearchStage;
  status: ScholarResearchStageStatus;
  inputHash?: string;
  startedAt?: string;
  completedAt?: string;
  outputRef?: string;
  blockedReason?: string;
  checkpointClass?: ScholarResearchCheckpointClass;
}

export interface ResearchBundleInput {
  query: string;
  researchBrief: ResearchBrief;
  targetJournal?: string;
  field?: string;
  must?: string;
  exclude?: string;
  sources?: string;
  limit?: number;
  allowPartial: boolean;
  publisherAccess: boolean;
  pdfDirectory?: string;
  pdfAccessClass?: FullTextAccessClass;
  autoAcquireOpenAccess: boolean;
}

export interface ProductivityTelemetry {
  startedAt: string;
  updatedAt: string;
  elapsedMs: number;
  activeHumanMs: number;
  interruptionCount: number;
  repeatedQuestionCount: number;
  contextSwitchCount: number;
  reworkCount: number;
  abandoned: boolean;
  acceptedArtifactAt?: string;
  researcherEffort?: number;
  researcherTrust?: number;
}

export interface ResearchBundle {
  schema: "longtable.research-bundle";
  version: typeof SCHOLAR_RESEARCH_BUNDLE_VERSION;
  runId: string;
  runDir: string;
  createdAt: string;
  updatedAt: string;
  status: ScholarResearchWorkflowStatus;
  input: ResearchBundleInput;
  stages: Record<ScholarResearchStage, ScholarResearchStageState>;
  artifacts: {
    researchBrief: {
      jsonPath: string;
      markdownPath: string;
      contentHash: string;
    };
    targetJournalProfile?: {
      profileId: string;
      path: string;
      contentHash: string;
      reviewedAt: string;
    };
    lawfulAccessPlan: {
      path: string;
      contentHash: string;
      plan: LawfulAccessPlan;
    };
    verifiedPackage?: {
      directory: string;
      readmePath: string;
      manifestPath: string;
      assurancePath: string;
      limitationsPath: string;
      verificationPath: string;
    };
    searchRun?: EvidenceRun;
    searchRunPath?: string;
    fullTextRecords?: FullTextManifestRecord[];
    publicOaAcquisition?: {
      eventsPath: string;
      attempted: number;
      acquired: number;
      failed: number;
      events: PublicOaAcquisitionEvent[];
    };
    extractionTasks?: PreparedExtractionTasks;
    providerPatches?: Array<{
      packetId: string;
      stage: ScholarResearchStage;
      provider: string;
      patchHash: string;
      path: string;
      recordedAt: string;
    }>;
    providerVerifications?: Array<{
      packetId: string;
      provider: string;
      proposalPatchHash: string;
      path: string;
      recordedAt: string;
    }>;
    adjudications?: Array<{ citationSlotId: string; path: string }>;
    citationSlotsPath?: string;
    synthesisTask?: PreparedSynthesisTask;
    synthesisVerifications?: Array<{
      packetId: string;
      provider: string;
      proposalPatchHash: string;
      path: string;
      recordedAt: string;
    }>;
    synthesisPath?: string;
    visualContracts?: Array<{
      id: string;
      status: "approved" | "rejected";
      path: string;
      decisionRecordId: string;
      reviewedAt: string;
    }>;
    visualPortfolio?: {
      portfolioId: string;
      contractIds: string[];
      path: string;
      registeredAt: string;
    };
    visualRenders?: Array<{
      contractId: string;
      manifestPath: string;
      qaPath: string;
      editableSourcePath: string;
      renderedAt: string;
    }>;
    finalVisualReviews?: Array<{
      contractId: string;
      decision: "accept" | "reject";
      path: string;
      reviewedAt: string;
    }>;
  };
  pendingCheckpoint?: {
    class: ScholarResearchCheckpointClass;
    stage: ScholarResearchStage;
    reason: string;
  };
  pauseReason?: string;
  telemetry: ProductivityTelemetry;
}

export interface ScholarResearchEvent {
  schema: "longtable.scholar-research-event";
  version: 1;
  sequence: number;
  eventId: string;
  occurredAt: string;
  runId: string;
  type:
    | "run_created"
    | "stage_started"
    | "stage_completed"
    | "stage_awaiting_provider"
    | "stage_awaiting_human"
    | "stage_blocked"
    | "workflow_paused"
    | "input_amended"
    | "provider_patch_recorded"
    | "provider_verification_recorded"
    | "human_citation_review_recorded"
    | "human_synthesis_review_recorded"
    | "visual_portfolio_registered"
    | "human_visual_review_recorded"
    | "visual_render_recorded"
    | "human_render_review_recorded"
    | "target_journal_profile_recorded";
  stage?: ScholarResearchStage;
  inputHash?: string;
  checkpointClass?: ScholarResearchCheckpointClass;
  reason?: string;
  outputRef?: string;
}

export interface EvidenceSpan {
  spanId?: string;
  sourceId: string;
  quote: string;
  locator: string;
  contentHash: string;
  sourceVersion: string;
  accessClass: string;
}

export interface CitationSlot {
  id: string;
  claim: string;
  status: "filled" | "provisional" | "unfilled" | "blocked";
  relation?: "supports" | "qualifies" | "contradicts";
  evidence?: EvidenceSpan;
}

export interface ProviderTaskPacket {
  schema: "longtable.provider-task-packet";
  version: 1;
  runId: string;
  stage: ScholarResearchStage;
  objective: string;
  boundedEvidence: EvidenceSpan[];
  allowedPatchPaths: string[];
  maxOutputCharacters: number;
}

export interface ProviderProposedPatchOperation {
  op: "add" | "replace";
  path: string;
  value: unknown;
}

export interface ProviderProposedPatch {
  schema: "longtable.provider-proposed-patch";
  version: 1;
  runId: string;
  stage: ScholarResearchStage;
  operations: ProviderProposedPatchOperation[];
}

export interface RunScholarResearchWorkflowInput extends Omit<
  ResearchBundleInput,
  "query" | "researchBrief" | "allowPartial" | "publisherAccess" | "autoAcquireOpenAccess"
> {
  cwd: string;
  query?: string;
  researchBrief?: ResearchBrief;
  runId?: string;
  allowPartial?: boolean;
  publisherAccess?: boolean;
  autoAcquireOpenAccess?: boolean;
  env?: Record<string, string | undefined>;
  fetch?: SearchFetch;
  fullTextParser?: (path: string) => Promise<ParsedPdfDocument>;
  oaFetch?: PublicOaFetch;
  oaResolveHost?: (hostname: string) => Promise<string[]>;
  globalPublicOaCacheRoot?: string;
}

function now(): string {
  return new Date().toISOString();
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function workflowPaths(runDir: string): { state: string; events: string; search: string } {
  return {
    state: join(runDir, "research-bundle.json"),
    events: join(runDir, "events.jsonl"),
    search: join(runDir, "artifacts", "search-run.json")
  };
}

function initialStages(): Record<ScholarResearchStage, ScholarResearchStageState> {
  return Object.fromEntries(
    SCHOLAR_RESEARCH_STAGES.map((stage) => [stage, { stage, status: "pending" }])
  ) as Record<ScholarResearchStage, ScholarResearchStageState>;
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function readEvents(path: string): Promise<ScholarResearchEvent[]> {
  try {
    const content = await readFile(path, "utf8");
    return content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as ScholarResearchEvent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function appendEvent(bundle: ResearchBundle, event: Omit<ScholarResearchEvent, "schema" | "version" | "sequence" | "eventId" | "occurredAt" | "runId">): Promise<void> {
  const paths = workflowPaths(bundle.runDir);
  const existing = await readEvents(paths.events);
  const occurredAt = now();
  const complete: ScholarResearchEvent = {
    schema: "longtable.scholar-research-event",
    version: 1,
    sequence: existing.length + 1,
    eventId: `event-${String(existing.length + 1).padStart(6, "0")}`,
    occurredAt,
    runId: bundle.runId,
    ...event
  };
  await appendFile(paths.events, `${JSON.stringify(complete)}\n`, "utf8");
}

async function persistBundle(bundle: ResearchBundle): Promise<void> {
  const timestamp = now();
  bundle.updatedAt = timestamp;
  bundle.telemetry.updatedAt = timestamp;
  bundle.telemetry.elapsedMs = Math.max(0, Date.parse(timestamp) - Date.parse(bundle.telemetry.startedAt));
  await writeJsonAtomic(workflowPaths(bundle.runDir).state, bundle);
}

async function beginStage(bundle: ResearchBundle, stage: ScholarResearchStage, input: unknown): Promise<string | undefined> {
  const inputHash = stableHash(input);
  const current = bundle.stages[stage];
  if ((current.status === "completed" || current.status === "awaiting_provider" || current.status === "awaiting_human") && current.inputHash === inputHash) {
    return undefined;
  }
  const startedAt = now();
  bundle.status = "running";
  bundle.stages[stage] = { stage, status: "running", inputHash, startedAt };
  await appendEvent(bundle, { type: "stage_started", stage, inputHash });
  await persistBundle(bundle);
  return inputHash;
}

async function awaitProviderStage(
  bundle: ResearchBundle,
  stage: ScholarResearchStage,
  inputHash: string,
  outputRef: string,
  reason: string
): Promise<void> {
  bundle.stages[stage] = {
    ...bundle.stages[stage],
    stage,
    status: "awaiting_provider",
    inputHash,
    outputRef
  };
  await appendEvent(bundle, {
    type: "stage_awaiting_provider",
    stage,
    inputHash,
    outputRef,
    reason
  });
  await persistBundle(bundle);
}

async function awaitHumanStage(
  bundle: ResearchBundle,
  stage: ScholarResearchStage,
  inputHash: string,
  outputRef: string,
  reason: string
): Promise<void> {
  bundle.status = "paused";
  bundle.stages[stage] = {
    ...bundle.stages[stage],
    stage,
    status: "awaiting_human",
    inputHash,
    outputRef
  };
  await appendEvent(bundle, {
    type: "stage_awaiting_human",
    stage,
    inputHash,
    outputRef,
    reason
  });
  await persistBundle(bundle);
}

async function completeStage(bundle: ResearchBundle, stage: ScholarResearchStage, inputHash: string, outputRef?: string): Promise<void> {
  bundle.stages[stage] = {
    ...bundle.stages[stage],
    stage,
    status: "completed",
    inputHash,
    completedAt: now(),
    ...(outputRef ? { outputRef } : {})
  };
  await appendEvent(bundle, { type: "stage_completed", stage, inputHash, ...(outputRef ? { outputRef } : {}) });
  await persistBundle(bundle);
}

async function blockStage(bundle: ResearchBundle, stage: ScholarResearchStage, inputHash: string, checkpointClass: ScholarResearchCheckpointClass, reason: string): Promise<void> {
  bundle.status = "waiting_for_checkpoint";
  bundle.pendingCheckpoint = { class: checkpointClass, stage, reason };
  bundle.stages[stage] = {
    ...bundle.stages[stage],
    stage,
    status: "blocked",
    inputHash,
    blockedReason: reason,
    checkpointClass
  };
  await appendEvent(bundle, { type: "stage_blocked", stage, inputHash, checkpointClass, reason });
  await persistBundle(bundle);
}

async function pauseAtCapabilityBoundary(bundle: ResearchBundle, stage: ScholarResearchStage, reason: string): Promise<void> {
  bundle.status = "paused";
  bundle.pauseReason = reason;
  if (bundle.pauseReason !== reason || (await readEvents(workflowPaths(bundle.runDir).events)).at(-1)?.reason !== reason) {
    await appendEvent(bundle, { type: "workflow_paused", stage, reason });
  }
  await persistBundle(bundle);
}

export function citationSlotIsStrictlyFilled(slot: CitationSlot): boolean {
  if (slot.status !== "filled" || !slot.claim.trim() || !slot.relation || !slot.evidence) return false;
  const evidence = slot.evidence;
  return Boolean(
    evidence.sourceId.trim() &&
    evidence.quote.trim() &&
    evidence.locator.trim() &&
    evidence.contentHash.trim() &&
    evidence.sourceVersion.trim() &&
    evidence.accessClass.trim()
  );
}

export function buildProviderTaskPacket(input: Omit<ProviderTaskPacket, "schema" | "version">): ProviderTaskPacket {
  if (input.maxOutputCharacters < 1 || input.maxOutputCharacters > 100_000) {
    throw new Error("Provider task packets require maxOutputCharacters between 1 and 100000.");
  }
  return { schema: "longtable.provider-task-packet", version: 1, ...input };
}

export function validateProviderProposedPatch(
  packet: ProviderTaskPacket,
  patch: ProviderProposedPatch
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  function containsFilledStatus(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(containsFilledStatus);
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    if (record.status === "filled") return true;
    return Object.values(record).some(containsFilledStatus);
  }
  function citationCandidates(value: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(value)) return value.flatMap(citationCandidates);
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    if ("claim" in record || "evidence" in record || "status" in record) return [record];
    return Object.values(record).flatMap(citationCandidates);
  }
  function validateSynthesis(value: unknown): void {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push("Synthesis value must be an object.");
      return;
    }
    const proposal = value as Record<string, unknown>;
    if (typeof proposal.title !== "string" || !proposal.title.trim()) {
      errors.push("Synthesis requires a non-empty title.");
    }
    if (!Array.isArray(proposal.claims) || proposal.claims.length === 0) {
      errors.push("Synthesis requires at least one structured claim.");
      return;
    }
    const suppliedSlots = new Map(
      (((packet as ProviderTaskPacket & { citationSlots?: CitationSlot[] }).citationSlots) ?? [])
        .map((slot) => [slot.id, slot])
    );
    const claimIds = new Set<string>();
    for (const rawClaim of proposal.claims) {
      if (!rawClaim || typeof rawClaim !== "object" || Array.isArray(rawClaim)) {
        errors.push("Each synthesis claim must be an object.");
        continue;
      }
      const claim = rawClaim as Record<string, unknown>;
      if (typeof claim.id !== "string" || !claim.id.trim() || claimIds.has(claim.id)) {
        errors.push("Synthesis claims require unique non-empty ids.");
      } else {
        claimIds.add(claim.id);
      }
      if (typeof claim.text !== "string" || !claim.text.trim()) {
        errors.push("Synthesis claims require non-empty text.");
      }
      if (!["finding", "qualification", "conflict", "limitation"].includes(String(claim.role))) {
        errors.push("Synthesis claims require a valid role.");
      }
      if (!Array.isArray(claim.citationSlotIds) || claim.citationSlotIds.length === 0) {
        errors.push("Every synthesis claim requires at least one citation slot.");
        continue;
      }
      for (const slotId of claim.citationSlotIds) {
        const slot = suppliedSlots.get(String(slotId));
        if (!slot) {
          errors.push(`Synthesis claim references an unknown citation slot: ${String(slotId)}`);
        } else if (claim.role === "finding" && slot.status !== "filled") {
          errors.push(`Finding claims may cite only filled slots: ${String(slotId)}`);
        }
      }
    }
    const readingOrder = Array.isArray(proposal.readingOrder)
      ? proposal.readingOrder.map(String)
      : [];
    if (readingOrder.length !== claimIds.size ||
        new Set(readingOrder).size !== claimIds.size ||
        readingOrder.some((id) => !claimIds.has(id))) {
      errors.push("Synthesis readingOrder must list every claim id exactly once.");
    }
  }
  if (patch.schema !== "longtable.provider-proposed-patch" || patch.version !== 1) {
    errors.push("Unsupported provider patch schema or version.");
  }
  if (patch.runId !== packet.runId || patch.stage !== packet.stage) {
    errors.push("Provider patch run or stage does not match its task packet.");
  }
  if (!Array.isArray(patch.operations) || patch.operations.length === 0) {
    errors.push("Provider patch must contain at least one operation.");
  }
  if (patch.stage === "synthesize" &&
      (patch.operations.length !== 1 || patch.operations[0]?.path !== "/synthesis")) {
    errors.push("Synthesis patches require exactly one /synthesis operation.");
  }
  for (const operation of patch.operations ?? []) {
    if (operation.op !== "add" && operation.op !== "replace") {
      errors.push(`Unsupported patch operation: ${String(operation.op)}`);
    }
    const allowed = packet.allowedPatchPaths.some(
      (path) => operation.path === path || operation.path.startsWith(`${path}/`)
    );
    if (!allowed) errors.push(`Patch path is outside the allowed boundary: ${operation.path}`);
    if (patch.stage === "extract" && containsFilledStatus(operation.value)) {
      errors.push("Provider extraction proposals cannot mark citation slots filled.");
    }
    if (patch.stage === "extract") {
      for (const candidate of citationCandidates(operation.value)) {
        if (candidate.status !== "provisional") {
          errors.push("Provider extraction candidates must have provisional status.");
        }
        if (typeof candidate.claim !== "string" || !candidate.claim.trim()) {
          errors.push("Provider extraction candidates require a non-empty claim.");
        }
        if (!["supports", "qualifies", "contradicts"].includes(String(candidate.relation))) {
          errors.push("Provider extraction candidates require a valid evidence relation.");
        }
        const evidence = candidate.evidence as Partial<EvidenceSpan> | undefined;
        const exactSpan = evidence && packet.boundedEvidence.some((span) =>
          span.sourceId === evidence.sourceId &&
          span.quote === evidence.quote &&
          span.locator === evidence.locator &&
          span.contentHash === evidence.contentHash &&
          span.sourceVersion === evidence.sourceVersion &&
          span.accessClass === evidence.accessClass
        );
        if (!exactSpan) {
          errors.push("Provider extraction evidence must exactly match a supplied bounded span.");
        }
      }
    }
    if (patch.stage === "synthesize") validateSynthesis(operation.value);
  }
  if (JSON.stringify(patch).length > packet.maxOutputCharacters) {
    errors.push("Provider patch exceeds the packet output bound.");
  }
  return { valid: errors.length === 0, errors };
}

async function createBundle(input: RunScholarResearchWorkflowInput): Promise<ResearchBundle> {
  const researchBrief = input.researchBrief
    ? validateResearchBrief(input.researchBrief)
    : buildResearchBrief({
        query: input.query ?? "",
        ...(input.targetJournal ? { targetJournal: input.targetJournal } : {}),
        ...(input.field ? { field: input.field } : {}),
        source: "cli"
      });
  const query = input.query?.trim() || researchBrief.candidateResearchQuestion;
  const targetJournal = input.targetJournal?.trim() || researchBrief.targetJournal || undefined;
  const desiredInput: ResearchBundleInput = {
    query,
    researchBrief,
    ...(targetJournal ? { targetJournal } : {}),
    ...(input.field?.trim() ? { field: input.field.trim() } : {}),
    ...(input.must?.trim() ? { must: input.must.trim() } : {}),
    ...(input.exclude?.trim() ? { exclude: input.exclude.trim() } : {}),
    ...(input.sources?.trim() ? { sources: input.sources.trim() } : {}),
    ...(input.limit ? { limit: input.limit } : {}),
    ...(input.pdfDirectory?.trim() ? { pdfDirectory: resolve(input.pdfDirectory.trim()) } : {}),
    ...(input.pdfAccessClass ? { pdfAccessClass: input.pdfAccessClass } : {}),
    allowPartial: input.allowPartial === true,
    publisherAccess: input.publisherAccess === true,
    autoAcquireOpenAccess: input.autoAcquireOpenAccess !== false
  };
  if (input.runId) {
    const candidate = buildScholarResearchRunScaffold({ cwd: input.cwd, runId: input.runId });
    try {
      const existing = JSON.parse(
        await readFile(workflowPaths(candidate.runDir).state, "utf8")
      ) as ResearchBundle;
      const comparableInput = input.researchBrief
        ? desiredInput
        : { ...desiredInput, researchBrief: existing.input.researchBrief };
      if (stableHash(existing.input) !== stableHash(comparableInput)) {
        throw new Error(`Scholar research run ${existing.runId} already exists with different inputs.`);
      }
      return existing;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const scaffold = await writeScholarResearchRunScaffold({
    cwd: input.cwd,
    ...(input.runId ? { runId: input.runId } : {})
  });
  const createdAt = now();
  const briefJsonPath = join(scaffold.runDir, "artifacts", "research-brief.json");
  const briefMarkdownPath = join(scaffold.runDir, "artifacts", "RESEARCH_BRIEF.md");
  const lawfulAccessPlan = validateLawfulAccessPlan(buildLawfulAccessPlan({
    runId: scaffold.runId,
    allowPublicOa: desiredInput.autoAcquireOpenAccess,
    hasUserPdfDirectory: Boolean(desiredInput.pdfDirectory),
    ...(desiredInput.pdfAccessClass ? { pdfAccessClass: desiredInput.pdfAccessClass } : {})
  }));
  const lawfulAccessPlanPath = join(scaffold.runDir, "artifacts", "lawful-access-plan.json");
  await writeJsonAtomic(briefJsonPath, researchBrief);
  await writeJsonAtomic(lawfulAccessPlanPath, lawfulAccessPlan);
  await mkdir(dirname(briefMarkdownPath), { recursive: true });
  await writeFile(briefMarkdownPath, renderResearchBriefMarkdown(researchBrief), "utf8");
  const bundle: ResearchBundle = {
    schema: "longtable.research-bundle",
    version: SCHOLAR_RESEARCH_BUNDLE_VERSION,
    runId: scaffold.runId,
    runDir: scaffold.runDir,
    createdAt,
    updatedAt: createdAt,
    status: "running",
    input: desiredInput,
    stages: initialStages(),
    artifacts: {
      researchBrief: {
        jsonPath: briefJsonPath,
        markdownPath: briefMarkdownPath,
        contentHash: `sha256:${stableHash(researchBrief)}`
      },
      lawfulAccessPlan: {
        path: lawfulAccessPlanPath,
        contentHash: `sha256:${stableHash(lawfulAccessPlan)}`,
        plan: lawfulAccessPlan
      }
    },
    telemetry: {
      startedAt: createdAt,
      updatedAt: createdAt,
      elapsedMs: 0,
      activeHumanMs: 0,
      interruptionCount: 0,
      repeatedQuestionCount: 0,
      contextSwitchCount: 0,
      reworkCount: 0,
      abandoned: false
    }
  };
  await appendEvent(bundle, { type: "run_created" });
  await persistBundle(bundle);
  return bundle;
}

export async function readResearchBundle(cwd: string, runId: string): Promise<ResearchBundle> {
  const scaffold = buildScholarResearchRunScaffold({ cwd, runId });
  return JSON.parse(await readFile(workflowPaths(scaffold.runDir).state, "utf8")) as ResearchBundle;
}

export async function findLatestScholarResearchRunId(cwd: string): Promise<string | undefined> {
  const root = resolve(cwd, ".longtable", "research-runs");
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const candidates = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const bundle = JSON.parse(await readFile(join(root, entry.name, "research-bundle.json"), "utf8")) as ResearchBundle;
        candidates.push({ runId: entry.name, updatedAt: bundle.updatedAt });
      } catch {
        // Legacy scaffold-only runs are not resumable ResearchBundles.
      }
    }
    return candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.runId;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function advanceBundle(bundle: ResearchBundle, runtime: {
  env?: Record<string, string | undefined>;
  fetch?: SearchFetch;
  fullTextParser?: (path: string) => Promise<ParsedPdfDocument>;
  oaFetch?: PublicOaFetch;
  oaResolveHost?: (hostname: string) => Promise<string[]>;
  globalPublicOaCacheRoot?: string;
}): Promise<ResearchBundle> {
  let hash = await beginStage(bundle, "scope", {
    researchBrief: bundle.input.researchBrief,
    field: bundle.input.field
  });
  if (hash) await completeStage(bundle, "scope", hash, bundle.artifacts.researchBrief.jsonPath);

  hash = await beginStage(bundle, "topic", { query: bundle.input.query, must: bundle.input.must, exclude: bundle.input.exclude });
  if (hash) await completeStage(bundle, "topic", hash);

  hash = await beginStage(bundle, "venue", { targetJournal: bundle.input.targetJournal ?? null, mode: bundle.input.targetJournal ? "selected" : "discovery" });
  if (hash) await completeStage(bundle, "venue", hash);

  const collectInput = {
    query: bundle.input.query,
    field: bundle.input.field,
    must: bundle.input.must,
    exclude: bundle.input.exclude,
    sources: bundle.input.sources,
    limit: bundle.input.limit,
    allowPartial: bundle.input.allowPartial,
    publisherAccess: bundle.input.publisherAccess
  };
  hash = await beginStage(bundle, "collect", collectInput);
  if (hash) {
    const searchInput: RunResearchSearchInput = {
      query: bundle.input.query,
      ...(bundle.input.field ? { field: bundle.input.field } : {}),
      ...(bundle.input.must ? { must: bundle.input.must } : {}),
      ...(bundle.input.exclude ? { exclude: bundle.input.exclude } : {}),
      ...(bundle.input.sources ? { sources: bundle.input.sources } : {}),
      ...(bundle.input.limit ? { limit: bundle.input.limit } : {}),
      allowPartial: bundle.input.allowPartial,
      publisherAccess: bundle.input.publisherAccess,
      source: "cli",
      ...(runtime.env ? { env: runtime.env } : {}),
      ...(runtime.fetch ? { fetch: runtime.fetch } : {})
    };
    const searchRun = await runResearchSearch(searchInput);
    bundle.artifacts.searchRun = searchRun;
    const searchPath = workflowPaths(bundle.runDir).search;
    await writeJsonAtomic(searchPath, searchRun);
    bundle.artifacts.searchRunPath = searchPath;
    if (searchRun.status === "blocked") {
      await blockStage(
        bundle,
        "collect",
        hash,
        "access_corpus_boundary",
        searchRun.blockedReason ?? "The requested corpus cannot be collected under the current access boundary."
      );
      return bundle;
    }
    await completeStage(bundle, "collect", hash, searchPath);
  }

  const publicOaCandidates = (bundle.artifacts.searchRun?.cards ?? []).filter(
    (card) => card.legalFullTextAvailable
  );
  const autoAcquireOpenAccess = bundle.input.autoAcquireOpenAccess !== false;
  if (!bundle.input.pdfDirectory && (!autoAcquireOpenAccess || publicOaCandidates.length === 0)) {
    await pauseAtCapabilityBoundary(
      bundle,
      "fulltext",
      autoAcquireOpenAccess
        ? "No collected source exposed a public-OA full-text route. Supply a legitimate local PDF corpus with --pdf-dir and an explicit --pdf-access class."
        : "Automatic public-OA acquisition is disabled. Supply a legitimate local PDF corpus with --pdf-dir and an explicit --pdf-access class."
    );
    return bundle;
  }

  hash = await beginStage(bundle, "fulltext", {
    pdfDirectory: bundle.input.pdfDirectory ?? null,
    pdfAccessClass: bundle.input.pdfAccessClass ?? null,
    autoAcquireOpenAccess,
    publicOaCandidates: publicOaCandidates.map((card) => ({
      id: card.id,
      fullTextUrl: card.fullTextUrl ?? null,
      sourceRoute: card.sourceRoute
    }))
  });
  if (hash) {
    if (bundle.input.pdfDirectory && !bundle.input.pdfAccessClass) {
      await blockStage(
        bundle,
        "fulltext",
        hash,
        "access_corpus_boundary",
        "A PDF directory was supplied without an explicit access class."
      );
      return bundle;
    }
    if (autoAcquireOpenAccess && publicOaCandidates.length > 0) {
      const acquired = await acquirePublicOaFullText({
        cards: publicOaCandidates,
        runDir: bundle.runDir,
        ...(runtime.fullTextParser ? { parser: runtime.fullTextParser } : {}),
        ...(runtime.oaFetch ? { fetch: runtime.oaFetch } : {}),
        ...(runtime.oaResolveHost ? { resolveHost: runtime.oaResolveHost } : {}),
        ...(runtime.globalPublicOaCacheRoot
          ? { globalCacheRoot: runtime.globalPublicOaCacheRoot }
          : {})
      });
      bundle.artifacts.publicOaAcquisition = {
        eventsPath: acquired.eventsPath,
        attempted: acquired.events.length,
        acquired: acquired.events.filter((event) => event.status === "acquired").length,
        failed: acquired.events.filter((event) => event.status === "failed").length,
        events: acquired.events
      };
    }
    if (bundle.input.pdfDirectory && bundle.input.pdfAccessClass) {
      await ingestPdfDirectory({
        pdfDirectory: bundle.input.pdfDirectory,
        runDir: bundle.runDir,
        accessClass: bundle.input.pdfAccessClass,
        ...(runtime.fullTextParser ? { parser: runtime.fullTextParser } : {})
      });
    }
    const manifestPath = join(bundle.runDir, "sources", "manifest.jsonl");
    const records = await readFullTextManifest(manifestPath);
    if (records.length === 0) {
      await blockStage(
        bundle,
        "fulltext",
        hash,
        "access_corpus_boundary",
        `No full text was acquired from ${publicOaCandidates.length} public-OA candidate(s). Review typed acquisition failures or supply a legitimate local corpus.`
      );
      return bundle;
    }
    bundle.artifacts.fullTextRecords = records;
    await completeStage(bundle, "fulltext", hash, manifestPath);
  }

  const fullTextRecords = bundle.artifacts.fullTextRecords ?? [];
  hash = await beginStage(bundle, "extract", {
    query: bundle.input.query,
    records: fullTextRecords.map((record) => ({
      sourceId: record.sourceId,
      contentHash: record.contentHash,
      sourceVersion: record.sourceVersion,
      accessClass: record.accessClass
    }))
  });
  if (hash) {
    const tasks = await prepareExtractionTaskPackets({
      runId: bundle.runId,
      runDir: bundle.runDir,
      query: bundle.input.query,
      records: fullTextRecords
    });
    bundle.artifacts.extractionTasks = tasks;
    const manifestPath = join(bundle.runDir, "provider-tasks", "extract", "manifest.json");
    await awaitProviderStage(
      bundle,
      "extract",
      hash,
      manifestPath,
      "Bounded extraction packets are ready for a provider proposer and independent verifier."
    );
  }
  if (bundle.stages.extract.status !== "completed") {
    await pauseAtCapabilityBoundary(
      bundle,
      "extract",
      "Extraction packets are ready. Provider proposals must be schema-validated, independently verified, and human-reviewed before citation slots can be filled."
    );
    return bundle;
  }

  if (!bundle.artifacts.citationSlotsPath) {
    throw new Error("Extract is complete but no human-reviewed citation slot artifact is registered.");
  }
  const citationSlotSet = JSON.parse(
    await readFile(bundle.artifacts.citationSlotsPath, "utf8")
  ) as { citationSlots: CitationSlot[] };
  hash = await beginStage(bundle, "synthesize", {
    query: bundle.input.query,
    slots: citationSlotSet.citationSlots.map((slot) => ({
      id: slot.id,
      status: slot.status,
      relation: slot.relation,
      contentHash: slot.evidence?.contentHash,
      locator: slot.evidence?.locator
    }))
  });
  if (hash) {
    const task = await prepareSynthesisTaskPacket({
      runId: bundle.runId,
      runDir: bundle.runDir,
      query: bundle.input.query,
      citationSlots: citationSlotSet.citationSlots
    });
    bundle.artifacts.synthesisTask = task;
    await awaitProviderStage(
      bundle,
      "synthesize",
      hash,
      task.path,
      "A bounded synthesis packet is ready; unsupported narrative claims are prohibited."
    );
  }
  if (bundle.stages.synthesize.status !== "completed") {
    await pauseAtCapabilityBoundary(
      bundle,
      "synthesize",
      "Synthesis packet is ready for proposer, independent verifier, and human review of any direction or claim-strength change."
    );
    return bundle;
  }

  hash = await beginStage(bundle, "visual_contract", {
    synthesisPath: bundle.artifacts.synthesisPath,
    targetJournal: bundle.input.targetJournal ?? null
  });
  if (hash) {
    await blockStage(
      bundle,
      "visual_contract",
      hash,
      "visual_evidence_contract",
      "A human-approved VisualEvidenceContract is required before implementation or rendering."
    );
    return bundle;
  }

  if (bundle.status === "completed") return bundle;
  if (bundle.stages.implement.status === "pending") {
    await pauseAtCapabilityBoundary(
      bundle,
      "implement",
      "The approved visual contract is ready; supply an allowlisted render request to implement it."
    );
  } else if (bundle.stages.verify.status === "awaiting_human") {
    await pauseAtCapabilityBoundary(
      bundle,
      "verify",
      "Mechanical QA passed; final human review of the rendered artifact remains required."
    );
  }
  return bundle;
}

export async function runScholarResearchWorkflow(input: RunScholarResearchWorkflowInput): Promise<ResearchBundle> {
  if (!input.query?.trim() && !input.researchBrief) {
    throw new Error("LongTable Research requires --query <text> or --brief <path>.");
  }
  const bundle = await createBundle(input);
  return advanceBundle(bundle, {
    env: input.env,
    fetch: input.fetch,
    fullTextParser: input.fullTextParser,
    oaFetch: input.oaFetch,
    oaResolveHost: input.oaResolveHost,
    globalPublicOaCacheRoot: input.globalPublicOaCacheRoot
  });
}

export async function resumeScholarResearchWorkflow(input: {
  cwd: string;
  runId?: string;
  env?: Record<string, string | undefined>;
  fetch?: SearchFetch;
  fullTextParser?: (path: string) => Promise<ParsedPdfDocument>;
  oaFetch?: PublicOaFetch;
  oaResolveHost?: (hostname: string) => Promise<string[]>;
  globalPublicOaCacheRoot?: string;
  pdfDirectory?: string;
  pdfAccessClass?: FullTextAccessClass;
}): Promise<ResearchBundle> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No resumable scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  if (input.pdfDirectory || input.pdfAccessClass) {
    bundle.input = {
      ...bundle.input,
      ...(input.pdfDirectory ? { pdfDirectory: resolve(input.pdfDirectory) } : {}),
      ...(input.pdfAccessClass ? { pdfAccessClass: input.pdfAccessClass } : {})
    };
    bundle.pendingCheckpoint = undefined;
    bundle.pauseReason = undefined;
    if (bundle.stages.fulltext.status === "blocked") {
      bundle.stages.fulltext = { stage: "fulltext", status: "pending" };
    }
    bundle.status = "running";
    await appendEvent(bundle, {
      type: "input_amended",
      stage: "fulltext",
      reason: "Full-text corpus/access input amended through resume."
    });
    await persistBundle(bundle);
  }
  if (bundle.status === "waiting_for_checkpoint") return bundle;
  return advanceBundle(bundle, {
    env: input.env,
    fetch: input.fetch,
    fullTextParser: input.fullTextParser,
    oaFetch: input.oaFetch,
    oaResolveHost: input.oaResolveHost,
    globalPublicOaCacheRoot: input.globalPublicOaCacheRoot
  });
}

export interface ScholarResearchRunExplanation {
  schema: "longtable.scholar-research-run-explanation";
  version: 1;
  runId: string;
  stage: ScholarResearchStage;
  state: ScholarResearchStageState;
  events: ScholarResearchEvent[];
  input: ResearchBundleInput;
  pendingCheckpoint?: ResearchBundle["pendingCheckpoint"];
  pauseReason?: string;
}

export async function explainScholarResearchStage(input: {
  cwd: string;
  runId?: string;
  stage: ScholarResearchStage;
}): Promise<ScholarResearchRunExplanation> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  if (!SCHOLAR_RESEARCH_STAGES.includes(input.stage)) {
    throw new Error(`Unknown scholar-research stage: ${input.stage}`);
  }
  const bundle = await readResearchBundle(input.cwd, runId);
  const events = (await readEvents(workflowPaths(bundle.runDir).events))
    .filter((event) => event.stage === input.stage);
  return {
    schema: "longtable.scholar-research-run-explanation",
    version: 1,
    runId: bundle.runId,
    stage: input.stage,
    state: bundle.stages[input.stage],
    events,
    input: bundle.input,
    ...(bundle.pendingCheckpoint ? { pendingCheckpoint: bundle.pendingCheckpoint } : {}),
    ...(bundle.pauseReason ? { pauseReason: bundle.pauseReason } : {})
  };
}

export interface ScholarResearchRunVerification {
  schema: "longtable.scholar-research-run-verification";
  version: 1;
  runId: string;
  verifiedAt: string;
  passed: boolean;
  checks: Array<{
    id: string;
    passed: boolean;
    detail: string;
  }>;
  hardFailures: string[];
  warnings: string[];
}

export async function verifyScholarResearchRun(input: {
  cwd: string;
  runId?: string;
}): Promise<ScholarResearchRunVerification> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  const checks: ScholarResearchRunVerification["checks"] = [];
  const hardFailures: string[] = [];
  const warnings: string[] = [];
  const check = (id: string, passed: boolean, detail: string): void => {
    checks.push({ id, passed, detail });
    if (!passed) hardFailures.push(`${id}: ${detail}`);
  };

  check(
    "bundle_schema",
    bundle.schema === "longtable.research-bundle" &&
      bundle.version === SCHOLAR_RESEARCH_BUNDLE_VERSION,
    "ResearchBundle schema and version must match the runtime."
  );
  const events = await readEvents(workflowPaths(bundle.runDir).events);
  check(
    "event_sequence",
    events.length > 0 && events.every((event, index) =>
      event.sequence === index + 1 &&
      event.eventId === `event-${String(index + 1).padStart(6, "0")}` &&
      event.runId === bundle.runId
    ),
    "Event sequence, IDs, and run identity must be contiguous."
  );
  const completedStages = SCHOLAR_RESEARCH_STAGES.filter(
    (stage) => bundle.stages[stage].status === "completed"
  );
  check(
    "completed_stage_hashes",
    completedStages.every((stage) => Boolean(bundle.stages[stage].inputHash)),
    "Every completed stage must retain its input hash."
  );
  try {
    const brief = validateResearchBrief(
      JSON.parse(await readFile(bundle.artifacts.researchBrief.jsonPath, "utf8"))
    );
    check(
      "research_brief",
      `sha256:${stableHash(brief)}` === bundle.artifacts.researchBrief.contentHash &&
        brief.briefId === bundle.input.researchBrief.briefId,
      "The versioned Research Brief must match the bundle and its recorded hash."
    );
  } catch (error) {
    check("research_brief", false, error instanceof Error ? error.message : String(error));
  }
  try {
    const accessPlan = validateLawfulAccessPlan(
      JSON.parse(await readFile(bundle.artifacts.lawfulAccessPlan.path, "utf8"))
    );
    check(
      "lawful_access_plan",
      `sha256:${stableHash(accessPlan)}` === bundle.artifacts.lawfulAccessPlan.contentHash,
      "Lawful access routes and typed outcomes must preserve non-bypass boundaries without secrets."
    );
  } catch (error) {
    check("lawful_access_plan", false, error instanceof Error ? error.message : String(error));
  }
  if (bundle.artifacts.targetJournalProfile) {
    try {
      const profile = validateTargetJournalProfile(
        JSON.parse(await readFile(bundle.artifacts.targetJournalProfile.path, "utf8"))
      );
      check(
        "target_journal_profile",
        `sha256:${stableHash(profile)}` === bundle.artifacts.targetJournalProfile.contentHash,
        "Target-journal topic and format evidence must pass schema, provenance, and human-review gates."
      );
    } catch (error) {
      check("target_journal_profile", false, error instanceof Error ? error.message : String(error));
    }
  } else if (bundle.status === "completed") {
    check("target_journal_profile", false, "A completed run requires a target-journal profile.");
  }

  for (const record of bundle.artifacts.fullTextRecords ?? []) {
    try {
      const bytes = await readFile(record.storedPath);
      check(
        `fulltext_hash:${record.sourceId}`,
        `sha256:${createHash("sha256").update(bytes).digest("hex")}` === record.contentHash,
        "Stored full-text bytes must match the manifest content hash."
      );
      const derived = JSON.parse(await readFile(record.derivedTextPath, "utf8")) as {
        contentHash?: string;
        sourceVersion?: string;
        accessClass?: string;
        pages?: unknown[];
      };
      check(
        `fulltext_provenance:${record.sourceId}`,
        derived.contentHash === record.contentHash &&
          derived.sourceVersion === record.sourceVersion &&
          derived.accessClass === record.accessClass &&
          Array.isArray(derived.pages) &&
          derived.pages.length === record.pageCount,
        "Derived full text must preserve hash, version, access class, and page inventory."
      );
      const stored = resolve(record.storedPath);
      const runRoot = resolve(bundle.runDir);
      check(
        `storage_isolation:${record.sourceId}`,
        record.accessClass === "public_oa"
          ? record.storageClass === "global_public_cache"
          : record.storageClass === "project_isolated" &&
            (stored === runRoot || stored.startsWith(`${runRoot}${sep}`)),
        "Only public OA may use the global cache; all other content must remain inside the run."
      );
    } catch (error) {
      check(
        `fulltext_readback:${record.sourceId}`,
        false,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (bundle.artifacts.citationSlotsPath) {
    try {
      const set = JSON.parse(await readFile(bundle.artifacts.citationSlotsPath, "utf8")) as {
        citationSlots?: CitationSlot[];
      };
      check(
        "filled_citation_slots",
        Array.isArray(set.citationSlots) &&
          set.citationSlots
            .filter((slot) => slot.status === "filled")
            .every(citationSlotIsStrictlyFilled),
        "Every filled citation slot must retain exact evidence and provenance."
      );
    } catch (error) {
      check("citation_slot_readback", false, error instanceof Error ? error.message : String(error));
    }
  }
  for (const adjudicationRef of bundle.artifacts.adjudications ?? []) {
    try {
      const adjudication = JSON.parse(
        await readFile(adjudicationRef.path, "utf8")
      ) as AdjudicationRecord;
      check(
        `adjudication:${adjudicationRef.citationSlotId}`,
        adjudication.schema === "longtable.adjudication-record" &&
          adjudication.stage === "extract" &&
          adjudication.inputBundleVersion === bundle.version &&
          adjudication.inputBundleHash?.startsWith("sha256:") &&
          Boolean(adjudication.verifier.rationale?.trim()) &&
          Boolean(adjudication.errorClass) &&
          Boolean(adjudication.severity) &&
          Boolean(adjudication.createdAt) &&
          Boolean(adjudication.replayFixtureRef) &&
          (bundle.stages.extract.status !== "completed" || Boolean(adjudication.humanDecision)),
        "Adjudication must preserve bundle identity, original/verifier decision, error class, severity, rationale, replay reference, and required human correction."
      );
    } catch (error) {
      check(
        `adjudication_readback:${adjudicationRef.citationSlotId}`,
        false,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  for (const contractRecord of bundle.artifacts.visualContracts ?? []) {
    try {
      const contract = JSON.parse(
        await readFile(contractRecord.path, "utf8")
      ) as VisualEvidenceContract;
      const validation = validateVisualEvidenceContract(contract);
      check(
        `visual_contract:${contractRecord.id}`,
        validation.valid && contract.status === contractRecord.status,
        validation.valid
          ? "Visual contract status must match its bundle record."
          : validation.hardFailures.join(" ")
      );
    } catch (error) {
      check(
        `visual_contract_readback:${contractRecord.id}`,
        false,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  for (const renderRecord of bundle.artifacts.visualRenders ?? []) {
    try {
      const manifest = JSON.parse(
        await readFile(renderRecord.manifestPath, "utf8")
      ) as VisualRenderManifest;
      const qa = JSON.parse(await readFile(renderRecord.qaPath, "utf8")) as MechanicalVisualQa;
      const editable = await readFile(manifest.editableSourcePath);
      check(
        `visual_render:${renderRecord.contractId}`,
        qa.passed &&
          manifest.contractId === renderRecord.contractId &&
          `sha256:${createHash("sha256").update(editable).digest("hex")}` ===
            manifest.editableSourceHash,
        "Visual render must pass mechanical QA and preserve the editable-source hash."
      );
    } catch (error) {
      check(
        `visual_render_readback:${renderRecord.contractId}`,
        false,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  const expectedVisuals = bundle.artifacts.visualPortfolio?.contractIds ?? [];
  if (expectedVisuals.length > 0) {
    const approved = new Set(
      (bundle.artifacts.visualContracts ?? [])
        .filter((entry) => entry.status === "approved")
        .map((entry) => entry.id)
    );
    const rendered = new Set((bundle.artifacts.visualRenders ?? []).map((entry) => entry.contractId));
    const accepted = new Set(
      (bundle.artifacts.finalVisualReviews ?? [])
        .filter((entry) => entry.decision === "accept")
        .map((entry) => entry.contractId)
    );
    check(
      "visual_portfolio",
      bundle.status !== "completed" ||
        expectedVisuals.every((id) => approved.has(id) && rendered.has(id) && accepted.has(id)),
      "A completed portfolio run must approve, render, and accept every declared visual."
    );
  }

  if (bundle.status === "completed") {
    check(
      "completed_stage_set",
      SCHOLAR_RESEARCH_STAGES.every((stage) => bundle.stages[stage].status === "completed"),
      "A completed workflow must complete every declared stage."
    );
    const handoffPath = bundle.stages.handoff.outputRef;
    if (!handoffPath) {
      check("handoff_readback", false, "Completed workflow has no handoff path.");
    } else {
      try {
        const handoff = JSON.parse(await readFile(handoffPath, "utf8")) as {
          runId?: string;
          externalActionPerformed?: boolean;
        };
        check(
          "handoff_readback",
          handoff.runId === bundle.runId && handoff.externalActionPerformed === false,
          "Handoff must match the run and must not claim an unperformed external action."
        );
      } catch (error) {
        check("handoff_readback", false, error instanceof Error ? error.message : String(error));
      }
    }
    const verifiedPackage = bundle.artifacts.verifiedPackage;
    if (!verifiedPackage) {
      check("verified_research_package", false, "Completed workflow has no Verified Research Package.");
    } else {
      try {
        const manifest = JSON.parse(await readFile(verifiedPackage.manifestPath, "utf8")) as {
          schema?: string;
          version?: string;
          runId?: string;
          status?: string;
          files?: Array<{ role?: string; path?: string; contentHash?: string }>;
        };
        const files = manifest.files ?? [];
        let hashesPass = files.length > 0;
        for (const file of files) {
          if (!file.path || !file.contentHash || await fileHash(file.path) !== file.contentHash) {
            hashesPass = false;
            break;
          }
        }
        const requiredRoles = [
          "research_brief_json",
          "target_journal_profile",
          "lawful_access_plan",
          "search_manifest",
          "fulltext_manifest",
          "citation_claim_ledger",
          "synthesis",
          "visual_portfolio",
          "research_assurance",
          "limitations",
          "human_readme",
          "verification"
        ];
        check(
          "verified_research_package",
          manifest.schema === "longtable.verified-research-package" &&
            manifest.version === "1.0.0" &&
            manifest.runId === bundle.runId &&
            manifest.status === "verified" &&
            requiredRoles.every((role) => files.some((file) => file.role === role)) &&
            hashesPass,
          "Verified Research Package manifest, required roles, and file hashes must pass readback."
        );
      } catch (error) {
        check("verified_research_package", false, error instanceof Error ? error.message : String(error));
      }
    }
  } else {
    warnings.push(`Workflow status is ${bundle.status}; verification covers only materialized artifacts.`);
  }

  return {
    schema: "longtable.scholar-research-run-verification",
    version: 1,
    runId: bundle.runId,
    verifiedAt: now(),
    passed: hardFailures.length === 0,
    checks,
    hardFailures,
    warnings
  };
}

export async function recordScholarResearchProviderPatch(input: {
  cwd: string;
  runId?: string;
  packetPath: string;
  patchPath: string;
  provider: string;
}): Promise<{ bundle: ResearchBundle; record: NonNullable<ResearchBundle["artifacts"]["providerPatches"]>[number] }> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  const packetPath = resolve(input.packetPath);
  const knownExtractionPacket = bundle.artifacts.extractionTasks?.packets.some(
    (packet) => resolve(packet.path) === packetPath
  ) === true;
  const knownSynthesisPacket = bundle.artifacts.synthesisTask
    ? resolve(bundle.artifacts.synthesisTask.path) === packetPath
    : false;
  if (!knownExtractionPacket && !knownSynthesisPacket) {
    throw new Error("The provider packet is not registered in this ResearchBundle.");
  }
  const packet = JSON.parse(await readFile(packetPath, "utf8")) as ProviderTaskPacket & { packetId: string };
  const patch = JSON.parse(await readFile(resolve(input.patchPath), "utf8")) as ProviderProposedPatch;
  const validation = validateProviderProposedPatch(packet, patch);
  if (!validation.valid) {
    throw new Error(`Provider patch validation failed: ${validation.errors.join(" ")}`);
  }
  const provider = input.provider.trim();
  if (!provider) throw new Error("A provider label is required.");
  const patchHash = stableHash(patch);
  const recordedAt = now();
  const outputPath = join(
    bundle.runDir,
    "provider-results",
    packet.stage,
    `${packet.packetId}.${provider.replace(/[^\w.-]+/g, "-")}.${patchHash.slice(0, 12)}.json`
  );
  const existing = bundle.artifacts.providerPatches?.find(
    (record) => record.packetId === packet.packetId &&
      record.provider === provider &&
      record.patchHash === patchHash
  );
  if (existing) return { bundle, record: existing };
  await writeJsonAtomic(outputPath, {
    schema: "longtable.recorded-provider-patch",
    version: 1,
    packetId: packet.packetId,
    provider,
    recordedAt,
    patchHash,
    patch
  });
  const record = {
    packetId: packet.packetId,
    stage: packet.stage,
    provider,
    patchHash,
    path: outputPath,
    recordedAt
  };
  bundle.artifacts.providerPatches = [...(bundle.artifacts.providerPatches ?? []), record];
  await appendEvent(bundle, {
    type: "provider_patch_recorded",
    stage: packet.stage,
    outputRef: outputPath,
    reason: `Recorded schema-valid ${packet.stage} patch from ${provider}.`
  });
  await persistBundle(bundle);
  return { bundle, record };
}

export async function recordScholarResearchVerification(input: {
  cwd: string;
  runId?: string;
  verificationPath: string;
}): Promise<{ bundle: ResearchBundle; verificationPath: string; adjudicationPaths: string[] }> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  const verification = JSON.parse(
    await readFile(resolve(input.verificationPath), "utf8")
  ) as ProviderVerification;
  if (verification.schema !== "longtable.provider-verification" || verification.version !== 1 ||
      verification.runId !== bundle.runId || verification.independent !== true) {
    throw new Error("Invalid provider verification schema, run, or independence declaration.");
  }
  const proposalRecord = bundle.artifacts.providerPatches?.find(
    (record) => record.patchHash === verification.proposalPatchHash &&
      record.packetId === verification.packetId &&
      record.stage === "extract"
  );
  if (!proposalRecord) throw new Error("The verification does not reference a recorded provider proposal.");
  if (proposalRecord.provider === verification.provider) {
    throw new Error("The independent verifier must differ from the proposer.");
  }
  const recordedProposal = JSON.parse(await readFile(proposalRecord.path, "utf8")) as {
    patch: ProviderProposedPatch;
  };
  const slots = citationSlotsFromProviderPatch(recordedProposal.patch);
  const slotIds = new Set(slots.map((slot) => slot.id));
  const decisionIds = new Set(verification.decisions.map((decision) => decision.citationSlotId));
  if (decisionIds.size !== slotIds.size || [...slotIds].some((id) => !decisionIds.has(id))) {
    throw new Error("The verifier must decide every proposed citation slot exactly once.");
  }
  for (const decision of verification.decisions) {
    if (!["agree", "disagree", "uncertain"].includes(decision.decision) || !decision.rationale.trim()) {
      throw new Error(`Invalid verifier decision for ${decision.citationSlotId}.`);
    }
  }
  const verificationHash = stableHash(verification);
  const existing = bundle.artifacts.providerVerifications?.find(
    (record) => record.proposalPatchHash === proposalRecord.patchHash &&
      record.provider === verification.provider
  );
  if (existing) {
    return {
      bundle,
      verificationPath: existing.path,
      adjudicationPaths: (bundle.artifacts.adjudications ?? []).map((record) => record.path)
    };
  }
  const recordedAt = now();
  const outputPath = join(
    bundle.runDir,
    "provider-results",
    "verify",
    `${verification.packetId}.${verification.provider.replace(/[^\w.-]+/g, "-")}.${verificationHash.slice(0, 12)}.json`
  );
  await writeJsonAtomic(outputPath, verification);
  const adjudicationPaths: string[] = [];
  for (const slot of slots) {
    const decision = verification.decisions.find((entry) => entry.citationSlotId === slot.id)!;
    const adjudicationId = `adjudication-${stableHash({
      slot: slot.id,
      proposal: proposalRecord.patchHash
    }).slice(0, 16)}`;
    const errorClass: AdjudicationRecord["errorClass"] = decision.decision === "agree"
      ? "none"
      : decision.decision === "disagree"
        ? "claim_evidence_relation"
        : "insufficient_evidence";
    const adjudication: AdjudicationRecord = {
      schema: "longtable.adjudication-record",
      version: 1,
      id: adjudicationId,
      runId: bundle.runId,
      stage: "extract",
      inputBundleVersion: bundle.version,
      inputBundleHash: `sha256:${stableHash({
        runId: bundle.runId,
        input: bundle.input,
        extractInputHash: bundle.stages.extract.inputHash
      })}`,
      citationSlotId: slot.id,
      proposer: {
        provider: proposalRecord.provider,
        decision: slot.relation ?? "insufficient",
        evidenceSpanIds: slot.evidence?.spanId ? [slot.evidence.spanId] : []
      },
      verifier: {
        provider: verification.provider,
        independent: true,
        decision: decision.decision,
        evidenceSpanIds: decision.evidenceSpanIds,
        rationale: decision.rationale
      },
      errorClass,
      severity: decision.decision === "agree"
        ? "none"
        : decision.decision === "disagree"
          ? "high"
          : "medium",
      humanRequired: true,
      createdAt: recordedAt,
      replayFixtureRef: `adjudication:${bundle.runId}:${adjudicationId}`
    };
    const path = join(bundle.runDir, "adjudications", `${adjudication.id}.json`);
    await writeJsonAtomic(path, adjudication);
    adjudicationPaths.push(path);
  }
  bundle.artifacts.providerVerifications = [
    ...(bundle.artifacts.providerVerifications ?? []),
    {
      packetId: verification.packetId,
      provider: verification.provider,
      proposalPatchHash: proposalRecord.patchHash,
      path: outputPath,
      recordedAt
    }
  ];
  bundle.artifacts.adjudications = [
    ...(bundle.artifacts.adjudications ?? []),
    ...slots.map((slot, index) => ({ citationSlotId: slot.id, path: adjudicationPaths[index] }))
  ];
  bundle.stages.extract = { ...bundle.stages.extract, status: "awaiting_human" };
  await appendEvent(bundle, {
    type: "provider_verification_recorded",
    stage: "extract",
    outputRef: outputPath,
    reason: "Independent verification recorded; human review remains required for final claims."
  });
  await persistBundle(bundle);
  return { bundle, verificationPath: outputPath, adjudicationPaths };
}

export async function recordScholarResearchHumanCitationReview(input: {
  cwd: string;
  runId?: string;
  reviewPath: string;
}): Promise<{ bundle: ResearchBundle; citationSlots: CitationSlot[]; path: string }> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  const review = JSON.parse(await readFile(resolve(input.reviewPath), "utf8")) as HumanCitationReview;
  if (review.schema !== "longtable.human-citation-review" || review.version !== 1 ||
      review.runId !== bundle.runId || !review.reviewer.trim() || !review.reviewedAt) {
    throw new Error("Invalid human citation review.");
  }
  const proposedSlots: CitationSlot[] = [];
  for (const record of bundle.artifacts.providerPatches ?? []) {
    const recorded = JSON.parse(await readFile(record.path, "utf8")) as { patch: ProviderProposedPatch };
    proposedSlots.push(...citationSlotsFromProviderPatch(recorded.patch));
  }
  const uniqueSlots = new Map(proposedSlots.map((slot) => [slot.id, slot]));
  const decisions = new Map(review.decisions.map((decision) => [decision.citationSlotId, decision]));
  if (decisions.size !== uniqueSlots.size || [...uniqueSlots.keys()].some((id) => !decisions.has(id))) {
    throw new Error("Human review must decide every unique proposed citation slot exactly once.");
  }
  const citationSlots: CitationSlot[] = [];
  for (const [id, slot] of uniqueSlots) {
    const decision = decisions.get(id)!;
    if (!decision.rationale.trim()) throw new Error(`Human review rationale is required for ${id}.`);
    const reviewed: CitationSlot = {
      ...slot,
      status: decision.decision === "accept"
        ? "filled"
        : decision.decision === "reject"
          ? "unfilled"
          : "provisional"
    };
    if (reviewed.status === "filled" && !citationSlotIsStrictlyFilled(reviewed)) {
      throw new Error(`Accepted citation slot ${id} does not satisfy the strict evidence contract.`);
    }
    citationSlots.push(reviewed);
    const adjudicationRef = bundle.artifacts.adjudications?.find((entry) => entry.citationSlotId === id);
    if (adjudicationRef) {
      const adjudication = JSON.parse(await readFile(adjudicationRef.path, "utf8")) as AdjudicationRecord;
      adjudication.humanDecision = {
        reviewer: review.reviewer,
        adjudicatorRole: "domain_researcher",
        decision: decision.decision === "accept"
          ? "accept"
          : decision.decision === "reject"
            ? "reject"
            : "preserve_disagreement",
        decidedAt: review.reviewedAt,
        rationale: decision.rationale
      };
      await writeJsonAtomic(adjudicationRef.path, adjudication);
    }
  }
  const outputPath = join(bundle.runDir, "artifacts", "citation-slots.json");
  await writeJsonAtomic(outputPath, {
    schema: "longtable.citation-slot-set",
    version: 1,
    runId: bundle.runId,
    reviewedBy: review.reviewer,
    reviewedAt: review.reviewedAt,
    citationSlots
  });
  bundle.artifacts.citationSlotsPath = outputPath;
  await appendEvent(bundle, {
    type: "human_citation_review_recorded",
    stage: "extract",
    outputRef: outputPath,
    reason: "Human citation review recorded; only accepted strict slots are filled."
  });
  const inputHash = bundle.stages.extract.inputHash;
  if (!inputHash) throw new Error("Extract stage has no input hash.");
  await completeStage(bundle, "extract", inputHash, outputPath);
  return { bundle, citationSlots, path: outputPath };
}

export async function recordScholarResearchSynthesisVerification(input: {
  cwd: string;
  runId?: string;
  verificationPath: string;
}): Promise<{ bundle: ResearchBundle; path: string }> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  const verification = JSON.parse(
    await readFile(resolve(input.verificationPath), "utf8")
  ) as ProviderSynthesisVerification;
  if (verification.schema !== "longtable.provider-synthesis-verification" ||
      verification.version !== 1 || verification.runId !== bundle.runId ||
      verification.independent !== true) {
    throw new Error("Invalid synthesis verification schema, run, or independence declaration.");
  }
  const proposalRecord = bundle.artifacts.providerPatches?.find(
    (record) => record.stage === "synthesize" &&
      record.packetId === verification.packetId &&
      record.patchHash === verification.proposalPatchHash
  );
  if (!proposalRecord) throw new Error("Synthesis verification does not reference a recorded synthesis proposal.");
  if (proposalRecord.provider === verification.provider) {
    throw new Error("The synthesis verifier must differ from the proposer.");
  }
  const recorded = JSON.parse(await readFile(proposalRecord.path, "utf8")) as {
    patch: ProviderProposedPatch;
  };
  const proposal = synthesisProposalFromProviderPatch(recorded.patch);
  const claimIds = new Set(proposal.claims.map((claim) => claim.id));
  const decisionIds = new Set(verification.decisions.map((decision) => decision.claimId));
  if (decisionIds.size !== claimIds.size || [...claimIds].some((id) => !decisionIds.has(id))) {
    throw new Error("The synthesis verifier must decide every claim exactly once.");
  }
  for (const decision of verification.decisions) {
    if (!["agree", "disagree", "uncertain"].includes(decision.decision) || !decision.rationale.trim()) {
      throw new Error(`Invalid synthesis verifier decision for ${decision.claimId}.`);
    }
  }
  const existing = bundle.artifacts.synthesisVerifications?.find(
    (entry) => entry.proposalPatchHash === proposalRecord.patchHash &&
      entry.provider === verification.provider
  );
  if (existing) return { bundle, path: existing.path };
  const recordedAt = now();
  const verificationHash = stableHash(verification);
  const outputPath = join(
    bundle.runDir,
    "provider-results",
    "verify-synthesis",
    `${verification.packetId}.${verification.provider.replace(/[^\w.-]+/g, "-")}.${verificationHash.slice(0, 12)}.json`
  );
  await writeJsonAtomic(outputPath, verification);
  bundle.artifacts.synthesisVerifications = [
    ...(bundle.artifacts.synthesisVerifications ?? []),
    {
      packetId: verification.packetId,
      provider: verification.provider,
      proposalPatchHash: proposalRecord.patchHash,
      path: outputPath,
      recordedAt
    }
  ];
  bundle.stages.synthesize = { ...bundle.stages.synthesize, status: "awaiting_human" };
  await appendEvent(bundle, {
    type: "provider_verification_recorded",
    stage: "synthesize",
    outputRef: outputPath,
    reason: "Independent synthesis verification recorded; human claim review remains required."
  });
  await persistBundle(bundle);
  return { bundle, path: outputPath };
}

export async function recordScholarResearchHumanSynthesisReview(input: {
  cwd: string;
  runId?: string;
  reviewPath: string;
}): Promise<{ bundle: ResearchBundle; claims: Array<SynthesisClaim & { status: string }>; path: string }> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  const review = JSON.parse(
    await readFile(resolve(input.reviewPath), "utf8")
  ) as HumanSynthesisReview;
  if (review.schema !== "longtable.human-synthesis-review" || review.version !== 1 ||
      review.runId !== bundle.runId || !review.reviewer.trim() || !review.reviewedAt) {
    throw new Error("Invalid human synthesis review.");
  }
  const proposalRecord = bundle.artifacts.providerPatches?.find(
    (record) => record.stage === "synthesize" && record.patchHash === review.proposalPatchHash
  );
  if (!proposalRecord) throw new Error("Human synthesis review does not reference a recorded proposal.");
  const verification = bundle.artifacts.synthesisVerifications?.find(
    (record) => record.proposalPatchHash === proposalRecord.patchHash
  );
  if (!verification) throw new Error("Human synthesis review requires an independent provider verification.");
  const recorded = JSON.parse(await readFile(proposalRecord.path, "utf8")) as {
    patch: ProviderProposedPatch;
  };
  const proposal = synthesisProposalFromProviderPatch(recorded.patch);
  const claimIds = new Set(proposal.claims.map((claim) => claim.id));
  const decisions = new Map(review.decisions.map((decision) => [decision.claimId, decision]));
  if (decisions.size !== claimIds.size || [...claimIds].some((id) => !decisions.has(id))) {
    throw new Error("Human synthesis review must decide every claim exactly once.");
  }
  const claims = proposal.claims.map((claim) => {
    const decision = decisions.get(claim.id)!;
    if (!decision.rationale.trim()) throw new Error(`Human synthesis rationale is required for ${claim.id}.`);
    return {
      ...claim,
      status: decision.decision === "accept"
        ? "accepted"
        : decision.decision === "reject"
          ? "rejected"
          : "preserved_disagreement",
      humanRationale: decision.rationale
    };
  });
  const outputPath = join(bundle.runDir, "artifacts", "synthesis.json");
  await writeJsonAtomic(outputPath, {
    schema: "longtable.human-reviewed-synthesis",
    version: 1,
    runId: bundle.runId,
    title: proposal.title,
    readingOrder: proposal.readingOrder,
    reviewer: review.reviewer,
    reviewedAt: review.reviewedAt,
    claims
  });
  bundle.artifacts.synthesisPath = outputPath;
  await appendEvent(bundle, {
    type: "human_synthesis_review_recorded",
    stage: "synthesize",
    outputRef: outputPath,
    reason: "Human synthesis review recorded; rejected and disputed claims remain explicit."
  });
  const inputHash = bundle.stages.synthesize.inputHash;
  if (!inputHash) throw new Error("Synthesize stage has no input hash.");
  await completeStage(bundle, "synthesize", inputHash, outputPath);
  return { bundle, claims, path: outputPath };
}

export async function registerScholarResearchVisualPortfolio(input: {
  cwd: string;
  runId?: string;
  planPath: string;
}): Promise<{ bundle: ResearchBundle; plan: VisualPortfolioPlan; path: string }> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  if (bundle.stages.visual_contract.status !== "blocked" &&
      bundle.stages.visual_contract.status !== "awaiting_human") {
    throw new Error("A visual portfolio must be registered at the Visual Evidence Contract checkpoint.");
  }
  const plan = JSON.parse(
    await readFile(resolve(input.planPath), "utf8")
  ) as VisualPortfolioPlan;
  const errors = validateVisualPortfolioPlan(plan);
  if (errors.length > 0) throw new Error(`Visual portfolio plan is invalid: ${errors.join(" ")}`);
  if (plan.runId !== bundle.runId) throw new Error("Visual portfolio run does not match the ResearchBundle.");
  const outputPath = join(bundle.runDir, "artifacts", "visual-portfolio-plan.json");
  if (bundle.artifacts.visualPortfolio) {
    const existing = JSON.parse(
      await readFile(bundle.artifacts.visualPortfolio.path, "utf8")
    ) as VisualPortfolioPlan;
    if (JSON.stringify(existing) !== JSON.stringify(plan)) {
      throw new Error("A different visual portfolio is already frozen for this run.");
    }
    return { bundle, plan: existing, path: bundle.artifacts.visualPortfolio.path };
  }
  await writeJsonAtomic(outputPath, plan);
  bundle.artifacts.visualPortfolio = {
    portfolioId: plan.portfolioId,
    contractIds: plan.contractIds,
    path: outputPath,
    registeredAt: plan.registeredAt
  };
  await appendEvent(bundle, {
    type: "visual_portfolio_registered",
    stage: "visual_contract",
    outputRef: outputPath,
    reason: `Visual portfolio ${plan.portfolioId} froze ${plan.contractIds.length} contract IDs.`
  });
  await persistBundle(bundle);
  return { bundle, plan, path: outputPath };
}

export async function recordScholarResearchHumanVisualReview(input: {
  cwd: string;
  runId?: string;
  contractPath: string;
  reviewPath: string;
}): Promise<{ bundle: ResearchBundle; contract: VisualEvidenceContract; path: string }> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  if (bundle.stages.visual_contract.status !== "blocked" &&
      bundle.stages.visual_contract.status !== "awaiting_human") {
    throw new Error("The workflow is not awaiting a Visual Evidence Contract decision.");
  }
  const proposed = JSON.parse(
    await readFile(resolve(input.contractPath), "utf8")
  ) as VisualEvidenceContract;
  const review = JSON.parse(
    await readFile(resolve(input.reviewPath), "utf8")
  ) as HumanVisualContractReview;
  if (review.schema !== "longtable.human-visual-contract-review" ||
      review.version !== 1 || review.runId !== bundle.runId ||
      !review.reviewer.trim() || !review.reviewedAt ||
      !review.decisionRecordId.trim() || !review.rationale.trim()) {
    throw new Error("Invalid human visual contract review.");
  }
  if (proposed.schema !== "longtable.visual-evidence-contract" || proposed.version !== 1) {
    throw new Error("Invalid Visual Evidence Contract schema.");
  }
  const portfolio = bundle.artifacts.visualPortfolio;
  if (portfolio && !portfolio.contractIds.includes(proposed.id)) {
    throw new Error(`Visual contract ${proposed.id} is not declared in the frozen portfolio.`);
  }
  if (proposed.status !== "proposed") {
    throw new Error("Human visual review requires a proposed contract.");
  }
  if (bundle.input.targetJournal && proposed.targetJournal !== bundle.input.targetJournal) {
    throw new Error("Visual contract target journal does not match the ResearchBundle.");
  }
  const decisionChecks = Object.values(review.checks);
  if (decisionChecks.length !== 4 || decisionChecks.some((value) => typeof value !== "boolean")) {
    throw new Error("Visual review requires four explicit boolean checks.");
  }
  if (review.decision === "approve" && decisionChecks.some((value) => value !== true)) {
    throw new Error("A visual contract cannot be approved while any human verification lens fails.");
  }
  if (review.decision !== "approve" && review.decision !== "reject") {
    throw new Error("Visual review decision must be approve or reject.");
  }
  const finalStatus: "approved" | "rejected" = review.decision === "approve" ? "approved" : "rejected";
  const contract: VisualEvidenceContract = review.decision === "approve"
    ? {
        ...proposed,
        status: "approved",
        approval: {
          approvedBy: review.reviewer,
          approvedAt: review.reviewedAt,
          decisionRecordId: review.decisionRecordId
        }
      }
    : { ...proposed, status: "rejected", approval: undefined };
  const validation = validateVisualEvidenceContract(contract);
  if (!validation.valid) {
    throw new Error(`Visual Evidence Contract validation failed: ${validation.hardFailures.join(" ")}`);
  }
  const outputPath = join(
    bundle.runDir,
    "artifacts",
    "visual-contracts",
    `${contract.id}.${contract.status}.json`
  );
  await writeJsonAtomic(outputPath, {
    ...contract,
    humanReview: review,
    validation
  });
  bundle.artifacts.visualContracts = [
    ...(bundle.artifacts.visualContracts ?? []).filter((entry) => entry.id !== contract.id),
    {
      id: contract.id,
      status: finalStatus,
      path: outputPath,
      decisionRecordId: review.decisionRecordId,
      reviewedAt: review.reviewedAt
    }
  ];
  await appendEvent(bundle, {
    type: "human_visual_review_recorded",
    stage: "visual_contract",
    outputRef: outputPath,
    reason: `Human Visual Evidence Contract decision recorded: ${contract.status}.`
  });
  if (finalStatus === "approved") {
    const expectedContractIds = portfolio?.contractIds ?? [contract.id];
    const approvedIds = new Set(
      (bundle.artifacts.visualContracts ?? [])
        .filter((entry) => entry.status === "approved")
        .map((entry) => entry.id)
    );
    const remaining = expectedContractIds.filter((id) => !approvedIds.has(id));
    if (remaining.length === 0) {
      bundle.pendingCheckpoint = undefined;
      bundle.pauseReason = undefined;
      bundle.status = "running";
      const inputHash = bundle.stages.visual_contract.inputHash;
      if (!inputHash) throw new Error("Visual contract stage has no input hash.");
      await completeStage(
        bundle,
        "visual_contract",
        inputHash,
        portfolio?.path ?? outputPath
      );
    } else {
      bundle.status = "waiting_for_checkpoint";
      bundle.pendingCheckpoint = {
        class: "visual_evidence_contract",
        stage: "visual_contract",
        reason: `The visual portfolio still requires human decisions for: ${remaining.join(", ")}.`
      };
      bundle.stages.visual_contract = {
        ...bundle.stages.visual_contract,
        status: "blocked",
        checkpointClass: "visual_evidence_contract",
        blockedReason: bundle.pendingCheckpoint.reason
      };
      await persistBundle(bundle);
    }
  } else {
    bundle.status = "waiting_for_checkpoint";
    bundle.pendingCheckpoint = {
      class: "visual_evidence_contract",
      stage: "visual_contract",
      reason: "The proposed Visual Evidence Contract was rejected and must be revised."
    };
    bundle.stages.visual_contract = {
      ...bundle.stages.visual_contract,
      status: "blocked",
      blockedReason: bundle.pendingCheckpoint.reason,
      checkpointClass: "visual_evidence_contract"
    };
    await persistBundle(bundle);
  }
  return { bundle, contract, path: outputPath };
}

export async function recordScholarResearchVisualRender(input: {
  cwd: string;
  runId?: string;
  contractId: string;
  requestPath: string;
}): Promise<{
  bundle: ResearchBundle;
  manifest: VisualRenderManifest;
  manifestPath: string;
  qa: MechanicalVisualQa;
  qaPath: string;
}> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  if (bundle.stages.visual_contract.status !== "completed") {
    throw new Error("Visual rendering requires a completed Visual Evidence Contract stage.");
  }
  const contractRecord = bundle.artifacts.visualContracts?.find(
    (record) => record.id === input.contractId && record.status === "approved"
  );
  if (!contractRecord) throw new Error("No approved visual contract is registered for this contract ID.");
  const contract = JSON.parse(await readFile(contractRecord.path, "utf8")) as VisualEvidenceContract;
  const request = JSON.parse(await readFile(resolve(input.requestPath), "utf8")) as VisualRenderRequest;
  if (request.runId !== bundle.runId) throw new Error("Visual render request run does not match the ResearchBundle.");
  const existing = bundle.artifacts.visualRenders?.find(
    (record) => record.contractId === contract.id
  );
  if (existing) {
    const manifest = JSON.parse(await readFile(existing.manifestPath, "utf8")) as VisualRenderManifest;
    const qa = JSON.parse(await readFile(existing.qaPath, "utf8")) as MechanicalVisualQa;
    const requestHash = `sha256:${stableHash(request)}`;
    const snapshotHash = `sha256:${createHash("sha256").update(
      await readFile(resolve(contract.dataContract.dataSnapshotPath))
    ).digest("hex")}`;
    if (manifest.requestHash !== requestHash || manifest.dataSnapshotHash !== snapshotHash) {
      throw new Error("A render already exists for this contract with different request or data inputs.");
    }
    return {
      bundle,
      manifest,
      manifestPath: existing.manifestPath,
      qa,
      qaPath: existing.qaPath
    };
  }
  const implementHash = await beginStage(bundle, "implement", {
    contractId: contract.id,
    contractPath: contractRecord.path,
    request
  });
  if (!implementHash) throw new Error("Implement stage was already resolved without a registered render.");
  const rendered = await renderVisualArtifact({
    runDir: bundle.runDir,
    contract,
    request
  });
  if (!rendered.qa.passed) {
    await blockStage(
      bundle,
      "render",
      stableHash(rendered.manifest),
      "visual_evidence_contract",
      `Mechanical visual QA failed: ${rendered.qa.hardFailures.join(" ")}`
    );
    return { bundle, ...rendered };
  }
  bundle.artifacts.visualRenders = [
    ...(bundle.artifacts.visualRenders ?? []),
    {
      contractId: contract.id,
      manifestPath: rendered.manifestPath,
      qaPath: rendered.qaPath,
      editableSourcePath: rendered.manifest.editableSourcePath,
      renderedAt: rendered.manifest.renderedAt
    }
  ];
  await appendEvent(bundle, {
    type: "visual_render_recorded",
    stage: "render",
    outputRef: rendered.manifestPath,
    reason: "Allowlisted editable SVG render and mechanical QA were recorded."
  });
  await completeStage(bundle, "implement", implementHash, rendered.manifest.editableSourcePath);
  const renderHash = await beginStage(bundle, "render", {
    contractId: contract.id,
    requestHash: rendered.manifest.requestHash,
    dataSnapshotHash: rendered.manifest.dataSnapshotHash
  });
  if (!renderHash) throw new Error("Render stage was already resolved without completion.");
  await completeStage(bundle, "render", renderHash, rendered.manifestPath);
  const verifyHash = await beginStage(bundle, "verify", {
    contractId: contract.id,
    manifestPath: rendered.manifestPath,
    mechanicalQaPath: rendered.qaPath
  });
  if (!verifyHash) throw new Error("Verify stage was already resolved without human review.");
  await awaitHumanStage(
    bundle,
    "verify",
    verifyHash,
    rendered.qaPath,
    "Mechanical QA passed; final domain, statistical, journal-fit, and timed reader checks require a human."
  );
  return { bundle, ...rendered };
}

export async function recordTargetJournalProfile(input: {
  cwd: string;
  runId?: string;
  profile: TargetJournalProfile;
}): Promise<{ bundle: ResearchBundle; profile: TargetJournalProfile; path: string }> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No LongTable Research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  const profile = validateTargetJournalProfile(input.profile);
  if (bundle.input.targetJournal &&
      bundle.input.targetJournal.toLocaleLowerCase() !== profile.targetJournal.toLocaleLowerCase()) {
    throw new Error("Target-journal profile does not match the Research Brief.");
  }
  const path = join(bundle.runDir, "artifacts", "target-journal-profile.json");
  await writeJsonAtomic(path, profile);
  bundle.artifacts.targetJournalProfile = {
    profileId: profile.profileId,
    path,
    contentHash: `sha256:${stableHash(profile)}`,
    reviewedAt: profile.humanReview.reviewedAt
  };
  await appendEvent(bundle, {
    type: "target_journal_profile_recorded",
    stage: "venue",
    outputRef: path,
    reason: "Human-accepted target-journal topic and format evidence recorded."
  });
  const expectedVisuals = bundle.artifacts.visualPortfolio?.contractIds ?? [];
  const acceptedVisuals = new Set(
    (bundle.artifacts.finalVisualReviews ?? [])
      .filter((entry) => entry.decision === "accept")
      .map((entry) => entry.contractId)
  );
  if (expectedVisuals.length > 0 &&
      expectedVisuals.every((contractId) => acceptedVisuals.has(contractId)) &&
      bundle.stages.verify.status === "awaiting_human" &&
      bundle.stages.verify.inputHash) {
    bundle.pendingCheckpoint = undefined;
    bundle.pauseReason = undefined;
    await completeStage(
      bundle,
      "verify",
      bundle.stages.verify.inputHash,
      bundle.artifacts.finalVisualReviews?.at(-1)?.path
    );
    await finalizeVerifiedResearchPackage(bundle);
    return { bundle, profile, path };
  }
  await persistBundle(bundle);
  return { bundle, profile, path };
}

async function fileHash(path: string): Promise<string> {
  return `sha256:${createHash("sha256").update(await readFile(path)).digest("hex")}`;
}

async function writeVerifiedResearchPackage(bundle: ResearchBundle, handoffPath: string): Promise<NonNullable<ResearchBundle["artifacts"]["verifiedPackage"]>> {
  if (!bundle.artifacts.targetJournalProfile) {
    throw new Error("Verified Research Package requires a human-accepted target-journal profile.");
  }
  const directory = join(bundle.runDir, "verified-research-package");
  await mkdir(directory, { recursive: true });
  const assurancePath = join(directory, "research-assurance.json");
  const limitationsPath = join(directory, "LIMITATIONS.md");
  const readmePath = join(directory, "README.md");
  const manifestPath = join(directory, "manifest.json");
  const verificationPath = join(directory, "verification.json");
  const assurance = {
    schema: "longtable.research-assurance-record",
    version: 1,
    runId: bundle.runId,
    createdAt: now(),
    boundaries: [
      {
        boundary: "scope",
        status: "passed",
        evidenceRefs: [bundle.artifacts.researchBrief.jsonPath]
      },
      {
        boundary: "access_corpus",
        status: "passed",
        evidenceRefs: [
          bundle.artifacts.lawfulAccessPlan.path,
          join(bundle.runDir, "sources", "manifest.jsonl")
        ]
      },
      {
        boundary: "evidence_claim_strength",
        status: "passed",
        evidenceRefs: [bundle.artifacts.citationSlotsPath, bundle.artifacts.synthesisPath].filter(Boolean)
      },
      {
        boundary: "visual_evidence",
        status: "passed",
        evidenceRefs: [
          bundle.artifacts.visualPortfolio?.path,
          ...(bundle.artifacts.visualRenders ?? []).map((entry) => entry.manifestPath),
          ...(bundle.artifacts.finalVisualReviews ?? []).map((entry) => entry.path)
        ].filter(Boolean)
      },
      {
        boundary: "external_action",
        status: "passed",
        evidenceRefs: [handoffPath],
        decision: "No external submission, upload, or publication was performed."
      }
    ]
  };
  await writeJsonAtomic(assurancePath, assurance);
  await writeFile(limitationsPath, [
    "# Limitations",
    "",
    "- Corpus coverage is bounded by the lawful access routes recorded in the run manifest.",
    "- Provider-generated extraction and synthesis remain bounded proposals until their recorded verification and human gates pass.",
    "- Journal patterns describe the reviewed exemplar set; they are not a guarantee of editorial acceptance.",
    "- `externalActionPerformed` is false. Submission, upload, and publication remain separate human-authorized actions.",
    ""
  ].join("\n"), "utf8");
  await writeFile(readmePath, [
    "# Verified Research Package",
    "",
    `Run: ${bundle.runId}`,
    `Research question: ${bundle.input.query}`,
    `Target journal: ${bundle.input.targetJournal ?? "journal discovery"}`,
    "",
    "This package is complete only when `verification.json` reports `passed: true`.",
    "The manifest points to the versioned Research Brief, journal profile, corpus, evidence ledger, synthesis, editable visuals, human reviews, assurance record, and limitations.",
    "",
    "## Reproduce",
    "",
    "```sh",
    `longtable research verify --cwd ${JSON.stringify(resolve(bundle.runDir, "..", "..", ".."))} --run-id ${JSON.stringify(bundle.runId)} --json`,
    "```",
    "",
    "No external submission or publication is included.",
    ""
  ].join("\n"), "utf8");

  const candidates: Array<{ role: string; path: string | undefined }> = [
    { role: "research_brief_json", path: bundle.artifacts.researchBrief.jsonPath },
    { role: "research_brief_markdown", path: bundle.artifacts.researchBrief.markdownPath },
    { role: "target_journal_profile", path: bundle.artifacts.targetJournalProfile.path },
    { role: "lawful_access_plan", path: bundle.artifacts.lawfulAccessPlan.path },
    { role: "search_manifest", path: bundle.artifacts.searchRunPath },
    { role: "fulltext_manifest", path: join(bundle.runDir, "sources", "manifest.jsonl") },
    { role: "citation_claim_ledger", path: bundle.artifacts.citationSlotsPath },
    { role: "synthesis", path: bundle.artifacts.synthesisPath },
    { role: "visual_portfolio", path: bundle.artifacts.visualPortfolio?.path },
    ...((bundle.artifacts.visualContracts ?? []).map((entry) => ({ role: `visual_contract:${entry.id}`, path: entry.path }))),
    ...((bundle.artifacts.visualRenders ?? []).flatMap((entry) => [
      { role: `visual_render_manifest:${entry.contractId}`, path: entry.manifestPath },
      { role: `visual_editable_source:${entry.contractId}`, path: entry.editableSourcePath }
    ])),
    ...((bundle.artifacts.finalVisualReviews ?? []).map((entry) => ({ role: `visual_human_review:${entry.contractId}`, path: entry.path }))),
    { role: "research_assurance", path: assurancePath },
    { role: "limitations", path: limitationsPath },
    { role: "handoff", path: handoffPath },
    { role: "human_readme", path: readmePath }
  ];
  const missing = candidates.filter((candidate) => !candidate.path).map((candidate) => candidate.role);
  if (missing.length > 0) {
    throw new Error(`Verified Research Package is missing required artifacts: ${missing.join(", ")}.`);
  }
  const files = [];
  for (const candidate of candidates) {
    files.push({
      role: candidate.role,
      path: candidate.path as string,
      contentHash: await fileHash(candidate.path as string)
    });
  }
  await writeJsonAtomic(manifestPath, {
    schema: "longtable.verified-research-package",
    version: "1.0.0",
    runId: bundle.runId,
    createdAt: now(),
    status: "awaiting_verification",
    reproduceCommand: `longtable research verify --cwd ${resolve(bundle.runDir, "..", "..", "..")} --run-id ${bundle.runId} --json`,
    files
  });
  return {
    directory,
    readmePath,
    manifestPath,
    assurancePath,
    limitationsPath,
    verificationPath
  };
}

async function finalizeVerifiedResearchPackage(bundle: ResearchBundle): Promise<void> {
  const handoffHash = await beginStage(bundle, "handoff", {
    synthesisPath: bundle.artifacts.synthesisPath,
    visualRenders: bundle.artifacts.visualRenders,
    finalVisualReviews: bundle.artifacts.finalVisualReviews,
    targetJournalProfile: bundle.artifacts.targetJournalProfile
  });
  if (!handoffHash) throw new Error("Handoff stage was already resolved without workflow completion.");
  const handoffPath = join(bundle.runDir, "artifacts", "handoff.json");
  await writeJsonAtomic(handoffPath, {
    schema: "longtable.research-handoff",
    version: 1,
    runId: bundle.runId,
    createdAt: now(),
    researchBrief: bundle.artifacts.researchBrief,
    targetJournalProfile: bundle.artifacts.targetJournalProfile,
    synthesisPath: bundle.artifacts.synthesisPath,
    citationSlotsPath: bundle.artifacts.citationSlotsPath,
    visualContracts: bundle.artifacts.visualContracts,
    visualPortfolio: bundle.artifacts.visualPortfolio,
    visualRenders: bundle.artifacts.visualRenders,
    finalVisualReviews: bundle.artifacts.finalVisualReviews,
    externalActionPerformed: false
  });
  await completeStage(bundle, "handoff", handoffHash, handoffPath);
  bundle.artifacts.verifiedPackage = await writeVerifiedResearchPackage(bundle, handoffPath);
  bundle.status = "running";
  await persistBundle(bundle);
  const verification = await verifyScholarResearchRun({ cwd: resolve(bundle.runDir, "..", "..", ".."), runId: bundle.runId });
  await writeJsonAtomic(bundle.artifacts.verifiedPackage.verificationPath, verification);
  if (!verification.passed) {
    bundle.status = "failed";
    await persistBundle(bundle);
    throw new Error(`Verified Research Package preflight failed: ${verification.hardFailures.join(" ")}`);
  }
  const manifest = JSON.parse(await readFile(bundle.artifacts.verifiedPackage.manifestPath, "utf8")) as {
    status: string;
    files: Array<{ role: string; path: string; contentHash: string }>;
  };
  manifest.status = "verified";
  manifest.files.push({
    role: "verification",
    path: bundle.artifacts.verifiedPackage.verificationPath,
    contentHash: await fileHash(bundle.artifacts.verifiedPackage.verificationPath)
  });
  await writeJsonAtomic(bundle.artifacts.verifiedPackage.manifestPath, manifest);
  bundle.status = "completed";
  await persistBundle(bundle);
}

export async function recordScholarResearchHumanRenderedVisualReview(input: {
  cwd: string;
  runId?: string;
  reviewPath: string;
}): Promise<{ bundle: ResearchBundle; review: HumanRenderedVisualReview; path: string }> {
  const runId = input.runId ?? await findLatestScholarResearchRunId(input.cwd);
  if (!runId) throw new Error("No scholar-research run was found.");
  const bundle = await readResearchBundle(input.cwd, runId);
  if (bundle.stages.verify.status !== "awaiting_human") {
    throw new Error("The workflow is not awaiting final rendered-visual review.");
  }
  const review = JSON.parse(
    await readFile(resolve(input.reviewPath), "utf8")
  ) as HumanRenderedVisualReview;
  if (review.schema !== "longtable.human-rendered-visual-review" ||
      review.version !== 1 || review.runId !== bundle.runId ||
      !review.contractId.trim() || !review.reviewer.trim() ||
      !review.reviewedAt || !review.rationale.trim()) {
    throw new Error("Invalid human rendered-visual review.");
  }
  const renderRecord = bundle.artifacts.visualRenders?.find(
    (record) => record.contractId === review.contractId
  );
  if (!renderRecord) throw new Error("Human review does not reference a registered visual render.");
  const qa = JSON.parse(await readFile(renderRecord.qaPath, "utf8")) as MechanicalVisualQa;
  if (!qa.passed) throw new Error("A render that failed mechanical QA cannot receive final human acceptance.");
  const checks = Object.values(review.checks);
  const recovery = [
    review.readerTest.recoveredQuestion,
    review.readerTest.recoveredDenominator,
    review.readerTest.recoveredKeyValueOrRelation,
    review.readerTest.recoveredConclusion
  ];
  if (checks.length !== 4 || [...checks, ...recovery].some((value) => typeof value !== "boolean")) {
    throw new Error("Final visual review requires four verification checks and four reader-recovery results.");
  }
  const contractRecord = bundle.artifacts.visualContracts?.find(
    (record) => record.id === review.contractId && record.status === "approved"
  );
  if (!contractRecord) throw new Error("Approved visual contract is missing.");
  const contract = JSON.parse(await readFile(contractRecord.path, "utf8")) as VisualEvidenceContract;
  if (review.readerTest.seconds > contract.readerTest.seconds || review.readerTest.seconds <= 0) {
    throw new Error("Reader test exceeded the approved recovery-time threshold.");
  }
  if (review.decision === "accept" &&
      ([...checks, ...recovery].some((value) => value !== true))) {
    throw new Error("Final visual acceptance requires every human and reader check to pass.");
  }
  if (review.decision !== "accept" && review.decision !== "reject") {
    throw new Error("Rendered visual decision must be accept or reject.");
  }
  const outputPath = join(
    bundle.runDir,
    "artifacts",
    "visuals",
    review.contractId,
    "human-review.json"
  );
  await writeJsonAtomic(outputPath, review);
  bundle.artifacts.finalVisualReviews = [
    ...(bundle.artifacts.finalVisualReviews ?? []).filter(
      (entry) => entry.contractId !== review.contractId
    ),
    {
      contractId: review.contractId,
      decision: review.decision,
      path: outputPath,
      reviewedAt: review.reviewedAt
    }
  ];
  await appendEvent(bundle, {
    type: "human_render_review_recorded",
    stage: "verify",
    outputRef: outputPath,
    reason: `Final rendered visual decision recorded: ${review.decision}.`
  });
  if (review.decision === "accept") {
    const expectedContractIds = bundle.artifacts.visualPortfolio?.contractIds ?? [review.contractId];
    const acceptedIds = new Set(
      (bundle.artifacts.finalVisualReviews ?? [])
        .filter((entry) => entry.decision === "accept")
        .map((entry) => entry.contractId)
    );
    const remaining = expectedContractIds.filter((id) => !acceptedIds.has(id));
    if (remaining.length > 0) {
      bundle.status = "paused";
      bundle.pauseReason = `Final rendered-visual reviews remain for: ${remaining.join(", ")}.`;
      bundle.stages.verify = {
        ...bundle.stages.verify,
        status: "awaiting_human",
        blockedReason: undefined
      };
      await persistBundle(bundle);
      return { bundle, review, path: outputPath };
    }
    const inputHash = bundle.stages.verify.inputHash;
    if (!inputHash) throw new Error("Verify stage has no input hash.");
    if (!bundle.artifacts.targetJournalProfile) {
      bundle.status = "waiting_for_checkpoint";
      bundle.pendingCheckpoint = {
        class: "evidence_direction_or_claim_strength",
        stage: "venue",
        reason: "A human-accepted target-journal topic and format profile is required before package completion."
      };
      bundle.pauseReason = bundle.pendingCheckpoint.reason;
      await persistBundle(bundle);
      return { bundle, review, path: outputPath };
    }
    bundle.status = "running";
    bundle.pauseReason = undefined;
    await completeStage(bundle, "verify", inputHash, outputPath);
    await finalizeVerifiedResearchPackage(bundle);
  } else {
    bundle.status = "waiting_for_checkpoint";
    bundle.pendingCheckpoint = {
      class: "visual_evidence_contract",
      stage: "verify",
      reason: "The rendered visual was rejected and requires a revised contract or render request."
    };
    bundle.stages.verify = {
      ...bundle.stages.verify,
      status: "blocked",
      checkpointClass: "visual_evidence_contract",
      blockedReason: bundle.pendingCheckpoint.reason
    };
    await persistBundle(bundle);
  }
  return { bundle, review, path: outputPath };
}
