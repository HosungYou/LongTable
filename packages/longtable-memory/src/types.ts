import type {
  ArtifactRecord,
  DecisionRecord,
  InferredHypothesis,
  InteractionMode,
  InvocationRecord,
  NarrativeTrace,
  QuestionRecord,
  ResearchState
} from "@longtable/core";

export interface MemorySummary {
  explicitState: Record<string, unknown>;
  workingState: Record<string, unknown>;
  inferredHypotheses: InferredHypothesis[];
  openTensions: string[];
  decisionLog: DecisionRecord[];
  invocationLog: InvocationRecord[];
  questionLog: QuestionRecord[];
  artifactRecords: ArtifactRecord[];
  narrativeTraces: NarrativeTrace[];
}

export type {
  ArtifactRecord,
  DecisionRecord,
  InferredHypothesis,
  InteractionMode,
  InvocationRecord,
  NarrativeTrace,
  QuestionRecord,
  ResearchState
} from "@longtable/core";
