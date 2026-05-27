import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const { dispatchCodexHook } = await import(join(repoRoot, "packages", "longtable", "dist", "longtable-codex-native-hook.js"));
const {
  answerWorkspaceQuestion,
  buildManagedCodexHookTrustState,
  codexHooksEnabled,
  clearWorkspaceQuestion,
  createWorkspaceQuestion,
  collectHardStopBlockers,
  getMissingManagedCodexHookTrustState,
  loadProjectContextFromDirectory,
  mergeCodexHookTrustState,
  mergeManagedCodexHooksConfig,
  removeCodexHookTrustState,
  pruneWorkspaceQuestions
} = await import(join(repoRoot, "packages", "longtable", "dist", "index.js"));
const {
  buildFirstResearchShapeQuestion,
  buildResearchSpecificationQuestion,
  researchSpecificationAnswerNeedsFollowUp
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
assertEqual(installResult.managedEvents.length, 7, "managed hook event count");
assertEqual(installResult.managedTrustEntries, 7, "managed hook trust entry count");
const writtenConfig = readFileSync(codexConfigPath, "utf8");
assert(/\[features\]/.test(writtenConfig) && /\bhooks\s*=\s*true/.test(writtenConfig), "config should enable hooks feature");
assert(codexHooksEnabled("[features]\nhooks = true\n"), "current hooks feature flag should be recognized");
assert(codexHooksEnabled("[features]\ncodex_hooks = true\n"), "legacy codex_hooks feature flag should be recognized");
const mergedHooks = JSON.parse(readFileSync(hooksPath, "utf8"));
assert(mergedHooks.hooks.Stop.some((entry) => entry.matcher === "custom"), "existing user hook should be preserved");
assert(mergedHooks.hooks.SessionStart.length > 0, "managed SessionStart hook should exist");
assert(mergedHooks.hooks.PreCompact.length > 0, "managed PreCompact hook should exist");
assert(mergedHooks.hooks.PostCompact.length > 0, "managed PostCompact hook should exist");
const managedPostToolUseHook = mergedHooks.hooks.PostToolUse
  .flatMap((entry) => entry.hooks ?? [])
  .find((hook) => String(hook.command ?? "").includes("longtable-codex-native-hook.js"));
assert(managedPostToolUseHook && !("statusMessage" in managedPostToolUseHook), "managed PostToolUse hook should stay quiet for no-op Bash");
const hooksContent = readFileSync(hooksPath, "utf8");
const trustState = buildManagedCodexHookTrustState(hooksPath, hooksContent);
assertEqual(Object.keys(trustState).length, 7, "managed trust state should cover every managed hook event");
assertEqual(getMissingManagedCodexHookTrustState(writtenConfig, hooksPath, hooksContent).length, 0, "installed config should include current managed hook trust state");
const rebuiltTrustConfig = mergeCodexHookTrustState("[features]\nhooks = true\n", hooksPath, hooksContent);
assertEqual(getMissingManagedCodexHookTrustState(rebuiltTrustConfig, hooksPath, hooksContent).length, 0, "trust merge helper should produce complete trust state");
const removedTrustConfig = removeCodexHookTrustState(rebuiltTrustConfig, hooksPath, hooksContent);
assertEqual(getMissingManagedCodexHookTrustState(removedTrustConfig, hooksPath, hooksContent).length, 7, "trust removal helper should remove managed trust state");

const mergedPreview = JSON.parse(mergeManagedCodexHooksConfig(readFileSync(hooksPath, "utf8"), join(repoRoot, "packages", "longtable")));
assert(mergedPreview.hooks.UserPromptSubmit.length > 0, "hook merge helper should preserve managed UserPromptSubmit");
assert(mergedPreview.hooks.PreCompact.length > 0, "hook merge helper should preserve managed PreCompact");
const managedPostToolHook = mergedPreview.hooks.PostToolUse.find((entry) => entry.hooks?.some((hook) => /longtable-codex-native-hook/.test(hook.command ?? "")));
assert(managedPostToolHook, "managed PostToolUse hook should exist");
assert(!managedPostToolHook.hooks.some((hook) => Object.prototype.hasOwnProperty.call(hook, "statusMessage")), "managed PostToolUse hook should be quiet by default");

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

const koreanShapeQuestion = buildFirstResearchShapeQuestion({
  handle: "조직 AI adoption factors",
  currentGoal: "고등교육 조직 단위 AI adoption factor 모델을 만든다.",
  currentBlocker: "조직 단위 factor가 실제 문헌에서 충분히 코딩 가능한지 모른다.",
  openQuestions: ["조직 단위 효과크기가 충분한가?"],
  nextAction: "조직 단위 연구 20-30편을 pilot screening한다.",
  confidence: "medium",
  sourceHookId: "hook_korean"
});
assertEqual(koreanShapeQuestion.title, "First Research Shape 확인", "Korean shape question should use a Korean confirmation title");
assertEqual(koreanShapeQuestion.question, "이 First Research Shape를 어떻게 처리할까요?", "Korean shape question should use a Korean confirmation question");
assert(koreanShapeQuestion.options.some((option) => option.value === "stabilize_shape" && option.label === "저장/확정"), "Korean shape question should show save/confirm option");
assert(koreanShapeQuestion.options.some((option) => option.value === "gather_context" && option.label === "한 질문 더"), "Korean shape question should show one-more-question option");
assert(koreanShapeQuestion.options.some((option) => option.value === "revise_shape" && option.label === "수정"), "Korean shape question should show revise option");
assert(koreanShapeQuestion.options.some((option) => option.value === "keep_open" && option.label === "열어두기"), "Korean shape question should show keep-open option");

const researchSpecificationQuestion = buildResearchSpecificationQuestion({
  title: "SME GenAI adoption specification",
  researchDirection: {
    purpose: "Explain organizational GenAI adoption in SMEs through capacity and constraint conditions.",
    scopeBoundary: "SME organization-level adoption studies."
  },
  constructOntology: {
    coreConstructs: ["organizational capacity", "implementation constraints"],
    distinctions: ["intention versus actual use"]
  },
  theoryAndFraming: {
    anchors: ["TOE", "JD-R as a demand/resource lens"]
  },
  measurementCoding: {
    variablesOrConstructs: ["leadership support", "resource readiness"],
    evidenceTypes: ["correlation", "SEM path"],
    codingRules: ["Code directionality separately from construct family."]
  },
  methodAnalysis: {
    analysisOptions: ["random-effects meta-analysis", "MASEM if correlation matrices are sufficient"]
  },
  evidenceAccess: {
    requiredSources: ["primary quantitative studies"]
  },
  epistemicAlignment: {
    conflictResolutionRule: "Ask the researcher when project state, AI inference, and researcher knowledge conflict."
  },
  protectedDecisions: ["sector/domain boundary"],
  openQuestions: ["Are SME studies sufficient for quantitative synthesis?"],
  nextActions: ["Run pilot extraction."],
  confidence: "medium"
});
assertEqual(researchSpecificationQuestion.title, "Research Specification Confirmation", "Research Specification question should use explicit confirmation title");
assertEqual(researchSpecificationQuestion.question, "How should LongTable handle this Research Specification?", "Research Specification question should use explicit confirmation question");
assert(researchSpecificationQuestion.prompt.includes("Research Specification Preview"), "Research Specification question should include the preview in the prompt");
assert(researchSpecificationQuestion.displayReason.includes("Research Specification Preview"), "Research Specification question should include a compact UI preview");
assert(researchSpecificationQuestion.displayReason.length < researchSpecificationQuestion.prompt.length, "Research Specification UI context should be shorter than the full preview");
assert(!researchSpecificationQuestion.displayReason.includes("Coding rules: Code directionality"), "Research Specification UI context should not duplicate every full-preview field");
assert(researchSpecificationQuestion.options.some((option) => option.value === "confirm_specification"), "Research Specification question should offer confirmation");
assert(researchSpecificationQuestion.options.some((option) => option.value === "revise_section"), "Research Specification question should allow section-level revision");
assert(researchSpecificationAnswerNeedsFollowUp("ask_one_more"), "Research Specification ask_one_more should require returning to preview");
assert(researchSpecificationAnswerNeedsFollowUp("revise_section"), "Research Specification revise_section should require returning to preview");
assert(!researchSpecificationAnswerNeedsFollowUp("keep_open"), "Research Specification keep_open should not create a preview-return obligation");

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

const advisoryQuestionHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "Trust calibration에서 subjective trust와 reliance, switch to AI를 같은 측정으로 봐도 되는지 검토해줘."
}, workspaceTmp);
assertEqual(advisoryQuestionHook, null, "Research review prompts should not dump response-only advisory questions through hook context");
const advisoryQuestionState = JSON.parse(readFileSync(join(workspaceTmp, ".longtable", "state.json"), "utf8"));
const advisoryGeneratedQuestions = (advisoryQuestionState.questionLog ?? []).filter((question) =>
  question.status === "pending" &&
  question.prompt.checkpointKey?.startsWith("follow_up_")
);
assertEqual(advisoryGeneratedQuestions.length, 0, "Response-only advisory questions should remain out of QuestionRecord state");

const productHarnessComplaintHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "이 연구에 대한 대화는 종료하고, Longtable 수정을 위한 작업을 시작하자. 필요한 질문을 모두 해줘. 의미 없는 hook과 질문 하네싱을 고쳐줘."
}, workspaceTmp);
assertEqual(productHarnessComplaintHook, null, "LongTable product harness prompts should stay quiet even when they mention needed questions");

const autoQuestionHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "이 측정 모델을 원고에 반영하기 전에 주관적 신뢰와 행동 의존을 분리하기 위해 필요한 질문을 생성해줘."
}, workspaceTmp);
const autoQuestionContext = autoQuestionHook?.hookSpecificOutput?.additionalContext ?? "";
assert(autoQuestionContext.includes("LongTable created"), "UserPromptSubmit should create required checkpoint questions for high-signal research commitment prompts");
assert(autoQuestionContext.includes("Construct boundary"), "Generated hook context should include the required construct-boundary prompt");
assert(!autoQuestionContext.includes("Question policy"), "Advisory question-policy prompts should not be promoted into required checkpoints");
const autoQuestionState = JSON.parse(readFileSync(join(workspaceTmp, ".longtable", "state.json"), "utf8"));
const generatedQuestions = (autoQuestionState.questionLog ?? []).filter((question) =>
  question.status === "pending" &&
  question.prompt.checkpointKey?.startsWith("follow_up_")
);
assert(generatedQuestions.length >= 1, "High-signal hook prompt should persist follow-up questions");
for (const question of generatedQuestions) {
  await clearWorkspaceQuestion({
    context,
    questionId: question.id,
    reason: "Cleared after verifying automatic hook question generation in smoke test."
  });
}

const directionChangeHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "연구 질문의 범위와 이론 프레임, 분석 방법을 변경해서 원고에 반영해줘."
}, workspaceTmp);
const directionChangeContext = directionChangeHook?.hookSpecificOutput?.additionalContext ?? "";
assert(directionChangeContext.includes("Research direction change"), "Multi-commitment research changes should create one high-priority direction-change checkpoint");
assert(!directionChangeContext.includes("response-only advisory"), "Required checkpoint hook output should not include advisory harness wording");
const directionChangeState = JSON.parse(readFileSync(join(workspaceTmp, ".longtable", "state.json"), "utf8"));
const directionChangeQuestions = (directionChangeState.questionLog ?? []).filter((question) =>
  question.status === "pending" &&
  question.prompt.checkpointKey === "follow_up_research_direction_change_commitment"
);
assertEqual(directionChangeQuestions.length, 1, "Multi-commitment research changes should collapse into one grouped checkpoint");
for (const question of directionChangeQuestions) {
  await clearWorkspaceQuestion({
    context,
    questionId: question.id,
    reason: "Cleared after verifying multi-commitment research change checkpoint generation in smoke test."
  });
}

const accessPolicyHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "메타분석 논문들의 PDF와 full text를 수집해서 원문 기반으로 코딩해줘."
}, workspaceTmp);
const accessPolicyContext = accessPolicyHook?.hookSpecificOutput?.additionalContext ?? "";
assert(accessPolicyContext.includes("Scholarly access policy"), "PDF/full-text collection should create an access policy checkpoint");
const accessPolicyState = JSON.parse(readFileSync(join(workspaceTmp, ".longtable", "state.json"), "utf8"));
const accessPolicyQuestions = (accessPolicyState.questionLog ?? []).filter((question) =>
  question.status === "pending" &&
  question.prompt.checkpointKey === "follow_up_scholarly_access_policy"
);
assertEqual(accessPolicyQuestions.length, 1, "Access-sensitive corpus work should persist exactly one access checkpoint");
for (const question of accessPolicyQuestions) {
  await clearWorkspaceQuestion({
    context,
    questionId: question.id,
    reason: "Cleared after verifying scholarly access policy checkpoint generation in smoke test."
  });
}

const falsePositiveQuestion = await createWorkspaceQuestion({
  context,
  prompt: "False-positive hook record created for prune smoke coverage.",
  question: "Should this false-positive checkpoint be pruned?",
  questionOptions: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" }
  ],
  displayReason: "Prune smoke coverage.",
  required: true,
  provider: "codex"
});
await clearWorkspaceQuestion({
  context,
  questionId: falsePositiveQuestion.question.id,
  reason: "False-positive hook record created for prune smoke coverage."
});
const prunePreview = await pruneWorkspaceQuestions({ context, dryRun: true });
assert(prunePreview.removedQuestions.some((question) => question.id === falsePositiveQuestion.question.id), "Prune preview should find false-positive cleared questions");
const pruneResult = await pruneWorkspaceQuestions({ context });
assert(pruneResult.removedQuestions.some((question) => question.id === falsePositiveQuestion.question.id), "Prune should remove false-positive cleared questions");

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

const productUxHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "$longtable skill이 13개 노출되면 사용자가 혼란스러울 수 있으니 compact surface를 제안해줘."
}, workspaceTmp);
assertEqual(productUxHook, null, "LongTable product and UX prompts should not create researcher checkpoints");

const documentedProcedureHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "문서화된 절차에 따라 모든 작업을 진행해 줘."
}, workspaceTmp);
assertEqual(documentedProcedureHook, null, "Documented product implementation prompts should not create researcher checkpoints");

const closureQuestionHook = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "이 연구 방향을 최종 확정해줘."
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
  hardStop: true,
  hardStopScope: "construct",
  provider: "codex"
});

const stopBlocked = await dispatchCodexHook({ hook_event_name: "Stop" }, workspaceTmp);
assertEqual(stopBlocked?.decision, "block", "Stop hook should block when a hard-stop question is pending");
assert(stopBlocked?.reason?.includes(created.question.id), "Stop block reason should include blocker id");
assert(stopBlocked?.reason?.includes("construct"), "Stop block reason should include affected hard-stop scope");
assert(stopBlocked?.reason?.includes("longtable decide"), "Stop block reason should include an actionable next command");

const quietNoopPostToolUse = await dispatchCodexHook({
  hook_event_name: "PostToolUse",
  tool_name: "Bash",
  command: "echo ok",
  exit_code: 0,
  stdout: "ok"
}, workspaceTmp);
assertEqual(quietNoopPostToolUse, null, "Successful no-op Bash should keep PostToolUse quiet");

const unrelatedNonzeroPostToolUse = await dispatchCodexHook({
  hook_event_name: "PostToolUse",
  tool_name: "Bash",
  command: "false",
  exit_code: 1,
  stderr: "simulated unrelated failure"
}, workspaceTmp);
assertEqual(unrelatedNonzeroPostToolUse, null, "Unrelated nonzero Bash should not hard-block PostToolUse");

const stateMutationPostToolUse = await dispatchCodexHook({
  hook_event_name: "PostToolUse",
  tool_name: "Bash",
  command: "touch .longtable/manual-state-update",
  exit_code: 0
}, workspaceTmp);
assertEqual(stateMutationPostToolUse?.hookSpecificOutput?.permissionDecision, "deny", "Research-state Bash mutation should be denied while a hard-stop is pending");

const doctorWithHardStop = JSON.parse(runCli([
  "doctor",
  "--cwd", workspaceTmp,
  "--codex-config", codexConfigPath,
  "--hooks-path", hooksPath,
  "--json"
], workspaceTmp));
assertEqual(doctorWithHardStop.workspace.hardStop.stopWouldBlock, true, "doctor --json should report Stop would block");
assert(doctorWithHardStop.workspace.hardStop.activeBlockers.some((blocker) => blocker.id === created.question.id), "doctor --json should include active hard-stop blockers");
assert(doctorWithHardStop.workspace.hardStop.stalePendingQuestionCount >= 0, "doctor --json should include stale pending question count");

const codexHookDoctor = JSON.parse(runCli([
  "codex",
  "hook-doctor",
  "--cwd", workspaceTmp,
  "--codex-config", codexConfigPath,
  "--hooks-path", hooksPath,
  "--json"
], workspaceTmp));
assertEqual(codexHookDoctor.workspaceHardStop.stopWouldBlock, true, "codex hook-doctor --json should report Stop would block");

const quietPromptWithPendingQuestion = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "Continue the research work."
}, workspaceTmp);
assertEqual(quietPromptWithPendingQuestion, null, "UserPromptSubmit should not resurface pending checkpoints on ordinary continuation prompts");

const productPromptWithPendingQuestion = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "LongTable interview hook UX를 조용하게 개선해줘."
}, workspaceTmp);
assertEqual(productPromptWithPendingQuestion, null, "LongTable product prompts should not be blocked by unrelated research checkpoints");

const closurePromptWithPendingQuestion = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "Finalize and record the measurement definition for this study."
}, workspaceTmp);
const pendingQuestionContext = closurePromptWithPendingQuestion?.hookSpecificOutput?.additionalContext ?? "";
assert(pendingQuestionContext.includes("Required Researcher Checkpoint is still pending"), "Research closure prompts should surface pending required question context");
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
  hardStop: false,
  provider: "codex"
});
const stopBeforeClear = await dispatchCodexHook({ hook_event_name: "Stop" }, workspaceTmp);
assertEqual(stopBeforeClear, null, "Stop hook should not block stale non-hard-stop required questions");
hardStopState = JSON.parse(readFileSync(join(workspaceTmp, ".longtable", "state.json"), "utf8"));
hardStopVerdict = collectHardStopBlockers(hardStopState);
assertEqual(hardStopVerdict.stopWouldBlock, false, "Hard-stop verdict should ignore explicit non-hard-stop stale question");
assert(hardStopVerdict.stalePendingQuestionCount >= 1, "Hard-stop verdict should count stale/unrelated pending questions");
await clearWorkspaceQuestion({
  context,
  questionId: staleQuestion.question.id,
  reason: "Superseded by a later LongTable state update during smoke test."
});
const stopAfterClear = await dispatchCodexHook({ hook_event_name: "Stop" }, workspaceTmp);
assertEqual(stopAfterClear, null, "Stop hook should clear after explicit stale-question cleanup");

const doctorStatus = JSON.parse(runCli([
  "doctor",
  "--cwd", workspaceTmp,
  "--codex-config", codexConfigPath,
  "--hooks-path", hooksPath,
  "--json"
], workspaceTmp));
assertEqual(doctorStatus.providers.codex.stopWouldBlock, false, "doctor --json should report clear Stop hard-stop state");
assert(Array.isArray(doctorStatus.providers.codex.activeBlockers), "doctor --json should expose activeBlockers");
assert(doctorStatus.providers.codex.stalePendingQuestionCount >= 0, "doctor --json should expose stale pending question count");

const codexStatus = JSON.parse(runCli([
  "codex",
  "status",
  "--cwd", workspaceTmp,
  "--codex-config", codexConfigPath,
  "--hooks-path", hooksPath,
  "--json"
], workspaceTmp));
assertEqual(codexStatus.stopWouldBlock, false, "codex status --json should report clear Stop hard-stop state");
assert(Array.isArray(codexStatus.activeBlockers), "codex status --json should expose activeBlockers");

const statePath = join(workspaceTmp, ".longtable", "state.json");
const state = JSON.parse(readFileSync(statePath, "utf8"));
const compactSessionStart = await dispatchCodexHook({ hook_event_name: "SessionStart" }, workspaceTmp);
const compactSessionContext = compactSessionStart?.hookSpecificOutput?.additionalContext ?? "";
assert(compactSessionContext.includes("research context restored"), "SessionStart should confirm restored LongTable context");
assert(!compactSessionContext.includes("Current blocker:"), "SessionStart should not dump full blocker text when nothing is pending");
assert(!compactSessionContext.includes("Protected decision: measurement"), "SessionStart should keep protected-decision details out of the compact startup summary");
const preCompactQuiet = await dispatchCodexHook({ hook_event_name: "PreCompact" }, workspaceTmp);
assertEqual(preCompactQuiet, null, "PreCompact should stay quiet when there is no state to surface");
const postCompactQuiet = await dispatchCodexHook({ hook_event_name: "PostCompact" }, workspaceTmp);
assertEqual(postCompactQuiet, null, "PostCompact should stay quiet when there is no state to surface");

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
const postCompactWithActiveInterview = await dispatchCodexHook({ hook_event_name: "PostCompact" }, workspaceTmp);
assert(postCompactWithActiveInterview?.hookSpecificOutput?.additionalContext?.includes("A LongTable interview is currently active"), "PostCompact should restore active interview context after compaction");

const ordinaryPromptWithActiveInterview = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "Continue with the next source check."
}, workspaceTmp);
assertEqual(ordinaryPromptWithActiveInterview, null, "Active interview context should stay quiet on ordinary prompts");

const explicitPromptWithActiveInterview = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "$longtable-interview"
}, workspaceTmp);
assert(explicitPromptWithActiveInterview?.hookSpecificOutput?.additionalContext?.includes("A LongTable interview is currently active"), "Explicit interview prompts should surface active interview context");

const explicitStartPromptWithActiveInterview = await dispatchCodexHook({
  hook_event_name: "UserPromptSubmit",
  prompt: "$longtable-start"
}, workspaceTmp);
assert(explicitStartPromptWithActiveInterview?.hookSpecificOutput?.additionalContext?.includes("A LongTable interview is currently active"), "Explicit start prompts should surface active interview context");

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
assert(sessionStart?.hookSpecificOutput?.additionalContext?.includes("Separate unresolved LongTable obligation"), "SessionStart should surface separate pending obligation context with an active interview");

console.log("codex hook smoke passed");
