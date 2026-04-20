import type {
  ArtifactRecord,
  DecisionRecord,
  InferredHypothesis,
  InteractionMode,
  NarrativeTrace,
  ResearchState
} from "@longtable/core";

export interface MemorySummary {
  explicitState: Record<string, unknown>;
  workingState: Record<string, unknown>;
  inferredHypotheses: InferredHypothesis[];
  openTensions: string[];
  decisionLog: DecisionRecord[];
  artifactRecords: ArtifactRecord[];
  narrativeTraces: NarrativeTrace[];
}

export type {
  ArtifactRecord,
  DecisionRecord,
  InferredHypothesis,
  InteractionMode,
  NarrativeTrace,
  ResearchState
} from "@longtable/core";
