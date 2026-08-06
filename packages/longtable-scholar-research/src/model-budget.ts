import { createHash } from "node:crypto";
import type { InstitutionalResearchStage } from "./workflow-types.js";

export interface ModelCallBudget {
  readonly stage: InstitutionalResearchStage;
  readonly purpose: string;
  readonly maximumCalls: number;
}

export interface ModelCallCacheKeyInput {
  readonly artifactSha256: string;
  readonly ruleVersion: string;
  readonly codebookVersion: string;
  readonly promptVersion: string;
  readonly modelVersion: string;
}

export const ZERO_MODEL_CALL_STAGES: readonly InstitutionalResearchStage[] = [
  "SETUP",
  "PRODUCTION_SEARCH",
  "EXPORT_AUDIT",
  "FULLTEXT_PLAN_CHECKPOINT",
  "FULLTEXT_ACQUISITION",
  "CORPUS_FREEZE_CHECKPOINT",
  "RESEARCHER_REPORT",
  "MANUSCRIPT_PACKAGE"
];

export function buildModelCallCacheKey(input: ModelCallCacheKeyInput): string {
  if (!/^[a-f0-9]{64}$/i.test(input.artifactSha256)) throw new Error("Model cache input requires an artifact SHA-256 hash.");
  return createHash("sha256").update(JSON.stringify({
    artifactSha256: input.artifactSha256.toLowerCase(),
    codebookVersion: input.codebookVersion,
    modelVersion: input.modelVersion,
    promptVersion: input.promptVersion,
    ruleVersion: input.ruleVersion
  })).digest("hex");
}

export function modelCallBudgetForStage(
  stage: InstitutionalResearchStage,
  purpose = "mechanical_stage",
  configuredMaximumCalls?: number
): ModelCallBudget {
  if (stage === "PROTOCOL_CHECKPOINT" && purpose === "search_strategy_proposal") {
    return { stage, purpose, maximumCalls: 1 };
  }
  if (stage === "PILOT" && purpose === "pilot_interpretation") {
    return { stage, purpose, maximumCalls: 1 };
  }
  if ((stage === "TITLE_ABSTRACT_SCREENING" || stage === "FULLTEXT_SCREENING") && purpose === "configured_screening_batch") {
    if (!Number.isInteger(configuredMaximumCalls) || (configuredMaximumCalls ?? 0) < 0) {
      throw new Error("A configured screening batch requires a non-negative integer model-call limit.");
    }
    return { stage, purpose, maximumCalls: configuredMaximumCalls as number };
  }
  return { stage, purpose, maximumCalls: 0 };
}

export function assertModelCallBudget(budget: ModelCallBudget, observedCalls: number): void {
  if (!Number.isInteger(observedCalls) || observedCalls < 0) throw new Error("Observed model calls must be a non-negative integer.");
  if (observedCalls > budget.maximumCalls) {
    throw new Error(`Model-call budget exceeded for ${budget.stage}/${budget.purpose}: observed ${observedCalls}, allowed ${budget.maximumCalls}.`);
  }
}
