import {
  INSTITUTIONAL_RESEARCH_HARD_STOPS,
  INSTITUTIONAL_RESEARCH_RETRYABLE_EVENTS,
  type InstitutionalResearchRetryableEvent
} from "./workflow-types.js";

export const RESEARCH_FAILURE_INJECTION_MATRIX = [
  "network_timeout",
  "delayed_export",
  "partial_download",
  "corrupt_pdf",
  "empty_export",
  "count_mismatch",
  "placeholder_file",
  "interrupted_run",
  "missing_doi",
  "session_expiry",
  "result_cap",
  "onedrive_hydration_delay"
] as const;

export interface RetryPlanInput {
  readonly code: string;
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export interface RetryPlan {
  readonly code: InstitutionalResearchRetryableEvent;
  readonly maxAttempts: number;
  readonly delaysMs: readonly number[];
  readonly requiresResearcherDecision: false;
}

export interface RetryOutcome {
  readonly code: InstitutionalResearchRetryableEvent;
  readonly attempts: number;
  readonly recovered: boolean;
}

function positiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
}

export function buildRetryPlan(input: RetryPlanInput): RetryPlan {
  if ((INSTITUTIONAL_RESEARCH_HARD_STOPS as readonly string[]).includes(input.code)) {
    throw new Error(`${input.code} is a hard stop and must never be retried automatically.`);
  }
  if (!(INSTITUTIONAL_RESEARCH_RETRYABLE_EVENTS as readonly string[]).includes(input.code)) {
    throw new Error(`Unknown retry event: ${input.code}.`);
  }
  positiveInteger(input.maxAttempts, "Maximum attempts");
  positiveInteger(input.baseDelayMs, "Base delay");
  positiveInteger(input.maxDelayMs, "Maximum delay");
  if (input.maxDelayMs < input.baseDelayMs) throw new Error("Maximum delay must be at least the base delay.");
  const delaysMs = Array.from({ length: Math.max(0, input.maxAttempts - 1) }, (_, index) =>
    Math.min(input.maxDelayMs, input.baseDelayMs * (2 ** index))
  );
  return {
    code: input.code as InstitutionalResearchRetryableEvent,
    maxAttempts: input.maxAttempts,
    delaysMs,
    requiresResearcherDecision: false
  };
}

export function aggregateRetryAdvisory(outcomes: readonly RetryOutcome[]): {
  readonly advisoryCount: 0 | 1;
  readonly message: string;
} {
  if (outcomes.length === 0) return { advisoryCount: 0, message: "No retryable events were recorded." };
  const counts = new Map<InstitutionalResearchRetryableEvent, number>();
  for (const outcome of outcomes) counts.set(outcome.code, (counts.get(outcome.code) ?? 0) + 1);
  const summary = [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([code, count]) => `${code} × ${count}`).join("; ");
  const unrecovered = outcomes.filter((outcome) => !outcome.recovered).length;
  return {
    advisoryCount: 1,
    message: `Retry summary: ${summary}. ${unrecovered} event(s) remained unresolved; see the retry ledger for artifact-level details.`
  };
}

