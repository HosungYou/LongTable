import type {
  LongTableQuestionObligation,
  QuestionHardStopScope,
  QuestionRecord,
  ResearchSpecificationChange,
  ResearchState
} from "@longtable/core";

export type HardStopBlockerType = "question" | "obligation" | "spec_patch";

export interface HardStopBlocker {
  type: HardStopBlockerType;
  id: string;
  scope: QuestionHardStopScope;
  prompt: string;
  reason: string;
  sourceField: string;
  nextAction: string;
  priority: number;
}

export interface HardStopVerdict {
  stopWouldBlock: boolean;
  activeBlockers: HardStopBlocker[];
  stalePendingQuestionCount: number;
  stalePendingObligationCount: number;
  nextActions: string[];
}

const HARD_STOP_CHECKPOINT_SCOPES: Array<[RegExp, QuestionHardStopScope]> = [
  [/research_(?:question|direction|specification)|question_freeze|direction_change/i, "research_question"],
  [/scope|boundary|criteria|required_sections/i, "scope"],
  [/construct|theory|measurement|validity|coding/i, "construct"],
  [/method|analysis|sampling|design|plan/i, "method"],
  [/evidence|access|source|corpus|full[-_]?text|pdf/i, "evidence"],
  [/protected_decision|authorship_voice/i, "protected_decision"]
];

const HARD_STOP_CHANGE_SCOPES: Array<[RegExp, QuestionHardStopScope]> = [
  [/researchDirection\.question/i, "research_question"],
  [/researchDirection|scope|inclusion|exclusion/i, "scope"],
  [/constructOntology|theoryAndFraming|measurementCoding|coding/i, "construct"],
  [/methodAnalysis|analysis|design/i, "method"],
  [/evidenceAccess|source|corpus|access/i, "evidence"],
  [/protectedDecisions|epistemicAlignment/i, "protected_decision"]
];

const PRODUCT_OR_TOOLING_CHECKPOINT = /\b(product|runtime|guidance|setup|install|hook|mcp|codex|claude|skill|prompt|docs?|release|version|npm|git|github|simulation|policy)\b/i;

function scopeFromCheckpointKey(checkpointKey: string | undefined): QuestionHardStopScope | null {
  if (!checkpointKey) {
    return null;
  }
  if (PRODUCT_OR_TOOLING_CHECKPOINT.test(checkpointKey)) {
    return null;
  }
  return HARD_STOP_CHECKPOINT_SCOPES.find(([pattern]) => pattern.test(checkpointKey))?.[1] ?? null;
}

function scopeFromCommitmentFamily(family: QuestionRecord["commitmentFamily"]): QuestionHardStopScope | null {
  switch (family) {
    case "scope":
      return "scope";
    case "construct":
    case "coding":
      return "construct";
    case "method":
      return "method";
    case "evidence":
      return "evidence";
    case "epistemic_authority":
      return "protected_decision";
    default:
      return null;
  }
}

function isPendingQuestion(question: QuestionRecord): boolean {
  return question.status === "pending";
}

function isPendingObligation(obligation: LongTableQuestionObligation): boolean {
  return obligation.status === "pending";
}

function inferQuestionHardStopScope(question: QuestionRecord): QuestionHardStopScope | null {
  if (question.hardStop === false || !isPendingQuestion(question)) {
    return null;
  }
  if (question.hardStop === true) {
    return question.hardStopScope ?? scopeFromCommitmentFamily(question.commitmentFamily) ?? scopeFromCheckpointKey(question.prompt.checkpointKey) ?? "scope";
  }
  if (!question.prompt.required) {
    return null;
  }
  return scopeFromCheckpointKey(question.prompt.checkpointKey) ?? scopeFromCommitmentFamily(question.commitmentFamily);
}

function inferObligationHardStopScope(
  obligation: LongTableQuestionObligation,
  linkedQuestion?: QuestionRecord
): QuestionHardStopScope | null {
  if (obligation.hardStop === false || !isPendingObligation(obligation)) {
    return null;
  }
  if (obligation.hardStop === true) {
    return obligation.hardStopScope ?? linkedQuestion?.hardStopScope ?? inferQuestionHardStopScope(linkedQuestion as QuestionRecord) ?? "scope";
  }
  if (obligation.kind === "research_specification_confirmation") {
    return "scope";
  }
  if (obligation.kind === "required_question" && linkedQuestion) {
    return inferQuestionHardStopScope(linkedQuestion);
  }
  return null;
}

function scopeFromChange(change: ResearchSpecificationChange): QuestionHardStopScope | null {
  return HARD_STOP_CHANGE_SCOPES.find(([pattern]) => pattern.test(change.path))?.[1] ?? null;
}

function priorityForScope(scope: QuestionHardStopScope): number {
  return {
    research_question: 10,
    scope: 20,
    construct: 30,
    method: 40,
    evidence: 50,
    protected_decision: 60
  }[scope];
}

function nextActionFor(type: HardStopBlockerType, id: string): string {
  if (type === "question") {
    return `decide, clear, or defer question ${id} with rationale`;
  }
  if (type === "obligation") {
    return `satisfy, clear, or defer obligation ${id} with rationale`;
  }
  return `record a DecisionRecord before applying patch ${id}`;
}

function blockerSort(a: HardStopBlocker, b: HardStopBlocker): number {
  return a.priority - b.priority || a.type.localeCompare(b.type) || a.id.localeCompare(b.id);
}

function uniqueBlockers(blockers: HardStopBlocker[]): HardStopBlocker[] {
  const seen = new Set<string>();
  const unique: HardStopBlocker[] = [];
  for (const blocker of blockers.sort(blockerSort)) {
    const key = `${blocker.type}:${blocker.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(blocker);
    }
  }
  return unique;
}

export function collectHardStopBlockers(state: ResearchState): HardStopVerdict {
  const questions = state.questionLog ?? [];
  const questionById = new Map(questions.map((question) => [question.id, question] as const));
  const blockers: HardStopBlocker[] = [];

  for (const question of questions) {
    const scope = inferQuestionHardStopScope(question);
    if (!scope) {
      continue;
    }
    blockers.push({
      type: "question",
      id: question.id,
      scope,
      prompt: question.prompt.question,
      reason: question.prompt.displayReason ?? question.prompt.rationale[0] ?? "A Research Specification-affecting question is pending.",
      sourceField: question.hardStop === true ? "QuestionRecord.hardStop" : "QuestionRecord.derived",
      nextAction: nextActionFor("question", question.id),
      priority: priorityForScope(scope)
    });
  }

  for (const obligation of state.questionObligations ?? []) {
    const linkedQuestion = obligation.questionId ? questionById.get(obligation.questionId) : undefined;
    const scope = inferObligationHardStopScope(obligation, linkedQuestion);
    if (!scope) {
      continue;
    }
    blockers.push({
      type: "obligation",
      id: obligation.id,
      scope,
      prompt: obligation.prompt,
      reason: obligation.reason,
      sourceField: obligation.hardStop === true ? "LongTableQuestionObligation.hardStop" : "LongTableQuestionObligation.derived",
      nextAction: nextActionFor("obligation", obligation.id),
      priority: priorityForScope(scope) + 1
    });
  }

  for (const patch of state.specPatches ?? []) {
    if (patch.status !== "proposed" || patch.decisionRecordId) {
      continue;
    }
    const scope = patch.changes.map(scopeFromChange).find((candidate): candidate is QuestionHardStopScope => Boolean(candidate));
    if (!scope) {
      continue;
    }
    blockers.push({
      type: "spec_patch",
      id: patch.id,
      scope,
      prompt: patch.title,
      reason: patch.rationale ?? "A proposed Research Specification patch changes protected research state.",
      sourceField: "ResearchSpecificationPatch.changes",
      nextAction: nextActionFor("spec_patch", patch.id),
      priority: priorityForScope(scope) + 2
    });
  }

  const activeBlockers = uniqueBlockers(blockers);
  const blockerQuestionIds = new Set(activeBlockers.filter((blocker) => blocker.type === "question").map((blocker) => blocker.id));
  const blockerObligationIds = new Set(activeBlockers.filter((blocker) => blocker.type === "obligation").map((blocker) => blocker.id));
  const stalePendingQuestionCount = questions.filter((question) =>
    question.status === "pending" &&
    question.prompt.required &&
    !blockerQuestionIds.has(question.id)
  ).length;
  const stalePendingObligationCount = (state.questionObligations ?? []).filter((obligation) =>
    obligation.status === "pending" &&
    !blockerObligationIds.has(obligation.id)
  ).length;

  return {
    stopWouldBlock: activeBlockers.length > 0,
    activeBlockers,
    stalePendingQuestionCount,
    stalePendingObligationCount,
    nextActions: activeBlockers.map((blocker) => blocker.nextAction)
  };
}
