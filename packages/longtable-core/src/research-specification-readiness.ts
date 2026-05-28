import type {
  FirstResearchShape,
  LongTableQuestionObligation,
  QuestionRecord,
  ResearchSpecification
} from "./types.js";

export type ResearchSpecificationReadinessStatus =
  | "no_spec"
  | "shape_only"
  | "structurally_incomplete"
  | "draft_pending_confirmation"
  | "deferred"
  | "confirmed";

export type ResearchSpecificationStructuralStatus =
  | "missing"
  | "incomplete"
  | "complete";

export type ResearchSpecificationConfirmationStatus =
  | "not_applicable"
  | "pending"
  | "deferred"
  | "confirmed";

export type ResearchSpecificationReadinessNextAction =
  | "start"
  | "confirm_spec"
  | "resume_confirmation"
  | "interview";

export interface ResearchSpecificationReadinessInput {
  researchSpecification?: ResearchSpecification;
  firstResearchShape?: FirstResearchShape;
  questionLog?: QuestionRecord[];
  questionObligations?: LongTableQuestionObligation[];
}

export interface ResearchSpecificationReadiness {
  exists: boolean;
  status: ResearchSpecificationReadinessStatus;
  structuralStatus: ResearchSpecificationStructuralStatus;
  confirmationStatus: ResearchSpecificationConfirmationStatus;
  usableForInterview: boolean;
  blockingGaps: string[];
  nextAction: ResearchSpecificationReadinessNextAction;
}

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasItems(values: string[] | undefined): boolean {
  return Array.isArray(values) && values.some((value) => hasText(value));
}

export function requiredResearchSpecificationGaps(specification: ResearchSpecification): string[] {
  const gaps: string[] = [];
  if (!hasText(specification.researchDirection.question)) {
    gaps.push("research question");
  }
  if (!hasItems(specification.constructOntology.coreConstructs)) {
    gaps.push("construct map/core constructs");
  }
  if (
    !hasItems(specification.researchDirection.inclusionCriteria) &&
    !hasItems(specification.researchDirection.exclusionCriteria)
  ) {
    gaps.push("inclusion/exclusion rule");
  }
  if (
    !hasItems(specification.evidenceAccess.requiredSources) &&
    !hasItems(specification.evidenceAccess.evidenceStandards)
  ) {
    gaps.push("evidence boundary");
  }
  if (
    !hasText(specification.methodAnalysis.design) &&
    !hasItems(specification.methodAnalysis.analysisOptions)
  ) {
    gaps.push("method commitment");
  }
  if (
    !hasItems(specification.openQuestions) &&
    !hasItems(specification.protectedDecisions)
  ) {
    gaps.push("unresolved decisions/protected decisions");
  }
  if (
    !hasItems(specification.evidenceAccess.accessRequirements) &&
    !hasItems(specification.evidenceAccess.requiredSources)
  ) {
    gaps.push("search/access assumptions");
  }
  return gaps;
}

function hasPendingResearchSpecificationConfirmation(input: ResearchSpecificationReadinessInput): boolean {
  return (input.questionLog ?? []).some((record) =>
    record.status === "pending" &&
    record.prompt.checkpointKey === "research_specification_confirmation"
  ) || (input.questionObligations ?? []).some((obligation) =>
    obligation.status === "pending" &&
    obligation.kind === "research_specification_confirmation"
  );
}

export function evaluateResearchSpecificationReadiness(
  input: ResearchSpecificationReadinessInput
): ResearchSpecificationReadiness {
  const specification = input.researchSpecification;
  if (!specification) {
    if (input.firstResearchShape) {
      return {
        exists: false,
        status: "shape_only",
        structuralStatus: "missing",
        confirmationStatus: "not_applicable",
        usableForInterview: false,
        blockingGaps: [
          "Research Specification missing",
          "First Research Shape is only a handle/resume layer"
        ],
        nextAction: "start"
      };
    }
    return {
      exists: false,
      status: "no_spec",
      structuralStatus: "missing",
      confirmationStatus: "not_applicable",
      usableForInterview: false,
      blockingGaps: ["Research Specification missing"],
      nextAction: "start"
    };
  }

  const structuralGaps = requiredResearchSpecificationGaps(specification);
  if (structuralGaps.length > 0) {
    return {
      exists: true,
      status: "structurally_incomplete",
      structuralStatus: "incomplete",
      confirmationStatus: "not_applicable",
      usableForInterview: false,
      blockingGaps: structuralGaps,
      nextAction: "start"
    };
  }

  if (specification.confirmedAt || specification.status === "confirmed") {
    return {
      exists: true,
      status: "confirmed",
      structuralStatus: "complete",
      confirmationStatus: "confirmed",
      usableForInterview: true,
      blockingGaps: [],
      nextAction: "interview"
    };
  }

  if (specification.status === "deferred") {
    return {
      exists: true,
      status: "deferred",
      structuralStatus: "complete",
      confirmationStatus: "deferred",
      usableForInterview: false,
      blockingGaps: ["Research Specification confirmation deferred"],
      nextAction: "resume_confirmation"
    };
  }

  const pendingConfirmation = hasPendingResearchSpecificationConfirmation(input);
  return {
    exists: true,
    status: "draft_pending_confirmation",
    structuralStatus: "complete",
    confirmationStatus: pendingConfirmation ? "pending" : "not_applicable",
    usableForInterview: false,
    blockingGaps: ["Research Specification confirmation pending"],
    nextAction: pendingConfirmation ? "resume_confirmation" : "confirm_spec"
  };
}
