export type ExperienceLevel = "novice" | "intermediate" | "advanced";

export type CheckpointIntensity = "low" | "balanced" | "high";

export type InteractionMode =
  | "explore"
  | "review"
  | "critique"
  | "draft"
  | "commit"
  | "submit";

export type ArtifactStakes =
  | "private_note"
  | "internal_draft"
  | "study_protocol"
  | "external_submission";

export type ResearchStage =
  | "problem_framing"
  | "theory_selection"
  | "method_design"
  | "measurement_design"
  | "analysis_planning"
  | "writing"
  | "submission";

export type ConfidenceLevel = "low" | "medium" | "high";

export type NarrativeTraceType =
  | "experience"
  | "judgment"
  | "voice"
  | "context"
  | "tension";

export type NarrativeTraceVisibility = "explicit" | "inferred";

export type HypothesisStatus = "unconfirmed" | "confirmed" | "rejected";

export type ProviderKind = "claude" | "codex";

export type CheckpointLevel =
  | "universal_required"
  | "adaptive_required"
  | "recommended"
  | "log_only"
  | "none";

export type PromptStyle =
  | "structured_choice"
  | "confirm_or_revise"
  | "advisory_summary"
  | "passive_log";

export type QuestionSurface =
  | "native_structured"
  | "numbered"
  | "terminal_selector"
  | "web_form";

export type GuidanceQuestionType =
  | "clarifying"
  | "boundary"
  | "tension"
  | "narrative";

export type ClosureDisposition = "delay" | "tentative" | "strong" | "strongest";

export interface ResearcherConfidenceByDomain {
  theory: ConfidenceLevel;
  methodology: ConfidenceLevel;
  measurement: ConfidenceLevel;
  analysis: ConfidenceLevel;
  writing: ConfidenceLevel;
}

export interface ResearcherProfile {
  field: string;
  careerStage: string;
  experienceLevel: ExperienceLevel;
  preferredCheckpointIntensity: CheckpointIntensity;
  currentProjectType: string;
  humanAuthorshipSignal?: string;
  aiAutonomyPreference?: "low" | "balanced" | "high";
  forceCheckpointsOn?: string[];
  relaxCheckpointsOn?: string[];
  confidenceByDomain?: Partial<ResearcherConfidenceByDomain>;
}

export interface InferredHypothesis {
  hypothesis: string;
  confidence: number;
  evidence: string[];
  status: HypothesisStatus;
}

export interface DecisionRecord {
  id: string;
  timestamp: string;
  checkpointKey: string;
  level: CheckpointLevel;
  mode: InteractionMode;
  summary: string;
  selectedOption?: string;
  rationale?: string;
  explicitStateUpdates?: Record<string, unknown>;
  studyContractId?: string;
}

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export type QuestionPromptType = "single_choice" | "multi_choice" | "free_text";

export interface QuestionPrompt {
  id: string;
  checkpointKey?: string;
  title: string;
  question: string;
  type: QuestionPromptType;
  options: QuestionOption[];
  allowOther: boolean;
  otherLabel?: string;
  required: boolean;
  source: "checkpoint" | "setup" | "runtime_guidance" | "manual";
  rationale: string[];
  preferredSurfaces: QuestionSurface[];
}

export interface QuestionAnswer {
  promptId: string;
  selectedValues: string[];
  selectedLabels: string[];
  otherText?: string;
  rationale?: string;
  provider?: ProviderKind;
  surface: QuestionSurface;
}

export type QuestionRecordStatus = "pending" | "answered" | "cleared" | "error";

export interface QuestionRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: QuestionRecordStatus;
  prompt: QuestionPrompt;
  answer?: QuestionAnswer;
  error?: string;
  decisionRecordId?: string;
}

export interface ArtifactRecord {
  id: string;
  timestamp: string;
  artifactType: string;
  stakes: ArtifactStakes;
  source: string;
  provider?: ProviderKind;
  location?: string;
  decisionRecordId?: string;
  provenanceSummary: string;
}

export interface NarrativeTrace {
  id: string;
  timestamp: string;
  source: string;
  traceType: NarrativeTraceType;
  summary: string;
  visibility: NarrativeTraceVisibility;
  importance: ConfidenceLevel;
  linkedDecisionRecordId?: string;
}

export interface RuntimeGuidance {
  mode: InteractionMode;
  minimumQuestions: number;
  questionTypes: GuidanceQuestionType[];
  mustAskBeforeClosure: boolean;
  preferQuestionsFirst: boolean;
  includeUnaskedQuestions: boolean;
  includeOpenTensions: boolean;
  includeWhyMayBeWrong: boolean;
  preserveNarrativeTrace: boolean;
  surfaceHumanCommitment: boolean;
  closureDisposition: ClosureDisposition;
  mandatoryQuestions: string[];
  rationale: string[];
}

export interface StudyContract {
  id: string;
  title: string;
  problemFraming: string;
  targetVenue?: string;
  theoryAnchor: string;
  methodology: string;
  measurementPlan: string;
  analysisPlan?: string;
  currentStage: ResearchStage;
  openTensions: string[];
  decisionRecordIds: string[];
}

export interface ResearchState {
  explicitState: Record<string, unknown>;
  workingState: Record<string, unknown>;
  inferredHypotheses: InferredHypothesis[];
  openTensions: string[];
  decisionLog: DecisionRecord[];
  artifactRecords: ArtifactRecord[];
  narrativeTraces: NarrativeTrace[];
  studyContract?: StudyContract;
}
