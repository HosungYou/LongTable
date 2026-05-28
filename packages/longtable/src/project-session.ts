import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import {
  appendDecisionRecord as appendDecisionToResearchState,
  appendInvocationRecord as appendInvocationToResearchState,
  appendQuestionRecords,
  createEmptyResearchState
} from "@longtable/memory";
import { classifyCheckpointTrigger } from "@longtable/checkpoints";
import type {
  DecisionRecord,
  EvidenceRecord,
  InvocationRecord,
  InvocationStatus,
  InvocationSurface,
  LongTableQuestionObligation,
  PanelMemberResult,
  ProviderKind,
  QuestionOption,
  QuestionAnswer,
  HardStopScope,
  QuestionCommitmentFamily,
  QuestionEpistemicBasis,
  QuestionGenerationResult,
  QuestionOpportunity,
  QuestionSurface,
  QuestionPromptType,
  QuestionRecord,
  ResearchSpecificationChange,
  ResearchSpecificationPatch,
  ResearchSpecificationPatchSource,
  ResearchSpecificationReadiness,
  ResearchSpecificationRevision,
  ResearchState
} from "@longtable/core";
import type { SetupPersistedOutput } from "@longtable/setup";
import {
  collectHardStopBlockers,
  evaluateResearchSpecificationReadiness,
  requiredResearchSpecificationGaps,
  type HardStopVerdict
} from "@longtable/core";
import {
  ensureFirstResearchShapeObligation,
  ensureRequiredQuestionObligation,
  pendingQuestionObligations,
  resolveQuestionObligationByQuestionId
} from "./question-obligations.js";

export type ProjectDisagreementPreference =
  | "synthesis_only"
  | "show_on_conflict"
  | "always_visible";

export type StartInterviewSignal =
  | "phenomenon"
  | "audience"
  | "artifact"
  | "evidence"
  | "assumption"
  | "decision_risk"
  | "voice";

export interface StartInterviewTurn {
  index: number;
  question: string;
  answer: string;
  signal: StartInterviewSignal;
  purpose: string;
}

export interface StartInterviewSession {
  mode: "adaptive";
  openingStyle: "scene_problem";
  createdAt: string;
  completedAt: string;
  turnCount: number;
  turns: StartInterviewTurn[];
  inferredSignals: StartInterviewSignal[];
  summary: string;
}

export type InterviewTurnQuality = "thin" | "usable" | "rich";

export type InterviewDepth =
  | "gathering_context"
  | "forming_first_handle"
  | "ready_to_summarize";

export interface FirstResearchShape {
  handle: string;
  currentGoal: string;
  currentBlocker?: string;
  researchObject?: string;
  gapRisk?: string;
  protectedDecision?: string;
  openQuestions: string[];
  nextAction: string;
  confidence: "low" | "medium" | "high";
  sourceHookId?: string;
  confirmedAt?: string;
}

export interface ResearchSpecification {
  title: string;
  status?: "draft" | "confirmed" | "deferred";
  createdAt?: string;
  updatedAt?: string;
  sourceHookId?: string;
  latestRevisionId?: string;
  sourceEvidenceIds?: string[];
  sectionEvidence?: Record<string, string[]>;
  researchDirection: {
    question?: string;
    purpose: string;
    scopeBoundary?: string;
    inclusionCriteria?: string[];
    exclusionCriteria?: string[];
  };
  constructOntology: {
    coreConstructs: string[];
    distinctions: string[];
    termsToAvoidCollapsing?: string[];
  };
  theoryAndFraming: {
    anchors: string[];
    alternatives?: string[];
    overreachRisks?: string[];
  };
  measurementCoding: {
    variablesOrConstructs: string[];
    evidenceTypes: string[];
    codingRules: string[];
    openStandards?: string[];
  };
  methodAnalysis: {
    design?: string;
    analysisOptions: string[];
    dataSufficiencyCriteria?: string[];
    unsettledChoices?: string[];
  };
  evidenceAccess: {
    requiredSources?: string[];
    accessRequirements?: string[];
    evidenceStandards?: string[];
  };
  epistemicAlignment: {
    researcherKnowledge?: string[];
    projectStatePriority?: string[];
    aiInferenceLimits?: string[];
    conflictResolutionRule?: string;
  };
  protectedDecisions: string[];
  openQuestions: string[];
  nextActions: string[];
  confidence: "low" | "medium" | "high";
  confirmedAt?: string;
}

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

export interface LongTableHookRun {
  id: string;
  kind: "longtable_interview" | "quality_probe" | "checkpoint" | "panel_decision";
  status: "pending" | "active" | "ready_to_confirm" | "confirmed" | "deferred" | "cancelled";
  createdAt: string;
  updatedAt: string;
  targetOutcome?: "first_research_handle" | string;
  depth?: InterviewDepth;
  provider?: ProviderKind;
  turns?: LongTableInterviewTurn[];
  firstResearchShape?: FirstResearchShape;
  researchSpecification?: ResearchSpecification;
  qualityNotes?: string[];
  rationale?: string[];
  linkedQuestionRecordIds?: string[];
  linkedDecisionRecordIds?: string[];
}

export type LongTableWorkspaceState = ResearchState & {
  hooks?: LongTableHookRun[];
  firstResearchShape?: FirstResearchShape;
  researchSpecification?: ResearchSpecification;
  interviewTurns?: LongTableInterviewTurn[];
  evidenceRecords?: EvidenceRecord[];
  specPatches?: ResearchSpecificationPatch[];
  specRevisions?: ResearchSpecificationRevision[];
};

export interface LongTableProjectRecord {
  schemaVersion: 1;
  product: "LongTable";
  projectName: string;
  projectPath: string;
  createdAt: string;
  contractVersion?: "workspace-v2";
  locale?: string;
  globalSetupSummary: {
    field: string;
    careerStage: string;
    experienceLevel: string;
    checkpointIntensity: string;
    humanAuthorshipSignal?: string;
    weakestDomain?: string;
    defaultPanelPreference?: ProjectDisagreementPreference;
  };
}

export interface LongTableSessionRecord {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  lastUpdatedAt?: string;
  projectName: string;
  projectPath: string;
  currentGoal: string;
  currentBlocker?: string;
  researchObject?: string;
  gapRisk?: string;
  protectedDecision?: string;
  nextAction?: string;
  openQuestions?: string[];
  startInterview?: StartInterviewSession;
  firstResearchShape?: FirstResearchShape;
  researchSpecification?: ResearchSpecification;
  requestedPerspectives: string[];
  disagreementPreference: ProjectDisagreementPreference;
  activeModes?: string[];
  resumeHint?: string;
  locale?: string;
}

export interface LongTableProjectContext {
  project: LongTableProjectRecord;
  session: LongTableSessionRecord;
  projectFilePath: string;
  sessionFilePath: string;
  stateFilePath: string;
  currentFilePath: string;
  metaDir: string;
}

export interface LongTableWorkspaceInspection {
  found: boolean;
  rootPath?: string;
  project?: {
    name: string;
    path: string;
    field: string;
    careerStage: string;
    checkpointIntensity: string;
  };
  session?: {
    currentGoal: string;
    currentBlocker?: string;
    requestedPerspectives: string[];
    disagreementPreference: ProjectDisagreementPreference;
    researchSpecification?: {
      title: string;
      status: "draft" | "confirmed" | "deferred";
      confidence: "low" | "medium" | "high";
    };
  };
  files?: {
    project: string;
    session: string;
    state: string;
    current: string;
  };
  counts?: {
    invocations: number;
    questions: number;
    pendingQuestions: number;
    pendingObligations: number;
    stalePendingQuestions?: number;
    stalePendingObligations?: number;
    answeredQuestions: number;
    decisions: number;
    interviewTurns?: number;
    evidenceRecords?: number;
    specPatches?: number;
    specRevisions?: number;
  };
  hardStop?: HardStopVerdict;
  researchSpecificationReadiness?: ResearchSpecificationReadiness;
  recentInvocations?: Array<{
    id: string;
    kind: string;
    mode: string;
    surface: string;
    status: string;
    roles: string[];
    linkedQuestions: number;
    linkedDecisions: number;
  }>;
  pendingQuestions?: Array<{
    id: string;
    title: string;
    question: string;
    commitmentFamily?: QuestionCommitmentFamily;
    epistemicBasis?: QuestionEpistemicBasis;
    hardStop?: boolean;
    hardStopScope?: string;
    options: string[];
    required: boolean;
  }>;
  pendingObligations?: Array<{
    id: string;
    kind: string;
    prompt: string;
    reason: string;
    hardStop?: boolean;
    hardStopScope?: string;
    questionId?: string;
  }>;
  recentDecisions?: Array<{
    id: string;
    checkpointKey: string;
    summary: string;
    commitmentFamily?: QuestionCommitmentFamily;
    epistemicBasis?: QuestionEpistemicBasis;
    selectedOption?: string;
    timestamp: string;
  }>;
  answerWarnings?: Array<{
    questionId: string;
    decisionRecordId?: string;
    issue: string;
    suggestion?: string;
  }>;
}

export interface PanelResultRecordInput {
  invocationId?: string;
  status?: InvocationStatus;
  surface?: InvocationSurface;
  synthesis?: string;
  conflictSummary?: string;
  decisionPrompt?: string;
  memberResults?: Array<Partial<PanelMemberResult> & { role: string }>;
}

export interface PanelResultRecordOutput {
  invocation: InvocationRecord;
  evidenceRecords: EvidenceRecord[];
  state: LongTableWorkspaceState;
}

export interface LongTableHandoffOutput {
  id: string;
  createdAt: string;
  path: string;
  content: string;
  sourceEvidenceIds: string[];
  pendingQuestionIds: string[];
  proposedPatchIds: string[];
  latestInvocationId?: string;
}

const CURRENT_FILE_NAME = "CURRENT.md";
const LEGACY_ROOT_FILES = ["LONGTABLE.md", "START-HERE.md", "NEXT-STEPS.md", "SESSION-SNAPSHOT.md"];

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function resolveMetaDir(projectPath: string): string {
  return join(projectPath, ".longtable");
}

function resolveStateFilePath(projectPath: string): string {
  return join(resolveMetaDir(projectPath), "state.json");
}

function resolveCurrentFilePath(projectPath: string): string {
  return join(projectPath, CURRENT_FILE_NAME);
}

function normalizeLocale(locale: string | undefined): "ko" | "en" {
  if ((locale ?? "").toLowerCase().startsWith("ko")) {
    return "ko";
  }

  return "en";
}

function resolveUserLocale(): "ko" | "en" {
  const envLocale =
    process.env.LC_ALL ??
    process.env.LC_MESSAGES ??
    process.env.LANG ??
    "";

  if (envLocale && !["c", "c.utf-8", "posix"].includes(envLocale.toLowerCase())) {
    return normalizeLocale(envLocale);
  }

  if (process.platform === "darwin") {
    try {
      const appleLocale = execSync("defaults read -g AppleLocale", { encoding: "utf8" }).trim();
      if (appleLocale) {
        return normalizeLocale(appleLocale);
      }
    } catch {
      // Ignore and fall back to Intl below.
    }
  }

  return normalizeLocale(Intl.DateTimeFormat().resolvedOptions().locale);
}

function buildFirstQuestion(session: LongTableSessionRecord): string {
  if (session.firstResearchShape?.openQuestions?.[0]) {
    return session.firstResearchShape.openQuestions[0];
  }
  return session.currentBlocker
    ? `Where does "${session.currentBlocker}" show up most concretely in the scene, material, or evidence?`
    : `What scene, case, text, data, or draft would make "${session.currentGoal}" easiest to inspect first?`;
}

function buildOpenQuestions(session: LongTableSessionRecord): string[] {
  const firstQuestion = buildFirstQuestion(session);

  if (session.startInterview) {
    return [
      firstQuestion,
      `What still feels hardest to name or make concrete in "${session.currentGoal}"?`
    ];
  }

  return session.currentBlocker
    ? [
        firstQuestion,
        `What would give "${session.currentBlocker}" a usable first research handle without forcing a final research question yet?`
      ]
    : [
        firstQuestion,
        `What would give this project a usable first research handle without pretending the question is settled?`
      ];
}

function buildNextAction(session: LongTableSessionRecord): string {
  if (session.firstResearchShape) {
    return session.firstResearchShape.nextAction;
  }

  if (session.startInterview) {
    return session.currentBlocker
      ? `Begin from the start-interview brief, then make "${session.currentBlocker}" concrete with one scene, source, case, or dataset.`
      : "Begin from the start-interview brief, then choose one concrete scene, source, case, or dataset to inspect first.";
  }

  return session.currentBlocker
    ? `Open with the blocker, then make "${session.currentBlocker}" concrete with one scene, source, case, or dataset.`
    : "Open with your current goal in one sentence, then ask LongTable for the first concrete research move.";
}

function buildResumeHint(session: LongTableSessionRecord): string {
  if (session.researchSpecification) {
    return `I want to continue from the Research Specification: ${session.researchSpecification.title}.`;
  }

  if (session.firstResearchShape) {
    return `I want to continue from the First Research Shape: ${session.firstResearchShape.handle}.`;
  }

  if (session.startInterview) {
    return session.currentBlocker
      ? `I want to continue from the LongTable start interview. The first unresolved issue is ${session.currentBlocker}.`
      : `I want to continue from the LongTable start interview for ${session.currentGoal}.`;
  }

  return session.currentBlocker
    ? `I want to continue ${session.currentGoal}. The unresolved blocker is ${session.currentBlocker}.`
    : `I want to continue ${session.currentGoal}.`;
}

function renderResearchSpecificationSummary(
  specification: ResearchSpecification,
  locale: "en" | "ko"
): string[] {
  const korean = locale === "ko";
  const lines: string[] = [
    "",
    korean ? "## Research Specification" : "## Research Specification",
    `- ${korean ? "제목" : "Title"}: ${specification.title}`,
    `- ${korean ? "상태" : "Status"}: ${specification.confirmedAt ? "confirmed" : specification.status ?? "draft"}`,
    `- ${korean ? "신뢰도" : "Confidence"}: ${specification.confidence}`
  ];
  if (specification.researchDirection.question) {
    lines.push(`- ${korean ? "연구 질문" : "Question"}: ${specification.researchDirection.question}`);
  }
  lines.push(`- ${korean ? "목적" : "Purpose"}: ${specification.researchDirection.purpose}`);
  if (specification.researchDirection.scopeBoundary) {
    lines.push(`- ${korean ? "범위 경계" : "Scope boundary"}: ${specification.researchDirection.scopeBoundary}`);
  }
  if (specification.constructOntology.coreConstructs.length > 0) {
    lines.push(`- ${korean ? "핵심 construct" : "Core constructs"}: ${specification.constructOntology.coreConstructs.join("; ")}`);
  }
  if (specification.constructOntology.distinctions.length > 0) {
    lines.push(`- ${korean ? "구분해야 할 차이" : "Key distinctions"}: ${specification.constructOntology.distinctions.join("; ")}`);
  }
  if (specification.theoryAndFraming.anchors.length > 0) {
    lines.push(`- ${korean ? "이론 앵커" : "Theory anchors"}: ${specification.theoryAndFraming.anchors.join("; ")}`);
  }
  if (specification.measurementCoding.codingRules.length > 0) {
    lines.push(`- ${korean ? "코딩 규칙" : "Coding rules"}: ${specification.measurementCoding.codingRules.join("; ")}`);
  }
  if (specification.methodAnalysis.analysisOptions.length > 0) {
    lines.push(`- ${korean ? "분석 옵션" : "Analysis options"}: ${specification.methodAnalysis.analysisOptions.join("; ")}`);
  }
  if (specification.evidenceAccess.requiredSources?.length) {
    lines.push(`- ${korean ? "필요 근거원" : "Required sources"}: ${specification.evidenceAccess.requiredSources.join("; ")}`);
  }
  if (specification.evidenceAccess.accessRequirements?.length) {
    lines.push(`- ${korean ? "Corpus and Access Plan" : "Corpus and Access Plan"}: ${specification.evidenceAccess.accessRequirements.join("; ")}`);
  }
  if (specification.evidenceAccess.evidenceStandards?.length) {
    lines.push(`- ${korean ? "근거 기준" : "Evidence standards"}: ${specification.evidenceAccess.evidenceStandards.join("; ")}`);
  }
  if (specification.epistemicAlignment.conflictResolutionRule) {
    lines.push(`- ${korean ? "충돌 조정 규칙" : "Conflict rule"}: ${specification.epistemicAlignment.conflictResolutionRule}`);
  }
  if (specification.protectedDecisions.length > 0) {
    lines.push(...specification.protectedDecisions.map((decision) => `- ${korean ? "보호할 결정" : "Protected decision"}: ${decision}`));
  }
  if (specification.openQuestions.length > 0) {
    lines.push(...specification.openQuestions.map((question) => `- ${korean ? "열린 질문" : "Open question"}: ${question}`));
  }
  if (specification.nextActions.length > 0) {
    lines.push(...specification.nextActions.map((action) => `- ${korean ? "다음 행동" : "Next action"}: ${action}`));
  }
  return lines;
}

function renderResearchSpecificationStatus(
  session: LongTableSessionRecord,
  locale: "en" | "ko"
): string[] {
  const readiness = evaluateResearchSpecificationReadiness({
    firstResearchShape: session.firstResearchShape,
    researchSpecification: session.researchSpecification
  });
  if (readiness.status === "no_spec") {
    return [];
  }

  const korean = locale === "ko";
  if (readiness.status === "shape_only") {
    return [
      "",
      korean ? "## Research Specification 상태" : "## Research Specification Status",
      korean
        ? "- 상태: First Research Shape는 있지만 Research Specification은 아직 없습니다."
        : "- Status: First Research Shape exists, but Research Specification is missing.",
      korean
        ? "- 의미: First Research Shape는 짧은 핸들/재개 인덱스이며, 인터뷰 종료나 연구 명세 확정이 아닙니다."
        : "- Meaning: First Research Shape is a short handle/resume index, not interview closure or a confirmed research specification.",
      korean
        ? "- 다음 프로토콜: 충분한 내용이 있으면 `summarize_research_specification`으로 preview를 만들고 `confirm_research_specification`으로 저장/한 질문 더/섹션 수정/열어두기를 확인합니다."
        : "- Next protocol: when enough detail exists, run `summarize_research_specification` to create the preview, then `confirm_research_specification` to confirm, ask one more question, revise a section, or keep it open."
    ];
  }

  if (readiness.status === "confirmed") {
    return [];
  }

  return [
    "",
    korean ? "## Research Specification 상태" : "## Research Specification Status",
    korean
      ? `- 상태: ${readiness.status}. Research Specification은 저장되어 있지만 아직 확정된 종료 지점이 아닙니다.`
      : `- Status: ${readiness.status}. Research Specification exists, but it is not a confirmed closure point yet.`,
    ...(readiness.blockingGaps.length > 0
      ? [korean
          ? `- 남은 gap: ${readiness.blockingGaps.join("; ")}.`
          : `- Remaining gaps: ${readiness.blockingGaps.join("; ")}.`]
      : []),
    korean
      ? readiness.nextAction === "start"
        ? "- 다음 프로토콜: `$longtable-start`에서 빠진 섹션을 더 묻고 Research Specification을 업데이트해야 합니다."
        : "- 다음 프로토콜: `confirm_research_specification`으로 preview 확인을 받아야 합니다."
      : readiness.nextAction === "start"
        ? "- Next protocol: stay in `$longtable-start`, ask for the missing sections, and update the Research Specification."
        : "- Next protocol: return to `confirm_research_specification` for preview confirmation."
  ];
}

function renderResearchSpecificationAudit(
  state: ResearchState,
  locale: "en" | "ko"
): string[] {
  const korean = locale === "ko";
  const revisions = (state.specRevisions ?? []).slice(-5).reverse();
  const patches = (state.specPatches ?? []).slice(-5).reverse();
  const evidenceRecords = state.evidenceRecords ?? [];
  const unincorporated = evidenceRecords
    .filter((record) => !record.incorporatedByRevisionId)
    .slice(-5)
    .reverse();
  const specification = state.researchSpecification as ResearchSpecification | undefined;
  const sectionEvidence = Object.entries(specification?.sectionEvidence ?? {}).slice(0, 8);

  if (
    revisions.length === 0 &&
    patches.length === 0 &&
    evidenceRecords.length === 0 &&
    sectionEvidence.length === 0
  ) {
    return [];
  }

  return [
    "",
    korean ? "## Research Specification 감사" : "## Research Specification Audit",
    ...(specification
      ? [
          `- ${korean ? "현재 버전" : "Current revision"}: ${specification.latestRevisionId ?? "unversioned"}`,
          `- ${korean ? "상태" : "Status"}: ${specification.confirmedAt ? "confirmed" : specification.status ?? "draft"}`
        ]
      : []),
    `- ${korean ? "원문 인터뷰 turn" : "Raw interview turns"}: ${(state.interviewTurns ?? []).length}`,
    `- ${korean ? "근거 기록" : "Evidence records"}: ${evidenceRecords.length}`,
    `- ${korean ? "spec patch" : "Spec patches"}: ${(state.specPatches ?? []).length}`,
    `- ${korean ? "spec revision" : "Spec revisions"}: ${(state.specRevisions ?? []).length}`,
    ...(revisions.length > 0
      ? [
          "",
          korean ? "### 최근 명세 변경" : "### Recent Specification Changes",
          ...revisions.map((revision) =>
            `- v${revision.index} ${revision.title}: ${revision.changeSummary.slice(0, 3).join("; ")}`
          )
        ]
      : []),
    ...(sectionEvidence.length > 0
      ? [
          "",
          korean ? "### 근거 맵" : "### Evidence Map",
          ...sectionEvidence.map(([path, ids]) => `- ${path}: ${ids.slice(-4).join(", ")}`)
        ]
      : []),
    ...(unincorporated.length > 0
      ? [
          "",
          korean ? "### 아직 반영되지 않은 근거" : "### Unincorporated Evidence",
          ...unincorporated.map((record) =>
            `- ${record.id} [${record.sourceKind}]: ${compactLine(record.summary, 120)}`
          )
        ]
      : []),
    ...(patches.some((patch) => patch.status === "proposed")
      ? [
          "",
          korean ? "- 대기 중인 spec patch가 있습니다. 적용하거나 거절해야 합니다." : "- Proposed spec patches are waiting to be applied or rejected."
        ]
      : [])
  ];
}

function buildCurrentGuide(
  project: LongTableProjectRecord,
  session: LongTableSessionRecord,
  recentInvocations: InvocationRecord[] = [],
  pendingQuestions: QuestionRecord[] = [],
  pendingObligations: LongTableQuestionObligation[] = [],
  state: ResearchState = createEmptyResearchState()
): string {
  const locale = normalizeLocale(session.locale ?? project.locale);
  const openQuestions = session.openQuestions && session.openQuestions.length > 0
    ? session.openQuestions
    : buildOpenQuestions(session);
  const nextAction = session.nextAction ?? buildNextAction(session);
  const resumeHint = session.resumeHint ?? buildResumeHint(session);
  const suggestedPrompt = `lt explore: ${openQuestions[0]}`;

  if (locale === "ko") {
    return [
      "# CURRENT",
      "",
      `Project: ${project.projectName}`,
      "",
      "이 파일은 `.longtable/current-session.json`과 `.longtable/state.json`에서 재생성되는 현재 작업 뷰입니다.",
      "",
      "## 지금 초점",
      `- 현재 목표: ${session.currentGoal}`,
      ...(session.currentBlocker ? [`- 현재 blocker: ${session.currentBlocker}`] : []),
      ...(session.researchObject ? [`- 연구 객체: ${session.researchObject}`] : []),
      ...(session.gapRisk ? [`- 공백/암묵지 위험: ${session.gapRisk}`] : []),
      ...(session.protectedDecision ? [`- 보호할 결정: ${session.protectedDecision}`] : []),
      ...(session.firstResearchShape ? [`- First Research Shape: ${session.firstResearchShape.handle}`] : []),
      ...(session.researchSpecification ? [`- Research Specification: ${session.researchSpecification.title}`] : []),
      ...(session.startInterview ? [`- start interview: ${session.startInterview.summary}`] : []),
      `- 다음 액션: ${nextAction}`,
      `- 관점: ${session.requestedPerspectives.length > 0 ? session.requestedPerspectives.join(", ") : "auto"}`,
      `- disagreement: ${session.disagreementPreference}`,
      ...renderResearchSpecificationStatus(session, locale),
      ...renderResearchSpecificationAudit(state, locale),
      "",
      "## 열린 질문",
      ...openQuestions.map((question) => `- ${question}`),
      ...(recentInvocations.length > 0
        ? [
            "",
            "## 최근 LongTable 호출",
            ...recentInvocations.map((record) => {
              const roles = record.intent.roles.length > 0 ? record.intent.roles.join(", ") : "auto";
              return `- ${record.intent.kind}/${record.intent.mode} via ${record.surface}: ${roles}`;
            })
          ]
        : []),
      ...(pendingQuestions.length > 0
        ? [
            "",
            "## 대기 중인 결정 질문",
            ...pendingQuestions.map((record) => {
              const options = formatQuestionOptionValues(record).join("/");
              return `- ${record.id}: ${record.prompt.question}${formatQuestionMetadata(record)} (${options})`;
            }),
            "- 답변 기록: `longtable decide --question <id> --answer <value>`"
          ]
        : []),
      ...(pendingObligations.length > 0
        ? [
            "",
            "## 대기 중인 연구 의무",
            ...pendingObligations.map((obligation) => {
              const linked = obligation.questionId ? ` [question: ${obligation.questionId}]` : "";
              return `- ${obligation.prompt}${linked}: ${obligation.reason}`;
            })
          ]
        : []),
      "",
      "## 다시 시작 문장",
      `- "${resumeHint}"`,
      ...(session.firstResearchShape
        ? [
            "",
            "## First Research Shape",
            `- Handle: ${session.firstResearchShape.handle}`,
            `- Confidence: ${session.firstResearchShape.confidence}`,
            ...session.firstResearchShape.openQuestions.map((question) => `- Open question: ${question}`)
          ]
        : []),
      ...(session.researchSpecification ? renderResearchSpecificationSummary(session.researchSpecification, locale) : []),
      "",
      "## 빠른 시작",
      "- 이 디렉토리에서 `codex`를 엽니다.",
      `- 첫 메시지는 보통 \`${session.firstResearchShape ? suggestedPrompt : "$longtable-start"}\` 정도면 충분합니다.`,
      "",
      "## 증거 규칙",
      "- 외부 사실이나 현재 정보는 source를 붙이거나 inference로 낮춥니다."
    ].join("\n");
  }

  return [
    "# CURRENT",
    "",
    `Project: ${project.projectName}`,
    "",
    "This file is regenerated from `.longtable/current-session.json` and `.longtable/state.json`.",
    "",
    "## Focus Now",
    `- Current goal: ${session.currentGoal}`,
    ...(session.currentBlocker ? [`- Current blocker: ${session.currentBlocker}`] : []),
    ...(session.researchObject ? [`- Research object: ${session.researchObject}`] : []),
    ...(session.gapRisk ? [`- Gap/tacit risk: ${session.gapRisk}`] : []),
    ...(session.protectedDecision ? [`- Protected decision: ${session.protectedDecision}`] : []),
    ...(session.firstResearchShape ? [`- First Research Shape: ${session.firstResearchShape.handle}`] : []),
    ...(session.researchSpecification ? [`- Research Specification: ${session.researchSpecification.title}`] : []),
    ...(session.startInterview ? [`- Start interview: ${session.startInterview.summary}`] : []),
    `- Next action: ${nextAction}`,
    `- Perspectives: ${session.requestedPerspectives.length > 0 ? session.requestedPerspectives.join(", ") : "auto"}`,
    `- Disagreement: ${session.disagreementPreference}`,
    ...renderResearchSpecificationStatus(session, locale),
    ...renderResearchSpecificationAudit(state, locale),
    "",
    "## Open Questions",
    ...openQuestions.map((question) => `- ${question}`),
    ...(recentInvocations.length > 0
      ? [
          "",
          "## Recent LongTable Invocations",
          ...recentInvocations.map((record) => {
            const roles = record.intent.roles.length > 0 ? record.intent.roles.join(", ") : "auto";
            return `- ${record.intent.kind}/${record.intent.mode} via ${record.surface}: ${roles}`;
          })
        ]
      : []),
    ...(pendingQuestions.length > 0
      ? [
          "",
          "## Pending Decision Questions",
          ...pendingQuestions.map((record) => {
            const options = formatQuestionOptionValues(record).join("/");
            return `- ${record.id}: ${record.prompt.question}${formatQuestionMetadata(record)} (${options})`;
          }),
          "- Record an answer: `longtable decide --question <id> --answer <value>`"
        ]
      : []),
    ...(pendingObligations.length > 0
      ? [
          "",
          "## Pending Research Obligations",
          ...pendingObligations.map((obligation) => {
            const linked = obligation.questionId ? ` [question: ${obligation.questionId}]` : "";
            return `- ${obligation.prompt}${linked}: ${obligation.reason}`;
          })
        ]
      : []),
    "",
    "## Restart Prompt",
    `- "${resumeHint}"`,
    ...(session.firstResearchShape
      ? [
          "",
          "## First Research Shape",
          `- Handle: ${session.firstResearchShape.handle}`,
          `- Confidence: ${session.firstResearchShape.confidence}`,
          ...session.firstResearchShape.openQuestions.map((question) => `- Open question: ${question}`)
        ]
      : []),
    ...(session.researchSpecification ? renderResearchSpecificationSummary(session.researchSpecification, locale) : []),
    "",
    "## Quick Start",
    "- Open `codex` in this directory.",
    `- A good first message is usually \`${session.firstResearchShape ? suggestedPrompt : "$longtable-start"}\`.`,
    "",
    "## Evidence Rule",
    "- External or current claims should carry a source link or be labeled as inference."
  ].join("\n");
}

async function loadResearchState(stateFilePath: string): Promise<LongTableWorkspaceState> {
  if (!existsSync(stateFilePath)) {
    return createEmptyResearchState() as LongTableWorkspaceState;
  }

  const parsed = JSON.parse(await readFile(stateFilePath, "utf8")) as Partial<LongTableWorkspaceState>;
  return {
    ...parsed,
    explicitState: parsed.explicitState ?? {},
    workingState: parsed.workingState ?? {},
    hooks: parsed.hooks ?? [],
    ...(parsed.firstResearchShape ? { firstResearchShape: parsed.firstResearchShape } : {}),
    ...(parsed.researchSpecification ? { researchSpecification: parsed.researchSpecification } : {}),
    interviewTurns: parsed.interviewTurns ?? [],
    evidenceRecords: parsed.evidenceRecords ?? [],
    specPatches: parsed.specPatches ?? [],
    specRevisions: parsed.specRevisions ?? [],
    questionObligations: parsed.questionObligations ?? [],
    inferredHypotheses: parsed.inferredHypotheses ?? [],
    openTensions: parsed.openTensions ?? [],
    decisionLog: parsed.decisionLog ?? [],
    invocationLog: parsed.invocationLog ?? [],
    questionLog: parsed.questionLog ?? [],
    artifactRecords: parsed.artifactRecords ?? [],
    narrativeTraces: parsed.narrativeTraces ?? [],
    ...(parsed.studyContract ? { studyContract: parsed.studyContract } : {})
  };
}

export async function loadWorkspaceState(context: LongTableProjectContext): Promise<LongTableWorkspaceState> {
  return loadResearchState(context.stateFilePath);
}

function recentInvocationRecords(state: ResearchState, limit = 3): InvocationRecord[] {
  return (state.invocationLog ?? []).slice(-limit).reverse();
}

function recentPendingQuestions(state: ResearchState, limit = 3): QuestionRecord[] {
  return (state.questionLog ?? [])
    .filter((record) => record.status === "pending")
    .slice(-limit)
    .reverse();
}

function visiblePendingObligations(state: ResearchState): LongTableQuestionObligation[] {
  const pendingQuestionIds = new Set(
    (state.questionLog ?? [])
      .filter((record) => record.status === "pending")
      .map((record) => record.id)
  );
  return pendingQuestionObligations(state).filter((obligation) =>
    !obligation.questionId || !pendingQuestionIds.has(obligation.questionId)
  );
}

function recentPendingObligations(state: ResearchState, limit = 3): LongTableQuestionObligation[] {
  return visiblePendingObligations(state)
    .slice(-limit)
    .reverse();
}

function formatQuestionOptionValues(record: QuestionRecord): string[] {
  const values = record.prompt.options.map((option) => option.value);
  if (record.prompt.allowOther) {
    values.push(record.prompt.otherLabel ? `other:${record.prompt.otherLabel}` : "other");
  }
  return values;
}

function formatQuestionMetadata(record: Pick<QuestionRecord, "commitmentFamily" | "epistemicBasis">): string {
  const parts = [
    record.commitmentFamily ? `commitment: ${record.commitmentFamily}` : "",
    record.epistemicBasis ? `basis: ${record.epistemicBasis}` : ""
  ].filter(Boolean);
  return parts.length > 0 ? ` [${parts.join("; ")}]` : "";
}

function compactLine(value: string, limit = 160): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted.length > limit ? `${compacted.slice(0, limit - 1)}…` : compacted;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

const SPEC_DIFF_IGNORED_PATHS = new Set([
  "createdAt",
  "updatedAt",
  "latestRevisionId",
  "sourceEvidenceIds",
  "sectionEvidence"
]);

function flattenSpecificationValue(value: unknown, prefix = ""): Map<string, unknown> {
  const flattened = new Map<string, unknown>();
  const record = asRecord(value);
  if (!record) {
    if (prefix) {
      flattened.set(prefix, value);
    }
    return flattened;
  }

  for (const [key, nested] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (SPEC_DIFF_IGNORED_PATHS.has(path)) {
      continue;
    }
    const nestedRecord = asRecord(nested);
    if (nestedRecord) {
      for (const [nestedPath, nestedValue] of flattenSpecificationValue(nestedRecord, path)) {
        flattened.set(nestedPath, nestedValue);
      }
      continue;
    }
    flattened.set(path, nested);
  }

  return flattened;
}

function stableValue(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function diffResearchSpecifications(
  before: ResearchSpecification | undefined,
  after: ResearchSpecification
): ResearchSpecificationChange[] {
  const beforeMap = before ? flattenSpecificationValue(before) : new Map<string, unknown>();
  const afterMap = flattenSpecificationValue(after);
  const paths = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const changes: ResearchSpecificationChange[] = [];

  for (const path of [...paths].sort()) {
    const previous = beforeMap.get(path);
    const next = afterMap.get(path);
    if (stableValue(previous) === stableValue(next)) {
      continue;
    }
    const kind: ResearchSpecificationChange["kind"] = previous === undefined
      ? "set"
      : next === undefined
        ? "remove"
        : "replace";
    changes.push({
      path,
      kind,
      summary: `${kind} ${path}`,
      ...(previous !== undefined ? { before: previous } : {}),
      ...(next !== undefined ? { after: next } : {})
    });
  }

  return changes;
}

function cloneResearchSpecification(specification: ResearchSpecification): ResearchSpecification {
  return JSON.parse(JSON.stringify(specification)) as ResearchSpecification;
}

function mergeStringLists(...lists: Array<string[] | undefined>): string[] {
  return [...new Set(lists.flatMap((list) => list ?? []).filter(Boolean))];
}

function buildResearchSpecificationGapQuestion(
  gaps: string[],
  timestamp: string,
  sourceEvidenceIds: string[]
): QuestionRecord {
  return {
    id: createId("question"),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "pending",
    commitmentFamily: "scope",
    epistemicBasis: "project_state",
    prompt: {
      id: createId("prompt"),
      checkpointKey: "research_specification_required_sections",
      title: "Research Specification gaps",
      question: `Which missing Research Specification section should LongTable resolve first? Missing: ${gaps.join(", ")}.`,
      type: "single_choice",
      options: [
        { value: "ask_researcher", label: "Ask the researcher", description: "Pause and ask for the missing research commitment.", recommended: true },
        { value: "mark_unresolved", label: "Mark unresolved", description: "Keep the gap visible as an unresolved decision." },
        { value: "infer_from_evidence", label: "Infer from evidence", description: "Use existing evidence records and keep the inference explicit." },
        { value: "defer", label: "Defer", description: "Do not treat the specification as complete yet." }
      ],
      allowOther: true,
      otherLabel: "Other resolution",
      required: true,
      source: "checkpoint",
      displayReason: `The current Research Specification is missing: ${gaps.join(", ")}.`,
      rationale: [
        "Research Specification is the required durable interview artifact.",
        "Missing required sections can make later resume, screening, coding, or evidence decisions stale."
      ],
      preferredSurfaces: ["mcp_elicitation", "numbered"]
    },
    transportStatus: {
      surface: "mcp_elicitation",
      status: "not_attempted",
      updatedAt: timestamp,
      ...(sourceEvidenceIds.length > 0 ? { message: `Source evidence: ${sourceEvidenceIds.join(", ")}` } : {})
    }
  };
}

function appendSpecGapQuestionIfNeeded(
  state: LongTableWorkspaceState,
  specification: ResearchSpecification,
  timestamp: string,
  sourceEvidenceIds: string[]
): LongTableWorkspaceState {
  const gaps = requiredResearchSpecificationGaps(specification);
  if (gaps.length === 0) {
    return state;
  }
  const alreadyPending = (state.questionLog ?? []).some((record) =>
    record.status === "pending" &&
    record.prompt.checkpointKey === "research_specification_required_sections"
  );
  if (alreadyPending) {
    return state;
  }
  return {
    ...state,
    questionLog: [
      ...(state.questionLog ?? []),
      buildResearchSpecificationGapQuestion(gaps, timestamp, sourceEvidenceIds)
    ]
  };
}

function changeSummaryForRevision(changes: ResearchSpecificationChange[]): string[] {
  if (changes.length === 0) {
    return ["No substantive field changes; audit metadata refreshed."];
  }
  return changes.slice(0, 12).map((change) => change.summary);
}

function researchSpecificationAnswerConfirms(answer: string | undefined): boolean {
  return answer === "confirm_specification";
}

function researchSpecificationAnswerStatus(answer: string | undefined): "confirmed" | "deferred" | "draft" {
  if (researchSpecificationAnswerConfirms(answer)) {
    return "confirmed";
  }
  if (answer === "keep_open") {
    return "deferred";
  }
  return "draft";
}

export function applyResearchSpecificationAuditUpdate(
  state: LongTableWorkspaceState,
  options: {
    specification: ResearchSpecification;
    timestamp: string;
    source: ResearchSpecificationPatchSource;
    title?: string;
    rationale?: string;
    sourceEvidenceIds?: string[];
    patch?: ResearchSpecificationPatch;
    questionRecordId?: string;
    decisionRecordId?: string;
    createDecisionRecord?: boolean;
  }
): {
  state: LongTableWorkspaceState;
  specification: ResearchSpecification;
  patch: ResearchSpecificationPatch;
  revision: ResearchSpecificationRevision;
  decision?: DecisionRecord;
} {
  const previous = state.researchSpecification;
  const incomingEvidenceIds = mergeStringLists(
    options.patch?.sourceEvidenceIds,
    options.specification.sourceEvidenceIds,
    options.sourceEvidenceIds
  );
  const sourceEvidenceIds = mergeStringLists(previous?.sourceEvidenceIds, incomingEvidenceIds);
  const changes = diffResearchSpecifications(previous, options.specification)
    .map((change) => ({
      ...change,
      ...(incomingEvidenceIds.length > 0 ? { evidenceRecordIds: incomingEvidenceIds } : {})
    }));
  const patchId = options.patch?.id ?? createId("spec_patch");
  const revisionId = createId("spec_revision");
  const patchTitle = options.title ?? options.patch?.title ?? `Research Specification update: ${options.specification.title}`;
  const patchRationale = options.rationale ?? options.patch?.rationale;
  const sectionEvidence = {
    ...(previous?.sectionEvidence ?? {}),
    ...(options.specification.sectionEvidence ?? {})
  };
  for (const change of changes) {
    const fieldEvidenceIds = change.evidenceRecordIds ?? [];
    if (fieldEvidenceIds.length > 0) {
      sectionEvidence[change.path] = mergeStringLists(sectionEvidence[change.path], fieldEvidenceIds);
    }
  }
  const specification: ResearchSpecification = {
    ...cloneResearchSpecification(options.specification),
    updatedAt: options.timestamp,
    latestRevisionId: revisionId,
    sourceEvidenceIds,
    sectionEvidence
  };
  const decision = options.decisionRecordId || options.createDecisionRecord === false
    ? undefined
    : {
        id: createId("decision"),
        timestamp: options.timestamp,
        checkpointKey: "research_specification_auto_update",
        level: "log_only" as const,
        mode: "commit" as const,
        summary: `Applied Research Specification update: ${patchTitle}`,
        commitmentFamily: "scope" as const,
        epistemicBasis: "mixed" as const,
        rationale: patchRationale ?? "Automatically applied a source-mapped Research Specification update."
      };
  const decisionRecordId = options.decisionRecordId ?? decision?.id;
  const revision: ResearchSpecificationRevision = {
    id: revisionId,
    index: (state.specRevisions ?? []).length + 1,
    createdAt: options.timestamp,
    source: options.source,
    title: patchTitle,
    status: specification.status ?? "draft",
    patchId,
    ...(options.questionRecordId ? { questionRecordId: options.questionRecordId } : {}),
    ...(decisionRecordId ? { decisionRecordId } : {}),
    sourceEvidenceIds,
    changeSummary: changeSummaryForRevision(changes),
    specification
  };
  const patch: ResearchSpecificationPatch = {
    id: patchId,
    createdAt: options.patch?.createdAt ?? options.timestamp,
    updatedAt: options.timestamp,
    status: "applied",
    source: options.source,
    title: patchTitle,
    ...(patchRationale ? { rationale: patchRationale } : {}),
    changes,
    sourceEvidenceIds,
    targetSpecification: specification,
    appliedAt: options.timestamp,
    appliedRevisionId: revision.id,
    ...(options.questionRecordId ? { questionRecordId: options.questionRecordId } : {}),
    ...(decisionRecordId ? { decisionRecordId } : {})
  };
  const incorporatedEvidence = (state.evidenceRecords ?? []).map((record) =>
    sourceEvidenceIds.includes(record.id)
      ? {
          ...record,
          incorporatedAt: options.timestamp,
          incorporatedByPatchId: patch.id,
          incorporatedByRevisionId: revision.id
        }
      : record
  );
  const withDecision = decision ? appendDecisionToResearchState(state, decision) as LongTableWorkspaceState : state;
  const previousPatches = withDecision.specPatches ?? [];
  const specPatches = previousPatches.some((entry) => entry.id === patch.id)
    ? previousPatches.map((entry) => entry.id === patch.id ? patch : entry)
    : [...previousPatches, patch];
  const nextState: LongTableWorkspaceState = {
    ...withDecision,
    researchSpecification: specification,
    evidenceRecords: incorporatedEvidence,
    specPatches,
    specRevisions: [...(withDecision.specRevisions ?? []), revision],
    workingState: {
      ...withDecision.workingState,
      researchSpecification: specification
    }
  };
  return {
    state: appendSpecGapQuestionIfNeeded(nextState, specification, options.timestamp, sourceEvidenceIds),
    specification,
    patch,
    revision,
    ...(decision ? { decision } : {})
  };
}

function summarizeWorkspaceInspection(
  context: LongTableProjectContext,
  state: ResearchState
): LongTableWorkspaceInspection {
  const questions = state.questionLog ?? [];
  const pendingQuestions = questions.filter((record) => record.status === "pending");
  const answeredQuestions = questions.filter((record) => record.status === "answered");
  const pendingObligations = visiblePendingObligations(state);
  const hardStop = collectHardStopBlockers(state);
  const researchSpecificationReadiness = evaluateResearchSpecificationReadiness({
    firstResearchShape: state.firstResearchShape ?? context.session.firstResearchShape,
    researchSpecification: state.researchSpecification ?? context.session.researchSpecification,
    questionLog: state.questionLog,
    questionObligations: state.questionObligations
  });

  return {
    found: true,
    rootPath: context.project.projectPath,
    project: {
      name: context.project.projectName,
      path: context.project.projectPath,
      field: context.project.globalSetupSummary.field,
      careerStage: context.project.globalSetupSummary.careerStage,
      checkpointIntensity: context.project.globalSetupSummary.checkpointIntensity
    },
    session: {
      currentGoal: context.session.currentGoal,
      ...(context.session.currentBlocker ? { currentBlocker: context.session.currentBlocker } : {}),
      requestedPerspectives: context.session.requestedPerspectives,
      disagreementPreference: context.session.disagreementPreference,
      ...(context.session.researchSpecification
        ? {
            researchSpecification: {
              title: context.session.researchSpecification.title,
              status: context.session.researchSpecification.confirmedAt
                ? "confirmed"
                : context.session.researchSpecification.status ?? "draft",
              confidence: context.session.researchSpecification.confidence
            }
          }
        : {})
    },
    files: {
      project: context.projectFilePath,
      session: context.sessionFilePath,
      state: context.stateFilePath,
      current: context.currentFilePath
    },
    counts: {
      invocations: (state.invocationLog ?? []).length,
      questions: questions.length,
      pendingQuestions: pendingQuestions.length,
      pendingObligations: pendingObligations.length,
      stalePendingQuestions: hardStop.stalePendingQuestionCount,
      stalePendingObligations: hardStop.stalePendingObligationCount,
      answeredQuestions: answeredQuestions.length,
      decisions: (state.decisionLog ?? []).length,
      interviewTurns: (state.interviewTurns ?? []).length,
      evidenceRecords: (state.evidenceRecords ?? []).length,
      specPatches: (state.specPatches ?? []).length,
      specRevisions: (state.specRevisions ?? []).length
    },
    hardStop,
    researchSpecificationReadiness,
    recentInvocations: recentInvocationRecords(state, 5).map((record) => ({
      id: record.id,
      kind: record.intent.kind,
      mode: record.intent.mode,
      surface: record.surface,
      status: record.status,
      roles: record.intent.roles,
      linkedQuestions: record.panelResult?.linkedQuestionRecordIds.length ?? 0,
      linkedDecisions: record.panelResult?.linkedDecisionRecordIds.length ?? 0
    })),
    pendingQuestions: pendingQuestions.slice(-5).reverse().map((record) => ({
      id: record.id,
      title: record.prompt.title,
      question: record.prompt.question,
      ...(record.commitmentFamily ? { commitmentFamily: record.commitmentFamily } : {}),
      ...(record.epistemicBasis ? { epistemicBasis: record.epistemicBasis } : {}),
      ...(typeof record.hardStop === "boolean" ? { hardStop: record.hardStop } : {}),
      ...(record.hardStopScope ? { hardStopScope: record.hardStopScope } : {}),
      options: formatQuestionOptionValues(record),
      required: record.prompt.required
    })),
    pendingObligations: pendingObligations.slice(-5).reverse().map((obligation) => ({
      id: obligation.id,
      kind: obligation.kind,
      prompt: obligation.prompt,
      reason: obligation.reason,
      ...(typeof obligation.hardStop === "boolean" ? { hardStop: obligation.hardStop } : {}),
      ...(obligation.hardStopScope ? { hardStopScope: obligation.hardStopScope } : {}),
      ...(obligation.questionId ? { questionId: obligation.questionId } : {})
    })),
    recentDecisions: (state.decisionLog ?? []).slice(-5).reverse().map((record) => ({
      id: record.id,
      checkpointKey: record.checkpointKey,
      summary: record.summary,
      ...(record.commitmentFamily ? { commitmentFamily: record.commitmentFamily } : {}),
      ...(record.epistemicBasis ? { epistemicBasis: record.epistemicBasis } : {}),
      ...(record.selectedOption ? { selectedOption: record.selectedOption } : {}),
      timestamp: record.timestamp
    })),
    answerWarnings: questions
      .filter((record) => record.status === "answered" && record.answer?.selectedValues.includes("other"))
      .flatMap((record) => {
        const raw = record.answer?.otherText ?? record.answer?.selectedLabels[0] ?? "";
        if (!/^\d+$/.test(raw.trim())) {
          return [];
        }
        const index = Number(raw.trim()) - 1;
        const option = record.prompt.options[index];
        return [{
          questionId: record.id,
          ...(record.decisionRecordId ? { decisionRecordId: record.decisionRecordId } : {}),
          issue: `Numeric answer "${raw.trim()}" was stored as other text.`,
          ...(option ? { suggestion: `Use "${option.value}" (${option.label}) for this checkpoint option.` } : {})
        }];
      })
  };
}

function buildProjectAgentsMd(
  project: LongTableProjectRecord,
  session: LongTableSessionRecord
): string {
  return [
    "# AGENTS.md",
    "",
    "This directory is a LongTable research workspace.",
    "",
    "## Runtime Contract",
    "- Treat researcher interaction as the primary task.",
    "- Read `.longtable/current-session.json` before giving substantial guidance.",
    "- Use `.longtable/project.json` as stable project context.",
    "- Use `.longtable/state.json` as layered working memory.",
    "- Prefer `currentGoal`, `currentBlocker`, `nextAction`, and `openQuestions` over generic assumptions.",
    "- Treat `AGENTS.md` as runtime guidance, not as the researcher-facing resume artifact.",
    "",
    "## Invocation Rules",
    "- If the user message starts with `$longtable-start`, run the LongTable research-start flow before generic research advice.",
    "- If the user message starts with `$longtable-interview`, use post-start structured interview only when a usable Research Specification exists; otherwise route to `$longtable-start`.",
    "- If the user message starts with `lt `, `longtable `, `long table `, or `롱테이블 ` followed by a directive and `:`, treat it as an explicit LongTable invocation.",
    "- Supported explicit directives are: interview, explore, review, critique, draft, commit, panel, status, editor, reviewer, methods, theory, measurement, ethics, voice, venue.",
    "- For explicit LongTable invocations, do not begin by scanning the workspace. Use the current session files first and answer as LongTable immediately.",
    "- For general research requests in this workspace, prefer LongTable behavior before generic coding behavior.",
    "",
    "## Research Behavior",
    "- Begin exploratory work with clarifying or tension questions before recommending a direction.",
    "- For `$longtable-start`, ask one natural-language question at a time, reflect with `LongTable hears: ...`, record turns when MCP is available, and avoid early reader/reviewer or theory/method/measurement classification.",
    "- Do not summarize `$longtable-start` because a fixed number of turns has passed; wait for content-based readiness around research object, focal uncertainty, boundary, evidence/material, protected decision, and next action.",
    "- First Research Shape is a short handle/resume index, not the default closure point.",
    "- After the First Research Shape, create a Research Specification when the interview has enough detail to preserve scope, construct ontology, theory framing, coding rules, method options, evidence/access requirements, epistemic alignment, protected decisions, open questions, and next actions.",
    "- If a confirmed First Research Shape exists without a Research Specification, continue directly into the next Research Specification question instead of asking shape-level continue/revise/restart questions.",
    "- If the researcher chooses `ask_one_more` or `revise_section` at Research Specification confirmation, answer that gap and return to the Research Specification Preview before ending the interview.",
    "- Do not let unrelated pending Researcher Checkpoints interrupt `$longtable-start`; mention them only as separate unresolved checkpoints unless the researcher is confirming, saving, or recording a research decision.",
    "- For `$longtable-interview` after a Research Specification exists, use option-first follow-up choices with Other/free-text or one open-question escape hatch.",
    "- Use structured options at the final Research Specification confirmation, at explicit short-handle stop points, or at true checkpoint boundaries.",
    "- If you foreground role perspectives, disclose them with `LongTable consulted: ...`.",
    "- Keep one accountable synthesis, but do not hide meaningful disagreement.",
    ...(session.disagreementPreference === "always_visible"
      ? ["- Panel disagreement should be visible by default rather than hidden behind a single synthesis."]
      : []),
    "- For factual, current, or external claims, provide source links or file references when possible.",
    "- If a statement cannot be sourced, label it as an inference or estimate instead of presenting it as a fact.",
    "- Do not expose internal tool logs, file-search traces, or process commentary in the researcher-facing answer.",
    "",
    "## Scope",
    `- Project: ${project.projectName}`,
    `- Current goal: ${session.currentGoal}`,
    ...(session.currentBlocker ? [`- Current blocker: ${session.currentBlocker}`] : []),
    ...(session.researchObject ? [`- Research object: ${session.researchObject}`] : []),
    ...(session.gapRisk ? [`- Gap/tacit risk: ${session.gapRisk}`] : []),
    ...(session.protectedDecision ? [`- Protected decision: ${session.protectedDecision}`] : []),
    ...(session.firstResearchShape ? [`- First Research Shape: ${session.firstResearchShape.handle}`] : []),
    ...(session.researchSpecification ? [`- Research Specification: ${session.researchSpecification.title}`] : []),
    ...(session.startInterview ? [`- Start interview summary: ${session.startInterview.summary}`] : []),
    `- Requested perspectives: ${session.requestedPerspectives.length > 0 ? session.requestedPerspectives.join(", ") : "auto"}`,
    `- Disagreement visibility: ${session.disagreementPreference}`,
    "- These instructions apply to this directory and its children."
  ].join("\n");
}

function buildStateSeed(
  project: LongTableProjectRecord,
  session: LongTableSessionRecord,
  setup: SetupPersistedOutput
): string {
  const state = createEmptyResearchState() as LongTableWorkspaceState;
  state.explicitState = {
    field: setup.profileSeed.field ?? "unspecified",
    careerStage: setup.profileSeed.careerStage ?? "unspecified",
    experienceLevel: setup.profileSeed.experienceLevel ?? "advanced",
    projectName: project.projectName,
    disagreementPreference: session.disagreementPreference,
    requestedPerspectives: session.requestedPerspectives
  };
  state.workingState = {
    currentGoal: session.currentGoal,
    ...(session.currentBlocker ? { currentBlocker: session.currentBlocker } : {}),
    ...(session.researchObject ? { researchObject: session.researchObject } : {}),
    ...(session.gapRisk ? { gapRisk: session.gapRisk } : {}),
    ...(session.protectedDecision ? { protectedDecision: session.protectedDecision } : {}),
    ...(session.nextAction ? { nextAction: session.nextAction } : {}),
    openQuestions: session.openQuestions ?? [],
    activeModes: session.activeModes ?? [],
    ...(session.startInterview ? { startInterview: session.startInterview } : {}),
    ...(session.resumeHint ? { resumeHint: session.resumeHint } : {})
  };
  if (session.firstResearchShape) {
    state.firstResearchShape = session.firstResearchShape;
    state.workingState.firstResearchShape = session.firstResearchShape;
  }
  if (session.researchSpecification) {
    state.researchSpecification = session.researchSpecification;
    state.workingState.researchSpecification = session.researchSpecification;
  }
  if (session.currentBlocker) {
    state.openTensions.push(session.currentBlocker);
  }
  if (session.gapRisk) {
    state.openTensions.push(`Gap/tacit risk: ${session.gapRisk}`);
  }
  if (setup.profileSeed.humanAuthorshipSignal) {
    state.explicitState.humanAuthorshipSignal = setup.profileSeed.humanAuthorshipSignal;
  }
  state.narrativeTraces.push({
    id: "project-session-goal",
    timestamp: nowIso(),
    source: "longtable-start",
    traceType: "judgment",
    summary: `Current session goal: ${session.currentGoal}.`,
    visibility: "explicit",
    importance: "high"
  });
  if (session.currentBlocker) {
    state.narrativeTraces.push({
      id: "project-session-blocker",
      timestamp: nowIso(),
      source: "longtable-start",
      traceType: "tension",
      summary: `Current session blocker: ${session.currentBlocker}.`,
      visibility: "explicit",
      importance: "high"
    });
  }
  if (session.researchObject || session.gapRisk || session.protectedDecision) {
    state.narrativeTraces.push({
      id: "project-session-risk-profile",
      timestamp: nowIso(),
      source: "longtable-start",
      traceType: "tension",
      summary: [
        session.researchObject ? `Research object: ${session.researchObject}.` : "",
        session.gapRisk ? `Gap/tacit risk: ${session.gapRisk}.` : "",
        session.protectedDecision ? `Protected decision: ${session.protectedDecision}.` : ""
      ].filter(Boolean).join(" "),
      visibility: "explicit",
      importance: "high"
    });
  }
  if (session.startInterview) {
    state.narrativeTraces.push({
      id: "project-session-start-interview",
      timestamp: nowIso(),
      source: "longtable-start",
      traceType: "experience",
      summary: session.startInterview.summary,
      visibility: "explicit",
      importance: "high"
    });
    if (session.startInterview.inferredSignals.length > 0) {
      state.inferredHypotheses.push({
        hypothesis: `Start interview suggests these early lenses: ${session.startInterview.inferredSignals.join(", ")}.`,
        confidence: 0.65,
        evidence: session.startInterview.turns.map((turn) => turn.answer).filter(Boolean),
        status: "unconfirmed"
      });
    }
  }
  return JSON.stringify(state, null, 2);
}

async function removeLegacyRootFiles(projectPath: string): Promise<void> {
  await Promise.all(
    LEGACY_ROOT_FILES.map((file) => rm(join(projectPath, file), { force: true }))
  );
}

export async function syncCurrentWorkspaceView(context: LongTableProjectContext): Promise<string> {
  const state = await loadResearchState(context.stateFilePath);
  const session: LongTableSessionRecord = {
    ...context.session,
    ...(context.session.firstResearchShape ?? state.firstResearchShape
      ? { firstResearchShape: context.session.firstResearchShape ?? state.firstResearchShape }
      : {}),
    ...(context.session.researchSpecification ?? state.researchSpecification
      ? { researchSpecification: context.session.researchSpecification ?? state.researchSpecification }
      : {})
  };
  const body = buildCurrentGuide(
    context.project,
    session,
    recentInvocationRecords(state),
    recentPendingQuestions(state),
    recentPendingObligations(state),
    state
  );
  await writeFile(context.currentFilePath, body, "utf8");
  return context.currentFilePath;
}

function evidenceKindForInvocationRole(role: string | undefined): EvidenceRecord["sourceKind"] {
  const normalized = role?.toLowerCase() ?? "";
  if (normalized.includes("critic")) {
    return "critic";
  }
  if (normalized.includes("reviewer") || normalized.includes("review")) {
    return "reviewer";
  }
  return "panel";
}

function evidenceRecordsForInvocation(invocation: InvocationRecord, timestamp: string): EvidenceRecord[] {
  const records: EvidenceRecord[] = [];
  if (invocation.panelResult) {
    for (const member of invocation.panelResult.memberResults) {
      if (!member.summary && (member.claims ?? []).length === 0 && (member.objections ?? []).length === 0) {
        continue;
      }
      records.push({
        id: createId("evidence"),
        createdAt: timestamp,
        sourceKind: evidenceKindForInvocationRole(member.role),
        sourceId: `${invocation.id}:${member.role}`,
        role: member.role,
        summary: compactLine(member.summary ?? [...(member.claims ?? []), ...(member.objections ?? [])].join(" ")),
        rawText: [
          member.summary ? `Summary: ${member.summary}` : "",
          member.claims?.length ? `Claims: ${member.claims.join("; ")}` : "",
          member.objections?.length ? `Objections: ${member.objections.join("; ")}` : "",
          member.openQuestions?.length ? `Open questions: ${member.openQuestions.join("; ")}` : "",
          member.evidenceRefs?.length ? `Evidence refs: ${member.evidenceRefs.join("; ")}` : ""
        ].filter(Boolean).join("\n"),
        linkedInvocationRecordIds: [invocation.id],
        linkedQuestionRecordIds: invocation.panelResult.linkedQuestionRecordIds,
        linkedDecisionRecordIds: invocation.panelResult.linkedDecisionRecordIds
      });
    }
    if (invocation.panelResult.synthesis || invocation.panelResult.conflictSummary) {
      records.push({
        id: createId("evidence"),
        createdAt: timestamp,
        sourceKind: "panel",
        sourceId: invocation.panelResult.id,
        summary: compactLine(invocation.panelResult.synthesis ?? invocation.panelResult.conflictSummary ?? "Panel result"),
        rawText: [
          invocation.panelResult.synthesis ? `Synthesis: ${invocation.panelResult.synthesis}` : "",
          invocation.panelResult.conflictSummary ? `Conflict: ${invocation.panelResult.conflictSummary}` : ""
        ].filter(Boolean).join("\n"),
        linkedInvocationRecordIds: [invocation.id],
        linkedQuestionRecordIds: invocation.panelResult.linkedQuestionRecordIds,
        linkedDecisionRecordIds: invocation.panelResult.linkedDecisionRecordIds
      });
    }
    return records;
  }

  if (invocation.status === "completed" && invocation.intent.prompt.trim()) {
    records.push({
      id: createId("evidence"),
      createdAt: timestamp,
      sourceKind: "invocation",
      sourceId: invocation.id,
      summary: compactLine(`${invocation.intent.kind}/${invocation.intent.mode}: ${invocation.intent.prompt}`),
      rawText: invocation.intent.prompt,
      linkedInvocationRecordIds: [invocation.id]
    });
  }
  return records;
}

export async function appendInvocationRecordToWorkspace(
  context: LongTableProjectContext,
  invocation: InvocationRecord,
  questions: QuestionRecord[] = []
): Promise<LongTableWorkspaceState> {
  const state = await loadResearchState(context.stateFilePath);
  const withInvocation = appendInvocationToResearchState(state, invocation);
  const updated = questions.length > 0
    ? appendQuestionRecords(withInvocation, questions)
    : withInvocation;
  const evidenceRecords = evidenceRecordsForInvocation(invocation, nowIso());
  const withEvidence = evidenceRecords.length > 0
    ? {
        ...updated,
        evidenceRecords: [...(updated.evidenceRecords ?? []), ...evidenceRecords]
      }
    : updated;
  await writeFile(context.stateFilePath, JSON.stringify(withEvidence, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return withEvidence as LongTableWorkspaceState;
}

function latestPanelInvocation(state: ResearchState): InvocationRecord | undefined {
  return (state.invocationLog ?? [])
    .slice()
    .reverse()
    .find((record) => record.intent.kind === "panel" && record.panelResult);
}

function sanitizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.filter((entry): entry is string => typeof entry === "string");
  return normalized.length > 0 ? normalized : [];
}

function isInvocationStatus(value: unknown): value is InvocationStatus {
  return (
    value === "planned" ||
    value === "running" ||
    value === "completed" ||
    value === "blocked" ||
    value === "degraded" ||
    value === "error"
  );
}

function isInvocationSurface(value: unknown): value is InvocationSurface {
  return (
    value === "native_parallel" ||
    value === "native_subagents" ||
    value === "native_workers" ||
    value === "generated_skill" ||
    value === "prompt_alias" ||
    value === "sequential_fallback" ||
    value === "file_backed_panel_debate" ||
    value === "file_backed_debate" ||
    value === "mcp_transport"
  );
}

function sanitizePanelMemberResult(
  member: Partial<PanelMemberResult> & { role: string },
  fallback?: PanelMemberResult
): PanelMemberResult {
  const label = typeof member.label === "string" && member.label.trim()
    ? member.label
    : fallback?.label ?? member.role;
  const status = isInvocationStatus(member.status)
    ? member.status
    : fallback?.status ?? "completed";
  const claims = sanitizeStringArray(member.claims);
  const objections = sanitizeStringArray(member.objections);
  const openQuestions = sanitizeStringArray(member.openQuestions);
  const evidenceRefs = sanitizeStringArray(member.evidenceRefs);
  return {
    role: member.role,
    label,
    status,
    ...(typeof member.summary === "string" ? { summary: member.summary } : fallback?.summary ? { summary: fallback.summary } : {}),
    ...(claims !== undefined ? { claims } : fallback?.claims ? { claims: fallback.claims } : {}),
    ...(objections !== undefined ? { objections } : fallback?.objections ? { objections: fallback.objections } : {}),
    ...(openQuestions !== undefined ? { openQuestions } : fallback?.openQuestions ? { openQuestions: fallback.openQuestions } : {}),
    ...(evidenceRefs !== undefined ? { evidenceRefs } : fallback?.evidenceRefs ? { evidenceRefs: fallback.evidenceRefs } : {}),
    ...(typeof member.error === "string" ? { error: member.error } : fallback?.error ? { error: fallback.error } : {})
  };
}

function mergePanelMemberResults(
  existing: PanelMemberResult[],
  incoming: Array<Partial<PanelMemberResult> & { role: string }> = []
): PanelMemberResult[] {
  const incomingByRole = new Map(incoming.map((member) => [member.role, member]));
  const merged = existing.map((member) => {
    const update = incomingByRole.get(member.role);
    if (!update) {
      return sanitizePanelMemberResult(member);
    }
    return sanitizePanelMemberResult(update, member);
  });
  const existingRoles = new Set(existing.map((member) => member.role));
  for (const update of incoming) {
    if (existingRoles.has(update.role)) {
      continue;
    }
    merged.push(sanitizePanelMemberResult(update));
  }
  return merged;
}

function removeEvidenceForInvocation(state: ResearchState, invocationId: string): EvidenceRecord[] {
  return (state.evidenceRecords ?? []).filter((record) => {
    const linked = record.linkedInvocationRecordIds ?? [];
    if (!linked.includes(invocationId)) {
      return true;
    }
    return !(record.sourceKind === "panel" || record.sourceId?.startsWith(`${invocationId}:`));
  });
}

export async function recordPanelResultInWorkspace(options: {
  context: LongTableProjectContext;
  result: PanelResultRecordInput;
}): Promise<PanelResultRecordOutput> {
  const state = await loadResearchState(options.context.stateFilePath);
  const targetInvocation = options.result.invocationId
    ? (state.invocationLog ?? []).find((record) => record.id === options.result.invocationId)
    : latestPanelInvocation(state);
  if (!targetInvocation) {
    throw new Error(options.result.invocationId
      ? `No panel invocation found for ${options.result.invocationId}.`
      : "No panel invocation found to record.");
  }
  if (!targetInvocation.panelResult) {
    throw new Error(`Invocation ${targetInvocation.id} does not have a panel result.`);
  }

  if (options.result.status !== undefined && !isInvocationStatus(options.result.status)) {
    throw new Error(`Invalid panel result status: ${String(options.result.status)}.`);
  }
  if (options.result.surface !== undefined && !isInvocationSurface(options.result.surface)) {
    throw new Error(`Invalid panel result surface: ${String(options.result.surface)}.`);
  }

  const timestamp = nowIso();
  const status = options.result.status ?? "completed";
  const surface = options.result.surface ?? targetInvocation.panelResult.surface;
  const updatedInvocation: InvocationRecord = {
    ...targetInvocation,
    updatedAt: timestamp,
    status,
    surface,
    panelResult: {
      ...targetInvocation.panelResult,
      updatedAt: timestamp,
      status,
      surface,
      memberResults: mergePanelMemberResults(
        targetInvocation.panelResult.memberResults,
        options.result.memberResults
      ),
      ...(normalizeOptionalString(options.result.synthesis) ? { synthesis: normalizeOptionalString(options.result.synthesis) } : {}),
      ...(normalizeOptionalString(options.result.conflictSummary) ? { conflictSummary: normalizeOptionalString(options.result.conflictSummary) } : {}),
      ...(normalizeOptionalString(options.result.decisionPrompt) ? { decisionPrompt: normalizeOptionalString(options.result.decisionPrompt) } : {})
    },
    degradationReason: surface === "native_subagents"
      ? "Provider-native subagent execution was recorded as session-dependent; sequential_fallback remains the required fallback."
      : surface === "native_workers"
      ? "LongTable-native worker outputs were recorded as structured panel evidence; runtime state remains under .longtable/panel-runs and hidden reasoning/raw tmux logs stay out of handoff."
      : targetInvocation.degradationReason
  };
  const evidenceRecords = evidenceRecordsForInvocation(updatedInvocation, timestamp);
  const updatedState: LongTableWorkspaceState = {
    ...state,
    invocationLog: (state.invocationLog ?? []).map((record) =>
      record.id === updatedInvocation.id ? updatedInvocation : record
    ),
    evidenceRecords: [...removeEvidenceForInvocation(state, updatedInvocation.id), ...evidenceRecords]
  };

  await writeFile(options.context.stateFilePath, JSON.stringify(updatedState, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);
  return {
    invocation: updatedInvocation,
    evidenceRecords,
    state: updatedState
  };
}

function renderBulletList(values: string[], empty: string): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : [`- ${empty}`];
}

function formatInvocationLine(record: InvocationRecord): string {
  const roles = record.intent.roles.length > 0 ? record.intent.roles.join(", ") : "auto";
  return `${record.intent.kind}/${record.intent.mode} via ${record.surface} (${record.status}); roles: ${roles}`;
}

function renderLatestPanelForHandoff(invocation: InvocationRecord | undefined): string[] {
  if (!invocation?.panelResult) {
    return [
      "## Latest Panel Or Discussion",
      "- No panel invocation is recorded yet.",
      "- Start with `lt panel: <what needs review>` or `longtable panel --prompt \"...\" --json`."
    ];
  }
  const result = invocation.panelResult;
  const workerResultGuidance = result.surface === "native_workers"
    ? [
        "- Native worker note: role-worker outputs have been normalized into this `PanelResult`; use `longtable panel status --run <run_id>` for live worker status when a native worker run id is available.",
        "- Native worker handoff rule: preserve final summaries, claims, objections, open questions, and evidence references; do not paste hidden reasoning, raw tool traces, or tmux logs into the research handoff."
      ]
    : [];
  return [
    "## Latest Panel Or Discussion",
    `- Invocation: ${invocation.id}`,
    `- Record: ${formatInvocationLine(invocation)}`,
    `- Result status: ${result.status}`,
    `- Execution surface: ${result.surface}`,
    ...workerResultGuidance,
    ...(invocation.degradationReason ? [`- Fallback note: ${invocation.degradationReason}`] : []),
    ...(result.synthesis ? [`- Synthesis: ${result.synthesis}`] : []),
    ...(result.conflictSummary ? [`- Conflict summary: ${result.conflictSummary}`] : []),
    ...(result.decisionPrompt ? [`- Decision prompt: ${result.decisionPrompt}`] : []),
    "",
    "### Role Outputs",
    ...result.memberResults.map((member) => {
      const details = [
        member.summary,
        ...(member.claims ?? []).map((claim) => `claim: ${claim}`),
        ...(member.objections ?? []).map((objection) => `objection: ${objection}`),
        ...(member.openQuestions ?? []).map((question) => `open question: ${question}`),
        ...(member.evidenceRefs ?? []).map((ref) => `evidence: ${ref}`),
        ...(member.error ? [`error: ${member.error}`] : [])
      ].filter(Boolean);
      return `- ${member.label} (${member.role}): ${details.length > 0 ? compactLine(details.join("; "), 220) : member.status}`;
    }),
    ...(result.memberResults.some((member) => (member.evidenceRefs ?? []).length > 0)
      ? [
          "",
          "### Role Evidence References",
          ...result.memberResults.flatMap((member) =>
            (member.evidenceRefs ?? []).map((ref) => `- ${member.label} (${member.role}): ${ref}`)
          )
        ]
      : []),
    ...(result.status === "planned"
      ? [
          "",
          "### Missing Persistence Step",
          "- This panel is only planned. After the provider returns role outputs, record them with:",
          `  \`longtable panel record --invocation ${invocation.id} --result-file panel-result.json\``
        ]
      : [])
  ];
}

function renderWorkflowGuidance(context: LongTableProjectContext, latestInvocation: InvocationRecord | undefined): string[] {
  const cwdFlag = `--cwd "${context.project.projectPath.replaceAll("\"", "\\\"")}"`;
  const recordCommand = latestInvocation?.panelResult
    ? `longtable panel record ${cwdFlag} --invocation ${latestInvocation.id} --result-file panel-result.json`
    : `longtable panel ${cwdFlag} --prompt "<panel question>" --json`;
  return [
    "## Continuation Workflow",
    "",
    "### Provider-Neutral Path",
    "Use this when OMX is not installed or when the researcher wants a plain CLI/native-agent workflow.",
    "",
    "1. Open the project in Codex or Claude Code.",
    "2. Use `$longtable-start` if no usable Research Specification exists; otherwise use `$longtable-interview` or `lt panel: ...` for the next bounded decision.",
    "3. When a panel or native worker run produces real role outputs, persist the structured result:",
    `   \`${recordCommand}\``,
    "   Native worker outputs should be final role summaries only: summary, claims, objections, open questions, and evidence refs.",
    "4. Inspect unincorporated evidence:",
    `   \`longtable spec unincorporated ${cwdFlag}\``,
    "5. Propose a Research Specification patch before applying a changed research direction:",
    `   \`longtable spec propose ${cwdFlag} --spec-file updated-spec.json --rationale \"Panel/discussion handoff\"\``,
    "6. Apply only after the researcher confirms the decision:",
    `   \`longtable spec apply ${cwdFlag} --patch-id <spec_patch_id>\``,
    "",
    "### Optional OMX Path",
    "Use this only when OMX is installed. The handoff packet can be pasted into `$ralplan` for a plan/test-spec pass, then `$ralph` can execute the approved work until verification. LongTable should remain the research-state source of truth; OMX is only the execution loop.",
    "",
    "Suggested OMX prompt:",
    "```text",
    "$ralplan: Use the LongTable handoff below as the research-state contract. Produce a PRD/test-spec style execution plan, preserve unresolved panel disagreements, and do not change the Research Specification without a LongTable checkpoint.",
    "```",
    "",
    "Then, after the plan is accepted:",
    "```text",
    "$ralph: Execute the approved LongTable handoff plan. Verify artifacts, then record any panel evidence or spec patch through LongTable commands.",
    "```"
  ];
}

export async function createWorkspaceHandoff(options: {
  context: LongTableProjectContext;
  outputPath?: string;
}): Promise<LongTableHandoffOutput> {
  const state = await loadResearchState(options.context.stateFilePath);
  const createdAt = nowIso();
  const id = createId("handoff");
  const locale = normalizeLocale(options.context.session.locale ?? options.context.project.locale);
  const openQuestions = options.context.session.openQuestions && options.context.session.openQuestions.length > 0
    ? options.context.session.openQuestions
    : buildOpenQuestions(options.context.session);
  const nextAction = options.context.session.nextAction ?? buildNextAction(options.context.session);
  const latestInvocation = latestPanelInvocation(state);
  const pendingQuestions = (state.questionLog ?? []).filter((record) => record.status === "pending");
  const unincorporatedEvidence = (state.evidenceRecords ?? []).filter((record) => !record.incorporatedByRevisionId);
  const proposedPatches = (state.specPatches ?? []).filter((patch) => patch.status === "proposed");
  const outputPath = options.outputPath
    ? resolve(options.outputPath)
    : join(
        options.context.metaDir,
        "handoffs",
        `${id}-${slugify(options.context.session.researchSpecification?.title ?? options.context.project.projectName) || "longtable"}.md`
      );

  const content = [
    "# LongTable Handoff",
    "",
    `Generated: ${createdAt}`,
    `Project: ${options.context.project.projectName}`,
    `Project path: ${options.context.project.projectPath}`,
    "",
    "## Current Objective",
    `- Goal: ${options.context.session.currentGoal}`,
    ...(options.context.session.currentBlocker ? [`- Blocker: ${options.context.session.currentBlocker}`] : []),
    ...(options.context.session.protectedDecision ? [`- Protected decision: ${options.context.session.protectedDecision}`] : []),
    `- Next action: ${nextAction}`,
    "",
    "## Research Specification Status",
    ...(options.context.session.researchSpecification
      ? renderResearchSpecificationSummary(options.context.session.researchSpecification, locale)
      : [
          "- No Research Specification is available yet.",
          "- Start or resume `$longtable-start` before treating the project direction as settled."
        ]),
    "",
    ...renderLatestPanelForHandoff(latestInvocation),
    "",
    "## Pending Researcher Decisions",
    ...renderBulletList(
      pendingQuestions.map((record) => `${record.id}: ${record.prompt.question} (${formatQuestionOptionValues(record).join("/")})`),
      "No pending researcher decision questions."
    ),
    "",
    "## Unincorporated Evidence",
    ...renderBulletList(
      unincorporatedEvidence.slice(-10).reverse().map((record) => `${record.id} [${record.sourceKind}]: ${compactLine(record.summary, 180)}`),
      "No unincorporated evidence records."
    ),
    "",
    "## Proposed Specification Patches",
    ...renderBulletList(
      proposedPatches.map((patch) => `${patch.id}: ${patch.title} (${patch.changes.length} changes)`),
      "No proposed Research Specification patches."
    ),
    "",
    "## Open Questions",
    ...renderBulletList(openQuestions, "No open questions recorded."),
    "",
    ...renderWorkflowGuidance(options.context, latestInvocation),
    "",
    "## Stop Condition",
    "- Stop when the next research decision is either confirmed by the researcher, preserved as an explicit open tension, or represented as a proposed Research Specification patch waiting for confirmation."
  ].join("\n");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${content}\n`, "utf8");
  return {
    id,
    createdAt,
    path: outputPath,
    content,
    sourceEvidenceIds: unincorporatedEvidence.map((record) => record.id),
    pendingQuestionIds: pendingQuestions.map((record) => record.id),
    proposedPatchIds: proposedPatches.map((patch) => patch.id),
    ...(latestInvocation ? { latestInvocationId: latestInvocation.id } : {})
  };
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeInterviewQuality(answer: string, quality?: InterviewTurnQuality): InterviewTurnQuality {
  if (quality) {
    return quality;
  }
  const trimmed = answer.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (trimmed.length < 12 || wordCount < 3) {
    return "thin";
  }
  if (trimmed.length > 80 || wordCount >= 12) {
    return "rich";
  }
  return "usable";
}

function defaultFollowUpQuestion(answer: string): string {
  const trimmed = answer.trim();
  if (trimmed.length < 12) {
    return "Say one more sentence about where this problem appears or why it matters before LongTable tries to classify it.";
  }
  return "What concrete scene, case, material, text, dataset, or decision would make that problem easier to inspect first?";
}

function depthForInterview(turns: LongTableHookRun["turns"] = []): InterviewDepth {
  if (turns.some((turn) => turn.readyToSummarize === true && turn.quality !== "thin")) {
    return "ready_to_summarize";
  }
  const usableTurns = turns.filter((turn) => turn.quality !== "thin").length;
  if (usableTurns >= 1) {
    return "forming_first_handle";
  }
  return "gathering_context";
}

function activeInterviewHook(state: LongTableWorkspaceState, hookId?: string): LongTableHookRun | undefined {
  const hooks = state.hooks ?? [];
  if (hookId) {
    return hooks.find((hook) => hook.id === hookId);
  }
  return [...hooks].reverse().find((hook) =>
    hook.kind === "longtable_interview" &&
    (hook.status === "pending" || hook.status === "active" || hook.status === "ready_to_confirm")
  );
}

function upsertHook(state: LongTableWorkspaceState, hook: LongTableHookRun): LongTableWorkspaceState {
  const hooks = state.hooks ?? [];
  const existingIndex = hooks.findIndex((candidate) => candidate.id === hook.id);
  const nextHooks = existingIndex >= 0
    ? hooks.map((candidate) => candidate.id === hook.id ? hook : candidate)
    : [...hooks, hook];
  return {
    ...state,
    hooks: nextHooks
  };
}

export async function beginLongTableInterview(options: {
  context: LongTableProjectContext;
  provider?: ProviderKind;
  openingQuestion?: string;
  seedAnswer?: string;
}): Promise<{ hook: LongTableHookRun; state: LongTableWorkspaceState }> {
  const state = await loadResearchState(options.context.stateFilePath);
  const existing = activeInterviewHook(state);
  if (existing) {
    return { hook: existing, state };
  }
  const confirmedShape = state.firstResearchShape?.confirmedAt ? state.firstResearchShape : undefined;
  if (confirmedShape) {
    const confirmedHook = [...(state.hooks ?? [])].reverse().find((hook) =>
      hook.kind === "longtable_interview" &&
      hook.status === "confirmed" &&
      hook.firstResearchShape?.handle === confirmedShape.handle
    );
    if (confirmedHook) {
      return { hook: confirmedHook, state };
    }
  }

  const timestamp = nowIso();
  const hook: LongTableHookRun = {
    id: createId("hook_interview"),
    kind: "longtable_interview",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    targetOutcome: "first_research_handle",
    depth: "gathering_context",
    provider: options.provider,
    turns: [],
    qualityNotes: [],
    rationale: [
      "Official LongTable research start surface is provider-native `$longtable-start`, not the CLI start questionnaire.",
      "The hook keeps early research ambiguity open until a first research handle can be summarized."
    ]
  };

  let updated = upsertHook(state, hook);
  updated.workingState = {
    ...updated.workingState,
    activeInterviewHookId: hook.id,
    interviewSurface: "$longtable-start",
    ...(options.openingQuestion ? { interviewOpeningQuestion: options.openingQuestion } : {}),
    ...(options.seedAnswer ? { interviewSeedAnswer: options.seedAnswer } : {})
  };
  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);
  return { hook, state: updated };
}

export async function appendLongTableInterviewTurn(options: {
  context: LongTableProjectContext;
  hookId?: string;
  question: string;
  answer: string;
  reflection?: string;
  quality?: InterviewTurnQuality;
  needsFollowUp?: boolean;
  followUpQuestion?: string;
  readyToSummarize?: boolean;
  readinessRationale?: string[];
  rationale?: string[];
}): Promise<{ hook: LongTableHookRun; turn: NonNullable<LongTableHookRun["turns"]>[number]; state: LongTableWorkspaceState }> {
  const state = await loadResearchState(options.context.stateFilePath);
  const existing = activeInterviewHook(state, options.hookId);
  if (!existing) {
    throw new Error("No active LongTable interview hook was found. Run begin_interview first.");
  }

  const quality = normalizeInterviewQuality(options.answer, options.quality);
  const needsFollowUp = options.needsFollowUp ?? quality === "thin";
  const followUpQuestion = needsFollowUp
    ? options.followUpQuestion ?? defaultFollowUpQuestion(options.answer)
    : options.followUpQuestion;
  const readyToSummarize = options.readyToSummarize === true && quality !== "thin";
  const readinessRationale = options.readinessRationale
    ?.map((rationale) => rationale.trim())
    .filter(Boolean);
  const timestamp = nowIso();
  const turns = existing.turns ?? [];
  const turn = {
    id: createId("interview_turn"),
    index: turns.length + 1,
    createdAt: timestamp,
    question: options.question.trim(),
    answer: options.answer.trim(),
    ...(options.reflection?.trim() ? { reflection: options.reflection.trim() } : {}),
    quality,
    needsFollowUp,
    ...(followUpQuestion?.trim() ? { followUpQuestion: followUpQuestion.trim() } : {}),
    ...(readyToSummarize ? { readyToSummarize } : {}),
    ...(readinessRationale && readinessRationale.length > 0 ? { readinessRationale } : {}),
    ...(options.rationale && options.rationale.length > 0 ? { rationale: options.rationale } : {})
  };
  const nextTurns = [...turns, turn];
  const depth = depthForInterview(nextTurns);
  const hook: LongTableHookRun = {
    ...existing,
    status: depth === "ready_to_summarize" ? "ready_to_confirm" : "active",
    updatedAt: timestamp,
    depth,
    turns: nextTurns,
    qualityNotes: [
      ...(existing.qualityNotes ?? []),
      ...(needsFollowUp ? [`Turn ${turn.index} needs follow-up: ${followUpQuestion}`] : []),
      ...(readyToSummarize
        ? [`Turn ${turn.index} marked ready to summarize: ${(readinessRationale ?? ["content-based readiness signal"]).join("; ")}`]
        : [])
    ]
  };
  const evidence: EvidenceRecord = {
    id: createId("evidence"),
    createdAt: timestamp,
    sourceKind: "interview_turn",
    sourceId: turn.id,
    sourceHookId: existing.id,
    summary: compactLine(`Interview turn ${turn.index}: ${turn.answer}`),
    rawText: [
      `Question: ${turn.question}`,
      `Answer: ${turn.answer}`,
      turn.reflection ? `Reflection: ${turn.reflection}` : ""
    ].filter(Boolean).join("\n")
  };
  const updated = {
    ...upsertHook(state, hook),
    interviewTurns: [...(state.interviewTurns ?? []), turn],
    evidenceRecords: [...(state.evidenceRecords ?? []), evidence]
  };
  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);
  return { hook, turn, state: updated };
}

export async function summarizeLongTableInterview(options: {
  context: LongTableProjectContext;
  hookId?: string;
  shape: FirstResearchShape;
}): Promise<{ hook: LongTableHookRun; shape: FirstResearchShape; state: LongTableWorkspaceState; session: LongTableSessionRecord }> {
  const state = await loadResearchState(options.context.stateFilePath);
  const existing = activeInterviewHook(state, options.hookId);
  if (!existing) {
    throw new Error("No active LongTable interview hook was found. Run begin_interview first.");
  }

  const timestamp = nowIso();
  const shape: FirstResearchShape = {
    ...options.shape,
    handle: options.shape.handle.trim(),
    currentGoal: options.shape.currentGoal.trim(),
    openQuestions: options.shape.openQuestions.map((question) => question.trim()).filter(Boolean),
    nextAction: options.shape.nextAction.trim(),
    sourceHookId: existing.id
  };
  const hook: LongTableHookRun = {
    ...existing,
    status: "ready_to_confirm",
    updatedAt: timestamp,
    depth: "ready_to_summarize",
    firstResearchShape: shape
  };
  const session: LongTableSessionRecord = {
    ...options.context.session,
    lastUpdatedAt: timestamp,
    currentGoal: shape.currentGoal,
    ...(shape.currentBlocker ? { currentBlocker: shape.currentBlocker } : {}),
    ...(shape.researchObject ? { researchObject: shape.researchObject } : {}),
    ...(shape.gapRisk ? { gapRisk: shape.gapRisk } : {}),
    ...(shape.protectedDecision ? { protectedDecision: shape.protectedDecision } : {}),
    nextAction: shape.nextAction,
    openQuestions: shape.openQuestions,
    firstResearchShape: shape,
    resumeHint: `I want to continue from the First Research Shape: ${shape.handle}.`
  };
  options.context.session = session;

  let updated = upsertHook(state, hook);
  updated.firstResearchShape = shape;
  updated.workingState = {
    ...updated.workingState,
    currentGoal: shape.currentGoal,
    ...(shape.currentBlocker ? { currentBlocker: shape.currentBlocker } : {}),
    ...(shape.researchObject ? { researchObject: shape.researchObject } : {}),
    ...(shape.gapRisk ? { gapRisk: shape.gapRisk } : {}),
    ...(shape.protectedDecision ? { protectedDecision: shape.protectedDecision } : {}),
    openQuestions: shape.openQuestions,
    nextAction: shape.nextAction,
    firstResearchShape: shape
  };
  if (shape.currentBlocker && !updated.openTensions.includes(shape.currentBlocker)) {
    updated.openTensions.push(shape.currentBlocker);
  }
  updated.narrativeTraces.push({
    id: createId("narrative_trace"),
    timestamp,
    source: "$longtable-start",
    traceType: "judgment",
    summary: `First Research Shape: ${shape.handle}.`,
    visibility: "explicit",
    importance: shape.confidence
  });

  await writeFile(options.context.sessionFilePath, JSON.stringify(session, null, 2), "utf8");
  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);
  return { hook, shape, state: updated, session };
}

function normalizeStringArray(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeResearchSpecification(
  input: ResearchSpecification,
  sourceHookId: string | undefined,
  timestamp: string
): ResearchSpecification {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Research Specification title is required.");
  }
  const purpose = input.researchDirection.purpose.trim();
  if (!purpose) {
    throw new Error("Research Specification researchDirection.purpose is required.");
  }

  return {
    title,
    status: input.confirmedAt ? "confirmed" : input.status ?? "draft",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
    ...(sourceHookId ? { sourceHookId } : {}),
    researchDirection: {
      ...(normalizeOptionalString(input.researchDirection.question) ? { question: normalizeOptionalString(input.researchDirection.question) } : {}),
      purpose,
      ...(normalizeOptionalString(input.researchDirection.scopeBoundary) ? { scopeBoundary: normalizeOptionalString(input.researchDirection.scopeBoundary) } : {}),
      inclusionCriteria: normalizeStringArray(input.researchDirection.inclusionCriteria),
      exclusionCriteria: normalizeStringArray(input.researchDirection.exclusionCriteria)
    },
    constructOntology: {
      coreConstructs: normalizeStringArray(input.constructOntology.coreConstructs),
      distinctions: normalizeStringArray(input.constructOntology.distinctions),
      termsToAvoidCollapsing: normalizeStringArray(input.constructOntology.termsToAvoidCollapsing)
    },
    theoryAndFraming: {
      anchors: normalizeStringArray(input.theoryAndFraming.anchors),
      alternatives: normalizeStringArray(input.theoryAndFraming.alternatives),
      overreachRisks: normalizeStringArray(input.theoryAndFraming.overreachRisks)
    },
    measurementCoding: {
      variablesOrConstructs: normalizeStringArray(input.measurementCoding.variablesOrConstructs),
      evidenceTypes: normalizeStringArray(input.measurementCoding.evidenceTypes),
      codingRules: normalizeStringArray(input.measurementCoding.codingRules),
      openStandards: normalizeStringArray(input.measurementCoding.openStandards)
    },
    methodAnalysis: {
      ...(normalizeOptionalString(input.methodAnalysis.design) ? { design: normalizeOptionalString(input.methodAnalysis.design) } : {}),
      analysisOptions: normalizeStringArray(input.methodAnalysis.analysisOptions),
      dataSufficiencyCriteria: normalizeStringArray(input.methodAnalysis.dataSufficiencyCriteria),
      unsettledChoices: normalizeStringArray(input.methodAnalysis.unsettledChoices)
    },
    evidenceAccess: {
      requiredSources: normalizeStringArray(input.evidenceAccess.requiredSources),
      accessRequirements: normalizeStringArray(input.evidenceAccess.accessRequirements),
      evidenceStandards: normalizeStringArray(input.evidenceAccess.evidenceStandards)
    },
    epistemicAlignment: {
      researcherKnowledge: normalizeStringArray(input.epistemicAlignment.researcherKnowledge),
      projectStatePriority: normalizeStringArray(input.epistemicAlignment.projectStatePriority),
      aiInferenceLimits: normalizeStringArray(input.epistemicAlignment.aiInferenceLimits),
      ...(normalizeOptionalString(input.epistemicAlignment.conflictResolutionRule)
        ? { conflictResolutionRule: normalizeOptionalString(input.epistemicAlignment.conflictResolutionRule) }
        : {})
    },
    protectedDecisions: normalizeStringArray(input.protectedDecisions),
    openQuestions: normalizeStringArray(input.openQuestions),
    nextActions: normalizeStringArray(input.nextActions),
    confidence: input.confidence,
    ...(input.confirmedAt ? { confirmedAt: input.confirmedAt } : {})
  };
}

export async function summarizeLongTableResearchSpecification(options: {
  context: LongTableProjectContext;
  hookId?: string;
  specification: ResearchSpecification;
}): Promise<{ hook?: LongTableHookRun; specification: ResearchSpecification; state: LongTableWorkspaceState; session: LongTableSessionRecord }> {
  const state = await loadResearchState(options.context.stateFilePath);
  const sourceHookId = options.hookId
    ?? options.specification.sourceHookId
    ?? state.firstResearchShape?.sourceHookId;
  const existing = sourceHookId
    ? (state.hooks ?? []).find((hook) => hook.id === sourceHookId)
    : activeInterviewHook(state);
  const timestamp = nowIso();
  const specification = normalizeResearchSpecification(
    options.specification,
    existing?.id ?? sourceHookId,
    timestamp
  );
  const hook = existing
    ? {
        ...existing,
        status: "ready_to_confirm" as const,
        updatedAt: timestamp,
        researchSpecification: specification
      }
    : undefined;
  const session: LongTableSessionRecord = {
    ...options.context.session,
    lastUpdatedAt: timestamp,
    researchSpecification: specification,
    resumeHint: `I want to continue from the Research Specification: ${specification.title}.`
  };
  options.context.session = session;

  const sourceEvidenceIds = (state.evidenceRecords ?? [])
    .filter((record) => record.sourceHookId && record.sourceHookId === (existing?.id ?? sourceHookId))
    .map((record) => record.id);
  const audited = applyResearchSpecificationAuditUpdate(
    hook ? upsertHook(state, hook) : state,
    {
      specification,
      timestamp,
      source: "interview",
      title: `Research Specification draft: ${specification.title}`,
      rationale: "Stored or refreshed the required Research Specification from LongTable interview evidence.",
      sourceEvidenceIds
    }
  );
  let updated = audited.state;
  updated.narrativeTraces.push({
    id: createId("narrative_trace"),
    timestamp,
    source: "$longtable-start",
    traceType: "judgment",
    summary: `Research Specification draft: ${specification.title}.`,
    visibility: "explicit",
    importance: specification.confidence
  });

  await writeFile(options.context.sessionFilePath, JSON.stringify(session, null, 2), "utf8");
  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);
  return { hook, specification, state: updated, session };
}

export async function proposeResearchSpecificationPatch(options: {
  context: LongTableProjectContext;
  specification: ResearchSpecification;
  source?: ResearchSpecificationPatchSource;
  rationale?: string;
  sourceEvidenceIds?: string[];
}): Promise<{ patch: ResearchSpecificationPatch; changes: ResearchSpecificationChange[]; state: LongTableWorkspaceState }> {
  const state = await loadResearchState(options.context.stateFilePath);
  const timestamp = nowIso();
  const specification = normalizeResearchSpecification(
    options.specification,
    options.specification.sourceHookId ?? state.researchSpecification?.sourceHookId,
    timestamp
  );
  const sourceEvidenceIds = mergeStringLists(
    options.specification.sourceEvidenceIds,
    specification.sourceEvidenceIds,
    options.sourceEvidenceIds
  );
  const changes = diffResearchSpecifications(state.researchSpecification, specification)
    .map((change) => ({
      ...change,
      evidenceRecordIds: sourceEvidenceIds
    }));
  const patch: ResearchSpecificationPatch = {
    id: createId("spec_patch"),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "proposed",
    source: options.source ?? "manual",
    title: `Proposed Research Specification update: ${specification.title}`,
    ...(options.rationale ? { rationale: options.rationale } : {}),
    changes,
    sourceEvidenceIds,
    targetSpecification: specification
  };
  const updated: LongTableWorkspaceState = {
    ...state,
    specPatches: [...(state.specPatches ?? []), patch]
  };
  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);
  return { patch, changes, state: updated };
}

export async function applyResearchSpecificationPatch(options: {
  context: LongTableProjectContext;
  patchId?: string;
  specification?: ResearchSpecification;
  source?: ResearchSpecificationPatchSource;
  rationale?: string;
  sourceEvidenceIds?: string[];
  questionRecordId?: string;
  decisionRecordId?: string;
}): Promise<{
  patch: ResearchSpecificationPatch;
  revision: ResearchSpecificationRevision;
  specification: ResearchSpecification;
  state: LongTableWorkspaceState;
  session: LongTableSessionRecord;
  decision?: DecisionRecord;
}> {
  const state = await loadResearchState(options.context.stateFilePath);
  const timestamp = nowIso();
  const storedPatch = options.patchId
    ? (state.specPatches ?? []).find((patch) => patch.id === options.patchId)
    : undefined;
  if (options.patchId && !storedPatch) {
    throw new Error(`No Research Specification patch found for ${options.patchId}.`);
  }
  const inputSpecification = options.specification ?? (storedPatch?.targetSpecification as ResearchSpecification | undefined);
  if (!inputSpecification) {
    throw new Error(options.patchId ? `No target Research Specification found for patch ${options.patchId}.` : "Research Specification is required when no patchId is supplied.");
  }
  const specification = normalizeResearchSpecification(
    inputSpecification,
    inputSpecification.sourceHookId ?? state.researchSpecification?.sourceHookId,
    timestamp
  );
  const audited = applyResearchSpecificationAuditUpdate(state, {
    specification,
    timestamp,
    source: options.source ?? storedPatch?.source ?? "manual",
    title: storedPatch?.title ?? `Applied Research Specification update: ${specification.title}`,
    rationale: options.rationale ?? storedPatch?.rationale,
    sourceEvidenceIds: mergeStringLists(storedPatch?.sourceEvidenceIds, options.sourceEvidenceIds),
    patch: storedPatch,
    questionRecordId: options.questionRecordId ?? storedPatch?.questionRecordId,
    decisionRecordId: options.decisionRecordId ?? storedPatch?.decisionRecordId
  });
  const session: LongTableSessionRecord = {
    ...options.context.session,
    researchSpecification: audited.specification,
    lastUpdatedAt: timestamp,
    resumeHint: `I want to continue from the Research Specification: ${audited.specification.title}.`
  };
  options.context.session = session;
  await writeFile(options.context.sessionFilePath, JSON.stringify(session, null, 2), "utf8");
  await writeFile(options.context.stateFilePath, JSON.stringify(audited.state, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);
  return {
    patch: audited.patch,
    revision: audited.revision,
    specification: audited.specification,
    state: audited.state,
    session,
    ...(audited.decision ? { decision: audited.decision } : {})
  };
}

export async function readResearchSpecificationHistory(context: LongTableProjectContext): Promise<{
  specification?: ResearchSpecification;
  revisions: ResearchSpecificationRevision[];
  patches: ResearchSpecificationPatch[];
  evidenceRecords: EvidenceRecord[];
}> {
  const state = await loadResearchState(context.stateFilePath);
  return {
    ...(state.researchSpecification ? { specification: state.researchSpecification } : {}),
    revisions: state.specRevisions ?? [],
    patches: state.specPatches ?? [],
    evidenceRecords: state.evidenceRecords ?? []
  };
}

export async function findUnincorporatedResearchEvidence(context: LongTableProjectContext): Promise<EvidenceRecord[]> {
  const state = await loadResearchState(context.stateFilePath);
  return (state.evidenceRecords ?? []).filter((record) => !record.incorporatedByRevisionId);
}

function findQuestionForDecision(
  state: ResearchState,
  questionId?: string
): QuestionRecord | null {
  const pending = (state.questionLog ?? []).filter((record) => record.status === "pending");
  if (questionId) {
    return pending.find((record) => record.id === questionId) ?? null;
  }
  return pending.at(-1) ?? null;
}

function findPendingQuestionForClear(
  state: ResearchState,
  questionId: string
): QuestionRecord | null {
  return (state.questionLog ?? []).find((record) => record.id === questionId && record.status === "pending") ?? null;
}

function pendingRequiredQuestions(state: ResearchState): QuestionRecord[] {
  return (state.questionLog ?? []).filter(
    (record) => record.status === "pending" && record.prompt.required
  );
}

export async function listBlockingWorkspaceQuestions(
  context: LongTableProjectContext
): Promise<QuestionRecord[]> {
  const state = await loadResearchState(context.stateFilePath);
  return pendingRequiredQuestions(state);
}

export async function listBlockingWorkspaceObligations(
  context: LongTableProjectContext
): Promise<LongTableQuestionObligation[]> {
  const state = await loadResearchState(context.stateFilePath);
  return pendingQuestionObligations(state);
}

export async function assertWorkspaceNotBlocked(context: LongTableProjectContext): Promise<void> {
  const [blockingQuestions, blockingObligations] = await Promise.all([
    listBlockingWorkspaceQuestions(context),
    listBlockingWorkspaceObligations(context)
  ]);
  if (blockingQuestions.length > 0) {
    const first = blockingQuestions[0];
    const options = formatQuestionOptionValues(first).join("/");
    throw new Error(
      [
        `LongTable is blocked by a required Researcher Checkpoint: ${first.id}`,
        first.prompt.question,
        `Options: ${options}`,
        `Record an answer with: longtable decide --question ${first.id} --answer <value>`
      ].join("\n")
    );
  }

  if (blockingObligations.length > 0) {
    const first = blockingObligations[0];
    throw new Error(
      [
        `LongTable is blocked by a pending research obligation: ${first.id}`,
        first.prompt,
        first.reason,
        ...(first.questionId
          ? [`If a question was already issued, answer it with: longtable decide --question ${first.questionId} --answer <value>`]
          : ["Resume the LongTable interview and answer the next researcher-facing checkpoint before proceeding."])
      ].join("\n")
    );
  }
}

function questionTitleForCheckpoint(family: string, checkpointKey?: string): string {
  if (checkpointKey === "knowledge_gap_probe") {
    return "Knowledge-gap checkpoint";
  }
  if (checkpointKey === "tacit_assumption_probe") {
    return "Tacit-assumption checkpoint";
  }
  if (checkpointKey === "panel_disagreement_resolution") {
    return "Panel-disagreement checkpoint";
  }
  switch (family) {
    case "meta_decision":
      return "Meta-decision checkpoint";
    case "submission":
      return "Submission checkpoint";
    case "commitment":
      return "Research commitment checkpoint";
    case "evidence":
      return "Evidence checkpoint";
    case "authorship":
      return "Authorship checkpoint";
    case "review":
      return "Review checkpoint";
    case "exploration":
      return "Exploration checkpoint";
    default:
      return "Researcher Checkpoint";
  }
}

function questionTextForCheckpoint(family: string, prompt: string, checkpointKey?: string): string {
  if (checkpointKey === "knowledge_gap_probe") {
    return "What knowledge gap should LongTable make explicit before narrowing or recommending a direction?";
  }
  if (checkpointKey === "tacit_assumption_probe") {
    return "What tacit assumption should LongTable surface before treating this direction as acceptable?";
  }
  if (checkpointKey === "panel_disagreement_resolution") {
    return "How should LongTable handle the unresolved panel disagreement before turning it into one synthesis?";
  }
  switch (family) {
    case "meta_decision":
      return "What should LongTable do before treating this platform decision as settled?";
    case "submission":
      return "What must happen before this work can move toward external release or submission?";
    case "commitment":
      return "What should LongTable treat as the human research commitment here?";
    case "evidence":
      return "How should LongTable handle the evidence risk before using this claim?";
    case "authorship":
      return "What should LongTable preserve before changing the researcher's voice or authorship trace?";
    case "exploration":
      return "What ambiguity should LongTable keep open before recommending a direction?";
    default:
      return `What should LongTable decide before proceeding with: ${prompt}`;
  }
}

function optionsForCheckpointTrigger(family: string, checkpointKey?: string): QuestionOption[] {
  if (checkpointKey === "knowledge_gap_probe") {
    return [
      { value: "ask_first", label: "Ask the gap question first", description: "Pause synthesis and make the missing knowledge explicit." },
      { value: "gather_context", label: "Gather context first", description: "Inspect sources, files, or constraints before narrowing." },
      { value: "proceed_tentatively", label: "Proceed tentatively", description: "Continue, but keep the knowledge gap visible as an open tension." },
      { value: "defer", label: "Keep the gap open", description: "Do not convert the uncertainty into a recommendation yet." }
    ];
  }

  if (checkpointKey === "tacit_assumption_probe") {
    return [
      { value: "surface_assumption", label: "Surface the assumption first", description: "Name the implicit premise before accepting the direction." },
      { value: "test_assumption", label: "Test the assumption first", description: "Look for evidence or counterexamples before proceeding." },
      { value: "proceed_with_risk", label: "Proceed while logging the risk", description: "Continue, but record the assumption as unresolved." },
      { value: "defer", label: "Keep the assumption open", description: "Do not treat this framing as settled yet." }
    ];
  }

  if (checkpointKey === "panel_disagreement_resolution") {
    return [
      { value: "surface_disagreement", label: "Surface disagreement first", description: "Show the role conflict before choosing a synthesis." },
      { value: "compare_frames", label: "Compare candidate framings", description: "Keep alternatives visible before selecting one frame." },
      { value: "proceed_with_trace", label: "Proceed with an explicit trace", description: "Choose a synthesis, but record the unresolved disagreement." },
      { value: "defer", label: "Keep disagreement open", description: "Do not collapse the disagreement into one conclusion yet." }
    ];
  }

  if (family === "evidence") {
    return [
      { value: "verify", label: "Verify evidence first", description: "Check whether the source supports the specific claim." },
      { value: "limit", label: "Limit the claim", description: "Keep the point but narrow it to what the evidence can support." },
      { value: "rewrite", label: "Rewrite without the claim", description: "Avoid relying on the uncertain citation or claim." },
      { value: "defer", label: "Keep evidence risk open", description: "Do not settle the claim yet." }
    ];
  }

  if (family === "meta_decision") {
    return [
      { value: "revise", label: "Revise the platform decision", description: "Change the term, policy, or README positioning before treating it as settled." },
      { value: "evidence", label: "Gather implementation evidence first", description: "Inspect behavior or docs before committing the platform decision." },
      { value: "proceed", label: "Proceed with current decision", description: "Accept the current platform framing and continue." },
      { value: "defer", label: "Keep the decision open", description: "Do not make this platform language authoritative yet." }
    ];
  }

  if (family === "submission") {
    return [
      { value: "review", label: "Review risk first", description: "Check claims, ethics, venue fit, or study contract before external release." },
      { value: "evidence", label: "Verify evidence first", description: "Confirm source support before submission or public sharing." },
      { value: "proceed", label: "Proceed toward submission", description: "Accept the remaining risk and continue." },
      { value: "defer", label: "Do not submit yet", description: "Keep the submission decision open." }
    ];
  }

  if (family === "authorship") {
    return [
      { value: "preserve_voice", label: "Preserve the researcher's voice", description: "Keep the current authorship trace visible before rewriting or smoothing." },
      { value: "revise_with_trace", label: "Revise with an explicit authorship trace", description: "Change the text, but record what came from the researcher." },
      { value: "ask_researcher", label: "Ask the researcher for wording first", description: "Do not infer the intended voice or narrative stance." },
      { value: "defer", label: "Keep authorship open", description: "Do not settle the voice or authorship decision yet." }
    ];
  }

  if (family === "exploration") {
    return [
      { value: "surface_tensions", label: "Surface tensions first", description: "Ask what is unresolved before narrowing the project." },
      { value: "narrow_scope", label: "Narrow the research scope", description: "Move toward a smaller question while keeping the choice visible." },
      { value: "gather_context", label: "Gather context before narrowing", description: "Check materials, constraints, or evidence before choosing a direction." },
      { value: "defer", label: "Keep exploration open", description: "Do not collapse the problem space yet." }
    ];
  }

  if (family === "review") {
    return [
      { value: "revise", label: "Revise before accepting the review", description: "Change the claim, design, or draft before treating the critique as resolved." },
      { value: "evidence", label: "Check evidence for the objection", description: "Verify whether the review concern is actually supported." },
      { value: "proceed", label: "Proceed while logging the risk", description: "Accept the objection profile and continue with the decision recorded." },
      { value: "defer", label: "Keep the objection open", description: "Do not convert the review into closure yet." }
    ];
  }

  if (family === "commitment") {
    if (checkpointKey === "research_question_freeze") {
      return [
        { value: "revise", label: "Revise the research question", description: "Change the framing before treating the question as settled." },
        { value: "scope", label: "Choose the scope boundary", description: "Commit only the boundary, not the full study design." },
        { value: "evidence", label: "Gather support before freezing", description: "Check literature, feasibility, or data fit before locking the question." },
        { value: "defer", label: "Keep the question open", description: "Do not freeze the research question yet." }
      ];
    }

    if (checkpointKey === "theory_selection") {
      return [
        { value: "revise", label: "Revise the theory anchor", description: "Change the conceptual frame before treating it as settled." },
        { value: "compare", label: "Compare candidate theories first", description: "Keep alternatives visible before choosing one anchor." },
        { value: "evidence", label: "Check construct fit first", description: "Verify that the theory supports the constructs and claims." },
        { value: "defer", label: "Keep theory selection open", description: "Do not commit to a theory anchor yet." }
      ];
    }

    if (checkpointKey === "method_design_commitment") {
      return [
        { value: "revise", label: "Revise the study design", description: "Change method, sample, or design before treating it as settled." },
        { value: "ethics", label: "Check participant and ethics implications", description: "Pause for consent, representation, or trust concerns." },
        { value: "evidence", label: "Check feasibility and evidence first", description: "Verify that the method can support the intended claims." },
        { value: "defer", label: "Keep method design open", description: "Do not commit the design yet." }
      ];
    }

    if (checkpointKey === "measurement_validity") {
      return [
        { value: "revise", label: "Revise the measurement plan", description: "Change scales, constructs, or instruments before treating them as settled." },
        { value: "evidence", label: "Verify construct validity first", description: "Check whether the instrument supports the construct." },
        { value: "pilot", label: "Pilot or inspect the measure", description: "Gather local evidence before committing the measurement." },
        { value: "defer", label: "Keep measurement open", description: "Do not settle the measurement plan yet." }
      ];
    }

    if (checkpointKey === "analysis_plan") {
      return [
        { value: "revise", label: "Revise the analysis plan", description: "Change model, coding, or inference strategy before committing." },
        { value: "assumptions", label: "Check assumptions first", description: "Inspect data, model assumptions, or coding validity before closure." },
        { value: "evidence", label: "Verify analysis fit", description: "Confirm the analysis can answer the research question." },
        { value: "defer", label: "Keep analysis open", description: "Do not commit the analysis plan yet." }
      ];
    }
  }

  return [
    { value: "revise", label: "Revise before proceeding", description: "Change the framing, design, or draft before treating this as settled." },
    { value: "evidence", label: "Gather or verify evidence first", description: "Do not proceed until the relevant evidence is checked." },
    { value: "proceed", label: "Proceed with current direction", description: "Accept the risk profile and continue." },
    { value: "defer", label: "Keep this open", description: "Do not commit yet; keep the issue visible as an open tension." }
  ];
}

type FollowUpQuestionSpec = QuestionOpportunity;

interface BuildFollowUpQuestionOptions {
  includeFallback?: boolean;
  autoOnly?: boolean;
  requiredOnly?: boolean;
}

function includesAny(prompt: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(prompt));
}

function questionPriority(spec: FollowUpQuestionSpec): number {
  const byKey: Record<string, number> = {
    protected_decision_closure: 100,
    research_direction_change_commitment: 96,
    construct_boundary_commitment: 94,
    measurement_coding_standard: 92,
    analysis_strategy_commitment: 90,
    theory_frame_commitment: 88,
    method_design_commitment: 86,
    research_scope_boundary: 84,
    epistemic_alignment_boundary: 82,
    value_conflict_boundary: 80,
    source_authority: 70,
    knowledge_gap_probe: 68,
    tacit_assumption_probe: 66,
    needed_question_policy: 60,
    philosophical_checkpoint_boundary: 58,
    harness_question_harness: 55
  };
  const confidenceWeight = spec.confidence === "high" ? 10 : spec.confidence === "medium" ? 5 : 0;
  const requiredWeight = spec.kind === "research_commitment" || spec.required ? 20 : 0;
  return (byKey[spec.key] ?? 0) + confidenceWeight + requiredWeight;
}

function followUpQuestionOptions(
  first: QuestionOption,
  second: QuestionOption,
  third: QuestionOption,
  ...rest: QuestionOption[]
): QuestionOption[] {
  return [first, second, third, ...rest];
}

export function buildQuestionOpportunitySpecs(
  prompt: string,
  options: BuildFollowUpQuestionOptions = {}
): FollowUpQuestionSpec[] {
  const normalized = prompt.toLowerCase();
  const specs: FollowUpQuestionSpec[] = [];

  function push(
    spec: Omit<FollowUpQuestionSpec, "required" | "confidence" | "autoEligible" | "cues"> &
      Partial<Pick<FollowUpQuestionSpec, "required" | "confidence" | "autoEligible" | "cues">>
  ): void {
    if (!specs.some((candidate) => candidate.key === spec.key)) {
      specs.push({
        required: false,
        confidence: "medium",
        autoEligible: false,
        cues: [],
        ...spec
      });
    }
  }

  const decisionActionCue = includesAny(normalized, [
    /\b(final|finalize|commit|decide|settle|freeze|lock|record|apply|incorporate|change|revise|update|replace|reframe|modify|alter)\b/i,
    /최종|확정|결정|고정|기록|반영|바꾸|변경|수정|교체|전환|재설정/
  ]);
  const scopeCue = includesAny(normalized, [
    /\bresearch question\b/i,
    /\bresearch direction\b/i,
    /\bscope\b/i,
    /\bboundary\b/i,
    /\binclusion criteria\b/i,
    /\bexclusion criteria\b/i,
    /연구\s*질문|연구\s*문제|연구\s*방향|범위|경계|포함\s*기준|제외\s*기준/
  ]);
  const theoryCue = includesAny(normalized, [
    /\btheory\b/i,
    /\bframework\b/i,
    /\bconceptual model\b/i,
    /\bconstruct map\b/i,
    /이론|프레임워크|개념\s*모형|구성개념\s*지도|컨스트럭트/
  ]);
  const measurementCodingCue = includesAny(normalized, [
    /\bmeasure\b/i,
    /\bmeasurement\b/i,
    /\bscale\b/i,
    /\binstrument\b/i,
    /\bcoding\b/i,
    /\bcoding rule\b/i,
    /\bextraction rule\b/i,
    /\boperationali[sz]ation\b/i,
    /측정|척도|도구|코딩|코딩\s*규칙|코딩\s*기준|추출\s*규칙|추출\s*기준|조작화/
  ]);
  const methodCue = includesAny(normalized, [
    /\bmethod\b/i,
    /\bmethodology\b/i,
    /\bstudy design\b/i,
    /\bsampling\b/i,
    /\bsample\b/i,
    /방법론|방법|연구\s*설계|표본|샘플링/
  ]);
  const analysisCue = includesAny(normalized, [
    /\banalysis plan\b/i,
    /\banalysis method\b/i,
    /\bmeta[- ]?analysis\b/i,
    /\bmasem\b/i,
    /\b(statistical|structural|path|analysis) model\b/i,
    /\bmoderator\b/i,
    /\brandom[- ]?effects\b/i,
    /분석\s*계획|분석\s*방법|메타\s*분석|분석\s*(?:모형|모델)|통계\s*(?:모형|모델)|구조\s*방정식|경로\s*모형|조절효과|랜덤\s*효과/
  ]);
  const accessCue = includesAny(normalized, [
    /\b(pdf|full[- ]?text|tdm|publisher api|institutional access|library login|vpn|proxy|subscription|paper collection|source collection|corpus|download)\b/i,
    /PDF|원문|전문|기관\s*구독|기관구독|구독|VPN|프록시|도서관|라이브러리|TDM|논문\s*수집|문헌\s*수집|코퍼스|다운로드/
  ]);
  const decisionFamilyCount = [scopeCue, theoryCue, measurementCodingCue, methodCue, analysisCue]
    .filter(Boolean).length;

  if (accessCue) {
    push({
      key: "scholarly_access_policy",
      kind: "evidence_risk",
      title: "Scholarly access policy",
      question: "What scholarly access route should LongTable use before collecting PDFs, full text, or subscription-only evidence?",
      whyNow: "Full-text access decisions can change the corpus, inclusion bias, reproducibility, and TDM permission boundary.",
      options: followUpQuestionOptions(
        { value: "oa_only", label: "OA-only", description: "Use only open-access PDF or full text.", recommended: true },
        { value: "institutional_access", label: "Institutional access", description: "Include VPN/proxy/library-login access after the researcher completes login." },
        { value: "publisher_tdm", label: "Publisher API/TDM", description: "Use configured publisher API/TDM credentials and record entitlement checks." },
        { value: "manual_pdf", label: "Manual PDFs", description: "Use PDFs supplied by the researcher and record provenance." },
        { value: "metadata_only", label: "Metadata only", description: "Do not collect full text yet." }
      ),
      confidence: "high",
      autoEligible: true,
      required: true,
      cues: ["scholarly_access", "full_text", "corpus"]
    });
  }

  if (decisionActionCue && decisionFamilyCount >= 2) {
    push({
      key: "research_direction_change_commitment",
      kind: "research_commitment",
      title: "Research direction change",
      question: "Which high-risk research commitment should LongTable clarify first before changing the project direction?",
      whyNow: "The prompt touches multiple protected research commitments; proceeding silently would let LongTable choose the priority order for the researcher.",
      options: followUpQuestionOptions(
        { value: "scope_first", label: "Scope or research question first", description: "Clarify what the study includes, excludes, or asks before changing downstream work.", recommended: true },
        { value: "theory_first", label: "Theory or construct frame first", description: "Clarify the conceptual frame before changing methods or analysis." },
        { value: "method_analysis_first", label: "Method or analysis first", description: "Clarify design, data, or analysis implications before changing the artifact." },
        { value: "defer", label: "Keep the direction open", description: "Do not change the research direction until the commitment order is explicit." }
      ),
      confidence: "high",
      autoEligible: true,
      required: true,
      cues: ["research_direction", "multi_commitment_change"]
    });
  }

  if (decisionActionCue && scopeCue) {
    push({
      key: "research_scope_boundary",
      kind: "research_commitment",
      title: "Research scope boundary",
      question: "What scope boundary should LongTable keep explicit before treating the research direction as changed?",
      whyNow: "Scope changes can redefine the population, domain, corpus, or research question before the researcher has explicitly chosen the boundary.",
      options: followUpQuestionOptions(
        { value: "revise_scope", label: "Revise the scope", description: "Change the inclusion boundary before downstream work continues.", recommended: true },
        { value: "compare_boundaries", label: "Compare boundaries first", description: "Keep candidate scopes visible before choosing one." },
        { value: "proceed_with_scope_assumption", label: "Proceed with scope assumption", description: "Continue only after stating the assumed boundary." },
        { value: "defer", label: "Keep scope open", description: "Do not settle the scope yet." }
      ),
      confidence: "high",
      autoEligible: true,
      cues: ["research_scope", "boundary"]
    });
  }

  if (decisionActionCue && theoryCue) {
    push({
      key: "theory_frame_commitment",
      kind: "research_commitment",
      title: "Theory frame",
      question: "Which theory or construct frame should LongTable treat as the candidate commitment before revising the model?",
      whyNow: "Theory-frame changes can make later measurement, coding, and analysis choices look settled when they are only inferred.",
      options: followUpQuestionOptions(
        { value: "compare_theories", label: "Compare theory frames first", description: "Keep competing theoretical anchors visible before choosing one.", recommended: true },
        { value: "revise_theory", label: "Revise the frame", description: "Change the framework and record the conceptual tradeoff." },
        { value: "use_current_frame", label: "Use current frame tentatively", description: "Proceed but mark the theory choice as provisional." },
        { value: "defer", label: "Keep theory open", description: "Do not settle the theory frame yet." }
      ),
      confidence: "high",
      autoEligible: true,
      cues: ["theory", "framework", "construct"]
    });
  }

  if (decisionActionCue && measurementCodingCue) {
    push({
      key: "measurement_coding_standard",
      kind: "research_commitment",
      title: "Measurement and coding standard",
      question: "What measurement or coding rule should LongTable ask you to fix before extracting or revising data?",
      whyNow: "Measurement and coding rules decide what counts as evidence; changing them silently can make later synthesis non-reproducible.",
      options: followUpQuestionOptions(
        { value: "define_construct_rule", label: "Define construct rule first", description: "Clarify what counts as the construct or variable before extraction.", recommended: true },
        { value: "define_extraction_rule", label: "Define extraction rule first", description: "Clarify correlation, path, beta, or qualitative evidence extraction rules." },
        { value: "pilot_code", label: "Pilot the coding rule", description: "Test the rule on a small sample before committing." },
        { value: "defer", label: "Keep coding open", description: "Do not settle measurement or coding yet." }
      ),
      confidence: "high",
      autoEligible: true,
      cues: ["measurement", "coding", "extraction"]
    });
  }

  if (decisionActionCue && methodCue) {
    push({
      key: "method_design_commitment",
      kind: "research_commitment",
      title: "Method design",
      question: "Which method-design choice should LongTable keep explicit before changing the study plan?",
      whyNow: "Method changes affect the defensible claim, sample, evidence standard, and ethics boundary.",
      options: followUpQuestionOptions(
        { value: "revise_design", label: "Revise design first", description: "Change the design or sample boundary before proceeding.", recommended: true },
        { value: "check_feasibility", label: "Check feasibility first", description: "Inspect whether data, evidence, and access support the method." },
        { value: "proceed_with_method_assumption", label: "Proceed with method assumption", description: "Continue only after stating the assumed method." },
        { value: "defer", label: "Keep method open", description: "Do not commit the method yet." }
      ),
      confidence: "high",
      autoEligible: true,
      cues: ["method", "study_design", "sample"]
    });
  }

  if (decisionActionCue && analysisCue) {
    push({
      key: "analysis_strategy_commitment",
      kind: "research_commitment",
      title: "Analysis strategy",
      question: "What analysis strategy should LongTable treat as unsettled before revising or running the synthesis?",
      whyNow: "Analysis choices determine what effect sizes, moderators, and interpretations become defensible.",
      options: followUpQuestionOptions(
        { value: "choose_analysis_family", label: "Choose analysis family first", description: "Clarify MASEM, family-level meta-analysis, moderator analysis, or narrative synthesis.", recommended: true },
        { value: "check_data_sufficiency", label: "Check data sufficiency first", description: "Inspect whether primary quantitative effects support the analysis." },
        { value: "proceed_with_analysis_assumption", label: "Proceed with assumption", description: "Continue only after stating the analysis assumption." },
        { value: "defer", label: "Keep analysis open", description: "Do not settle the analysis plan yet." }
      ),
      confidence: "high",
      autoEligible: true,
      cues: ["analysis", "model", "meta_analysis"]
    });
  }

  if (decisionActionCue && includesAny(normalized, [
    /\bconflict\b/i,
    /\bcontradict/i,
    /\bontology\b/i,
    /\bepistem/i,
    /\bhuman knowledge\b/i,
    /\bai knowledge\b/i,
    /\balignment\b/i,
    /충돌|상충|모순|존재론|인식론|지식|인간의\s*지식|ai의\s*지식|정렬|방향성/
  ])) {
    push({
      key: "epistemic_alignment_boundary",
      kind: "value_conflict",
      title: "Knowledge alignment",
      question: "When researcher knowledge, AI inference, and project state conflict, what should LongTable privilege before acting?",
      whyNow: "The prompt asks LongTable to mediate knowledge conflict; that mediation should be visible rather than hidden inside an implementation choice.",
      options: followUpQuestionOptions(
        { value: "ask_researcher", label: "Ask researcher clarity first", description: "Pause when human meaning or priority is underspecified.", recommended: true },
        { value: "inspect_project_state", label: "Inspect project state first", description: "Use durable files and prior decisions before inferring intent." },
        { value: "proceed_with_trace", label: "Proceed with explicit trace", description: "Continue only after naming the conflict and assumption." },
        { value: "defer", label: "Keep conflict open", description: "Do not collapse the conflict into one answer yet." }
      ),
      confidence: "high",
      autoEligible: true,
      cues: ["knowledge_conflict", "epistemic_alignment"]
    });
  }

  if (includesAny(normalized, [
    /\blongtable\b/,
    /\bharness\b/,
    /\bhook\b/,
    /\bcheckpoint\b/,
    /\bagents?\b/,
    /\bmcp\b/,
    /\bover[- ]?engineer/,
    /롱테이블|하네스|훅|체크포인트|에이전트|오버\s*엔지니어링|과설계/
  ])) {
    push({
      key: "harness_question_harness",
      kind: "harness_design",
      title: "Question harness target",
      question: "Which LongTable failure should the question system optimize against first?",
      whyNow: "Harness changes can optimize for visible activity while still missing the moments where researcher judgment should stop the run.",
      options: followUpQuestionOptions(
        { value: "missing_questions", label: "Missing necessary questions", description: "Prioritize stopping at unstated assumptions, construct collapse, or closure pressure.", recommended: true },
        { value: "false_interruptions", label: "Unhelpful interruptions", description: "Reduce questions that slow execution without protecting a real research judgment." },
        { value: "role_surface_quality", label: "Role and skill quality", description: "Audit whether agents and markdown skills ask the right questions for their roles." },
        { value: "state_traceability", label: "State traceability", description: "Prioritize durable question, answer, and checkpoint records over UI convenience." }
      ),
      confidence: "high",
      autoEligible: true,
      cues: ["longtable", "harness", "hook", "checkpoint", "agent", "mcp"]
    });
  }

  if (includesAny(normalized, [
    /\bneeded questions?\b/,
    /\bnecessary questions?\b/,
    /\bask (all|every|more)\b/,
    /\bquestion generation\b/,
    /\bclarifying questions?\b/,
    /필요한\s*질문|질문을\s*(모두|많이|생성)|질문.*(?:생성|멈춰|지점)|질문이\s*모두|질문\s*생성|물어봐|질문해/
  ])) {
    push({
      key: "needed_question_policy",
      kind: "question_policy",
      title: "Question policy",
      question: "When LongTable detects missing context, what questioning rule should it follow before continuing?",
      whyNow: "A question-heavy agent needs a policy for when questions are required, batched, advisory, or too disruptive.",
      options: followUpQuestionOptions(
        { value: "ask_required_first", label: "Ask required blockers first", description: "Stop only for questions that protect a real decision or construct boundary.", recommended: true },
        { value: "batch_all_questions", label: "Batch all plausible questions", description: "Generate a fuller question queue even if some items are advisory." },
        { value: "continue_with_assumptions", label: "Continue with assumptions", description: "Proceed but record assumptions and unresolved questions explicitly." }
      ),
      confidence: "high",
      autoEligible: true,
      cues: ["needed_questions", "question_generation"]
    });
  }

  if (includesAny(normalized, [
    /\bphilosoph/i,
    /\breflect(ion|ive)?\b/,
    /\bfundamental questions?\b/,
    /\bprinciple\b/,
    /\bagency\b/,
    /철학|성찰|근본(?:적)?\s*질문|원칙|내\s*철학|연구자성|주체성/
  ])) {
    push({
      key: "philosophical_checkpoint_boundary",
      kind: "philosophical_reflection",
      title: "Checkpoint philosophy",
      question: "What should a checkpoint philosophically protect in this LongTable run?",
      whyNow: "A checkpoint can either protect researcher agency or become a procedural interruption; LongTable should not choose that philosophy silently.",
      options: followUpQuestionOptions(
        { value: "researcher_agency", label: "Researcher agency", description: "Stop when LongTable is about to decide for the researcher.", recommended: true },
        { value: "construct_integrity", label: "Construct integrity", description: "Stop when distinct ideas may be collapsed into one claim." },
        { value: "usability_burden", label: "Usability burden", description: "Stop only when the benefit justifies interrupting the workflow." }
      ),
      autoEligible: true,
      cues: ["philosophy", "reflection", "researcher_agency"]
    });
  }

  if (includesAny(normalized, [
    /\bprotected decision\b/,
    /\bclosure pressure\b/,
    /\bsettle\b/,
    /\bfinalize\b/,
    /\bcommit\b/,
    /보호된\s*결정|확정|최종|마무리|결정\s*압력/
  ])) {
    push({
      key: "protected_decision_closure",
      kind: "research_commitment",
      title: "Protected decision closure",
      question: "What should LongTable do with the protected decision before proceeding?",
      whyNow: "The prompt creates closure pressure around a decision the workspace says should not settle silently.",
      options: followUpQuestionOptions(
        { value: "keep_open", label: "Keep it open", description: "Do not treat the decision as settled; preserve it as an explicit blocker.", recommended: true },
        { value: "ask_researcher", label: "Ask the researcher now", description: "Pause execution until the researcher chooses the decision boundary." },
        { value: "proceed_with_record", label: "Proceed with record", description: "Continue only after recording the assumption and residual risk." }
      ),
      confidence: "high",
      autoEligible: true,
      required: true,
      cues: ["protected_decision", "closure_pressure"]
    });
  }

  if (includesAny(normalized, [
    /\btrust\b/,
    /\breliance\b/,
    /\bcalibration\b/,
    /\bconstruct\b/,
    /\bmeasurement\b/,
    /\bdefinition\b/,
    /신뢰|의존|의존성|캘리브레이션|교정|보정|개념|구성개념|측정|정의/
  ])) {
    push({
      key: "construct_boundary_commitment",
      kind: "research_commitment",
      title: "Construct boundary",
      question: "Which construct boundary should LongTable keep explicit before treating the direction as settled?",
      whyNow: "Trust, reliance, calibration, and measurement choices can look compatible while requiring different evidence and analysis rules.",
      options: followUpQuestionOptions(
        { value: "separate_trust_reliance", label: "Separate trust from reliance", description: "Treat subjective trust as a predictor or correlate rather than the same thing as reliance.", recommended: true },
        { value: "condition_calibration", label: "Condition calibration carefully", description: "Define calibration using AI correctness and participant correctness instead of switch behavior alone." },
        { value: "hold_construct_open", label: "Keep construct open", description: "Do not settle the construct boundary until evidence or design constraints are clearer." }
      ),
      confidence: "high",
      autoEligible: true,
      cues: ["trust", "reliance", "calibration", "construct", "measurement"]
    });
  }

  if (includesAny(normalized, [
    /\bknowledge gap\b/,
    /\bgap\b/,
    /\bunknown\b/,
    /\buncertain\b/,
    /\bnot sure\b/,
    /\bblocker\b/,
    /지식\s*공백|모르겠|불확실|블로커|막히|애매/
  ])) {
    push({
      key: "knowledge_gap_probe",
      kind: "knowledge_gap",
      title: "Knowledge gap",
      question: "Which unknown should LongTable resolve before it recommends or implements a direction?",
      whyNow: "The request signals uncertainty; moving directly to advice can hide the real blocker.",
      options: followUpQuestionOptions(
        { value: "scope_gap", label: "Scope is unclear", description: "Clarify what is included, excluded, and high stakes.", recommended: true },
        { value: "evidence_gap", label: "Evidence is missing", description: "Clarify what sources or data should anchor the answer." },
        { value: "decision_gap", label: "Decision is unsettled", description: "Clarify the researcher judgment that must stay open." }
      ),
      autoEligible: true,
      cues: ["knowledge_gap", "uncertainty", "blocker"]
    });
  }

  if (includesAny(normalized, [
    /\bassumption\b/,
    /\bimplicit\b/,
    /\btacit\b/,
    /\bunstated\b/,
    /전제|가정|암묵|묵시|숨은\s*가정|말하지\s*않은/
  ])) {
    push({
      key: "tacit_assumption_probe",
      kind: "tacit_assumption",
      title: "Tacit assumption",
      question: "Which assumption should LongTable make explicit before proceeding?",
      whyNow: "Tacit assumptions often determine the answer while remaining invisible in the artifact.",
      options: followUpQuestionOptions(
        { value: "researcher_intent", label: "Researcher intent", description: "Clarify the user's intended boundary or priority.", recommended: true },
        { value: "evidence_standard", label: "Evidence standard", description: "Clarify what would count as adequate support." },
        { value: "system_behavior", label: "System behavior", description: "Clarify what the agent or hook should do at runtime." }
      ),
      autoEligible: true,
      cues: ["assumption", "implicit", "tacit"]
    });
  }

  if (includesAny(normalized, [
    /\btrade[- ]?off\b/,
    /\bconflict\b/,
    /\btension\b/,
    /\bvs\.?\b/,
    /갈등|긴장|상충|균형|대립|비교/
  ])) {
    push({
      key: "value_conflict_boundary",
      kind: "value_conflict",
      title: "Value conflict",
      question: "Which tradeoff should LongTable keep visible instead of resolving silently?",
      whyNow: "Competing values such as rigor, usability, speed, and authorship require researcher judgment.",
      options: followUpQuestionOptions(
        { value: "rigor_over_speed", label: "Rigor over speed", description: "Ask more before changing the research direction.", recommended: true },
        { value: "usability_over_coverage", label: "Usability over coverage", description: "Limit questions to those that unblock the current task." },
        { value: "record_disagreement", label: "Record disagreement", description: "Proceed only after preserving the conflict in state or output." }
      ),
      autoEligible: true,
      cues: ["tradeoff", "conflict", "tension"]
    });
  }

  if (includesAny(normalized, [/\brubrics?\b/, /루브릭|채점기준/])) {
    push({
      key: "rubric_update_basis",
      kind: "research_commitment",
      title: "Rubric update basis",
      question: "How should LongTable use the available materials to update the rubric?",
      whyNow: "Rubric updates can silently change grading criteria if LongTable guesses the calibration basis.",
      options: followUpQuestionOptions(
        { value: "calibrate_to_exemplars", label: "Calibrate criteria to exemplars", description: "Use strong submissions to refine what each criterion means.", recommended: true },
        { value: "polish_existing", label: "Polish existing rubric only", description: "Keep criteria stable and improve wording or consistency." },
        { value: "rewrite_structure", label: "Restructure the rubric", description: "Change categories or levels where the materials suggest a better structure." }
      )
    });
  }

  if (includesAny(normalized, [/\bexemplar\b/, /\bbest submission\b/, /\bselected submission\b/, /\bTA\b/i, /우수\s*답안|예시|선정|조교/])) {
    push({
      key: "exemplar_use",
      kind: "evidence_risk",
      title: "Exemplar use",
      question: "How should LongTable use selected exemplars or TA guidance?",
      whyNow: "Exemplars can either calibrate criteria privately or become visible evidence inside the output.",
      options: followUpQuestionOptions(
        { value: "calibrate_only", label: "Use as private calibration", description: "Adjust criteria using exemplars without quoting them.", recommended: true },
        { value: "include_deidentified_excerpts", label: "Include de-identified excerpts", description: "Add short anonymized examples where they clarify quality." },
        { value: "separate_notes", label: "Keep examples in separate notes", description: "Use exemplars outside the main artifact." }
      )
    });
  }

  if (includesAny(normalized, [/\binstruction/, /\bguidance\b/, /\bsource\b/, /\bfile\b/, /\bdocx?\b/, /지침|가이드|문서|파일|자료/])) {
    push({
      key: "source_authority",
      kind: "source_authority",
      title: "Source authority",
      question: "If sources conflict or leave gaps, which source should LongTable privilege?",
      whyNow: "Without an authority rule, LongTable may resolve conflicts by convenience rather than researcher intent.",
      options: followUpQuestionOptions(
        { value: "explicit_user_instruction", label: "Your explicit instruction", description: "Use the researcher's current instruction as the highest authority.", recommended: true },
        { value: "project_files", label: "Project files", description: "Treat supplied files or existing artifacts as authoritative." },
        { value: "external_guidance", label: "TA or external guidance", description: "Prioritize instructor, TA, venue, or policy guidance." }
      )
    });
  }

  if (includesAny(normalized, [/\bdeliver\b/, /\boutput\b/, /\btracked?[- ]?change/, /\bdocx?\b/, /\bmarkdown\b/, /\btable\b/, /전달|산출물|결과물|수정\s*표시|트랙|형식|포맷/])) {
    push({
      key: "delivery_format",
      kind: "delivery_format",
      title: "Delivery format",
      question: "How should LongTable deliver the clarified output?",
      whyNow: "Format and change-tracking choices affect whether the result is usable for review or handoff.",
      options: followUpQuestionOptions(
        { value: "tracked_changes", label: "Tracked-change artifact", description: "Produce a reviewable changed version where possible.", recommended: true },
        { value: "clean_final", label: "Clean final artifact", description: "Deliver the final version without change markup." },
        { value: "summary_plus_artifact", label: "Summary plus artifact", description: "Include a concise change summary with the output." }
      )
    });
  }

  if (includesAny(normalized, [/\bupdate\b/, /\bchange\b/, /\bedit\b/, /\bfix\b/, /\bimplement\b/, /\bbuild\b/, /\bcreate\b/, /업데이트|수정|변경|구현|만들|고쳐/])) {
    push({
      key: "autonomy_boundary",
      kind: "autonomy_boundary",
      title: "Autonomy boundary",
      question: "How much should LongTable do before checking back with you?",
      whyNow: "Execution requests can move from advice to authorship or artifact ownership unless the boundary is explicit.",
      options: followUpQuestionOptions(
        { value: "ask_then_act", label: "Clarify first, then act", description: "Ask needed questions before changing the artifact.", recommended: true },
        { value: "act_with_defaults", label: "Act with visible defaults", description: "Proceed using recommended defaults and record them." },
        { value: "recommend_only", label: "Recommend only", description: "Describe changes but do not alter artifacts." }
      )
    });
  }

  if (includesAny(normalized, [/\bperformance\b/, /\btest\b/, /\bevaluate\b/, /\bcheck\b/, /\bbenchmark\b/, /성능|테스트|평가|체크|검증/])) {
    push({
      key: "evaluation_target",
      kind: "evaluation_target",
      title: "Evaluation target",
      question: "What should LongTable treat as the main performance target?",
      whyNow: "Performance checks can optimize for UX, correctness, trigger sensitivity, or delivery reliability.",
      options: followUpQuestionOptions(
        { value: "question_sensitivity", label: "Question sensitivity", description: "Check whether LongTable asks at the right knowledge-gap moments.", recommended: true },
        { value: "renderer_convenience", label: "Renderer convenience", description: "Check whether the most convenient question UI is used." },
        { value: "state_reliability", label: "State reliability", description: "Check whether questions and answers persist correctly." }
      )
    });
  }

  if (specs.length === 0 && options.includeFallback !== false) {
    push({
      key: "general_missing_context",
      kind: "general_missing_context",
      title: "Missing context",
      question: "What should LongTable clarify before proceeding?",
      whyNow: "The request can be answered in multiple ways, and choosing silently would hide a researcher judgment.",
      options: followUpQuestionOptions(
        { value: "scope", label: "Clarify scope first", description: "Ask what is included and excluded before acting.", recommended: true },
        { value: "criteria", label: "Clarify success criteria", description: "Ask what would count as a good result." },
        { value: "proceed", label: "Proceed with visible assumptions", description: "Continue, but make assumptions explicit." }
      )
    });
  }

  let selected = options.autoOnly === true ? specs.filter((spec) => spec.autoEligible) : specs;
  if (options.requiredOnly === true) {
    selected = selected.filter((spec) => spec.kind === "research_commitment" || spec.required);
  }
  if (normalized.includes("protected decision closure pressure")) {
    selected = selected.filter((spec) => spec.key === "protected_decision_closure");
  } else if (options.requiredOnly === true && selected.some((spec) => spec.key === "research_direction_change_commitment")) {
    selected = selected.filter((spec) => spec.key === "research_direction_change_commitment");
  }
  return selected.sort((a, b) => questionPriority(b) - questionPriority(a));
}

function buildFollowUpQuestionSpecs(prompt: string): FollowUpQuestionSpec[] {
  return buildQuestionOpportunitySpecs(prompt);
}

export function generateQuestionOpportunities(
  prompt: string,
  options: BuildFollowUpQuestionOptions = {}
): QuestionGenerationResult {
  const opportunities = buildQuestionOpportunitySpecs(prompt, options);
  return {
    promptSignature: prompt.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 160),
    opportunities,
    blocking: opportunities.some((opportunity) => opportunity.required)
  };
}

const FOLLOW_UP_PROMPT_PREFIX = "Follow-up prompt:";

function compactMetadataText(parts: Array<string | string[] | undefined>): string {
  return parts
    .flatMap((part) => Array.isArray(part) ? part : [part])
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function textMatchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const COMMITMENT_FAMILY_BY_CHECKPOINT: Array<[RegExp, QuestionCommitmentFamily]> = [
  [/product|meta_decision/, "product_policy"],
  [/research_question|research_direction|scope|boundary|inclusion|exclusion/, "scope"],
  [/theory|construct|conceptual/, "construct"],
  [/measurement|coding|codebook|extraction/, "coding"],
  [/method|analysis|panel_disagreement|panel_debate|team_debate|review/, "method"],
  [/evidence|scholarly_access|source_authority/, "evidence"],
  [/knowledge_gap|tacit_assumption|epistemic/, "epistemic_authority"]
];

function inferCommitmentFamily(input: {
  checkpointKey?: string;
  triggerFamily?: string;
  title?: string;
  question?: string;
  prompt?: string;
  rationale?: string[];
}): QuestionCommitmentFamily | undefined {
  const checkpointKey = (input.checkpointKey ?? "").toLowerCase();
  const matched = COMMITMENT_FAMILY_BY_CHECKPOINT.find(([pattern]) => pattern.test(checkpointKey));
  if (matched) return matched[1];

  if (input.triggerFamily === "meta_decision") return "product_policy";
  if (input.triggerFamily === "evidence") return "evidence";

  const text = compactMetadataText([input.title, input.question, input.prompt, input.rationale]);
  if (textMatchesAny(text, [/checkpoint policy/, /hook ux/, /product language/, /\breadme\b/, /제품 언어|체크포인트 정책|훅|리드미/])) {
    return "product_policy";
  }
  return undefined;
}

function inferEpistemicBasis(input: {
  title?: string;
  question?: string;
  prompt?: string;
  rationale?: string[];
}): QuestionEpistemicBasis | undefined {
  const text = compactMetadataText([input.title, input.question, input.prompt, input.rationale]);
  const bases: QuestionEpistemicBasis[] = [];

  if (textMatchesAny(text, [/\bresearcher\b/, /\bhuman\b/, /\byour judgment\b/, /\byour knowledge\b/, /연구자|인간|사람|너의\s*판단|당신의\s*판단|내\s*지식|사용자/])) {
    bases.push("researcher_knowledge");
  }
  if (textMatchesAny(text, [/\bproject state\b/, /\bworkspace\b/, /\bcurrent\.md\b/, /\.longtable\b/, /\bstate\.json\b/, /\bdataset\b/, /\bcodebook\b/, /\bcoding sheet\b/, /프로젝트\s*상태|워크스페이스|데이터셋|코드북|코딩\s*시트/])) {
    bases.push("project_state");
  }
  if (textMatchesAny(text, [/\bexternal evidence\b/, /\bliterature\b/, /\bpaper\b/, /\bpdf\b/, /\bsource\b/, /\bcitation\b/, /\breference\b/, /\bfull[- ]?text\b/, /외부\s*근거|문헌|논문|원문|전문|출처|인용|레퍼런스/])) {
    bases.push("external_evidence");
  }
  if (textMatchesAny(text, [/\bcodex\b/, /\bllm\b/, /\blanguage model\b/, /\bmodel judgment\b/, /\bai inference\b/, /\bassistant judgment\b/, /코덱스|언어\s*모델|모델\s*판단|AI\s*추론|LLM/])) {
    bases.push("ai_inference");
  }

  const unique = [...new Set(bases)];
  if (unique.length > 1) return "mixed";
  return unique[0];
}


function inferHardStopScope(
  input: { checkpointKey?: string; title?: string; question?: string; prompt?: string; rationale?: string[] },
  commitmentFamily?: QuestionCommitmentFamily
): HardStopScope | undefined {
  if (commitmentFamily === "product_policy") return undefined;
  if (commitmentFamily === "scope") return "scope";
  if (commitmentFamily === "construct" || commitmentFamily === "coding") return "construct";
  if (commitmentFamily === "method") return "method";
  if (commitmentFamily === "evidence") return "evidence";
  if (commitmentFamily === "epistemic_authority") return "protected_decision";

  const text = compactMetadataText([input.checkpointKey, input.title, input.question, input.prompt, input.rationale]);
  if (textMatchesAny(text, [/product_runtime|checkpoint policy|hook ux|setup|install|cli|npm|release|git|github|docs?|readme|package|workflow/])) {
    return undefined;
  }
  if (textMatchesAny(text, [/protected_decision|closure/])) return "protected_decision";
  if (textMatchesAny(text, [/research_question|research direction|question_freeze/])) return "research_question";
  if (textMatchesAny(text, [/scope|boundary|inclusion|exclusion/])) return "scope";
  if (textMatchesAny(text, [/construct|theory|frame|ontology|measurement|coding|validity/])) return "construct";
  if (textMatchesAny(text, [/method|design|sample|analysis|strategy|model/])) return "method";
  if (textMatchesAny(text, [/evidence|access|source|corpus|pdf|full[-_ ]?text|scholarly/])) return "evidence";
  return undefined;
}

function resolveQuestionRecordMetadata(input: {
  checkpointKey?: string;
  triggerFamily?: string;
  title?: string;
  question?: string;
  prompt?: string;
  rationale?: string[];
  commitmentFamily?: QuestionCommitmentFamily;
  epistemicBasis?: QuestionEpistemicBasis;
}): {
  commitmentFamily?: QuestionCommitmentFamily;
  epistemicBasis?: QuestionEpistemicBasis;
  hardStop?: boolean;
  hardStopScope?: HardStopScope;
} {
  const commitmentFamily = input.commitmentFamily ?? inferCommitmentFamily(input);
  const epistemicBasis = input.epistemicBasis ?? inferEpistemicBasis(input);
  const hardStopScope = inferHardStopScope(input, commitmentFamily);
  return {
    ...(commitmentFamily ? { commitmentFamily } : {}),
    ...(epistemicBasis ? { epistemicBasis } : {}),
    ...(hardStopScope ? { hardStop: true, hardStopScope } : {})
  };
}

function hasFollowUpPrompt(record: QuestionRecord, prompt: string): boolean {
  return record.prompt.rationale.includes(`${FOLLOW_UP_PROMPT_PREFIX} ${prompt}`);
}

export async function createWorkspaceFollowUpQuestions(options: {
  context: LongTableProjectContext;
  prompt: string;
  provider?: ProviderKind;
  required?: boolean;
  hardStop?: boolean;
  hardStopScope?: HardStopScope;
  force?: boolean;
  auto?: boolean;
  requiredOnly?: boolean;
}): Promise<{
  questions: QuestionRecord[];
  state: ResearchState;
  created: boolean;
  alreadyAnswered: boolean;
}> {
  const state = await loadResearchState(options.context.stateFilePath);
  if (!options.force) {
    const existing = (state.questionLog ?? []).filter((record) => hasFollowUpPrompt(record, options.prompt));
    const pending = existing.filter((record) => record.status === "pending");
    if (pending.length > 0) {
      return { questions: pending, state, created: false, alreadyAnswered: false };
    }
    if (existing.some((record) => record.status === "answered")) {
      return { questions: [], state, created: false, alreadyAnswered: true };
    }
  }

  const createdAt = nowIso();
  const preferredSurfaces = options.provider === "claude"
    ? ["native_structured", "terminal_selector", "numbered"]
    : ["mcp_elicitation", "terminal_selector", "numbered"];
  const specs = buildQuestionOpportunitySpecs(options.prompt, {
    includeFallback: options.force === true ? true : options.auto !== true,
    autoOnly: options.auto === true,
    requiredOnly: options.requiredOnly === true
  });
  if (specs.length === 0) {
    return { questions: [], state, created: false, alreadyAnswered: false };
  }

  const existingPendingByCheckpoint = new Map(
    (state.questionLog ?? [])
      .filter((record) => record.status === "pending" && record.prompt.source === "runtime_guidance")
      .map((record) => [record.prompt.checkpointKey, record] as const)
  );
  const pendingMatches = specs
    .map((spec) => existingPendingByCheckpoint.get(`follow_up_${spec.key}`))
    .filter((record): record is QuestionRecord => Boolean(record));
  const specsToCreate = specs.filter((spec) => !existingPendingByCheckpoint.has(`follow_up_${spec.key}`));
  if (specsToCreate.length === 0) {
    return { questions: pendingMatches, state, created: false, alreadyAnswered: false };
  }

  const questions: QuestionRecord[] = specsToCreate.map((spec) => {
    const checkpointKey = `follow_up_${spec.key}`;
    const rationale = [
      spec.whyNow,
      `Question kind: ${spec.kind}`,
      `Question confidence: ${spec.confidence}`,
      `${FOLLOW_UP_PROMPT_PREFIX} ${options.prompt}`
    ];
    const metadata = resolveQuestionRecordMetadata({
      checkpointKey,
      title: spec.title,
      question: spec.question,
      prompt: options.prompt,
      rationale
    });
    return {
      id: createId("question_record"),
      createdAt,
      updatedAt: createdAt,
      status: "pending",
      ...metadata,
      ...(typeof options.hardStop === "boolean" ? { hardStop: options.hardStop } : {}),
      ...(options.hardStopScope ? { hardStopScope: options.hardStopScope } : {}),
      prompt: {
        id: createId("question_prompt"),
        checkpointKey,
        title: spec.title,
        question: spec.question,
        type: "single_choice",
        options: spec.options,
        allowOther: true,
        otherLabel: "Other",
        required: options.required ?? spec.required,
        source: "runtime_guidance",
        rationale,
        preferredSurfaces: preferredSurfaces as QuestionSurface[]
      }
    };
  });

  const updated = appendQuestionRecords(state, questions);
  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);

  return { questions: [...pendingMatches, ...questions], state: updated, created: true, alreadyAnswered: false };
}

export async function createWorkspaceQuestion(options: {
  context: LongTableProjectContext;
  prompt: string;
  title?: string;
  question?: string;
  type?: QuestionPromptType;
  checkpointKey?: string;
  questionOptions?: QuestionOption[];
  allowOther?: boolean;
  otherLabel?: string;
  displayReason?: string;
  provider?: ProviderKind;
  required?: boolean;
  hardStop?: boolean;
  hardStopScope?: HardStopScope;
  commitmentFamily?: QuestionCommitmentFamily;
  epistemicBasis?: QuestionEpistemicBasis;
}): Promise<{
  question: QuestionRecord;
  state: ResearchState;
}> {
  const state = await loadResearchState(options.context.stateFilePath);
  const trigger = classifyCheckpointTrigger(options.prompt, {
    unresolvedTensions: state.openTensions ?? [],
    studyContract: state.studyContract
  });
  const checkpointKey = options.checkpointKey ?? trigger.signal.checkpointKey;
  const promptType = options.type ?? "single_choice";
  const createdAt = nowIso();
  const title = options.title ?? questionTitleForCheckpoint(trigger.family, checkpointKey);
  const questionText = options.question ?? questionTextForCheckpoint(trigger.family, options.prompt, checkpointKey);
  const rationale = [
    ...trigger.rationale,
    `Trigger family: ${trigger.family}.`,
    `Trigger confidence: ${trigger.confidence}.`,
    `Original prompt: ${options.prompt}`
  ];
  const metadata = resolveQuestionRecordMetadata({
    checkpointKey,
    triggerFamily: trigger.family,
    title,
    question: questionText,
    prompt: options.prompt,
    rationale,
    commitmentFamily: options.commitmentFamily,
    epistemicBasis: options.epistemicBasis
  });
  const question: QuestionRecord = {
    id: createId("question_record"),
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    ...metadata,
    ...(typeof options.hardStop === "boolean" ? { hardStop: options.hardStop } : {}),
    ...(options.hardStopScope ? { hardStopScope: options.hardStopScope } : {}),
    prompt: {
      id: createId("question_prompt"),
      checkpointKey,
      title,
      question: questionText,
      type: promptType,
      options: options.questionOptions ?? optionsForCheckpointTrigger(trigger.family, checkpointKey),
      allowOther: options.allowOther ?? promptType !== "free_text",
      otherLabel: options.otherLabel ?? "Other decision",
      required: options.required ?? trigger.requiresQuestionBeforeClosure,
      source: "checkpoint",
      displayReason: options.displayReason ?? trigger.rationale[0],
      rationale,
      preferredSurfaces: options.provider === "claude"
        ? ["native_structured", "numbered"]
        : ["mcp_elicitation", "numbered"]
    }
  };

  const updated = appendQuestionRecords(state, [question]);
  const withObligation = ensureRequiredQuestionObligation(updated, question);
  await writeFile(options.context.stateFilePath, JSON.stringify(withObligation, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);

  return { question, state: withObligation };
}

function updateInvocationWithDecision(
  invocation: InvocationRecord,
  questionId: string,
  decisionId: string
): InvocationRecord {
  if (!invocation.panelResult?.linkedQuestionRecordIds.includes(questionId)) {
    return invocation;
  }

  const linkedDecisionRecordIds = invocation.panelResult.linkedDecisionRecordIds.includes(decisionId)
    ? invocation.panelResult.linkedDecisionRecordIds
    : [...invocation.panelResult.linkedDecisionRecordIds, decisionId];

  return {
    ...invocation,
    updatedAt: nowIso(),
    panelResult: {
      ...invocation.panelResult,
      updatedAt: nowIso(),
      linkedDecisionRecordIds
    }
  };
}

function normalizeAnswerToken(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function optionAnswerCandidates(option: QuestionOption): string[] {
  return [
    option.value,
    option.label,
    ...(option.description
      ? [
          `${option.label} - ${option.description}`,
          `${option.label} — ${option.description}`
        ]
      : [])
  ].map(normalizeAnswerToken);
}

function splitAnswerAndRationale(rawAnswer: string): { selection: string; rationale?: string } {
  const [firstLine = "", ...restLines] = rawAnswer.trim().split(/\r?\n/);
  const rationale = restLines.join("\n").trim();
  return {
    selection: firstLine.trim(),
    ...(rationale ? { rationale } : {})
  };
}

type WorkspaceQuestionAnswerInput = string | string[] | {
  answer?: string | string[];
  selectedValue?: string;
  selectedValues?: string[];
  otherText?: string;
  rationale?: string;
};

interface NormalizedQuestionAnswerSelection {
  selectedValues: string[];
  selectedLabels: string[];
  otherText?: string;
  inlineRationale?: string;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function answerInputParts(input: WorkspaceQuestionAnswerInput): {
  values: string[];
  otherText?: string;
  inlineRationale?: string;
  rawText?: string;
} {
  if (typeof input === "string") {
    return { values: [input], rawText: input };
  }

  if (Array.isArray(input)) {
    return { values: input };
  }

  let values = input.selectedValues ?? [];
  if (values.length === 0 && input.selectedValue) {
    values = [input.selectedValue];
  }
  if (values.length === 0 && Array.isArray(input.answer)) {
    values = input.answer;
  }
  if (values.length === 0 && typeof input.answer === "string") {
    values = [input.answer];
  }
  const otherText = input.otherText?.trim();
  const rationale = input.rationale?.trim();

  return {
    values,
    ...(otherText ? { otherText } : {}),
    ...(rationale ? { inlineRationale: rationale } : {})
  };
}

function splitSelectionTokens(selection: string, type: QuestionPromptType): string[] {
  if (type !== "multi_choice") {
    return [selection];
  }
  return selection.split(/[;,]/).map((token) => token.trim()).filter(Boolean);
}

function normalizeFreeTextAnswer(input: WorkspaceQuestionAnswerInput): NormalizedQuestionAnswerSelection {
  const parts = answerInputParts(input);
  const selectedText = parts.values.join("\n").trim();
  const text = parts.rawText ?? (selectedText || parts.otherText || "");
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Free-text LongTable question answers cannot be empty.");
  }
  return {
    selectedValues: [trimmed],
    selectedLabels: [trimmed],
    otherText: trimmed,
    ...(parts.inlineRationale ? { inlineRationale: parts.inlineRationale } : {})
  };
}

function resolveQuestionAnswerToken(
  question: QuestionRecord,
  token: string
): {
  selectedValue: string;
  selectedLabel: string;
  otherText?: string;
} {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("LongTable question answers cannot contain empty selections.");
  }

  const numeric = Number(trimmed);
  if (/^\d+$/.test(trimmed) && Number.isInteger(numeric)) {
    const option = question.prompt.options[numeric - 1];
    if (option) {
      return {
        selectedValue: option.value,
        selectedLabel: option.label
      };
    }

    if (question.prompt.allowOther && numeric === question.prompt.options.length + 1) {
      return {
        selectedValue: "other",
        selectedLabel: question.prompt.otherLabel ?? "Other"
      };
    }

    throw new Error(`Answer ${trimmed} is outside the available LongTable question options.`);
  }

  const normalizedSelection = normalizeAnswerToken(trimmed);
  const option = question.prompt.options.find((candidate) =>
    optionAnswerCandidates(candidate).includes(normalizedSelection)
  );
  if (option) {
    return {
      selectedValue: option.value,
      selectedLabel: option.label
    };
  }

  if (normalizedSelection === "other" && question.prompt.allowOther) {
    return {
      selectedValue: "other",
      selectedLabel: question.prompt.otherLabel ?? "Other"
    };
  }

  if (question.prompt.allowOther) {
    return {
      selectedValue: trimmed,
      selectedLabel: question.prompt.otherLabel ?? "Other",
      otherText: trimmed
    };
  }

  throw new Error(`Answer "${trimmed}" does not match a LongTable question option.`);
}

function isOtherAnswerToken(question: QuestionRecord, token: string): boolean {
  if (!question.prompt.allowOther) {
    return false;
  }

  const trimmed = token.trim();
  const normalized = normalizeAnswerToken(trimmed);
  const otherLabel = normalizeAnswerToken(question.prompt.otherLabel ?? "Other");
  if (normalized === "other" || normalized === otherLabel) {
    return true;
  }

  const numeric = Number(trimmed);
  return /^\d+$/.test(trimmed) && Number.isInteger(numeric) && numeric === question.prompt.options.length + 1;
}

function normalizeQuestionAnswerSelection(
  question: QuestionRecord,
  rawAnswer: WorkspaceQuestionAnswerInput
): NormalizedQuestionAnswerSelection {
  if (question.prompt.type === "free_text") {
    return normalizeFreeTextAnswer(rawAnswer);
  }

  const parts = answerInputParts(rawAnswer);
  const parsedValues = parts.values.flatMap((value) => {
    if (typeof rawAnswer === "string") {
      const { selection } = splitAnswerAndRationale(value.trim());
      return splitSelectionTokens(selection, question.prompt.type);
    }
    return splitSelectionTokens(value, question.prompt.type);
  });
  const inlineRationale = typeof rawAnswer === "string"
    ? splitAnswerAndRationale(rawAnswer.trim()).rationale
    : parts.inlineRationale;
  const hasOtherText = Boolean(parts.otherText);
  const hasOtherToken = parsedValues.some((value) => isOtherAnswerToken(question, value));
  if (hasOtherText && !hasOtherToken) {
    throw new Error("Other text requires selecting the LongTable question Other option.");
  }
  const selectionTokens = parts.otherText
    ? parsedValues.filter((value) => !isOtherAnswerToken(question, value))
    : parsedValues;
  const tokens = uniqueStrings([
    ...selectionTokens,
    ...(parts.otherText ? [parts.otherText] : [])
  ]);

  if (tokens.length === 0) {
    throw new Error("LongTable question answers cannot be empty.");
  }

  if (question.prompt.type !== "multi_choice" && tokens.length > 1) {
    throw new Error("Single-choice LongTable questions accept exactly one answer.");
  }

  const resolved = tokens.map((token) => resolveQuestionAnswerToken(question, token));
  const selectedValues = uniqueStrings(resolved.map((entry) => entry.selectedValue));
  const selectedLabels = selectedValues.map((value) => {
    const entry = resolved.find((candidate) => candidate.selectedValue === value);
    return entry?.selectedLabel ?? value;
  });
  const otherText = parts.otherText ?? resolved.map((entry) => entry.otherText).find(Boolean);

  return {
    selectedValues,
    selectedLabels,
    ...(otherText ? { otherText } : {}),
    ...(inlineRationale ? { inlineRationale } : {})
  };
}

export async function answerWorkspaceQuestion(options: {
  context: LongTableProjectContext;
  questionId?: string;
  answer: WorkspaceQuestionAnswerInput;
  rationale?: string;
  provider?: "codex" | "claude";
  surface?: QuestionSurface;
}): Promise<{
  question: QuestionRecord;
  decision: DecisionRecord;
  state: ResearchState;
}> {
  const state = await loadResearchState(options.context.stateFilePath);
  const question = findQuestionForDecision(state, options.questionId);
  if (!question) {
    throw new Error(options.questionId ? `No pending LongTable question found for ${options.questionId}.` : "No pending LongTable question was found.");
  }

  const normalized = normalizeQuestionAnswerSelection(question, options.answer);
  const rationale = [normalized.inlineRationale, options.rationale]
    .filter((entry): entry is string => Boolean(entry && entry.trim()))
    .join("\n");
  const answer: QuestionAnswer = {
    promptId: question.prompt.id,
    selectedValues: normalized.selectedValues,
    selectedLabels: normalized.selectedLabels,
    ...(normalized.otherText ? { otherText: normalized.otherText } : {}),
    ...(rationale ? { rationale } : {}),
    ...(options.provider ? { provider: options.provider } : {}),
    surface: options.surface ?? (options.provider === "claude" ? "native_structured" : "numbered")
  };

  const timestamp = nowIso();
  const decision: DecisionRecord = {
    id: createId("decision"),
    timestamp,
    checkpointKey: question.prompt.checkpointKey ?? "manual",
    level: question.prompt.required ? "adaptive_required" : "recommended",
    mode: "commit",
    summary: `Answered ${question.prompt.title}: ${answer.selectedLabels.join(", ")}`,
    ...(question.commitmentFamily ? { commitmentFamily: question.commitmentFamily } : {}),
    ...(question.epistemicBasis ? { epistemicBasis: question.epistemicBasis } : {}),
    selectedOption: answer.selectedValues[0],
    selectedOptions: answer.selectedValues,
    ...(rationale ? { rationale } : {})
  };

  const answeredQuestion: QuestionRecord = {
    ...question,
    updatedAt: timestamp,
    status: "answered",
    answer,
    decisionRecordId: decision.id
  };

  const withQuestion = {
    ...state,
    questionLog: (state.questionLog ?? []).map((record) =>
      record.id === question.id ? answeredQuestion : record
    ),
    invocationLog: (state.invocationLog ?? []).map((record) =>
      updateInvocationWithDecision(record, question.id, decision.id)
    )
  };
  const withDecision = appendDecisionToResearchState(withQuestion, decision);
  let updated = resolveQuestionObligationByQuestionId(withDecision, question.id, decision.id);

  if (question.prompt.checkpointKey === "research_specification_confirmation") {
    const specification = (updated as LongTableWorkspaceState).researchSpecification ?? options.context.session.researchSpecification;
    const selectedAnswer = answer.selectedValues[0];
    if (specification) {
      const nextStatus = researchSpecificationAnswerStatus(selectedAnswer);
      const confirmedSpecification: ResearchSpecification = {
        ...specification,
        status: nextStatus,
        updatedAt: timestamp,
        ...(nextStatus === "confirmed" ? { confirmedAt: specification.confirmedAt ?? timestamp } : {})
      };
      const withHookStatus: LongTableWorkspaceState = {
        ...(updated as LongTableWorkspaceState),
        hooks: ((updated as LongTableWorkspaceState).hooks ?? []).map((hook) => {
          if (hook.id !== confirmedSpecification.sourceHookId) {
            return hook;
          }
          return {
            ...hook,
            status: nextStatus === "draft" ? "active" : nextStatus,
            updatedAt: timestamp,
            researchSpecification: confirmedSpecification,
            linkedQuestionRecordIds: mergeStringLists(hook.linkedQuestionRecordIds, [question.id]),
            linkedDecisionRecordIds: mergeStringLists(hook.linkedDecisionRecordIds, [decision.id])
          };
        })
      };
      const sourceEvidenceIds = (withHookStatus.evidenceRecords ?? [])
        .filter((record) => record.sourceHookId && record.sourceHookId === confirmedSpecification.sourceHookId)
        .map((record) => record.id);
      updated = applyResearchSpecificationAuditUpdate(withHookStatus, {
        specification: confirmedSpecification,
        timestamp,
        source: "decision",
        title: `Research Specification confirmation: ${confirmedSpecification.title}`,
        rationale: `Research Specification confirmation answer: ${selectedAnswer}`,
        sourceEvidenceIds,
        questionRecordId: question.id,
        decisionRecordId: decision.id,
        createDecisionRecord: false
      }).state;
      options.context.session = {
        ...options.context.session,
        researchSpecification: confirmedSpecification,
        lastUpdatedAt: timestamp
      };
      await writeFile(options.context.sessionFilePath, JSON.stringify(options.context.session, null, 2), "utf8");
    }
  }

  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);

  return {
    question: answeredQuestion,
    decision,
    state: updated
  };
}

export async function clearWorkspaceQuestion(options: {
  context: LongTableProjectContext;
  questionId: string;
  reason: string;
}): Promise<{
  question: QuestionRecord;
  state: ResearchState;
}> {
  const state = await loadResearchState(options.context.stateFilePath);
  const question = findPendingQuestionForClear(state, options.questionId);
  if (!question) {
    throw new Error(`No pending LongTable question found for ${options.questionId}.`);
  }

  const timestamp = nowIso();
  const clearedQuestion: QuestionRecord = {
    ...question,
    updatedAt: timestamp,
    status: "cleared",
    clearedReason: options.reason.trim()
  };

  const withQuestion = {
    ...state,
    questionLog: (state.questionLog ?? []).map((record) =>
      record.id === question.id ? clearedQuestion : record
    )
  };
  const updated = resolveQuestionObligationByQuestionId(withQuestion, question.id, undefined, "cleared");

  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);

  return {
    question: clearedQuestion,
    state: updated
  };
}

function isPrunableFalsePositiveQuestion(record: QuestionRecord): boolean {
  if (record.status !== "cleared") {
    return false;
  }
  return /false-positive|duplicated automatic hook/i.test(record.clearedReason ?? "");
}

export async function pruneWorkspaceQuestions(options: {
  context: LongTableProjectContext;
  dryRun?: boolean;
}): Promise<{
  removedQuestions: QuestionRecord[];
  state: ResearchState;
}> {
  const state = await loadResearchState(options.context.stateFilePath);
  const removedQuestions = (state.questionLog ?? []).filter(isPrunableFalsePositiveQuestion);
  if (removedQuestions.length === 0 || options.dryRun) {
    return {
      removedQuestions,
      state
    };
  }

  const removedIds = new Set(removedQuestions.map((question) => question.id));
  const updated: ResearchState = {
    ...state,
    questionLog: (state.questionLog ?? []).filter((question) => !removedIds.has(question.id)),
    questionObligations: (state.questionObligations ?? []).filter((obligation) =>
      !obligation.questionId || !removedIds.has(obligation.questionId)
    ),
    invocationLog: (state.invocationLog ?? []).map((record) => ({
      ...record,
      ...(record.panelResult
        ? {
            panelResult: {
              ...record.panelResult,
              linkedQuestionRecordIds: record.panelResult.linkedQuestionRecordIds.filter((id) => !removedIds.has(id))
            }
          }
        : {}),
      ...(record.teamDebateRun
        ? {
            teamDebateRun: {
              ...record.teamDebateRun,
              linkedQuestionRecordIds: record.teamDebateRun.linkedQuestionRecordIds.filter((id) => !removedIds.has(id))
            }
          }
        : {})
    }))
  };

  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);

  return {
    removedQuestions,
    state: updated
  };
}

export async function repairWorkspaceStateConsistency(options: {
  context: LongTableProjectContext;
}): Promise<{
  state: ResearchState;
  repaired: string[];
}> {
  const state = await loadResearchState(options.context.stateFilePath);
  const repaired: string[] = [];
  const hooks = state.hooks ?? [];
  const hookMatchedByHandle = state.firstResearchShape?.confirmedAt
    ? hooks.find((hook) =>
        hook.kind === "longtable_interview" &&
        hook.firstResearchShape?.handle === state.firstResearchShape?.handle
      )
    : undefined;
  const confirmedShape = state.firstResearchShape?.confirmedAt
    ? {
        ...state.firstResearchShape,
        ...(state.firstResearchShape.sourceHookId
          ? {}
          : hookMatchedByHandle?.id
            ? { sourceHookId: hookMatchedByHandle.id }
            : {})
      }
    : undefined;

  let updated = state;
  if (confirmedShape && confirmedShape.sourceHookId && !state.firstResearchShape?.sourceHookId) {
    repaired.push(`restored sourceHookId ${confirmedShape.sourceHookId} on confirmed first research shape`);
    updated = {
      ...updated,
      firstResearchShape: confirmedShape,
      workingState: {
        ...updated.workingState,
        firstResearchShape: confirmedShape
      }
    };
  }

  if (confirmedShape?.sourceHookId) {
    const hooks = (updated.hooks ?? []).map((hook) => {
      if (
        hook.id === confirmedShape.sourceHookId &&
        hook.kind === "longtable_interview" &&
        hook.status !== "confirmed"
      ) {
        repaired.push(`confirmed interview hook ${hook.id}`);
        return {
          ...hook,
          status: "confirmed" as const,
          updatedAt: nowIso(),
          firstResearchShape: confirmedShape
        };
      }
      return hook;
    });
    updated = {
      ...updated,
      hooks
    };
  }

  if (confirmedShape?.sourceHookId) {
    updated = {
      ...updated,
      questionObligations: (updated.questionObligations ?? []).map((obligation) => {
        if (
          obligation.kind === "first_research_shape_confirmation" &&
          obligation.status === "pending" &&
          obligation.sourceHookId === confirmedShape.sourceHookId
        ) {
          repaired.push(`cleared first research shape obligation ${obligation.id}`);
          return {
            ...obligation,
            status: "satisfied" as const,
            updatedAt: nowIso()
          };
        }
        return obligation;
      })
    };
  }

  if (repaired.length > 0) {
    await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
    await syncCurrentWorkspaceView(options.context);
  }

  return { state: updated, repaired };
}

export async function createOrUpdateProjectWorkspace(options: {
  projectName: string;
  projectPath: string;
  currentGoal: string;
  currentBlocker?: string;
  researchObject?: string;
  gapRisk?: string;
  protectedDecision?: string;
  startInterview?: StartInterviewSession;
  requestedPerspectives: string[];
  disagreementPreference: ProjectDisagreementPreference;
  setup: SetupPersistedOutput;
}): Promise<LongTableProjectContext> {
  const projectPath = resolve(options.projectPath);
  const metaDir = resolveMetaDir(projectPath);
  const sessionsDir = join(metaDir, "sessions");
  const projectFilePath = join(metaDir, "project.json");
  const sessionFilePath = join(metaDir, "current-session.json");
  const stateFilePath = resolveStateFilePath(projectPath);
  const currentFilePath = resolveCurrentFilePath(projectPath);
  const sessionId = slugify(`${options.projectName}-${Date.now()}`);
  const locale = resolveUserLocale();
  const timestamp = nowIso();

  await mkdir(projectPath, { recursive: true });
  await mkdir(metaDir, { recursive: true });
  await mkdir(sessionsDir, { recursive: true });

  const project: LongTableProjectRecord = existsSync(projectFilePath)
    ? {
        ...(JSON.parse(await readFile(projectFilePath, "utf8")) as LongTableProjectRecord),
        projectPath,
        contractVersion: "workspace-v2",
        locale
      }
    : {
        schemaVersion: 1,
        product: "LongTable",
        projectName: options.projectName,
        projectPath,
        createdAt: timestamp,
        contractVersion: "workspace-v2",
        locale,
        globalSetupSummary: {
          field: options.setup.profileSeed.field ?? "unspecified",
          careerStage: options.setup.profileSeed.careerStage ?? "unspecified",
          experienceLevel: options.setup.profileSeed.experienceLevel ?? "advanced",
          checkpointIntensity: options.setup.profileSeed.preferredCheckpointIntensity ?? "balanced",
          ...(options.setup.profileSeed.humanAuthorshipSignal
            ? { humanAuthorshipSignal: options.setup.profileSeed.humanAuthorshipSignal }
            : {}),
          ...(options.setup.profileSeed.weakestDomain
            ? { weakestDomain: options.setup.profileSeed.weakestDomain }
            : {}),
          ...(options.setup.profileSeed.panelPreference
            ? { defaultPanelPreference: options.setup.profileSeed.panelPreference }
            : {})
        }
      };

  const session: LongTableSessionRecord = {
    schemaVersion: 1,
    id: sessionId,
    createdAt: timestamp,
    lastUpdatedAt: timestamp,
    projectName: project.projectName,
    projectPath,
    currentGoal: options.currentGoal,
    ...(options.currentBlocker ? { currentBlocker: options.currentBlocker } : {}),
    ...(options.researchObject ? { researchObject: options.researchObject } : {}),
    ...(options.gapRisk ? { gapRisk: options.gapRisk } : {}),
    ...(options.protectedDecision ? { protectedDecision: options.protectedDecision } : {}),
    ...(options.startInterview ? { startInterview: options.startInterview } : {}),
    nextAction: buildNextAction({
      schemaVersion: 1,
      id: sessionId,
      createdAt: timestamp,
      projectName: project.projectName,
      projectPath,
      currentGoal: options.currentGoal,
      ...(options.currentBlocker ? { currentBlocker: options.currentBlocker } : {}),
      ...(options.researchObject ? { researchObject: options.researchObject } : {}),
      ...(options.gapRisk ? { gapRisk: options.gapRisk } : {}),
      ...(options.protectedDecision ? { protectedDecision: options.protectedDecision } : {}),
      ...(options.startInterview ? { startInterview: options.startInterview } : {}),
      requestedPerspectives: options.requestedPerspectives,
      disagreementPreference: options.disagreementPreference
    }),
    openQuestions: buildOpenQuestions({
      schemaVersion: 1,
      id: sessionId,
      createdAt: timestamp,
      projectName: project.projectName,
      projectPath,
      currentGoal: options.currentGoal,
      ...(options.currentBlocker ? { currentBlocker: options.currentBlocker } : {}),
      ...(options.researchObject ? { researchObject: options.researchObject } : {}),
      ...(options.gapRisk ? { gapRisk: options.gapRisk } : {}),
      ...(options.protectedDecision ? { protectedDecision: options.protectedDecision } : {}),
      ...(options.startInterview ? { startInterview: options.startInterview } : {}),
      requestedPerspectives: options.requestedPerspectives,
      disagreementPreference: options.disagreementPreference
    }),
    requestedPerspectives: options.requestedPerspectives,
    disagreementPreference: options.disagreementPreference,
    activeModes: ["explore"],
    resumeHint: buildResumeHint({
      schemaVersion: 1,
      id: sessionId,
      createdAt: timestamp,
      projectName: project.projectName,
      projectPath,
      currentGoal: options.currentGoal,
      ...(options.currentBlocker ? { currentBlocker: options.currentBlocker } : {}),
      ...(options.researchObject ? { researchObject: options.researchObject } : {}),
      ...(options.gapRisk ? { gapRisk: options.gapRisk } : {}),
      ...(options.protectedDecision ? { protectedDecision: options.protectedDecision } : {}),
      ...(options.startInterview ? { startInterview: options.startInterview } : {}),
      requestedPerspectives: options.requestedPerspectives,
      disagreementPreference: options.disagreementPreference
    }),
    locale
  };

  const context: LongTableProjectContext = {
    project,
    session,
    projectFilePath,
    sessionFilePath,
    stateFilePath,
    currentFilePath,
    metaDir
  };

  await writeFile(projectFilePath, JSON.stringify(project, null, 2), "utf8");
  await writeFile(sessionFilePath, JSON.stringify(session, null, 2), "utf8");
  await writeFile(join(sessionsDir, `${sessionId}.json`), JSON.stringify(session, null, 2), "utf8");
  await writeFile(stateFilePath, buildStateSeed(project, session, options.setup), "utf8");
  await writeFile(join(projectPath, "AGENTS.md"), buildProjectAgentsMd(project, session), "utf8");
  await syncCurrentWorkspaceView(context);
  await removeLegacyRootFiles(projectPath);

  return context;
}

export async function loadProjectContextFromDirectory(
  startPath: string
): Promise<LongTableProjectContext | null> {
  let current = resolve(startPath);

  while (true) {
    const metaDir = resolveMetaDir(current);
    const projectFilePath = join(metaDir, "project.json");
    const sessionFilePath = join(metaDir, "current-session.json");

    if (existsSync(projectFilePath) && existsSync(sessionFilePath)) {
      const workspaceRoot = current;
      const project = {
        ...(JSON.parse(await readFile(projectFilePath, "utf8")) as LongTableProjectRecord),
        projectPath: workspaceRoot
      };
      const session = {
        ...(JSON.parse(await readFile(sessionFilePath, "utf8")) as LongTableSessionRecord),
        projectPath: workspaceRoot
      };

      return {
        project,
        session: {
          ...session,
          locale: session.locale ?? project.locale ?? resolveUserLocale(),
          openQuestions: session.openQuestions ?? buildOpenQuestions(session),
          nextAction: session.nextAction ?? buildNextAction(session),
          resumeHint: session.resumeHint ?? buildResumeHint(session),
          activeModes: session.activeModes ?? ["explore"]
        },
        projectFilePath,
        sessionFilePath,
        stateFilePath: resolveStateFilePath(workspaceRoot),
        currentFilePath: resolveCurrentFilePath(workspaceRoot),
        metaDir
      };
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export async function inspectProjectWorkspace(
  startPath: string
): Promise<LongTableWorkspaceInspection> {
  const context = await loadProjectContextFromDirectory(startPath);
  if (!context) {
    return { found: false };
  }

  const state = await loadResearchState(context.stateFilePath);
  return summarizeWorkspaceInspection(context, state);
}

export function renderProjectWorkspaceSummary(context: LongTableProjectContext): string {
  return [
    "┌─ LongTable Project Workspace ─────────────────────────┐",
    "└───────────────────────────────────────────────────────┘",
    `Project: ${context.project.projectName}`,
    `Path: ${context.project.projectPath}`,
    "",
    "┌─ Current Research Shape ──────────────────────────────┐",
    `Goal: ${context.session.currentGoal}`,
    ...(context.session.currentBlocker ? [`Blocker: ${context.session.currentBlocker}`] : []),
    ...(context.session.researchObject ? [`Working object: ${context.session.researchObject}`] : []),
    ...(context.session.firstResearchShape ? [`First Research Shape: ${context.session.firstResearchShape.handle}`] : []),
    ...(context.session.startInterview ? [`Start interview: ${context.session.startInterview.summary}`] : []),
    "└───────────────────────────────────────────────────────┘",
    "",
    `Perspectives: ${context.session.requestedPerspectives.length > 0 ? context.session.requestedPerspectives.join(", ") : "auto"}`,
    `Disagreement: ${context.session.disagreementPreference}`,
    "",
    "Created files:",
    `- ${context.projectFilePath}`,
    `- ${context.sessionFilePath}`,
    `- ${context.stateFilePath}`,
    `- ${context.currentFilePath}`,
    `- ${join(context.project.projectPath, "AGENTS.md")}`
  ].join("\n");
}
