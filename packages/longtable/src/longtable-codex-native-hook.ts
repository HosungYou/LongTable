import { pathToFileURL } from "node:url";
import type {
  LongTableHookRun,
  LongTableQuestionObligation,
  QuestionRecord
} from "@longtable/core";
import {
  createWorkspaceFollowUpQuestions,
  type LongTableProjectContext,
  loadProjectContextFromDirectory,
  loadWorkspaceState,
  pendingQuestionObligations
} from "./index.js";

type CodexHookEventName =
  | "SessionStart"
  | "PreToolUse"
  | "PostToolUse"
  | "UserPromptSubmit"
  | "Stop";

type CodexHookPayload = Record<string, unknown>;

interface LongTableRuntime {
  context: LongTableProjectContext;
  state: Awaited<ReturnType<typeof loadWorkspaceState>>;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return null;
}

function readHookEventName(payload: CodexHookPayload): CodexHookEventName | null {
  const candidate = safeString(
    payload.hook_event_name ??
    payload.hookEventName ??
    payload.event ??
    payload.name
  ).trim();
  if (
    candidate === "SessionStart" ||
    candidate === "PreToolUse" ||
    candidate === "PostToolUse" ||
    candidate === "UserPromptSubmit" ||
    candidate === "Stop"
  ) {
    return candidate;
  }
  return null;
}

function readPromptText(payload: CodexHookPayload): string {
  return safeString(payload.prompt ?? payload.user_prompt ?? payload.userPrompt).trim();
}

function readToolName(payload: CodexHookPayload): string {
  return safeString(payload.tool_name ?? payload.toolName).trim();
}

function readCommandText(payload: CodexHookPayload): string {
  const direct = safeString(payload.command ?? payload.input ?? payload.tool_input ?? payload.toolInput).trim();
  if (direct) {
    return direct;
  }

  const toolInput = payload.tool_input ?? payload.toolInput;
  if (toolInput && typeof toolInput === "object") {
    const objectInput = toolInput as Record<string, unknown>;
    return safeString(objectInput.command ?? objectInput.input ?? objectInput.cmd).trim();
  }

  return "";
}

function readExitCode(payload: CodexHookPayload): number | null {
  return safeInteger(payload.exit_code ?? payload.exitCode);
}

function readCombinedOutput(payload: CodexHookPayload): string {
  return [
    safeString(payload.stderr),
    safeString(payload.stdout),
    safeString(payload.output)
  ].filter(Boolean).join("\n").trim();
}

function formatQuestionOptions(question: QuestionRecord): string {
  const options = question.prompt.options.map((option) => option.value);
  if (question.prompt.allowOther) {
    options.push("other");
  }
  return options.join("/");
}

function pendingRequiredQuestions(state: LongTableRuntime["state"]): QuestionRecord[] {
  return (state.questionLog ?? []).filter((question) => question.status === "pending" && question.prompt.required);
}

function pendingObligations(state: LongTableRuntime["state"]): LongTableQuestionObligation[] {
  return pendingQuestionObligations(state);
}

function activeInterviewHook(state: LongTableRuntime["state"]): LongTableHookRun | undefined {
  return [...(state.hooks ?? [])].reverse().find((hook) =>
    hook.kind === "longtable_interview" &&
    (hook.status === "pending" || hook.status === "active" || hook.status === "ready_to_confirm")
  );
}

function compactContextValue(value: string, maxLength = 160): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function buildAdditionalContextOutput(
  hookEventName: CodexHookEventName,
  additionalContext: string
): Record<string, unknown> {
  return {
    hookSpecificOutput: {
      hookEventName,
      additionalContext
    }
  };
}

function buildBlockOutput(
  hookEventName: Exclude<CodexHookEventName, "Stop">,
  reason: string,
  additionalContext: string
): Record<string, unknown> {
  return {
    hookSpecificOutput: {
      hookEventName,
      permissionDecision: "deny",
      permissionDecisionReason: reason,
      additionalContext
    }
  };
}

function buildStopBlockOutput(reason: string): Record<string, unknown> {
  return {
    decision: "block",
    reason
  };
}

function looksLikeClosurePrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) {
    return false;
  }
  return /\b(final|finalize|commit|ship|submit|revise|rewrite|draft|publish|implement|fix)\b/i.test(normalized)
    || /최종|확정|커밋|제출|수정|초안|구현|진행|고쳐/.test(normalized);
}

function looksLikeExecutionDirective(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) {
    return false;
  }
  return /\b(proceed|implement|fix|publish|release|deploy|tag|push|ship)\b/i.test(normalized)
    || /진행|구현|수정|고쳐|배포|릴리즈|태그|푸시|출시/.test(normalized);
}

function looksLikeLongTableEngineeringPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) {
    return false;
  }
  return /\b(longtable|hook|checkpoint|mcp|agent|npm|version|global|publish|release|deploy|git)\b/i.test(normalized)
    || /롱테이블|훅|체크포인트|에이전트|글로벌|배포|버전|릴리즈|깃|깃허브/.test(normalized);
}

function shouldAutoCreateQuestionsForPrompt(prompt: string): boolean {
  return !(looksLikeExecutionDirective(prompt) && looksLikeLongTableEngineeringPrompt(prompt));
}

function shouldApplyProtectedDecisionClosure(runtime: LongTableRuntime, prompt: string): boolean {
  return Boolean(runtime.context.session.protectedDecision) &&
    looksLikeClosurePrompt(prompt) &&
    !looksLikeLongTableEngineeringPrompt(prompt);
}

function protectedDecisionClosurePrompt(prompt: string): string {
  return [
    "Protected decision closure pressure.",
    "The protected decision text is stored in the current session.",
    `User prompt: ${prompt}`
  ].join("\n");
}

function isStateChangingBash(command: string): boolean {
  const normalized = command.trim();
  if (!normalized) {
    return false;
  }
  return /\b(git\s+commit|npm\s+version|mv|cp|rm|sed\s+-i|perl\s+-i|tee|touch|mkdir|rmdir|apply_patch|patch)\b/.test(normalized)
    || />\s*\S+/.test(normalized);
}

async function loadLongTableRuntime(startPath: string): Promise<LongTableRuntime | null> {
  const context = await loadProjectContextFromDirectory(startPath);
  if (!context) {
    return null;
  }
  const state = await loadWorkspaceState(context);
  return { context, state };
}

function buildWorkspaceSummary(runtime: LongTableRuntime, detail: "compact" | "full" = "compact"): string[] {
  const { context, state } = runtime;
  if (detail === "compact") {
    const primaryContext = state.firstResearchShape
      ? `First research shape: ${compactContextValue(state.firstResearchShape.handle, 96)}.`
      : `Current goal: ${compactContextValue(context.session.currentGoal, 120)}.`;
    return [
      "LongTable workspace detected; research context restored.",
      primaryContext,
      context.session.nextAction ? `Next action: ${compactContextValue(context.session.nextAction)}.` : "",
      context.session.protectedDecision ? "Protected decision: active; full text is in `.longtable/` and `CURRENT.md`." : ""
    ].filter(Boolean);
  }

  const lines = [
    "LongTable workspace detected.",
    `Current goal: ${context.session.currentGoal}.`,
    context.session.currentBlocker ? `Current blocker: ${context.session.currentBlocker}.` : "",
    context.session.protectedDecision ? `Protected decision: ${context.session.protectedDecision}.` : "",
    state.firstResearchShape ? `First research shape: ${state.firstResearchShape.handle}.` : "",
    context.session.nextAction ? `Next action: ${context.session.nextAction}.` : ""
  ].filter(Boolean);
  return lines;
}

function buildPendingQuestionContext(question: QuestionRecord): string {
  return [
    `Required Researcher Checkpoint is still pending: ${question.prompt.question}`,
    `Options: ${formatQuestionOptions(question)}`,
    `Record it with longtable decide --question ${question.id} --answer <value> if you are outside MCP elicitation.`
  ].join("\n");
}

function buildGeneratedQuestionsContext(questions: QuestionRecord[], created: boolean): string {
  const lines = [
    created
      ? `LongTable created ${questions.length} required Researcher Checkpoint${questions.length === 1 ? "" : "s"} for this prompt.`
      : `LongTable found ${questions.length} pending Researcher Checkpoint${questions.length === 1 ? "" : "s"} for this prompt.`
  ];
  for (const question of questions) {
    lines.push(`- ${question.prompt.title}: ${question.prompt.question}`);
    lines.push(`  Options: ${formatQuestionOptions(question)}`);
    lines.push(`  Record it with longtable decide --question ${question.id} --answer <value> if you are outside MCP elicitation.`);
  }
  return lines.join("\n");
}

function buildPendingObligationContext(obligation: LongTableQuestionObligation): string {
  return [
    `Pending LongTable research obligation: ${obligation.prompt}`,
    obligation.reason,
    obligation.questionId
      ? `This obligation is linked to question ${obligation.questionId}; answer it before treating the direction as settled.`
      : "Resume the LongTable interview and let it ask the next research-facing checkpoint before settling the direction."
  ].join("\n");
}

function buildActiveInterviewContext(hook: LongTableHookRun): string {
  const turnCount = hook.turns?.length ?? 0;
  return [
    "A LongTable interview is currently active.",
    `Interview status: ${hook.status}.`,
    `Turns recorded: ${turnCount}.`,
    "Do not finalize the research direction until the interview is either summarized into a First Research Shape or explicitly cleared."
  ].join("\n");
}

function sessionStartContext(runtime: LongTableRuntime): string {
  const blockingQuestion = pendingRequiredQuestions(runtime.state)[0];
  const blockingObligation = pendingObligations(runtime.state)[0];
  const interview = activeInterviewHook(runtime.state);
  const needsDetailedSummary = Boolean(blockingQuestion || blockingObligation);
  const sections = [buildWorkspaceSummary(runtime, needsDetailedSummary ? "full" : "compact").join("\n")];

  if (blockingQuestion) {
    sections.push(buildPendingQuestionContext(blockingQuestion));
  } else if (blockingObligation) {
    sections.push(buildPendingObligationContext(blockingObligation));
  } else if (interview) {
    sections.push(buildActiveInterviewContext(interview));
  }

  sections.push("Treat `.longtable/` state and `CURRENT.md` as the source of truth for this workspace.");
  return sections.filter(Boolean).join("\n\n");
}

async function userPromptSubmitContext(runtime: LongTableRuntime, prompt: string): Promise<string | null> {
  const blockingQuestion = pendingRequiredQuestions(runtime.state)[0];
  if (blockingQuestion) {
    return buildPendingQuestionContext(blockingQuestion);
  }

  const blockingObligation = pendingObligations(runtime.state)[0];
  if (blockingObligation) {
    return buildPendingObligationContext(blockingObligation);
  }

  const interview = activeInterviewHook(runtime.state);
  if (interview) {
    return buildActiveInterviewContext(interview);
  }

  const generatedQuestions: QuestionRecord[] = [];
  let createdQuestions = false;
  if (shouldAutoCreateQuestionsForPrompt(prompt)) {
    const generated = await createWorkspaceFollowUpQuestions({
      context: runtime.context,
      prompt,
      provider: "codex",
      required: true,
      auto: true
    });
    generatedQuestions.push(...generated.questions);
    createdQuestions = createdQuestions || generated.created;
  }

  if (shouldApplyProtectedDecisionClosure(runtime, prompt)) {
    const protectedGenerated = await createWorkspaceFollowUpQuestions({
      context: runtime.context,
      prompt: protectedDecisionClosurePrompt(prompt),
      provider: "codex",
      required: true,
      auto: true
    });
    generatedQuestions.push(
      ...protectedGenerated.questions.filter((question) =>
        !generatedQuestions.some((existing) => existing.id === question.id)
      )
    );
    createdQuestions = createdQuestions || protectedGenerated.created;
  }

  if (generatedQuestions.length > 0) {
    return buildGeneratedQuestionsContext(generatedQuestions, createdQuestions);
  }

  if (shouldApplyProtectedDecisionClosure(runtime, prompt)) {
    return [
      `This workspace marks ${runtime.context.session.protectedDecision} as a protected decision.`,
      "Before you settle it through drafting, revision, or closure, surface one researcher-facing checkpoint grounded in the current blocker or open questions."
    ].join("\n");
  }

  return null;
}

function preToolUseOutput(runtime: LongTableRuntime, payload: CodexHookPayload): Record<string, unknown> | null {
  if (readToolName(payload) !== "Bash") {
    return null;
  }
  const command = readCommandText(payload);
  if (!isStateChangingBash(command)) {
    return null;
  }

  const blockingQuestion = pendingRequiredQuestions(runtime.state)[0];
  if (blockingQuestion) {
    return buildBlockOutput(
      "PreToolUse",
      "A required LongTable checkpoint is still pending before a state-changing Bash command.",
      buildPendingQuestionContext(blockingQuestion)
    );
  }

  const blockingObligation = pendingObligations(runtime.state)[0];
  if (blockingObligation) {
    return buildBlockOutput(
      "PreToolUse",
      "A LongTable research obligation is still pending before a state-changing Bash command.",
      buildPendingObligationContext(blockingObligation)
    );
  }

  return null;
}

function postToolUseOutput(runtime: LongTableRuntime, payload: CodexHookPayload): Record<string, unknown> | null {
  if (readToolName(payload) !== "Bash") {
    return null;
  }

  const command = readCommandText(payload);
  const exitCode = readExitCode(payload);
  const output = readCombinedOutput(payload);
  const blockingQuestion = pendingRequiredQuestions(runtime.state)[0];
  const blockingObligation = pendingObligations(runtime.state)[0];

  if ((blockingQuestion || blockingObligation) && isStateChangingBash(command)) {
    return buildBlockOutput(
      "PostToolUse",
      "A state-changing Bash command completed while LongTable still had an unresolved checkpoint or obligation.",
      blockingQuestion
        ? buildPendingQuestionContext(blockingQuestion)
        : buildPendingObligationContext(blockingObligation!)
    );
  }

  if (exitCode !== null && exitCode !== 0 && output) {
    return buildBlockOutput(
      "PostToolUse",
      "The Bash command returned a non-zero exit code and should be reviewed before LongTable continues.",
      "Review the command output and explain what failed before retrying or continuing."
    );
  }

  return null;
}

function stopOutput(runtime: LongTableRuntime): Record<string, unknown> | null {
  const blockingQuestion = pendingRequiredQuestions(runtime.state)[0];
  if (blockingQuestion) {
    return buildStopBlockOutput(
      "A required LongTable Researcher Checkpoint is still pending.",
    );
  }

  const blockingObligation = pendingObligations(runtime.state)[0];
  if (blockingObligation) {
    return buildStopBlockOutput(
      "A LongTable research obligation is still pending.",
    );
  }

  return null;
}

export async function dispatchCodexHook(
  payload: CodexHookPayload,
  cwdOverride?: string
): Promise<Record<string, unknown> | null> {
  const hookEventName = readHookEventName(payload);
  if (!hookEventName) {
    return null;
  }

  const runtime = await loadLongTableRuntime(cwdOverride ?? process.cwd());
  if (!runtime) {
    return null;
  }

  if (hookEventName === "SessionStart") {
    return buildAdditionalContextOutput(hookEventName, sessionStartContext(runtime));
  }

  if (hookEventName === "UserPromptSubmit") {
    const additionalContext = await userPromptSubmitContext(runtime, readPromptText(payload));
    return additionalContext
      ? buildAdditionalContextOutput(hookEventName, additionalContext)
      : null;
  }

  if (hookEventName === "PreToolUse") {
    return preToolUseOutput(runtime, payload);
  }

  if (hookEventName === "PostToolUse") {
    return postToolUseOutput(runtime, payload);
  }

  if (hookEventName === "Stop") {
    return stopOutput(runtime);
  }

  return null;
}

async function readStdinJson(): Promise<CodexHookPayload> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? parsed as CodexHookPayload : {};
  } catch {
    return {};
  }
}

export function isCodexNativeHookMainModule(moduleUrl: string, argv1: string | undefined): boolean {
  if (!argv1) {
    return false;
  }
  return moduleUrl === pathToFileURL(argv1).href;
}

async function main(): Promise<void> {
  const payload = await readStdinJson();
  const output = await dispatchCodexHook(payload);
  if (output) {
    process.stdout.write(JSON.stringify(output));
  }
}

if (isCodexNativeHookMainModule(import.meta.url, process.argv[1])) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
