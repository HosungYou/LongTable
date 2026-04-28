import type { QuestionOption } from "@longtable/core";

export interface FirstResearchShape {
  handle: string;
  currentGoal: string;
  currentBlocker?: string;
  researchObject?: string;
  gapRisk?: string;
  protectedDecision?: string;
  openQuestions: string[];
  nextAction: string;
  confidence: "low" | "medium" | "high";
  sourceHookId?: string;
  confirmedAt?: string;
}

export interface FirstResearchShapeQuestionSpec {
  prompt: string;
  title: string;
  question: string;
  checkpointKey: string;
  options: QuestionOption[];
  displayReason: string;
}

function questionTitle(shape: FirstResearchShape): string {
  if (shape.protectedDecision) {
    return "Protected Research Decision";
  }
  if (shape.currentBlocker) {
    return "Main Unresolved Issue";
  }
  return "Emerging Research Direction";
}

function questionText(shape: FirstResearchShape): string {
  if (shape.protectedDecision) {
    return `Before LongTable moves forward, what should stay explicitly open about ${shape.protectedDecision}?`;
  }
  if (shape.currentBlocker) {
    return "What should LongTable do with the main unresolved issue in this emerging study?";
  }
  if (shape.openQuestions.length > 0) {
    return "What should LongTable keep explicit as the next research move?";
  }
  return "How should LongTable carry this emerging study forward?";
}

function displayReason(shape: FirstResearchShape): string {
  if (shape.protectedDecision) {
    return `The interview surfaced a protected decision: ${shape.protectedDecision}. LongTable should not let it settle silently.`;
  }
  if (shape.currentBlocker) {
    return `The main blocker is still open: ${shape.currentBlocker}. The next move should make that uncertainty explicit.`;
  }
  if (shape.openQuestions.length > 0) {
    return `The interview surfaced open research questions. Choose the next move that keeps the most important one visible.`;
  }
  return "LongTable has enough context to propose a provisional research direction, but the next research move should still be explicit.";
}

function recommendedValue(shape: FirstResearchShape): string {
  if (shape.protectedDecision) {
    return "protect_decision";
  }
  if (shape.confidence === "high" && !shape.currentBlocker) {
    return "stabilize_shape";
  }
  if (shape.currentBlocker || shape.confidence === "low") {
    return "gather_context";
  }
  return "stabilize_shape";
}

function baseOptions(shape: FirstResearchShape): QuestionOption[] {
  const recommended = recommendedValue(shape);
  const options: QuestionOption[] = [];

  if (shape.protectedDecision) {
    options.push({
      value: "protect_decision",
      label: `Keep ${shape.protectedDecision} open`,
      description: "Treat this as the guarded judgment while the broader direction stays provisional.",
      recommended: recommended === "protect_decision"
    });
  }

  options.push(
    {
      value: "stabilize_shape",
      label: "Use this as the provisional direction",
      description: "Carry this research shape forward as the current working direction.",
      recommended: recommended === "stabilize_shape"
    },
    {
      value: "gather_context",
      label: "Gather one more concrete case",
      description: "Ask for one more scene, source, dataset, or example before stabilizing it.",
      recommended: recommended === "gather_context"
    },
    {
      value: "revise_shape",
      label: "Revise the emerging shape",
      description: "Change the handle, blocker, or next action before LongTable treats it as usable."
    }
  );

  if (!shape.protectedDecision) {
    options.push({
      value: "keep_open",
      label: "Keep the study open longer",
      description: "Do not stabilize this direction yet."
    });
  }

  return options;
}

export function buildFirstResearchShapeQuestion(shape: FirstResearchShape): FirstResearchShapeQuestionSpec {
  const summaryLines = [
    "LongTable has enough context to propose a provisional research direction.",
    `Handle: ${shape.handle}`,
    `Goal: ${shape.currentGoal}`,
    shape.currentBlocker ? `Blocker: ${shape.currentBlocker}` : undefined,
    shape.protectedDecision ? `Protected decision: ${shape.protectedDecision}` : undefined,
    shape.openQuestions.length > 0 ? `Open question: ${shape.openQuestions[0]}` : undefined,
    `Next action: ${shape.nextAction}`
  ].filter(Boolean);

  return {
    prompt: summaryLines.join("\n"),
    title: questionTitle(shape),
    question: questionText(shape),
    checkpointKey: "first_research_shape_confirmation",
    options: baseOptions(shape),
    displayReason: displayReason(shape)
  };
}

export function firstResearchShapeAnswerConfirms(answer: string): boolean {
  return answer === "stabilize_shape" || answer === "protect_decision";
}

export function firstResearchShapeAnswerStatus(answer: string): "confirmed" | "active" | "deferred" {
  if (firstResearchShapeAnswerConfirms(answer)) {
    return "confirmed";
  }
  if (answer === "keep_open") {
    return "deferred";
  }
  return "active";
}
