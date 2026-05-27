import type {
  FirstResearchShape,
  LongTableHardStopScope,
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

export interface LongTableHardStopBlocker {
  type: "question" | "obligation";
  id: string;
  scope: LongTableHardStopScope;
  prompt: string;
  reason: string;
  sourceField: "hardStop" | "derived";
  commandHint: string;
  priority: number;
}

export interface LongTableHardStopVerdict {
  stopWouldBlock: boolean;
  activeBlockers: LongTableHardStopBlocker[];
  stalePendingQuestionCount: number;
  stalePendingObligationCount: number;
  nextActions: string[];
}

const RESEARCH_SPECIFICATION_KEYWORDS = [
  "research_specification",
  "research specification",
  "research_direction",
  "research direction",
  "research_question",
  "research question",
  "scope",
  "boundary",
  "construct",
  "measurement",
  "coding",
  "method",
  "analysis",
  "evidence",
  "access",
  "protected_decision",
  "protected decision",
  "closure"
];

function compactText(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join("\n").toLowerCase();
}

function includesResearchSpecificationKeyword(text: string): boolean {
  return RESEARCH_SPECIFICATION_KEYWORDS.some((keyword) => text.includes(keyword));
}

function scopePriority(scope: LongTableHardStopScope): number {
  switch (scope) {
    case "research_question":
      return 10;
    case "scope":
      return 20;
    case "construct":
      return 30;
    case "method":
      return 40;
    case "evidence":
      return 50;
    case "protected_decision":
      return 60;
  }
}

function scopeForQuestion(question: QuestionRecord, text: string): LongTableHardStopScope | null {
  if (question.hardStopScope) {
    return question.hardStopScope;
  }
  switch (question.commitmentFamily) {
    case "scope":
      return text.includes("research question") || text.includes("research_question")
        ? "research_question"
        : "scope";
    case "construct":
    case "coding":
      return "construct";
    case "method":
      return "method";
    case "evidence":
      return "evidence";
    case "epistemic_authority":
      return "protected_decision";
    case "product_policy":
      return null;
    default:
      if (/\bresearch[_ -]?question\b/.test(text) || /연구\s*질문/.test(text)) return "research_question";
      if (/\bscope|boundary\b/.test(text) || /범위|경계/.test(text)) return "scope";
      if (/\bconstruct|measurement|coding\b/.test(text) || /구성개념|측정|코딩/.test(text)) return "construct";
      if (/\bmethod|analysis\b/.test(text) || /방법|분석/.test(text)) return "method";
      if (/\bevidence|access|source|full[- ]?text|pdf\b/.test(text) || /근거|접근|원문|출처|문헌/.test(text)) return "evidence";
      if (/\bprotected[_ -]?decision\b/.test(text) || /보호된\s*결정|핵심\s*결정/.test(text)) return "protected_decision";
      return null;
  }
}

function hardStopQuestionBlocker(question: QuestionRecord): LongTableHardStopBlocker | null {
  if (question.status !== "pending") {
    return null;
  }
  if (question.hardStop === false) {
    return null;
  }

  const text = compactText(
    question.prompt.checkpointKey,
    question.prompt.title,
    question.prompt.question,
    question.prompt.displayReason,
    ...question.prompt.rationale
  );
  const explicit = question.hardStop === true;
  if (!explicit && (!question.prompt.required || !includesResearchSpecificationKeyword(text))) {
    return null;
  }
  const scope = scopeForQuestion(question, text);
  if (!scope) {
    return null;
  }

  return {
    type: "question",
    id: question.id,
    scope,
    prompt: question.prompt.question,
    reason: question.prompt.displayReason ?? "A Research Specification-affecting question is pending.",
    sourceField: explicit ? "hardStop" : "derived",
    commandHint: `longtable decide --question ${question.id} --answer <value>`,
    priority: scopePriority(scope)
  };
}

function scopeForObligation(
  obligation: LongTableQuestionObligation,
  linkedQuestion?: QuestionRecord
): LongTableHardStopScope | null {
  if (obligation.hardStopScope) {
    return obligation.hardStopScope;
  }
  if (linkedQuestion) {
    return scopeForQuestion(linkedQuestion, compactText(
      linkedQuestion.prompt.checkpointKey,
      linkedQuestion.prompt.title,
      linkedQuestion.prompt.question,
      linkedQuestion.prompt.displayReason,
      ...linkedQuestion.prompt.rationale
    ));
  }
  if (obligation.kind === "research_specification_confirmation") {
    return "scope";
  }
  return null;
}

function hardStopObligationBlocker(
  obligation: LongTableQuestionObligation,
  linkedQuestion?: QuestionRecord
): LongTableHardStopBlocker | null {
  if (obligation.status !== "pending") {
    return null;
  }
  if (obligation.hardStop === false) {
    return null;
  }
  const explicit = obligation.hardStop === true;
  const derived = obligation.kind === "research_specification_confirmation" ||
    (obligation.kind === "required_question" && Boolean(linkedQuestion && hardStopQuestionBlocker(linkedQuestion)));
  if (!explicit && !derived) {
    return null;
  }
  const scope = scopeForObligation(obligation, linkedQuestion);
  if (!scope) {
    return null;
  }

  return {
    type: "obligation",
    id: obligation.id,
    scope,
    prompt: obligation.prompt,
    reason: obligation.reason,
    sourceField: explicit ? "hardStop" : "derived",
    commandHint: obligation.questionId
      ? `longtable decide --question ${obligation.questionId} --answer <value>`
      : "record a DecisionRecord before applying the Research Specification change",
    priority: scopePriority(scope) + 5
  };
}

export function collectHardStopBlockers(state: ResearchState): LongTableHardStopVerdict {
  const pendingQuestions = (state.questionLog ?? []).filter((question) => question.status === "pending");
  const questionsById = new Map((state.questionLog ?? []).map((question) => [question.id, question] as const));
  const questionBlockers = pendingQuestions
    .map(hardStopQuestionBlocker)
    .filter((blocker): blocker is LongTableHardStopBlocker => Boolean(blocker));
  const obligationBlockers = pendingQuestionObligations(state)
    .map((obligation) => hardStopObligationBlocker(
      obligation,
      obligation.questionId ? questionsById.get(obligation.questionId) : undefined
    ))
    .filter((blocker): blocker is LongTableHardStopBlocker => Boolean(blocker));
  const byKey = new Map<string, LongTableHardStopBlocker>();
  for (const blocker of [...questionBlockers, ...obligationBlockers]) {
    byKey.set(`${blocker.type}:${blocker.id}`, blocker);
  }
  const activeBlockers = [...byKey.values()].sort((left, right) =>
    left.priority - right.priority ||
    left.id.localeCompare(right.id)
  );

  return {
    stopWouldBlock: activeBlockers.length > 0,
    activeBlockers,
    stalePendingQuestionCount: Math.max(0, pendingQuestions.length - questionBlockers.length),
    stalePendingObligationCount: Math.max(0, pendingQuestionObligations(state).length - obligationBlockers.length),
    nextActions: activeBlockers.length > 0
      ? activeBlockers.slice(0, 3).map((blocker) => blocker.commandHint)
      : []
  };
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
    ...(typeof question.hardStop === "boolean" ? { hardStop: question.hardStop } : {}),
    ...(question.hardStopScope ? { hardStopScope: question.hardStopScope } : {}),
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
