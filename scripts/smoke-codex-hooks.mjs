import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const { dispatchCodexHook } = await import(join(repoRoot, "packages", "longtable", "dist", "longtable-codex-native-hook.js"));
const {
  answerWorkspaceQuestion,
  clearWorkspaceQuestion,
  createWorkspaceQuestion,
  loadProjectContextFromDirectory,
  mergeManagedCodexHooksConfig
} = await import(join(repoRoot, "packages", "longtable", "dist", "index.js"));
const {
  buildFirstResearchShapeQuestion
} = await import(join(repoRoot, "packages", "longtable-mcp", "dist", "index.js"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

function runCli(args, cwdValue) {
  return execFileSync("node", [cli, ...args], {
    cwd: cwdValue,
    encoding: "utf8"
  });
}

const hooksTmp = mkdtempSync(join(tmpdir(), "longtable-codex-hooks-install-"));
const codexConfigPath = join(hooksTmp, "config.toml");
const hooksPath = join(hooksTmp, "hooks.json");

writeFileSync(hooksPath, JSON.stringify({
  hooks: {
    Stop: [
      {
        matcher: "custom",
        hooks: [
          {
            type: "command",
            command: "echo custom-stop-hook"
          }
        ]
      }
    ]
  }
}, null, 2));

const installResult = JSON.parse(runCli([
  "codex",
  "install-hooks",
  "--codex-config", codexConfigPath,
  "--hooks-path", hooksPath,
  "--json"
], hooksTmp));

assertEqual(installResult.codexHooksEnabled, true, "codex hooks feature should be enabled");
assertEqual(installResult.managedEvents.length, 5, "managed hook event count");
const writtenConfig = readFileSync(codexConfigPath, "utf8");
assert(/\[features\]/.test(writtenConfig) && /codex_hooks\s*=\s*true/.test(writtenConfig), "config should enable codex_hooks");
const mergedHooks = JSON.parse(readFileSync(hooksPath, "utf8"));
assert(mergedHooks.hooks.Stop.some((entry) => entry.matcher === "custom"), "existing user hook should be preserved");
assert(mergedHooks.hooks.SessionStart.length > 0, "managed SessionStart hook should exist");

const mergedPreview = JSON.parse(mergeManagedCodexHooksConfig(readFileSync(hooksPath, "utf8"), join(repoRoot, "packages", "longtable")));
assert(mergedPreview.hooks.UserPromptSubmit.length > 0, "hook merge helper should preserve managed UserPromptSubmit");

const shapeQuestion = buildFirstResearchShapeQuestion({
  handle: "behavioral trust calibration measurement",
  currentGoal: "Measure trust calibration with behavioral reliance outcomes.",
  currentBlocker: "Calibration is still defined too technically.",
  protectedDecision: "what counts as calibration",
  openQuestions: ["Which unresolved judgment should LongTable keep explicit first?"],
  nextAction: "Clarify the protected research judgment.",
  confidence: "medium",
  sourceHookId: "hook_test"
});
assert(!shapeQuestion.question.includes("How should LongTable treat this first research handle?"), "shape question should not use the old technical wording");
assert(!shapeQuestion.question.includes("what counts as calibration"), "shape question should keep long protected-decision text out of the title question");
assert(shapeQuestion.options.some((option) => option.value === "protect_decision"), "shape question should offer a protected-decision option");
const protectedOption = shapeQuestion.options.find((option) => option.value === "protect_decision");
assertEqual(protectedOption?.label, "Keep the protected decision open", "protected-decision option should use a short UI label");
assert(protectedOption?.description?.includes("what counts as calibration"), "protected-decision detail should move to the option description");

const workspaceTmp = mkdtempSync(join(tmpdir(), "longtable-codex-hook-runtime-"));
const setupPath = join(workspaceTmp, "setup.json");
const runtimePath = join(workspaceTmp, "runtime.toml");

runCli([
  "setup",
  "--provider", "codex",
  "--install-scope", "none",
  "--surfaces", "cli_only",
  "--intervention", "strong",
  "--workspace", "later",
  "--setup-path", setupPath,
  "--runtime-path", runtimePath,
  "--json"
], workspaceTmp);

runCli([
  "start",
  "--setup", setupPath,
  "--path", workspaceTmp,
  "--name", "Codex Hook Smoke",
  "--goal", "Check LongTable hook guards",
  "--blocker", "research detail",
  "--research-object", "measurement_instrument",
  "--gap-risk", "known_gap",
  "--protected-decision", "measurement",
  "--perspectives", "auto",
  "--disagreement", "always_visible",
  "--no-interview",
  "--json"
], workspaceTmp);

const context = await loadProjectContextFromDirectory(workspaceTmp);
assert(context, "workspace context should exist");

const autoQuestionHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "LongTable 훅과 체크포인트가 철학적으로 멈춰야 하는 지점에서 필요한 질문을 생성하는지 평가해줘."
}, workspaceTmp);
const autoQuestionContext = autoQuestionHook?.hookSpecificOutput?.additionalContext ?? "";
assert(autoQuestionContext.includes("LongTable created"), "UserPromptSubmit should create required checkpoint questions for high-signal LongTable prompts");
assert(autoQuestionContext.includes("Question harness target"), "Generated hook context should include the harness question");
const autoQuestionState = JSON.parse(readFileSync(join(workspaceTmp, ".longtable", "state.json"), "utf8"));
const generatedQuestions = (autoQuestionState.questionLog ?? []).filter((question) =>
  question.status === "pending" &&
  question.prompt.checkpointKey?.startsWith("follow_up_")
);
assert(generatedQuestions.length >= 2, "High-signal hook prompt should persist multiple follow-up questions");
for (const question of generatedQuestions) {
  await clearWorkspaceQuestion({
    context,
    questionId: question.id,
    reason: "Cleared after verifying automatic hook question generation in smoke test."
  });
}

const engineeringExecutionHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "진행해 줘. LongTable hook checkpoint 중복을 고치고 글로벌 배포 버전까지 수정해줘."
}, workspaceTmp);
assertEqual(engineeringExecutionHook, null, "LongTable engineering execution prompt should not create researcher checkpoints");

const malformedSkillPromptHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "$longlongtable"
}, workspaceTmp);
assertEqual(malformedSkillPromptHook, null, "Malformed LongTable skill autocomplete text should not create researcher checkpoints");

const engineeringExplanationHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "현재 에이전트 시스템이 어떻게 돌아가는지 설명해줘"
}, workspaceTmp);
assertEqual(engineeringExplanationHook, null, "LongTable engineering explanation prompt should not create researcher checkpoints");

const engineeringSimulationHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "시뮬레이션 테스트로 왜 훅이 불필요하게 나오는지 확인해줘"
}, workspaceTmp);
assertEqual(engineeringSimulationHook, null, "LongTable engineering simulation prompt should not create researcher checkpoints");

const closureQuestionHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "Implement the plan."
}, workspaceTmp);
const closureQuestionContext = closureQuestionHook?.hookSpecificOutput?.additionalContext ?? "";
assert(closureQuestionContext.includes("Protected decision closure"), "Closure prompt should create a protected-decision checkpoint");
const closureQuestionState = JSON.parse(readFileSync(join(workspaceTmp, ".longtable", "state.json"), "utf8"));
const closureQuestions = (closureQuestionState.questionLog ?? []).filter((question) =>
  question.status === "pending" &&
  question.prompt.checkpointKey === "follow_up_protected_decision_closure"
);
assert(closureQuestions.length === 1, "Protected-decision closure should persist exactly one follow-up question");
for (const question of closureQuestions) {
  await clearWorkspaceQuestion({
    context,
    questionId: question.id,
    reason: "Cleared after verifying protected-decision closure question generation in smoke test."
  });
}

const created = await createWorkspaceQuestion({
  context,
  prompt: "We are about to finalize the measurement definition.",
  question: "Which calibration definition should stay open until the researcher answers?",
  questionOptions: [
    { value: "behavioral", label: "Behavioral reliance" },
    { value: "subjective", label: "Subjective trust" }
  ],
  displayReason: "A required measurement checkpoint should block closure.",
  required: true,
  provider: "codex"
});

const stopBlocked = await dispatchCodexHook({ hook_event_name: "Stop" }, workspaceTmp);
assertEqual(stopBlocked, null, "Stop hook should let Codex wait for the researcher when a required question is pending");

const promptWithPendingQuestion = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "Continue the research work."
}, workspaceTmp);
const pendingQuestionContext = promptWithPendingQuestion?.hookSpecificOutput?.additionalContext ?? "";
assert(pendingQuestionContext.includes("Required Researcher Checkpoint is still pending"), "UserPromptSubmit should surface pending required question context");
assert(pendingQuestionContext.includes("Do not choose or record an answer"), "Pending checkpoint context should preserve researcher choice");

await answerWorkspaceQuestion({
  context,
  questionId: created.question.id,
  answer: "behavioral",
  provider: "codex",
  surface: "numbered"
});

const stopAfterAnswer = await dispatchCodexHook({ hook_event_name: "Stop" }, workspaceTmp);
assertEqual(stopAfterAnswer, null, "Stop hook should clear after required question is answered");

const staleQuestion = await createWorkspaceQuestion({
  context,
  prompt: "Old planning question that should be cleared explicitly.",
  question: "Which stale planning branch should remain pending?",
  questionOptions: [
    { value: "old_a", label: "Old branch A" },
    { value: "old_b", label: "Old branch B" }
  ],
  displayReason: "Used to verify explicit clearing of stale pending questions.",
  required: true,
  provider: "codex"
});
const stopBeforeClear = await dispatchCodexHook({ hook_event_name: "Stop" }, workspaceTmp);
assertEqual(stopBeforeClear, null, "Stop hook should not force an auto-continue loop before clearing a stale required question");
await clearWorkspaceQuestion({
  context,
  questionId: staleQuestion.question.id,
  reason: "Superseded by a later LongTable state update during smoke test."
});
const stopAfterClear = await dispatchCodexHook({ hook_event_name: "Stop" }, workspaceTmp);
assertEqual(stopAfterClear, null, "Stop hook should clear after explicit stale-question cleanup");

const statePath = join(workspaceTmp, ".longtable", "state.json");
const state = JSON.parse(readFileSync(statePath, "utf8"));
const compactSessionStart = await dispatchCodexHook({ hook_event_name: "SessionStart" }, workspaceTmp);
const compactSessionContext = compactSessionStart?.hookSpecificOutput?.additionalContext ?? "";
assert(compactSessionContext.includes("research context restored"), "SessionStart should confirm restored LongTable context");
assert(!compactSessionContext.includes("Current blocker:"), "SessionStart should not dump full blocker text when nothing is pending");
assert(!compactSessionContext.includes("Protected decision: measurement"), "SessionStart should keep protected-decision details out of the compact startup summary");

state.hooks = [
  ...(state.hooks ?? []),
  {
    id: "hook_active_waiting_for_researcher",
    kind: "longtable_interview",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    targetOutcome: "first_research_handle",
    depth: "gathering_context",
    provider: "codex",
    turns: [],
    qualityNotes: [],
    rationale: []
  }
];
writeFileSync(statePath, JSON.stringify(state, null, 2));
const stopWithActiveInterview = await dispatchCodexHook({ hook_event_name: "Stop" }, workspaceTmp);
assertEqual(stopWithActiveInterview, null, "Stop hook should not auto-continue while an interview is waiting for researcher input");

state.questionObligations = [{
  id: "obligation_test",
  kind: "first_research_shape_confirmation",
  status: "pending",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  prompt: "What should stay explicitly open before LongTable moves forward?",
  reason: "The study still has a protected research judgment.",
  sourceHookId: "hook_test"
}];
writeFileSync(statePath, JSON.stringify(state, null, 2));

const sessionStart = await dispatchCodexHook({ hook_event_name: "SessionStart" }, workspaceTmp);
assert(sessionStart?.hookSpecificOutput?.additionalContext?.includes("Pending LongTable research obligation"), "SessionStart should surface pending obligation context");

console.log("codex hook smoke passed");
