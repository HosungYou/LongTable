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

export type RoleKey = string;

export type InvocationKind = "single_role" | "panel" | "team" | "team_debate" | "status";

export type InvocationSurface =
  | "native_parallel"
  | "native_subagents"
  | "generated_skill"
  | "prompt_alias"
  | "sequential_fallback"
  | "file_backed_debate"
  | "mcp_transport";

export type InvocationStatus = "planned" | "running" | "completed" | "blocked" | "degraded" | "error";

export type InteractionDepth = "independent" | "cross_reviewed" | "debated";

export type PanelVisibility = "synthesis_only" | "show_on_conflict" | "always_visible";

export type CheckpointSensitivity = "low" | "medium" | "high";

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
  | "mcp_elicitation"
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

export interface RoleDefinition {
  key: RoleKey;
  label: string;
  shortDescription: string;
  triggerMode: "auto-callable" | "explicit-only";
  synonyms: string[];
  defaultPanelMember: boolean;
  checkpointSensitivity: CheckpointSensitivity;
  supportedModes: InteractionMode[];
}

export interface ProviderCapabilities {
  provider: ProviderKind;
  nativeStructuredQuestions: boolean;
  generatedSkills: "stable" | "available" | "unavailable";
  promptAliases: "stable" | "available" | "unavailable";
  nativeParallelSubagents: "stable" | "session_dependent" | "unavailable";
  sequentialFallback: boolean;
  mcpTransport: "stable" | "available" | "planned" | "unavailable";
  notes: string[];
}

export interface InvocationIntent {
  id: string;
  kind: InvocationKind;
  mode: InteractionMode;
  prompt: string;
  roles: RoleKey[];
  provider?: ProviderKind;
  requestedSurface?: InvocationSurface;
  visibility: PanelVisibility;
  checkpointSensitivity: CheckpointSensitivity;
  rationale: string[];
}

export interface PanelMember {
  role: RoleKey;
  label: string;
  reason: string;
  required: boolean;
}

export interface PanelPlan {
  id: string;
  createdAt: string;
  mode: InteractionMode;
  prompt: string;
  members: PanelMember[];
  visibility: PanelVisibility;
  preferredSurface: InvocationSurface;
  fallbackSurface: "sequential_fallback";
  checkpointSensitivity: CheckpointSensitivity;
  rationale: string[];
}

export interface PanelMemberResult {
  role: RoleKey;
  label: string;
  status: InvocationStatus;
  summary?: string;
  claims?: string[];
  objections?: string[];
  openQuestions?: string[];
  evidenceRefs?: string[];
  error?: string;
}

export interface PanelResult {
  id: string;
  planId: string;
  createdAt: string;
  updatedAt: string;
  provider?: ProviderKind;
  surface: InvocationSurface;
  status: InvocationStatus;
  memberResults: PanelMemberResult[];
  synthesis?: string;
  conflictSummary?: string;
  decisionPrompt?: string;
  interactionDepth?: InteractionDepth;
  linkedQuestionRecordIds: string[];
  linkedDecisionRecordIds: string[];
}

export type TeamDebateRoundKind =
  | "independent_review"
  | "cross_review"
  | "rebuttal"
  | "convergence"
  | "synthesis";

export interface TeamDebateContribution {
  id: string;
  roundId: string;
  role: RoleKey;
  label: string;
  targetRole?: RoleKey;
  respondsToContributionId?: string;
  stance?: "agree" | "disagree" | "conditional" | "defer";
  summary: string;
  claims: string[];
  objections: string[];
  openQuestions: string[];
  evidenceNeeds: string[];
  tacitAssumptions: string[];
  checkpointTriggers: string[];
  artifactPath: string;
}

export interface TeamDebateRound {
  id: string;
  index: number;
  kind: TeamDebateRoundKind;
  title: string;
  status: InvocationStatus;
  artifactDir: string;
  contributions: TeamDebateContribution[];
}

export interface TeamDebateSynthesis {
  summary: string;
  consensus: string[];
  disagreements: string[];
  unresolvedGaps: string[];
  researcherDecisionPoints: string[];
  recommendedCheckpoint: string;
  artifactPath: string;
}

export interface TeamDebateRun {
  id: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  roles: PanelMember[];
  status: InvocationStatus;
  surface: InvocationSurface;
  interactionDepth: InteractionDepth;
  roundPolicy: "fixed" | "team_cross_review";
  roundCount: number;
  artifactRoot: string;
  rounds: TeamDebateRound[];
  synthesis: TeamDebateSynthesis;
  linkedQuestionRecordIds: string[];
}

export interface InvocationRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  intent: InvocationIntent;
  status: InvocationStatus;
  provider?: ProviderKind;
  surface: InvocationSurface;
  interactionDepth?: InteractionDepth;
  panelPlan?: PanelPlan;
  panelResult?: PanelResult;
  teamDebateRun?: TeamDebateRun;
  degradationReason?: string;
  error?: string;
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
  recommended?: boolean;
}

export type QuestionOpportunityKind =
  | "harness_design"
  | "question_policy"
  | "philosophical_reflection"
  | "knowledge_gap"
  | "tacit_assumption"
  | "value_conflict"
  | "research_commitment"
  | "evidence_risk"
  | "authorship_risk"
  | "source_authority"
  | "delivery_format"
  | "autonomy_boundary"
  | "evaluation_target"
  | "general_missing_context";

export interface QuestionOpportunity {
  key: string;
  kind: QuestionOpportunityKind;
  title: string;
  question: string;
  whyNow: string;
  options: QuestionOption[];
  required: boolean;
  confidence: ConfidenceLevel;
  autoEligible: boolean;
  cues: string[];
}

export interface QuestionGenerationResult {
  promptSignature: string;
  opportunities: QuestionOpportunity[];
  blocking: boolean;
}

export interface QuestionAuditFixtureResult {
  id: string;
  prompt: string;
  expectedKinds: QuestionOpportunityKind[];
  observedKinds: QuestionOpportunityKind[];
  passed: boolean;
  failures: string[];
}

export interface QuestionAuditResult {
  passed: boolean;
  fixtures: QuestionAuditFixtureResult[];
  totals: {
    fixtureCount: number;
    passedCount: number;
    failedCount: number;
  };
}

export interface RoleAuditEntry {
  name: string;
  provider: ProviderKind;
  lineCount: number;
  missingSections: string[];
  warnings: string[];
}

export interface RoleAuditResult {
  passed: boolean;
  roles: RoleAuditEntry[];
  totals: {
    roleCount: number;
    passedCount: number;
    failedCount: number;
  };
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
  displayReason?: string;
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

export type QuestionTransportStatus =
  | "not_attempted"
  | "attempted"
  | "accepted"
  | "declined"
  | "unsupported"
  | "timeout"
  | "error"
  | "fallback_rendered";

export interface QuestionTransportState {
  surface: QuestionSurface;
  status: QuestionTransportStatus;
  updatedAt: string;
  message?: string;
}

export interface QuestionRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: QuestionRecordStatus;
  prompt: QuestionPrompt;
  transportStatus?: QuestionTransportState;
  answer?: QuestionAnswer;
  error?: string;
  clearedReason?: string;
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

export type LongTableHookKind =
  | "longtable_interview"
  | "quality_probe"
  | "checkpoint"
  | "panel_decision";

export type LongTableHookStatus =
  | "pending"
  | "active"
  | "ready_to_confirm"
  | "confirmed"
  | "deferred"
  | "cancelled";

export type InterviewTurnQuality = "thin" | "usable" | "rich";

export type InterviewDepth =
  | "gathering_context"
  | "forming_first_handle"
  | "ready_to_summarize";

export interface LongTableInterviewTurn {
  id: string;
  index: number;
  createdAt: string;
  question: string;
  answer: string;
  reflection?: string;
  quality: InterviewTurnQuality;
  needsFollowUp: boolean;
  followUpQuestion?: string;
  readyToSummarize?: boolean;
  readinessRationale?: string[];
  rationale?: string[];
}

export interface FirstResearchShape {
  handle: string;
  currentGoal: string;
  currentBlocker?: string;
  researchObject?: string;
  gapRisk?: string;
  protectedDecision?: string;
  openQuestions: string[];
  nextAction: string;
  confidence: ConfidenceLevel;
  sourceHookId?: string;
  confirmedAt?: string;
}

export interface LongTableHookRun {
  id: string;
  kind: LongTableHookKind;
  status: LongTableHookStatus;
  createdAt: string;
  updatedAt: string;
  targetOutcome?: "first_research_handle" | string;
  depth?: InterviewDepth;
  provider?: ProviderKind;
  turns?: LongTableInterviewTurn[];
  firstResearchShape?: FirstResearchShape;
  qualityNotes?: string[];
  rationale?: string[];
  linkedQuestionRecordIds?: string[];
  linkedDecisionRecordIds?: string[];
}

export type LongTableQuestionObligationKind =
  | "required_question"
  | "first_research_shape_confirmation";

export type LongTableQuestionObligationStatus =
  | "pending"
  | "satisfied"
  | "cleared";

export interface LongTableQuestionObligation {
  id: string;
  kind: LongTableQuestionObligationKind;
  status: LongTableQuestionObligationStatus;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  reason: string;
  questionId?: string;
  decisionId?: string;
  sourceHookId?: string;
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
  hooks?: LongTableHookRun[];
  firstResearchShape?: FirstResearchShape;
  questionObligations?: LongTableQuestionObligation[];
  inferredHypotheses: InferredHypothesis[];
  openTensions: string[];
  decisionLog: DecisionRecord[];
  invocationLog: InvocationRecord[];
  questionLog: QuestionRecord[];
  artifactRecords: ArtifactRecord[];
  narrativeTraces: NarrativeTrace[];
  studyContract?: StudyContract;
}
