import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");
const mcpServer = join(repoRoot, "packages", "longtable-mcp", "dist", "server.js");
const { classifyCheckpointTrigger } = await import(join(repoRoot, "packages", "longtable-checkpoints", "dist", "index.js"));
const {
  answerWorkspaceQuestion,
  appendLongTableInterviewTurn,
  beginLongTableInterview,
  createWorkspaceQuestion,
  loadProjectContextFromDirectory
} = await import(join(repoRoot, "packages", "longtable", "dist", "index.js"));
const { renderQuestionRecordPrompt } = await import(join(repoRoot, "packages", "longtable-provider-codex", "dist", "index.js"));
const { renderQuestionRecordInput } = await import(join(repoRoot, "packages", "longtable-provider-claude", "dist", "index.js"));

const mcpSelfTest = JSON.parse(execFileSync("node", [mcpServer, "--self-test"], {
  cwd: repoRoot,
  encoding: "utf8"
}));
for (const tool of [
  "create_workspace",
  "begin_interview",
  "append_interview_turn",
  "summarize_interview",
  "summarize_research_specification",
  "read_research_specification",
  "cancel_interview",
  "confirm_first_research_shape",
  "confirm_research_specification"
]) {
  if (!mcpSelfTest.tools.includes(tool)) {
    throw new Error(`MCP self-test is missing interview tool: ${tool}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label}: expected text to include ${expected}`);
  }
}

async function assertRejects(promiseFactory, expectedMessage, label) {
  try {
    await promiseFactory();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedMessage)) {
      throw new Error(`${label}: expected error containing "${expectedMessage}", received "${message}"`);
    }
    return;
  }
  throw new Error(`${label}: expected rejection`);
}

function assertThrowsSync(fn, expectedMessage, label) {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedMessage)) {
      throw new Error(`${label}: expected error containing "${expectedMessage}", received "${message}"`);
    }
    return error;
  }
  throw new Error(`${label}: expected throw`);
}

function classify(prompt, fallbackMode) {
  return classifyCheckpointTrigger(prompt, {
    fallbackMode,
    unresolvedTensions: ["research detail"]
  });
}

const exploration = classify(
  "I want to explore trust calibration but I am not sure whether the gap is theory, measurement, or study design. Please help me narrow it.",
  "explore"
);
assertEqual(exploration.signal.checkpointKey, "knowledge_gap_probe", "exploration checkpoint key");
assertEqual(exploration.requiresQuestionBeforeClosure, false, "exploration remains response-only until closure");

const panel = classify(
  "The panel disagrees about whether calibration should be treated as a cognitive mismatch or a relational trust issue. Synthesize and choose the best framing.",
  "review"
);
assertEqual(panel.signal.checkpointKey, "panel_disagreement_resolution", "panel checkpoint key");
assertEqual(panel.requiresQuestionBeforeClosure, true, "panel requires question");

const draft = classify(
  "Please polish this paragraph for clarity without changing the research claim.",
  "draft"
);
assertEqual(draft.signal.checkpointKey, "evidence_claim", "draft evidence key");
assertEqual(draft.advisoryOnly, true, "draft remains advisory");

const productPolicy = classify(
  "LongTable checkpoint policy와 hook UX를 문서화된 절차에 맞게 수정해줘.",
  "review"
);
assertEqual(productPolicy.signal.checkpointKey, "product_runtime_guidance", "product policy checkpoint key");
assertEqual(productPolicy.requiresQuestionBeforeClosure, false, "product policy work remains response-only");

const tmp = mkdtempSync(join(tmpdir(), "longtable-checkpoint-routing-"));
const setupPath = join(tmp, "setup.json");
const runtimePath = join(tmp, "runtime.toml");

function runCli(args) {
  return execFileSync("node", [cli, ...args], {
    cwd: tmp,
    encoding: "utf8"
  });
}

runCli([
  "setup",
  "--provider", "codex",
  "--install-scope", "none",
  "--surfaces", "cli_only",
  "--intervention", "balanced",
  "--workspace", "later",
  "--setup-path", setupPath,
  "--runtime-path", runtimePath,
  "--json"
]);

runCli([
  "start",
  "--setup", setupPath,
  "--path", tmp,
  "--name", "Checkpoint Routing Smoke",
  "--goal", "Test checkpoint routing",
  "--blocker", "research detail",
  "--research-object", "study_design",
  "--gap-risk", "known_gap",
  "--protected-decision", "method",
  "--perspectives", "auto",
  "--disagreement", "always_visible",
  "--no-interview",
  "--json"
]);

const created = JSON.parse(runCli([
  "question",
  "--cwd", tmp,
  "--provider", "codex",
  "--prompt", "The panel disagrees about framing. Synthesize and choose the best framing.",
  "--json"
]));

assertEqual(created.question.prompt.checkpointKey, "panel_disagreement_resolution", "created question checkpoint key");
assertEqual(created.question.prompt.preferredSurfaces[0], "tmux_popup", "codex preferred surface");
assertEqual(created.question.commitmentFamily, "method", "created question commitment family");

const context = await loadProjectContextFromDirectory(tmp);
if (!context) {
  throw new Error("Smoke workspace context was not created.");
}

const renderedExisting = JSON.parse(runCli([
  "question",
  "--cwd", tmp,
  "--provider", "codex",
  "--question", created.question.id,
  "--json"
]));
assertEqual(renderedExisting.question.id, created.question.id, "existing pending question can be rendered by id");
assertEqual(renderedExisting.question.prompt.preferredSurfaces[0], "tmux_popup", "existing question keeps tmux popup preference");

const renderedNumbered = runCli([
  "question",
  "--cwd", tmp,
  "--provider", "codex",
  "--question", created.question.id,
  "--surface", "numbered"
]);
assertIncludes(renderedNumbered, "LongTable Decision Card", "numbered fallback renders a decision card");
assertIncludes(renderedNumbered, "What is blocked:", "numbered fallback explains the blocker");
assertIncludes(renderedNumbered, "Record value: surface_disagreement", "numbered fallback shows durable answer values");
assertIncludes(renderedNumbered, "--surface numbered", "numbered fallback records the intended surface in the command hint");
assertEqual(renderedNumbered.includes("- options:"), false, "numbered fallback should not render slash-delimited raw options");

const decided = JSON.parse(runCli([
  "decide",
  "--cwd", tmp,
  "--question", created.question.id,
  "--answer", "surface_disagreement",
  "--provider", "codex",
  "--surface", "tmux_popup",
  "--json"
]));

assertEqual(decided.question.answer?.surface, "tmux_popup", "accepted tmux popup surface");
assertEqual(decided.question.transportStatus?.surface, "tmux_popup", "accepted transport surface");
assertEqual(decided.decision.commitmentFamily, "method", "decision copies commitment family");

const interview = await beginLongTableInterview({
  context,
  provider: "codex",
  openingQuestion: "What do you want to research?"
});
const firstTurn = await appendLongTableInterviewTurn({
  context,
  hookId: interview.hook.id,
  question: "What do you want to research?",
  answer: "I want to study whether organizational AI adoption depends on policy, leadership, infrastructure, and governance conditions.",
  reflection: "The project concerns organizational adoption conditions.",
  quality: "rich"
});
assertEqual(firstTurn.hook.depth, "forming_first_handle", "Interview should not become summary-ready from turn count alone");
assertEqual(firstTurn.hook.status, "active", "Interview should stay active until content readiness is explicit");
const readyTurn = await appendLongTableInterviewTurn({
  context,
  hookId: interview.hook.id,
  question: "What makes this hard to inspect first?",
  answer: "The hard part is whether higher education studies measure organization-level variables well enough to code factor families and outcomes.",
  reflection: "The blocker is empirical codability of organization-level factors.",
  quality: "rich",
  readyToSummarize: true,
  readinessRationale: [
    "research object is analysis planning",
    "focal uncertainty and next inspection target are explicit"
  ]
});
assertEqual(readyTurn.hook.depth, "ready_to_summarize", "Explicit content readiness should mark the interview ready to summarize");
assertEqual(readyTurn.hook.status, "ready_to_confirm", "Explicit content readiness should move the interview to confirmation status");

const overridden = await createWorkspaceQuestion({
  context,
  prompt: "Theory and construct words should not override the explicit checkpoint.",
  checkpointKey: "explore_runtime_guidance",
  question: "Which uncertainty should LongTable resolve first?",
  questionOptions: [
    { value: "surface_tensions", label: "Surface tensions first" },
    { value: "gather_context", label: "Gather context first" }
  ],
  displayReason: "The UI should ask the concrete decision instead of exposing internal trigger rationale.",
  required: false,
  provider: "codex",
  commitmentFamily: "construct",
  epistemicBasis: "project_state"
});
assertEqual(overridden.question.prompt.checkpointKey, "explore_runtime_guidance", "explicit checkpoint override");
assertEqual(overridden.question.prompt.options[0]?.value, "surface_tensions", "explicit option override");
assertEqual(overridden.question.commitmentFamily, "construct", "explicit commitment family override");
assertEqual(overridden.question.epistemicBasis, "project_state", "explicit epistemic basis override");
const rendered = renderQuestionRecordPrompt(overridden.question).prompt;
if (rendered.includes("Why now:")) {
  throw new Error("Codex question fallback should not render repeated Why now lines.");
}
if (!rendered.includes("Decision context: The UI should ask the concrete decision")) {
  throw new Error("Codex question fallback should render the display reason.");
}
const overriddenDecision = await answerWorkspaceQuestion({
  context,
  questionId: overridden.question.id,
  answer: "surface_tensions",
  provider: "codex",
  surface: "numbered"
});
assertEqual(overriddenDecision.decision.commitmentFamily, "construct", "decision copies explicit commitment family");
assertEqual(overriddenDecision.decision.epistemicBasis, "project_state", "decision copies explicit epistemic basis");

const multi = await createWorkspaceQuestion({
  context,
  prompt: "The inclusion rule may need multiple constraints recorded together.",
  checkpointKey: "multi_choice_transport",
  question: "Which inclusion constraints should be recorded together?",
  type: "multi_choice",
  questionOptions: [
    { value: "analysis_unit", label: "Organization-level analysis unit" },
    { value: "measurement_content", label: "Organization-level measurement content" },
    { value: "author_framing", label: "Author frames it as organizational adoption" }
  ],
  displayReason: "Multiple screening constraints can be true at the same time.",
  required: true,
  provider: "codex",
  commitmentFamily: "scope",
  epistemicBasis: "project_state"
});
assertEqual(multi.question.prompt.type, "multi_choice", "multi-choice question type");
const multiCodex = renderQuestionRecordPrompt(multi.question);
assertEqual(multiCodex.spec.selectionMode, "multi", "Codex fallback selection mode");
if (!multiCodex.prompt.includes("one or more numbers separated by commas")) {
  throw new Error("Codex fallback should tell the researcher how to answer multi-choice checkpoints.");
}
const multiClaude = renderQuestionRecordInput(multi.question);
assertEqual(multiClaude.askUserQuestionInput.questions[0]?.multiSelect, true, "Claude AskUserQuestion multiSelect follows prompt type");
const multiDecision = await answerWorkspaceQuestion({
  context,
  questionId: multi.question.id,
  answer: "1, 2\nBoth constraints are required for screening consistency.",
  provider: "codex",
  surface: "numbered"
});
assertEqual(multiDecision.question.answer?.selectedValues.length, 2, "multi-choice selected value count");
assertEqual(multiDecision.question.answer?.selectedValues.join(","), "analysis_unit,measurement_content", "multi-choice selected values");
assertEqual(multiDecision.decision.selectedOption, "analysis_unit", "legacy selectedOption keeps first multi-choice value");
assertEqual(multiDecision.decision.selectedOptions?.join(","), "analysis_unit,measurement_content", "DecisionRecord preserves all multi-choice values");

const multiOther = await createWorkspaceQuestion({
  context,
  prompt: "The access plan may need a known option and a researcher-supplied constraint.",
  checkpointKey: "multi_choice_other_transport",
  question: "Which access constraints should be tracked?",
  type: "multi_choice",
  questionOptions: [
    { value: "publisher_access", label: "Publisher access" },
    { value: "api_key", label: "API key" }
  ],
  allowOther: true,
  otherLabel: "Other access constraint",
  displayReason: "Other should remain visible and auditable.",
  required: true,
  provider: "codex",
  commitmentFamily: "evidence",
  epistemicBasis: "researcher_knowledge"
});
const otherDecision = await answerWorkspaceQuestion({
  context,
  questionId: multiOther.question.id,
  answer: {
    selectedValues: ["publisher_access", "other"],
    otherText: "institutional SSO session",
    rationale: "This is a researcher-supplied access constraint."
  },
  provider: "codex",
  surface: "numbered"
});
assertEqual(otherDecision.question.answer?.selectedValues.join(","), "publisher_access,institutional SSO session", "Other text is preserved as a selected value");
assertEqual(otherDecision.question.answer?.otherText, "institutional SSO session", "Other text audit field");
assertEqual(otherDecision.question.answer?.selectedLabels.join(","), "Publisher access,Other access constraint", "Other label remains visible");

const invalidOther = await createWorkspaceQuestion({
  context,
  prompt: "Other text should not be attached to a concrete option unless Other is selected.",
  checkpointKey: "multi_choice_invalid_other_transport",
  question: "Which access constraints should be tracked?",
  type: "multi_choice",
  questionOptions: [
    { value: "publisher_access", label: "Publisher access" },
    { value: "api_key", label: "API key" }
  ],
  allowOther: true,
  otherLabel: "Other access constraint",
  required: true,
  provider: "codex"
});
await assertRejects(
  () => answerWorkspaceQuestion({
    context,
    questionId: invalidOther.question.id,
    answer: {
      selectedValues: ["publisher_access"],
      otherText: "institutional SSO session"
    },
    provider: "codex",
    surface: "numbered"
  }),
  "Other text requires selecting",
  "Other text without selecting Other is rejected"
);

const freeText = await createWorkspaceQuestion({
  context,
  prompt: "The researcher needs to record a short free-text screening note.",
  checkpointKey: "free_text_transport",
  question: "What screening note should be preserved?",
  type: "free_text",
  questionOptions: [],
  displayReason: "Free-text checkpoints should not masquerade as option selections.",
  required: false,
  provider: "codex",
  commitmentFamily: "coding",
  epistemicBasis: "researcher_knowledge"
});
assertEqual(freeText.question.prompt.allowOther, false, "free-text questions do not default to Other choices");
const freeTextClaude = renderQuestionRecordInput(freeText.question);
assertEqual(freeTextClaude.nativeStructured, false, "Claude free-text uses fallback transport");
assertEqual(freeTextClaude.askUserQuestionInput, undefined, "Claude free-text does not emit choice payload");
assertEqual(freeTextClaude.structuredPrompt.choices.length, 0, "Claude free-text structured prompt has no choices");
if (!freeTextClaude.fallbackPrompt?.includes("Reply with a concise free-text answer.")) {
  throw new Error("Claude free-text fallback should tell the researcher how to answer.");
}
const freeTextDecision = await answerWorkspaceQuestion({
  context,
  questionId: freeText.question.id,
  answer: "Pilot screening should flag mixed individual/organization measurement.",
  provider: "codex",
  surface: "numbered"
});
assertEqual(freeTextDecision.question.answer?.selectedValues[0], "Pilot screening should flag mixed individual/organization measurement.", "free-text selected value");
assertEqual(freeTextDecision.question.answer?.otherText, "Pilot screening should flag mixed individual/organization measurement.", "free-text otherText audit field");

const disabledTeamTmp = mkdtempSync(join(tmpdir(), "longtable-disabled-team-"));
const disabledTeamError = assertThrowsSync(
  () => execFileSync("node", [
    cli,
    "team",
    "--cwd", disabledTeamTmp,
    "--prompt", "Review this measurement plan as an agent team.",
    "--role", "editor,measurement_auditor",
    "--json"
  ], {
    cwd: tmpdir(),
    encoding: "utf8",
    stdio: "pipe"
  }),
  "Unknown command: team",
  "direct longtable team command is removed"
);
assertEqual(disabledTeamError.status, 1, "direct longtable team exit code");
assertEqual(disabledTeamError.stdout, "", "direct longtable team stdout");
assertEqual(existsSync(join(disabledTeamTmp, ".longtable", "team")), false, "removed longtable team creates no team artifacts");

const disabledTeamDebateTmp = mkdtempSync(join(tmpdir(), "longtable-disabled-team-debate-"));
const disabledTeamDebateError = assertThrowsSync(
  () => execFileSync("node", [
    cli,
    "team",
    "--cwd", disabledTeamDebateTmp,
    "--prompt", "Debate this measurement plan before I commit.",
    "--role", "editor,measurement_auditor",
    "--debate",
    "--json"
  ], {
    cwd: tmpdir(),
    encoding: "utf8",
    stdio: "pipe"
  }),
  "Unknown command: team",
  "direct longtable team debate command is removed"
);
assertEqual(disabledTeamDebateError.status, 1, "direct longtable team debate exit code");
assertEqual(disabledTeamDebateError.stdout, "", "direct longtable team debate stdout");
assertEqual(existsSync(join(disabledTeamDebateTmp, ".longtable", "team")), false, "removed longtable team debate creates no team artifacts");

const naturalTeamTmp = mkdtempSync(join(tmpdir(), "longtable-natural-team-"));
const naturalTeam = JSON.parse(execFileSync("node", [
  cli,
  "ask",
  "--cwd", naturalTeamTmp,
  "--prompt", "lt team: Review this measurement plan before I commit it.",
  "--json"
], {
  cwd: tmpdir(),
  encoding: "utf8"
}));
assertEqual(naturalTeam.result.interactionDepth, "independent", "natural team routes to panel interaction depth");
assertEqual(naturalTeam.execution.stableSurface, "sequential_fallback", "natural team uses panel surface");

const naturalDebateTmp = mkdtempSync(join(tmpdir(), "longtable-natural-debate-"));
const naturalDebate = JSON.parse(execFileSync("node", [
  cli,
  "ask",
  "--cwd", naturalDebateTmp,
  "--prompt", "lt debate: Review this measurement plan before I commit it.",
  "--json"
], {
  cwd: tmpdir(),
  encoding: "utf8"
}));
assertEqual(naturalDebate.run.interactionDepth, "debated", "natural debate preserves panel debate route");
assertIncludes(naturalDebate.questionRecord.prompt.question, "measurement or coding decision", "natural debate question names measurement focus");
assertIncludes(JSON.stringify(naturalDebate.questionRecord.prompt.options), "Revise measurement/coding plan", "natural debate revise option names measurement target");
assertEqual(naturalDebate.questionRecord.prompt.options.length, 3, "natural debate shows compact primary choices");
assertEqual(naturalDebate.questionRecord.prompt.options[0]?.recommended, true, "natural debate marks recommended choice");
assertEqual(existsSync(join(naturalDebateTmp, ".longtable", "team")), false, "natural debate creates no team artifacts");
assertEqual(existsSync(join(naturalDebateTmp, ".longtable", "panel")), true, "natural debate creates panel artifacts");

const naturalTeamDebateTmp = mkdtempSync(join(tmpdir(), "longtable-natural-team-debate-"));
const naturalTeamDebate = JSON.parse(execFileSync("node", [
  cli,
  "ask",
  "--cwd", naturalTeamDebateTmp,
  "--prompt", "Use a team debate to argue both sides before I commit this measurement plan.",
  "--json"
], {
  cwd: tmpdir(),
  encoding: "utf8"
}));
assertEqual(naturalTeamDebate.run.interactionDepth, "debated", "natural team debate preserves debate route");
assertEqual(existsSync(join(naturalTeamDebateTmp, ".longtable", "team")), false, "natural team debate creates no team artifacts");
assertEqual(existsSync(join(naturalTeamDebateTmp, ".longtable", "panel")), true, "natural team debate creates panel artifacts");

const stakesRoute = JSON.parse(execFileSync("node", [
  cli,
  "ask",
  "--cwd", mkdtempSync(join(tmpdir(), "longtable-stakes-route-")),
  "--prompt", "Use multiple perspectives to review this submission plan. The editor and reviewer disagree about the public framing.",
  "--json"
], {
  cwd: tmpdir(),
  encoding: "utf8"
}));
assertEqual(stakesRoute.result.interactionDepth, "independent", "external-facing disagreement routes to panel");
assertEqual(stakesRoute.execution.stableSurface, "sequential_fallback", "external-facing disagreement uses panel surface");

console.log("checkpoint routing smoke passed");
