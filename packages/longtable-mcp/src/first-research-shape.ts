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
  if (usesKorean(shape)) {
    return "First Research Shape 확인";
  }
  if (shape.protectedDecision) {
    return "Protected Research Decision";
  }
  if (shape.currentBlocker) {
    return "Main Unresolved Issue";
  }
  return "Emerging Research Direction";
}

function usesKorean(shape: FirstResearchShape): boolean {
  return [
    shape.handle,
    shape.currentGoal,
    shape.currentBlocker,
    shape.researchObject,
    shape.gapRisk,
    shape.protectedDecision,
    ...shape.openQuestions,
    shape.nextAction
  ].some((value) => typeof value === "string" && /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value));
}

function questionText(shape: FirstResearchShape): string {
  if (usesKorean(shape)) {
    return "이 First Research Shape를 어떻게 처리할까요?";
  }
  if (shape.protectedDecision) {
    return "Before LongTable moves forward, what protected research decision should stay explicit?";
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
  if (usesKorean(shape)) {
    if (shape.protectedDecision) {
      return `인터뷰에서 보호해야 할 연구 판단이 드러났습니다: ${shape.protectedDecision}. LongTable은 이 판단이 조용히 확정되지 않게 해야 합니다.`;
    }
    if (shape.currentBlocker) {
      return `주요 blocker가 아직 열려 있습니다: ${shape.currentBlocker}. 다음 행동은 이 불확실성을 명시적으로 다뤄야 합니다.`;
    }
    if (shape.openQuestions.length > 0) {
      return "인터뷰에서 열린 연구 질문이 드러났습니다. 가장 중요한 질문을 보존하는 다음 행동을 선택해야 합니다.";
    }
    return "LongTable은 provisional research direction을 제안할 만큼의 맥락을 얻었지만, 다음 연구 행동은 명시적으로 선택되어야 합니다.";
  }
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
  const korean = usesKorean(shape);

  if (shape.protectedDecision) {
    options.push({
      value: "protect_decision",
      label: korean ? "보호 결정 열어두기" : "Keep the protected decision open",
      description: korean
        ? `전체 방향은 provisional로 두고, 이 판단을 보호된 결정으로 유지합니다: ${shape.protectedDecision}`
        : `Treat this as the guarded judgment while the broader direction stays provisional: ${shape.protectedDecision}`,
      recommended: recommended === "protect_decision"
    });
  }

  options.push(
    {
      value: "stabilize_shape",
      label: korean ? "저장/확정" : "Use this as the provisional direction",
      description: korean
        ? "이 research shape를 현재 작업 방향으로 저장하고 이어갑니다."
        : "Carry this research shape forward as the current working direction.",
      recommended: recommended === "stabilize_shape"
    },
    {
      value: "gather_context",
      label: korean ? "한 질문 더" : "Gather one more concrete case",
      description: korean
        ? "저장하기 전에 한 가지 장면, 출처, 데이터셋, 사례, 또는 결정 맥락을 더 묻습니다."
        : "Ask for one more scene, source, dataset, or example before stabilizing it.",
      recommended: recommended === "gather_context"
    },
    {
      value: "revise_shape",
      label: korean ? "수정" : "Revise the emerging shape",
      description: korean
        ? "LongTable이 이를 usable한 방향으로 다루기 전에 handle, blocker, next action 등을 수정합니다."
        : "Change the handle, blocker, or next action before LongTable treats it as usable."
    }
  );

  if (!shape.protectedDecision) {
    options.push({
      value: "keep_open",
      label: korean ? "열어두기" : "Keep the study open longer",
      description: korean ? "아직 이 방향을 확정하지 않습니다." : "Do not stabilize this direction yet."
    });
  }

  return options;
}

export function buildFirstResearchShapeQuestion(shape: FirstResearchShape): FirstResearchShapeQuestionSpec {
  const korean = usesKorean(shape);
  const summaryLines = [
    korean
      ? "LongTable이 provisional research direction을 제안할 만큼의 맥락을 얻었습니다."
      : "LongTable has enough context to propose a provisional research direction.",
    `${korean ? "핸들" : "Handle"}: ${shape.handle}`,
    `${korean ? "목표" : "Goal"}: ${shape.currentGoal}`,
    shape.currentBlocker ? `${korean ? "막힌 지점" : "Blocker"}: ${shape.currentBlocker}` : undefined,
    shape.protectedDecision ? `${korean ? "보호할 결정" : "Protected decision"}: ${shape.protectedDecision}` : undefined,
    shape.openQuestions.length > 0 ? `${korean ? "열린 질문" : "Open question"}: ${shape.openQuestions[0]}` : undefined,
    `${korean ? "다음 행동" : "Next action"}: ${shape.nextAction}`
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
