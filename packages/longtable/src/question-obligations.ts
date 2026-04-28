import type {
  FirstResearchShape,
  LongTableQuestionObligation,
  QuestionRecord,
  ResearchState
} from "@longtable/core";

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function pendingQuestionObligations(state: ResearchState): LongTableQuestionObligation[] {
  return (state.questionObligations ?? []).filter((obligation) => obligation.status === "pending");
}

export function createRequiredQuestionObligation(question: QuestionRecord): LongTableQuestionObligation {
  const timestamp = question.createdAt || nowIso();
  return {
    id: createId("question_obligation"),
    kind: "required_question",
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    prompt: question.prompt.question,
    reason: question.prompt.displayReason ?? "A required LongTable checkpoint is pending.",
    questionId: question.id
  };
}

export function createFirstResearchShapeObligation(
  shape: FirstResearchShape,
  options: {
    prompt: string;
    reason: string;
    questionId?: string;
  }
): LongTableQuestionObligation {
  const timestamp = nowIso();
  return {
    id: createId("question_obligation"),
    kind: "first_research_shape_confirmation",
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    prompt: options.prompt,
    reason: options.reason,
    ...(shape.sourceHookId ? { sourceHookId: shape.sourceHookId } : {}),
    ...(options.questionId ? { questionId: options.questionId } : {})
  };
}

export function upsertQuestionObligation(
  state: ResearchState,
  obligation: LongTableQuestionObligation
): ResearchState {
  const current = state.questionObligations ?? [];
  const next = current.some((entry) => entry.id === obligation.id)
    ? current.map((entry) => entry.id === obligation.id ? obligation : entry)
    : [...current, obligation];
  return {
    ...state,
    questionObligations: next
  };
}

export function ensureRequiredQuestionObligation(
  state: ResearchState,
  question: QuestionRecord
): ResearchState {
  if (!question.prompt.required) {
    return state;
  }

  const existing = (state.questionObligations ?? []).find((obligation) =>
    obligation.kind === "required_question" &&
    obligation.questionId === question.id &&
    obligation.status === "pending"
  );
  if (existing) {
    return state;
  }

  return upsertQuestionObligation(state, createRequiredQuestionObligation(question));
}

export function ensureFirstResearchShapeObligation(
  state: ResearchState,
  shape: FirstResearchShape,
  options: {
    prompt: string;
    reason: string;
    questionId?: string;
  }
): ResearchState {
  const current = state.questionObligations ?? [];
  const existing = current.find((obligation) =>
    obligation.kind === "first_research_shape_confirmation" &&
    obligation.status === "pending" &&
    obligation.sourceHookId === shape.sourceHookId
  );

  if (!existing) {
    return upsertQuestionObligation(state, createFirstResearchShapeObligation(shape, options));
  }

  const updated: LongTableQuestionObligation = {
    ...existing,
    updatedAt: nowIso(),
    prompt: options.prompt,
    reason: options.reason,
    ...(shape.sourceHookId ? { sourceHookId: shape.sourceHookId } : {}),
    ...(options.questionId ? { questionId: options.questionId } : {}),
    ...(existing.decisionId ? { decisionId: existing.decisionId } : {})
  };
  return upsertQuestionObligation(state, updated);
}

export function resolveQuestionObligationByQuestionId(
  state: ResearchState,
  questionId: string,
  decisionId?: string,
  status: "satisfied" | "cleared" = "satisfied"
): ResearchState {
  return {
    ...state,
    questionObligations: (state.questionObligations ?? []).map((obligation) => {
      if (obligation.questionId !== questionId || obligation.status !== "pending") {
        return obligation;
      }
      return {
        ...obligation,
        status,
        updatedAt: nowIso(),
        ...(decisionId ? { decisionId } : obligation.decisionId ? { decisionId: obligation.decisionId } : {})
      };
    })
  };
}

export function resolveFirstResearchShapeObligation(
  state: ResearchState,
  options: {
    sourceHookId?: string;
    questionId?: string;
    decisionId?: string;
    status?: "satisfied" | "cleared";
  }
): ResearchState {
  return {
    ...state,
    questionObligations: (state.questionObligations ?? []).map((obligation) => {
      const matches = obligation.kind === "first_research_shape_confirmation" && (
        (options.sourceHookId && obligation.sourceHookId === options.sourceHookId) ||
        (options.questionId && obligation.questionId === options.questionId)
      );
      if (!matches || obligation.status !== "pending") {
        return obligation;
      }
      return {
        ...obligation,
        status: options.status ?? "satisfied",
        updatedAt: nowIso(),
        ...(options.questionId ? { questionId: options.questionId } : obligation.questionId ? { questionId: obligation.questionId } : {}),
        ...(options.decisionId ? { decisionId: options.decisionId } : obligation.decisionId ? { decisionId: obligation.decisionId } : {})
      };
    })
  };
}
