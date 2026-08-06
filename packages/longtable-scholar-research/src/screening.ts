import { createHash } from "node:crypto";
import type { CapabilityResult, InstitutionalResearchHardStop } from "./workflow-types.js";
import { buildScreeningConflictCheckpoint } from "./checkpoints.js";

export type ScreeningStage = "title_abstract" | "fulltext";
export type ScreeningDisposition = "include" | "exclude" | "pending" | "full_text_needed_for_screening";
export type ScreeningActor = "human" | "ai" | "deterministic_rule";

export interface ScreeningDecisionInput {
  readonly paperId: string;
  readonly stage: ScreeningStage;
  readonly decision: ScreeningDisposition;
  readonly reasonCode?: string;
  readonly rationale: string;
  readonly ruleVersion: string;
  readonly codebookVersion: string;
  readonly actor: ScreeningActor;
  readonly actorId: string;
  readonly modelVersion?: string;
  readonly promptVersion?: string;
  readonly evidenceArtifactIds: readonly string[];
  readonly decidedAt: string;
  readonly adjudicatesDecisionIds?: readonly string[];
}

export interface ScreeningDecision extends ScreeningDecisionInput {
  readonly id: string;
}

export interface ScreeningCacheKeyInput {
  readonly recordOrPdfHash: string;
  readonly ruleVersion: string;
  readonly codebookVersion: string;
  readonly promptVersion: string;
  readonly modelVersion: string;
}

export interface TitleAbstractScreeningCounts {
  readonly screened: number;
  readonly fulltextCandidates: number;
  readonly excluded: number;
  readonly pending: number;
}

export interface HumanAiScreeningConflict {
  readonly id: string;
  readonly paperId: string;
  readonly stage: ScreeningStage;
  readonly humanDecisionId: string;
  readonly aiDecisionId: string;
  readonly decisionIds: readonly string[];
  readonly humanDisposition: ScreeningDisposition;
  readonly aiDisposition: ScreeningDisposition;
}

export interface ScreeningConflictAuditRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly code: "HUMAN_AI_SCREENING_CONFLICT";
  readonly paperIds: readonly string[];
  readonly conflictIds: readonly string[];
  readonly decisionIds: readonly string[];
  readonly basis: string;
}

export interface BundleScreeningConflictsInput {
  readonly runId: string;
  readonly protocolRevisionId: string;
  readonly conflicts: readonly HumanAiScreeningConflict[];
  readonly createdAt?: string;
}

export interface FulltextMissingThresholdInput {
  readonly sought: number;
  readonly retrieved: number;
  readonly maximumMissingRate: number;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]));
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function hash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function requireText(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`${label} is required for a screening decision.`);
  return value.trim();
}

function immutable<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) immutable(nested);
    Object.freeze(value);
  }
  return value;
}

export function classifyTitleAbstractAvailability(
  record: { readonly abstract?: string },
  minimumUsableCharacters = 80
): "screenable" | "full_text_needed_for_screening" {
  const normalized = record.abstract?.replace(/\s+/g, " ").trim() ?? "";
  return normalized.length >= minimumUsableCharacters ? "screenable" : "full_text_needed_for_screening";
}

export function createScreeningDecision(input: ScreeningDecisionInput): ScreeningDecision {
  requireText(input.paperId, "Paper ID");
  requireText(input.rationale, "Screening rationale");
  requireText(input.ruleVersion, "Screening rule version");
  requireText(input.codebookVersion, "Screening codebook version");
  requireText(input.actorId, "Screening actor ID");
  if (!Number.isFinite(Date.parse(input.decidedAt))) {
    throw new Error("Screening decision timestamp must be an ISO-compatible date.");
  }
  if (input.decision === "exclude") requireText(input.reasonCode, "Exclusion reason code");
  if (input.stage === "fulltext" && input.decision === "full_text_needed_for_screening") {
    throw new Error("full_text_needed_for_screening is valid only during title/abstract screening.");
  }
  if (input.actor === "ai" && (!input.modelVersion?.trim() || !input.promptVersion?.trim())) {
    throw new Error("AI screening requires model and prompt version provenance.");
  }
  if (input.evidenceArtifactIds.length === 0) {
    throw new Error("A screening decision requires at least one evidence artifact ID.");
  }
  const canonical = {
    ...input,
    paperId: input.paperId.trim(),
    rationale: input.rationale.trim(),
    ruleVersion: input.ruleVersion.trim(),
    codebookVersion: input.codebookVersion.trim(),
    actorId: input.actorId.trim(),
    evidenceArtifactIds: [...new Set(input.evidenceArtifactIds.map((entry) => entry.trim()).filter(Boolean))].sort()
  };
  return immutable({ ...canonical, id: `screening_${hash(canonical).slice(0, 24)}` });
}

export function appendScreeningDecision(
  ledger: readonly ScreeningDecision[],
  decision: ScreeningDecision
): ScreeningDecision[] {
  const existing = ledger.find((entry) => entry.id === decision.id);
  if (!existing) return [...ledger, decision];
  if (stableJson(existing) !== stableJson(decision)) {
    throw new Error(`Screening ledger is append-only; decision ${decision.id} cannot be mutated in place.`);
  }
  return [...ledger];
}

function laterDecision(left: ScreeningDecision, right: ScreeningDecision): ScreeningDecision {
  const timestampOrder = left.decidedAt.localeCompare(right.decidedAt);
  if (timestampOrder !== 0) return timestampOrder > 0 ? left : right;
  return left.id.localeCompare(right.id) > 0 ? left : right;
}

export function reduceLatestScreeningDecisions(
  ledger: readonly ScreeningDecision[],
  stage: ScreeningStage
): Map<string, ScreeningDecision> {
  const byPaper = new Map<string, ScreeningDecision>();
  for (const decision of ledger.filter((entry) => entry.stage === stage)) {
    const existing = byPaper.get(decision.paperId);
    byPaper.set(decision.paperId, existing ? laterDecision(existing, decision) : decision);
  }
  return new Map([...byPaper.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function selectFulltextCandidateIds(
  paperIds: readonly string[],
  ledger: readonly ScreeningDecision[]
): string[] {
  const latest = reduceLatestScreeningDecisions(ledger, "title_abstract");
  return [...new Set(paperIds)]
    .filter((paperId) => {
      const decision = latest.get(paperId)?.decision;
      return decision === "include" || decision === "full_text_needed_for_screening";
    })
    .sort();
}

export function calculateTitleAbstractScreeningCounts(
  paperIds: readonly string[],
  ledger: readonly ScreeningDecision[]
): TitleAbstractScreeningCounts {
  const uniquePaperIds = [...new Set(paperIds)];
  const latest = reduceLatestScreeningDecisions(ledger, "title_abstract");
  let fulltextCandidates = 0;
  let excluded = 0;
  let pending = 0;
  for (const paperId of uniquePaperIds) {
    const decision = latest.get(paperId)?.decision;
    if (decision === "include" || decision === "full_text_needed_for_screening") fulltextCandidates += 1;
    else if (decision === "exclude") excluded += 1;
    else pending += 1;
  }
  return { screened: uniquePaperIds.length, fulltextCandidates, excluded, pending };
}

export function buildScreeningCacheKey(input: ScreeningCacheKeyInput): string {
  requireText(input.recordOrPdfHash, "Record or PDF hash");
  requireText(input.ruleVersion, "Screening rule version");
  requireText(input.codebookVersion, "Screening codebook version");
  requireText(input.promptVersion, "Screening prompt version");
  requireText(input.modelVersion, "Screening model version");
  return hash(input);
}

function latestByActor(
  ledger: readonly ScreeningDecision[],
  actor: "human" | "ai"
): Map<string, ScreeningDecision> {
  const latest = new Map<string, ScreeningDecision>();
  for (const decision of ledger.filter((entry) => entry.actor === actor)) {
    const key = `${decision.paperId}:${decision.stage}`;
    const existing = latest.get(key);
    latest.set(key, existing ? laterDecision(existing, decision) : decision);
  }
  return latest;
}

export function detectHumanAiScreeningConflicts(
  ledger: readonly ScreeningDecision[]
): HumanAiScreeningConflict[] {
  const humans = latestByActor(ledger, "human");
  const ais = latestByActor(ledger, "ai");
  const conflicts: HumanAiScreeningConflict[] = [];
  for (const [key, human] of humans) {
    const ai = ais.get(key);
    if (!ai || ai.decision === human.decision) continue;
    const decisionIds = [human.id, ai.id].sort();
    conflicts.push({
      id: `screening_conflict_${hash({ key, decisionIds }).slice(0, 20)}`,
      paperId: human.paperId,
      stage: human.stage,
      humanDecisionId: human.id,
      aiDecisionId: ai.id,
      decisionIds,
      humanDisposition: human.decision,
      aiDisposition: ai.decision
    });
  }
  return conflicts.sort((left, right) => left.paperId.localeCompare(right.paperId) || left.stage.localeCompare(right.stage));
}

export function bundleScreeningConflicts(input: BundleScreeningConflictsInput): {
  readonly auditRecord: ScreeningConflictAuditRecord;
  readonly question: ReturnType<typeof buildScreeningConflictCheckpoint>;
} {
  if (input.conflicts.length === 0) throw new Error("At least one human–AI screening conflict is required.");
  const createdAt = input.createdAt ?? new Date().toISOString();
  const paperIds = [...new Set(input.conflicts.map((conflict) => conflict.paperId))].sort();
  const conflictIds = input.conflicts.map((conflict) => conflict.id).sort();
  const decisionIds = [...new Set(input.conflicts.flatMap((conflict) => conflict.decisionIds))].sort();
  const auditRecord: ScreeningConflictAuditRecord = {
    id: `screening_conflict_bundle_${hash({ input: input.runId, paperIds, conflictIds }).slice(0, 20)}`,
    createdAt,
    code: "HUMAN_AI_SCREENING_CONFLICT",
    paperIds,
    conflictIds,
    decisionIds,
    basis: "Latest human and AI screening dispositions disagree for the affected paper/stage pairs."
  };
  return {
    auditRecord,
    question: buildScreeningConflictCheckpoint({
      runId: input.runId,
      protocolRevisionId: input.protocolRevisionId,
      paperIds,
      conflict: `${input.conflicts.length} human–AI screening conflict(s) require adjudication`,
      createdAt
    })
  };
}

export function applyScreeningAdjudication(
  ledger: readonly ScreeningDecision[],
  input: ScreeningDecisionInput & { readonly adjudicatesDecisionIds: readonly string[] }
): ScreeningDecision[] {
  if (input.actor !== "human") throw new Error("Screening adjudication must be recorded by a human actor.");
  if (input.adjudicatesDecisionIds.length < 2) throw new Error("Screening adjudication must reference the conflicting decision IDs.");
  const existingIds = new Set(ledger.map((decision) => decision.id));
  const missingIds = input.adjudicatesDecisionIds.filter((id) => !existingIds.has(id));
  if (missingIds.length > 0) throw new Error(`Screening adjudication references unknown decisions: ${missingIds.join(", ")}.`);
  return appendScreeningDecision(ledger, createScreeningDecision({
    ...input,
    adjudicatesDecisionIds: [...new Set(input.adjudicatesDecisionIds)].sort()
  }));
}

function thresholdHardStop(code: InstitutionalResearchHardStop, reason: string): Extract<CapabilityResult<never>, { status: "hard_stop" }> {
  return { status: "hard_stop", code, reason };
}

export function evaluateFulltextMissingThreshold(
  input: FulltextMissingThresholdInput
): CapabilityResult<{ readonly missing: number; readonly missingRate: number }> {
  if (!Number.isInteger(input.sought) || !Number.isInteger(input.retrieved) || input.sought < 0 || input.retrieved < 0 || input.retrieved > input.sought) {
    throw new Error("Full-text sought and retrieved counts must be valid non-negative integers.");
  }
  if (input.maximumMissingRate < 0 || input.maximumMissingRate > 1) {
    throw new Error("Maximum full-text missing rate must be between 0 and 1.");
  }
  const missing = input.sought - input.retrieved;
  const missingRate = input.sought === 0 ? 0 : missing / input.sought;
  return missingRate <= input.maximumMissingRate
    ? { status: "supported", value: { missing, missingRate } }
    : thresholdHardStop(
      "FULLTEXT_MISSING_THRESHOLD_EXCEEDED",
      `Full-text missing rate ${(missingRate * 100).toFixed(1)}% exceeds the approved ${(input.maximumMissingRate * 100).toFixed(1)}% threshold.`
    );
}
