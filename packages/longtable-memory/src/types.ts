import type {
  ArtifactRecord,
  DecisionRecord,
  EvidenceRecord,
  InferredHypothesis,
  InteractionMode,
  InvocationRecord,
  NarrativeTrace,
  QuestionRecord,
  ResearchSpecificationPatch,
  ResearchSpecificationRevision,
  ResearchState,
  LongTableInterviewTurn
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
  interviewTurns?: LongTableInterviewTurn[];
  evidenceRecords?: EvidenceRecord[];
  specPatches?: ResearchSpecificationPatch[];
  specRevisions?: ResearchSpecificationRevision[];
}

export type {
  ArtifactRecord,
  DecisionRecord,
  EvidenceRecord,
  InferredHypothesis,
  InteractionMode,
  InvocationRecord,
  LongTableInterviewTurn,
  NarrativeTrace,
  QuestionRecord,
  ResearchSpecificationPatch,
  ResearchSpecificationRevision,
  ResearchState
} from "@longtable/core";
