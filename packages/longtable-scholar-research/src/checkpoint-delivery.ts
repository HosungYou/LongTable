import type { QuestionRecord, QuestionTransportStatus } from "@longtable/core";

export interface CheckpointDeliveryAttempt {
  readonly surface: "mcp_elicitation" | "numbered";
  readonly status: QuestionTransportStatus;
  readonly attemptedAt: string;
  readonly message?: string;
}

export interface CheckpointDeliveryRecord {
  readonly questionRecordId: string;
  readonly checkpointKey: string;
  readonly attempts: readonly CheckpointDeliveryAttempt[];
}

export function deliverCheckpointWithFallback(
  question: QuestionRecord,
  input: {
    readonly status: "declined" | "unsupported" | "timeout" | "error";
    readonly message: string;
    readonly attemptedAt: string;
    readonly fallbackAt: string;
  }
): { readonly question: QuestionRecord; readonly delivery: CheckpointDeliveryRecord } {
  if (question.status !== "pending" || !question.prompt.checkpointKey) {
    throw new Error("Only a pending checkpoint with a stable key can use transport fallback.");
  }
  const attempts: CheckpointDeliveryAttempt[] = [
    { surface: "mcp_elicitation", status: input.status, attemptedAt: input.attemptedAt, message: input.message },
    { surface: "numbered", status: "fallback_rendered", attemptedAt: input.fallbackAt, message: "MCP did not yield a decision; the same checkpoint was rendered as numbered text." }
  ];
  return {
    question: {
      ...question,
      updatedAt: input.fallbackAt,
      transportStatus: { surface: "numbered", status: "fallback_rendered", updatedAt: input.fallbackAt, message: attempts[1].message }
    },
    delivery: { questionRecordId: question.id, checkpointKey: question.prompt.checkpointKey, attempts }
  };
}

