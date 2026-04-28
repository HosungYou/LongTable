import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { cwd, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult, ElicitRequestFormParams, ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { classifyCheckpointTrigger } from "@longtable/checkpoints";
import { renderQuestionRecordInput } from "@longtable/provider-claude";
import { renderQuestionRecordPrompt } from "@longtable/provider-codex";
import type { ProviderKind, QuestionOption, QuestionRecord, QuestionTransportStatus } from "@longtable/core";
import { loadSetupOutput } from "@longtable/setup";
import {
  answerWorkspaceQuestion,
  clearWorkspaceQuestion,
  createOrUpdateProjectWorkspace,
  createWorkspaceQuestion,
  inspectProjectWorkspace,
  loadProjectContextFromDirectory,
  loadWorkspaceState,
  syncCurrentWorkspaceView
} from "@longtable/cli";
import {
  buildFirstResearchShapeQuestion,
  firstResearchShapeAnswerConfirms,
  firstResearchShapeAnswerStatus
} from "./first-research-shape.js";

const SERVER_NAME = "longtable-state";
const SERVER_VERSION = "0.1.34";

const TOOL_NAMES = [
  "read_project",
  "read_session",
  "inspect_workspace",
  "create_workspace",
  "begin_interview",
  "append_interview_turn",
  "summarize_interview",
  "confirm_first_research_shape",
  "pending_questions",
  "evaluate_checkpoint",
  "create_question",
  "elicit_question",
  "render_question",
  "append_decision",
  "regenerate_current"
];

const cwdSchema = z.object({
  cwd: z.string().optional().describe("LongTable project directory or child path. Defaults to server cwd.")
});

type InterviewTurnQuality = "thin" | "usable" | "rich";
type InterviewDepth = "gathering_context" | "forming_first_handle" | "ready_to_summarize";

interface FirstResearchShape {
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

interface InterviewHookRun {
  id: string;
  kind: "longtable_interview";
  status: "pending" | "active" | "ready_to_confirm" | "confirmed" | "deferred" | "cancelled";
  createdAt: string;
  updatedAt: string;
  targetOutcome: "first_research_handle";
  depth: InterviewDepth;
  provider?: ProviderKind;
  turns: Array<{
    id: string;
    index: number;
    createdAt: string;
    question: string;
    answer: string;
    reflection?: string;
    quality: InterviewTurnQuality;
    needsFollowUp: boolean;
    followUpQuestion?: string;
    rationale?: string[];
  }>;
  firstResearchShape?: FirstResearchShape;
  qualityNotes: string[];
  rationale: string[];
  linkedQuestionRecordIds?: string[];
  linkedDecisionRecordIds?: string[];
}

interface QuestionObligation {
  id: string;
  kind: "required_question" | "first_research_shape_confirmation";
  status: "pending" | "satisfied" | "cleared";
  createdAt: string;
  updatedAt: string;
  prompt: string;
  reason: string;
  questionId?: string;
  decisionId?: string;
  sourceHookId?: string;
}

type InterviewState = Awaited<ReturnType<typeof loadWorkspaceState>> & {
  firstResearchShape?: FirstResearchShape;
  questionObligations?: QuestionObligation[];
};

const questionOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  recommended: z.boolean().optional()
});

const firstResearchShapeSchema = z.object({
  handle: z.string().min(1),
  currentGoal: z.string().min(1),
  currentBlocker: z.string().optional(),
  researchObject: z.string().optional(),
  gapRisk: z.string().optional(),
  protectedDecision: z.string().optional(),
  openQuestions: z.array(z.string().min(1)).default([]),
  nextAction: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  sourceHookId: z.string().optional(),
  confirmedAt: z.string().optional()
});

function textResult(structuredContent: Record<string, unknown>): CallToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent, null, 2)
      }
    ],
    structuredContent
  };
}

function errorResult(message: string): CallToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: message
      }
    ],
    isError: true
  };
}

function resolveStartPath(input?: string): string {
  return resolve(input ?? cwd());
}

async function requireContext(startPath?: string) {
  const context = await loadProjectContextFromDirectory(resolveStartPath(startPath));
  if (!context) {
    throw new Error("No LongTable workspace was found from the supplied cwd.");
  }
  return context;
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function asInterviewState(state: Awaited<ReturnType<typeof loadWorkspaceState>>): InterviewState {
  return state as InterviewState;
}

function isInterviewHookRun(hook: { kind?: string } | undefined): hook is InterviewHookRun {
  return hook?.kind === "longtable_interview";
}

function activeInterviewHook(state: InterviewState, hookId?: string): InterviewHookRun | undefined {
  const hooks = state.hooks ?? [];
  if (hookId) {
    const hook = hooks.find((candidate) => candidate.id === hookId);
    return isInterviewHookRun(hook) ? hook : undefined;
  }
  return [...hooks].reverse().find((hook): hook is InterviewHookRun =>
    hook.kind === "longtable_interview" &&
    (hook.status === "pending" || hook.status === "active" || hook.status === "ready_to_confirm")
  );
}

function upsertInterviewHook(state: InterviewState, hook: InterviewHookRun): InterviewState {
  const hooks = state.hooks ?? [];
  const nextHooks = hooks.some((candidate) => candidate.id === hook.id)
    ? hooks.map((candidate) => candidate.id === hook.id ? hook : candidate)
    : [...hooks, hook];
  return {
    ...state,
    hooks: nextHooks
  };
}

function upsertQuestionObligation(
  state: InterviewState,
  obligation: QuestionObligation
): InterviewState {
  const current = state.questionObligations ?? [];
  const next = current.some((entry) => entry.id === obligation.id)
    ? current.map((entry) => entry.id === obligation.id ? obligation : entry)
    : [...current, obligation];
  return {
    ...state,
    questionObligations: next
  };
}

function ensureFirstResearchShapeObligation(
  state: InterviewState,
  shape: FirstResearchShape,
  options: { prompt: string; reason: string; questionId?: string }
): InterviewState {
  const existing = (state.questionObligations ?? []).find((obligation) =>
    obligation.kind === "first_research_shape_confirmation" &&
    obligation.status === "pending" &&
    obligation.sourceHookId === shape.sourceHookId
  );
  if (!existing) {
    return upsertQuestionObligation(state, {
      id: createId("question_obligation"),
      kind: "first_research_shape_confirmation",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt: options.prompt,
      reason: options.reason,
      ...(shape.sourceHookId ? { sourceHookId: shape.sourceHookId } : {}),
      ...(options.questionId ? { questionId: options.questionId } : {})
    });
  }

  return upsertQuestionObligation(state, {
    ...existing,
    updatedAt: new Date().toISOString(),
    prompt: options.prompt,
    reason: options.reason,
    ...(options.questionId ? { questionId: options.questionId } : existing.questionId ? { questionId: existing.questionId } : {}),
    ...(shape.sourceHookId ? { sourceHookId: shape.sourceHookId } : {})
  });
}

function resolveFirstResearchShapeObligation(
  state: InterviewState,
  options: {
    sourceHookId?: string;
    questionId?: string;
    decisionId?: string;
    status?: "satisfied" | "cleared";
  }
): InterviewState {
  return {
    ...state,
    questionObligations: (state.questionObligations ?? []).map((obligation) => {
      const matches = obligation.kind === "first_research_shape_confirmation" && (
        (options.sourceHookId && obligation.sourceHookId === options.sourceHookId) ||
        (options.questionId && obligation.questionId === options.questionId)
      );
      if (!matches || obligation.status !== "pending") {
        return obligation;
      }
      return {
        ...obligation,
        status: options.status ?? "satisfied",
        updatedAt: new Date().toISOString(),
        ...(options.questionId ? { questionId: options.questionId } : obligation.questionId ? { questionId: obligation.questionId } : {}),
        ...(options.decisionId ? { decisionId: options.decisionId } : obligation.decisionId ? { decisionId: obligation.decisionId } : {})
      };
    })
  };
}

function interviewDepth(turns: InterviewHookRun["turns"]): InterviewDepth {
  const usableTurns = turns.filter((turn) => turn.quality !== "thin").length;
  if (usableTurns >= 3) return "ready_to_summarize";
  if (usableTurns >= 1) return "forming_first_handle";
  return "gathering_context";
}

function normalizeInterviewQuality(answer: string, quality?: InterviewTurnQuality): InterviewTurnQuality {
  if (quality) return quality;
  const trimmed = answer.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (trimmed.length < 12 || wordCount < 3) return "thin";
  if (trimmed.length > 80 || wordCount >= 12) return "rich";
  return "usable";
}

function defaultFollowUpQuestion(answer: string): string {
  return answer.trim().length < 12
    ? "Say one more sentence about where this problem appears or why it matters before LongTable tries to classify it."
    : "What concrete scene, case, material, text, dataset, or decision would make that problem easier to inspect first?";
}

async function beginInterviewHook(
  context: Awaited<ReturnType<typeof requireContext>>,
  options: { provider?: ProviderKind; openingQuestion?: string; seedAnswer?: string }
) {
  const state = asInterviewState(await loadWorkspaceState(context));
  const existing = activeInterviewHook(state);
  if (existing) {
    return { hook: existing, state };
  }
  const confirmedShape = state.firstResearchShape?.confirmedAt ? state.firstResearchShape : undefined;
  if (confirmedShape) {
    const confirmedHook = [...(state.hooks ?? [])].reverse().find((hook): hook is InterviewHookRun =>
      isInterviewHookRun(hook) &&
      hook.status === "confirmed" &&
      hook.firstResearchShape?.handle === confirmedShape.handle
    );
    return {
      hook: confirmedHook,
      state,
      alreadyConfirmed: true,
      shape: confirmedShape,
      nextQuestion: options.openingQuestion ?? confirmedShape.openQuestions[0] ?? confirmedShape.nextAction
    };
  }
  const timestamp = new Date().toISOString();
  const hook: InterviewHookRun = {
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
      "Official LongTable research start surface is provider-native `$longtable-interview`, not the CLI start questionnaire."
    ]
  };
  const updated = upsertInterviewHook(state, hook);
  updated.workingState = {
    ...updated.workingState,
    activeInterviewHookId: hook.id,
    interviewSurface: "$longtable-interview",
    ...(options.openingQuestion ? { interviewOpeningQuestion: options.openingQuestion } : {}),
    ...(options.seedAnswer ? { interviewSeedAnswer: options.seedAnswer } : {})
  };
  await writeFile(context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return { hook, state: updated };
}

async function appendInterviewTurn(
  context: Awaited<ReturnType<typeof requireContext>>,
  options: {
    hookId?: string;
    question: string;
    answer: string;
    reflection?: string;
    quality?: InterviewTurnQuality;
    needsFollowUp?: boolean;
    followUpQuestion?: string;
    rationale?: string[];
  }
) {
  const state = asInterviewState(await loadWorkspaceState(context));
  const existing = activeInterviewHook(state, options.hookId);
  if (!existing) {
    throw new Error("No active LongTable interview hook was found. Run begin_interview first.");
  }
  const quality = normalizeInterviewQuality(options.answer, options.quality);
  const needsFollowUp = options.needsFollowUp ?? quality === "thin";
  const followUpQuestion = needsFollowUp
    ? options.followUpQuestion ?? defaultFollowUpQuestion(options.answer)
    : options.followUpQuestion;
  const timestamp = new Date().toISOString();
  const turn = {
    id: createId("interview_turn"),
    index: existing.turns.length + 1,
    createdAt: timestamp,
    question: options.question.trim(),
    answer: options.answer.trim(),
    ...(options.reflection?.trim() ? { reflection: options.reflection.trim() } : {}),
    quality,
    needsFollowUp,
    ...(followUpQuestion?.trim() ? { followUpQuestion: followUpQuestion.trim() } : {}),
    ...(options.rationale && options.rationale.length > 0 ? { rationale: options.rationale } : {})
  };
  const turns = [...existing.turns, turn];
  const depth = interviewDepth(turns);
  const hook: InterviewHookRun = {
    ...existing,
    status: depth === "ready_to_summarize" ? "ready_to_confirm" : "active",
    updatedAt: timestamp,
    depth,
    turns,
    qualityNotes: [
      ...existing.qualityNotes,
      ...(needsFollowUp ? [`Turn ${turn.index} needs follow-up: ${followUpQuestion}`] : [])
    ]
  };
  const updated = upsertInterviewHook(state, hook);
  await writeFile(context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return { hook, turn, state: updated };
}

async function summarizeInterviewHook(
  context: Awaited<ReturnType<typeof requireContext>>,
  options: { hookId?: string; shape: FirstResearchShape }
) {
  const state = asInterviewState(await loadWorkspaceState(context));
  const existing = activeInterviewHook(state, options.hookId);
  if (!existing) {
    throw new Error("No active LongTable interview hook was found. Run begin_interview first.");
  }
  const timestamp = new Date().toISOString();
  const shape: FirstResearchShape = {
    ...options.shape,
    handle: options.shape.handle.trim(),
    currentGoal: options.shape.currentGoal.trim(),
    openQuestions: options.shape.openQuestions.map((question) => question.trim()).filter(Boolean),
    nextAction: options.shape.nextAction.trim(),
    sourceHookId: existing.id
  };
  const hook: InterviewHookRun = {
    ...existing,
    status: "ready_to_confirm",
    updatedAt: timestamp,
    depth: "ready_to_summarize",
    firstResearchShape: shape
  };
  const session = {
    ...context.session,
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
  context.session = session;
  const updated = upsertInterviewHook(state, hook);
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
  await writeFile(context.sessionFilePath, JSON.stringify(session, null, 2), "utf8");
  await writeFile(context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return { hook, shape, state: updated, session };
}

function findQuestion(records: QuestionRecord[], questionId?: string): QuestionRecord | null {
  if (questionId) {
    return records.find((record) => record.id === questionId) ?? null;
  }
  return records.filter((record) => record.status === "pending").at(-1) ?? null;
}

function renderQuestionFallback(record: QuestionRecord, provider: ProviderKind = "codex") {
  return provider === "claude"
    ? renderQuestionRecordInput(record)
    : renderQuestionRecordPrompt(record);
}

function compactInterviewHook(hook: InterviewHookRun | undefined) {
  if (!hook) {
    return undefined;
  }
  return {
    id: hook.id,
    kind: hook.kind,
    status: hook.status,
    depth: hook.depth,
    provider: hook.provider,
    turnCount: hook.turns?.length ?? 0,
    firstResearchShape: hook.firstResearchShape?.handle,
    createdAt: hook.createdAt,
    updatedAt: hook.updatedAt
  };
}

async function markQuestionTransport(
  context: Awaited<ReturnType<typeof requireContext>>,
  questionId: string,
  status: QuestionTransportStatus,
  message?: string
): Promise<QuestionRecord | null> {
  const state = asInterviewState(await loadWorkspaceState(context));
  let updatedQuestion: QuestionRecord | null = null;
  state.questionLog = (state.questionLog ?? []).map((record: QuestionRecord) => {
    if (record.id !== questionId) {
      return record;
    }
    updatedQuestion = {
      ...record,
      updatedAt: new Date().toISOString(),
      transportStatus: {
        surface: "mcp_elicitation",
        status,
        updatedAt: new Date().toISOString(),
        ...(message ? { message } : {})
      }
    };
    return updatedQuestion;
  });
  await writeFile(context.stateFilePath, JSON.stringify(state, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return updatedQuestion;
}

function buildElicitationParams(record: QuestionRecord): ElicitRequestFormParams {
  const choices = [
    ...record.prompt.options.map((option) => ({
      const: option.value,
      title: [
        option.label,
        option.recommended ? "(Recommended)" : ""
      ].filter(Boolean).join(" ")
    })),
    ...(record.prompt.allowOther
      ? [{
          const: "other",
          title: record.prompt.otherLabel ?? "Other"
        }]
      : [])
  ];

  return {
    mode: "form",
    message: [
      record.prompt.title,
      record.prompt.question,
      record.prompt.displayReason ? `Decision context: ${record.prompt.displayReason}` : undefined
    ].filter(Boolean).join("\n"),
    requestedSchema: {
      type: "object",
      properties: {
        answer: {
          type: "string",
          title: "Decision",
          oneOf: choices,
          default: choices[0]?.const
        }
      },
      required: ["answer"]
    }
  };
}

function acceptedAnswer(result: ElicitResult): { answer: string } | null {
  if (result.action !== "accept") {
    return null;
  }
  const answer = result.content?.answer;
  if (typeof answer !== "string" || answer.length === 0) {
    return null;
  }
  return {
    answer
  };
}

async function markFirstResearchShapeConfirmation(
  context: Awaited<ReturnType<typeof requireContext>>,
  shape: FirstResearchShape,
  answer: string,
  questionId?: string,
  decisionId?: string
) {
  const state = asInterviewState(await loadWorkspaceState(context));
  const timestamp = new Date().toISOString();
  const confirmedShape = firstResearchShapeAnswerConfirms(answer)
    ? { ...shape, confirmedAt: timestamp }
    : shape;
  state.firstResearchShape = confirmedShape;
  state.workingState = {
    ...state.workingState,
    firstResearchShape: confirmedShape
  };
  state.hooks = (state.hooks ?? []).map((hook) => {
    if (hook.id !== shape.sourceHookId || !isInterviewHookRun(hook)) {
      return hook;
    }
    return {
      ...hook,
      status: firstResearchShapeAnswerStatus(answer),
      updatedAt: timestamp,
      firstResearchShape: confirmedShape,
      linkedQuestionRecordIds: questionId
        ? [...(hook.linkedQuestionRecordIds ?? []), questionId]
        : hook.linkedQuestionRecordIds,
      linkedDecisionRecordIds: decisionId
        ? [...(hook.linkedDecisionRecordIds ?? []), decisionId]
        : hook.linkedDecisionRecordIds
    };
  });
  const nextState = resolveFirstResearchShapeObligation(state, {
    sourceHookId: shape.sourceHookId,
    questionId,
    decisionId,
    status: "satisfied"
  }) as InterviewState;

  const session = {
    ...context.session,
    firstResearchShape: confirmedShape,
    lastUpdatedAt: timestamp
  };
  context.session = session;
  await writeFile(context.sessionFilePath, JSON.stringify(session, null, 2), "utf8");
  await writeFile(context.stateFilePath, JSON.stringify(nextState, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return { state: nextState, session, shape: confirmedShape };
}

async function markAlreadyConfirmedFirstResearchShape(
  context: Awaited<ReturnType<typeof requireContext>>,
  shape: FirstResearchShape
) {
  const state = asInterviewState(await loadWorkspaceState(context));
  const timestamp = new Date().toISOString();
  const confirmedShape = shape.confirmedAt ? shape : { ...shape, confirmedAt: timestamp };
  state.firstResearchShape = confirmedShape;
  state.workingState = {
    ...state.workingState,
    firstResearchShape: confirmedShape
  };
  state.hooks = (state.hooks ?? []).map((hook) => {
    if (!isInterviewHookRun(hook)) {
      return hook;
    }
    const matchesSource = shape.sourceHookId && hook.id === shape.sourceHookId;
    const matchesHandle = !shape.sourceHookId && hook.firstResearchShape?.handle === shape.handle;
    if (!matchesSource && !matchesHandle) {
      return hook;
    }
    return {
      ...hook,
      status: "confirmed",
      updatedAt: timestamp,
      firstResearchShape: confirmedShape
    };
  });
  const nextState = resolveFirstResearchShapeObligation(state, {
    sourceHookId: confirmedShape.sourceHookId,
    status: "satisfied"
  }) as InterviewState;

  const session = {
    ...context.session,
    firstResearchShape: confirmedShape,
    lastUpdatedAt: timestamp
  };
  context.session = session;
  await writeFile(context.sessionFilePath, JSON.stringify(session, null, 2), "utf8");
  await writeFile(context.stateFilePath, JSON.stringify(nextState, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return { state: nextState, session, shape: confirmedShape };
}

function statusForElicitationError(error: unknown): QuestionTransportStatus {
  const message = error instanceof Error ? error.message : String(error);
  if (/timed?\s*out|timeout/i.test(message)) {
    return "timeout";
  }
  if (/unsupported|not supported|unavailable|does not support/i.test(message)) {
    return "unsupported";
  }
  return "error";
}

async function readAllowedProjectFiles(context: Awaited<ReturnType<typeof requireContext>>) {
  const current = existsSync(context.currentFilePath)
    ? await readFile(context.currentFilePath, "utf8")
    : "";
  const agentsPath = resolve(context.project.projectPath, "AGENTS.md");
  const agents = existsSync(agentsPath)
    ? await readFile(agentsPath, "utf8")
    : "";
  return {
    current,
    agentsPath,
    agents
  };
}

export function createLongTableMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION
    },
    {
      instructions:
        "Use LongTable state tools to inspect .longtable workspaces, evaluate Researcher Checkpoints, write QuestionRecords, append DecisionRecords, and regenerate CURRENT.md. Treat .longtable as the source of truth."
    }
  );

  server.registerTool(
    "read_project",
    {
      title: "Read LongTable Project",
      description: "Read project metadata from a LongTable workspace.",
      inputSchema: cwdSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        return textResult({
          project: context.project,
          files: {
            project: context.projectFilePath,
            session: context.sessionFilePath,
            state: context.stateFilePath,
            current: context.currentFilePath
          }
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "read_session",
    {
      title: "Read LongTable Session",
      description: "Read the current LongTable session record.",
      inputSchema: cwdSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        return textResult({ session: context.session });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "inspect_workspace",
    {
      title: "Inspect LongTable Workspace",
      description: "Inspect workspace files, counts, recent invocations, questions, and decisions.",
      inputSchema: cwdSchema.extend({
        includeFiles: z.boolean().default(false).describe("Include CURRENT.md and AGENTS.md text.")
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd, includeFiles }) => {
      try {
        const context = await loadProjectContextFromDirectory(resolveStartPath(inputCwd));
        const inspection = await inspectProjectWorkspace(resolveStartPath(inputCwd));
        if (!context || !includeFiles) {
          return textResult({ inspection });
        }
        return textResult({
          inspection,
          files: await readAllowedProjectFiles(context)
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "create_workspace",
    {
      title: "Create LongTable Workspace",
      description: "Create a .longtable workspace in the current folder for provider-native $longtable-interview.",
      inputSchema: cwdSchema.extend({
        projectName: z.string().optional(),
        projectPath: z.string().optional(),
        seedGoal: z.string().optional(),
        setupPath: z.string().optional(),
        provider: z.enum(["codex", "claude"]).default("codex")
      })
    },
    async ({ cwd: inputCwd, projectName, projectPath, seedGoal, setupPath, provider }) => {
      try {
        const targetPath = resolveStartPath(projectPath ?? inputCwd);
        const setup = await loadSetupOutput(setupPath);
        const context = await createOrUpdateProjectWorkspace({
          projectName: projectName?.trim() || basename(targetPath) || "LongTable Research",
          projectPath: targetPath,
          currentGoal: seedGoal?.trim() || "First research handle pending",
          requestedPerspectives: [],
          disagreementPreference: setup.profileSeed.panelPreference ?? "show_on_conflict",
          setup
        });
        const interview = await beginInterviewHook(context, {
          provider: provider as ProviderKind,
          openingQuestion: "What do you want to research? If it is not clear yet, describe the problem in its rough form.",
          seedAnswer: seedGoal
        });
        return textResult({
          project: context.project,
          session: context.session,
          hook: interview.hook,
          files: {
            project: context.projectFilePath,
            session: context.sessionFilePath,
            state: context.stateFilePath,
            current: context.currentFilePath
          },
          nextQuestion: "What do you want to research? If it is not clear yet, describe the problem in its rough form."
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "begin_interview",
    {
      title: "Begin LongTable Interview",
      description: "Create or resume the active $longtable-interview hook in an existing workspace.",
      inputSchema: cwdSchema.extend({
        openingQuestion: z.string().optional(),
        seedAnswer: z.string().optional(),
        provider: z.enum(["codex", "claude"]).default("codex")
      })
    },
    async ({ cwd: inputCwd, openingQuestion, seedAnswer, provider }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await beginInterviewHook(context, {
          provider: provider as ProviderKind,
          openingQuestion,
          seedAnswer
        });
        return textResult({
          hook: compactInterviewHook(result.hook),
          alreadyConfirmed: "alreadyConfirmed" in result ? Boolean(result.alreadyConfirmed) : false,
          shape: "shape" in result ? result.shape : result.hook?.firstResearchShape,
          nextQuestion: "nextQuestion" in result ? result.nextQuestion : openingQuestion,
          workspace: {
            projectName: context.project.projectName,
            currentGoal: context.session.currentGoal,
            currentBlocker: context.session.currentBlocker,
            nextAction: context.session.nextAction
          }
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "append_interview_turn",
    {
      title: "Append LongTable Interview Turn",
      description: "Record one natural-language interview question and answer, including quality/follow-up metadata.",
      inputSchema: cwdSchema.extend({
        hookId: z.string().optional(),
        question: z.string().min(1),
        answer: z.string().min(1),
        reflection: z.string().optional(),
        quality: z.enum(["thin", "usable", "rich"]).optional(),
        needsFollowUp: z.boolean().optional(),
        followUpQuestion: z.string().optional(),
        rationale: z.array(z.string()).optional()
      })
    },
    async ({ cwd: inputCwd, hookId, question, answer, reflection, quality, needsFollowUp, followUpQuestion, rationale }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await appendInterviewTurn(context, {
          hookId,
          question,
          answer,
          reflection,
          quality: quality as InterviewTurnQuality | undefined,
          needsFollowUp,
          followUpQuestion,
          rationale
        });
        return textResult(result);
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "summarize_interview",
    {
      title: "Summarize LongTable Interview",
      description: "Store the provisional First Research Shape after enough interview context has accumulated.",
      inputSchema: cwdSchema.extend({
        hookId: z.string().optional(),
        shape: firstResearchShapeSchema
      })
    },
    async ({ cwd: inputCwd, hookId, shape }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await summarizeInterviewHook(context, {
          hookId,
          shape: shape as FirstResearchShape
        });
        return textResult({
          hook: compactInterviewHook(result.hook),
          shape: result.shape,
          session: {
            currentGoal: result.session.currentGoal,
            currentBlocker: result.session.currentBlocker,
            nextAction: result.session.nextAction,
            firstResearchShape: result.session.firstResearchShape
          }
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "confirm_first_research_shape",
    {
      title: "Confirm First Research Shape",
      description: "Use MCP form elicitation to confirm, revise, defer, or request more context for the First Research Shape.",
      inputSchema: cwdSchema.extend({
        shape: firstResearchShapeSchema.optional(),
        provider: z.enum(["codex", "claude"]).default("codex"),
        fallbackOnly: z.boolean().default(false)
      })
    },
    async ({ cwd: inputCwd, shape: inputShape, provider, fallbackOnly }) => {
      try {
        const context = await requireContext(inputCwd);
        const state = asInterviewState(await loadWorkspaceState(context));
        const shape = (inputShape as FirstResearchShape | undefined) ?? state.firstResearchShape;
        if (!shape) {
          return errorResult("No First Research Shape was found to confirm. Run summarize_interview first.");
        }
        if (shape.confirmedAt) {
          const confirmation = await markAlreadyConfirmedFirstResearchShape(context, shape);
          return textResult({
            shape: confirmation.shape,
            elicitation: { attempted: false, reason: "already_confirmed" }
          });
        }
        const spec = buildFirstResearchShapeQuestion(shape);
        const created = await createWorkspaceQuestion({
          context,
          prompt: spec.prompt,
          title: spec.title,
          question: spec.question,
          checkpointKey: spec.checkpointKey,
          questionOptions: spec.options,
          displayReason: spec.displayReason,
          provider: provider as ProviderKind,
          required: true
        });
        const createdState = ensureFirstResearchShapeObligation(
          asInterviewState(await loadWorkspaceState(context)),
          shape,
          {
            prompt: spec.question,
            reason: spec.displayReason,
            questionId: created.question.id
          }
        ) as InterviewState;
        await writeFile(context.stateFilePath, JSON.stringify(createdState, null, 2), "utf8");
        await syncCurrentWorkspaceView(context);
        const fallback = renderQuestionFallback(created.question, provider as ProviderKind);
        if (fallbackOnly) {
          const marked = await markQuestionTransport(context, created.question.id, "fallback_rendered", "MCP elicitation skipped by fallbackOnly.");
          return textResult({
            question: marked ?? created.question,
            shape,
            elicitation: { attempted: false, reason: "fallbackOnly" },
            fallback
          });
        }

        try {
          await markQuestionTransport(context, created.question.id, "attempted");
          const elicited = await server.server.elicitInput(buildElicitationParams(created.question));
          const accepted = acceptedAnswer(elicited);
          if (!accepted) {
            const status = elicited.action === "decline" || elicited.action === "cancel"
              ? "declined"
              : "fallback_rendered";
            const marked = await markQuestionTransport(context, created.question.id, status, `MCP elicitation returned action: ${elicited.action}.`);
            const cleared = status === "declined"
              ? await clearWorkspaceQuestion({
                  context,
                  questionId: created.question.id,
                  reason: `MCP elicitation returned action: ${elicited.action}; confirmation was deferred without a research-direction decision.`
                })
              : undefined;
            return textResult({
              question: cleared?.question ?? marked ?? created.question,
              shape,
              elicitation: { attempted: true, action: elicited.action },
              fallback
            });
          }
          const decided = await answerWorkspaceQuestion({
            context,
            questionId: created.question.id,
            answer: accepted.answer,
            provider: provider as ProviderKind,
            surface: "mcp_elicitation"
          });
          const marked = await markQuestionTransport(context, created.question.id, "accepted");
          const confirmation = await markFirstResearchShapeConfirmation(
            context,
            shape,
            accepted.answer,
            created.question.id,
            decided.decision.id
          );
          return textResult({
            shape: confirmation.shape,
            question: marked ? { ...decided.question, transportStatus: marked.transportStatus } : decided.question,
            decision: decided.decision,
            elicitation: { attempted: true, action: elicited.action }
          });
        } catch (elicitationError) {
          const status = statusForElicitationError(elicitationError);
          const message = elicitationError instanceof Error ? elicitationError.message : String(elicitationError);
          const marked = await markQuestionTransport(context, created.question.id, status, message);
          return textResult({
            question: marked ?? created.question,
            shape,
            elicitation: {
              attempted: true,
              supported: status !== "unsupported" ? undefined : false,
              error: message
            },
            fallback
          });
        }
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "pending_questions",
    {
      title: "List Pending Researcher Checkpoints",
      description: "List pending LongTable QuestionRecords.",
      inputSchema: cwdSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        const state = await loadWorkspaceState(context);
        const pending = (state.questionLog ?? []).filter((record: QuestionRecord) => record.status === "pending");
        return textResult({
          pending,
          required: pending.filter((record: QuestionRecord) => record.prompt.required)
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "evaluate_checkpoint",
    {
      title: "Evaluate Checkpoint Trigger",
      description: "Classify natural-language context into a LongTable checkpoint signal without writing state.",
      inputSchema: cwdSchema.extend({
        prompt: z.string().min(1),
        mode: z.enum(["explore", "review", "critique", "draft", "commit", "submit"]).optional()
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd, prompt, mode }) => {
      try {
        const context = await loadProjectContextFromDirectory(resolveStartPath(inputCwd));
        const state = context ? await loadWorkspaceState(context) : undefined;
        const classification = classifyCheckpointTrigger(prompt, {
          preferredMode: mode,
          unresolvedTensions: state?.openTensions ?? [],
          studyContract: state?.studyContract
        });
        return textResult({ classification });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "create_question",
    {
      title: "Create Researcher Checkpoint",
      description: "Create a pending QuestionRecord in the LongTable workspace.",
      inputSchema: cwdSchema.extend({
        prompt: z.string().min(1),
        title: z.string().optional(),
        question: z.string().optional(),
        checkpointKey: z.string().optional(),
        options: z.array(questionOptionSchema).optional(),
        displayReason: z.string().optional(),
        provider: z.enum(["codex", "claude"]).optional(),
        required: z.boolean().optional()
      })
    },
    async ({ cwd: inputCwd, prompt, title, question, checkpointKey, options, displayReason, provider, required }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await createWorkspaceQuestion({
          context,
          prompt,
          title,
          question,
          checkpointKey,
          questionOptions: options as QuestionOption[] | undefined,
          displayReason,
          provider,
          required
        });
        return textResult({
          question: result.question,
          nextAction: `longtable decide --question ${result.question.id} --answer <value>`
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "elicit_question",
    {
      title: "Elicit Researcher Checkpoint",
      description: "Create a QuestionRecord, then try MCP form elicitation for a provider-native UI checkpoint. Falls back to rendered LongTable transport when unsupported.",
      inputSchema: cwdSchema.extend({
        prompt: z.string().min(1),
        title: z.string().optional(),
        question: z.string().optional(),
        checkpointKey: z.string().optional(),
        options: z.array(questionOptionSchema).optional(),
        displayReason: z.string().optional(),
        provider: z.enum(["codex", "claude"]).default("codex"),
        required: z.boolean().optional(),
        fallbackOnly: z.boolean().default(false).describe("Create and render the checkpoint without calling MCP elicitation.")
      })
    },
    async ({ cwd: inputCwd, prompt, title, question, checkpointKey, options, displayReason, provider, required, fallbackOnly }) => {
      try {
        const context = await requireContext(inputCwd);
        const created = await createWorkspaceQuestion({
          context,
          prompt,
          title,
          question,
          checkpointKey,
          questionOptions: options as QuestionOption[] | undefined,
          displayReason,
          provider,
          required
        });
        const fallback = renderQuestionFallback(created.question, provider as ProviderKind);
        if (fallbackOnly) {
          const marked = await markQuestionTransport(context, created.question.id, "fallback_rendered", "MCP elicitation skipped by fallbackOnly.");
          return textResult({
            question: marked ?? created.question,
            elicitation: { attempted: false, reason: "fallbackOnly" },
            fallback,
            nextAction: `longtable decide --question ${created.question.id} --answer <value>`
          });
        }

        try {
          await markQuestionTransport(context, created.question.id, "attempted");
          const elicited = await server.server.elicitInput(buildElicitationParams(created.question));
          const accepted = acceptedAnswer(elicited);
          if (!accepted) {
            const status = elicited.action === "decline" || elicited.action === "cancel"
              ? "declined"
              : "fallback_rendered";
            const marked = await markQuestionTransport(context, created.question.id, status, `MCP elicitation returned action: ${elicited.action}.`);
            return textResult({
              question: marked ?? created.question,
              elicitation: { attempted: true, action: elicited.action },
              fallback,
              nextAction: `longtable decide --question ${created.question.id} --answer <value>`
            });
          }
          const decided = await answerWorkspaceQuestion({
            context,
            questionId: created.question.id,
            answer: accepted.answer,
            provider: provider as ProviderKind,
            surface: "mcp_elicitation"
          });
          const marked = await markQuestionTransport(context, created.question.id, "accepted");
          return textResult({
            question: marked ? { ...decided.question, transportStatus: marked.transportStatus } : decided.question,
            decision: decided.decision,
            elicitation: { attempted: true, action: elicited.action }
          });
        } catch (elicitationError) {
          const status = statusForElicitationError(elicitationError);
          const message = elicitationError instanceof Error ? elicitationError.message : String(elicitationError);
          const marked = await markQuestionTransport(context, created.question.id, status, message);
          return textResult({
            question: marked ?? created.question,
            elicitation: {
              attempted: true,
              supported: status !== "unsupported" ? undefined : false,
              error: message
            },
            fallback,
            nextAction: `longtable decide --question ${created.question.id} --answer <value>`
          });
        }
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "render_question",
    {
      title: "Render Researcher Checkpoint",
      description: "Render a pending QuestionRecord for Codex numbered prompt or Claude structured question transport.",
      inputSchema: cwdSchema.extend({
        questionId: z.string().optional(),
        provider: z.enum(["codex", "claude"]).default("codex")
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd, questionId, provider }) => {
      try {
        const context = await requireContext(inputCwd);
        const state = await loadWorkspaceState(context);
        const question = findQuestion(state.questionLog ?? [], questionId);
        if (!question) {
          return errorResult("No matching pending LongTable question was found.");
        }
        const transport = renderQuestionFallback(question, provider as ProviderKind);
        return textResult({ provider, question, transport });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "append_decision",
    {
      title: "Append LongTable Decision",
      description: "Answer a pending QuestionRecord and append a DecisionRecord.",
      inputSchema: cwdSchema.extend({
        questionId: z.string().optional(),
        answer: z.string().min(1),
        rationale: z.string().optional(),
        provider: z.enum(["codex", "claude"]).optional()
      })
    },
    async ({ cwd: inputCwd, questionId, answer, rationale, provider }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await answerWorkspaceQuestion({
          context,
          questionId,
          answer,
          rationale,
          provider: provider as ProviderKind | undefined
        });
        return textResult({
          question: result.question,
          decision: result.decision
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "regenerate_current",
    {
      title: "Regenerate CURRENT.md",
      description: "Regenerate CURRENT.md from LongTable machine-readable state.",
      inputSchema: cwdSchema
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        const path = await syncCurrentWorkspaceView(context);
        return textResult({ current: path });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createLongTableMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} MCP server running on stdio`);
}

export async function runLongTableMcpCli(argv = process.argv): Promise<void> {
  if (argv.includes("--self-test")) {
    console.log(JSON.stringify({ name: SERVER_NAME, version: SERVER_VERSION, tools: TOOL_NAMES }, null, 2));
    return;
  }

  await runStdioServer();
}

function isDirectRun(): boolean {
  return process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
}

if (isDirectRun()) {
  runLongTableMcpCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    exit(1);
  });
}
