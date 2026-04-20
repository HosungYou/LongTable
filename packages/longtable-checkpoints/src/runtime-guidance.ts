import { resolveCheckpointPolicy } from "./resolve-policy.js";
import type {
  GuidanceQuestionType,
  CheckpointSignal,
  ResearcherProfile,
  ResolvedCheckpointPolicy,
  RuntimeGuidance
} from "./types.js";

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function pushQuestion(questions: string[], question: string): void {
  if (!questions.includes(question)) {
    questions.push(question);
  }
}

function createBaseGuidance(mode: CheckpointSignal["mode"]): RuntimeGuidance {
  switch (mode) {
    case "explore":
      return {
        mode,
        minimumQuestions: 2,
        questionTypes: ["clarifying", "tension"],
        mustAskBeforeClosure: true,
        preferQuestionsFirst: true,
        includeUnaskedQuestions: true,
        includeOpenTensions: true,
        includeWhyMayBeWrong: false,
        preserveNarrativeTrace: false,
        surfaceHumanCommitment: false,
        closureDisposition: "delay",
        mandatoryQuestions: [
          "What ambiguity here would most change the research direction if resolved differently?",
          "What tension is still unresolved in this framing?"
        ],
        rationale: ["Explore mode delays closure and surfaces ambiguity before recommendation."]
      };
    case "review":
      return {
        mode,
        minimumQuestions: 1,
        questionTypes: ["clarifying", "boundary", "tension"],
        mustAskBeforeClosure: false,
        preferQuestionsFirst: false,
        includeUnaskedQuestions: false,
        includeOpenTensions: true,
        includeWhyMayBeWrong: true,
        preserveNarrativeTrace: false,
        surfaceHumanCommitment: false,
        closureDisposition: "tentative",
        mandatoryQuestions: ["What assumption is doing the most work in the current structure?"],
        rationale: ["Review mode should challenge assumptions before settling on synthesis."]
      };
    case "critique":
      return {
        mode,
        minimumQuestions: 1,
        questionTypes: ["boundary", "tension"],
        mustAskBeforeClosure: false,
        preferQuestionsFirst: false,
        includeUnaskedQuestions: false,
        includeOpenTensions: true,
        includeWhyMayBeWrong: true,
        preserveNarrativeTrace: false,
        surfaceHumanCommitment: false,
        closureDisposition: "delay",
        mandatoryQuestions: ["What would have to be false for this conclusion to change?"],
        rationale: ["Critique mode normalizes instability rather than smoothing it away."]
      };
    case "draft":
      return {
        mode,
        minimumQuestions: 0,
        questionTypes: [],
        mustAskBeforeClosure: false,
        preferQuestionsFirst: false,
        includeUnaskedQuestions: false,
        includeOpenTensions: false,
        includeWhyMayBeWrong: false,
        preserveNarrativeTrace: true,
        surfaceHumanCommitment: false,
        closureDisposition: "tentative",
        mandatoryQuestions: [],
        rationale: ["Draft mode may structure material, but it should preserve authorial trace."]
      };
    case "commit":
      return {
        mode,
        minimumQuestions: 0,
        questionTypes: ["boundary"],
        mustAskBeforeClosure: false,
        preferQuestionsFirst: false,
        includeUnaskedQuestions: false,
        includeOpenTensions: true,
        includeWhyMayBeWrong: false,
        preserveNarrativeTrace: false,
        surfaceHumanCommitment: true,
        closureDisposition: "strong",
        mandatoryQuestions: ["What choice is the researcher personally committing to here?"],
        rationale: ["Commit mode should make human responsibility explicit."]
      };
    case "submit":
      return {
        mode,
        minimumQuestions: 0,
        questionTypes: ["boundary"],
        mustAskBeforeClosure: true,
        preferQuestionsFirst: false,
        includeUnaskedQuestions: false,
        includeOpenTensions: true,
        includeWhyMayBeWrong: true,
        preserveNarrativeTrace: false,
        surfaceHumanCommitment: true,
        closureDisposition: "strongest",
        mandatoryQuestions: [
          "What claim or risk still requires explicit human responsibility before submission?"
        ],
        rationale: ["Submit mode keeps final risks visible before external release."]
      };
  }
}

function addQuestionType(types: GuidanceQuestionType[], type: GuidanceQuestionType): GuidanceQuestionType[] {
  return unique([...types, type]);
}

export function resolveRuntimeGuidance(
  profile: ResearcherProfile,
  signal: CheckpointSignal,
  policy: ResolvedCheckpointPolicy = resolveCheckpointPolicy(profile, signal)
): RuntimeGuidance {
  const guidance = createBaseGuidance(signal.mode);
  const unresolvedTensions = [
    ...(signal.unresolvedTensions ?? []),
    ...(signal.studyContract?.openTensions ?? [])
  ];

  if (unresolvedTensions.length > 0) {
    guidance.includeOpenTensions = true;
    guidance.minimumQuestions = Math.max(guidance.minimumQuestions, 1);
    guidance.questionTypes = addQuestionType(guidance.questionTypes, "tension");
    guidance.rationale.push("Open tensions remain visible when a decision could still move.");
    pushQuestion(
      guidance.mandatoryQuestions,
      "Which unresolved tension still matters enough to change the decision?"
    );
  }

  if (!signal.studyContract && (signal.mode === "commit" || signal.mode === "submit")) {
    guidance.minimumQuestions = Math.max(guidance.minimumQuestions, 1);
    guidance.mustAskBeforeClosure = true;
    guidance.questionTypes = addQuestionType(guidance.questionTypes, "clarifying");
    guidance.rationale.push("Commitment without an attached study contract should force a clarifying question.");
    pushQuestion(
      guidance.mandatoryQuestions,
      "What study contract commitment is still missing before this decision can be finalized?"
    );
  }

  if (signal.artifactStakes === "external_submission") {
    guidance.minimumQuestions = Math.max(guidance.minimumQuestions, 1);
    guidance.mustAskBeforeClosure = true;
    guidance.surfaceHumanCommitment = true;
    guidance.includeWhyMayBeWrong = true;
    guidance.closureDisposition = "strongest";
    guidance.questionTypes = addQuestionType(guidance.questionTypes, "boundary");
    guidance.rationale.push("External submission requires an explicit human responsibility check.");
    pushQuestion(
      guidance.mandatoryQuestions,
      "What remaining risk would be unacceptable to release without direct human review?"
    );
  }

  if (
    profile.humanAuthorshipSignal &&
    (signal.mode === "draft" || signal.mode === "review" || signal.mode === "critique" || signal.researchStage === "writing")
  ) {
    guidance.preserveNarrativeTrace = true;
    guidance.questionTypes = addQuestionType(guidance.questionTypes, "narrative");
    guidance.rationale.push("The researcher profile asks LongTable to protect a recognizable human authorship signal.");
    pushQuestion(
      guidance.mandatoryQuestions,
      `What in this output should preserve ${profile.humanAuthorshipSignal}?`
    );
  }

  if (policy.blocking && (signal.mode === "commit" || signal.mode === "submit")) {
    guidance.minimumQuestions = Math.max(guidance.minimumQuestions, 1);
    guidance.mustAskBeforeClosure = true;
    guidance.surfaceHumanCommitment = true;
    guidance.rationale.push("Blocking checkpoints require at least one explicit human-facing question before closure.");
  }

  if (signal.mode === "review" || signal.mode === "critique") {
    guidance.includeWhyMayBeWrong = true;
  }

  guidance.questionTypes = unique(guidance.questionTypes);
  guidance.mandatoryQuestions = unique(guidance.mandatoryQuestions);

  return guidance;
}
