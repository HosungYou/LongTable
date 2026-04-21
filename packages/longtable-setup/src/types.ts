import type {
  CheckpointIntensity,
  ExperienceLevel,
  InteractionMode,
  ProviderKind,
  ResearcherConfidenceByDomain,
  ResearchState
} from "@longtable/core";

export interface SetupChoice {
  id: string;
  label: string;
  description: string;
  fallbackToText?: boolean;
}

export interface SetupQuestion {
  id: string;
  prompt: string;
  required: boolean;
  kind: "single_choice" | "text";
  choices?: SetupChoice[];
}

export type SetupFlow = "quickstart" | "interview";

export interface SetupAnswers {
  field?: string;
  careerStage: string;
  experienceLevel: ExperienceLevel;
  currentProjectType?: string;
  preferredCheckpointIntensity: CheckpointIntensity;
  humanAuthorshipSignal?: string;
  preferredEntryMode?: Exclude<InteractionMode, "submit">;
  weakestDomain?: Extract<keyof ResearcherConfidenceByDomain, string>;
  panelPreference?: "synthesis_only" | "show_on_conflict" | "always_visible";
}

export interface ResearcherProfileSeed extends SetupAnswers {
  aiAutonomyPreference: "low" | "balanced" | "high";
}

export interface ProviderSelection {
  provider: ProviderKind;
  checkpointProtocol: "native_structured" | "numbered";
  supportsStructuredQuestions: boolean;
}

export interface SetupPersistedOutput {
  setupFlow: SetupFlow;
  profileSeed: ResearcherProfileSeed;
  providerSelection: ProviderSelection;
  defaultInteractionMode: Exclude<InteractionMode, "submit">;
  initialState: ResearchState;
}

export interface SetupStorageTarget {
  path: string;
  directory: string;
}

export interface RuntimeConfigTarget {
  provider: ProviderKind;
  path: string;
  directory: string;
  format: "toml" | "json";
}

export interface SetupInstallResult {
  provider: ProviderKind;
  setupTarget: SetupStorageTarget;
  runtimeTarget: RuntimeConfigTarget;
}

export interface NumberedCheckpointOption {
  value: string;
  label: string;
}

export interface NumberedCheckpointSpec {
  title: string;
  instructions?: string;
  options: NumberedCheckpointOption[];
  allowRationale?: boolean;
}

export interface ParsedCheckpointSelection {
  index: number;
  value: string;
  label: string;
  rationale?: string;
}

export type {
  CheckpointIntensity,
  ExperienceLevel,
  ProviderKind,
  ResearchState
} from "@longtable/core";
