import type {
  HardStopScope,
  LongTableQuestionObligation,
  QuestionCommitmentFamily,
  QuestionRecord,
  ResearchState
} from "./types.js";

export type HardStopBlockerType = "question" | "obligation";

export interface HardStopBlocker {
  type: HardStopBlockerType;
  id: string;
  scope: HardStopScope;
  prompt: string;
  reason: string;
  source: string;
  commandHints: string[];
  priority: number;
}

export interface HardStopVerdict {
  stopWouldBlock: boolean;
  activeBlockers: HardStopBlocker[];
  staleOrUnrelatedPendingQuestionCount: number;
  nextActions: string[];
}

const SCOPE_PRIORITY: Record<HardStopScope, number> = {
  protected_decision: 100,
  research_question: 90,
  scope: 80,
  construct: 70,
  method: 60,
  evidence: 50
};

const RESEARCH_SPEC_CHECKPOINT_PATTERNS: Array<[RegExp, HardStopScope]> = [
  [/protected_decision|closure/i, "protected_decision"],
  [/research_(?:question|direction)|question_freeze/i, "research_question"],
  [/scope|boundary|inclusion|exclusion/i, "scope"],
  [/construct|theory|frame|ontology|measurement|coding|validity/i, "construct"],
  [/method|design|sample|analysis|strategy|model/i, "method"],
  [/evidence|access|source|corpus|pdf|full_text|scholarly/i, "evidence"]
];

const PRODUCT_OR_TOOLING_PATTERNS = [
  /product_runtime|runtime_guidance|hook|mcp|setup|install|cli|npm|release|deploy|git|github|docs?|documentation|workflow|package|router|autocomplete|simulation/i
];

function explicitHardStopScope(value: unknown): HardStopScope | null {
  return value === "research_question" ||
    value === "scope" ||
    value === "construct" ||
    value === "method" ||
    value === "evidence" ||
    value === "protected_decision"
    ? value
    : null;
}

function readBooleanFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function questionSearchText(question: QuestionRecord): string {
  return [
    question.prompt.checkpointKey,
    question.prompt.title,
    question.prompt.question,
    question.prompt.displayReason,
    question.commitmentFamily,
    question.epistemicBasis,
    ...(question.prompt.rationale ?? [])
  ].filter(Boolean).join("\n");
}

function obligationSearchText(obligation: LongTableQuestionObligation): string {
  return [
    obligation.kind,
    obligation.prompt,
    obligation.reason
  ].filter(Boolean).join("\n");
}

function scopeFromCommitmentFamily(family: QuestionCommitmentFamily | undefined): HardStopScope | null {
  if (family === "scope") return "scope";
  if (family === "construct" || family === "coding") return "construct";
  if (family === "method") return "method";
  if (family === "evidence") return "evidence";
  if (family === "epistemic_authority") return "protected_decision";
  return null;
}

function derivedScopeFromText(text: string): HardStopScope | null {
  if (PRODUCT_OR_TOOLING_PATTERNS.some((pattern) => pattern.test(text))) {
    return null;
  }
  for (const [pattern, scope] of RESEARCH_SPEC_CHECKPOINT_PATTERNS) {
    if (pattern.test(text)) {
      return scope;
    }
  }
  return null;
}

function questionHardStopScope(question: QuestionRecord): { scope: HardStopScope; source: string } | null {
  const explicitHardStop = readBooleanFlag((question as { hardStop?: unknown }).hardStop);
  if (explicitHardStop === false) {
    return null;
  }

  const explicitScope = explicitHardStopScope((question as { hardStopScope?: unknown }).hardStopScope);
  if (explicitHardStop === true) {
    return {
      scope: explicitScope ?? scopeFromCommitmentFamily(question.commitmentFamily) ?? derivedScopeFromText(questionSearchText(question)) ?? "protected_decision",
      source: explicitScope ? "question.hardStopScope" : "question.hardStop"
    };
  }

  if (!question.prompt.required) {
    return null;
  }

  const familyScope = scopeFromCommitmentFamily(question.commitmentFamily);
  if (familyScope) {
    return { scope: familyScope, source: "question.commitmentFamily" };
  }

  const textScope = derivedScopeFromText(questionSearchText(question));
  return textScope ? { scope: textScope, source: "question.prompt" } : null;
}

function obligationHardStopScope(obligation: LongTableQuestionObligation): { scope: HardStopScope; source: string } | null {
  const explicitHardStop = readBooleanFlag((obligation as { hardStop?: unknown }).hardStop);
  if (explicitHardStop === false) {
    return null;
  }

  const explicitScope = explicitHardStopScope((obligation as { hardStopScope?: unknown }).hardStopScope);
  if (explicitHardStop === true) {
    return {
      scope: explicitScope ?? derivedScopeFromText(obligationSearchText(obligation)) ?? "protected_decision",
      source: explicitScope ? "obligation.hardStopScope" : "obligation.hardStop"
    };
  }

  if (obligation.kind !== "research_specification_confirmation") {
    return null;
  }

  const textScope = derivedScopeFromText(obligationSearchText(obligation));
  return { scope: textScope ?? "protected_decision", source: "obligation.kind" };
}

function scopeLabel(scope: HardStopScope): string {
  return scope.replace(/_/g, " ");
}

function commandHintsFor(id: string): string[] {
  return [
    `longtable decide --question ${id} --answer <value> --rationale <why>`,
    `longtable clear-question --question ${id} --reason <why safe to defer or clear>`
  ];
}

function blockerPriority(scope: HardStopScope, index: number): number {
  return (SCOPE_PRIORITY[scope] * 1000) - index;
}

export function collectHardStopBlockers(state: ResearchState): HardStopVerdict {
  const activeBlockers: HardStopBlocker[] = [];
  const pendingQuestions = (state.questionLog ?? []).filter((question) => question.status === "pending");
  const pendingObligations = (state.questionObligations ?? []).filter((obligation) => obligation.status === "pending");

  pendingQuestions.forEach((question, index) => {
    const verdict = questionHardStopScope(question);
    if (!verdict) {
      return;
    }
    activeBlockers.push({
      type: "question",
      id: question.id,
      scope: verdict.scope,
      prompt: question.prompt.question,
      reason: question.prompt.displayReason ?? question.prompt.rationale?.[0] ?? `Pending ${scopeLabel(verdict.scope)} checkpoint requires researcher decision.`,
      source: verdict.source,
      commandHints: commandHintsFor(question.id),
      priority: blockerPriority(verdict.scope, index)
    });
  });

  pendingObligations.forEach((obligation, index) => {
    const verdict = obligationHardStopScope(obligation);
    if (!verdict) {
      return;
    }
    activeBlockers.push({
      type: "obligation",
      id: obligation.id,
      scope: verdict.scope,
      prompt: obligation.prompt,
      reason: obligation.reason,
      source: verdict.source,
      commandHints: obligation.questionId ? commandHintsFor(obligation.questionId) : ["Resume LongTable interview and record the required researcher decision."],
      priority: blockerPriority(verdict.scope, index + pendingQuestions.length)
    });
  });

  activeBlockers.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const blockerQuestionIds = new Set(activeBlockers.filter((blocker) => blocker.type === "question").map((blocker) => blocker.id));
  const staleOrUnrelatedPendingQuestionCount = pendingQuestions.filter((question) => !blockerQuestionIds.has(question.id)).length;
  const nextActions = activeBlockers.length > 0
    ? activeBlockers[0].commandHints
    : staleOrUnrelatedPendingQuestionCount > 0
      ? ["Review stale non-hard-stop pending questions when convenient; they do not block Stop."]
      : [];

  return {
    stopWouldBlock: activeBlockers.length > 0,
    activeBlockers,
    staleOrUnrelatedPendingQuestionCount,
    nextActions
  };
}
