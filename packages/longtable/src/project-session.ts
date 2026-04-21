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
  ProviderKind,
  QuestionOption,
  QuestionAnswer,
  QuestionSurface,
  QuestionRecord,
  ResearchState
} from "@longtable/core";
import type { SetupPersistedOutput } from "@longtable/setup";

export type ProjectDisagreementPreference =
  | "synthesis_only"
  | "show_on_conflict"
  | "always_visible";

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
  nextAction?: string;
  openQuestions?: string[];
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
  return session.currentBlocker
    ? `What would reduce the uncertainty around "${session.currentBlocker}" first?`
    : `What is the first concrete question that would move "${session.currentGoal}" forward?`;
}

function buildOpenQuestions(session: LongTableSessionRecord): string[] {
  const firstQuestion = buildFirstQuestion(session);

  return session.currentBlocker
    ? [
        firstQuestion,
        `What evidence would let you decide whether "${session.currentBlocker}" is a knowledge gap, a coding rule gap, or a data gap?`
      ]
    : [
        firstQuestion,
        `What would count as a good first outcome for "${session.currentGoal}" in this session?`
      ];
}

function buildNextAction(session: LongTableSessionRecord): string {
  return session.currentBlocker
    ? `Open with the blocker, then ask LongTable to surface the first high-leverage uncertainty around "${session.currentBlocker}".`
    : "Open with your current goal in one sentence, then ask LongTable for the first concrete research move.";
}

function buildResumeHint(session: LongTableSessionRecord): string {
  return session.currentBlocker
    ? `I want to continue ${session.currentGoal}. The unresolved blocker is ${session.currentBlocker}.`
    : `I want to continue ${session.currentGoal}.`;
}

function buildCurrentGuide(
  project: LongTableProjectRecord,
  session: LongTableSessionRecord,
  recentInvocations: InvocationRecord[] = [],
  pendingQuestions: QuestionRecord[] = []
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
      "",
      "## 다시 시작 문장",
      `- "${resumeHint}"`,
      "",
      "## 빠른 시작",
      "- 이 디렉토리에서 `codex`를 엽니다.",
      `- 첫 메시지는 보통 \`${suggestedPrompt}\` 정도면 충분합니다.`,
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
    "",
    "## Restart Prompt",
    `- "${resumeHint}"`,
    "",
    "## Quick Start",
    "- Open `codex` in this directory.",
    `- A good first message is usually \`${suggestedPrompt}\`.`,
    "",
    "## Evidence Rule",
    "- External or current claims should carry a source link or be labeled as inference."
  ].join("\n");
}

async function loadResearchState(stateFilePath: string): Promise<ResearchState> {
  if (!existsSync(stateFilePath)) {
    return createEmptyResearchState();
  }

  const parsed = JSON.parse(await readFile(stateFilePath, "utf8")) as Partial<ResearchState>;
  return {
    ...parsed,
    explicitState: parsed.explicitState ?? {},
    workingState: parsed.workingState ?? {},
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

export async function loadWorkspaceState(context: LongTableProjectContext): Promise<ResearchState> {
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
    "- If the user message starts with `lt `, `longtable `, `long table `, or `롱테이블 ` followed by a directive and `:`, treat it as an explicit LongTable invocation.",
    "- Supported explicit directives are: explore, review, critique, draft, commit, panel, status, editor, reviewer, methods, theory, measurement, ethics, voice, venue.",
    "- For explicit LongTable invocations, do not begin by scanning the workspace. Use the current session files first and answer as LongTable immediately.",
    "- For general research requests in this workspace, prefer LongTable behavior before generic coding behavior.",
    "",
    "## Research Behavior",
    "- Begin exploratory work with clarifying or tension questions before recommending a direction.",
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
  const state = createEmptyResearchState();
  state.explicitState = {
    field: setup.profileSeed.field ?? "unspecified",
    careerStage: setup.profileSeed.careerStage,
    experienceLevel: setup.profileSeed.experienceLevel,
    projectName: project.projectName,
    disagreementPreference: session.disagreementPreference,
    requestedPerspectives: session.requestedPerspectives
  };
  state.workingState = {
    currentGoal: session.currentGoal,
    ...(session.currentBlocker ? { currentBlocker: session.currentBlocker } : {}),
    ...(session.nextAction ? { nextAction: session.nextAction } : {}),
    openQuestions: session.openQuestions ?? [],
    activeModes: session.activeModes ?? [],
    ...(session.resumeHint ? { resumeHint: session.resumeHint } : {})
  };
  if (session.currentBlocker) {
    state.openTensions.push(session.currentBlocker);
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
    recentPendingQuestions(state)
  );
  await writeFile(context.currentFilePath, body, "utf8");
  return context.currentFilePath;
}

export async function appendInvocationRecordToWorkspace(
  context: LongTableProjectContext,
  invocation: InvocationRecord,
  questions: QuestionRecord[] = []
): Promise<ResearchState> {
  const state = await loadResearchState(context.stateFilePath);
  const withInvocation = appendInvocationToResearchState(state, invocation);
  const updated = questions.length > 0
    ? appendQuestionRecords(withInvocation, questions)
    : withInvocation;
  await writeFile(context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return updated;
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

export async function assertWorkspaceNotBlocked(context: LongTableProjectContext): Promise<void> {
  const blocking = await listBlockingWorkspaceQuestions(context);
  if (blocking.length === 0) {
    return;
  }

  const first = blocking[0];
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

function questionTitleForCheckpoint(family: string): string {
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

function questionTextForCheckpoint(family: string, prompt: string): string {
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

interface ClarificationQuestionSpec {
  key: string;
  title: string;
  question: string;
  whyNow: string;
  options: QuestionOption[];
}

function includesAny(prompt: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(prompt));
}

function clarificationOptions(
  first: QuestionOption,
  second: QuestionOption,
  third: QuestionOption,
  fourth?: QuestionOption
): QuestionOption[] {
  return [first, second, third, ...(fourth ? [fourth] : [])];
}

function buildClarificationQuestionSpecs(prompt: string): ClarificationQuestionSpec[] {
  const normalized = prompt.toLowerCase();
  const specs: ClarificationQuestionSpec[] = [];

  function push(spec: ClarificationQuestionSpec): void {
    if (!specs.some((candidate) => candidate.key === spec.key)) {
      specs.push(spec);
    }
  }

  if (includesAny(normalized, [/\brubrics?\b/, /루브릭|채점기준/])) {
    push({
      key: "rubric_update_basis",
      title: "Rubric update basis",
      question: "How should LongTable use the available materials to update the rubric?",
      whyNow: "Rubric updates can silently change grading criteria if LongTable guesses the calibration basis.",
      options: clarificationOptions(
        { value: "calibrate_to_exemplars", label: "Calibrate criteria to exemplars", description: "Use strong submissions to refine what each criterion means.", recommended: true },
        { value: "polish_existing", label: "Polish existing rubric only", description: "Keep criteria stable and improve wording or consistency." },
        { value: "rewrite_structure", label: "Restructure the rubric", description: "Change categories or levels where the materials suggest a better structure." }
      )
    });
  }

  if (includesAny(normalized, [/\bexemplar\b/, /\bbest submission\b/, /\bselected submission\b/, /\bTA\b/i, /우수\s*답안|예시|선정|조교/])) {
    push({
      key: "exemplar_use",
      title: "Exemplar use",
      question: "How should LongTable use selected exemplars or TA guidance?",
      whyNow: "Exemplars can either calibrate criteria privately or become visible evidence inside the output.",
      options: clarificationOptions(
        { value: "calibrate_only", label: "Use as private calibration", description: "Adjust criteria using exemplars without quoting them.", recommended: true },
        { value: "include_deidentified_excerpts", label: "Include de-identified excerpts", description: "Add short anonymized examples where they clarify quality." },
        { value: "separate_notes", label: "Keep examples in separate notes", description: "Use exemplars outside the main artifact." }
      )
    });
  }

  if (includesAny(normalized, [/\binstruction/, /\bguidance\b/, /\bsource\b/, /\bfile\b/, /\bdocx?\b/, /지침|가이드|문서|파일|자료/])) {
    push({
      key: "source_authority",
      title: "Source authority",
      question: "If sources conflict or leave gaps, which source should LongTable privilege?",
      whyNow: "Without an authority rule, LongTable may resolve conflicts by convenience rather than researcher intent.",
      options: clarificationOptions(
        { value: "explicit_user_instruction", label: "Your explicit instruction", description: "Use the researcher's current instruction as the highest authority.", recommended: true },
        { value: "project_files", label: "Project files", description: "Treat supplied files or existing artifacts as authoritative." },
        { value: "external_guidance", label: "TA or external guidance", description: "Prioritize instructor, TA, venue, or policy guidance." }
      )
    });
  }

  if (includesAny(normalized, [/\bdeliver\b/, /\boutput\b/, /\btracked?[- ]?change/, /\bdocx?\b/, /\bmarkdown\b/, /\btable\b/, /전달|산출물|결과물|수정\s*표시|트랙|형식|포맷/])) {
    push({
      key: "delivery_format",
      title: "Delivery format",
      question: "How should LongTable deliver the clarified output?",
      whyNow: "Format and change-tracking choices affect whether the result is usable for review or handoff.",
      options: clarificationOptions(
        { value: "tracked_changes", label: "Tracked-change artifact", description: "Produce a reviewable changed version where possible.", recommended: true },
        { value: "clean_final", label: "Clean final artifact", description: "Deliver the final version without change markup." },
        { value: "summary_plus_artifact", label: "Summary plus artifact", description: "Include a concise change summary with the output." }
      )
    });
  }

  if (includesAny(normalized, [/\bupdate\b/, /\bchange\b/, /\bedit\b/, /\bfix\b/, /\bimplement\b/, /\bbuild\b/, /\bcreate\b/, /업데이트|수정|변경|구현|만들|고쳐/])) {
    push({
      key: "autonomy_boundary",
      title: "Autonomy boundary",
      question: "How much should LongTable do before checking back with you?",
      whyNow: "Execution requests can move from advice to authorship or artifact ownership unless the boundary is explicit.",
      options: clarificationOptions(
        { value: "ask_then_act", label: "Clarify first, then act", description: "Ask needed questions before changing the artifact.", recommended: true },
        { value: "act_with_defaults", label: "Act with visible defaults", description: "Proceed using recommended defaults and record them." },
        { value: "recommend_only", label: "Recommend only", description: "Describe changes but do not alter artifacts." }
      )
    });
  }

  if (includesAny(normalized, [/\bperformance\b/, /\btest\b/, /\bevaluate\b/, /\bcheck\b/, /\bbenchmark\b/, /성능|테스트|평가|체크|검증/])) {
    push({
      key: "evaluation_target",
      title: "Evaluation target",
      question: "What should LongTable treat as the main performance target?",
      whyNow: "Performance checks can optimize for UX, correctness, trigger sensitivity, or delivery reliability.",
      options: clarificationOptions(
        { value: "question_sensitivity", label: "Question sensitivity", description: "Check whether LongTable asks at the right knowledge-gap moments.", recommended: true },
        { value: "renderer_convenience", label: "Renderer convenience", description: "Check whether the most convenient question UI is used." },
        { value: "state_reliability", label: "State reliability", description: "Check whether questions and answers persist correctly." }
      )
    });
  }

  if (specs.length === 0) {
    push({
      key: "general_missing_context",
      title: "Missing context",
      question: "What should LongTable clarify before proceeding?",
      whyNow: "The request can be answered in multiple ways, and choosing silently would hide a researcher judgment.",
      options: clarificationOptions(
        { value: "scope", label: "Clarify scope first", description: "Ask what is included and excluded before acting.", recommended: true },
        { value: "criteria", label: "Clarify success criteria", description: "Ask what would count as a good result." },
        { value: "proceed", label: "Proceed with visible assumptions", description: "Continue, but make assumptions explicit." }
      )
    });
  }

  return specs;
}

const CLARIFICATION_PROMPT_PREFIX = "Clarification prompt:";

function hasClarificationPrompt(record: QuestionRecord, prompt: string): boolean {
  return record.prompt.rationale.includes(`${CLARIFICATION_PROMPT_PREFIX} ${prompt}`);
}

export async function createWorkspaceClarificationCard(options: {
  context: LongTableProjectContext;
  prompt: string;
  provider?: ProviderKind;
  required?: boolean;
  force?: boolean;
}): Promise<{
  questions: QuestionRecord[];
  state: ResearchState;
  created: boolean;
  alreadyAnswered: boolean;
}> {
  const state = await loadResearchState(options.context.stateFilePath);
  if (!options.force) {
    const existing = (state.questionLog ?? []).filter((record) => hasClarificationPrompt(record, options.prompt));
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
    : ["terminal_selector", "numbered", "native_structured"];
  const questions: QuestionRecord[] = buildClarificationQuestionSpecs(options.prompt).map((spec) => ({
    id: createId("question_record"),
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    prompt: {
      id: createId("question_prompt"),
      checkpointKey: `clarification_${spec.key}`,
      title: spec.title,
      question: spec.question,
      type: "single_choice",
      options: spec.options,
      allowOther: true,
      otherLabel: "Other",
      required: options.required ?? true,
      source: "runtime_guidance",
      rationale: [
        spec.whyNow,
        `${CLARIFICATION_PROMPT_PREFIX} ${options.prompt}`
      ],
      preferredSurfaces: preferredSurfaces as QuestionSurface[]
    }
  }));

  const updated = appendQuestionRecords(state, questions);
  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);

  return { questions, state: updated, created: true, alreadyAnswered: false };
}

export async function createWorkspaceQuestion(options: {
  context: LongTableProjectContext;
  prompt: string;
  title?: string;
  question?: string;
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
  const createdAt = nowIso();
  const question: QuestionRecord = {
    id: createId("question_record"),
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    prompt: {
      id: createId("question_prompt"),
      checkpointKey: trigger.signal.checkpointKey,
      title: options.title ?? questionTitleForCheckpoint(trigger.family),
      question: options.question ?? questionTextForCheckpoint(trigger.family, options.prompt),
      type: "single_choice",
      options: optionsForCheckpointTrigger(trigger.family, trigger.signal.checkpointKey),
      allowOther: true,
      otherLabel: "Other decision",
      required: options.required ?? trigger.requiresQuestionBeforeClosure,
      source: "checkpoint",
      rationale: [
        ...trigger.rationale,
        `Trigger family: ${trigger.family}.`,
        `Trigger confidence: ${trigger.confidence}.`,
        `Original prompt: ${options.prompt}`
      ],
      preferredSurfaces: options.provider === "claude"
        ? ["native_structured", "numbered"]
        : ["numbered", "native_structured"]
    }
  };

  const updated = appendQuestionRecords(state, [question]);
  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);

  return { question, state: updated };
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
  const updated = appendDecisionToResearchState(withQuestion, decision);

  await writeFile(options.context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(options.context);

  return {
    question: answeredQuestion,
    decision,
    state: updated
  };
}

export async function createOrUpdateProjectWorkspace(options: {
  projectName: string;
  projectPath: string;
  currentGoal: string;
  currentBlocker?: string;
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
          careerStage: options.setup.profileSeed.careerStage,
          experienceLevel: options.setup.profileSeed.experienceLevel,
          checkpointIntensity: options.setup.profileSeed.preferredCheckpointIntensity,
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
    nextAction: buildNextAction({
      schemaVersion: 1,
      id: sessionId,
      createdAt: timestamp,
      projectName: project.projectName,
      projectPath,
      currentGoal: options.currentGoal,
      ...(options.currentBlocker ? { currentBlocker: options.currentBlocker } : {}),
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
    "┌──────────────────────────────────────────────┐",
    "│ LongTable Project Workspace               │",
    "└──────────────────────────────────────────────┘",
    `Project: ${context.project.projectName}`,
    `Path: ${context.project.projectPath}`,
    `Goal: ${context.session.currentGoal}`,
    ...(context.session.currentBlocker ? [`Blocker: ${context.session.currentBlocker}`] : []),
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
