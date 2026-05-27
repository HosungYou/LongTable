import { pathToFileURL } from "node:url";
import { collectHardStopBlockers } from "@longtable/core";
import type {
  HardStopBlocker,
  LongTableHookRun,
  LongTableQuestionObligation,
  QuestionRecord
} from "@longtable/core";
import {
  collectHardStopBlockers,
  createWorkspaceFollowUpQuestions,
  collectHardStopBlockers,
  type HardStopBlocker,
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
  | "PreCompact"
  | "PostCompact"
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
    candidate === "PreCompact" ||
    candidate === "PostCompact" ||
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

function hardStopBlockers(state: LongTableRuntime["state"]): HardStopBlocker[] {
  return collectHardStopBlockers(state).activeBlockers;
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
  return /\b(longtable|longlongtable|hook|checkpoint|mcp|agents?|skills?|ux|interface|setup|install|cli|npm|version|global|release|deploy|git|github|readme|docs?|documentation|workflow|package|router|autocomplete|simulation test)\b/i.test(normalized)
    || /롱테이블|훅|체크포인트|에이전트|스킬|사용성|인터페이스|설치|세팅|글로벌|배포|버전|릴리즈|깃|깃허브|문서화된\s*절차|패키지|라우터|자동완성|시뮬레이션\s*테스트/.test(normalized);
}

function looksLikeResearchDomainPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) {
    return false;
  }
  return /\b(research|research question|research direction|scope|boundary|study|paper|manuscript|journal|article|method|methodology|measurement|construct|theory|framework|analysis|analysis plan|model|data|participant|sample|scale|survey|instrument|validity|hypothesis|literature|meta[- ]?analysis|gold standard|coding|criteria|trust|reliance|calibration)\b/i.test(normalized)
    || /연구|연구\s*질문|연구\s*방향|범위|경계|논문|원고|저널|방법론|방법|연구\s*설계|측정|구성개념|개념|이론|프레임워크|분석|분석\s*계획|모형|모델|데이터|참가자|표본|샘플|척도|설문|도구|타당도|가설|문헌|메타\s*분석|골드\s*스탠더드|코딩|기준|신뢰|의존|캘리브레이션|교정|보정/.test(normalized);
}

function looksLikeResearchCommitmentPrompt(prompt: string): boolean {
  return looksLikeResearchDomainPrompt(prompt) && (
    looksLikeClosurePrompt(prompt) ||
    /\b(change|revise|update|replace|reframe|modify|alter)\b/i.test(prompt) ||
    /바꾸|변경|수정|교체|전환|재설정/.test(prompt)
  );
}

function looksLikeAccessSensitiveResearchAction(prompt: string): boolean {
  const normalized = prompt.trim();
  return /\b(pdf|full[- ]?text|tdm|publisher api|institutional access|library login|vpn|proxy|subscription|paper collection|source collection|corpus|download)\b/i.test(normalized)
    || /PDF|원문|전문|기관\s*구독|기관구독|구독|VPN|프록시|도서관|라이브러리|TDM|논문\s*수집|문헌\s*수집|코퍼스|다운로드/.test(normalized);
}

function looksLikeQuestionGenerationPrompt(prompt: string): boolean {
  return /\b(needed questions?|necessary questions?|question generation|clarifying questions?|ask questions?)\b/i.test(prompt)
    || /필요한\s*질문|질문을\s*(모두|많이|생성)|질문\s*생성|물어봐|질문해/.test(prompt);
}

function looksLikeMultiCommitmentChangePrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  const actionCue = /\b(change|revise|update|replace|reframe|modify|alter)\b/i.test(normalized)
    || /바꾸|변경|수정|교체|전환|재설정/.test(normalized);
  if (!actionCue) {
    return false;
  }
  const categories = [
    /\b(research question|research direction|scope|boundary|inclusion criteria|exclusion criteria)\b/i.test(normalized)
      || /연구\s*질문|연구\s*문제|연구\s*방향|범위|경계|포함\s*기준|제외\s*기준/.test(normalized),
    /\b(theory|framework|conceptual model|construct map)\b/i.test(normalized)
      || /이론|프레임워크|개념\s*모형|구성개념\s*지도|컨스트럭트/.test(normalized),
    /\b(measure|measurement|scale|instrument|coding|coding rule|extraction rule|operationali[sz]ation)\b/i.test(normalized)
      || /측정|척도|도구|코딩|코딩\s*규칙|코딩\s*기준|추출\s*규칙|추출\s*기준|조작화/.test(normalized),
    /\b(method|methodology|study design|sampling|sample)\b/i.test(normalized)
      || /방법론|방법|연구\s*설계|표본|샘플링/.test(normalized),
    /\b(analysis plan|analysis method|meta[- ]?analysis|masem|(?:statistical|structural|path|analysis) model|moderator|random[- ]?effects)\b/i.test(normalized)
      || /분석\s*계획|분석\s*방법|메타\s*분석|분석\s*(?:모형|모델)|통계\s*(?:모형|모델)|구조\s*방정식|경로\s*모형|조절효과|랜덤\s*효과/.test(normalized)
  ];
  return categories.filter(Boolean).length >= 2;
}

function looksLikeExplicitInterviewPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) {
    return false;
  }
  if (/\$longtable-(?:start|interview)\b/i.test(normalized)) {
    return true;
  }
  if (looksLikeLongTableProductOrToolingPrompt(normalized)) {
    return false;
  }
  return /\bLongTable\b.*\b(?:start|interview)\b/i.test(normalized)
    || /\bfirst research shape\b/i.test(normalized)
    || /롱테이블.*(?:시작|인터뷰)|LongTable.*인터뷰|First Research Shape/i.test(normalized);
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

function shouldCreateRequiredQuestionsForPrompt(prompt: string): boolean {
  return !looksLikeLongTableProductOrToolingPrompt(prompt) &&
    (looksLikeResearchCommitmentPrompt(prompt) || looksLikeAccessSensitiveResearchAction(prompt));
}

function shouldApplyProtectedDecisionClosure(runtime: LongTableRuntime, prompt: string): boolean {
  return Boolean(runtime.context.session.protectedDecision) &&
    looksLikeResearchCommitmentPrompt(prompt) &&
    !looksLikeQuestionGenerationPrompt(prompt) &&
    !looksLikeMultiCommitmentChangePrompt(prompt);
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

function buildHardStopBlockerContext(blocker: HardStopBlocker): string {
  return [
    `LongTable hard-stop blocker ${blocker.id} affects ${blocker.scope.replace(/_/g, " ")}.`,
    blocker.prompt,
    blocker.reason,
    `Next action: ${blocker.commandHints[0] ?? "decide, clear, or defer with rationale"}`
  ].join("\n");
}

function buildStopBlockerReason(blocker: HardStopBlocker, count: number): string {
  const suffix = count > 1 ? ` (${count} active blockers total)` : "";
  return [
    `LongTable hard-stop ${blocker.id}${suffix}: ${blocker.scope.replace(/_/g, " ")}.`,
    compactContextValue(blocker.prompt, 120),
    `Required next action: ${blocker.commandHints[0] ?? "decide, clear, or defer with rationale"}.`
  ].join(" ");
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

function buildHardStopContext(blocker: HardStopBlocker): string {
  return [
    `LongTable hard-stop blocker: ${blocker.id}`,
    `Affected Research Specification area: ${blocker.scope}.`,
    `Reason: ${blocker.reason}`,
    `Next action: ${blocker.nextAction}.`,
    "Do not close, compact away, or silently apply this research-state change until the researcher records the decision."
  ].join("\n");
}

function buildSeparatePendingObligationNotice(obligation: LongTableQuestionObligation): string {
  return [
    `Separate unresolved LongTable obligation: ${obligation.prompt}`,
    "This is not part of the active interview. Keep it visible only when the researcher is settling or saving the research direction."
  ].join("\n");
}

function buildHardStopContext(runtime: LongTableRuntime): string | null {
  const verdict = collectHardStopBlockers(runtime.state);
  const blocker = verdict.activeBlockers[0];
  if (!blocker) {
    return null;
  }
  return [
    `Hard-stop Researcher Checkpoint is still pending: ${blocker.id}`,
    `Affected Research Specification area: ${blocker.scope}`,
    `Question/obligation: ${blocker.prompt}`,
    `Reason: ${blocker.reason}`,
    `Required next action: ${blocker.commandHint}; or clear/defer it with an explicit rationale.`,
    verdict.activeBlockers.length > 1 ? `Additional hard-stop blockers: ${verdict.activeBlockers.length - 1}` : ""
  ].filter(Boolean).join("\n");
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

function postCompactContext(runtime: LongTableRuntime): string | null {
  const blockingQuestion = pendingRequiredQuestions(runtime.state)[0];
  const blockingObligation = pendingObligations(runtime.state)[0];
  const interview = activeInterviewHook(runtime.state);
  if (!blockingQuestion && !blockingObligation && !interview) {
    return null;
  }

  const sections = [buildWorkspaceSummary(runtime, "compact").join("\n")];
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
  if (shouldApplyProtectedDecisionClosure(runtime, prompt)) {
    const protectedGenerated = await createWorkspaceFollowUpQuestions({
      context: runtime.context,
      prompt: protectedDecisionClosurePrompt(prompt),
      provider: "codex",
      required: true,
      auto: true,
      requiredOnly: true
    });
    generatedQuestions.push(...protectedGenerated.questions);
    createdQuestions = createdQuestions || protectedGenerated.created;
  } else if (shouldCreateRequiredQuestionsForPrompt(prompt)) {
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

  if (generatedQuestions.length > 0) {
    return buildGeneratedQuestionsContext(generatedQuestions, createdQuestions);
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

  const hardStopContext = buildHardStopContext(runtime);
  if (hardStopContext && mutatesLongTableResearchState(command)) {
    return buildBlockOutput(
      "PreToolUse",
      "A LongTable hard-stop is pending before a research-state Bash command.",
      hardStopContext
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
  const hardStopContext = buildHardStopContext(runtime);

  if (hardStopContext && mutatesLongTableResearchState(command)) {
    return buildBlockOutput(
      "PostToolUse",
      "A research-state Bash command completed while LongTable still had an unresolved hard-stop.",
      hardStopContext
    );
  }

  if (exitCode !== null && exitCode !== 0 && output && mutatesLongTableResearchState(command)) {
    return buildBlockOutput(
      "PostToolUse",
      "A LongTable-relevant Bash command returned a non-zero exit code and should be reviewed before LongTable continues.",
      "Review the command output and explain what failed before retrying or continuing."
    );
  }

  return null;
}

function stopOutput(runtime: LongTableRuntime): Record<string, unknown> | null {
  const hardStopContext = buildHardStopContext(runtime);
  return hardStopContext ? buildStopBlockOutput(hardStopContext) : null;
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

  if (hookEventName === "PreCompact") {
    return null;
  }

  if (hookEventName === "PostCompact") {
    const additionalContext = postCompactContext(runtime);
    return additionalContext
      ? buildAdditionalContextOutput(hookEventName, additionalContext)
      : null;
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
