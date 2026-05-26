import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
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
import type {
  ProviderKind,
  QuestionCommitmentFamily,
  QuestionEpistemicBasis,
  QuestionOption,
  QuestionPromptType,
  QuestionRecord,
  QuestionTransportStatus
} from "@longtable/core";
import { loadSetupOutput } from "@longtable/setup";
import {
  answerWorkspaceQuestion,
  applyResearchSpecificationAuditUpdate,
  applyResearchSpecificationPatch,
  clearWorkspaceQuestion,
  createOrUpdateProjectWorkspace,
  createWorkspaceQuestion,
  diffResearchSpecifications,
  findUnincorporatedResearchEvidence,
  inspectProjectWorkspace,
  loadProjectContextFromDirectory,
  loadWorkspaceState,
  proposeResearchSpecificationPatch,
  readResearchSpecificationHistory,
  syncCurrentWorkspaceView
} from "@longtable/cli";
import {
  buildFirstResearchShapeQuestion,
  firstResearchShapeAnswerConfirms,
  firstResearchShapeAnswerStatus
} from "./first-research-shape.js";
import {
  buildResearchSpecificationQuestion,
  renderResearchSpecificationPreview,
  researchSpecificationAnswerConfirms,
  researchSpecificationAnswerNeedsFollowUp,
  researchSpecificationAnswerStatus
} from "./research-specification.js";

const SERVER_NAME = "longtable-state";
const require = createRequire(import.meta.url);
const SERVER_VERSION = String((require("../package.json") as { version?: unknown }).version ?? "0.0.0");

const TOOL_NAMES = [
  "read_project",
  "read_session",
  "inspect_workspace",
  "create_workspace",
  "begin_interview",
  "append_interview_turn",
  "summarize_interview",
  "summarize_research_specification",
  "read_research_specification",
  "propose_research_spec_patch",
  "apply_research_spec_patch",
  "diff_research_specification",
  "read_research_spec_history",
  "find_unincorporated_evidence",
  "cancel_interview",
  "confirm_first_research_shape",
  "confirm_research_specification",
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

interface ResearchSpecification {
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
    readyToSummarize?: boolean;
    readinessRationale?: string[];
    rationale?: string[];
  }>;
  firstResearchShape?: FirstResearchShape;
  researchSpecification?: ResearchSpecification;
  qualityNotes: string[];
  rationale: string[];
  linkedQuestionRecordIds?: string[];
  linkedDecisionRecordIds?: string[];
}

interface QuestionObligation {
  id: string;
  kind: "required_question" | "first_research_shape_confirmation" | "research_specification_confirmation";
  status: "pending" | "satisfied" | "cleared";
  createdAt: string;
  updatedAt: string;
  prompt: string;
  reason: string;
  questionId?: string;
  decisionId?: string;
  sourceHookId?: string;
}

type InterviewState = Omit<
  Awaited<ReturnType<typeof loadWorkspaceState>>,
  "firstResearchShape" | "researchSpecification" | "questionObligations"
> & {
  firstResearchShape?: FirstResearchShape;
  researchSpecification?: ResearchSpecification;
  questionObligations?: QuestionObligation[];
};

type ElicitationSchemaProperty = NonNullable<ElicitRequestFormParams["requestedSchema"]["properties"]>[string];
type AcceptedQuestionAnswer = string | string[] | {
  selectedValue?: string;
  selectedValues?: string[];
  otherText?: string;
};

const questionOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  recommended: z.boolean().optional()
});

const questionPromptTypeSchema = z.enum(["single_choice", "multi_choice", "free_text"]);

const questionAnswerInputSchema = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
  z.object({
    answer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
    selectedValue: z.string().min(1).optional(),
    selectedValues: z.array(z.string().min(1)).min(1).optional(),
    otherText: z.string().min(1).optional(),
    rationale: z.string().min(1).optional()
  })
]);

const commitmentFamilySchema = z.enum([
  "scope",
  "construct",
  "coding",
  "method",
  "evidence",
  "epistemic_authority",
  "product_policy"
]);

const epistemicBasisSchema = z.enum([
  "researcher_knowledge",
  "project_state",
  "external_evidence",
  "ai_inference",
  "mixed"
]);

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

const optionalStringArraySchema = z.array(z.string().min(1)).optional();

const researchSpecificationSchema = z.object({
  title: z.string().min(1),
  status: z.enum(["draft", "confirmed", "deferred"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  sourceHookId: z.string().optional(),
  latestRevisionId: z.string().optional(),
  sourceEvidenceIds: z.array(z.string()).optional(),
  sectionEvidence: z.record(z.string(), z.array(z.string())).optional(),
  researchDirection: z.object({
    question: z.string().optional(),
    purpose: z.string().min(1),
    scopeBoundary: z.string().optional(),
    inclusionCriteria: optionalStringArraySchema,
    exclusionCriteria: optionalStringArraySchema
  }),
  constructOntology: z.object({
    coreConstructs: z.array(z.string().min(1)).default([]),
    distinctions: z.array(z.string().min(1)).default([]),
    termsToAvoidCollapsing: optionalStringArraySchema
  }),
  theoryAndFraming: z.object({
    anchors: z.array(z.string().min(1)).default([]),
    alternatives: optionalStringArraySchema,
    overreachRisks: optionalStringArraySchema
  }),
  measurementCoding: z.object({
    variablesOrConstructs: z.array(z.string().min(1)).default([]),
    evidenceTypes: z.array(z.string().min(1)).default([]),
    codingRules: z.array(z.string().min(1)).default([]),
    openStandards: optionalStringArraySchema
  }),
  methodAnalysis: z.object({
    design: z.string().optional(),
    analysisOptions: z.array(z.string().min(1)).default([]),
    dataSufficiencyCriteria: optionalStringArraySchema,
    unsettledChoices: optionalStringArraySchema
  }),
  evidenceAccess: z.object({
    requiredSources: optionalStringArraySchema,
    accessRequirements: optionalStringArraySchema,
    evidenceStandards: optionalStringArraySchema
  }),
  epistemicAlignment: z.object({
    researcherKnowledge: optionalStringArraySchema,
    projectStatePriority: optionalStringArraySchema,
    aiInferenceLimits: optionalStringArraySchema,
    conflictResolutionRule: z.string().optional()
  }),
  protectedDecisions: z.array(z.string().min(1)).default([]),
  openQuestions: z.array(z.string().min(1)).default([]),
  nextActions: z.array(z.string().min(1)).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  confirmedAt: z.string().optional()
});

const researchSpecificationPatchSourceSchema = z.enum([
  "interview",
  "panel",
  "critic",
  "reviewer",
  "decision",
  "manual",
  "system"
]);

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

function researchSpecificationFollowUpReason(answer: string): string {
  if (answer === "ask_one_more") {
    return "The researcher chose one more question before saving; after that answer, LongTable must update or read the Research Specification and return to confirmation.";
  }
  if (answer === "revise_section") {
    return "The researcher chose section revision; after the section is revised, LongTable must return to the Research Specification Preview for confirmation.";
  }
  return "Research Specification confirmation remains open.";
}

function ensureResearchSpecificationConfirmationObligation(
  state: InterviewState,
  specification: ResearchSpecification,
  options: {
    answer: string;
    questionId?: string;
    decisionId?: string;
  }
): InterviewState {
  const existing = (state.questionObligations ?? []).find((obligation) =>
    obligation.kind === "research_specification_confirmation" &&
    obligation.status === "pending" &&
    (
      (specification.sourceHookId && obligation.sourceHookId === specification.sourceHookId) ||
      (!specification.sourceHookId && obligation.prompt.includes(specification.title))
    )
  );
  const timestamp = new Date().toISOString();
  const next: QuestionObligation = {
    ...(existing ?? {
      id: createId("question_obligation"),
      kind: "research_specification_confirmation" as const,
      status: "pending" as const,
      createdAt: timestamp
    }),
    updatedAt: timestamp,
    prompt: `Return to Research Specification Preview before ending the interview: ${specification.title}`,
    reason: researchSpecificationFollowUpReason(options.answer),
    ...(specification.sourceHookId ? { sourceHookId: specification.sourceHookId } : {}),
    ...(options.questionId ? { questionId: options.questionId } : existing?.questionId ? { questionId: existing.questionId } : {}),
    ...(options.decisionId ? { decisionId: options.decisionId } : existing?.decisionId ? { decisionId: existing.decisionId } : {})
  };
  return upsertQuestionObligation(state, next);
}

function resolveResearchSpecificationConfirmationObligation(
  state: InterviewState,
  specification: ResearchSpecification,
  options: {
    questionId?: string;
    decisionId?: string;
    status?: "satisfied" | "cleared";
  } = {}
): InterviewState {
  return {
    ...state,
    questionObligations: (state.questionObligations ?? []).map((obligation) => {
      const matches = obligation.kind === "research_specification_confirmation" && (
        (specification.sourceHookId && obligation.sourceHookId === specification.sourceHookId) ||
        (options.questionId && obligation.questionId === options.questionId) ||
        (!specification.sourceHookId && obligation.prompt.includes(specification.title))
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
  if (turns.some((turn) => turn.readyToSummarize === true && turn.quality !== "thin")) {
    return "ready_to_summarize";
  }
  const usableTurns = turns.filter((turn) => turn.quality !== "thin").length;
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
      "Official LongTable research start surface is provider-native `$longtable-start`, not the CLI start questionnaire."
    ]
  };
  const updated = upsertInterviewHook(state, hook);
  updated.workingState = {
    ...updated.workingState,
    activeInterviewHookId: hook.id,
    interviewSurface: "$longtable-start",
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
    readyToSummarize?: boolean;
    readinessRationale?: string[];
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
  const readyToSummarize = options.readyToSummarize === true && quality !== "thin";
  const readinessRationale = options.readinessRationale
    ?.map((rationale) => rationale.trim())
    .filter(Boolean);
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
    ...(readyToSummarize ? { readyToSummarize } : {}),
    ...(readinessRationale && readinessRationale.length > 0 ? { readinessRationale } : {}),
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
      ...(needsFollowUp ? [`Turn ${turn.index} needs follow-up: ${followUpQuestion}`] : []),
      ...(readyToSummarize
        ? [`Turn ${turn.index} marked ready to summarize: ${(readinessRationale ?? ["content-based readiness signal"]).join("; ")}`]
        : [])
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
    source: "$longtable-start",
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
  const purpose = input.researchDirection.purpose.trim();
  if (!title || !purpose) {
    throw new Error("Research Specification title and researchDirection.purpose are required.");
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

async function summarizeResearchSpecificationHook(
  context: Awaited<ReturnType<typeof requireContext>>,
  options: { hookId?: string; specification: ResearchSpecification }
) {
  const state = asInterviewState(await loadWorkspaceState(context));
  const sourceHookId = options.hookId
    ?? options.specification.sourceHookId
    ?? state.firstResearchShape?.sourceHookId;
  const existing = sourceHookId
    ? (state.hooks ?? []).find((hook): hook is InterviewHookRun => isInterviewHookRun(hook) && hook.id === sourceHookId)
    : activeInterviewHook(state);
  const timestamp = new Date().toISOString();
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
  const session = {
    ...(context.session as typeof context.session & { researchSpecification?: ResearchSpecification }),
    lastUpdatedAt: timestamp,
    researchSpecification: specification,
    resumeHint: `I want to continue from the Research Specification: ${specification.title}.`
  };
  context.session = session;

  const updated = hook ? upsertInterviewHook(state, hook) : state;
  updated.researchSpecification = specification;
  updated.workingState = {
    ...updated.workingState,
    researchSpecification: specification
  };
  updated.narrativeTraces.push({
    id: createId("narrative_trace"),
    timestamp,
    source: "$longtable-start",
    traceType: "judgment",
    summary: `Research Specification draft: ${specification.title}.`,
    visibility: "explicit",
    importance: specification.confidence
  });
  await writeFile(context.sessionFilePath, JSON.stringify(session, null, 2), "utf8");
  await writeFile(context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return { hook, specification, state: updated, session };
}

async function cancelInterviewHook(
  context: Awaited<ReturnType<typeof requireContext>>,
  options: { hookId?: string; reason?: string }
) {
  const state = asInterviewState(await loadWorkspaceState(context));
  const existing = activeInterviewHook(state, options.hookId);
  if (!existing) {
    throw new Error("No active LongTable interview hook was found to cancel.");
  }

  const timestamp = new Date().toISOString();
  const hook: InterviewHookRun = {
    ...existing,
    status: "cancelled",
    updatedAt: timestamp,
    rationale: [
      ...existing.rationale,
      options.reason?.trim()
        ? `Interview cancelled explicitly: ${options.reason.trim()}`
        : "Interview cancelled explicitly by the researcher."
    ]
  };
  const updated = upsertInterviewHook(state, hook);
  const workingState = {
    ...(updated.workingState ?? {})
  } as Record<string, unknown>;
  if (workingState.activeInterviewHookId === existing.id) {
    delete workingState.activeInterviewHookId;
    delete workingState.interviewSurface;
    delete workingState.interviewOpeningQuestion;
    delete workingState.interviewSeedAnswer;
  }
  updated.workingState = workingState as typeof updated.workingState;
  updated.narrativeTraces = [
    ...(updated.narrativeTraces ?? []),
    {
      id: createId("narrative_trace"),
      timestamp,
      source: "$longtable-start",
      traceType: "judgment",
      summary: options.reason?.trim()
        ? `LongTable interview cancelled: ${options.reason.trim()}.`
        : "LongTable interview cancelled before First Research Shape confirmation.",
      visibility: "explicit",
      importance: "low"
    }
  ];
  await writeFile(context.stateFilePath, JSON.stringify(updated, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return { hook, state: updated };
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
    researchSpecification: hook.researchSpecification?.title,
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
  const decisionSchema: ElicitationSchemaProperty = record.prompt.type === "multi_choice"
    ? {
        type: "array",
        title: "Decisions",
        items: {
          anyOf: choices
        },
        minItems: record.prompt.required ? 1 : 0
      }
    : record.prompt.type === "free_text"
      ? {
          type: "string",
          title: "Decision"
        }
      : {
          type: "string",
          title: "Decision",
          oneOf: choices
        };
  const properties: Record<string, ElicitationSchemaProperty> = {
    answer: decisionSchema
  };
  if (record.prompt.allowOther && record.prompt.type !== "free_text") {
    properties.otherText = {
      type: "string",
      title: record.prompt.otherLabel ?? "Other"
    };
  }

  return {
    mode: "form",
    message: [
      record.prompt.title,
      record.prompt.question,
      record.prompt.displayReason ? `Decision context: ${record.prompt.displayReason}` : undefined
    ].filter(Boolean).join("\n"),
    requestedSchema: {
      type: "object",
      properties,
      required: ["answer"]
    }
  };
}

function acceptedAnswer(result: ElicitResult): { answer: AcceptedQuestionAnswer } | null {
  if (result.action !== "accept") {
    return null;
  }
  const content = result.content as Record<string, unknown> | undefined;
  const answer = content?.answer ?? content?.answers ?? content?.selectedValues;
  const otherText = typeof content?.otherText === "string" && content.otherText.trim().length > 0
    ? content.otherText.trim()
    : undefined;
  if (typeof answer !== "string" || answer.length === 0) {
    if (Array.isArray(answer) && answer.every((entry) => typeof entry === "string" && entry.length > 0)) {
      return {
        answer: otherText ? { selectedValues: answer, otherText } : answer
      };
    }
    return null;
  }
  return {
    answer: otherText ? { selectedValue: answer, otherText } : answer
  };
}

function firstAcceptedAnswerValue(answer: AcceptedQuestionAnswer): string {
  if (typeof answer === "string") {
    return answer;
  }
  if (Array.isArray(answer)) {
    return answer[0] ?? "";
  }
  return answer.selectedValue ?? answer.selectedValues?.[0] ?? "";
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

async function markResearchSpecificationConfirmation(
  context: Awaited<ReturnType<typeof requireContext>>,
  specification: ResearchSpecification,
  answer: string,
  questionId?: string,
  decisionId?: string
) {
  const state = asInterviewState(await loadWorkspaceState(context));
  const timestamp = new Date().toISOString();
  const confirmedSpecification = researchSpecificationAnswerConfirms(answer)
    ? { ...specification, status: "confirmed" as const, confirmedAt: timestamp, updatedAt: timestamp }
    : {
        ...specification,
        status: researchSpecificationAnswerStatus(answer) === "deferred" ? "deferred" as const : "draft" as const,
        updatedAt: timestamp
      };
  state.hooks = (state.hooks ?? []).map((hook) => {
    if (hook.id !== specification.sourceHookId || !isInterviewHookRun(hook)) {
      return hook;
    }
    return {
      ...hook,
      status: researchSpecificationAnswerStatus(answer),
      updatedAt: timestamp,
      researchSpecification: confirmedSpecification,
      linkedQuestionRecordIds: questionId
        ? [...(hook.linkedQuestionRecordIds ?? []), questionId]
        : hook.linkedQuestionRecordIds,
      linkedDecisionRecordIds: decisionId
        ? [...(hook.linkedDecisionRecordIds ?? []), decisionId]
        : hook.linkedDecisionRecordIds
    };
  });
  const sourceEvidenceIds = (state.evidenceRecords ?? [])
    .filter((record) => record.sourceHookId && record.sourceHookId === specification.sourceHookId)
    .map((record) => record.id);
  const audited = applyResearchSpecificationAuditUpdate(state, {
    specification: confirmedSpecification,
    timestamp,
    source: "decision",
    title: `Research Specification confirmation: ${confirmedSpecification.title}`,
    rationale: `Research Specification confirmation answer: ${answer}`,
    sourceEvidenceIds,
    questionRecordId: questionId,
    decisionRecordId: decisionId,
    createDecisionRecord: false
  });
  const nextState = researchSpecificationAnswerConfirms(answer)
    ? resolveResearchSpecificationConfirmationObligation(audited.state, confirmedSpecification, {
        questionId,
        decisionId,
        status: "satisfied"
      })
    : researchSpecificationAnswerNeedsFollowUp(answer)
      ? ensureResearchSpecificationConfirmationObligation(audited.state, confirmedSpecification, {
          answer,
          questionId,
          decisionId
        })
      : resolveResearchSpecificationConfirmationObligation(audited.state, confirmedSpecification, {
          questionId,
          decisionId,
          status: "cleared"
        });

  const session = {
    ...context.session,
    researchSpecification: confirmedSpecification,
    lastUpdatedAt: timestamp
  };
  context.session = session;
  await writeFile(context.sessionFilePath, JSON.stringify(session, null, 2), "utf8");
  await writeFile(context.stateFilePath, JSON.stringify(nextState, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return { state: nextState, session, specification: confirmedSpecification };
}

async function markAlreadyConfirmedResearchSpecification(
  context: Awaited<ReturnType<typeof requireContext>>,
  specification: ResearchSpecification
) {
  const state = asInterviewState(await loadWorkspaceState(context));
  const timestamp = new Date().toISOString();
  const confirmedSpecification = specification.confirmedAt
    ? specification
    : { ...specification, status: "confirmed" as const, confirmedAt: timestamp, updatedAt: timestamp };
  state.researchSpecification = confirmedSpecification;
  state.workingState = {
    ...state.workingState,
    researchSpecification: confirmedSpecification
  };
  state.hooks = (state.hooks ?? []).map((hook) => {
    if (!isInterviewHookRun(hook)) {
      return hook;
    }
    const matchesSource = specification.sourceHookId && hook.id === specification.sourceHookId;
    const matchesTitle = !specification.sourceHookId && hook.researchSpecification?.title === specification.title;
    if (!matchesSource && !matchesTitle) {
      return hook;
    }
    return {
      ...hook,
      status: "confirmed",
      updatedAt: timestamp,
      researchSpecification: confirmedSpecification
    };
  });
  const nextState = resolveResearchSpecificationConfirmationObligation(state, confirmedSpecification, {
    status: "satisfied"
  });

  const session = {
    ...context.session,
    researchSpecification: confirmedSpecification,
    lastUpdatedAt: timestamp
  };
  context.session = session;
  await writeFile(context.sessionFilePath, JSON.stringify(session, null, 2), "utf8");
  await writeFile(context.stateFilePath, JSON.stringify(nextState, null, 2), "utf8");
  await syncCurrentWorkspaceView(context);
  return { state: nextState, session, specification: confirmedSpecification };
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
      description: "Create a .longtable workspace in the current folder for provider-native $longtable-start.",
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
      description: "Create or resume the active $longtable-start hook in an existing workspace.",
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
        readyToSummarize: z.boolean().optional().describe("Set true only when the interview has content-based closure readiness; never infer this from turn count alone."),
        readinessRationale: z.array(z.string()).optional().describe("Brief evidence that the interview has enough context for a First Research Shape."),
        rationale: z.array(z.string()).optional()
      })
    },
    async ({ cwd: inputCwd, hookId, question, answer, reflection, quality, needsFollowUp, followUpQuestion, readyToSummarize, readinessRationale, rationale }) => {
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
          readyToSummarize,
          readinessRationale,
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
    "summarize_research_specification",
    {
      title: "Summarize LongTable Research Specification",
      description: "Store the fuller Research Specification after a First Research Shape has enough interview context to preserve scope, constructs, theory, coding, method, evidence/access, and epistemic alignment.",
      inputSchema: cwdSchema.extend({
        hookId: z.string().optional(),
        specification: researchSpecificationSchema
      })
    },
    async ({ cwd: inputCwd, hookId, specification }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await summarizeResearchSpecificationHook(context, {
          hookId,
          specification: specification as ResearchSpecification
        });
        return textResult({
          hook: compactInterviewHook(result.hook as InterviewHookRun | undefined),
          specification: result.specification,
          preview: renderResearchSpecificationPreview(result.specification as ResearchSpecification),
          session: {
            currentGoal: result.session.currentGoal,
            currentBlocker: result.session.currentBlocker,
            nextAction: result.session.nextAction,
            firstResearchShape: result.session.firstResearchShape,
            researchSpecification: result.session.researchSpecification
          }
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "read_research_specification",
    {
      title: "Read LongTable Research Specification",
      description: "Read the current Research Specification and render the researcher-facing preview.",
      inputSchema: cwdSchema
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        const state = asInterviewState(await loadWorkspaceState(context));
        const session = context.session as typeof context.session & { researchSpecification?: ResearchSpecification };
        const specification = state.researchSpecification ?? session.researchSpecification;
        if (!specification) {
          return textResult({
            found: false,
            message: "No Research Specification was found. Run summarize_research_specification first."
          });
        }
        return textResult({
          found: true,
          specification,
          preview: renderResearchSpecificationPreview(specification)
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "propose_research_spec_patch",
    {
      title: "Propose Research Specification Patch",
      description: "Store a reviewable Research Specification patch without applying it.",
      inputSchema: cwdSchema.extend({
        specification: researchSpecificationSchema,
        source: researchSpecificationPatchSourceSchema.default("manual"),
        rationale: z.string().optional(),
        sourceEvidenceIds: z.array(z.string()).optional()
      })
    },
    async ({ cwd: inputCwd, specification, source, rationale, sourceEvidenceIds }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await proposeResearchSpecificationPatch({
          context,
          specification: specification as ResearchSpecification,
          source,
          rationale,
          sourceEvidenceIds
        });
        return textResult({
          patch: result.patch,
          changes: result.changes,
          nextAction: `apply_research_spec_patch patchId=${result.patch.id}`
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "apply_research_spec_patch",
    {
      title: "Apply Research Specification Patch",
      description: "Automatically apply a proposed or inline Research Specification update and record a revision.",
      inputSchema: cwdSchema.extend({
        patchId: z.string().optional(),
        specification: researchSpecificationSchema.optional(),
        source: researchSpecificationPatchSourceSchema.default("manual"),
        rationale: z.string().optional(),
        sourceEvidenceIds: z.array(z.string()).optional(),
        questionRecordId: z.string().optional(),
        decisionRecordId: z.string().optional()
      })
    },
    async ({ cwd: inputCwd, patchId, specification, source, rationale, sourceEvidenceIds, questionRecordId, decisionRecordId }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await applyResearchSpecificationPatch({
          context,
          patchId,
          specification: specification as ResearchSpecification | undefined,
          source,
          rationale,
          sourceEvidenceIds,
          questionRecordId,
          decisionRecordId
        });
        return textResult({
          patch: result.patch,
          revision: result.revision,
          specification: result.specification,
          decision: result.decision,
          session: {
            currentGoal: result.session.currentGoal,
            researchSpecification: result.session.researchSpecification
          }
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "diff_research_specification",
    {
      title: "Diff Research Specification",
      description: "Compare an inline Research Specification against the current workspace specification without writing state.",
      inputSchema: cwdSchema.extend({
        specification: researchSpecificationSchema
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd, specification }) => {
      try {
        const context = await requireContext(inputCwd);
        const state = asInterviewState(await loadWorkspaceState(context));
        const current = state.researchSpecification ?? context.session.researchSpecification;
        return textResult({
          current,
          changes: diffResearchSpecifications(current as ResearchSpecification | undefined, specification as ResearchSpecification)
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "read_research_spec_history",
    {
      title: "Read Research Specification History",
      description: "Read specification revisions, patches, and evidence records for audit or resume.",
      inputSchema: cwdSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        return textResult(await readResearchSpecificationHistory(context));
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "find_unincorporated_evidence",
    {
      title: "Find Unincorporated Research Evidence",
      description: "List interview, panel, critic, reviewer, or invocation evidence not yet incorporated into a Research Specification revision.",
      inputSchema: cwdSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        return textResult({
          evidenceRecords: await findUnincorporatedResearchEvidence(context)
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "cancel_interview",
    {
      title: "Cancel LongTable Interview",
      description: "Explicitly cancel the active $longtable-start hook without confirming a First Research Shape.",
      inputSchema: cwdSchema.extend({
        hookId: z.string().optional(),
        reason: z.string().optional()
      })
    },
    async ({ cwd: inputCwd, hookId, reason }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await cancelInterviewHook(context, { hookId, reason });
        return textResult({
          hook: compactInterviewHook(result.hook),
          cancelled: true
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
            firstAcceptedAnswerValue(accepted.answer),
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
    "confirm_research_specification",
    {
      title: "Confirm Research Specification",
      description: "Use MCP form elicitation to confirm, revise, defer, or request one more question for the full Research Specification.",
      inputSchema: cwdSchema.extend({
        specification: researchSpecificationSchema.optional(),
        provider: z.enum(["codex", "claude"]).default("codex"),
        fallbackOnly: z.boolean().default(false)
      })
    },
    async ({ cwd: inputCwd, specification: inputSpecification, provider, fallbackOnly }) => {
      try {
        const context = await requireContext(inputCwd);
        const state = asInterviewState(await loadWorkspaceState(context));
        const session = context.session as typeof context.session & { researchSpecification?: ResearchSpecification };
        const specification = (inputSpecification as ResearchSpecification | undefined)
          ?? state.researchSpecification
          ?? session.researchSpecification;
        if (!specification) {
          return errorResult("No Research Specification was found to confirm. Run summarize_research_specification first.");
        }
        if (specification.confirmedAt) {
          const confirmation = await markAlreadyConfirmedResearchSpecification(context, specification);
          return textResult({
            specification: confirmation.specification,
            preview: renderResearchSpecificationPreview(confirmation.specification),
            elicitation: { attempted: false, reason: "already_confirmed" }
          });
        }
        const spec = buildResearchSpecificationQuestion(specification);
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
        const fallback = renderQuestionFallback(created.question, provider as ProviderKind);
        if (fallbackOnly) {
          const marked = await markQuestionTransport(context, created.question.id, "fallback_rendered", "MCP elicitation skipped by fallbackOnly.");
          return textResult({
            question: marked ?? created.question,
            specification,
            preview: renderResearchSpecificationPreview(specification),
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
                  reason: `MCP elicitation returned action: ${elicited.action}; Research Specification confirmation was deferred.`
                })
              : undefined;
            return textResult({
              question: cleared?.question ?? marked ?? created.question,
              specification,
              preview: renderResearchSpecificationPreview(specification),
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
          const confirmation = await markResearchSpecificationConfirmation(
            context,
            specification,
            firstAcceptedAnswerValue(accepted.answer),
            created.question.id,
            decided.decision.id
          );
          return textResult({
            specification: confirmation.specification,
            preview: renderResearchSpecificationPreview(confirmation.specification),
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
            specification,
            preview: renderResearchSpecificationPreview(specification),
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
        type: questionPromptTypeSchema.optional(),
        checkpointKey: z.string().optional(),
        options: z.array(questionOptionSchema).optional(),
        allowOther: z.boolean().optional(),
        otherLabel: z.string().optional(),
        displayReason: z.string().optional(),
        provider: z.enum(["codex", "claude"]).optional(),
        required: z.boolean().optional(),
        commitmentFamily: commitmentFamilySchema.optional(),
        epistemicBasis: epistemicBasisSchema.optional()
      })
    },
    async ({ cwd: inputCwd, prompt, title, question, type, checkpointKey, options, allowOther, otherLabel, displayReason, provider, required, commitmentFamily, epistemicBasis }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await createWorkspaceQuestion({
          context,
          prompt,
          title,
          question,
          type: type as QuestionPromptType | undefined,
          checkpointKey,
          questionOptions: options as QuestionOption[] | undefined,
          allowOther,
          otherLabel,
          displayReason,
          provider,
          required,
          commitmentFamily: commitmentFamily as QuestionCommitmentFamily | undefined,
          epistemicBasis: epistemicBasis as QuestionEpistemicBasis | undefined
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
        type: questionPromptTypeSchema.optional(),
        checkpointKey: z.string().optional(),
        options: z.array(questionOptionSchema).optional(),
        allowOther: z.boolean().optional(),
        otherLabel: z.string().optional(),
        displayReason: z.string().optional(),
        provider: z.enum(["codex", "claude"]).default("codex"),
        required: z.boolean().optional(),
        commitmentFamily: commitmentFamilySchema.optional(),
        epistemicBasis: epistemicBasisSchema.optional(),
        fallbackOnly: z.boolean().default(false).describe("Create and render the checkpoint without calling MCP elicitation.")
      })
    },
    async ({ cwd: inputCwd, prompt, title, question, type, checkpointKey, options, allowOther, otherLabel, displayReason, provider, required, commitmentFamily, epistemicBasis, fallbackOnly }) => {
      try {
        const context = await requireContext(inputCwd);
        const created = await createWorkspaceQuestion({
          context,
          prompt,
          title,
          question,
          type: type as QuestionPromptType | undefined,
          checkpointKey,
          questionOptions: options as QuestionOption[] | undefined,
          allowOther,
          otherLabel,
          displayReason,
          provider,
          required,
          commitmentFamily: commitmentFamily as QuestionCommitmentFamily | undefined,
          epistemicBasis: epistemicBasis as QuestionEpistemicBasis | undefined
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
        answer: questionAnswerInputSchema,
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
