import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { createEmptyResearchState } from "@longtable/memory";
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
  session: LongTableSessionRecord
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
    field: setup.profileSeed.field,
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
  const body = buildCurrentGuide(context.project, context.session);
  await writeFile(context.currentFilePath, body, "utf8");
  return context.currentFilePath;
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
          field: options.setup.profileSeed.field,
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
      const project = JSON.parse(await readFile(projectFilePath, "utf8")) as LongTableProjectRecord;
      const session = JSON.parse(await readFile(sessionFilePath, "utf8")) as LongTableSessionRecord;

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
        stateFilePath: resolveStateFilePath(project.projectPath),
        currentFilePath: resolveCurrentFilePath(project.projectPath),
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
