#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import type { Interface as ReadlineInterface } from "node:readline/promises";
import { createRequire } from "node:module";
import { stdin as input, stdout as output, cwd, env, exit } from "node:process";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import type {
  InteractionMode,
  PanelVisibility,
  ProviderKind,
  QuestionAuditResult,
  QuestionOpportunityKind,
  QuestionRecord,
  ResearchStage,
  RoleAuditEntry,
  RoleAuditResult
} from "@longtable/core";
import { classifyCheckpointTrigger } from "@longtable/checkpoints";
import {
  assessSearchSourceCapabilities,
  buildResearchSearchIntent,
  buildSearchCapabilitySnapshot,
  parsePublisherTarget,
  probePublisherAccess,
  publisherConfigs,
  runResearchSearch,
  searchCapabilitySnapshotPath,
  summarizeConfiguredPublisherAccess,
  type EvidenceRun,
  type PublisherAccessRecord,
  type SearchSourceCapability
} from "./search/index.js";
import {
  buildProviderChoices,
  buildQuickSetupFlow,
  createPersistedSetupOutput,
  installRuntimeConfigFromStoredSetup,
  loadSetupOutput,
  renderInstallSummary,
  renderSetupSummary,
  resolveDefaultRuntimeConfigPath,
  resolveDefaultSetupPath,
  saveSetupOutput,
  saveSetupAndRuntimeConfig,
  serializeSetupOutput,
  writeRuntimeConfig,
  type SetupAnswers,
  type SetupChoice,
  type SetupFlow,
  type SetupPersistedOutput
} from "@longtable/setup";
import {
  buildCodexSkillSpecs,
  buildCodexThinWrappedPrompt,
  installCodexSkills,
  listInstalledCodexSkills,
  renderQuestionRecordPrompt,
  removeCodexSkills,
  resolveCodexSkillsDir,
  runCodexThinWrapper
} from "@longtable/provider-codex";
import {
  buildClaudeSkillSpecs,
  installClaudeSkills,
  listInstalledClaudeSkills,
  renderQuestionRecordInput,
  removeClaudeSkills,
  resolveClaudeSkillsDir
} from "@longtable/provider-claude";
import {
  installCodexPromptAliases,
  listInstalledCodexPromptAliases,
  removeCodexPromptAliases,
  resolveCodexPromptsDir
} from "./prompt-aliases.js";
import { buildPersonaGuidance, parseInvocationDirective } from "./persona-router.js";
import { PERSONA_DEFINITIONS, listRoleDefinitions } from "./personas.js";
import { buildPanelFallback, renderPanelSummary } from "./panel.js";
import {
  LONGTABLE_MANAGED_HOOK_EVENTS,
  codexHooksEnabled,
  enableCodexHooksFeature,
  getMissingManagedCodexHookEvents,
  mergeManagedCodexHooksConfig,
  removeManagedCodexHooks
} from "./codex-hooks.js";
import {
  appendInvocationRecordToWorkspace,
  assertWorkspaceNotBlocked,
  answerWorkspaceQuestion,
  buildQuestionOpportunitySpecs,
  clearWorkspaceQuestion,
  createWorkspaceFollowUpQuestions,
  createWorkspaceQuestion,
  createOrUpdateProjectWorkspace,
  inspectProjectWorkspace,
  loadWorkspaceState,
  loadProjectContextFromDirectory,
  pruneWorkspaceQuestions,
  repairWorkspaceStateConsistency,
  renderProjectWorkspaceSummary,
  syncCurrentWorkspaceView,
  type LongTableProjectContext,
  type LongTableWorkspaceInspection,
  type ProjectDisagreementPreference,
  type StartInterviewSession,
  type StartInterviewSignal,
  type StartInterviewTurn
} from "./project-session.js";
import {
  buildTeamDebate,
  buildTeamReview,
  renderTeamDebateSummary,
  type TeamDebateBundle
} from "./debate.js";
import { createPromptRenderer } from "./prompt-renderer.js";

interface ParsedArgs {
  command?: string;
  subcommand?: string;
  values: Record<string, string | boolean>;
}

type LongTableSkillSurface = "compact" | "full";

interface CodexPersistAnswers {
  provider: "codex" | "claude";
  flow?: SetupFlow;
  field?: string;
  careerStage: string;
  experienceLevel: SetupAnswers["experienceLevel"];
  preferredCheckpointIntensity: SetupAnswers["preferredCheckpointIntensity"];
  humanAuthorshipSignal?: string;
  preferredEntryMode?: SetupAnswers["preferredEntryMode"];
  weakestDomain?: SetupAnswers["weakestDomain"];
  panelPreference?: SetupAnswers["panelPreference"];
}

interface ProjectInterviewAnswers {
  projectName: string;
  projectPath: string;
  currentGoal: string;
  currentBlocker?: string;
  researchObject?: string;
  gapRisk?: string;
  protectedDecision?: string;
  startInterview?: StartInterviewSession;
  requestedPerspectives: string[];
  disagreementPreference: ProjectDisagreementPreference;
}

interface ProviderSkillHealth {
  command: string;
  commandOnPath: boolean;
  runtimePath: string;
  runtimeExists: boolean;
  skillsDir: string;
  expectedSkills: string[];
  installedSkills: string[];
  missingSkills: string[];
}

interface CodexSkillHealth extends ProviderSkillHealth {
  promptsDir: string;
  legacyPromptFilesInstalled: string[];
  mcpConfigPath: string;
  mcpConfigExists: boolean;
  longtableMcpConfigured: boolean;
  mcpElicitationsAllowed: boolean;
  hooksPath: string;
  hooksExists: boolean;
  codexHooksEnabled: boolean;
  missingManagedHookEvents: string[];
}

interface LongTableDoctorStatus {
  setupPath: string;
  setupExists: boolean;
  providers: {
    codex: CodexSkillHealth;
    claude: ProviderSkillHealth;
  };
  workspace: LongTableWorkspaceInspection;
}

interface DoctorRepairResult {
  installedCodexSkills: string[];
  installedClaudeSkills: string[];
  removedLegacyPromptFiles: string[];
  installedCodexHooks?: boolean;
  repairedWorkspaceState?: string[];
  writtenRuntimeConfigs: Array<{
    provider: ProviderKind;
    path: string;
    format: string;
  }>;
  skipped: string[];
}

type McpProviderTarget = "codex" | "claude";

interface McpInstallTarget {
  provider: McpProviderTarget;
  path: string;
  format: "toml" | "json";
  content: string;
}

interface McpInstallResult {
  serverName: string;
  packageSpec: string;
  command: string;
  args: string[];
  write: boolean;
  checkpointUi?: SetupCheckpointUiChoice;
  targets: McpInstallTarget[];
}

interface CodexHookInstallResult {
  configPath: string;
  hooksPath: string;
  codexHooksEnabled: boolean;
  managedEvents: string[];
  write: boolean;
}

const VALID_MODES = new Set<InteractionMode>([
  "explore",
  "review",
  "critique",
  "draft",
  "commit",
  "submit"
]);

const VALID_STAGES = new Set<ResearchStage>([
  "problem_framing",
  "theory_selection",
  "method_design",
  "measurement_design",
  "analysis_planning",
  "writing",
  "submission"
]);

const ANSI = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  cyan: "\u001B[36m",
  green: "\u001B[32m"
};

const require = createRequire(import.meta.url);
const LONGTABLE_PACKAGE_VERSION = String((require("../package.json") as { version?: unknown }).version ?? "0.0.0");
const LONGTABLE_MCP_SERVER_NAME = "longtable-state";
const LONGTABLE_MCP_PACKAGE_VERSION = LONGTABLE_PACKAGE_VERSION;
const LONGTABLE_MCP_MARKER_START = "# LongTable state MCP START";
const LONGTABLE_MCP_MARKER_END = "# LongTable state MCP END";

function style(text: string, prefix: string): string {
  return `${prefix}${text}${ANSI.reset}`;
}

function renderSectionCard(title: string, body: string[]): string {
  return [
    "┌──────────────────────────────────────────────┐",
    `│ ${title.padEnd(44, " ")}│`,
    "└──────────────────────────────────────────────┘",
    ...body
  ].join("\n");
}

function renderBrandBanner(title: string, subtitle?: string): string {
  const lines = [
    style("╭──────────────────────────────────────────────╮", ANSI.cyan),
    style(`│ ${title.padEnd(44, " ")}│`, `${ANSI.bold}${ANSI.cyan}`),
    style("╰──────────────────────────────────────────────╯", ANSI.cyan)
  ];
  if (subtitle) {
    lines.push(style(subtitle, ANSI.dim));
  }
  return lines.join("\n");
}

function renderInterviewLaunchSteps(provider: ProviderKind): string {
  const command = provider === "codex" ? "codex" : "claude";
  return renderSectionCard("LongTable Interview", [
    "Setup is permission and runtime calibration, not the research interview.",
    "The first research conversation now happens inside the provider so the model can listen, reflect, and ask one natural-language follow-up at a time.",
    "",
    "Next:",
    "1. cd \"<research-folder>\"",
    `2. run \`${command}\``,
    "3. invoke `$longtable-interview`",
    "",
    "The interview will create or resume `.longtable/`, build a First Research Shape, and use option UI only for the final confirmation."
  ]);
}

function renderProgressBar(current: number, total: number): string {
  const width = 10;
  const filled = Math.max(1, Math.round((current / total) * width));
  return `${"█".repeat(filled)}${"·".repeat(Math.max(0, width - filled))}`;
}

function usage(): string {
  return [
    "Usage:",
    "  Run `longtable ...` in your terminal, not inside the Codex chat box.",
    "  LongTable research starts inside Codex or Claude with `$longtable-interview` after setup.",
    "",
    "  longtable setup [--provider codex|claude] [--install-scope user|project|none] [--surfaces cli_only|skills|skills_mcp|skills_mcp_sentinel] [--intervention advisory|balanced|strong] [--checkpoint-ui off|interactive|strong] [--workspace create|later] [--project-dir <path>] [--json] [--dir <path>] [--skills-dir <path>] [--runtime-path <file>] [--setup-path <file>]",
    "  longtable init [deprecated alias for setup; full legacy flags still supported for automation]",
    "  longtable start [deprecated fallback] [--path <dir>] [--name <project>] [--goal <text>] [--blocker <text>] [--research-object research_question|theory_framework|measurement_instrument|study_design|analysis_plan|manuscript] [--gap-risk known_gap|suspected_tacit_assumptions|diagnose] [--protected-decision theory|measurement|method|evidence_citation|authorship_voice|submission_public_sharing] [--perspectives <role[,role]>] [--disagreement synthesis_only|show_on_conflict|always_visible] [--setup <path>] [--json] [--no-interview]",
    "  longtable resume [--cwd <path>] [--json]",
    "  longtable doctor [--cwd <path>] [--fix] [--json] [--codex-dir <path>] [--codex-config <path>] [--hooks-path <path>] [--claude-dir <path>] [--codex-prompts-dir <path>] [--codex-runtime-path <file>] [--claude-runtime-path <file>]",
    "  longtable status [--cwd <path>] [--fix] [--json] [--codex-dir <path>] [--codex-config <path>] [--hooks-path <path>] [--claude-dir <path>] [--codex-prompts-dir <path>] [--codex-runtime-path <file>] [--claude-runtime-path <file>]",
    "  longtable audit [questions|roles] [--json]",
    "  longtable roles [--json]",
    "  longtable show [--json] [--path <file>]",
    "  longtable install [--json] [--path <file>] [--runtime-path <file>]",
    "  longtable mcp install [--provider codex|claude|all] [--write] [--checkpoint-ui off|interactive|strong] [--json] [--codex-config <path>] [--claude-settings <path>] [--package <spec>]",
    "  longtable search --query <text> [--intent literature|theory|measurement|citation|metadata|venue] [--field <text>] [--source all|crossref,arxiv,openalex,semantic_scholar,pubmed,eric,doaj,unpaywall] [--must <term[,term]>] [--exclude <term[,term]>] [--limit <n>] [--allow-partial] [--publisher-access] [--record] [--cwd <path>] [--json]",
    "  longtable search setup [--doi <doi>] [--json]",
    "  longtable search doctor [--doi <doi>] [--publisher auto|elsevier|springer_nature|wiley|taylor_francis|all] [--json]",
    "  longtable search probe --doi <doi> [--publisher auto|elsevier|springer_nature|wiley|taylor_francis] [--json]",
    "  longtable sentinel --prompt <text> [--cwd <path>] [--json] [--record]",
    "  longtable team --prompt <text> [--role <role[,role]>] [--debate] [--rounds 3|5] [--cwd <path>] [--json]",
    "  longtable ask [--prompt <text>] [--print] [--json] [--setup <path>] [--cwd <path>]",
    "  longtable clarify --prompt <task-context> [--provider codex|claude] [--required|--advisory] [--print] [--cwd <path>] [--json] [--force]",
    "  longtable question --prompt <decision-context> [--title <text>] [--text <question>] [--provider codex|claude] [--required|--advisory] [--print] [--cwd <path>] [--json]",
    "  longtable clear-question --question <id> --reason <text> [--cwd <path>] [--json]",
    "  longtable panel [--prompt <text>] [--role <role[,role]>] [--mode review|critique|draft|commit] [--visibility synthesis_only|show_on_conflict|always_visible] [--print] [--json] [--setup <path>] [--cwd <path>]",
    "  longtable decide [--question <id>] --answer <value-or-text> [--rationale <text>] [--provider codex|claude] [--cwd <path>] [--json]",
    "  longtable explore|review|critique|draft|commit|submit [--prompt <text>] [--role <role[,role]>] [--panel] [--show-conflicts] [--show-deliberation] [--print] [--json] [--stage <stage>] [--setup <path>] [--cwd <path>]",
    "  longtable codex persist-init [--answers-json <json> | --stdin | full setup flags] [--install-skills] [--install-prompts] [--json]",
    "  longtable codex install-skills [--surface compact|full] [--dir <path>]",
    "  longtable codex remove-skills [--dir <path>]",
    "  longtable codex install-prompts [--dir <path>]",
    "  longtable codex remove-prompts [--dir <path>]",
    "  longtable codex install-hooks [--codex-config <path>] [--hooks-path <path>] [--json]",
    "  longtable codex remove-hooks [--codex-config <path>] [--hooks-path <path>] [--json]",
    "  longtable codex status [--surface compact|full] [--dir <path>] [--codex-config <path>] [--hooks-path <path>] [--json]",
    "  longtable claude install-skills [--surface compact|full] [--dir <path>]",
    "  longtable claude remove-skills [--dir <path>]",
    "  longtable claude status [--surface compact|full] [--dir <path>] [--json]",
    "  longtable prune-questions [--cwd <path>] [--dry-run] [--json]",
    "  longtable mcp install --provider all",
    "",
    "Examples:",
    "  longtable setup --provider codex",
    "  cd \"<research-folder>\" && codex",
    "  $longtable-interview",
    "  longtable start --no-interview --path ~/Research/My-Project --name \"AI Adoption Meta-Analysis\" --goal \"Narrow the review question\"",
    "  longtable doctor",
    "  longtable roles",
    "  longtable ask --prompt \"연구를 시작하고 싶어. 지금 어디서부터 좁혀야 할지 모르겠어.\"",
    "  printf '{\"provider\":\"codex\",...}' | longtable codex persist-init --stdin --install-skills",
    "  longtable codex install-skills",
    "  longtable claude install-skills"
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, maybeSubcommand] = argv;
  const values: Record<string, string | boolean> = {};
  let subcommand: string | undefined = maybeSubcommand;

  const modeCommand = command && VALID_MODES.has(command as InteractionMode);
  const directCommand =
    command && ["init", "setup", "start", "resume", "doctor", "status", "audit", "roles", "show", "install", "mcp", "codex", "claude", "ask", "clarify", "question", "clear-question", "prune-questions", "panel", "decide", "sentinel", "team", "search"].includes(command);

  let startIndex = 1;
  if (modeCommand) {
    subcommand = undefined;
    startIndex = 1;
  } else if (command === "codex" || command === "claude" || command === "mcp") {
    startIndex = 2;
  } else if (command === "search" && maybeSubcommand && !maybeSubcommand.startsWith("--")) {
    subcommand = maybeSubcommand;
    startIndex = 2;
  } else if (command === "audit" && maybeSubcommand && !maybeSubcommand.startsWith("--")) {
    subcommand = maybeSubcommand;
    startIndex = 2;
  } else if (directCommand) {
    subcommand = undefined;
    startIndex = 1;
  } else if (!command || command === "--help") {
    return { values };
  } else {
    startIndex = 1;
    subcommand = undefined;
  }

  const tokens = argv.slice(startIndex);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = tokens[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = true;
      continue;
    }

    values[key] = next;
    index += 1;
  }

  return { command, subcommand, values };
}

function buildSetupFlowChoices(): SetupChoice[] {
  return [
    {
      id: "quickstart",
      label: "Quickstart",
      description: "Minimal setup for the fastest first win."
    },
    {
      id: "interview",
      label: "Interview",
      description: "A more detailed researcher profile interview for better first guidance."
    }
  ];
}

function renderSetupHeader(flow: SetupFlow): string {
  const title = flow === "interview" ? "LongTable Setup Interview" : "LongTable Quickstart";
  const subtitle =
    flow === "interview"
      ? "We will ask about your research persona, challenge preferences, and authorship defaults."
      : "We will capture the minimum profile needed to start using LongTable.";

  return [renderBrandBanner("LongTable", "Research workspace setup"), "", renderSectionCard(title, [subtitle])].join("\n");
}

function renderQuestionHeader(
  index: number,
  total: number,
  section: string,
  prompt: string
): string {
  return [
    "",
    style(`[${index}/${total}] ${section}  ${renderProgressBar(index, total)}`, `${ANSI.bold}${ANSI.cyan}`),
    prompt
  ].join("\n");
}

function questionSection(questionId: string): string {
  if (questionId === "careerStage" || questionId === "experienceLevel") {
    return "Researcher profile";
  }
  if (questionId === "preferredCheckpointIntensity" || questionId === "preferredEntryMode") {
    return "Interaction style";
  }
  if (questionId === "weakestDomain" || questionId === "panelPreference") {
    return "How LongTable should challenge you";
  }
  return "Authorship and voice";
}

function formatModeLabel(mode: InteractionMode): string {
  return `${mode[0].toUpperCase()}${mode.slice(1)}`;
}

function parseSkillSurface(args: Record<string, string | boolean>): LongTableSkillSurface {
  const value = args.surface;
  if (value === undefined || value === true) {
    return "compact";
  }
  if (value === "compact" || value === "full") {
    return value;
  }
  throw new Error("Invalid --surface value. Use compact or full.");
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function expandHomePath(value: string): string {
  if (value === "~") {
    return homedir();
  }
  if (value.startsWith("~/")) {
    return resolve(homedir(), value.slice(2));
  }
  return value;
}

function normalizeUserPath(value: string): string {
  return expandHomePath(stripWrappingQuotes(value));
}

function projectFolderSlug(projectName: string): string {
  return projectName
    .trim()
    .replace(/[^\w가-힣]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveInteractiveProjectPath(parentOrPath: string, projectName: string): string {
  const normalized = normalizeUserPath(parentOrPath);
  const folderName = projectFolderSlug(projectName);

  if (!normalized) {
    return resolve(folderName);
  }

  try {
    if (existsSync(normalized) && statSync(normalized).isDirectory()) {
      return resolve(normalized, folderName);
    }
  } catch {
    return resolve(normalized);
  }

  return resolve(normalized);
}

async function verifyWritableWorkspaceParent(projectPath: string): Promise<void> {
  const parentDir = dirname(resolve(projectPath));
  const probePrefix = resolve(parentDir, ".longtable-permission-check-");

  try {
    const created = await mkdtemp(probePrefix);
    await rm(created, { recursive: true, force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        `LongTable could not create a project workspace under: ${parentDir}`,
        "Reason: your current shell process cannot write to that parent directory.",
        "",
        "What to try next:",
        `- test it directly: mkdir -p "${resolve(parentDir, "_longtable_write_test")}"`,
        "- if that fails too, this is an OS/disk permission problem rather than a LongTable command problem",
        "- try a known-writable path such as ~/Research",
        "- or choose a different existing parent directory when LongTable asks where the project should live",
        "",
        `Original error: ${message}`
      ].join("\n")
    );
  }
}

async function promptText(
  prompt: string,
  required: boolean
): Promise<string | undefined> {
  return createPromptRenderer().text(prompt, { required });
}

async function promptChoice(
  prompt: string,
  choices: SetupChoice[]
): Promise<string> {
  return createPromptRenderer().select(prompt, choices);
}

async function promptMultiChoice(
  prompt: string,
  choices: SetupChoice[]
): Promise<string[]> {
  return createPromptRenderer().multiselect(prompt, choices);
}

function hasCompleteFlagInput(args: Record<string, string | boolean>): boolean {
  const required = ["provider", "career-stage", "experience", "checkpoint"];
  return required.every((key) => typeof args[key] === "string" && String(args[key]).trim().length > 0);
}

function resolveSetupFlow(args: Record<string, string | boolean>): SetupFlow {
  return String(args.flow) === "interview" ? "interview" : "quickstart";
}

function toSetupAnswers(args: Record<string, string | boolean>): SetupAnswers {
  return {
    field: typeof args.field === "string" && args.field.trim().length > 0
      ? String(args.field)
      : "unspecified",
    careerStage: String(args["career-stage"]),
    experienceLevel: String(args.experience) as SetupAnswers["experienceLevel"],
    currentProjectType:
      typeof args["project-type"] === "string" && args["project-type"].trim().length > 0
        ? String(args["project-type"])
        : "unspecified research task",
    preferredCheckpointIntensity: String(args.checkpoint) as SetupAnswers["preferredCheckpointIntensity"],
    humanAuthorshipSignal:
      typeof args["authorship-signal"] === "string" && args["authorship-signal"].trim().length > 0
        ? args["authorship-signal"].trim()
        : undefined,
    preferredEntryMode:
      typeof args["entry-mode"] === "string" && VALID_MODES.has(String(args["entry-mode"]) as InteractionMode)
        ? (String(args["entry-mode"]) as SetupAnswers["preferredEntryMode"])
        : undefined,
    weakestDomain:
      typeof args["weakest-domain"] === "string"
        ? (String(args["weakest-domain"]) as SetupAnswers["weakestDomain"])
        : undefined,
    panelPreference:
      typeof args["panel-preference"] === "string"
        ? (String(args["panel-preference"]) as SetupAnswers["panelPreference"])
        : undefined
  };
}

async function collectInteractiveAnswers(initialFlow?: SetupFlow): Promise<{
  flow: SetupFlow;
  provider: "codex" | "claude";
  answers: SetupAnswers;
}> {
  const flow =
    initialFlow ??
    ((await promptChoice(
      "How would you like to set up LongTable?",
      buildSetupFlowChoices()
    )) as SetupFlow);
  console.log("");
  console.log(renderSetupHeader(flow));
  console.log("");

  const provider = await promptChoice("Which provider do you want to configure?", buildProviderChoices()) as "codex" | "claude";
  const answers: Partial<SetupAnswers> = {
    field: "unspecified",
    currentProjectType: "unspecified research task"
  };
  const questions = buildQuickSetupFlow(flow);

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const prompt = renderQuestionHeader(index + 1, questions.length, questionSection(question.id), question.prompt);

    let value: string | undefined;
    if (question.kind === "text") {
      value = await promptText(prompt, question.required);
    } else if (question.choices) {
      value = await promptChoice(prompt, question.choices);
    }

    if (!value) {
      continue;
    }

    if (question.id === "careerStage") answers.careerStage = value;
    if (question.id === "experienceLevel") answers.experienceLevel = value as SetupAnswers["experienceLevel"];
    if (question.id === "preferredCheckpointIntensity") {
      answers.preferredCheckpointIntensity = value as SetupAnswers["preferredCheckpointIntensity"];
    }
    if (question.id === "humanAuthorshipSignal" && value !== "other") {
      answers.humanAuthorshipSignal = value;
    }
    if (question.id === "preferredEntryMode") answers.preferredEntryMode = value as SetupAnswers["preferredEntryMode"];
    if (question.id === "weakestDomain") answers.weakestDomain = value as SetupAnswers["weakestDomain"];
    if (question.id === "panelPreference") answers.panelPreference = value as SetupAnswers["panelPreference"];
  }

  return {
    flow,
    provider,
    answers: answers as SetupAnswers
  };
}

type SetupInstallScopeChoice = "user" | "project" | "none";
type SetupSurfaceChoice = "cli_only" | "skills" | "skills_mcp" | "skills_mcp_sentinel";
type SetupInterventionChoice = "advisory" | "balanced" | "strong";
type SetupWorkspaceChoice = "create" | "later";
type SetupCheckpointUiChoice = NonNullable<SetupAnswers["checkpointUiMode"]>;

function buildPermissionSetupChoices(): {
  installScope: SetupChoice[];
  surfaces: SetupChoice[];
  intervention: SetupChoice[];
  checkpointUi: SetupChoice[];
  workspace: SetupChoice[];
} {
  return {
    installScope: [
      {
        id: "user",
        label: "User-level provider config",
        description: "Why: available across projects. What you get: writes to ~/.codex or ~/.claude. Tradeoff: broader machine-level change."
      },
      {
        id: "project",
        label: "Current project only",
        description: "Why: keeps LongTable local to this repository. What you get: project-scoped runtime files when supported. Tradeoff: not available elsewhere."
      },
      {
        id: "none",
        label: "Do not install provider files",
        description: "Why: safest permission boundary. What you get: CLI setup record only. Tradeoff: no provider-native skills or MCP config."
      }
    ],
    surfaces: [
      {
        id: "cli_only",
        label: "CLI only",
        description: "Why: least invasive. What you get: setup record and CLI commands. Tradeoff: no natural in-provider LongTable entrypoints."
      },
      {
        id: "skills",
        label: "Skills",
        description: "Why: enables natural LongTable skill routing. What you get: provider skills. Tradeoff: writes provider skill files."
      },
      {
        id: "skills_mcp",
        label: "Skills + MCP",
        description: "Why: adds structured state access. What you get: skills and MCP config. Tradeoff: writes provider config for MCP transport."
      },
      {
        id: "skills_mcp_sentinel",
        label: "Skills + MCP + Sentinel",
        description: "Why: prepares advisory gap/tacit monitoring. What you get: skills, MCP, and sentinel approval. Tradeoff: LongTable may nudge research turns."
      }
    ],
    intervention: [
      {
        id: "advisory",
        label: "Advisory",
        description: "Why: notices gaps without blocking. What you get: light nudges. Tradeoff: you may still miss hard commitments."
      },
      {
        id: "balanced",
        label: "Balanced",
        description: "Why: blocks clear theory, measurement, method, or evidence commitments. What you get: recommended checkpoints. Tradeoff: occasional stops."
      },
      {
        id: "strong",
        label: "Strong",
        description: "Why: maximizes judgment protection. What you get: stricter checkpoints. Tradeoff: more interruption before closure."
      }
    ],
    checkpointUi: [
      {
        id: "strong",
        label: "Strong Researcher Checkpoint UI",
        description: "Why: makes Codex UI checkpoints the default for high-responsibility research decisions. What you get: MCP form checkpoints with a single decision field. Tradeoff: requires Codex MCP elicitation approval."
      },
      {
        id: "interactive",
        label: "Interactive checkpoint UI",
        description: "Why: keeps Codex UI prompts available for required checkpoints. What you get: MCP form checkpoints when supported. Tradeoff: requires Codex MCP elicitation approval."
      },
      {
        id: "off",
        label: "Text fallback only",
        description: "Why: safest transport boundary. What you get: numbered checkpoints and terminal selectors only. Tradeoff: no Codex UI form prompts."
      }
    ],
    workspace: [
      {
        id: "create",
        label: "Show interview launch steps",
        description: "Why: research should start inside the provider. What you get: setup finishes with Codex/Claude + $longtable-interview steps. Tradeoff: workspace creation waits for the in-provider interview."
      },
      {
        id: "later",
        label: "No, prepare runtime only",
        description: "Why: keeps setup short. What you get: runtime support without project state. Tradeoff: no durable research memory until `$longtable-interview` creates or resumes a workspace."
      }
    ]
  };
}

function checkpointIntensityFromIntervention(choice: SetupInterventionChoice): SetupAnswers["preferredCheckpointIntensity"] {
  if (choice === "strong") return "high";
  if (choice === "advisory") return "low";
  return "balanced";
}

function shouldInstallSkills(scope: SetupInstallScopeChoice, surfaces: SetupSurfaceChoice): boolean {
  return scope !== "none" && surfaces !== "cli_only";
}

function shouldInstallMcp(scope: SetupInstallScopeChoice, surfaces: SetupSurfaceChoice): boolean {
  return scope !== "none" && (surfaces === "skills_mcp" || surfaces === "skills_mcp_sentinel");
}

function setupProjectRoot(args: Record<string, string | boolean>): string {
  return resolve(
    normalizeUserPath(
      typeof args["project-dir"] === "string" && args["project-dir"].trim()
        ? args["project-dir"].trim()
        : cwd()
    )
  );
}

function setupInstallDir(
  provider: ProviderKind,
  scope: SetupInstallScopeChoice,
  customDir: string | undefined,
  projectRoot: string
): string | undefined {
  if (customDir) return customDir;
  if (scope === "project") return join(projectRoot, provider === "codex" ? ".codex" : ".claude", "skills");
  return undefined;
}

function setupPathForScope(
  scope: SetupInstallScopeChoice,
  args: Record<string, string | boolean>,
  projectRoot: string
): string | undefined {
  if (typeof args["setup-path"] === "string") return args["setup-path"];
  if (scope === "project") return join(projectRoot, ".longtable", "setup.json");
  return undefined;
}

function runtimePathForScope(
  provider: ProviderKind,
  scope: SetupInstallScopeChoice,
  args: Record<string, string | boolean>,
  projectRoot: string
): string | undefined {
  if (typeof args["runtime-path"] === "string") return args["runtime-path"];
  if (scope !== "project") return undefined;
  return join(projectRoot, ".longtable", provider === "codex" ? "codex-runtime.toml" : "claude-runtime.json");
}

function mcpArgsForScope(
  provider: McpProviderTarget,
  scope: SetupInstallScopeChoice,
  args: Record<string, string | boolean>,
  projectRoot: string
): Record<string, string | boolean> {
  if (scope !== "project") return args;
  return {
    ...args,
    ...(provider === "codex" && typeof args["codex-config"] !== "string"
      ? { "codex-config": join(projectRoot, ".codex", "config.toml") }
      : {}),
    ...(provider === "claude" && typeof args["claude-settings"] !== "string"
      ? { "claude-settings": join(projectRoot, ".claude", "settings.json") }
      : {})
  };
}

function parseSetupInstallScope(value: string | boolean | undefined): SetupInstallScopeChoice | undefined {
  return value === "user" || value === "project" || value === "none" ? value : undefined;
}

function parseSetupSurface(value: string | boolean | undefined): SetupSurfaceChoice | undefined {
  return value === "cli_only" || value === "skills" || value === "skills_mcp" || value === "skills_mcp_sentinel"
    ? value
    : undefined;
}

function parseSetupIntervention(value: string | boolean | undefined): SetupInterventionChoice | undefined {
  return value === "advisory" || value === "balanced" || value === "strong" ? value : undefined;
}

function parseSetupCheckpointUi(value: string | boolean | undefined): SetupCheckpointUiChoice | undefined {
  return value === "off" || value === "interactive" || value === "strong" ? value : undefined;
}

function parseSetupWorkspace(value: string | boolean | undefined): SetupWorkspaceChoice | undefined {
  return value === "create" || value === "later" ? value : undefined;
}

function checkpointUiRequiresMcp(choice: SetupCheckpointUiChoice): boolean {
  return choice === "interactive" || choice === "strong";
}

function checkpointUiIntervention(
  intervention: SetupInterventionChoice,
  checkpointUi: SetupCheckpointUiChoice
): SetupInterventionChoice {
  return checkpointUi === "strong" ? "strong" : intervention;
}

async function runSetup(args: Record<string, string | boolean>): Promise<void> {
  const json = args.json === true;
  const provider = (typeof args.provider === "string"
    ? (args.provider === "claude" ? "claude" : "codex")
    : await promptChoice("Which provider should LongTable configure?", buildProviderChoices())) as "codex" | "claude";
  const choices = buildPermissionSetupChoices();
  const installScope = parseSetupInstallScope(args["install-scope"]) ?? await promptChoice(
    "Where may LongTable install runtime support?",
    choices.installScope
  ) as SetupInstallScopeChoice;
  const surfaces = parseSetupSurface(args.surfaces) ?? await promptChoice(
    [
      "Which LongTable runtime surfaces should be enabled?",
      "This is a permission choice because skills, MCP, and sentinel support write provider-facing runtime files."
    ].join("\n"),
    choices.surfaces
  ) as SetupSurfaceChoice;
  const intervention = parseSetupIntervention(args.intervention) ?? await promptChoice(
    "How strongly may LongTable interrupt research decisions?",
    choices.intervention
  ) as SetupInterventionChoice;
  const parsedCheckpointUi = parseSetupCheckpointUi(args["checkpoint-ui"]);
  const checkpointUiEligible = provider === "codex" && installScope !== "none" && shouldInstallMcp(installScope, surfaces);
  if (parsedCheckpointUi && checkpointUiRequiresMcp(parsedCheckpointUi) && !checkpointUiEligible) {
    throw new Error("`--checkpoint-ui interactive|strong` requires Codex with an MCP runtime surface.");
  }
  const checkpointUi = parsedCheckpointUi ?? (
    checkpointUiEligible
      ? await promptChoice(
        [
          "Should Codex use UI Researcher Checkpoints when MCP elicitation is available?",
          "This writes Codex MCP elicitation approval only when you choose an interactive mode."
        ].join("\n"),
        choices.checkpointUi
      ) as SetupCheckpointUiChoice
      : "off"
  );
  const workspacePreference = parseSetupWorkspace(args.workspace) ?? await promptChoice(
    "Should LongTable create a project workspace now?",
    choices.workspace
  ) as SetupWorkspaceChoice;
  const projectRoot = setupProjectRoot(args);
  const effectiveIntervention = checkpointUiIntervention(intervention, checkpointUi);

  const outputValue = createPersistedSetupOutput(
    {
      field: "unspecified",
      careerStage: "unspecified",
      experienceLevel: "advanced",
      preferredCheckpointIntensity: checkpointIntensityFromIntervention(effectiveIntervention),
      checkpointUiMode: checkpointUi,
      preferredEntryMode: "explore",
      panelPreference: "show_on_conflict"
    },
    provider,
    "quickstart"
  );
  outputValue.initialState.explicitState = {
    ...outputValue.initialState.explicitState,
    installScope,
    runtimeSurfaces: surfaces,
    interventionPosture: effectiveIntervention,
    checkpointUiMode: checkpointUi,
    workspaceCreationPreference: workspacePreference,
    officialStartSurface: "$longtable-interview",
    setupPosture: "permission_first",
    teamMode: "panel"
  };
  if (surfaces === "skills_mcp_sentinel") {
    outputValue.initialState.inferredHypotheses.push({
      hypothesis: "Researcher approved advisory Gap/Tacit Sentinel setup.",
      confidence: 0.95,
      evidence: ["Selected Skills + MCP + Sentinel during permission-first setup."],
      status: "confirmed"
    });
  }

  const setupPath = setupPathForScope(installScope, args, projectRoot);
  const runtimePath = runtimePathForScope(provider, installScope, args, projectRoot);
  const result = installScope === "none"
    ? {
        provider,
        setupTarget: await saveSetupOutput(outputValue, setupPath)
      }
    : await saveSetupAndRuntimeConfig(outputValue, {
        setupPath,
        runtimePath
      });

  const scopedInstallDir = setupInstallDir(
    provider,
    installScope,
    typeof args["skills-dir"] === "string" ? args["skills-dir"] : typeof args.dir === "string" ? args.dir : undefined,
    projectRoot
  );
  const installedSkills = !shouldInstallSkills(installScope, surfaces)
    ? []
    : provider === "codex"
      ? await installCodexSkills(listRoleDefinitions(), scopedInstallDir)
      : await installClaudeSkills(listRoleDefinitions(), scopedInstallDir);

  let mcpInstall: McpInstallResult | undefined;
  if (shouldInstallMcp(installScope, surfaces)) {
    mcpInstall = await installMcpForSetup(provider, {
      ...mcpArgsForScope(provider, installScope, args, projectRoot),
      ...(provider === "codex" && checkpointUiRequiresMcp(checkpointUi)
        ? { "checkpoint-ui": checkpointUi }
        : {})
    });
  }

  if (json) {
    console.log(JSON.stringify({
      setup: outputValue,
      runtime: result,
      installedSkills: installedSkills.map((skill) => skill.name),
      mcpInstall,
      workspacePreference,
      nextStep: {
        surface: "$longtable-interview",
        command: provider === "codex" ? "codex" : "claude",
        description: "Open the provider in the research folder and invoke `$longtable-interview`."
      }
    }, null, 2));
    return;
  }

  console.log("");
  console.log(renderSetupSummary(outputValue));
  console.log("");
  if ("runtimeTarget" in result) {
    console.log(renderInstallSummary(result));
  } else {
    console.log("LongTable setup summary");
    console.log(`setup path: ${result.setupTarget.path}`);
    console.log("provider files: not installed by researcher choice");
  }
  console.log(`Installed skills: ${installedSkills.length}`);
  if (mcpInstall) {
    console.log("");
    console.log(renderMcpInstallSummary(mcpInstall));
    if (provider === "codex" && checkpointUiRequiresMcp(checkpointUi)) {
      console.log("");
      console.log("Restart Codex after this config change, then run `longtable doctor` in the project workspace.");
    }
  }
  if (surfaces === "skills_mcp_sentinel") {
    console.log("");
    console.log("Background sentinel approval recorded.");
    console.log("Hook installation remains opt-in; LongTable will not install hooks without an explicit hook command.");
  }
  console.log("");
  console.log(renderInterviewLaunchSteps(provider));
  if (workspacePreference === "create") {
    console.log("");
    console.log("Workspace launch requested. Open the provider in your research folder and run `$longtable-interview`; the interview will create `.longtable/` there.");
  }
}

function perspectiveChoices(): SetupChoice[] {
  return PERSONA_DEFINITIONS.map((persona) => ({
    id: persona.key,
    label: persona.label,
    description: persona.shortDescription
  }));
}

function researchObjectChoices(): SetupChoice[] {
  return [
    { id: "research_question", label: "Research question", description: "The main question, problem, or contribution boundary." },
    { id: "theory_framework", label: "Theory framework", description: "Constructs, theory choice, or conceptual model." },
    { id: "measurement_instrument", label: "Measurement/instrument", description: "Variables, scales, instruments, or operationalization." },
    { id: "study_design", label: "Study design", description: "Methods, sample, intervention, or data collection design." },
    { id: "analysis_plan", label: "Analysis plan", description: "Analytic strategy, models, coding, or interpretation plan." },
    { id: "manuscript", label: "Manuscript", description: "Drafting, revision, voice, evidence, or submission writing." }
  ];
}

function gapRiskChoices(): SetupChoice[] {
  return [
    { id: "known_gap", label: "I know the gap", description: "The blocker is explicit and can be tracked directly." },
    { id: "suspected_tacit_assumptions", label: "I suspect tacit assumptions", description: "There may be hidden commitments or unstated premises." },
    { id: "diagnose", label: "Ask LongTable to diagnose it", description: "Let LongTable classify likely gaps during the session." }
  ];
}

function protectedDecisionChoices(): SetupChoice[] {
  return [
    { id: "theory", label: "Theory", description: "Do not let theory or construct choices settle quietly." },
    { id: "measurement", label: "Measurement", description: "Do not let variables, scales, or instruments settle quietly." },
    { id: "method", label: "Method", description: "Do not let design, sampling, or procedure choices settle quietly." },
    { id: "evidence_citation", label: "Evidence/citation", description: "Do not let unsupported source or citation choices settle quietly." },
    { id: "authorship_voice", label: "Authorship/voice", description: "Do not let writing voice or authorial judgment disappear quietly." },
    { id: "submission_public_sharing", label: "Submission/public sharing", description: "Do not let public-facing commitments settle quietly." }
  ];
}

function compactAnswer(value: string, maxLength = 180): string {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
  return firstLine.length > maxLength ? `${firstLine.slice(0, maxLength - 1)}…` : firstLine;
}

function answerIncludes(answer: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(answer));
}

function classifyStartInterviewSignal(answer: string): StartInterviewSignal {
  const normalized = answer.toLowerCase();
  if (answerIncludes(normalized, [/\bvoice\b/, /\bauthor(ship)?\b/, /\bwriting\b/, /저자|목소리|문체|글쓰기/])) {
    return "voice";
  }
  if (answerIncludes(normalized, [/\breader\b/, /\breviewer\b/, /\bvenue\b/, /\bjournal\b/, /\baudience\b/, /독자|심사자|저널|학회|대상/])) {
    return "audience";
  }
  if (answerIncludes(normalized, [/\bpaper\b/, /\bproposal\b/, /\bmanuscript\b/, /\bdraft\b/, /\bdeliverable\b/, /논문|제안서|원고|초안|산출물/])) {
    return "artifact";
  }
  if (answerIncludes(normalized, [/\bevidence\b/, /\bdata\b/, /\bsource\b/, /\bcitation\b/, /\bliterature\b/, /\bmeasure\b/, /\bscale\b/, /\binstrument\b/, /근거|자료|데이터|문헌|인용|측정|척도|도구/])) {
    return "evidence";
  }
  if (answerIncludes(normalized, [/\bassum/, /\btacit\b/, /\bimplicit\b/, /\bpremise\b/, /전제|암묵|가정|숨겨진/])) {
    return "assumption";
  }
  if (answerIncludes(normalized, [/\bdecid/, /\bchoose\b/, /\bcommit\b/, /\bsettle\b/, /\block\b/, /결정|선택|확정|고정/])) {
    return "decision_risk";
  }
  return "phenomenon";
}

function inferResearchObjectFromAnswers(answers: string[]): string | undefined {
  const joined = answers.join("\n").toLowerCase();
  if (answerIncludes(joined, [/\bmeasure\b/, /\bscale\b/, /\binstrument\b/, /\bvariable\b/, /\bconstruct\b/, /측정|척도|변수|구성개념|도구/])) {
    return "measurement_instrument";
  }
  if (answerIncludes(joined, [/\bmethod\b/, /\bdesign\b/, /\bsample\b/, /\binterview\b/, /\bexperiment\b/, /\bparticipant\b/, /방법|설계|표본|인터뷰|실험|참여자/])) {
    return "study_design";
  }
  if (answerIncludes(joined, [/\btheory\b/, /\bframework\b/, /\bmodel\b/, /\bconcept\b/, /이론|프레임워크|모형|개념/])) {
    return "theory_framework";
  }
  if (answerIncludes(joined, [/\banalysis\b/, /\bmodel\b/, /\bcoding\b/, /\bstatistic\b/, /분석|모델|코딩|통계/])) {
    return "analysis_plan";
  }
  if (answerIncludes(joined, [/\bpaper\b/, /\bmanuscript\b/, /\bdraft\b/, /\bwriting\b/, /논문|원고|초안|글쓰기/])) {
    return "manuscript";
  }
  return "research_question";
}

function inferGapRiskFromSignals(signals: StartInterviewSignal[]): string | undefined {
  if (signals.includes("assumption") || signals.includes("decision_risk")) {
    return "suspected_tacit_assumptions";
  }
  if (signals.includes("evidence")) {
    return "known_gap";
  }
  return "diagnose";
}

function inferProtectedDecisionFromAnswers(answers: string[]): string | undefined {
  const joined = answers.join("\n").toLowerCase();
  if (answerIncludes(joined, [/\bmeasure\b/, /\bscale\b/, /\binstrument\b/, /\bvariable\b/, /측정|척도|변수|도구/])) {
    return "measurement";
  }
  if (answerIncludes(joined, [/\bmethod\b/, /\bdesign\b/, /\bsample\b/, /\binterview\b/, /\bexperiment\b/, /방법|설계|표본|인터뷰|실험/])) {
    return "method";
  }
  if (answerIncludes(joined, [/\bevidence\b/, /\bsource\b/, /\bcitation\b/, /\bliterature\b/, /근거|출처|인용|문헌/])) {
    return "evidence_citation";
  }
  if (answerIncludes(joined, [/\bvoice\b/, /\bauthor(ship)?\b/, /\bwriting\b/, /저자|목소리|문체|글쓰기/])) {
    return "authorship_voice";
  }
  if (answerIncludes(joined, [/\bsubmit\b/, /\bpublication\b/, /\bjournal\b/, /\bvenue\b/, /투고|출판|저널|학회|공개/])) {
    return "submission_public_sharing";
  }
  if (answerIncludes(joined, [/\btheory\b/, /\bframework\b/, /\bconstruct\b/, /이론|프레임워크|구성개념/])) {
    return "theory";
  }
  return undefined;
}

function uniqueSignals(turns: StartInterviewTurn[]): StartInterviewSignal[] {
  return [...new Set(turns.map((turn) => turn.signal))];
}

function renderStartInterviewPrompt(
  turn: number,
  total: number,
  question: string,
  context?: string
): string {
  return [
    `LongTable Start Interview  Turn ${turn}/${total}`,
    context ? `Context: ${context}` : undefined,
    question
  ].filter(Boolean).join("\n");
}

async function collectAdaptiveStartInterview(args: {
  currentGoal?: string;
  currentBlocker?: string;
  needsResearchSeed: boolean;
}): Promise<{
  currentGoal?: string;
  currentBlocker?: string;
  startInterview?: StartInterviewSession;
  inferredResearchObject?: string;
  inferredGapRisk?: string;
  inferredProtectedDecision?: string;
}> {
  if (!args.needsResearchSeed) {
    return {};
  }

  const createdAt = new Date().toISOString();
  const turns: StartInterviewTurn[] = [];

  async function ask(question: string, purpose: string, context?: string): Promise<string | undefined> {
    const answer = await promptText(
      renderStartInterviewPrompt(turns.length + 1, 5, question, context),
      true
    );
    if (!answer?.trim()) {
      return undefined;
    }
    turns.push({
      index: turns.length + 1,
      question,
      answer: answer.trim(),
      signal: classifyStartInterviewSignal(answer),
      purpose
    });
    return answer.trim();
  }

  let currentGoal = args.currentGoal;
  let currentBlocker = args.currentBlocker;

  if (!currentGoal) {
    const opening = await ask(
      "What scene, problem, or moment made you want to start this research?",
      "Open from the researcher's lived entry point instead of a taxonomy."
    );
    currentGoal = opening ? compactAnswer(opening) : undefined;
  }

  const openingContext = currentGoal ? compactAnswer(currentGoal, 120) : undefined;
  if (!currentBlocker) {
    const blocker = await ask(
      "In that scene, what still feels least explained or hardest to justify?",
      "Name the first uncertainty without asking the researcher to classify it as theory, method, or measurement.",
      openingContext
    );
    currentBlocker = blocker ? compactAnswer(blocker) : undefined;
  }

  const readerContext = currentBlocker ? compactAnswer(currentBlocker, 120) : openingContext;
  await ask(
    "If this research succeeds, what should a reader or reviewer understand differently?",
    "Locate the audience-facing contribution before proposing a direction.",
    readerContext
  );

  await ask(
    "What material would you inspect first to make this research concrete: a case, dataset, text, instrument, draft, or literature trail?",
    "Convert the opening story into a first inspectable research move.",
    readerContext
  );

  const answers = turns.map((turn) => turn.answer);
  const inferredSignals = uniqueSignals(turns);
  const summary = [
    currentGoal ? `Opening: ${compactAnswer(currentGoal, 120)}.` : "",
    currentBlocker ? `First uncertainty: ${compactAnswer(currentBlocker, 120)}.` : "",
    inferredSignals.length > 0 ? `Early lenses: ${inferredSignals.join(", ")}.` : ""
  ].filter(Boolean).join(" ");

  return {
    currentGoal,
    currentBlocker,
    startInterview: {
      mode: "adaptive",
      openingStyle: "scene_problem",
      createdAt,
      completedAt: new Date().toISOString(),
      turnCount: turns.length,
      turns,
      inferredSignals,
      summary: summary || "Adaptive start interview completed."
    },
    inferredResearchObject: inferResearchObjectFromAnswers(answers),
    inferredGapRisk: inferGapRiskFromSignals(inferredSignals),
    inferredProtectedDecision: inferProtectedDecisionFromAnswers(answers)
  };
}

function normalizePerspectiveList(value?: string): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function collectProjectInterview(
  setup: Awaited<ReturnType<typeof loadSetupOutput>>,
  args: Record<string, string | boolean>
): Promise<ProjectInterviewAnswers> {
  const skipResearchInterview = args["no-interview"] === true;
  const providedPerspectives = normalizePerspectiveList(typeof args.perspectives === "string" ? args.perspectives : undefined);
  const providedGoal = typeof args.goal === "string" && args.goal.trim() ? args.goal.trim() : undefined;
  const providedBlocker = typeof args.blocker === "string" && args.blocker.trim() ? args.blocker.trim() : undefined;
  const providedResearchObject =
    typeof args["research-object"] === "string" && args["research-object"].trim()
      ? args["research-object"].trim()
      : undefined;
  const providedGapRisk =
    typeof args["gap-risk"] === "string" && args["gap-risk"].trim()
      ? args["gap-risk"].trim()
      : undefined;
  const providedProtectedDecision =
    typeof args["protected-decision"] === "string" && args["protected-decision"].trim()
      ? args["protected-decision"].trim()
      : undefined;
  const needsInteractivePrompts =
    !(typeof args.name === "string" && args.name.trim()) ||
    !(typeof args.path === "string" && args.path.trim()) ||
    (!skipResearchInterview && (
      !providedGoal ||
      !providedBlocker ||
      !providedResearchObject ||
      !providedGapRisk ||
      !providedProtectedDecision
    ));

  if (needsInteractivePrompts) {
    console.log("");
    console.log(renderBrandBanner("LongTable", "Project workspace interview"));
    console.log("");
    console.log(renderSectionCard("LongTable Project Start", [
      "LongTable will create a workspace and seed today's research memory.",
      "The start interview begins from the scene or problem, then LongTable quietly infers the research shape."
    ]));
    console.log("");
  }

  const projectName =
    (typeof args.name === "string" && args.name.trim()) ||
    (await promptText(
      renderQuestionHeader(1, 2, "Workspace", "What should this project be called?"),
      true
    ))!;

  const suggestedParentDir =
    typeof args.path === "string" && args.path.trim()
      ? normalizeUserPath(args.path.trim())
      : homedir();
  const suggestedPath = resolveInteractiveProjectPath(suggestedParentDir, projectName);

  const projectPath =
    (typeof args.path === "string" && args.path.trim()
      ? normalizeUserPath(args.path.trim())
      : resolveInteractiveProjectPath(
          (
            await promptText(
              renderQuestionHeader(
                2,
                2,
                "Workspace",
                `Which parent directory should contain this project?\nLongTable will create this folder:\n${suggestedPath}`
              ),
              true
            )
          )!,
          projectName
        ))!;

  const adaptive = skipResearchInterview
    ? {}
    : await collectAdaptiveStartInterview({
        currentGoal: providedGoal,
        currentBlocker: providedBlocker,
        needsResearchSeed:
          !providedGoal ||
          !providedBlocker ||
          !providedResearchObject ||
          !providedGapRisk ||
          !providedProtectedDecision
      });

  const currentGoal = providedGoal ?? adaptive.currentGoal;
  if (!currentGoal?.trim()) {
    throw new Error("LongTable start needs a current research goal or an opening interview answer.");
  }

  const currentBlocker = providedBlocker ?? adaptive.currentBlocker;
  const researchObject = providedResearchObject ?? adaptive.inferredResearchObject;
  const gapRisk = providedGapRisk ?? adaptive.inferredGapRisk;
  const protectedDecision = providedProtectedDecision ?? adaptive.inferredProtectedDecision;
  const disagreementPreference = (
    typeof args.disagreement === "string" && args.disagreement.trim()
      ? args.disagreement.trim()
      : setup.profileSeed.panelPreference ?? "show_on_conflict"
  ) as ProjectDisagreementPreference;

  return {
    projectName: projectName.trim(),
    projectPath: projectPath.trim(),
    currentGoal: currentGoal.trim(),
    ...(currentBlocker?.trim() ? { currentBlocker: currentBlocker.trim() } : {}),
    ...(researchObject?.trim() ? { researchObject: researchObject.trim() } : {}),
    ...(gapRisk?.trim() ? { gapRisk: gapRisk.trim() } : {}),
    ...(protectedDecision?.trim() ? { protectedDecision: protectedDecision.trim() } : {}),
    ...(adaptive.startInterview ? { startInterview: adaptive.startInterview } : {}),
    requestedPerspectives: providedPerspectives,
    disagreementPreference
  };
}

function normalizePersistAnswers(raw: CodexPersistAnswers): {
  flow: SetupFlow;
  provider: "codex" | "claude";
  answers: SetupAnswers;
} {
  return {
    flow: raw.flow === "interview" ? "interview" : "quickstart",
    provider: raw.provider === "claude" ? "claude" : "codex",
    answers: {
      field: raw.field?.trim() ? raw.field.trim() : "unspecified",
      careerStage: raw.careerStage,
      experienceLevel: raw.experienceLevel,
      currentProjectType: "unspecified research task",
      preferredCheckpointIntensity: raw.preferredCheckpointIntensity,
      ...(raw.humanAuthorshipSignal?.trim()
        ? { humanAuthorshipSignal: raw.humanAuthorshipSignal.trim() }
        : {}),
      ...(raw.preferredEntryMode
        ? { preferredEntryMode: raw.preferredEntryMode }
        : {}),
      ...(raw.weakestDomain
        ? { weakestDomain: raw.weakestDomain }
        : {}),
      ...(raw.panelPreference
        ? { panelPreference: raw.panelPreference }
        : {})
    }
  };
}

async function readPersistAnswers(args: Record<string, string | boolean>): Promise<{
  flow: SetupFlow;
  provider: "codex" | "claude";
  answers: SetupAnswers;
}> {
  if (typeof args["answers-json"] === "string") {
    const normalized = normalizePersistAnswers(JSON.parse(args["answers-json"]));
    return {
      ...normalized,
      flow: typeof args.flow === "string" ? resolveSetupFlow(args) : normalized.flow
    };
  }

  if (args.stdin === true) {
    const raw = readFileSync(0, "utf8").trim();
    if (!raw) {
      throw new Error("No JSON was provided on stdin.");
    }
    return normalizePersistAnswers(JSON.parse(raw));
  }

  if (hasCompleteFlagInput(args)) {
    return {
      flow: resolveSetupFlow(args),
      provider: String(args.provider) === "claude" ? "claude" : "codex",
      answers: toSetupAnswers(args)
    };
  }

  throw new Error("persist-init requires either --answers-json, --stdin, or the full set of setup flags.");
}

async function runInit(args: Record<string, string | boolean>): Promise<void> {
  if (!hasCompleteFlagInput(args)) {
    console.error("`longtable init` is deprecated. Use `longtable setup` for permission-first runtime setup.");
    await runSetup(args);
    return;
  }

  const json = args.json === true;
  const installRuntime = args["no-install"] !== true;
  const installPrompts = args["install-prompts"] === true;
  const installSkills = args["install-skills"] === true;
  const customPath = typeof args.path === "string" ? args.path : undefined;
  const runtimePath = typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined;
  const promptsDir = typeof args.dir === "string" ? args.dir : undefined;
  const skillsDir = typeof args["skills-dir"] === "string" ? args["skills-dir"] : promptsDir;

  const { flow, provider, answers } = hasCompleteFlagInput(args)
    ? {
        flow: resolveSetupFlow(args),
        provider: String(args.provider) === "claude" ? "claude" as const : "codex" as const,
        answers: toSetupAnswers(args)
      }
    : await collectInteractiveAnswers(typeof args.flow === "string" ? resolveSetupFlow(args) : undefined);

  const outputValue = createPersistedSetupOutput(answers, provider, flow);
  const result = await saveSetupAndRuntimeConfig(outputValue, {
    setupPath: customPath,
    runtimePath
  });

  let installedPrompts = [] as Awaited<ReturnType<typeof installCodexPromptAliases>>;
  if (provider === "codex" && installPrompts) {
    installedPrompts = await installCodexPromptAliases(promptsDir);
  }
  let installedSkills: Array<{ name: string; path: string; description: string }> = [];
  if (provider === "codex" && installSkills) {
    installedSkills = await installCodexSkills(listRoleDefinitions(), skillsDir);
  }
  if (provider === "claude" && installSkills) {
    installedSkills = await installClaudeSkills(listRoleDefinitions(), skillsDir);
  }

  if (json) {
    if (installedPrompts.length === 0 && installedSkills.length === 0) {
      console.log(serializeSetupOutput(outputValue));
      return;
    }

    console.log(
      JSON.stringify(
        {
          setup: outputValue,
          installedPrompts: installedPrompts.map((prompt) => prompt.name),
          installedSkills: installedSkills.map((skill) => skill.name)
        },
        null,
        2
      )
    );
    return;
  }

  console.log(renderSetupSummary(outputValue));
  if (installRuntime) {
    console.log("");
    console.log(renderInstallSummary(result));
  }
  if (installedPrompts.length > 0) {
    console.log("");
    console.log("Installed Codex prompt files:");
    for (const prompt of installedPrompts) {
      console.log(`- ${prompt.name}`);
    }
    console.log("  Note: prompt files are legacy and may not be exposed by your Codex build.");
  }
  if (installedSkills.length > 0) {
    console.log("");
    console.log(`Installed ${provider === "codex" ? "Codex" : "Claude"} skill files:`);
    for (const skill of installedSkills) {
      console.log(`- ${skill.name}`);
    }
    console.log("  Use these by naming LongTable naturally, e.g. `lt panel: ...`.");
  }

  if (provider === "codex") {
    console.log("");
    console.log("Next step:");
    console.log("- Start here: `longtable start`.");
    console.log("- If you want a direct natural-language entry: `longtable ask --prompt \"...\"`.");
    console.log("- Codex skills are the preferred native surface. Prompt files are legacy and may not expose slash commands.");
    console.log("- Suggested next action: create a project workspace and let LongTable interview the current session.");
  }
  if (provider === "claude") {
    console.log("");
    console.log("Next step:");
    console.log("- Start here: `longtable start`.");
    console.log("- In Claude Code, use natural language such as `lt explore: ...` or `lt panel: ...`.");
    console.log("- Claude skills are adapter output from LongTable roles, not the source of truth.");
  }
}

async function runShow(args: Record<string, string | boolean>): Promise<void> {
  const outputValue = await loadSetupOutput(typeof args.path === "string" ? args.path : undefined);
  if (args.json === true) {
    console.log(serializeSetupOutput(outputValue));
    return;
  }
  console.log(renderSetupSummary(outputValue));
}

async function runInstall(args: Record<string, string | boolean>): Promise<void> {
  const result = await installRuntimeConfigFromStoredSetup({
    setupPath: typeof args.path === "string" ? args.path : undefined,
    runtimePath: typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined
  });
  if (args.json === true) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(renderInstallSummary(result));
}

function resolveMcpProviders(value?: string | boolean): McpProviderTarget[] {
  if (value === "codex" || value === "claude") {
    return [value];
  }
  return ["codex", "claude"];
}

function resolveMcpPackageSpec(args: Record<string, string | boolean>): string {
  return typeof args.package === "string" && args.package.trim()
    ? args.package.trim()
    : `@longtable/mcp@${LONGTABLE_MCP_PACKAGE_VERSION}`;
}

function resolveCodexMcpConfigPath(args: Record<string, string | boolean>): string {
  return resolve(
    normalizeUserPath(
      typeof args["codex-config"] === "string" && args["codex-config"].trim()
        ? args["codex-config"].trim()
        : "~/.codex/config.toml"
    )
  );
}

function resolveCodexHooksPath(args: Record<string, string | boolean>): string {
  if (typeof args["hooks-path"] === "string" && args["hooks-path"].trim()) {
    return resolve(normalizeUserPath(args["hooks-path"]));
  }

  const configPath = resolveCodexMcpConfigPath(args);
  return resolve(dirname(configPath), "hooks.json");
}

function resolveCliPackageRoot(): string {
  return resolve(fileURLToPath(new URL("..", import.meta.url)));
}

function resolveClaudeMcpSettingsPath(args: Record<string, string | boolean>): string {
  return resolve(
    normalizeUserPath(
      typeof args["claude-settings"] === "string" && args["claude-settings"].trim()
        ? args["claude-settings"].trim()
        : "~/.claude/settings.json"
    )
  );
}

function escapeTomlString(value: string): string {
  return JSON.stringify(value);
}

function renderCodexMcpBlock(serverName: string, command: string, mcpArgs: string[]): string {
  return [
    LONGTABLE_MCP_MARKER_START,
    `[mcp_servers.${serverName}]`,
    `command = ${escapeTomlString(command)}`,
    `args = [${mcpArgs.map((arg) => escapeTomlString(arg)).join(", ")}]`,
    LONGTABLE_MCP_MARKER_END
  ].join("\n");
}

function codexElicitationApprovalLine(): string {
  return "approval_policy = { granular = { sandbox_approval = false, rules = false, mcp_elicitations = true } }";
}

function enableCodexMcpElicitations(existing: string): string {
  const line = codexElicitationApprovalLine();
  if (/approval_policy\s*=\s*\{[^\n]*mcp_elicitations\s*=\s*true[^\n]*\}/m.test(existing)) {
    return existing;
  }
  if (/^approval_policy\s*=.*$/m.test(existing)) {
    return existing.replace(/^approval_policy\s*=.*$/m, line);
  }
  const trimmed = existing.trimEnd();
  return trimmed ? `${line}\n${trimmed}\n` : `${line}\n`;
}

function codexMcpElicitationsAllowed(config: string): boolean {
  return /approval_policy\s*=\s*\{[^\n]*mcp_elicitations\s*=\s*true[^\n]*\}/m.test(config);
}

function codexLongTableMcpConfigured(config: string): boolean {
  return new RegExp(`\\[mcp_servers\\.${LONGTABLE_MCP_SERVER_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`).test(config);
}

function replaceMarkedCodexMcpBlock(existing: string, block: string, serverName: string): string {
  const markerPattern = new RegExp(
    `${LONGTABLE_MCP_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${LONGTABLE_MCP_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
    "m"
  );
  const serverPattern = new RegExp(
    `\\n?\\[mcp_servers\\.${serverName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\][\\s\\S]*?(?=\\n\\[|$)`,
    "m"
  );
  const trimmed = existing.replace(markerPattern, "").replace(serverPattern, "").trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

async function writeCodexMcpConfig(
  path: string,
  block: string,
  serverName: string,
  options: { enableElicitations?: boolean } = {}
): Promise<string> {
  const existing = existsSync(path) ? await readFile(path, "utf8") : "";
  const withMcp = replaceMarkedCodexMcpBlock(existing, block, serverName);
  const updated = options.enableElicitations ? enableCodexMcpElicitations(withMcp) : withMcp;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, updated, "utf8");
  return updated;
}

function renderClaudeMcpJson(serverName: string, command: string, mcpArgs: string[]): string {
  return JSON.stringify(
    {
      mcpServers: {
        [serverName]: {
          command,
          args: mcpArgs
        }
      }
    },
    null,
    2
  );
}

async function writeClaudeMcpSettings(path: string, serverName: string, command: string, mcpArgs: string[]): Promise<string> {
  let settings: Record<string, unknown> = {};
  if (existsSync(path)) {
    const raw = await readFile(path, "utf8");
    settings = raw.trim() ? JSON.parse(raw) as Record<string, unknown> : {};
  }
  const existingServers =
    typeof settings.mcpServers === "object" && settings.mcpServers !== null && !Array.isArray(settings.mcpServers)
      ? settings.mcpServers as Record<string, unknown>
      : {};
  settings.mcpServers = {
    ...existingServers,
    [serverName]: {
      command,
      args: mcpArgs
    }
  };
  const updated = JSON.stringify(settings, null, 2);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${updated}\n`, "utf8");
  return `${updated}\n`;
}

async function installCodexNativeHooks(
  args: Record<string, string | boolean>
): Promise<CodexHookInstallResult> {
  const configPath = resolveCodexMcpConfigPath(args);
  const hooksPath = resolveCodexHooksPath(args);
  const packageRoot = resolveCliPackageRoot();
  const existingConfig = existsSync(configPath) ? await readFile(configPath, "utf8") : "";
  const existingHooks = existsSync(hooksPath) ? await readFile(hooksPath, "utf8") : "";
  const nextConfig = enableCodexHooksFeature(existingConfig);
  const nextHooks = mergeManagedCodexHooksConfig(existingHooks, packageRoot);

  await mkdir(dirname(configPath), { recursive: true });
  await mkdir(dirname(hooksPath), { recursive: true });
  await writeFile(configPath, nextConfig, "utf8");
  await writeFile(hooksPath, nextHooks, "utf8");

  return {
    configPath,
    hooksPath,
    codexHooksEnabled: codexHooksEnabled(nextConfig),
    managedEvents: [...LONGTABLE_MANAGED_HOOK_EVENTS],
    write: true
  };
}

async function removeCodexNativeHooks(
  args: Record<string, string | boolean>
): Promise<CodexHookInstallResult> {
  const configPath = resolveCodexMcpConfigPath(args);
  const hooksPath = resolveCodexHooksPath(args);
  const existingHooks = existsSync(hooksPath) ? await readFile(hooksPath, "utf8") : "";
  const removed = existingHooks ? removeManagedCodexHooks(existingHooks) : { nextContent: null, removedCount: 0 };

  if (removed.nextContent === null) {
    await rm(hooksPath, { force: true });
  } else {
    await mkdir(dirname(hooksPath), { recursive: true });
    await writeFile(hooksPath, removed.nextContent, "utf8");
  }

  const configContent = existsSync(configPath) ? await readFile(configPath, "utf8") : "";

  return {
    configPath,
    hooksPath,
    codexHooksEnabled: codexHooksEnabled(configContent),
    managedEvents: removed.removedCount > 0 ? [...LONGTABLE_MANAGED_HOOK_EVENTS] : [],
    write: true
  };
}

function renderCodexHookInstallSummary(result: CodexHookInstallResult): string {
  return [
    "LongTable Codex hooks",
    `- config: ${result.configPath}`,
    `- hooks: ${result.hooksPath}`,
    `- codex_hooks feature: ${result.codexHooksEnabled ? "enabled" : "missing"}`,
    `- managed events: ${result.managedEvents.length > 0 ? result.managedEvents.join(", ") : "none"}`
  ].join("\n");
}

function renderMcpInstallSummary(result: McpInstallResult): string {
  const lines = [
    "LongTable MCP transport",
    `- server: ${result.serverName}`,
    `- package: ${result.packageSpec}`,
    `- command: ${result.command} ${result.args.join(" ")}`,
    `- mode: ${result.write ? "wrote provider config" : "printed config only"}`,
    ...(result.checkpointUi && checkpointUiRequiresMcp(result.checkpointUi)
      ? [`- Codex checkpoint UI: ${result.checkpointUi} (MCP elicitations allowed)`]
      : []),
    ""
  ];

  for (const target of result.targets) {
    lines.push(`${target.provider} (${target.path})`);
    lines.push("```" + target.format);
    lines.push(target.content.trimEnd());
    lines.push("```");
    lines.push("");
  }

  if (!result.write) {
    lines.push("Run again with `--write` to update these provider config files.");
  }
  if (result.checkpointUi && checkpointUiRequiresMcp(result.checkpointUi)) {
    lines.push("Restart Codex after changing MCP elicitation approval, then run `longtable doctor`.");
  }
  return lines.join("\n").trimEnd();
}

async function installMcpForSetup(
  provider: McpProviderTarget,
  args: Record<string, string | boolean>
): Promise<McpInstallResult> {
  const serverName =
    typeof args.name === "string" && args.name.trim()
      ? args.name.trim()
      : LONGTABLE_MCP_SERVER_NAME;
  const packageSpec = resolveMcpPackageSpec(args);
  const command = typeof args.command === "string" && args.command.trim() ? args.command.trim() : "npx";
  const mcpArgs = command === "npx" ? ["-y", packageSpec] : [packageSpec];
  const checkpointUi = parseSetupCheckpointUi(args["checkpoint-ui"]) ?? "off";
  const targets: McpInstallTarget[] = [];

  if (provider === "codex") {
    const path = resolveCodexMcpConfigPath(args);
    const block = renderCodexMcpBlock(serverName, command, mcpArgs);
    const content = await writeCodexMcpConfig(path, block, serverName, {
      enableElicitations: checkpointUiRequiresMcp(checkpointUi)
    });
    targets.push({ provider, path, format: "toml", content });
  }

  if (provider === "claude") {
    const path = resolveClaudeMcpSettingsPath(args);
    const content = await writeClaudeMcpSettings(path, serverName, command, mcpArgs);
    targets.push({ provider, path, format: "json", content });
  }

  return {
    serverName,
    packageSpec,
    command,
    args: mcpArgs,
    write: true,
    checkpointUi,
    targets
  };
}

async function runMcpSubcommand(
  subcommand: string | undefined,
  args: Record<string, string | boolean>
): Promise<void> {
  if (!subcommand || subcommand === "install" || subcommand === "print-config") {
    const serverName =
      typeof args.name === "string" && args.name.trim()
        ? args.name.trim()
        : LONGTABLE_MCP_SERVER_NAME;
    const packageSpec = resolveMcpPackageSpec(args);
    const command = typeof args.command === "string" && args.command.trim() ? args.command.trim() : "npx";
    const mcpArgs = command === "npx" ? ["-y", packageSpec] : [packageSpec];
    const providers = resolveMcpProviders(args.provider);
    const write = args.write === true;
    const checkpointUi = parseSetupCheckpointUi(args["checkpoint-ui"]) ?? "off";
    if (checkpointUiRequiresMcp(checkpointUi) && !providers.includes("codex")) {
      throw new Error("`--checkpoint-ui interactive|strong` applies only to the Codex MCP provider.");
    }
    const targets: McpInstallTarget[] = [];

    for (const provider of providers) {
      if (provider === "codex") {
        const path = resolveCodexMcpConfigPath(args);
        const block = renderCodexMcpBlock(serverName, command, mcpArgs);
        const content = write
          ? await writeCodexMcpConfig(path, block, serverName, {
            enableElicitations: checkpointUiRequiresMcp(checkpointUi)
          })
          : checkpointUiRequiresMcp(checkpointUi)
            ? enableCodexMcpElicitations(block)
            : block;
        targets.push({ provider, path, format: "toml", content });
      }
      if (provider === "claude") {
        const path = resolveClaudeMcpSettingsPath(args);
        const content = write
          ? await writeClaudeMcpSettings(path, serverName, command, mcpArgs)
          : renderClaudeMcpJson(serverName, command, mcpArgs);
        targets.push({ provider, path, format: "json", content });
      }
    }

    const result: McpInstallResult = {
      serverName,
      packageSpec,
      command,
      args: mcpArgs,
      write,
      checkpointUi,
      targets
    };

    if (args.json === true) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(renderMcpInstallSummary(result));
    return;
  }

  throw new Error("Unknown mcp subcommand.");
}

function commandOnPath(command: "codex" | "claude"): boolean {
  try {
    execSync(`command -v ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function missingNames(expected: string[], installed: string[]): string[] {
  const installedSet = new Set(installed);
  return expected.filter((name) => !installedSet.has(name));
}

function resolveDoctorCodexMcpConfigPath(args: Record<string, string | boolean>): string {
  if (typeof args["codex-config"] === "string" && args["codex-config"].trim()) {
    return resolve(normalizeUserPath(args["codex-config"].trim()));
  }
  const projectScoped = join(typeof args.cwd === "string" ? resolve(args.cwd) : cwd(), ".codex", "config.toml");
  return existsSync(projectScoped) ? projectScoped : resolveCodexMcpConfigPath(args);
}

function setupForProvider(
  setup: SetupPersistedOutput,
  provider: ProviderKind
): SetupPersistedOutput {
  return {
    ...setup,
    providerSelection: provider === "claude"
      ? {
          provider,
          checkpointProtocol: "native_structured",
          supportsStructuredQuestions: true
        }
      : {
          provider,
          checkpointProtocol: "numbered",
          supportsStructuredQuestions: false
        }
  };
}

async function collectDoctorStatus(args: Record<string, string | boolean>): Promise<LongTableDoctorStatus> {
  const roles = listRoleDefinitions();
  const skillSurface = parseSkillSurface(args);
  const setupOverride = typeof args.setup === "string"
    ? args.setup
    : typeof args.path === "string"
      ? args.path
      : undefined;
  const setupPath = resolveDefaultSetupPath(setupOverride).path;
  const codexRuntimeOverride = typeof args["codex-runtime-path"] === "string"
    ? args["codex-runtime-path"]
    : undefined;
  const claudeRuntimeOverride = typeof args["claude-runtime-path"] === "string"
    ? args["claude-runtime-path"]
    : undefined;
  const codexDir = typeof args["codex-dir"] === "string"
    ? args["codex-dir"]
    : typeof args.dir === "string"
      ? args.dir
      : undefined;
  const codexPromptsDir = typeof args["codex-prompts-dir"] === "string"
    ? args["codex-prompts-dir"]
    : typeof args["prompts-dir"] === "string"
      ? args["prompts-dir"]
      : typeof args.dir === "string"
        ? args.dir
        : undefined;
  const claudeDir = typeof args["claude-dir"] === "string"
    ? args["claude-dir"]
    : typeof args.dir === "string"
      ? args.dir
      : undefined;
  const codexRuntimePath = resolveDefaultRuntimeConfigPath("codex", codexRuntimeOverride).path;
  const claudeRuntimePath = resolveDefaultRuntimeConfigPath("claude", claudeRuntimeOverride).path;
  const codexMcpConfigPath = resolveDoctorCodexMcpConfigPath(args);
  const codexMcpConfig = existsSync(codexMcpConfigPath)
    ? await readFile(codexMcpConfigPath, "utf8")
    : "";
  const codexHooksPath = resolveCodexHooksPath(args);
  const codexHooksContent = existsSync(codexHooksPath)
    ? await readFile(codexHooksPath, "utf8")
    : "";
  const missingManagedHookEvents = codexHooksContent
    ? (getMissingManagedCodexHookEvents(codexHooksContent) ?? [...LONGTABLE_MANAGED_HOOK_EVENTS])
    : [...LONGTABLE_MANAGED_HOOK_EVENTS];
  const expectedCodexSkills = buildCodexSkillSpecs(roles, skillSurface).map((skill) => skill.name);
  const expectedClaudeSkills = buildClaudeSkillSpecs(roles, skillSurface).map((skill) => skill.name);
  const [codexSkills, claudeSkills, codexAliases, workspace] = await Promise.all([
    listInstalledCodexSkills(roles, codexDir, skillSurface),
    listInstalledClaudeSkills(roles, claudeDir, skillSurface),
    listInstalledCodexPromptAliases(codexPromptsDir),
    inspectProjectWorkspace(typeof args.cwd === "string" ? args.cwd : cwd())
  ]);
  const installedCodexSkills = codexSkills.map((skill) => skill.name);
  const installedClaudeSkills = claudeSkills.map((skill) => skill.name);

  return {
    setupPath,
    setupExists: existsSync(setupPath),
    providers: {
      codex: {
        command: "codex",
        commandOnPath: commandOnPath("codex"),
        runtimePath: codexRuntimePath,
        runtimeExists: existsSync(codexRuntimePath),
        skillsDir: resolveCodexSkillsDir(codexDir),
        expectedSkills: expectedCodexSkills,
        installedSkills: installedCodexSkills,
        missingSkills: missingNames(expectedCodexSkills, installedCodexSkills),
        promptsDir: resolveCodexPromptsDir(codexPromptsDir),
        legacyPromptFilesInstalled: codexAliases.map((alias) => alias.name),
        mcpConfigPath: codexMcpConfigPath,
        mcpConfigExists: existsSync(codexMcpConfigPath),
        longtableMcpConfigured: codexLongTableMcpConfigured(codexMcpConfig),
        mcpElicitationsAllowed: codexMcpElicitationsAllowed(codexMcpConfig),
        hooksPath: codexHooksPath,
        hooksExists: existsSync(codexHooksPath),
        codexHooksEnabled: codexHooksEnabled(codexMcpConfig),
        missingManagedHookEvents
      },
      claude: {
        command: "claude",
        commandOnPath: commandOnPath("claude"),
        runtimePath: claudeRuntimePath,
        runtimeExists: existsSync(claudeRuntimePath),
        skillsDir: resolveClaudeSkillsDir(claudeDir),
        expectedSkills: expectedClaudeSkills,
        installedSkills: installedClaudeSkills,
        missingSkills: missingNames(expectedClaudeSkills, installedClaudeSkills)
      }
    },
    workspace
  };
}

function renderProviderDoctorBlock(label: string, provider: ProviderSkillHealth): string[] {
  const expectedCount = provider.expectedSkills.length;
  const installedCount = provider.installedSkills.length;
  return [
    `${label}:`,
    `- command: ${provider.commandOnPath ? "present" : "missing"} (${provider.command})`,
    `- runtime artifact: ${provider.runtimeExists ? "present" : "missing"} (${provider.runtimePath})`,
    `- skills: ${installedCount}/${expectedCount} installed (${provider.skillsDir})`,
    ...(provider.missingSkills.length > 0
      ? [`- missing skills: ${provider.missingSkills.join(", ")}`]
      : ["- missing skills: none"])
  ];
}

function renderDoctorStatus(status: LongTableDoctorStatus): string {
  const lines = [
    "LongTable doctor",
    `- setup: ${status.setupExists ? "present" : "missing"} (${status.setupPath})`,
    "",
    ...renderProviderDoctorBlock("Codex", status.providers.codex),
    `- legacy prompt files: ${status.providers.codex.legacyPromptFilesInstalled.length}`,
    ...(status.providers.codex.legacyPromptFilesInstalled.length > 0
      ? [`- legacy prompt names: ${status.providers.codex.legacyPromptFilesInstalled.join(", ")}`]
      : []),
    `- MCP config: ${status.providers.codex.mcpConfigExists ? "present" : "missing"} (${status.providers.codex.mcpConfigPath})`,
    `- LongTable MCP: ${status.providers.codex.longtableMcpConfigured ? "configured" : "missing"}`,
    `- MCP elicitation approval: ${status.providers.codex.mcpElicitationsAllowed ? "allowed" : "not allowed"}`,
    `- Codex hooks file: ${status.providers.codex.hooksExists ? "present" : "missing"} (${status.providers.codex.hooksPath})`,
    `- codex_hooks feature: ${status.providers.codex.codexHooksEnabled ? "enabled" : "missing"}`,
    `- managed hook coverage: ${status.providers.codex.missingManagedHookEvents.length === 0 ? "complete" : `missing ${status.providers.codex.missingManagedHookEvents.join(", ")}`}`,
    "",
    ...renderProviderDoctorBlock("Claude", status.providers.claude),
    "",
    "Workspace:"
  ];

  if (!status.workspace.found) {
    lines.push("- project: not found from current directory");
  } else {
    const workspace = status.workspace;
    lines.push(
      `- project: ${workspace.project?.name ?? "unknown"}`,
      `- root: ${workspace.rootPath ?? "unknown"}`,
      `- goal: ${workspace.session?.currentGoal ?? "unknown"}`,
      `- invocations: ${workspace.counts?.invocations ?? 0}`,
      `- questions: ${workspace.counts?.questions ?? 0} (${workspace.counts?.pendingQuestions ?? 0} pending, ${workspace.counts?.answeredQuestions ?? 0} answered)`,
      `- obligations: ${workspace.counts?.pendingObligations ?? 0} pending`,
      `- decisions: ${workspace.counts?.decisions ?? 0}`
    );
    if ((workspace.recentInvocations ?? []).length > 0) {
      lines.push("- recent invocations:");
      for (const invocation of workspace.recentInvocations ?? []) {
        const roles = invocation.roles.length > 0 ? invocation.roles.join(",") : "auto";
        lines.push(`  - ${invocation.kind}/${invocation.mode} via ${invocation.surface}: ${roles} (${invocation.status})`);
      }
    }
    if ((workspace.pendingQuestions ?? []).length > 0) {
      lines.push("- pending questions:");
      for (const question of workspace.pendingQuestions ?? []) {
        lines.push(`  - ${question.id}: ${question.question} (${question.options.join("/")})`);
      }
    }
    if ((workspace.pendingObligations ?? []).length > 0) {
      lines.push("- pending obligations:");
      for (const obligation of workspace.pendingObligations ?? []) {
        lines.push(`  - ${obligation.id}: ${obligation.prompt}`);
      }
    }
    if ((workspace.answerWarnings ?? []).length > 0) {
      lines.push("- answer warnings:");
      for (const warning of workspace.answerWarnings ?? []) {
        lines.push(`  - ${warning.questionId}: ${warning.issue}`);
        if (warning.suggestion) {
          lines.push(`    ${warning.suggestion}`);
        }
      }
    }
  }

  const nextActions: string[] = [];
  const canFix =
    status.providers.codex.missingSkills.length > 0 ||
    status.providers.claude.missingSkills.length > 0 ||
    status.providers.codex.legacyPromptFilesInstalled.length > 0 ||
    !status.providers.codex.codexHooksEnabled ||
    status.providers.codex.missingManagedHookEvents.length > 0 ||
    (status.setupExists &&
      (!status.providers.codex.runtimeExists || !status.providers.claude.runtimeExists));

  if (canFix) {
    nextActions.push("longtable doctor --fix");
  }
  if (!status.providers.codex.codexHooksEnabled || status.providers.codex.missingManagedHookEvents.length > 0) {
    nextActions.push("longtable codex install-hooks");
  }
  if (!status.setupExists) {
    nextActions.push("longtable setup --provider codex");
  }
  if (!status.workspace.found) {
    nextActions.push("longtable start");
  }
  const firstQuestion = status.workspace.pendingQuestions?.[0];
  if (firstQuestion) {
    nextActions.push(`longtable decide --question ${firstQuestion.id} --answer <value>`);
  }

  if (nextActions.length > 0) {
    lines.push("", "Next actions:");
    for (const action of nextActions) {
      lines.push(`- ${action}`);
    }
  }

  return lines.join("\n");
}

function renderRepairSummary(repair: DoctorRepairResult): string {
  const lines = ["LongTable doctor repair"];
  if (repair.installedCodexSkills.length > 0) {
    lines.push(`- installed Codex skills: ${repair.installedCodexSkills.length}`);
  }
  if (repair.installedClaudeSkills.length > 0) {
    lines.push(`- installed Claude skills: ${repair.installedClaudeSkills.length}`);
  }
  if (repair.removedLegacyPromptFiles.length > 0) {
    lines.push(`- removed legacy prompt files: ${repair.removedLegacyPromptFiles.length}`);
  }
  if (repair.installedCodexHooks) {
    lines.push("- installed Codex native hooks");
  }
  if ((repair.repairedWorkspaceState ?? []).length > 0) {
    lines.push("- repaired workspace state:");
    for (const item of repair.repairedWorkspaceState ?? []) {
      lines.push(`  - ${item}`);
    }
  }
  if (repair.writtenRuntimeConfigs.length > 0) {
    lines.push("- wrote runtime configs:");
    for (const target of repair.writtenRuntimeConfigs) {
      lines.push(`  - ${target.provider}: ${target.path}`);
    }
  }
  if (repair.skipped.length > 0) {
    lines.push("- skipped:");
    for (const item of repair.skipped) {
      lines.push(`  - ${item}`);
    }
  }
  if (lines.length === 1) {
    lines.push("- no repairs needed");
  }
  return lines.join("\n");
}

async function repairDoctorStatus(
  args: Record<string, string | boolean>,
  status: LongTableDoctorStatus
): Promise<DoctorRepairResult> {
  const roles = listRoleDefinitions();
  const skillSurface = parseSkillSurface(args);
  const codexDir = typeof args["codex-dir"] === "string"
    ? args["codex-dir"]
    : typeof args.dir === "string"
      ? args.dir
      : undefined;
  const codexPromptsDir = typeof args["codex-prompts-dir"] === "string"
    ? args["codex-prompts-dir"]
    : typeof args["prompts-dir"] === "string"
      ? args["prompts-dir"]
      : typeof args.dir === "string"
        ? args.dir
        : undefined;
  const claudeDir = typeof args["claude-dir"] === "string"
    ? args["claude-dir"]
    : typeof args.dir === "string"
      ? args.dir
      : undefined;
  const setupOverride = typeof args.setup === "string"
    ? args.setup
    : typeof args.path === "string"
      ? args.path
      : undefined;
  const codexRuntimeOverride = typeof args["codex-runtime-path"] === "string"
    ? args["codex-runtime-path"]
    : undefined;
  const claudeRuntimeOverride = typeof args["claude-runtime-path"] === "string"
    ? args["claude-runtime-path"]
    : undefined;

  const repair: DoctorRepairResult = {
    installedCodexSkills: [],
    installedClaudeSkills: [],
    removedLegacyPromptFiles: [],
    installedCodexHooks: false,
    repairedWorkspaceState: [],
    writtenRuntimeConfigs: [],
    skipped: []
  };

  if (status.providers.codex.missingSkills.length > 0) {
    repair.installedCodexSkills = (await installCodexSkills(roles, codexDir, skillSurface)).map((skill) => skill.name);
  }
  if (status.providers.claude.missingSkills.length > 0) {
    repair.installedClaudeSkills = (await installClaudeSkills(roles, claudeDir, skillSurface)).map((skill) => skill.name);
  }
  if (status.providers.codex.legacyPromptFilesInstalled.length > 0) {
    repair.removedLegacyPromptFiles = await removeCodexPromptAliases(codexPromptsDir);
  }
  if (!status.providers.codex.codexHooksEnabled || status.providers.codex.missingManagedHookEvents.length > 0) {
    await installCodexNativeHooks(args);
    repair.installedCodexHooks = true;
  }

  if (!status.setupExists) {
    repair.skipped.push("runtime configs require setup approval; run `longtable setup --provider codex` first");
    const workspaceContext = await loadProjectContextFromDirectory(typeof args.cwd === "string" ? args.cwd : cwd());
    if (workspaceContext) {
      repair.repairedWorkspaceState = (await repairWorkspaceStateConsistency({ context: workspaceContext })).repaired;
    }
    return repair;
  }

  const setup = await loadSetupOutput(setupOverride);
  if (!status.providers.codex.runtimeExists) {
    const target = await writeRuntimeConfig(
      setupForProvider(setup, "codex"),
      status.setupPath,
      codexRuntimeOverride
    );
    repair.writtenRuntimeConfigs.push({
      provider: target.provider,
      path: target.path,
      format: target.format
    });
  }
  if (!status.providers.claude.runtimeExists) {
    const target = await writeRuntimeConfig(
      setupForProvider(setup, "claude"),
      status.setupPath,
      claudeRuntimeOverride
    );
    repair.writtenRuntimeConfigs.push({
      provider: target.provider,
      path: target.path,
      format: target.format
    });
  }

  const workspaceContext = await loadProjectContextFromDirectory(typeof args.cwd === "string" ? args.cwd : cwd());
  if (workspaceContext) {
    repair.repairedWorkspaceState = (await repairWorkspaceStateConsistency({ context: workspaceContext })).repaired;
  }

  return repair;
}

async function runDoctor(args: Record<string, string | boolean>): Promise<void> {
  const status = await collectDoctorStatus(args);
  if (args.fix === true) {
    const repair = await repairDoctorStatus(args, status);
    const updatedStatus = await collectDoctorStatus(args);
    if (args.json === true) {
      console.log(JSON.stringify({ repair, status: updatedStatus }, null, 2));
      return;
    }
    console.log(renderRepairSummary(repair));
    console.log("");
    console.log(renderDoctorStatus(updatedStatus));
    return;
  }

  if (args.json === true) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  console.log(renderDoctorStatus(status));
}

const QUESTION_AUDIT_FIXTURES: Array<{
  id: string;
  prompt: string;
  expectedKinds: QuestionOpportunityKind[];
}> = [
  {
    id: "harness_philosophy",
    prompt: "LongTable 훅과 체크포인트가 연구자의 철학에 맞는지, 질문을 멈춰야 하는 지점에서 생성하는지 평가해줘.",
    expectedKinds: ["harness_design", "question_policy", "philosophical_reflection"]
  },
  {
    id: "all_needed_questions",
    prompt: "매번 내가 필요한 질문을 해줘 라고 하지 않아도 필요한 질문을 모두 하는 에이전트로 만들고 싶어.",
    expectedKinds: ["question_policy"]
  },
  {
    id: "trust_calibration_construct",
    prompt: "Trust calibration에서 subjective trust와 reliance, switch to AI를 같은 측정으로 봐도 되는지 검토해줘.",
    expectedKinds: ["research_commitment"]
  },
  {
    id: "tacit_assumption",
    prompt: "이 계획에는 말하지 않은 전제와 암묵적 가정이 있는 것 같아.",
    expectedKinds: ["tacit_assumption"]
  },
  {
    id: "protected_decision_closure",
    prompt: "Protected decision closure pressure: measurement. User prompt: Implement the plan.",
    expectedKinds: ["research_commitment"]
  },
  {
    id: "low_stakes_copyedit",
    prompt: "문장 끝 공백만 정리해줘.",
    expectedKinds: []
  }
];

function runQuestionAudit(): QuestionAuditResult {
  const fixtures = QUESTION_AUDIT_FIXTURES.map((fixture) => {
    const opportunities = buildQuestionOpportunitySpecs(fixture.prompt, {
      includeFallback: false,
      autoOnly: true
    });
    const observedKinds = [...new Set(opportunities.map((opportunity) => opportunity.kind))];
    const failures = fixture.expectedKinds
      .filter((kind) => !observedKinds.includes(kind))
      .map((kind) => `missing expected question kind: ${kind}`);
    if (fixture.expectedKinds.length === 0 && observedKinds.length > 0) {
      failures.push(`expected no auto questions, observed: ${observedKinds.join(", ")}`);
    }
    return {
      id: fixture.id,
      prompt: fixture.prompt,
      expectedKinds: fixture.expectedKinds,
      observedKinds,
      passed: failures.length === 0,
      failures
    };
  });
  const passedCount = fixtures.filter((fixture) => fixture.passed).length;
  return {
    passed: passedCount === fixtures.length,
    fixtures,
    totals: {
      fixtureCount: fixtures.length,
      passedCount,
      failedCount: fixtures.length - passedCount
    }
  };
}

const REQUIRED_ROLE_SKILL_SECTIONS = [
  "## Purpose",
  "## Role Focus",
  "## Must-Ask Questions",
  "## Stop Conditions",
  "## Output Contract",
  "## Anti-Patterns",
  "## Rules"
];

function buildRoleAuditEntry(
  provider: ProviderKind,
  spec: { name: string; body: string[] }
): RoleAuditEntry {
  const body = spec.body.join("\n");
  const missingSections = REQUIRED_ROLE_SKILL_SECTIONS.filter((section) => !body.includes(section));
  const warnings: string[] = [];
  if (spec.body.length < 35) {
    warnings.push("role skill is too thin to carry a distinct research perspective");
  }
  if (!body.includes("Researcher Checkpoint")) {
    warnings.push("role skill does not explicitly mention Researcher Checkpoint behavior");
  }
  if (!body.includes("evidence")) {
    warnings.push("role skill does not explicitly mention evidence needs");
  }
  return {
    name: spec.name,
    provider,
    lineCount: spec.body.length,
    missingSections,
    warnings
  };
}

function runRoleAudit(): RoleAuditResult {
  const baseSkillNames = new Set([
    "longtable",
    "longtable-interview",
    "longtable-panel",
    "longtable-explore",
    "longtable-review"
  ]);
  const roles: RoleAuditEntry[] = [
    ...buildCodexSkillSpecs(listRoleDefinitions(), "full")
      .filter((spec) => !baseSkillNames.has(spec.name))
      .map((spec) => buildRoleAuditEntry("codex", spec)),
    ...buildClaudeSkillSpecs(listRoleDefinitions(), "full")
      .filter((spec) => !baseSkillNames.has(spec.name))
      .map((spec) => buildRoleAuditEntry("claude", spec))
  ];
  const passedCount = roles.filter((role) => role.missingSections.length === 0 && role.warnings.length === 0).length;
  return {
    passed: passedCount === roles.length,
    roles,
    totals: {
      roleCount: roles.length,
      passedCount,
      failedCount: roles.length - passedCount
    }
  };
}

function renderQuestionAudit(result: QuestionAuditResult): string {
  const lines = [
    "LongTable question audit",
    `Result: ${result.passed ? "passed" : "failed"} (${result.totals.passedCount}/${result.totals.fixtureCount})`,
    ""
  ];
  for (const fixture of result.fixtures) {
    lines.push(`- ${fixture.id}: ${fixture.passed ? "passed" : "failed"}`);
    lines.push(`  expected: ${fixture.expectedKinds.length > 0 ? fixture.expectedKinds.join(", ") : "none"}`);
    lines.push(`  observed: ${fixture.observedKinds.length > 0 ? fixture.observedKinds.join(", ") : "none"}`);
    for (const failure of fixture.failures) {
      lines.push(`  failure: ${failure}`);
    }
  }
  return lines.join("\n");
}

function renderRoleAudit(result: RoleAuditResult): string {
  const lines = [
    "LongTable role skill audit",
    `Result: ${result.passed ? "passed" : "failed"} (${result.totals.passedCount}/${result.totals.roleCount})`,
    ""
  ];
  for (const role of result.roles) {
    const passed = role.missingSections.length === 0 && role.warnings.length === 0;
    lines.push(`- ${role.provider}:${role.name}: ${passed ? "passed" : "failed"} (${role.lineCount} lines)`);
    if (role.missingSections.length > 0) {
      lines.push(`  missing: ${role.missingSections.join(", ")}`);
    }
    for (const warning of role.warnings) {
      lines.push(`  warning: ${warning}`);
    }
  }
  return lines.join("\n");
}

async function runAudit(subcommand: string | undefined, args: Record<string, string | boolean>): Promise<void> {
  if (subcommand === "questions" || subcommand === "question") {
    const result = runQuestionAudit();
    console.log(args.json === true ? JSON.stringify(result, null, 2) : renderQuestionAudit(result));
    if (!result.passed) {
      exit(1);
    }
    return;
  }

  if (subcommand === "roles" || subcommand === "role") {
    const result = runRoleAudit();
    console.log(args.json === true ? JSON.stringify(result, null, 2) : renderRoleAudit(result));
    if (!result.passed) {
      exit(1);
    }
    return;
  }

  const questions = runQuestionAudit();
  const roles = runRoleAudit();
  const result = {
    passed: questions.passed && roles.passed,
    questions,
    roles
  };
  console.log(args.json === true
    ? JSON.stringify(result, null, 2)
    : [renderQuestionAudit(questions), "", renderRoleAudit(roles)].join("\n"));
  if (!result.passed) {
    exit(1);
  }
}

async function runCodexPersistInit(args: Record<string, string | boolean>): Promise<void> {
  const { flow, provider, answers } = await readPersistAnswers(args);
  const outputValue = createPersistedSetupOutput(answers, provider, flow);
  const result = await saveSetupAndRuntimeConfig(outputValue, {
    setupPath: typeof args.path === "string" ? args.path : undefined,
    runtimePath: typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined
  });

  let installedPrompts = [] as Awaited<ReturnType<typeof installCodexPromptAliases>>;
  if (provider === "codex" && args["install-prompts"] === true) {
    installedPrompts = await installCodexPromptAliases(typeof args.dir === "string" ? args.dir : undefined);
  }
  let installedSkills: Array<{ name: string; path: string; description: string }> = [];
  if (provider === "codex" && args["install-skills"] === true) {
    installedSkills = await installCodexSkills(listRoleDefinitions(), typeof args.dir === "string" ? args.dir : undefined);
  }

  if (args.json === true) {
    console.log(
      JSON.stringify(
        {
          setup: outputValue,
          install: result,
          installedPrompts: installedPrompts.map((prompt) => prompt.name),
          installedSkills: installedSkills.map((skill) => skill.name)
        },
        null,
        2
      )
    );
    return;
  }

  console.log(renderSetupSummary(outputValue));
  console.log("");
  console.log(renderInstallSummary(result));
  if (installedPrompts.length > 0) {
    console.log("");
    console.log("Installed Codex prompt files:");
    for (const prompt of installedPrompts) {
      console.log(`- ${prompt.name}`);
    }
    console.log("  Note: prompt files are legacy and may not be exposed by your Codex build.");
  }
  if (installedSkills.length > 0) {
    console.log("");
    console.log("Installed Codex skill files:");
    for (const skill of installedSkills) {
      console.log(`- ${skill.name}`);
    }
    console.log("  Use these inside Codex by naming LongTable naturally, e.g. `lt panel: ...`.");
  }

  if (provider === "codex") {
    console.log("");
    console.log("Next step:");
    console.log("- Start here: `longtable start`.");
    console.log("- If you want a direct natural-language entry: `longtable ask --prompt \"...\"`.");
    console.log("- Codex skills are the preferred native surface. Prompt files are legacy and may not expose slash commands.");
    console.log("- Suggested next action: create a project workspace and let LongTable interview the current session.");
  }
}

async function resolvePrompt(prompt?: string): Promise<string> {
  if (prompt?.trim()) {
    return prompt.trim();
  }
  if (!process.stdin.isTTY) {
    return readFileSync(0, "utf8").trim();
  }
  const rl = createInterface({ input, output });
  try {
    return (await rl.question("What should LongTable help with?\n> ")).trim();
  } finally {
    rl.close();
  }
}

function inferModeFromPrompt(prompt: string): InteractionMode | "panel" | "status" {
  const normalized = prompt.toLowerCase();

  if (
    normalized.includes("status") ||
    normalized.includes("설정") ||
    normalized.includes("상태") ||
    normalized.includes("롱테이블 상태")
  ) {
    return "status";
  }

  if (
    normalized.includes("패널") ||
    normalized.includes("의견 충돌") ||
    normalized.includes("conflict") ||
    normalized.includes("disagree") ||
    normalized.includes("panel")
  ) {
    return "panel";
  }

  if (
    normalized.includes("결정") ||
    normalized.includes("고를") ||
    normalized.includes("선택") ||
    normalized.includes("commit")
  ) {
    return "commit";
  }

  if (
    normalized.includes("초안") ||
    normalized.includes("써줘") ||
    normalized.includes("문단") ||
    normalized.includes("draft") ||
    normalized.includes("write")
  ) {
    return "draft";
  }

  if (
    normalized.includes("비판") ||
    normalized.includes("반론") ||
    normalized.includes("critique") ||
    normalized.includes("challenge")
  ) {
    return "critique";
  }

  if (
    normalized.includes("검토") ||
    normalized.includes("review") ||
    normalized.includes("편집자") ||
    normalized.includes("리뷰어") ||
    normalized.includes("judge")
  ) {
    return "review";
  }

  return "explore";
}

type CollaborationRoute = "panel" | "team" | "debate";

function inferCollaborationRoute(prompt: string): CollaborationRoute | null {
  const normalized = prompt.toLowerCase();
  const explicitDebate =
    /\bdebate\b|\bdebated\b|\brebuttal\b|\bconvergence\b|\bargue both sides\b/i.test(prompt) ||
    /토론|논쟁|반박|재반박|수렴/.test(prompt);
  if (explicitDebate) {
    return "debate";
  }

  const explicitTeam =
    /\bagent team\b|\bresearch team\b|\bteam review\b|\bteam-style\b|\buse a team\b/i.test(prompt) ||
    /에이전트\s*팀|연구\s*팀|팀\s*(리뷰|검토)|팀으로/.test(prompt);
  if (explicitTeam) {
    return "team";
  }

  const panelCue =
    /\bpanel\b|\bmulti[- ]?role\b|\bmultiple perspectives\b|\brole disagreement\b|\bdisagreement\b|\bconflict\b/i.test(prompt) ||
    /패널|여러\s*관점|복수\s*관점|역할.*불일치|불일치|충돌/.test(prompt);

  const multiPerspectiveCue =
    panelCue ||
    /\bperspectives?\b|\broles?\b|\breviewer and editor\b|\beditor and reviewer\b|\bmethods and measurement\b/i.test(prompt) ||
    /관점|역할|리뷰어.*에디터|에디터.*리뷰어|방법.*측정|측정.*방법/.test(prompt);

  if (!multiPerspectiveCue) {
    return null;
  }

  const trigger = classifyCheckpointTrigger(prompt, {});
  const highStakes =
    trigger.signal.artifactStakes === "external_submission" ||
    trigger.signal.artifactStakes === "study_protocol" ||
    trigger.requiresQuestionBeforeClosure;

  if (panelCue && trigger.signal.artifactStakes === "external_submission") {
    return "debate";
  }

  if (highStakes) {
    return "team";
  }

  return "panel";
}

function parsePanelVisibility(value?: string): PanelVisibility | undefined {
  if (
    value === "synthesis_only" ||
    value === "show_on_conflict" ||
    value === "always_visible"
  ) {
    return value;
  }
  return undefined;
}

function parsePanelMode(value?: string): InteractionMode {
  if (value && VALID_MODES.has(value as InteractionMode) && value !== "explore" && value !== "submit") {
    return value as InteractionMode;
  }
  return "review";
}

async function loadOptionalSetup(path?: string) {
  try {
    return await loadSetupOutput(path);
  } catch {
    return null;
  }
}

async function buildProjectAwarePrompt(
  prompt: string,
  workingDirectory: string
): Promise<{ prompt: string; projectContextFound: boolean }> {
  const context = await loadProjectContextFromDirectory(workingDirectory);
  if (!context) {
    return { prompt, projectContextFound: false };
  }

  const lines = [
    "LongTable project context",
    `project: ${context.project.projectName}`,
    `current session goal: ${context.session.currentGoal}`,
    ...(context.session.currentBlocker ? [`current blocker: ${context.session.currentBlocker}`] : []),
    `requested perspectives: ${context.session.requestedPerspectives.length > 0 ? context.session.requestedPerspectives.join(", ") : "auto"}`,
    `disagreement preference: ${context.session.disagreementPreference}`,
    "",
    prompt
  ];

  return { prompt: lines.join("\n"), projectContextFound: true };
}

async function runModeCommand(
  mode: InteractionMode,
  args: Record<string, string | boolean>
): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const prompt = await resolvePrompt(typeof args.prompt === "string" ? args.prompt : undefined);
  if (!prompt) {
    throw new Error("A prompt is required.");
  }

  const stage = typeof args.stage === "string" ? args.stage : undefined;
  if (stage && !VALID_STAGES.has(stage as ResearchStage)) {
    throw new Error(`Invalid stage: ${stage}`);
  }

  const setup = await loadOptionalSetup(typeof args.setup === "string" ? args.setup : undefined);
  const projectContext = await loadProjectContextFromDirectory(workingDirectory);
  if (projectContext) {
    await assertWorkspaceNotBlocked(projectContext);
  }
  const projectAware = await buildProjectAwarePrompt(prompt, workingDirectory);
  const panelPreference = setup?.profileSeed.panelPreference;
  const panelRequested =
    args.panel === true ||
    panelPreference === "always_visible" ||
    (panelPreference === "show_on_conflict" && args["show-conflicts"] === true);

  const { guidedPrompt } = buildPersonaGuidance({
    mode,
    prompt: projectAware.prompt,
    roleFlag: typeof args.role === "string" ? args.role : undefined,
    panel: panelRequested,
    showConflicts: args["show-conflicts"] === true,
    showDeliberation: args["show-deliberation"] === true
  });

  if (args.print === true) {
    const wrapped = await buildCodexThinWrappedPrompt({
      prompt: guidedPrompt,
      mode,
      researchStage: stage as ResearchStage | undefined,
      setupPath: typeof args.setup === "string" ? args.setup : undefined,
      workingDirectory
    });
    console.log(wrapped.wrappedPrompt);
    return;
  }

  const exitCode = await runCodexThinWrapper({
    prompt: guidedPrompt,
    mode,
    researchStage: stage as ResearchStage | undefined,
    setupPath: typeof args.setup === "string" ? args.setup : undefined,
    workingDirectory,
    json: args.json === true
  });
  exit(exitCode);
}

async function runPanelCommand(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const prompt = await resolvePrompt(typeof args.prompt === "string" ? args.prompt : undefined);
  if (!prompt) {
    throw new Error("A prompt is required.");
  }

  const setup = await loadOptionalSetup(typeof args.setup === "string" ? args.setup : undefined);
  const existingContext = await loadProjectContextFromDirectory(workingDirectory);
  if (existingContext) {
    await assertWorkspaceNotBlocked(existingContext);
  }
  const projectAware = await buildProjectAwarePrompt(prompt, workingDirectory);
  const provider = setup?.providerSelection.provider as ProviderKind | undefined;
  const visibility =
    parsePanelVisibility(typeof args.visibility === "string" ? args.visibility : undefined) ??
    parsePanelVisibility(setup?.profileSeed.panelPreference) ??
    "always_visible";
  const mode = parsePanelMode(typeof args.mode === "string" ? args.mode : undefined);
  const fallback = buildPanelFallback({
    prompt: projectAware.prompt,
    mode,
    roleFlag: typeof args.role === "string" ? args.role : undefined,
    provider,
    visibility
  });
  if (projectAware.projectContextFound) {
    const context = await loadProjectContextFromDirectory(workingDirectory);
    if (context) {
      await appendInvocationRecordToWorkspace(context, fallback.invocationRecord, [fallback.questionRecord]);
    }
  }

  if (args.json === true) {
    console.log(
      JSON.stringify(
        {
          intent: fallback.intent,
          plan: fallback.plan,
          result: fallback.result,
          invocationRecord: fallback.invocationRecord,
          questionRecord: fallback.questionRecord,
          execution: {
            status: "planned",
            stableSurface: "sequential_fallback",
            nativeParallel: "not_required_for_option_a",
            projectContextFound: projectAware.projectContextFound,
            invocationLogged: projectAware.projectContextFound
          },
          fallbackPrompt: fallback.prompt
        },
        null,
        2
      )
    );
    return;
  }

  if (args.print === true) {
    console.log(fallback.prompt);
    return;
  }

  console.log(renderPanelSummary(fallback.plan));
  console.log("");

  const exitCode = await runCodexThinWrapper({
    prompt: fallback.prompt,
    mode,
    setupPath: typeof args.setup === "string" ? args.setup : undefined,
    workingDirectory,
    json: false
  });
  exit(exitCode);
}

function parseLimit(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid search limit: ${value}`);
  }
  return parsed;
}

async function confirmPartialSearch(skippedSources: SearchSourceCapability[]): Promise<boolean> {
  if (!input.isTTY || !output.isTTY) {
    return false;
  }

  const rl = createInterface({ input, output });
  try {
    console.log("Some scholarly sources are unavailable:");
    for (const source of skippedSources) {
      console.log(`- ${source.source}: ${source.reason ?? "unavailable"}`);
    }
    const answer = await rl.question("Continue with the available sources? [y/N] ");
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

function renderEvidenceRunSummary(run: EvidenceRun, recordedPath?: string): string {
  const lines = [
    "LongTable Search",
    `- status: ${run.status}`,
    `- query: ${run.intent.query}`,
    `- intent: ${run.intent.kind}`,
    `- sources: ${run.sourceReports.map((report) => `${report.source}:${report.status}`).join(", ")}`
  ];

  if (run.blockedReason) {
    lines.push(`- blocked: ${run.blockedReason}`);
  }
  if (recordedPath) {
    lines.push(`- recorded: ${recordedPath}`);
  }
  if (run.warnings.length > 0) {
    lines.push("- warnings:");
    for (const warning of run.warnings) {
      lines.push(`  - ${warning}`);
    }
  }
  if (run.cards.length === 0) {
    lines.push("- cards: none");
    return lines.join("\n");
  }

  lines.push("- top evidence cards:");
  for (const card of run.cards.slice(0, 8)) {
    const identifiers = [
      card.doi ? `doi:${card.doi}` : "",
      card.pmid ? `pmid:${card.pmid}` : "",
      card.arxivId ? `arxiv:${card.arxivId}` : ""
    ].filter(Boolean).join(", ");
    lines.push(`  - ${card.title}`);
    lines.push(`    score: ${card.relevanceScore}; support: ${card.citationSupportStatus}; depth: ${card.evidenceDepth}; sources: ${card.sourceRoutes.join(", ")}`);
    lines.push(`    access: ${card.accessStatus}; verification: ${card.verificationNote}`);
    if (identifiers) {
      lines.push(`    ids: ${identifiers}`);
    }
    if (card.url) {
      lines.push(`    url: ${card.url}`);
    }
  }

  return lines.join("\n");
}

async function recordEvidenceRun(run: EvidenceRun, workingDirectory: string): Promise<string> {
  const context = await loadProjectContextFromDirectory(workingDirectory);
  if (!context) {
    throw new Error("`longtable search --record` requires a LongTable project workspace. Run inside a project or pass --cwd.");
  }

  const evidenceDir = join(context.project.projectPath, ".longtable", "evidence");
  await mkdir(evidenceDir, { recursive: true });
  const evidencePath = join(evidenceDir, `${run.id}.json`);
  await writeJsonFile(evidencePath, run);

  const state = await loadWorkspaceState(context);
  state.workingState = {
    ...state.workingState,
    recentEvidenceRun: {
      id: run.id,
      query: run.intent.query,
      intent: run.intent.kind,
      status: run.status,
      cardCount: run.cards.length,
      path: evidencePath
    }
  };
  state.artifactRecords.push({
    id: `artifact_${run.id}`,
    timestamp: run.createdAt,
    artifactType: "evidence_search",
    stakes: "internal_draft",
    source: "longtable search",
    location: evidencePath,
    provenanceSummary: `Scholar-first search for "${run.intent.query}" using ${run.intent.requestedSources.join(", ")}.`
  });
  await writeFile(context.stateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await syncCurrentWorkspaceView(context);

  return evidencePath;
}

function renderPublisherAccessRecord(record: PublisherAccessRecord): string {
  const envSummary = record.missingEnv.length > 0
    ? `missing ${record.missingEnv.join(", ")}`
    : `configured ${record.presentEnv.join(", ") || "none"}`;
  const lines = [
    `${record.publisher}:`,
    `  credential: ${record.credentialStatus} (${envSummary})`,
    `  entitlement: ${record.entitlementStatus}; tdm: ${record.tdmStatus}; depth: ${record.collectionDepth}`,
    `  verification: ${record.verificationNote}`
  ];
  if (record.testedDoi) {
    lines.push(`  tested doi: ${record.testedDoi}`);
  }
  if (record.endpoint) {
    lines.push(`  endpoint: ${record.endpoint}`);
  }
  if (record.licenseNote) {
    lines.push(`  license: ${record.licenseNote}`);
  }
  if (record.setupHint) {
    lines.push(`  setup: ${record.setupHint}`);
  }
  return lines.join("\n");
}

function renderPublisherAccessRecords(title: string, records: PublisherAccessRecord[], capabilityPath?: string): string {
  const lines = [title];
  if (capabilityPath) {
    lines.push(`- capability file: ${capabilityPath}`);
  }
  for (const record of records) {
    lines.push(renderPublisherAccessRecord(record));
  }
  return lines.join("\n");
}

async function saveSearchCapabilityRecords(records: PublisherAccessRecord[]): Promise<string> {
  const snapshotPath = searchCapabilitySnapshotPath();
  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeJsonFile(snapshotPath, buildSearchCapabilitySnapshot(records, env));
  return snapshotPath;
}

async function probeAllPublishers(doi: string): Promise<PublisherAccessRecord[]> {
  const records: PublisherAccessRecord[] = [];
  for (const publisher of publisherConfigs()) {
    records.push(await probePublisherAccess({
      doi,
      publisher: publisher.publisher,
      env
    }));
  }
  return records;
}

async function runSearchProbe(args: Record<string, string | boolean>): Promise<PublisherAccessRecord[]> {
  if (typeof args.doi !== "string" || !args.doi.trim()) {
    throw new Error("`longtable search probe` requires --doi <doi>.");
  }
  const publisher = parsePublisherTarget(args.publisher);
  const record = await probePublisherAccess({
    doi: args.doi,
    publisher,
    env
  });
  if (args.json === true) {
    console.log(JSON.stringify({ record }, null, 2));
  } else {
    console.log(renderPublisherAccessRecord(record));
  }
  return [record];
}

async function runSearchDoctor(args: Record<string, string | boolean>): Promise<PublisherAccessRecord[]> {
  let records: PublisherAccessRecord[];
  if (typeof args.doi === "string" && args.doi.trim()) {
    if (args.publisher === "all") {
      records = await probeAllPublishers(args.doi);
    } else {
      const publisher = parsePublisherTarget(args.publisher);
      records = [await probePublisherAccess({
        doi: args.doi,
        publisher,
        env
      })];
    }
  } else {
    records = summarizeConfiguredPublisherAccess(env);
  }

  const snapshotPath = searchCapabilitySnapshotPath();
  const snapshotExists = existsSync(snapshotPath);
  if (args.json === true) {
    console.log(JSON.stringify({
      capabilityFile: snapshotPath,
      capabilityFileExists: snapshotExists,
      records
    }, null, 2));
  } else {
    console.log(renderPublisherAccessRecords("LongTable Search Publisher Access Doctor", records, snapshotPath));
    if (!snapshotExists) {
      console.log("- saved capabilities: none yet; run `longtable search setup` to record non-secret capability status.");
    }
  }
  return records;
}

async function promptPublisherDoi(rl: ReadlineInterface, label: string, defaultDoi?: string): Promise<string | undefined> {
  const prompt = defaultDoi
    ? `${label} test DOI [${defaultDoi}, Enter to reuse, skip to skip]: `
    : `${label} test DOI (Enter to skip): `;
  const answer = (await rl.question(prompt)).trim();
  if (!answer && defaultDoi) {
    return defaultDoi;
  }
  if (!answer || /^skip$/i.test(answer)) {
    return undefined;
  }
  return answer;
}

async function runInteractiveSearchSetup(defaultDoi?: string): Promise<PublisherAccessRecord[]> {
  const rl = createInterface({ input, output });
  const records: PublisherAccessRecord[] = [];
  try {
    console.log("LongTable publisher access setup");
    console.log("LongTable does not store API keys or TDM tokens. It reads environment variables and records only non-secret capability results.");
    console.log("");
    for (const publisher of publisherConfigs()) {
      console.log(`${publisher.label}`);
      console.log(`  required env: ${publisher.requiredEnv.join(", ")}`);
      if (publisher.optionalEnv.length > 0) {
        console.log(`  optional env: ${publisher.optionalEnv.join(", ")}`);
      }
      console.log(`  ${publisher.setupHint}`);
      const doi = await promptPublisherDoi(rl, publisher.label, defaultDoi);
      if (doi) {
        records.push(await probePublisherAccess({
          doi,
          publisher: publisher.publisher,
          env
        }));
      } else {
        const summary = summarizeConfiguredPublisherAccess(env)
          .find((record) => record.publisher === publisher.publisher);
        if (summary) {
          records.push(summary);
        }
      }
      console.log(renderPublisherAccessRecord(records[records.length - 1]));
      console.log("");
    }
  } finally {
    rl.close();
  }
  return records;
}

async function runSearchSetup(args: Record<string, string | boolean>): Promise<void> {
  const defaultDoi = typeof args.doi === "string" ? args.doi : undefined;
  const records = input.isTTY && output.isTTY && args.json !== true
    ? await runInteractiveSearchSetup(defaultDoi)
    : defaultDoi
      ? await probeAllPublishers(defaultDoi)
      : summarizeConfiguredPublisherAccess(env);
  const snapshotPath = await saveSearchCapabilityRecords(records);

  if (args.json === true) {
    console.log(JSON.stringify({
      capabilityFile: snapshotPath,
      snapshot: buildSearchCapabilitySnapshot(records, env)
    }, null, 2));
    return;
  }
  console.log(renderPublisherAccessRecords("LongTable Search Publisher Access Setup", records, snapshotPath));
}

async function runSearch(subcommand: string | undefined, args: Record<string, string | boolean>): Promise<void> {
  if (subcommand === "probe") {
    await runSearchProbe(args);
    return;
  }
  if (subcommand === "doctor" || subcommand === "status") {
    await runSearchDoctor(args);
    return;
  }
  if (subcommand === "setup") {
    await runSearchSetup(args);
    return;
  }
  if (subcommand) {
    throw new Error(`Unknown search subcommand: ${subcommand}`);
  }

  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const projectContext = await loadProjectContextFromDirectory(workingDirectory);
  const searchInput = {
    query: typeof args.query === "string" ? args.query : undefined,
    prompt: typeof args.prompt === "string" ? args.prompt : undefined,
    projectGoal: projectContext?.session.currentGoal,
    projectBlocker: projectContext?.session.currentBlocker,
    intent: typeof args.intent === "string" ? args.intent : undefined,
    field: typeof args.field === "string" ? args.field : undefined,
    must: typeof args.must === "string" ? args.must : undefined,
    exclude: typeof args.exclude === "string" ? args.exclude : undefined,
    sources: typeof args.source === "string" ? args.source : undefined,
    limit: parseLimit(args.limit),
    source: "cli" as const
  };

  const plannedIntent = buildResearchSearchIntent(searchInput);
  const skippedSources = assessSearchSourceCapabilities(plannedIntent.requestedSources, env)
    .filter((capability) => !capability.enabled);
  let allowPartial = args["allow-partial"] === true;

  if (skippedSources.length > 0 && !allowPartial) {
    allowPartial = await confirmPartialSearch(skippedSources);
  }

  const run = await runResearchSearch({
    ...searchInput,
    env,
    allowPartial,
    publisherAccess: args["publisher-access"] === true
  });

  let recordedPath: string | undefined;
  if (args.record === true && run.status !== "blocked") {
    recordedPath = await recordEvidenceRun(run, workingDirectory);
  }

  if (args.json === true) {
    console.log(JSON.stringify({
      run,
      files: recordedPath ? { evidence: recordedPath } : undefined
    }, null, 2));
    return;
  }

  console.log(renderEvidenceRunSummary(run, recordedPath));
}

async function runQuestion(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const prompt = await resolvePrompt(typeof args.prompt === "string" ? args.prompt : undefined);
  if (!prompt) {
    throw new Error("A decision context is required. Pass --prompt <text>.");
  }

  const context = await loadProjectContextFromDirectory(workingDirectory);
  if (!context) {
    throw new Error("No LongTable project workspace was found here. Run this inside a project or pass --cwd.");
  }

  const provider = args.provider === "claude" ? "claude" : args.provider === "codex" ? "codex" : undefined;
  const required = args.required === true ? true : args.advisory === true ? false : undefined;
  const result = await createWorkspaceQuestion({
    context,
    prompt,
    title: typeof args.title === "string" ? args.title : undefined,
    question: typeof args.text === "string" ? args.text : undefined,
    provider,
    required
  });
  const transport = provider === "claude"
    ? renderQuestionRecordInput(result.question)
    : renderQuestionRecordPrompt(result.question);

  if (args.json === true) {
    console.log(
      JSON.stringify(
        {
          question: result.question,
          transport,
          files: {
            state: context.stateFilePath,
            current: context.currentFilePath
          },
          nextAction: `longtable decide --question ${result.question.id} --answer <value>`
        },
        null,
        2
      )
    );
    return;
  }

  if (args.print === true) {
    if (provider === "claude") {
      console.log(JSON.stringify(transport, null, 2));
    } else {
      console.log("prompt" in transport ? transport.prompt : JSON.stringify(transport, null, 2));
    }
    return;
  }

  if (isInteractiveTerminal()) {
    console.log(renderBrandBanner("LongTable", "Researcher Checkpoint"));
    console.log("");
    const answer = await promptChoice(
      renderQuestionHeader(
        1,
        1,
        result.question.prompt.title,
        result.question.prompt.question
      ),
      questionRecordToChoices(result.question)
    );
    const decision = await answerWorkspaceQuestion({
      context,
      questionId: result.question.id,
      answer,
      provider,
      surface: "terminal_selector"
    });
    console.log("");
    console.log("LongTable checkpoint decision recorded");
    console.log(`- question: ${decision.question.id}`);
    console.log(`- decision: ${decision.decision.id}`);
    console.log(`- answer: ${decision.decision.selectedOption ?? answer}`);
    console.log(`- state: ${context.stateFilePath}`);
    console.log(`- current: ${context.currentFilePath}`);
    return;
  }

  const optionValues = [
    ...result.question.prompt.options.map((option) => option.value),
    ...(result.question.prompt.allowOther ? ["other"] : [])
  ];
  console.log(result.question.prompt.required ? "LongTable required Researcher Checkpoint recorded" : "LongTable advisory Researcher Checkpoint recorded");
  console.log(`- question: ${result.question.id}`);
  console.log(`- checkpoint: ${result.question.prompt.checkpointKey ?? "manual"}`);
  console.log(`- prompt: ${result.question.prompt.question}`);
  console.log(`- options: ${optionValues.join("/")}`);
  console.log(`- answer: longtable decide --question ${result.question.id} --answer <value>`);
  console.log(`- current: ${context.currentFilePath}`);
}

async function runClearQuestion(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const questionId = typeof args.question === "string" ? args.question.trim() : "";
  const reason = typeof args.reason === "string" ? args.reason.trim() : "";

  if (!questionId) {
    throw new Error("`clear-question` requires --question <id>.");
  }
  if (!reason) {
    throw new Error("`clear-question` requires --reason <text>.");
  }

  const context = await loadProjectContextFromDirectory(workingDirectory);
  if (!context) {
    throw new Error("No LongTable project workspace was found here. Run this inside a project or pass --cwd.");
  }

  const result = await clearWorkspaceQuestion({
    context,
    questionId,
    reason
  });

  if (args.json === true) {
    console.log(JSON.stringify({
      question: result.question,
      files: {
        state: context.stateFilePath,
        current: context.currentFilePath
      }
    }, null, 2));
    return;
  }

  console.log("LongTable question cleared");
  console.log(`- question: ${result.question.id}`);
  console.log(`- reason: ${result.question.clearedReason ?? reason}`);
  console.log(`- state: ${context.stateFilePath}`);
  console.log(`- current: ${context.currentFilePath}`);
}

async function runPruneQuestions(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const context = await loadProjectContextFromDirectory(workingDirectory);
  if (!context) {
    throw new Error("No LongTable project workspace was found here. Run this inside a project or pass --cwd.");
  }

  const dryRun = args["dry-run"] === true;
  const result = await pruneWorkspaceQuestions({
    context,
    dryRun
  });

  if (args.json === true) {
    console.log(JSON.stringify({
      dryRun,
      removedCount: result.removedQuestions.length,
      removedQuestions: result.removedQuestions.map((question) => ({
        id: question.id,
        title: question.prompt.title,
        reason: question.clearedReason
      })),
      files: {
        state: context.stateFilePath,
        current: context.currentFilePath
      }
    }, null, 2));
    return;
  }

  console.log(dryRun ? "LongTable question prune preview" : "LongTable questions pruned");
  console.log(`- removed false-positive cleared questions: ${result.removedQuestions.length}`);
  for (const question of result.removedQuestions) {
    console.log(`  - ${question.id}: ${question.prompt.title}`);
  }
  console.log(`- state: ${context.stateFilePath}`);
  console.log(`- current: ${context.currentFilePath}`);
}

function isInteractiveTerminal(): boolean {
  return Boolean(input.isTTY && output.isTTY);
}

function questionRecordToChoices(record: QuestionRecord): SetupChoice[] {
  return [
    ...record.prompt.options.map((option) => ({
      id: option.value,
      label: option.recommended ? `${option.label} (Recommended)` : option.label,
      description: option.description ?? "Select this option."
    })),
    ...(record.prompt.allowOther
      ? [{
          id: "other",
          label: record.prompt.otherLabel ?? "Other",
          description: "Type a custom answer.",
          fallbackToText: true
        }]
      : [])
  ];
}

function renderFollowUpQuestions(questions: QuestionRecord[]): string {
  if (questions.length === 0) {
    return "No new follow-up questions are pending for this prompt.";
  }

  const width = 44;
  const boxLine = (text = "") => `│ ${text.padEnd(width, " ")} │`;
  const wrap = (text: string): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const wrapped: string[] = [];
    let line = "";
    for (const word of words) {
      if (!line) {
        line = word;
        continue;
      }
      if (`${line} ${word}`.length > width) {
        wrapped.push(line);
        line = word;
        continue;
      }
      line = `${line} ${word}`;
    }
    if (line) {
      wrapped.push(line);
    }
    return wrapped.length > 0 ? wrapped : [""];
  };

  const lines = [
    "I want to make sure I handle this in the way you actually want, so here are the choices LongTable should not infer silently:",
    "",
    "┌──────────────────────────────────────────────┐"
  ];

  for (const question of questions) {
    lines.push(boxLine(question.prompt.title));
    for (const line of wrap(question.prompt.question)) {
      lines.push(boxLine(line));
    }
    for (const option of question.prompt.options) {
      const suffix = option.recommended ? " (Recommended)" : "";
      for (const line of wrap(`- ${option.label}${suffix}`)) {
        lines.push(boxLine(line));
      }
    }
    if (question.prompt.allowOther) {
      lines.push(boxLine(`- ${question.prompt.otherLabel ?? "Other"}`));
    }
    lines.push(boxLine());
  }

  lines.push("└──────────────────────────────────────────────┘");
  lines.push("");
  lines.push("Answer in a terminal with `longtable clarify --prompt ...`, or record choices with `longtable decide --question <id> --answer <value>`.");
  return lines.join("\n");
}

async function answerFollowUpQuestionsInTerminal(
  context: LongTableProjectContext,
  questions: QuestionRecord[],
  provider?: ProviderKind
): Promise<void> {
  if (questions.length === 0) {
    return;
  }

  console.log(renderBrandBanner("LongTable", "Follow-up Questions"));
  console.log("");
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const prompt = renderQuestionHeader(index + 1, questions.length, question.prompt.title, question.prompt.question);
    const answer = await promptChoice(prompt, questionRecordToChoices(question));
    await answerWorkspaceQuestion({
      context,
      questionId: question.id,
      answer,
      provider,
      surface: "terminal_selector"
    });
  }
}

async function runClarify(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const prompt = await resolvePrompt(typeof args.prompt === "string" ? args.prompt : undefined);
  if (!prompt) {
    throw new Error("A task context is required. Pass --prompt <text>.");
  }

  const context = await loadProjectContextFromDirectory(workingDirectory);
  if (!context) {
    throw new Error("No LongTable project workspace was found here. Run this inside a project or pass --cwd.");
  }

  const provider = args.provider === "claude" ? "claude" : args.provider === "codex" ? "codex" : undefined;
  const required = args.required === true ? true : args.advisory === true ? false : undefined;
  const result = await createWorkspaceFollowUpQuestions({
    context,
    prompt,
    provider,
    required,
    force: args.force === true
  });

  if (args.json === true) {
    console.log(
      JSON.stringify(
        {
          questions: result.questions,
          created: result.created,
          alreadyAnswered: result.alreadyAnswered,
          files: {
            state: context.stateFilePath,
            current: context.currentFilePath
          }
        },
        null,
        2
      )
    );
    return;
  }

  if (args.print === true || !isInteractiveTerminal()) {
    console.log(renderFollowUpQuestions(result.questions));
    return;
  }

  await answerFollowUpQuestionsInTerminal(context, result.questions, provider);
  console.log("");
  console.log("LongTable follow-up decisions recorded");
  console.log(`- answered: ${result.questions.length}`);
  console.log(`- state: ${context.stateFilePath}`);
  console.log(`- current: ${context.currentFilePath}`);
}

function looksLikeProductOrToolingPrompt(prompt: string): boolean {
  return /\b(longlongtable|hook|checkpoint|mcp|agents?|skills?|ux|interface|setup|install|cli|npm|version|global|release|deploy|git|github|readme|docs?|documentation|workflow|package|router|autocomplete|simulation test)\b/i.test(prompt)
    || /롱테이블|훅|체크포인트|에이전트|스킬|사용성|인터페이스|설치|세팅|글로벌|배포|버전|릴리즈|깃|깃허브|문서화된\s*절차|패키지|라우터|자동완성|시뮬레이션\s*테스트/.test(prompt);
}

function looksLikeResearchCommitmentPrompt(prompt: string): boolean {
  const researchCue = /\b(research|study|paper|manuscript|journal|article|method|methodology|measurement|construct|theory|analysis|model|data|participant|sample|scale|survey|instrument|validity|hypothesis|literature|meta[- ]?analysis|gold standard|coding|trust|reliance|calibration)\b/i.test(prompt)
    || /연구|논문|원고|저널|방법론|방법|연구\s*설계|측정|구성개념|개념|이론|분석|모형|모델|데이터|참가자|표본|샘플|척도|설문|도구|타당도|가설|문헌|메타\s*분석|골드\s*스탠더드|코딩|신뢰|의존|캘리브레이션|교정|보정/.test(prompt);
  const closureCue = /\b(final|finalize|commit|ship|submit|publish|freeze|settle|decide|lock|record|apply|incorporate)\b/i.test(prompt)
    || /최종|확정|커밋|제출|투고|고정|결정|기록|반영/.test(prompt);
  return researchCue && closureCue;
}

async function runAutomaticFollowUpIfNeeded(
  prompt: string,
  args: Record<string, string | boolean>
): Promise<boolean> {
  if (args["no-clarify"] === true || args.print === true || args.json === true) {
    return false;
  }
  if (looksLikeProductOrToolingPrompt(prompt) || !looksLikeResearchCommitmentPrompt(prompt)) {
    return false;
  }

  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const context = await loadProjectContextFromDirectory(workingDirectory);
  if (!context) {
    return false;
  }

  const provider = args.provider === "claude" ? "claude" : args.provider === "codex" ? "codex" : undefined;
  const result = await createWorkspaceFollowUpQuestions({
    context,
    prompt,
    provider,
    required: true,
    auto: true,
    requiredOnly: true
  });

  if (result.questions.length === 0) {
    return false;
  }

  if (!isInteractiveTerminal()) {
    console.log(renderFollowUpQuestions(result.questions));
    return true;
  }

  await answerFollowUpQuestionsInTerminal(context, result.questions, provider);
  return false;
}

async function runAsk(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const prompt = await resolvePrompt(typeof args.prompt === "string" ? args.prompt : undefined);
  if (!prompt) {
    throw new Error("A prompt is required.");
  }

  const projectContext = await loadProjectContextFromDirectory(workingDirectory);
  if (projectContext) {
    await assertWorkspaceNotBlocked(projectContext);
  }

  const directive = parseInvocationDirective(prompt);
  const effectivePrompt = directive.cleanedPrompt;
  const inferred = directive.mode ?? inferModeFromPrompt(effectivePrompt);
  if (inferred === "status") {
    await runDoctor(args);
    return;
  }

  const mode = inferred === "panel" ? "review" : inferred;
  if (await runAutomaticFollowUpIfNeeded(effectivePrompt, args)) {
    return;
  }
  const delegatedArgs: Record<string, string | boolean> = {
    ...args,
    prompt: effectivePrompt
  };
  if (directive.roles.length > 0 && typeof delegatedArgs.role !== "string") {
    delegatedArgs.role = directive.roles.join(",");
  }

  const collaborationRoute =
    directive.collaboration ??
    (directive.panel || delegatedArgs.panel === true
      ? "panel"
      : inferCollaborationRoute(effectivePrompt) ?? (inferred === "panel" ? "panel" : null));

  if (collaborationRoute === "team" || collaborationRoute === "debate") {
    await runTeam({
      ...delegatedArgs,
      debate: collaborationRoute === "debate"
    });
    return;
  }

  if (collaborationRoute === "panel") {
    await runPanelCommand({
      ...delegatedArgs,
      visibility: "always_visible"
    });
    return;
  }
  await runModeCommand(mode, delegatedArgs);
}

function localId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeTeamDebateArtifacts(bundle: TeamDebateBundle, teamDir: string, prompt: string): Promise<void> {
  await mkdir(teamDir, { recursive: true });
  await writeFile(join(teamDir, "prompt.txt"), prompt, "utf8");
  await writeJsonFile(join(teamDir, "plan.json"), bundle.plan);
  await writeJsonFile(join(teamDir, "run.json"), bundle.run);
  for (const round of bundle.run.rounds) {
    await mkdir(round.artifactDir, { recursive: true });
    await writeJsonFile(join(round.artifactDir, "round.json"), round);
    for (const contribution of round.contributions) {
      await writeJsonFile(join(teamDir, contribution.artifactPath), contribution);
    }
  }
  await writeJsonFile(join(teamDir, "synthesis.json"), bundle.run.synthesis);
  await writeJsonFile(join(teamDir, "checkpoint.json"), bundle.questionRecord);
  await writeJsonFile(join(teamDir, "invocation.json"), bundle.invocationRecord);
}

function sentinelSummary(prompt: string, workingDirectory: string) {
  const trigger = classifyCheckpointTrigger(prompt, {
    fallbackMode: "explore",
    unresolvedTensions: []
  });
  const normalized = prompt.toLowerCase();
  const signals: string[] = [];
  if (/measure|measurement|scale|validity|reliability|측정|척도|타당도|신뢰도/.test(normalized)) {
    signals.push("measurement gap or commitment");
  }
  if (/theory|theoretical|framework|construct|이론|프레임워크|개념/.test(normalized)) {
    signals.push("theory or construct commitment");
  }
  if (/method|design|sample|participant|방법|설계|표본|참여자/.test(normalized)) {
    signals.push("method/design gap");
  }
  if (/knowledge gap|unknown|uncertain|not sure|don't know|dont know|지식의 공백|지식 공백|모르겠|불확실/.test(normalized)) {
    signals.push("knowledge gap");
  }
  if (/citation|reference|source|evidence|doi|문헌|인용|근거|출처/.test(normalized)) {
    signals.push("evidence gap");
  }
  if (/voice|authorship|narrative|저자성|서사|문체|목소리/.test(normalized)) {
    signals.push("authorship or narrative-trace risk");
  }
  if (/assumption|implicit|tacit|암묵|전제|가정/.test(normalized)) {
    signals.push("tacit assumption risk");
  }

  return {
    cwd: workingDirectory,
    checkpoint: trigger.signal.checkpointKey,
    family: trigger.family,
    confidence: trigger.confidence,
    requiresQuestionBeforeClosure: trigger.requiresQuestionBeforeClosure,
    signals: signals.length > 0 ? signals : ["no specific gap/tacit signal beyond checkpoint classifier"],
    rationale: trigger.rationale
  };
}

async function runSentinel(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const prompt = await resolvePrompt(typeof args.prompt === "string" ? args.prompt : undefined);
  if (!prompt) {
    throw new Error("A prompt is required.");
  }
  const summary = sentinelSummary(prompt, workingDirectory);
  const context = await loadProjectContextFromDirectory(workingDirectory);

  if (args.record === true && context) {
    const state = await loadWorkspaceState(context);
    state.inferredHypotheses.push({
      hypothesis: `Sentinel detected: ${summary.signals.join(", ")}.`,
      confidence: summary.confidence === "high" ? 0.85 : summary.confidence === "medium" ? 0.65 : 0.4,
      evidence: [`Prompt: ${prompt}`],
      status: "unconfirmed"
    });
    if (summary.requiresQuestionBeforeClosure) {
      state.openTensions.push(`Pending sentinel risk: ${summary.checkpoint}`);
    }
    await writeFile(context.stateFilePath, JSON.stringify(state, null, 2), "utf8");
    await syncCurrentWorkspaceView(context);
  }

  if (args.json === true) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log("LongTable Sentinel");
  console.log(`- checkpoint: ${summary.checkpoint}`);
  console.log(`- family: ${summary.family}`);
  console.log(`- confidence: ${summary.confidence}`);
  console.log(`- question before closure: ${summary.requiresQuestionBeforeClosure ? "yes" : "no"}`);
  console.log("- detected signals:");
  for (const signal of summary.signals) {
    console.log(`  - ${signal}`);
  }
  if (args.record === true) {
    console.log(context ? `- recorded in: ${context.stateFilePath}` : "- record skipped: no LongTable workspace found");
  }
}

async function runTeam(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const prompt = await resolvePrompt(typeof args.prompt === "string" ? args.prompt : undefined);
  if (!prompt) {
    throw new Error("A prompt is required.");
  }
  const isDebate = args.debate === true;
  const expectedRounds = isDebate ? 5 : 3;
  const rounds = typeof args.rounds === "string" ? Number(args.rounds) : expectedRounds;
  if (!Number.isInteger(rounds) || rounds !== expectedRounds) {
    throw new Error(isDebate
      ? "LongTable team debate v1 supports `--rounds 5` only."
      : "LongTable team v1 supports `--rounds 3` cross-review only.");
  }
  const setup = await loadOptionalSetup(typeof args.setup === "string" ? args.setup : undefined);
  const projectContext = await loadProjectContextFromDirectory(workingDirectory);
  if (projectContext) {
    await assertWorkspaceNotBlocked(projectContext);
  }
  const projectAware = await buildProjectAwarePrompt(prompt, workingDirectory);
  const teamId = localId("team");
  const teamDir = join(workingDirectory, ".longtable", "team", teamId);

  if (isDebate) {
    const debate = buildTeamDebate({
      teamId,
      teamDir,
      prompt: projectAware.prompt,
      roleFlag: typeof args.role === "string" ? args.role : undefined,
      provider: setup?.providerSelection.provider as ProviderKind | undefined,
      visibility: "always_visible",
      roundCount: rounds
    });
    await writeTeamDebateArtifacts(debate, teamDir, prompt);

    const canRecordWorkspace = projectAware.projectContextFound && projectContext && existsSync(projectContext.stateFilePath);
    if (canRecordWorkspace) {
      await appendInvocationRecordToWorkspace(projectContext, debate.invocationRecord, [debate.questionRecord]);
    }

    if (args.json === true) {
      console.log(
        JSON.stringify(
          {
            teamId,
            teamDir,
            plan: debate.plan,
            run: debate.run,
            questionRecord: debate.questionRecord,
            invocationRecord: debate.invocationRecord,
            execution: {
              status: "completed",
              surface: debate.run.surface,
              projectContextFound: projectAware.projectContextFound,
              invocationLogged: canRecordWorkspace
            }
          },
          null,
          2
        )
      );
      return;
    }

    console.log(renderTeamDebateSummary(debate.run));
    console.log(`- checkpoint: ${debate.questionRecord.id}`);
    return;
  }

  const team = buildTeamReview({
    teamId,
    teamDir,
    prompt: projectAware.prompt,
    roleFlag: typeof args.role === "string" ? args.role : undefined,
    provider: setup?.providerSelection.provider as ProviderKind | undefined,
    visibility: "always_visible",
    roundCount: rounds
  });
  await writeTeamDebateArtifacts(team, teamDir, prompt);

  const canRecordWorkspace = projectAware.projectContextFound && projectContext && existsSync(projectContext.stateFilePath);
  if (canRecordWorkspace) {
    await appendInvocationRecordToWorkspace(projectContext, team.invocationRecord, [team.questionRecord]);
  }

  if (args.json === true) {
    console.log(
      JSON.stringify(
        {
          teamId,
          teamDir,
          plan: team.plan,
          run: team.run,
          questionRecord: team.questionRecord,
          invocationRecord: team.invocationRecord,
          execution: {
            status: "completed",
            surface: team.run.surface,
            interactionDepth: team.run.interactionDepth,
            projectContextFound: projectAware.projectContextFound,
            invocationLogged: canRecordWorkspace
          }
        },
        null,
        2
      )
    );
    return;
  }

  console.log(renderTeamDebateSummary(team.run));
  console.log(`- checkpoint: ${team.questionRecord.id}`);
}

async function runDecide(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const answer = typeof args.answer === "string" ? args.answer.trim() : "";
  if (!answer) {
    throw new Error("A decision answer is required. Pass --answer <value-or-text>.");
  }

  const context = await loadProjectContextFromDirectory(workingDirectory);
  if (!context) {
    throw new Error("No LongTable project workspace was found here. Run this inside a project or pass --cwd.");
  }

  const provider = args.provider === "claude" ? "claude" : args.provider === "codex" ? "codex" : undefined;
  const result = await answerWorkspaceQuestion({
    context,
    questionId: typeof args.question === "string" ? args.question : undefined,
    answer,
    rationale: typeof args.rationale === "string" ? args.rationale : undefined,
    provider
  });

  if (args.json === true) {
    console.log(
      JSON.stringify(
        {
          question: result.question,
          decision: result.decision,
          files: {
            state: context.stateFilePath,
            current: context.currentFilePath
          }
        },
        null,
        2
      )
    );
    return;
  }

  console.log("LongTable decision recorded");
  console.log(`- question: ${result.question.id}`);
  console.log(`- decision: ${result.decision.id}`);
  console.log(`- answer: ${result.decision.selectedOption ?? answer}`);
  console.log(`- state: ${context.stateFilePath}`);
  console.log(`- current: ${context.currentFilePath}`);
}

async function runRoles(args: Record<string, string | boolean>): Promise<void> {
  const payload = PERSONA_DEFINITIONS.map((persona) => ({
    key: persona.key,
    label: persona.label,
    description: persona.shortDescription,
    triggerMode: persona.triggerMode,
    defaultPanelMember: persona.defaultPanelMember,
    checkpointSensitivity: persona.checkpointSensitivity,
    supportedModes: persona.supportedModes,
    exampleTriggers: persona.synonyms.slice(0, 4)
  }));

  if (args.json === true) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log("LongTable roles");
  console.log("These are perspectives LongTable can consult when relevant.");
  console.log("Inside Codex, explicit forms like `lt editor: ...` and `lt methods: ...` are stronger than plain natural language.");
  console.log("");
  for (const persona of payload) {
    console.log(`- ${persona.label} (${persona.key})`);
    console.log(`  ${persona.description}`);
    console.log(
      `  Trigger: ${persona.triggerMode === "auto-callable" ? "auto-callable when your language strongly implies it" : "explicit request only"}`
    );
    console.log(`  Panel: ${persona.defaultPanelMember ? "default member" : "contextual member"}`);
    console.log(`  Checkpoint sensitivity: ${persona.checkpointSensitivity}`);
    console.log(`  Examples: ${persona.exampleTriggers.join(", ")}`);
  }
}

async function runStart(args: Record<string, string | boolean>): Promise<void> {
  const hasMinimalFallbackArgs =
    typeof args.name === "string" &&
    typeof args.path === "string" &&
    typeof args.goal === "string";
  const hasFallbackIntent =
    args["no-interview"] === true ||
    hasMinimalFallbackArgs;
  if (!hasFallbackIntent) {
    console.log(renderSectionCard("LongTable Start Has Moved", [
      "`longtable start` is now a fallback for automation and scripted workspace creation.",
      "The primary research-start experience is provider-native so LongTable can run a real interview instead of a terminal questionnaire.",
      "",
      "Use:",
      "1. longtable setup --provider codex",
      "2. cd \"<research-folder>\"",
      "3. codex",
      "4. $longtable-interview",
      "",
      "For automation, pass `--no-interview --json` with `--name`, `--path`, and `--goal`."
    ]));
    return;
  }

  const setupPath = typeof args.setup === "string" ? args.setup : undefined;
  const existingSetup = await loadOptionalSetup(setupPath);

  if (!existingSetup) {
    throw new Error("LongTable setup is missing. Run `longtable setup --provider codex` first.");
  }

  const interview = await collectProjectInterview(existingSetup, args);
  await verifyWritableWorkspaceParent(interview.projectPath);
  const context = await createOrUpdateProjectWorkspace({
    projectName: interview.projectName,
    projectPath: interview.projectPath,
    currentGoal: interview.currentGoal,
    currentBlocker: interview.currentBlocker,
    researchObject: interview.researchObject,
    gapRisk: interview.gapRisk,
    protectedDecision: interview.protectedDecision,
    startInterview: interview.startInterview,
    requestedPerspectives: interview.requestedPerspectives,
    disagreementPreference: interview.disagreementPreference,
    setup: existingSetup
  });

  if (args.json === true) {
    console.log(
      JSON.stringify(
        {
          project: context.project,
          session: context.session,
          files: {
            project: context.projectFilePath,
            session: context.sessionFilePath,
            state: context.stateFilePath,
            current: context.currentFilePath
          }
        },
        null,
        2
      )
    );
    return;
  }

  console.log(renderProjectWorkspaceSummary(context));
  console.log("");
  console.log(
    renderSectionCard("Next Step", [
      `1. cd "${context.project.projectPath}"`,
      "2. run `codex` in that directory",
      "3. begin with your current goal in natural language",
      "4. if you return later, open `CURRENT.md` or run `longtable resume`",
      "",
      `Suggested first message: ${context.session.currentBlocker ? `"I want to work on ${context.session.currentGoal}. My current blocker is ${context.session.currentBlocker}."` : `"I want to work on ${context.session.currentGoal}."`}`,
      "",
      `Optional CLI path: longtable ask --cwd "${context.project.projectPath}" --prompt "${context.session.currentGoal.replaceAll("\"", "\\\"")}"`
    ])
  );
}

async function runResume(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const context = await loadProjectContextFromDirectory(workingDirectory);

  if (!context) {
    throw new Error("No LongTable project workspace was found here. Run `longtable start` first or pass --cwd.");
  }

  await syncCurrentWorkspaceView(context);

  const payload = {
    project: context.project,
    session: context.session,
    files: {
      current: resolve(context.project.projectPath, "CURRENT.md"),
      project: context.projectFilePath,
      session: context.sessionFilePath,
      state: context.stateFilePath
    }
  };

  if (args.json === true) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(
    renderSectionCard("LongTable Resume", [
      `Project: ${context.project.projectName}`,
      `Path: ${context.project.projectPath}`,
      `Current goal: ${context.session.currentGoal}`,
      ...(context.session.currentBlocker ? [`Current blocker: ${context.session.currentBlocker}`] : []),
      `Requested perspectives: ${context.session.requestedPerspectives.length > 0 ? context.session.requestedPerspectives.join(", ") : "auto"}`,
      `Disagreement: ${context.session.disagreementPreference}`,
      "",
      "Current file:",
      `- ${payload.files.current}`,
      "",
      `Suggested restart message: "${context.session.resumeHint ?? (context.session.currentBlocker ? `I want to continue ${context.session.currentGoal}. The unresolved blocker is ${context.session.currentBlocker}.` : `I want to continue ${context.session.currentGoal}.`)}"`
    ])
  );
}

async function runCodexSubcommand(
  subcommand: string | undefined,
  args: Record<string, string | boolean>
): Promise<void> {
  const customDir = typeof args.dir === "string" ? args.dir : undefined;
  const roles = listRoleDefinitions();
  const skillSurface = parseSkillSurface(args);

  if (subcommand === "install-skills") {
    const installed = await installCodexSkills(roles, customDir, skillSurface);
    console.log(`Installed ${installed.length} LongTable Codex skills in ${resolveCodexSkillsDir(customDir)} (${skillSurface} surface)`);
    console.log("Use them inside Codex with natural-language triggers such as `lt explore: ...` or `lt panel: ...`.");
    console.log("Use `$longtable` as the general router; compact installs expose only the most common role shortcuts.");
    for (const skill of installed) {
      console.log(`- ${skill.name}`);
    }
    return;
  }

  if (subcommand === "remove-skills") {
    const removed = await removeCodexSkills(roles, customDir);
    console.log(`Removed ${removed.length} LongTable Codex skills from ${resolveCodexSkillsDir(customDir)}`);
    return;
  }

  if (subcommand === "install-prompts") {
    const installed = await installCodexPromptAliases(customDir);
    console.log(`Installed ${installed.length} legacy LongTable prompt files in ${resolveCodexPromptsDir(customDir)}`);
    console.log("Note: current Codex builds may not expose these files as slash commands. Prefer `longtable codex install-skills`.");
    for (const prompt of installed) {
      console.log(`- ${prompt.name}`);
    }
    return;
  }

  if (subcommand === "persist-init") {
    await runCodexPersistInit(args);
    return;
  }

  if (subcommand === "remove-prompts") {
    const removed = await removeCodexPromptAliases(customDir);
    console.log(`Removed ${removed.length} legacy LongTable prompt files from ${resolveCodexPromptsDir(customDir)}`);
    return;
  }

  if (subcommand === "install-hooks") {
    const result = await installCodexNativeHooks(args);
    if (args.json === true) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(renderCodexHookInstallSummary(result));
    console.log("Restart Codex so the native hook config is reloaded.");
    return;
  }

  if (subcommand === "remove-hooks") {
    const result = await removeCodexNativeHooks(args);
    if (args.json === true) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(renderCodexHookInstallSummary(result));
    return;
  }

  if (subcommand === "status") {
    const aliases = await listInstalledCodexPromptAliases(customDir);
    const skills = await listInstalledCodexSkills(roles, customDir, skillSurface);
    const setupPath = resolveDefaultSetupPath(typeof args.path === "string" ? args.path : undefined).path;
    const runtimePath = resolveDefaultRuntimeConfigPath("codex", typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined).path;
    const configPath = resolveCodexMcpConfigPath(args);
    const configContent = existsSync(configPath) ? await readFile(configPath, "utf8") : "";
    const hooksPath = resolveCodexHooksPath(args);
    const hooksContent = existsSync(hooksPath) ? await readFile(hooksPath, "utf8") : "";
    const status = {
      setupPath,
      setupExists: existsSync(setupPath),
      runtimePath,
      runtimeExists: existsSync(runtimePath),
      skillsDir: resolveCodexSkillsDir(customDir),
      skillSurface,
      skillsInstalled: skills.map((skill) => skill.name),
      promptsDir: resolveCodexPromptsDir(customDir),
      legacyPromptFilesInstalled: aliases.map((alias) => alias.name),
      codexConfigPath: configPath,
      codexHooksEnabled: codexHooksEnabled(configContent),
      hooksPath,
      hooksExists: existsSync(hooksPath),
      missingManagedHookEvents: hooksContent
        ? (getMissingManagedCodexHookEvents(hooksContent) ?? [...LONGTABLE_MANAGED_HOOK_EVENTS])
        : [...LONGTABLE_MANAGED_HOOK_EVENTS]
    };

    if (args.json === true) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    console.log("LongTable Codex status");
    console.log(`- setup: ${status.setupExists ? "present" : "missing"} (${setupPath})`);
    console.log(`- codex runtime artifact: ${status.runtimeExists ? "present" : "missing"} (${runtimePath})`);
    console.log(`- skills dir: ${status.skillsDir}`);
    console.log(`- skill surface: ${status.skillSurface}`);
    if (skills.length === 0) {
      console.log("- skills: none");
    } else {
      console.log("- skills:");
      for (const skill of skills) {
        console.log(`  - ${skill.name}`);
      }
    }
    console.log(`- prompt aliases dir: ${status.promptsDir}`);
    console.log("- prompt files: legacy; current Codex builds may not expose these as slash commands");
    if (aliases.length === 0) {
      console.log("- legacy prompt files: none");
    } else {
      console.log("- legacy prompt files:");
      for (const alias of aliases) {
        console.log(`  - ${alias.name}`);
      }
    }
    console.log(`- codex config: ${status.codexConfigPath}`);
    console.log(`- codex_hooks feature: ${status.codexHooksEnabled ? "enabled" : "missing"}`);
    console.log(`- hooks file: ${status.hooksExists ? "present" : "missing"} (${status.hooksPath})`);
    console.log(`- managed hook coverage: ${status.missingManagedHookEvents.length === 0 ? "complete" : `missing ${status.missingManagedHookEvents.join(", ")}`}`);
    return;
  }

  throw new Error("Unknown codex subcommand.");
}

async function runClaudeSubcommand(
  subcommand: string | undefined,
  args: Record<string, string | boolean>
): Promise<void> {
  const customDir = typeof args.dir === "string" ? args.dir : undefined;
  const roles = listRoleDefinitions();
  const skillSurface = parseSkillSurface(args);

  if (subcommand === "install-skills") {
    const installed = await installClaudeSkills(roles, customDir, skillSurface);
    console.log(`Installed ${installed.length} LongTable Claude skills in ${resolveClaudeSkillsDir(customDir)} (${skillSurface} surface)`);
    console.log("Use them inside Claude Code with natural-language triggers such as `lt explore: ...` or `lt panel: ...`.");
    for (const skill of installed) {
      console.log(`- ${skill.name}`);
    }
    return;
  }

  if (subcommand === "remove-skills") {
    const removed = await removeClaudeSkills(roles, customDir);
    console.log(`Removed ${removed.length} LongTable Claude skills from ${resolveClaudeSkillsDir(customDir)}`);
    return;
  }

  if (subcommand === "status") {
    const skills = await listInstalledClaudeSkills(roles, customDir, skillSurface);
    const setupPath = resolveDefaultSetupPath(typeof args.path === "string" ? args.path : undefined).path;
    const runtimePath = resolveDefaultRuntimeConfigPath("claude", typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined).path;
    const status = {
      setupPath,
      setupExists: existsSync(setupPath),
      runtimePath,
      runtimeExists: existsSync(runtimePath),
      skillsDir: resolveClaudeSkillsDir(customDir),
      skillSurface,
      skillsInstalled: skills.map((skill) => skill.name)
    };

    if (args.json === true) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    console.log("LongTable Claude status");
    console.log(`- setup: ${status.setupExists ? "present" : "missing"} (${setupPath})`);
    console.log(`- claude runtime artifact: ${status.runtimeExists ? "present" : "missing"} (${runtimePath})`);
    console.log(`- skills dir: ${status.skillsDir}`);
    console.log(`- skill surface: ${status.skillSurface}`);
    if (skills.length === 0) {
      console.log("- skills: none");
    } else {
      console.log("- skills:");
      for (const skill of skills) {
        console.log(`  - ${skill.name}`);
      }
    }
    return;
  }

  throw new Error("Unknown claude subcommand.");
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const { command, subcommand, values } = parsed;

  if (!command || command === "--help" || values.help === true) {
    console.log(usage());
    return;
  }

  if (command === "init") {
    await runInit(values);
    return;
  }

  if (command === "setup") {
    await runSetup(values);
    return;
  }

  if (command === "start") {
    await runStart(values);
    return;
  }

  if (command === "resume") {
    await runResume(values);
    return;
  }

  if (command === "doctor" || command === "status") {
    await runDoctor(values);
    return;
  }

  if (command === "audit") {
    await runAudit(subcommand, values);
    return;
  }

  if (command === "roles") {
    await runRoles(values);
    return;
  }

  if (command === "show") {
    await runShow(values);
    return;
  }

  if (command === "install") {
    await runInstall(values);
    return;
  }

  if (command === "mcp") {
    await runMcpSubcommand(subcommand, values);
    return;
  }

  if (command === "search") {
    await runSearch(subcommand, values);
    return;
  }

  if (command === "ask") {
    await runAsk(values);
    return;
  }

  if (command === "clarify") {
    await runClarify(values);
    return;
  }

  if (command === "question") {
    await runQuestion(values);
    return;
  }

  if (command === "clear-question") {
    await runClearQuestion(values);
    return;
  }

  if (command === "prune-questions") {
    await runPruneQuestions(values);
    return;
  }

  if (command === "panel") {
    await runPanelCommand(values);
    return;
  }

  if (command === "sentinel") {
    await runSentinel(values);
    return;
  }

  if (command === "team") {
    await runTeam(values);
    return;
  }

  if (command === "decide") {
    await runDecide(values);
    return;
  }

  if (command === "codex") {
    await runCodexSubcommand(subcommand, values);
    return;
  }

  if (command === "claude") {
    await runClaudeSubcommand(subcommand, values);
    return;
  }

  if (VALID_MODES.has(command as InteractionMode)) {
    if (values.panel === true) {
      await runPanelCommand({
        ...values,
        mode: command
      });
      return;
    }
    await runModeCommand(command as InteractionMode, values);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (message === "Setup cancelled.") {
    exit(1);
  }
  if (message.startsWith("Unknown command:") || message.startsWith("Invalid ")) {
    console.error("");
    console.error(usage());
  }
  exit(1);
});
