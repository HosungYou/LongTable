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
  InvocationRecord,
  LongTableQuestionObligation,
  ProviderKind,
  QuestionOption,
  QuestionAnswer,
  QuestionGenerationResult,
  QuestionOpportunity,
  QuestionSurface,
  QuestionRecord,
  ResearchState
} from "@longtable/core";
import type { SetupPersistedOutput } from "@longtable/setup";
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
  qualityNotes?: string[];
  rationale?: string[];
  linkedQuestionRecordIds?: string[];
  linkedDecisionRecordIds?: string[];
}

export type LongTableWorkspaceState = ResearchState & {
  hooks?: LongTableHookRun[];
  firstResearchShape?: FirstResearchShape;
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
    answeredQuestions: number;
    decisions: number;
  };
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
    options: string[];
    required: boolean;
  }>;
  pendingObligations?: Array<{
    id: string;
    kind: string;
    prompt: string;
    reason: string;
    questionId?: string;
  }>;
  recentDecisions?: Array<{
    id: string;
    checkpointKey: string;
    summary: string;
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

function buildCurrentGuide(
  project: LongTableProjectRecord,
  session: LongTableSessionRecord,
  recentInvocations: InvocationRecord[] = [],
  pendingQuestions: QuestionRecord[] = [],
  pendingObligations: LongTableQuestionObligation[] = []
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
      ...(session.startInterview ? [`- start interview: ${session.startInterview.summary}`] : []),
      `- 다음 액션: ${nextAction}`,
      `- 관점: ${session.requestedPerspectives.length > 0 ? session.requestedPerspectives.join(", ") : "auto"}`,
      `- disagreement: ${session.disagreementPreference}`,
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
              return `- ${record.id}: ${record.prompt.question} (${options})`;
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
      "",
      "## 빠른 시작",
      "- 이 디렉토리에서 `codex`를 엽니다.",
      `- 첫 메시지는 보통 \`${session.firstResearchShape ? suggestedPrompt : "$longtable-interview"}\` 정도면 충분합니다.`,
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
    ...(session.startInterview ? [`- Start interview: ${session.startInterview.summary}`] : []),
    `- Next action: ${nextAction}`,
    `- Perspectives: ${session.requestedPerspectives.length > 0 ? session.requestedPerspectives.join(", ") : "auto"}`,
    `- Disagreement: ${session.disagreementPreference}`,
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
            return `- ${record.id}: ${record.prompt.question} (${options})`;
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
    "",
    "## Quick Start",
    "- Open `codex` in this directory.",
    `- A good first message is usually \`${session.firstResearchShape ? suggestedPrompt : "$longtable-interview"}\`.`,
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

function summarizeWorkspaceInspection(
  context: LongTableProjectContext,
  state: ResearchState
): LongTableWorkspaceInspection {
  const questions = state.questionLog ?? [];
  const pendingQuestions = questions.filter((record) => record.status === "pending");
  const answeredQuestions = questions.filter((record) => record.status === "answered");
  const pendingObligations = visiblePendingObligations(state);

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
      disagreementPreference: context.session.disagreementPreference
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
      answeredQuestions: answeredQuestions.length,
      decisions: (state.decisionLog ?? []).length
    },
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
      options: formatQuestionOptionValues(record),
      required: record.prompt.required
    })),
    pendingObligations: pendingObligations.slice(-5).reverse().map((obligation) => ({
      id: obligation.id,
      kind: obligation.kind,
      prompt: obligation.prompt,
      reason: obligation.reason,
      ...(obligation.questionId ? { questionId: obligation.questionId } : {})
    })),
    recentDecisions: (state.decisionLog ?? []).slice(-5).reverse().map((record) => ({
      id: record.id,
      checkpointKey: record.checkpointKey,
      summary: record.summary,
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
    "- If the user message starts with `$longtable-interview`, run the LongTable interview flow before generic research advice.",
    "- If the user message starts with `lt `, `longtable `, `long table `, or `롱테이블 ` followed by a directive and `:`, treat it as an explicit LongTable invocation.",
    "- Supported explicit directives are: interview, explore, review, critique, draft, commit, panel, status, editor, reviewer, methods, theory, measurement, ethics, voice, venue.",
    "- For explicit LongTable invocations, do not begin by scanning the workspace. Use the current session files first and answer as LongTable immediately.",
    "- For general research requests in this workspace, prefer LongTable behavior before generic coding behavior.",
    "",
    "## Research Behavior",
    "- Begin exploratory work with clarifying or tension questions before recommending a direction.",
    "- For `$longtable-interview`, ask one natural-language question at a time, reflect with `LongTable hears: ...`, record turns when MCP is available, and avoid early reader/reviewer or theory/method/measurement classification.",
    "- Do not summarize `$longtable-interview` because a fixed number of turns has passed; wait for content-based readiness around research object, focal uncertainty, boundary, evidence/material, protected decision, and next action.",
    "- Do not let unrelated pending Researcher Checkpoints interrupt `$longtable-interview`; mention them only as separate unresolved checkpoints unless the researcher is confirming, saving, or recording a research decision.",
    "- Use structured options only at the final First Research Shape confirmation or at true checkpoint boundaries.",
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
  const body = buildCurrentGuide(
    context.project,
    context.session,
    recentInvocationRecords(state),
    recentPendingQuestions(state),
    recentPendingObligations(state)
  );
  await writeFile(context.currentFilePath, body, "utf8");
  return context.currentFilePath;
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
  await writeFile(context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return updated as LongTableWorkspaceState;
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
      "Official LongTable research start surface is provider-native `$longtable-interview`, not the CLI start questionnaire.",
      "The hook keeps early research ambiguity open until a first research handle can be summarized."
    ]
  };

  let updated = upsertHook(state, hook);
  updated.workingState = {
    ...updated.workingState,
    activeInterviewHookId: hook.id,
    interviewSurface: "$longtable-interview",
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
  const updated = upsertHook(state, hook);
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
    source: "$longtable-interview",
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

function followUpQuestionOptions(
  first: QuestionOption,
  second: QuestionOption,
  third: QuestionOption,
  fourth?: QuestionOption
): QuestionOption[] {
  return [first, second, third, ...(fourth ? [fourth] : [])];
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
    selected = selected.filter((spec) => spec.kind === "research_commitment");
  }
  return selected;
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

function hasFollowUpPrompt(record: QuestionRecord, prompt: string): boolean {
  return record.prompt.rationale.includes(`${FOLLOW_UP_PROMPT_PREFIX} ${prompt}`);
}

export async function createWorkspaceFollowUpQuestions(options: {
  context: LongTableProjectContext;
  prompt: string;
  provider?: ProviderKind;
  required?: boolean;
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

  const questions: QuestionRecord[] = specsToCreate.map((spec) => ({
    id: createId("question_record"),
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    prompt: {
      id: createId("question_prompt"),
      checkpointKey: `follow_up_${spec.key}`,
      title: spec.title,
      question: spec.question,
      type: "single_choice",
      options: spec.options,
      allowOther: true,
      otherLabel: "Other",
      required: options.required ?? spec.required,
      source: "runtime_guidance",
      rationale: [
        spec.whyNow,
        `Question kind: ${spec.kind}`,
        `Question confidence: ${spec.confidence}`,
        `${FOLLOW_UP_PROMPT_PREFIX} ${options.prompt}`
      ],
      preferredSurfaces: preferredSurfaces as QuestionSurface[]
    }
  }));

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
  checkpointKey?: string;
  questionOptions?: QuestionOption[];
  displayReason?: string;
  provider?: ProviderKind;
  required?: boolean;
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
  const createdAt = nowIso();
  const question: QuestionRecord = {
    id: createId("question_record"),
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    prompt: {
      id: createId("question_prompt"),
      checkpointKey,
      title: options.title ?? questionTitleForCheckpoint(trigger.family, checkpointKey),
      question: options.question ?? questionTextForCheckpoint(trigger.family, options.prompt, checkpointKey),
      type: "single_choice",
      options: options.questionOptions ?? optionsForCheckpointTrigger(trigger.family, checkpointKey),
      allowOther: true,
      otherLabel: "Other decision",
      required: options.required ?? trigger.requiresQuestionBeforeClosure,
      source: "checkpoint",
      displayReason: options.displayReason ?? trigger.rationale[0],
      rationale: [
        ...trigger.rationale,
        `Trigger family: ${trigger.family}.`,
        `Trigger confidence: ${trigger.confidence}.`,
        `Original prompt: ${options.prompt}`
      ],
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

function normalizeQuestionAnswerSelection(
  question: QuestionRecord,
  rawAnswer: string
): {
  selectedValue: string;
  selectedLabel: string;
  otherText?: string;
  inlineRationale?: string;
} {
  const trimmed = rawAnswer.trim();
  const { selection, rationale } = splitAnswerAndRationale(trimmed);
  const numeric = Number(selection);
  if (/^\d+$/.test(selection) && Number.isInteger(numeric)) {
    const option = question.prompt.options[numeric - 1];
    if (option) {
      return {
        selectedValue: option.value,
        selectedLabel: option.label,
        ...(rationale ? { inlineRationale: rationale } : {})
      };
    }

    if (question.prompt.allowOther && numeric === question.prompt.options.length + 1) {
      return {
        selectedValue: "other",
        selectedLabel: question.prompt.otherLabel ?? "Other",
        ...(rationale ? { inlineRationale: rationale } : {})
      };
    }

    throw new Error(`Answer ${selection} is outside the available LongTable question options.`);
  }

  const normalizedSelection = normalizeAnswerToken(selection);
  const option = question.prompt.options.find((candidate) =>
    optionAnswerCandidates(candidate).includes(normalizedSelection)
  );
  if (option) {
    return {
      selectedValue: option.value,
      selectedLabel: option.label,
      ...(rationale ? { inlineRationale: rationale } : {})
    };
  }

  if (normalizedSelection === "other" && question.prompt.allowOther) {
    return {
      selectedValue: "other",
      selectedLabel: question.prompt.otherLabel ?? "Other",
      ...(rationale ? { inlineRationale: rationale } : {})
    };
  }

  if (question.prompt.allowOther) {
    return {
      selectedValue: "other",
      selectedLabel: selection,
      otherText: trimmed,
      ...(rationale ? { inlineRationale: rationale } : {})
    };
  }

  throw new Error(`Answer "${selection}" does not match a LongTable question option.`);
}

export async function answerWorkspaceQuestion(options: {
  context: LongTableProjectContext;
  questionId?: string;
  answer: string;
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
    selectedValues: [normalized.selectedValue],
    selectedLabels: [normalized.selectedLabel],
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
    selectedOption: answer.selectedValues[0],
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
  const updated = resolveQuestionObligationByQuestionId(withDecision, question.id, decision.id);

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
