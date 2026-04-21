import type {
  ArtifactRecord,
  DecisionRecord,
  InferredHypothesis,
  InteractionMode,
  MemorySummary,
  NarrativeTrace,
  ResearchState
} from "./types.js";

function clampConfidence(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

export function createEmptyResearchState(): ResearchState {
  return {
    explicitState: {},
    workingState: {},
    inferredHypotheses: [],
    openTensions: [],
    decisionLog: [],
    invocationLog: [],
    questionLog: [],
    artifactRecords: [],
    narrativeTraces: []
  };
}

export function addInferredHypothesis(
  state: ResearchState,
  hypothesis: InferredHypothesis
): ResearchState {
  return {
    ...state,
    inferredHypotheses: [
      ...state.inferredHypotheses,
      {
        ...hypothesis,
        confidence: clampConfidence(hypothesis.confidence)
      }
    ]
  };
}

export function promoteHypothesisToExplicitState(
  state: ResearchState,
  hypothesisText: string,
  explicitKey: string,
  explicitValue: unknown
): ResearchState {
  return {
    explicitState: {
      ...state.explicitState,
      [explicitKey]: explicitValue
    },
    workingState: state.workingState,
    inferredHypotheses: state.inferredHypotheses.map((entry) =>
      entry.hypothesis === hypothesisText ? { ...entry, status: "confirmed" } : entry
    ),
    openTensions: state.openTensions,
    decisionLog: state.decisionLog,
    invocationLog: state.invocationLog ?? [],
    questionLog: state.questionLog ?? [],
    artifactRecords: state.artifactRecords,
    narrativeTraces: state.narrativeTraces,
    studyContract: state.studyContract
  };
}

export function rejectInferredHypothesis(
  state: ResearchState,
  hypothesisText: string
): ResearchState {
  return {
    ...state,
    inferredHypotheses: state.inferredHypotheses.map((entry) =>
      entry.hypothesis === hypothesisText ? { ...entry, status: "rejected" } : entry
    )
  };
}

export function appendDecisionRecord(
  state: ResearchState,
  decision: DecisionRecord
): ResearchState {
  return {
    ...state,
    decisionLog: [...state.decisionLog, decision],
    studyContract: state.studyContract
      ? {
          ...state.studyContract,
          decisionRecordIds: [...state.studyContract.decisionRecordIds, decision.id]
        }
      : state.studyContract
  };
}

export function appendInvocationRecord(
  state: ResearchState,
  invocation: NonNullable<ResearchState["invocationLog"]>[number]
): ResearchState {
  return {
    ...state,
    invocationLog: [...(state.invocationLog ?? []), invocation]
  };
}

export function appendQuestionRecord(
  state: ResearchState,
  question: NonNullable<ResearchState["questionLog"]>[number]
): ResearchState {
  return {
    ...state,
    questionLog: [...(state.questionLog ?? []), question]
  };
}

export function appendQuestionRecords(
  state: ResearchState,
  questions: NonNullable<ResearchState["questionLog"]>
): ResearchState {
  return {
    ...state,
    questionLog: [...(state.questionLog ?? []), ...questions]
  };
}

export function recordArtifactProvenance(
  state: ResearchState,
  artifact: ArtifactRecord
): ResearchState {
  return {
    ...state,
    artifactRecords: [...state.artifactRecords, artifact]
  };
}

export function appendNarrativeTrace(
  state: ResearchState,
  trace: NarrativeTrace
): ResearchState {
  return {
    ...state,
    narrativeTraces: [...state.narrativeTraces, trace]
  };
}

export function attachStudyContract(
  state: ResearchState,
  studyContract: ResearchState["studyContract"]
): ResearchState {
  return {
    ...state,
    studyContract
  };
}

export function restoreWorkingState(state: ResearchState): ResearchState {
  return {
    explicitState: { ...state.explicitState },
    workingState: { ...state.workingState },
    inferredHypotheses: [...state.inferredHypotheses],
    openTensions: [...state.openTensions],
    decisionLog: [...state.decisionLog],
    invocationLog: [...(state.invocationLog ?? [])],
    questionLog: [...(state.questionLog ?? [])],
    artifactRecords: [...state.artifactRecords],
    narrativeTraces: [...state.narrativeTraces],
    studyContract: state.studyContract
      ? {
          ...state.studyContract,
          openTensions: [...state.studyContract.openTensions],
          decisionRecordIds: [...state.studyContract.decisionRecordIds]
        }
      : undefined
  };
}

export function summarizeForCheckpoint(
  state: ResearchState,
  mode: InteractionMode
): MemorySummary {
  const summary = summarizeStateForMode(state, mode);

  return {
    ...summary,
    decisionLog:
      mode === "commit" || mode === "submit"
        ? state.decisionLog.slice(-5)
        : state.decisionLog.slice(-2),
    invocationLog:
      mode === "commit" || mode === "submit"
        ? (state.invocationLog ?? []).slice(-5)
        : (state.invocationLog ?? []).slice(-2),
    questionLog:
      mode === "commit" || mode === "submit"
        ? (state.questionLog ?? []).slice(-5)
        : (state.questionLog ?? []).slice(-2),
    artifactRecords:
      mode === "submit"
        ? state.artifactRecords.slice(-5)
        : state.artifactRecords.slice(-2),
    narrativeTraces:
      mode === "commit" || mode === "submit"
        ? state.narrativeTraces.slice(-5)
        : state.narrativeTraces.slice(-2)
  };
}

export function summarizeStateForMode(
  state: ResearchState,
  mode: InteractionMode
): MemorySummary {
  const baseSummary: MemorySummary = {
    explicitState: state.explicitState,
    workingState: state.workingState,
    inferredHypotheses: [],
    openTensions: [],
    decisionLog: [],
    invocationLog: [],
    questionLog: [],
    artifactRecords: [],
    narrativeTraces: []
  };

  if (mode === "explore" || mode === "review" || mode === "draft") {
    return baseSummary;
  }

  if (mode === "critique") {
    return {
      ...baseSummary,
      inferredHypotheses: state.inferredHypotheses.filter((entry) => entry.status === "unconfirmed"),
      narrativeTraces: state.narrativeTraces.filter((trace) => trace.visibility === "inferred")
    };
  }

  return {
    ...baseSummary,
    inferredHypotheses: state.inferredHypotheses.filter((entry) => entry.status !== "rejected"),
    openTensions: state.openTensions,
    decisionLog: state.decisionLog.slice(-3),
    invocationLog: (state.invocationLog ?? []).slice(-3),
    questionLog: (state.questionLog ?? []).slice(-3),
    artifactRecords: state.artifactRecords.slice(-3),
    narrativeTraces: state.narrativeTraces.slice(-3)
  };
}
