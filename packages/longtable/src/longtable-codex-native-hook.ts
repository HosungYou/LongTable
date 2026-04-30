import { pathToFileURL } from "node:url";
import type {
  LongTableHookRun,
  LongTableQuestionObligation,
  QuestionOpportunity,
  QuestionRecord
} from "@longtable/core";
import {
  buildQuestionOpportunitySpecs,
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
  return /\b(final|finalize|commit|ship|submit|publish|freeze|settle|decide|lock|record|apply|incorporate)\b/i.test(normalized)
    || /최종|확정|커밋|제출|투고|고정|결정|기록|반영/.test(normalized);
}

function looksLikeLongTableProductOrToolingPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) {
    return false;
  }
  return /\b(longlongtable|hook|checkpoint|mcp|agents?|skills?|ux|interface|setup|install|cli|npm|version|global|release|deploy|git|github|readme|docs?|documentation|workflow|package|router|autocomplete|simulation test)\b/i.test(normalized)
    || /롱테이블|훅|체크포인트|에이전트|스킬|사용성|인터페이스|설치|세팅|글로벌|배포|버전|릴리즈|깃|깃허브|문서화된\s*절차|패키지|라우터|자동완성|시뮬레이션\s*테스트/.test(normalized);
}

function looksLikeResearchDomainPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) {
    return false;
  }
  return /\b(research|study|paper|manuscript|journal|article|method|methodology|measurement|construct|theory|analysis|model|data|participant|sample|scale|survey|instrument|validity|hypothesis|literature|meta[- ]?analysis|gold standard|coding|trust|reliance|calibration)\b/i.test(normalized)
    || /연구|논문|원고|저널|방법론|방법|연구\s*설계|측정|구성개념|개념|이론|분석|모형|모델|데이터|참가자|표본|샘플|척도|설문|도구|타당도|가설|문헌|메타\s*분석|골드\s*스탠더드|코딩|신뢰|의존|캘리브레이션|교정|보정/.test(normalized);
}

function looksLikeResearchCommitmentPrompt(prompt: string): boolean {
  return looksLikeResearchDomainPrompt(prompt) && looksLikeClosurePrompt(prompt);
}

function looksLikeExplicitInterviewPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) {
    return false;
  }
  if (/\$longtable-interview\b/i.test(normalized)) {
    return true;
  }
  if (looksLikeLongTableProductOrToolingPrompt(normalized)) {
    return false;
  }
  return /\bLongTable\b.*\binterview\b/i.test(normalized)
    || /\bfirst research shape\b/i.test(normalized)
    || /롱테이블.*인터뷰|LongTable.*인터뷰|First Research Shape/i.test(normalized);
}

function looksLikeResearchStateConfirmationPrompt(prompt: string): boolean {
  if (looksLikeLongTableProductOrToolingPrompt(prompt) && !looksLikeExplicitInterviewPrompt(prompt)) {
    return false;
  }
  return looksLikeResearchCommitmentPrompt(prompt)
    || (looksLikeExplicitInterviewPrompt(prompt) && looksLikeClosurePrompt(prompt))
    || /\b(confirm|summarize|save|store|record)\b.*\b(first research shape|research direction|research shape)\b/i.test(prompt)
    || /(First Research Shape|연구\s*방향|연구\s*형태).*(확정|저장|기록|요약)/.test(prompt);
}

function shouldSurfaceInterviewContext(prompt: string): boolean {
  return looksLikeExplicitInterviewPrompt(prompt) || looksLikeResearchStateConfirmationPrompt(prompt);
}

function buildResponseOnlyAdvisoryQuestions(prompt: string): QuestionOpportunity[] {
  if (looksLikeLongTableProductOrToolingPrompt(prompt)) {
    return [];
  }
  const opportunities = buildQuestionOpportunitySpecs(prompt, {
    includeFallback: false,
    autoOnly: true
  });
  if (opportunities.length === 0) {
    return [];
  }
  if (!looksLikeResearchDomainPrompt(prompt) && !/\b(needed questions?|necessary questions?|clarifying questions?|question generation|assumptions?|uncertain|not sure|gap|tension|trade[- ]?off)\b/i.test(prompt) && !/필요한\s*질문|질문\s*생성|물어봐|질문해|전제|가정|불확실|모르겠|공백|긴장|상충|균형/.test(prompt)) {
    return [];
  }
  return opportunities.slice(0, 3);
}

function shouldCreateRequiredQuestionsForPrompt(prompt: string): boolean {
  return !looksLikeLongTableProductOrToolingPrompt(prompt) && looksLikeResearchCommitmentPrompt(prompt);
}

function shouldApplyProtectedDecisionClosure(runtime: LongTableRuntime, prompt: string): boolean {
  return Boolean(runtime.context.session.protectedDecision) &&
    shouldCreateRequiredQuestionsForPrompt(prompt);
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

function mutatesLongTableResearchState(command: string): boolean {
  const normalized = command.trim();
  if (!normalized) {
    return false;
  }
  return /\.longtable(?:\/|\b)|\bCURRENT\.md\b/.test(normalized)
    || /\blongtable\s+(?:start|question|clear-question|prune-questions|ask|clarify|panel|team)\b/.test(normalized);
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
    `Record it with longtable decide --question ${question.id} --answer <value> if you are outside MCP elicitation.`,
    "Do not choose or record an answer unless the researcher explicitly provides the selection."
  ].join("\n");
}

function buildSeparatePendingQuestionNotice(question: QuestionRecord): string {
  return [
    `Separate unresolved Researcher Checkpoint: ${question.prompt.title}.`,
    `Question: ${question.prompt.question}`,
    "This is not part of the active interview. Keep it visible, but do not answer or record it unless the researcher explicitly provides the selection."
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
  lines.push("Do not choose or record answers for these checkpoints unless the researcher explicitly provides the selections.");
  return lines.join("\n");
}

function buildAdvisoryQuestionsContext(questions: QuestionOpportunity[]): string {
  const lines = [
    `LongTable surfaced ${questions.length} response-only advisory question${questions.length === 1 ? "" : "s"} for this prompt.`,
    "Use these only if they help the reply. Do not create QuestionRecord entries, call longtable decide, or answer for the researcher unless the prompt explicitly asks to commit a research decision."
  ];
  for (const question of questions) {
    lines.push(`- ${question.title}: ${question.question}`);
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

function buildSeparatePendingObligationNotice(obligation: LongTableQuestionObligation): string {
  return [
    `Separate unresolved LongTable obligation: ${obligation.prompt}`,
    "This is not part of the active interview. Keep it visible only when the researcher is settling or saving the research direction."
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

  if (interview) {
    sections.push(buildActiveInterviewContext(interview));
    if (blockingQuestion) {
      sections.push(buildSeparatePendingQuestionNotice(blockingQuestion));
    } else if (blockingObligation) {
      sections.push(buildSeparatePendingObligationNotice(blockingObligation));
    }
  } else if (blockingQuestion) {
    sections.push(buildPendingQuestionContext(blockingQuestion));
  } else if (blockingObligation) {
    sections.push(buildPendingObligationContext(blockingObligation));
  }

  sections.push("Treat `.longtable/` state and `CURRENT.md` as the source of truth for this workspace.");
  return sections.filter(Boolean).join("\n\n");
}

async function userPromptSubmitContext(runtime: LongTableRuntime, prompt: string): Promise<string | null> {
  const blockingQuestion = pendingRequiredQuestions(runtime.state)[0];
  const blockingObligation = pendingObligations(runtime.state)[0];
  const interview = activeInterviewHook(runtime.state);
  const shouldSurfaceInterview = shouldSurfaceInterviewContext(prompt);
  const shouldSurfaceBlockingState = looksLikeResearchStateConfirmationPrompt(prompt);

  if (interview && shouldSurfaceInterview) {
    const sections = [buildActiveInterviewContext(interview)];
    if (blockingQuestion) {
      sections.push(buildSeparatePendingQuestionNotice(blockingQuestion));
    } else if (blockingObligation) {
      sections.push(buildSeparatePendingObligationNotice(blockingObligation));
    }
    return sections.join("\n\n");
  }

  if (blockingQuestion && shouldSurfaceBlockingState) {
    return buildPendingQuestionContext(blockingQuestion);
  }

  if (blockingObligation && shouldSurfaceBlockingState) {
    return buildPendingObligationContext(blockingObligation);
  }

  if (interview) {
    return null;
  }

  const generatedQuestions: QuestionRecord[] = [];
  let createdQuestions = false;
  if (shouldCreateRequiredQuestionsForPrompt(prompt)) {
    const generated = await createWorkspaceFollowUpQuestions({
      context: runtime.context,
      prompt,
      provider: "codex",
      required: true,
      auto: true,
      requiredOnly: true
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
      auto: true,
      requiredOnly: true
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

  const advisoryQuestions = buildResponseOnlyAdvisoryQuestions(prompt);
  if (advisoryQuestions.length > 0) {
    return buildAdvisoryQuestionsContext(advisoryQuestions);
  }

  return null;
}

function preToolUseOutput(runtime: LongTableRuntime, payload: CodexHookPayload): Record<string, unknown> | null {
  if (readToolName(payload) !== "Bash") {
    return null;
  }
  const command = readCommandText(payload);
  const stateChangingCommand = isStateChangingBash(command) || mutatesLongTableResearchState(command);
  if (!stateChangingCommand) {
    return null;
  }

  const blockingQuestion = pendingRequiredQuestions(runtime.state)[0];
  if (blockingQuestion && mutatesLongTableResearchState(command)) {
    return buildBlockOutput(
      "PreToolUse",
      "A required LongTable checkpoint is still pending before a research-state Bash command.",
      buildPendingQuestionContext(blockingQuestion)
    );
  }

  const blockingObligation = pendingObligations(runtime.state)[0];
  if (blockingObligation && mutatesLongTableResearchState(command)) {
    return buildBlockOutput(
      "PreToolUse",
      "A LongTable research obligation is still pending before a research-state Bash command.",
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

  if ((blockingQuestion || blockingObligation) && mutatesLongTableResearchState(command)) {
    return buildBlockOutput(
      "PostToolUse",
      "A research-state Bash command completed while LongTable still had an unresolved checkpoint or obligation.",
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
  void runtime;
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
