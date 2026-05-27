import type {
  HardStopScope,
  LongTableQuestionObligation,
  QuestionCommitmentFamily,
  QuestionRecord,
  ResearchSpecificationChange,
  ResearchState
} from "./types.js";

export type HardStopBlockerType = "question" | "obligation" | "spec_patch";

export interface HardStopBlocker {
  type: HardStopBlockerType;
  id: string;
  scope: HardStopScope;
  prompt: string;
  reason: string;
  source: string;
  sourceField: string;
  commandHint: string;
  commandHints: string[];
  nextAction: string;
  priority: number;
}

export interface HardStopVerdict {
  stopWouldBlock: boolean;
  activeBlockers: HardStopBlocker[];
  staleOrUnrelatedPendingQuestionCount: number;
  stalePendingQuestionCount: number;
  stalePendingObligationCount: number;
  nextActions: string[];
}

const SCOPE_PRIORITY: Record<HardStopScope, number> = {
  research_question: 10,
  scope: 20,
  construct: 30,
  method: 40,
  evidence: 50,
  protected_decision: 60
};

const CHECKPOINT_SCOPE_PATTERNS: Array<[RegExp, HardStopScope]> = [
  [/research_(?:question|direction|specification)|research question|question_freeze|direction_change/i, "research_question"],
  [/scope|boundary|criteria|required_sections|inclusion|exclusion/i, "scope"],
  [/construct|theory|framing|ontology|measurement|validity|coding/i, "construct"],
  [/method|analysis|sampling|design|plan|strategy/i, "method"],
  [/evidence|access|source|corpus|full[-_ ]?text|pdf|scholarly/i, "evidence"],
  [/protected_decision|protected decision|authorship_voice|epistemic/i, "protected_decision"]
];

const PATCH_SCOPE_PATTERNS: Array<[RegExp, HardStopScope]> = [
  [/researchDirection\.question/i, "research_question"],
  [/researchDirection|scope|inclusion|exclusion/i, "scope"],
  [/constructOntology|theoryAndFraming|measurementCoding|coding/i, "construct"],
  [/methodAnalysis|analysis|design/i, "method"],
  [/evidenceAccess|source|corpus|access/i, "evidence"],
  [/protectedDecisions|epistemicAlignment/i, "protected_decision"]
];

const PRODUCT_OR_TOOLING_PATTERN = /\b(product|runtime|guidance|setup|install|hook|mcp|codex|claude|skill|prompt|docs?|documentation|release|version|npm|git|github|simulation|policy|workflow|package|router|autocomplete)\b/i;

function compactText(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join("\n");
}

function readBooleanFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readScope(value: unknown): HardStopScope | null {
  return value === "research_question" ||
    value === "scope" ||
    value === "construct" ||
    value === "method" ||
    value === "evidence" ||
    value === "protected_decision"
    ? value
    : null;
}

function scopeFromCommitmentFamily(family: QuestionCommitmentFamily | undefined): HardStopScope | null {
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

function scopeFromText(text: string): HardStopScope | null {
  if (PRODUCT_OR_TOOLING_PATTERN.test(text)) {
    return null;
  }
  return CHECKPOINT_SCOPE_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function questionSearchText(question: QuestionRecord): string {
  return compactText(
    question.prompt.checkpointKey,
    question.prompt.title,
    question.prompt.question,
    question.prompt.displayReason,
    question.commitmentFamily,
    question.epistemicBasis,
    ...(question.prompt.rationale ?? [])
  );
}

function obligationSearchText(obligation: LongTableQuestionObligation): string {
  return compactText(obligation.kind, obligation.prompt, obligation.reason);
}

function inferQuestionHardStopScope(question: QuestionRecord): { scope: HardStopScope; sourceField: string } | null {
  if (question.status !== "pending") {
    return null;
  }
  const explicitHardStop = readBooleanFlag(question.hardStop);
  if (explicitHardStop === false) {
    return null;
  }

  const explicitScope = readScope(question.hardStopScope);
  if (explicitHardStop === true) {
    return {
      scope: explicitScope ?? scopeFromCommitmentFamily(question.commitmentFamily) ?? scopeFromText(questionSearchText(question)) ?? "scope",
      sourceField: explicitScope ? "QuestionRecord.hardStopScope" : "QuestionRecord.hardStop"
    };
  }

  if (!question.prompt.required) {
    return null;
  }

  const familyScope = scopeFromCommitmentFamily(question.commitmentFamily);
  if (familyScope) {
    return { scope: familyScope, sourceField: "QuestionRecord.commitmentFamily" };
  }

  const textScope = scopeFromText(questionSearchText(question));
  return textScope ? { scope: textScope, sourceField: "QuestionRecord.derived" } : null;
}

function inferObligationHardStopScope(
  obligation: LongTableQuestionObligation,
  linkedQuestion?: QuestionRecord
): { scope: HardStopScope; sourceField: string } | null {
  if (obligation.status !== "pending") {
    return null;
  }
  const explicitHardStop = readBooleanFlag(obligation.hardStop);
  if (explicitHardStop === false) {
    return null;
  }

  const explicitScope = readScope(obligation.hardStopScope);
  if (explicitHardStop === true) {
    return {
      scope: explicitScope ?? (linkedQuestion ? inferQuestionHardStopScope(linkedQuestion)?.scope : null) ?? scopeFromText(obligationSearchText(obligation)) ?? "scope",
      sourceField: explicitScope ? "LongTableQuestionObligation.hardStopScope" : "LongTableQuestionObligation.hardStop"
    };
  }

  if (obligation.kind === "research_specification_confirmation") {
    return {
      scope: scopeFromText(obligationSearchText(obligation)) ?? "scope",
      sourceField: "LongTableQuestionObligation.derived"
    };
  }

  if (obligation.kind === "required_question" && linkedQuestion) {
    const linkedScope = inferQuestionHardStopScope(linkedQuestion);
    return linkedScope
      ? { scope: linkedScope.scope, sourceField: "LongTableQuestionObligation.derived" }
      : null;
  }

  return null;
}

function scopeFromPatchChange(change: ResearchSpecificationChange): HardStopScope | null {
  return PATCH_SCOPE_PATTERNS.find(([pattern]) => pattern.test(change.path))?.[1] ?? null;
}

function commandHintsForQuestion(id: string): string[] {
  return [
    `longtable decide --question ${id} --answer <value> --rationale <why>`,
    `longtable clear-question --question ${id} --reason <why safe to defer or clear>`
  ];
}

function commandHintsForBlocker(type: HardStopBlockerType, id: string, questionId?: string): string[] {
  if (questionId) {
    return commandHintsForQuestion(questionId);
  }
  if (type === "question") {
    return commandHintsForQuestion(id);
  }
  if (type === "obligation") {
    return [`longtable obligation resolve --id ${id} --reason <why>`];
  }
  return [`record a DecisionRecord before applying patch ${id}`];
}

function createBlocker(input: {
  type: HardStopBlockerType;
  id: string;
  scope: HardStopScope;
  prompt: string;
  reason: string;
  sourceField: string;
  questionId?: string;
  priorityOffset: number;
}): HardStopBlocker {
  const commandHints = commandHintsForBlocker(input.type, input.id, input.questionId);
  const commandHint = commandHints[0] ?? "decide, clear, or defer with rationale";
  return {
    type: input.type,
    id: input.id,
    scope: input.scope,
    prompt: input.prompt,
    reason: input.reason,
    source: input.sourceField,
    sourceField: input.sourceField,
    commandHint,
    commandHints,
    nextAction: commandHint,
    priority: SCOPE_PRIORITY[input.scope] + input.priorityOffset
  };
}

export function collectHardStopBlockers(state: ResearchState): HardStopVerdict {
  const questions = state.questionLog ?? [];
  const questionById = new Map(questions.map((question) => [question.id, question] as const));
  const pendingQuestions = questions.filter((question) => question.status === "pending");
  const pendingObligations = (state.questionObligations ?? []).filter((obligation) => obligation.status === "pending");
  const blockers: HardStopBlocker[] = [];

  pendingQuestions.forEach((question, index) => {
    const hardStop = inferQuestionHardStopScope(question);
    if (!hardStop) {
      return;
    }
    blockers.push(createBlocker({
      type: "question",
      id: question.id,
      scope: hardStop.scope,
      prompt: question.prompt.question,
      reason: question.prompt.displayReason ?? question.prompt.rationale?.[0] ?? "A Research Specification-affecting question is pending.",
      sourceField: hardStop.sourceField,
      priorityOffset: index / 1000
    }));
  });

  pendingObligations.forEach((obligation, index) => {
    const linkedQuestion = obligation.questionId ? questionById.get(obligation.questionId) : undefined;
    const hardStop = inferObligationHardStopScope(obligation, linkedQuestion);
    if (!hardStop) {
      return;
    }
    blockers.push(createBlocker({
      type: "obligation",
      id: obligation.id,
      scope: hardStop.scope,
      prompt: obligation.prompt,
      reason: obligation.reason,
      sourceField: hardStop.sourceField,
      questionId: obligation.questionId,
      priorityOffset: 0.1 + index / 1000
    }));
  });

  for (const [index, patch] of (state.specPatches ?? []).entries()) {
    if (patch.status !== "proposed" || patch.decisionRecordId) {
      continue;
    }
    const scope = patch.changes.map(scopeFromPatchChange).find((candidate): candidate is HardStopScope => Boolean(candidate));
    if (!scope) {
      continue;
    }
    blockers.push(createBlocker({
      type: "spec_patch",
      id: patch.id,
      scope,
      prompt: patch.title,
      reason: patch.rationale ?? "A proposed Research Specification patch changes protected research state.",
      sourceField: "ResearchSpecificationPatch.changes",
      questionId: patch.questionRecordId,
      priorityOffset: 0.2 + index / 1000
    }));
  }

  const byKey = new Map<string, HardStopBlocker>();
  for (const blocker of blockers) {
    byKey.set(`${blocker.type}:${blocker.id}`, blocker);
  }

  const activeBlockers = [...byKey.values()].sort((left, right) =>
    left.priority - right.priority ||
    left.type.localeCompare(right.type) ||
    left.id.localeCompare(right.id)
  );
  const blockerQuestionIds = new Set(activeBlockers.filter((blocker) => blocker.type === "question").map((blocker) => blocker.id));
  const blockerObligationIds = new Set(activeBlockers.filter((blocker) => blocker.type === "obligation").map((blocker) => blocker.id));
  const stalePendingQuestionCount = pendingQuestions.filter((question) => !blockerQuestionIds.has(question.id)).length;
  const stalePendingObligationCount = pendingObligations.filter((obligation) => !blockerObligationIds.has(obligation.id)).length;

  return {
    stopWouldBlock: activeBlockers.length > 0,
    activeBlockers,
    staleOrUnrelatedPendingQuestionCount: stalePendingQuestionCount,
    stalePendingQuestionCount,
    stalePendingObligationCount,
    nextActions: activeBlockers.length > 0
      ? activeBlockers.slice(0, 3).map((blocker) => blocker.commandHint)
      : stalePendingQuestionCount > 0 || stalePendingObligationCount > 0
        ? ["Review stale non-hard-stop pending LongTable questions when convenient; they do not block Stop."]
        : []
  };
}
