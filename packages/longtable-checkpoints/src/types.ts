import type {
  ArtifactStakes,
  ClosureDisposition,
  CheckpointLevel,
  GuidanceQuestionType,
  InteractionMode,
  PromptStyle,
  ResearcherProfile,
  ResearchStage,
  RuntimeGuidance,
  StudyContract
} from "@longtable/core";

export interface CheckpointSignal {
  checkpointKey: string;
  baseLevel: CheckpointLevel;
  mode: InteractionMode;
  artifactStakes: ArtifactStakes;
  researchStage: ResearchStage;
  unresolvedTensions?: string[];
  studyContract?: StudyContract;
}

export interface ResolvedCheckpointPolicy {
  checkpointKey: string;
  level: CheckpointLevel;
  blocking: boolean;
  promptStyle: PromptStyle;
  requiresDecisionLog: boolean;
  updateExplicitState: boolean;
  rationale: string[];
}

export type {
  ArtifactStakes,
  ClosureDisposition,
  CheckpointLevel,
  GuidanceQuestionType,
  InteractionMode,
  PromptStyle,
  ResearcherProfile,
  ResearchStage,
  RuntimeGuidance,
  StudyContract
} from "@longtable/core";
