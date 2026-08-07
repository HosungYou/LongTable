import { createHash } from "node:crypto";
import type { InstitutionalResearchHardStop } from "./workflow-types.js";

export type ExtractionValueType = "string" | "number" | "boolean" | "categorical" | "multi_categorical" | "verbatim";
export type ExtractionCorpusType = "scholarly_study" | "document_corpus" | "training_course" | "other";
export type ExtractorType = "human" | "ai";

export interface ExtractionFieldDefinition {
  readonly id: string;
  readonly label: string;
  readonly valueType: ExtractionValueType;
  readonly required: boolean;
  readonly evidenceRequired: boolean;
  readonly allowedValues?: readonly string[];
}

export interface ExtractionReliability {
  readonly statistic: string;
  readonly threshold: number;
  readonly observed?: number;
}

export interface ExtractionProfileInput {
  readonly id: string;
  readonly version: number;
  readonly corpusType: ExtractionCorpusType;
  readonly unitOfAnalysis: string;
  readonly approvedDecisionRecordId: string;
  readonly frozenAt: string;
  readonly doubleExtractionRequired: boolean;
  readonly reliability: ExtractionReliability;
  readonly fields: readonly ExtractionFieldDefinition[];
}

export interface ExtractionProfile extends ExtractionProfileInput {
  readonly profileHash: string;
}

export interface ExtractionEvidence {
  readonly sourceArtifactId: string;
  readonly locator: string;
  readonly quote?: string;
}

export interface ExtractedFieldValue {
  readonly fieldId: string;
  readonly value: unknown;
  readonly evidence: readonly ExtractionEvidence[];
}

export interface ExtractionRecord {
  readonly id: string;
  readonly unitId: string;
  readonly profileId: string;
  readonly profileHash: string;
  readonly extractor: { readonly id: string; readonly type: ExtractorType };
  readonly extractedAt: string;
  readonly status: "draft" | "submitted" | "adjudicated";
  readonly values: readonly ExtractedFieldValue[];
}

export interface ExtractionConflict {
  readonly id: string;
  readonly unitId: string;
  readonly fieldId: string;
  readonly recordIds: readonly string[];
  readonly values: readonly unknown[];
  readonly status: "open" | "resolved";
}

export interface ExtractionAdjudicationInput {
  readonly id: string;
  readonly finalValue: unknown;
  readonly rationale: string;
  readonly adjudicatorId: string;
  readonly adjudicatedAt: string;
  readonly evidence: readonly ExtractionEvidence[];
  readonly decisionRecordId?: string;
}

export interface ExtractionAdjudication extends ExtractionAdjudicationInput {
  readonly conflictId: string;
  readonly unitId: string;
  readonly fieldId: string;
}

export type ExtractionReadiness =
  | { readonly status: "ready" }
  | { readonly status: "hard_stop"; readonly code: InstitutionalResearchHardStop; readonly reason: string };

export interface ExtractedDatasetFreezeInput {
  readonly id: string;
  readonly profile: ExtractionProfile;
  readonly records: readonly ExtractionRecord[];
  readonly conflicts: readonly ExtractionConflict[];
  readonly adjudications: readonly ExtractionAdjudication[];
  readonly decisionRecordId: string;
  readonly frozenAt: string;
}

export interface ExtractedDatasetFreeze {
  readonly id: string;
  readonly profileId: string;
  readonly profileHash: string;
  readonly recordIds: readonly string[];
  readonly adjudicationIds: readonly string[];
  readonly unresolvedConflictCount: number;
  readonly decisionRecordId: string;
  readonly frozenAt: string;
  readonly datasetHash: string;
}

export interface ExtractionAuditSummary {
  readonly profileId: string;
  readonly profileHash: string;
  readonly corpusType: ExtractionCorpusType;
  readonly unitOfAnalysis: string;
  readonly doubleExtractionRequired: boolean;
  readonly recordCount: number;
  readonly unitCount: number;
  readonly reliabilityStatistic: string;
  readonly reliabilityThreshold: number;
  readonly reliabilityObserved: number;
  readonly conflictCount: number;
  readonly adjudicatedCount: number;
  readonly missingRequiredValueCount: number;
  readonly datasetFreezeId: string;
  readonly datasetHash: string;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonical(nested)]));
  }
  return value;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function cloneFreeze<T>(value: T): T {
  const clone = JSON.parse(JSON.stringify(value)) as T;
  const freeze = (nested: unknown): void => {
    if (nested && typeof nested === "object" && !Object.isFrozen(nested)) {
      Object.values(nested as Record<string, unknown>).forEach(freeze);
      Object.freeze(nested);
    }
  };
  freeze(clone);
  return clone;
}

function fieldSchema(profile: ExtractionProfileInput): unknown {
  return {
    corpusType: profile.corpusType,
    unitOfAnalysis: profile.unitOfAnalysis,
    doubleExtractionRequired: profile.doubleExtractionRequired,
    reliability: { statistic: profile.reliability.statistic, threshold: profile.reliability.threshold },
    fields: profile.fields
  };
}

export function createExtractionProfile(input: ExtractionProfileInput): ExtractionProfile {
  if (!input.id.trim() || !input.unitOfAnalysis.trim() || !input.approvedDecisionRecordId.trim() || !input.frozenAt.trim()) {
    throw new Error("A frozen extraction profile requires stable IDs, unit of analysis, timestamp, and DecisionRecord approval.");
  }
  if (!Number.isInteger(input.version) || input.version < 1 || input.fields.length === 0) {
    throw new Error("An extraction profile requires a positive version and at least one field.");
  }
  if (input.reliability.threshold < 0 || input.reliability.threshold > 1 ||
      (input.reliability.observed !== undefined && (input.reliability.observed < 0 || input.reliability.observed > 1))) {
    throw new Error("Extraction reliability values must be between zero and one.");
  }
  const ids = new Set<string>();
  for (const field of input.fields) {
    if (!field.id.trim() || ids.has(field.id)) throw new Error(`Extraction field IDs must be non-empty and unique: ${field.id}`);
    ids.add(field.id);
    if ((field.valueType === "categorical" || field.valueType === "multi_categorical") && !field.allowedValues?.length) {
      throw new Error(`Categorical extraction field ${field.id} requires allowed values.`);
    }
  }
  return cloneFreeze({ ...input, profileHash: hash(fieldSchema(input)) });
}

function valueMatches(field: ExtractionFieldDefinition, value: unknown): boolean {
  if (field.valueType === "number") return typeof value === "number" && Number.isFinite(value);
  if (field.valueType === "boolean") return typeof value === "boolean";
  if (field.valueType === "multi_categorical") {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string" && field.allowedValues?.includes(entry));
  }
  if (field.valueType === "categorical") return typeof value === "string" && Boolean(field.allowedValues?.includes(value));
  return typeof value === "string";
}

export function validateExtractionRecord(profile: ExtractionProfile, input: ExtractionRecord): ExtractionRecord {
  if (!input.id.trim() || !input.unitId.trim() || !input.extractor.id.trim()) throw new Error("An extraction record requires stable record, unit, and extractor IDs.");
  if (input.profileId !== profile.id || input.profileHash !== profile.profileHash) throw new Error("Extraction record profile identity or hash does not match the frozen profile.");
  const byField = new Map(input.values.map((entry) => [entry.fieldId, entry]));
  if (byField.size !== input.values.length) throw new Error("An extraction record cannot repeat a field.");
  for (const value of input.values) {
    const field = profile.fields.find((candidate) => candidate.id === value.fieldId);
    if (!field) throw new Error(`Unknown extraction field: ${value.fieldId}`);
    if (!valueMatches(field, value.value)) throw new Error(`Invalid value for extraction field ${field.id}.`);
    if (field.evidenceRequired && (!value.evidence.length || value.evidence.some((item) => !item.sourceArtifactId.trim() || !item.locator.trim()))) {
      throw new Error(`Extraction field ${field.id} requires evidence provenance.`);
    }
  }
  for (const field of profile.fields) {
    if (field.required && !byField.has(field.id)) throw new Error(`Missing required field ${field.id}.`);
  }
  return cloneFreeze(input);
}

function comparable(value: unknown): string {
  const normalized = Array.isArray(value) ? [...value].sort() : value;
  return JSON.stringify(canonical(normalized));
}

export function detectExtractionConflicts(profile: ExtractionProfile, records: readonly ExtractionRecord[]): ExtractionConflict[] {
  const groups = new Map<string, ExtractionRecord[]>();
  for (const record of records) {
    validateExtractionRecord(profile, record);
    const group = groups.get(record.unitId) ?? [];
    group.push(record);
    groups.set(record.unitId, group);
  }
  const conflicts: ExtractionConflict[] = [];
  for (const [unitId, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (profile.doubleExtractionRequired && new Set(group.map((item) => item.extractor.id)).size < 2) continue;
    for (const field of profile.fields) {
      const entries = group.map((record) => ({ recordId: record.id, value: record.values.find((item) => item.fieldId === field.id)?.value }))
        .filter((entry) => entry.value !== undefined);
      if (new Set(entries.map((entry) => comparable(entry.value))).size > 1) {
        const recordIds = entries.map((entry) => entry.recordId).sort();
        conflicts.push(cloneFreeze({
          id: `conflict-${hash({ unitId, fieldId: field.id, recordIds }).slice(0, 24)}`,
          unitId,
          fieldId: field.id,
          recordIds,
          values: entries.sort((a, b) => a.recordId.localeCompare(b.recordId)).map((entry) => entry.value),
          status: "open" as const
        }));
      }
    }
  }
  return conflicts;
}

export function adjudicateExtractionConflict(
  profile: ExtractionProfile,
  conflict: ExtractionConflict,
  input: ExtractionAdjudicationInput
): ExtractionAdjudication {
  const field = profile.fields.find((candidate) => candidate.id === conflict.fieldId);
  if (!field || conflict.status !== "open") throw new Error("Only an open conflict in the frozen extraction profile can be adjudicated.");
  if (!input.id.trim() || !input.rationale.trim() || !input.adjudicatorId.trim()) throw new Error("Adjudication requires stable identity, adjudicator, and rationale.");
  if (!valueMatches(field, input.finalValue)) throw new Error(`Invalid adjudicated value for extraction field ${field.id}.`);
  if (field.evidenceRequired && input.evidence.length === 0) throw new Error(`Adjudication for ${field.id} requires evidence.`);
  return cloneFreeze({ ...input, conflictId: conflict.id, unitId: conflict.unitId, fieldId: conflict.fieldId });
}

export function assessExtractionReadiness(
  profile: ExtractionProfile,
  records: readonly ExtractionRecord[],
  conflicts: readonly ExtractionConflict[],
  adjudications: readonly ExtractionAdjudication[]
): ExtractionReadiness {
  if (!profile.profileHash || !profile.approvedDecisionRecordId) return { status: "hard_stop", code: "EXTRACTION_SCHEMA_UNFROZEN", reason: "The extraction profile is not frozen and approved." };
  if (profile.reliability.observed === undefined || profile.reliability.observed < profile.reliability.threshold) {
    return { status: "hard_stop", code: "EXTRACTION_RELIABILITY_BELOW_THRESHOLD", reason: "The extraction pilot has not met its declared reliability threshold." };
  }
  if (records.length === 0) {
    return { status: "hard_stop", code: "EXTRACTED_DATA_FREEZE_REQUIRED", reason: "No validated research-data extraction records are available to freeze." };
  }
  const units = new Map<string, Set<string>>();
  for (const record of records) {
    validateExtractionRecord(profile, record);
    const extractors = units.get(record.unitId) ?? new Set<string>();
    extractors.add(record.extractor.id);
    units.set(record.unitId, extractors);
  }
  if (profile.doubleExtractionRequired && [...units.values()].some((extractors) => extractors.size < 2)) {
    return { status: "hard_stop", code: "DOUBLE_EXTRACTION_CONFLICT", reason: "At least one unit has not received independent double extraction." };
  }
  const expectedConflictIds = detectExtractionConflicts(profile, records).map((conflict) => conflict.id).sort();
  const suppliedConflictIds = conflicts.map((conflict) => conflict.id).sort();
  if (JSON.stringify(expectedConflictIds) !== JSON.stringify(suppliedConflictIds)) {
    return { status: "hard_stop", code: "DOUBLE_EXTRACTION_CONFLICT", reason: "The supplied conflict ledger does not match deterministic conflict detection." };
  }
  const resolved = new Set(adjudications.map((item) => item.conflictId));
  if (conflicts.some((conflict) => !resolved.has(conflict.id))) {
    return { status: "hard_stop", code: "DOUBLE_EXTRACTION_CONFLICT", reason: "At least one extraction conflict remains unresolved." };
  }
  return { status: "ready" };
}

export function freezeExtractedDataset(input: ExtractedDatasetFreezeInput): ExtractedDatasetFreeze {
  if (!input.id.trim() || !input.decisionRecordId.trim() || !input.frozenAt.trim()) throw new Error("An extracted dataset freeze requires stable IDs, timestamp, and DecisionRecord approval.");
  const readiness = assessExtractionReadiness(input.profile, input.records, input.conflicts, input.adjudications);
  if (readiness.status !== "ready") {
    const wording = readiness.code === "DOUBLE_EXTRACTION_CONFLICT" ? `Unresolved conflict: ${readiness.reason}` : readiness.reason;
    throw new Error(wording);
  }
  const recordIds = input.records.map((record) => record.id).sort();
  const adjudicationIds = input.adjudications.map((item) => item.id).sort();
  const datasetHash = hash({
    profileHash: input.profile.profileHash,
    records: [...input.records].sort((a, b) => a.id.localeCompare(b.id)),
    adjudications: [...input.adjudications].sort((a, b) => a.id.localeCompare(b.id))
  });
  return cloneFreeze({
    id: input.id,
    profileId: input.profile.id,
    profileHash: input.profile.profileHash,
    recordIds,
    adjudicationIds,
    unresolvedConflictCount: 0,
    decisionRecordId: input.decisionRecordId,
    frozenAt: input.frozenAt,
    datasetHash
  });
}
