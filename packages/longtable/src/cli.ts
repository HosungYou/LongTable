#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync, execSync } from "node:child_process";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import type { Interface as ReadlineInterface } from "node:readline/promises";
import { stdin as input, stdout as output, cwd, exit } from "node:process";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { InteractionMode, PanelVisibility, ProviderKind, QuestionRecord, ResearchStage } from "@longtable/core";
import { classifyCheckpointTrigger } from "@longtable/checkpoints";
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
  appendInvocationRecordToWorkspace,
  assertWorkspaceNotBlocked,
  answerWorkspaceQuestion,
  createWorkspaceClarificationCard,
  createWorkspaceQuestion,
  createOrUpdateProjectWorkspace,
  inspectProjectWorkspace,
  loadWorkspaceState,
  loadProjectContextFromDirectory,
  renderProjectWorkspaceSummary,
  syncCurrentWorkspaceView,
  type LongTableProjectContext,
  type LongTableWorkspaceInspection,
  type ProjectDisagreementPreference
} from "./project-session.js";
import {
  buildTeamDebate,
  renderTeamDebateSummary,
  type TeamDebateBundle
} from "./debate.js";

interface ParsedArgs {
  command?: string;
  subcommand?: string;
  values: Record<string, string | boolean>;
}

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
  targets: McpInstallTarget[];
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

const LONGTABLE_MCP_SERVER_NAME = "longtable-state";
const LONGTABLE_MCP_PACKAGE_VERSION = "0.1.19";
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

function renderProgressBar(current: number, total: number): string {
  const width = 10;
  const filled = Math.max(1, Math.round((current / total) * width));
  return `${"█".repeat(filled)}${"·".repeat(Math.max(0, width - filled))}`;
}

function usage(): string {
  return [
    "Usage:",
    "  Run `longtable ...` in your terminal, not inside the Codex chat box.",
    "  After `longtable start`, move into the created project directory and open `codex` there.",
    "",
    "  longtable init [--flow quickstart|interview] [--provider codex|claude] [--career-stage <stage>] [--experience novice|intermediate|advanced] [--checkpoint low|balanced|high] [--field <field>] [--authorship-signal <text>] [--entry-mode explore|review|critique|draft|commit] [--weakest-domain theory|methodology|measurement|analysis|writing] [--panel-preference synthesis_only|show_on_conflict|always_visible] [--json] [--no-install] [--install-skills] [--install-prompts]",
    "  longtable setup [--provider codex|claude] [--json] [--dir <path>] [--skills-dir <path>] [--runtime-path <file>] [--setup-path <file>]",
    "  longtable start [--path <dir>] [--name <project>] [--goal <text>] [--blocker <text>] [--perspectives <role[,role]>] [--disagreement synthesis_only|show_on_conflict|always_visible] [--setup <path>] [--json]",
    "  longtable resume [--cwd <path>] [--json]",
    "  longtable doctor [--cwd <path>] [--fix] [--json] [--codex-dir <path>] [--claude-dir <path>] [--codex-prompts-dir <path>] [--codex-runtime-path <file>] [--claude-runtime-path <file>]",
    "  longtable status [--cwd <path>] [--fix] [--json] [--codex-dir <path>] [--claude-dir <path>] [--codex-prompts-dir <path>] [--codex-runtime-path <file>] [--claude-runtime-path <file>]",
    "  longtable roles [--json]",
    "  longtable show [--json] [--path <file>]",
    "  longtable install [--json] [--path <file>] [--runtime-path <file>]",
    "  longtable mcp install [--provider codex|claude|all] [--write] [--json] [--codex-config <path>] [--claude-settings <path>] [--package <spec>]",
    "  longtable hud [--watch] [--tmux] [--preset minimal|full] [--cwd <path>] [--json]",
    "  longtable sentinel --prompt <text> [--cwd <path>] [--json] [--record]",
    "  longtable team --prompt <text> [--role <role[,role]>] [--tmux] [--debate] [--rounds 5] [--cwd <path>] [--json]",
    "  longtable ask [--prompt <text>] [--print] [--json] [--setup <path>] [--cwd <path>]",
    "  longtable clarify --prompt <task-context> [--provider codex|claude] [--required|--advisory] [--print] [--cwd <path>] [--json] [--force]",
    "  longtable question --prompt <decision-context> [--title <text>] [--text <question>] [--provider codex|claude] [--required|--advisory] [--print] [--cwd <path>] [--json]",
    "  longtable panel [--prompt <text>] [--role <role[,role]>] [--mode review|critique|draft|commit] [--visibility synthesis_only|show_on_conflict|always_visible] [--print] [--json] [--setup <path>] [--cwd <path>]",
    "  longtable decide [--question <id>] --answer <value-or-text> [--rationale <text>] [--provider codex|claude] [--cwd <path>] [--json]",
    "  longtable explore|review|critique|draft|commit|submit [--prompt <text>] [--role <role[,role]>] [--panel] [--show-conflicts] [--show-deliberation] [--print] [--json] [--stage <stage>] [--setup <path>] [--cwd <path>]",
    "  longtable codex persist-init [--answers-json <json> | --stdin | full setup flags] [--install-skills] [--install-prompts] [--json]",
    "  longtable codex install-skills [--dir <path>]",
    "  longtable codex remove-skills [--dir <path>]",
    "  longtable codex install-prompts [--dir <path>]",
    "  longtable codex remove-prompts [--dir <path>]",
    "  longtable codex status [--dir <path>] [--json]",
    "  longtable claude install-skills [--dir <path>]",
    "  longtable claude remove-skills [--dir <path>]",
    "  longtable claude status [--dir <path>] [--json]",
    "  longtable mcp install --provider all",
    "",
    "Examples:",
    "  longtable init --flow interview --provider codex --install-skills",
    "  longtable start",
    "  longtable start --path ~/Research/My-Project --name \"AI Adoption Meta-Analysis\" --goal \"Narrow the review question\"",
    "  cd \"<project-path>\" && codex",
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
    command && ["init", "setup", "start", "resume", "doctor", "status", "roles", "show", "install", "mcp", "codex", "claude", "ask", "clarify", "question", "panel", "decide", "hud", "sentinel", "team"].includes(command);

  let startIndex = 1;
  if (modeCommand) {
    subcommand = undefined;
    startIndex = 1;
  } else if (command === "codex" || command === "claude" || command === "mcp") {
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

function renderChoices(choices: SetupChoice[]): string {
  return choices
    .map((choice, index) => `${index + 1}. ${choice.label} — ${choice.description}`)
    .join("\n");
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

function moveCursorUp(lines: number): string {
  return lines > 0 ? `\u001B[${lines}A` : "";
}

function clearLine(): string {
  return "\u001B[2K\r";
}

function renderArrowMenu(prompt: string, choices: SetupChoice[], selectedIndex: number): string {
  const lines = [style(prompt, ANSI.bold), style("Use ↑/↓ and Enter.", ANSI.dim)];
  for (let index = 0; index < choices.length; index += 1) {
    const prefix = index === selectedIndex ? style(">", `${ANSI.bold}${ANSI.green}`) : " ";
    lines.push(`${prefix} ${choices[index].label} - ${choices[index].description}`);
  }
  return lines.join("\n");
}

function countRenderedLines(text: string): number {
  return text.split("\n").length;
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

async function promptChoiceByNumber(
  rl: ReadlineInterface,
  prompt: string,
  choices: SetupChoice[]
): Promise<string> {
  while (true) {
    const answer = await rl.question(`${prompt}\n${renderChoices(choices)}\nSelect one number: `);
    const numeric = Number(answer.trim());
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > choices.length) {
      console.log("Invalid selection. Enter one of the listed numbers.");
      continue;
    }

    const choice = choices[numeric - 1];
    if (choice.fallbackToText) {
      const freeText = await rl.question("Type your custom value: ");
      if (!freeText.trim()) {
        console.log("Custom value cannot be empty.");
        continue;
      }
      return freeText.trim();
    }

    return choice.id;
  }
}

async function promptText(
  rl: ReadlineInterface,
  prompt: string,
  required: boolean
): Promise<string | undefined> {
  while (true) {
    const answer = (await rl.question(`${prompt}\n> `)).trim();
    if (!required) {
      return answer || undefined;
    }
    if (answer) {
      return answer;
    }
    console.log("This answer cannot be empty.");
  }
}

async function promptChoiceWithArrows(
  rl: ReadlineInterface,
  prompt: string,
  choices: SetupChoice[]
): Promise<string> {
  const stream = input;
  if (!stream.isTTY || !output.isTTY) {
    return promptChoiceByNumber(rl, prompt, choices);
  }

  const previousRawMode = stream.isRaw;
  let selectedIndex = 0;
  let lastRenderLineCount = 0;

  return await new Promise<string>((resolve, reject) => {
    function draw(first = false): void {
      const renderedText = renderArrowMenu(prompt, choices, selectedIndex);
      const rendered = renderedText.split("\n");
      if (!first && lastRenderLineCount > 0) {
        output.write(moveCursorUp(lastRenderLineCount));
      }
      for (const line of rendered) {
        output.write(clearLine());
        output.write(`${line}\n`);
      }
      lastRenderLineCount = countRenderedLines(renderedText);
    }

    function cleanup(): void {
      stream.off("keypress", onKeypress);
      if (stream.isTTY) {
        stream.setRawMode(previousRawMode ?? false);
      }
      output.write("\u001B[?25h");
    }

    async function handleChoice(choice: SetupChoice): Promise<void> {
      cleanup();
      if (choice.fallbackToText) {
        const freeText = await rl.question("Type your custom value: ");
        if (!freeText.trim()) {
          resolve(await promptChoiceWithArrows(rl, prompt, choices));
          return;
        }
        resolve(freeText.trim());
        return;
      }
      resolve(choice.id);
    }

    function onKeypress(_: string, key: { name?: string; ctrl?: boolean }): void {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Setup cancelled."));
        return;
      }

      if (key.name === "up") {
        selectedIndex = selectedIndex === 0 ? choices.length - 1 : selectedIndex - 1;
        draw();
        return;
      }

      if (key.name === "down") {
        selectedIndex = selectedIndex === choices.length - 1 ? 0 : selectedIndex + 1;
        draw();
        return;
      }

      if (key.name === "return") {
        void handleChoice(choices[selectedIndex]);
      }
    }

    emitKeypressEvents(stream);
    stream.setRawMode(true);
    output.write("\u001B[?25l");
    draw(true);
    stream.on("keypress", onKeypress);
  });
}

async function promptChoice(
  rl: ReadlineInterface,
  prompt: string,
  choices: SetupChoice[]
): Promise<string> {
  return promptChoiceWithArrows(rl, prompt, choices);
}

async function promptMultiChoice(
  rl: ReadlineInterface,
  prompt: string,
  choices: SetupChoice[]
): Promise<string[]> {
  const stream = input;
  if (!stream.isTTY || !output.isTTY) {
    const answer = await rl.question(
      `${prompt}\nType comma-separated ids or leave blank for auto.\n> `
    );
    return answer
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  const previousRawMode = stream.isRaw;
  let selectedIndex = 0;
  const selected = new Set<string>();
  let lastRenderLineCount = 0;

  return await new Promise<string[]>((resolvePromise, reject) => {
    function draw(first = false): void {
      const lines = [prompt, "Use ↑/↓, Space to toggle, and Enter to confirm."];
      for (let index = 0; index < choices.length; index += 1) {
        const choice = choices[index];
        const pointer = index === selectedIndex ? ">" : " ";
        const marker = selected.has(choice.id) ? "[x]" : "[ ]";
        lines.push(`${pointer} ${marker} ${choice.label} - ${choice.description}`);
      }
      const renderedText = lines.join("\n");
      if (!first && lastRenderLineCount > 0) {
        output.write(moveCursorUp(lastRenderLineCount));
      }
      for (const line of lines) {
        output.write(clearLine());
        output.write(`${line}\n`);
      }
      lastRenderLineCount = countRenderedLines(renderedText);
    }

    function cleanup(): void {
      stream.off("keypress", onKeypress);
      if (stream.isTTY) {
        stream.setRawMode(previousRawMode ?? false);
      }
      output.write("\u001B[?25h");
    }

    function onKeypress(_: string, key: { name?: string; ctrl?: boolean }): void {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Setup cancelled."));
        return;
      }
      if (key.name === "up") {
        selectedIndex = selectedIndex === 0 ? choices.length - 1 : selectedIndex - 1;
        draw();
        return;
      }
      if (key.name === "down") {
        selectedIndex = selectedIndex === choices.length - 1 ? 0 : selectedIndex + 1;
        draw();
        return;
      }
      if (key.name === "space") {
        const id = choices[selectedIndex].id;
        if (selected.has(id)) {
          selected.delete(id);
        } else {
          selected.add(id);
        }
        draw();
        return;
      }
      if (key.name === "return") {
        cleanup();
        resolvePromise([...selected]);
      }
    }

    emitKeypressEvents(stream);
    stream.setRawMode(true);
    output.write("\u001B[?25l");
    draw(true);
    stream.on("keypress", onKeypress);
  });
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
  const rl = createInterface({ input, output });
  try {
    const flow =
      initialFlow ??
      ((await promptChoice(
        rl,
        "How would you like to set up LongTable?",
        buildSetupFlowChoices()
      )) as SetupFlow);
    console.log("");
    console.log(renderSetupHeader(flow));
    console.log("");

    const provider = await promptChoice(rl, "Which provider do you want to configure?", buildProviderChoices()) as "codex" | "claude";
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
        value = await promptText(rl, prompt, question.required);
      } else if (question.choices) {
        value = await promptChoice(rl, prompt, question.choices);
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
  } finally {
    rl.close();
  }
}

type SetupSurfaceChoice = "cli_only" | "skills" | "skills_mcp" | "skills_mcp_sentinel";
type SetupInterventionChoice = "advisory" | "balanced" | "strong";
type SetupTmuxChoice = "standard" | "hud" | "console";
type SetupTeamChoice = "off" | "panel" | "tmux_team";

function buildPermissionSetupChoices(): {
  surfaces: SetupChoice[];
  intervention: SetupChoice[];
  tmux: SetupChoice[];
  team: SetupChoice[];
} {
  return {
    surfaces: [
      {
        id: "cli_only",
        label: "CLI only",
        description: "Why: least invasive. Tradeoff: no natural in-provider LongTable entrypoints."
      },
      {
        id: "skills",
        label: "Skills",
        description: "Why: enables natural LongTable skill routing. Tradeoff: writes provider skill files."
      },
      {
        id: "skills_mcp",
        label: "Skills + MCP",
        description: "Why: adds structured state access. Tradeoff: writes provider config for MCP transport."
      },
      {
        id: "skills_mcp_sentinel",
        label: "Skills + MCP + Sentinel",
        description: "Why: prepares advisory gap/tacit monitoring. Tradeoff: LongTable may nudge research turns."
      }
    ],
    intervention: [
      {
        id: "advisory",
        label: "Advisory",
        description: "Why: notices gaps without blocking. Tradeoff: you may still miss hard commitments."
      },
      {
        id: "balanced",
        label: "Balanced",
        description: "Why: blocks clear theory, measurement, method, or evidence commitments. Tradeoff: occasional stops."
      },
      {
        id: "strong",
        label: "Strong",
        description: "Why: maximizes judgment protection. Tradeoff: more interruption before closure."
      }
    ],
    tmux: [
      {
        id: "standard",
        label: "Standard chat",
        description: "Why: portable default. Tradeoff: checkpoints and gaps are less persistently visible."
      },
      {
        id: "hud",
        label: "Research HUD",
        description: "Why: keeps goals, blockers, and pending checkpoints visible. Requires tmux."
      },
      {
        id: "console",
        label: "Research console",
        description: "Why: enables a richer tmux layout for HUD and team discussion. Requires tmux."
      }
    ],
    team: [
      {
        id: "off",
        label: "Off",
        description: "Why: simplest. Tradeoff: panel disagreement stays inside one LongTable response."
      },
      {
        id: "panel",
        label: "Structured panel",
        description: "Why: role disagreement is visible without tmux. Tradeoff: not parallel."
      },
      {
        id: "tmux_team",
        label: "Tmux team discussion",
        description: "Why: opens role panes for parallel debate. Tradeoff: terminal complexity and cleanup."
      }
    ]
  };
}

function checkpointIntensityFromIntervention(choice: SetupInterventionChoice): SetupAnswers["preferredCheckpointIntensity"] {
  if (choice === "strong") return "high";
  if (choice === "advisory") return "low";
  return "balanced";
}

async function runSetup(args: Record<string, string | boolean>): Promise<void> {
  const json = args.json === true;
  const rl = createInterface({ input, output });
  try {
    const provider = (typeof args.provider === "string"
      ? (args.provider === "claude" ? "claude" : "codex")
      : await promptChoice(rl, "Which provider should LongTable configure?", buildProviderChoices())) as "codex" | "claude";
    const choices = buildPermissionSetupChoices();
    const surfaces = await promptChoice(
      rl,
      [
        "Which LongTable runtime surfaces should be enabled?",
        "This is a permission choice because skills, MCP, and sentinel support write provider-facing runtime files."
      ].join("\n"),
      choices.surfaces
    ) as SetupSurfaceChoice;
    const intervention = await promptChoice(
      rl,
      "How strongly may LongTable interrupt research decisions?",
      choices.intervention
    ) as SetupInterventionChoice;
    const tmuxMode = await promptChoice(
      rl,
      "Should LongTable recommend a tmux-based research interface?",
      choices.tmux
    ) as SetupTmuxChoice;
    const teamMode = await promptChoice(
      rl,
      "Should LongTable enable agent/team discussion mode?",
      choices.team
    ) as SetupTeamChoice;

    const outputValue = createPersistedSetupOutput(
      {
        field: "unspecified",
        careerStage: "unspecified",
        experienceLevel: "advanced",
        preferredCheckpointIntensity: checkpointIntensityFromIntervention(intervention),
        preferredEntryMode: "explore",
        panelPreference: teamMode === "off" ? "show_on_conflict" : "always_visible"
      },
      provider,
      "quickstart"
    );
    outputValue.initialState.explicitState = {
      ...outputValue.initialState.explicitState,
      runtimeSurfaces: surfaces,
      interventionPosture: intervention,
      tmuxMode,
      teamMode
    };
    if (surfaces === "skills_mcp_sentinel") {
      outputValue.initialState.inferredHypotheses.push({
        hypothesis: "Researcher approved advisory Gap/Tacit Sentinel setup.",
        confidence: 0.95,
        evidence: ["Selected Skills + MCP + Sentinel during permission-first setup."],
        status: "confirmed"
      });
    }

    const result = await saveSetupAndRuntimeConfig(outputValue, {
      setupPath: typeof args["setup-path"] === "string" ? args["setup-path"] : undefined,
      runtimePath: typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined
    });

    const installedSkills = surfaces === "cli_only"
      ? []
      : provider === "codex"
        ? await installCodexSkills(listRoleDefinitions(), typeof args["skills-dir"] === "string" ? args["skills-dir"] : typeof args.dir === "string" ? args.dir : undefined)
        : await installClaudeSkills(listRoleDefinitions(), typeof args["skills-dir"] === "string" ? args["skills-dir"] : typeof args.dir === "string" ? args.dir : undefined);

    const mcpRequested = surfaces === "skills_mcp" || surfaces === "skills_mcp_sentinel";
    if (mcpRequested && !json) {
      console.log("");
      console.log("MCP setup is approved. To write provider config now, run:");
      console.log(`- longtable mcp install --provider ${provider} --write`);
    }

    if (json) {
      console.log(JSON.stringify({
        setup: outputValue,
        runtime: result,
        installedSkills: installedSkills.map((skill) => skill.name),
        mcpRequested,
        tmuxMode,
        teamMode
      }, null, 2));
      return;
    }

    console.log("");
    console.log(renderSetupSummary(outputValue));
    console.log("");
    console.log(renderInstallSummary(result));
    console.log(`Installed skills: ${installedSkills.length}`);
    if (tmuxMode !== "standard") {
      console.log("");
      console.log("Tmux recommendation:");
      console.log("- macOS: brew install tmux");
      console.log("- Ubuntu/Debian: sudo apt install tmux");
      console.log("- Start HUD in an existing tmux session: longtable hud --tmux");
      console.log("- Start a discussion team: longtable team --tmux --prompt \"...\"");
    }
  } finally {
    rl.close();
  }
}

function perspectiveChoices(): SetupChoice[] {
  return PERSONA_DEFINITIONS.map((persona) => ({
    id: persona.key,
    label: persona.label,
    description: persona.shortDescription
  }));
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
  const needsInteractivePrompts =
    !(typeof args.name === "string" && args.name.trim()) ||
    !(typeof args.path === "string" && args.path.trim()) ||
    !(typeof args.goal === "string" && args.goal.trim()) ||
    typeof args.blocker !== "string" ||
    normalizePerspectiveList(typeof args.perspectives === "string" ? args.perspectives : undefined).length === 0 ||
    !(typeof args.disagreement === "string" && args.disagreement.trim());
  const rl = createInterface({ input, output });
  try {
    if (needsInteractivePrompts) {
      console.log("");
      console.log(renderBrandBanner("LongTable", "Project workspace interview"));
      console.log("");
      console.log(renderSectionCard("LongTable Project Start", [
        "We will create a project workspace and a session memory seed for today's work.",
        "At the end, LongTable will tell you exactly which directory to open in Codex."
      ]));
      console.log("");
    }

    const projectName =
      (typeof args.name === "string" && args.name.trim()) ||
      (await promptText(
        rl,
        renderQuestionHeader(1, 6, "Project interview", "What should this project be called?"),
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
                rl,
                renderQuestionHeader(
                  2,
                  6,
                  "Project interview",
                  `Which parent directory should contain this project?\nLongTable will create this folder:\n${suggestedPath}`
                ),
                true
              )
            )!,
            projectName
          ))!;

    const currentGoal =
      (typeof args.goal === "string" && args.goal.trim()) ||
      (
        await promptText(
          rl,
          renderQuestionHeader(3, 6, "Current session", "What are you trying to accomplish in this session?"),
          true
        )
      )!;

    const currentBlocker =
      (typeof args.blocker === "string" && args.blocker.trim()) ||
      (
        await promptText(
          rl,
          renderQuestionHeader(4, 6, "Current session", "What is the main blocker or uncertainty right now?"),
          false
        )
      );

    const requestedPerspectives =
      normalizePerspectiveList(typeof args.perspectives === "string" ? args.perspectives : undefined).length > 0
        ? normalizePerspectiveList(typeof args.perspectives === "string" ? args.perspectives : undefined)
        : await promptMultiChoice(
            rl,
            renderQuestionHeader(
              5,
              6,
              "Perspectives",
              "Which perspectives do you already know you want at the table? Leave everything unchecked for auto."
            ),
            perspectiveChoices()
          );

    const disagreementPreference =
      (typeof args.disagreement === "string" && args.disagreement.trim()) ||
      (await promptChoice(
        rl,
        renderQuestionHeader(
          6,
          6,
          "Disagreement",
          "How visible should disagreement between perspectives be in this project by default?"
        ),
        [
          {
            id: "synthesis_only",
            label: "Synthesis only",
            description: "Show one LongTable answer unless I ask for more."
          },
          {
            id: "show_on_conflict",
            label: "Show on conflict",
            description: "Surface disagreement when the perspectives materially diverge."
          },
          {
            id: "always_visible",
            label: "Always visible",
            description: "Keep panel opinions visible by default."
          }
        ]
      ));

    return {
      projectName: projectName.trim(),
      projectPath: projectPath.trim(),
      currentGoal: currentGoal.trim(),
      ...(currentBlocker?.trim() ? { currentBlocker: currentBlocker.trim() } : {}),
      requestedPerspectives,
      disagreementPreference: disagreementPreference as ProjectDisagreementPreference
    };
  } finally {
    rl.close();
  }
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

async function writeCodexMcpConfig(path: string, block: string, serverName: string): Promise<string> {
  const existing = existsSync(path) ? await readFile(path, "utf8") : "";
  const updated = replaceMarkedCodexMcpBlock(existing, block, serverName);
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

function renderMcpInstallSummary(result: McpInstallResult): string {
  const lines = [
    "LongTable MCP transport",
    `- server: ${result.serverName}`,
    `- package: ${result.packageSpec}`,
    `- command: ${result.command} ${result.args.join(" ")}`,
    `- mode: ${result.write ? "wrote provider config" : "printed config only"}`,
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
  return lines.join("\n").trimEnd();
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
    const targets: McpInstallTarget[] = [];

    for (const provider of providers) {
      if (provider === "codex") {
        const path = resolveCodexMcpConfigPath(args);
        const block = renderCodexMcpBlock(serverName, command, mcpArgs);
        const content = write ? await writeCodexMcpConfig(path, block, serverName) : block;
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
  const expectedCodexSkills = buildCodexSkillSpecs(roles).map((skill) => skill.name);
  const expectedClaudeSkills = buildClaudeSkillSpecs(roles).map((skill) => skill.name);
  const [codexSkills, claudeSkills, codexAliases, workspace] = await Promise.all([
    listInstalledCodexSkills(roles, codexDir),
    listInstalledClaudeSkills(roles, claudeDir),
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
        legacyPromptFilesInstalled: codexAliases.map((alias) => alias.name)
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
    (status.setupExists &&
      (!status.providers.codex.runtimeExists || !status.providers.claude.runtimeExists));

  if (canFix) {
    nextActions.push("longtable doctor --fix");
  }
  if (!status.setupExists) {
    nextActions.push("longtable init --flow interview --provider codex --install-skills");
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
    writtenRuntimeConfigs: [],
    skipped: []
  };

  if (status.providers.codex.missingSkills.length > 0) {
    repair.installedCodexSkills = (await installCodexSkills(roles, codexDir)).map((skill) => skill.name);
  }
  if (status.providers.claude.missingSkills.length > 0) {
    repair.installedClaudeSkills = (await installClaudeSkills(roles, claudeDir)).map((skill) => skill.name);
  }
  if (status.providers.codex.legacyPromptFilesInstalled.length > 0) {
    repair.removedLegacyPromptFiles = await removeCodexPromptAliases(codexPromptsDir);
  }

  if (!status.setupExists) {
    repair.skipped.push("runtime configs require a researcher setup; run `longtable init --flow interview --provider codex` first");
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
    const rl = createInterface({ input, output });
    try {
      console.log(renderBrandBanner("LongTable", "Researcher Checkpoint"));
      console.log("");
      const answer = await promptChoice(
        rl,
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
    } finally {
      rl.close();
    }
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

function renderClarificationCard(questions: QuestionRecord[]): string {
  if (questions.length === 0) {
    return "No new clarification questions are pending for this prompt.";
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

async function answerClarificationCardInTerminal(
  context: LongTableProjectContext,
  questions: QuestionRecord[],
  provider?: ProviderKind
): Promise<void> {
  if (questions.length === 0) {
    return;
  }

  const rl = createInterface({ input, output });
  try {
    console.log(renderBrandBanner("LongTable", "Clarification Card"));
    console.log("");
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const prompt = renderQuestionHeader(index + 1, questions.length, question.prompt.title, question.prompt.question);
      const answer = await promptChoice(rl, prompt, questionRecordToChoices(question));
      await answerWorkspaceQuestion({
        context,
        questionId: question.id,
        answer,
        provider,
        surface: "terminal_selector"
      });
    }
  } finally {
    rl.close();
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
  const result = await createWorkspaceClarificationCard({
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
    console.log(renderClarificationCard(result.questions));
    return;
  }

  await answerClarificationCardInTerminal(context, result.questions, provider);
  console.log("");
  console.log("LongTable clarification decisions recorded");
  console.log(`- answered: ${result.questions.length}`);
  console.log(`- state: ${context.stateFilePath}`);
  console.log(`- current: ${context.currentFilePath}`);
}

async function runAutomaticClarificationIfNeeded(
  prompt: string,
  args: Record<string, string | boolean>
): Promise<boolean> {
  if (args["no-clarify"] === true || args.print === true || args.json === true) {
    return false;
  }

  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const context = await loadProjectContextFromDirectory(workingDirectory);
  if (!context) {
    return false;
  }

  const provider = args.provider === "claude" ? "claude" : args.provider === "codex" ? "codex" : undefined;
  const result = await createWorkspaceClarificationCard({
    context,
    prompt,
    provider,
    required: true
  });

  if (result.questions.length === 0) {
    return false;
  }

  if (!isInteractiveTerminal()) {
    console.log(renderClarificationCard(result.questions));
    return true;
  }

  await answerClarificationCardInTerminal(context, result.questions, provider);
  return false;
}

async function runAsk(args: Record<string, string | boolean>): Promise<void> {
  const prompt = await resolvePrompt(typeof args.prompt === "string" ? args.prompt : undefined);
  if (!prompt) {
    throw new Error("A prompt is required.");
  }

  const directive = parseInvocationDirective(prompt);
  const effectivePrompt = directive.cleanedPrompt;
  const inferred = directive.mode ?? inferModeFromPrompt(effectivePrompt);
  if (inferred === "status") {
    await runDoctor(args);
    return;
  }

  const mode = inferred === "panel" ? "review" : inferred;
  if (await runAutomaticClarificationIfNeeded(effectivePrompt, args)) {
    return;
  }
  const delegatedArgs: Record<string, string | boolean> = {
    ...args,
    prompt: effectivePrompt
  };
  if (directive.roles.length > 0 && typeof delegatedArgs.role !== "string") {
    delegatedArgs.role = directive.roles.join(",");
  }
  if (inferred === "panel" || directive.panel || delegatedArgs.panel === true) {
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

function shellEscape(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
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

function renderHudText(inspection: LongTableWorkspaceInspection, preset: string): string {
  if (!inspection.found) {
    return [
      "LongTable HUD",
      "- workspace: not found",
      "- run `longtable start` for durable research state"
    ].join("\n");
  }
  const lines = [
    "LongTable HUD",
    `- project: ${inspection.project?.name}`,
    `- goal: ${inspection.session?.currentGoal}`,
    ...(inspection.session?.currentBlocker ? [`- blocker: ${inspection.session.currentBlocker}`] : []),
    `- questions: ${inspection.counts?.pendingQuestions ?? 0} pending / ${inspection.counts?.questions ?? 0} total`,
    `- decisions: ${inspection.counts?.decisions ?? 0}`,
    `- invocations: ${inspection.counts?.invocations ?? 0}`
  ];
  if (preset !== "minimal") {
    lines.push("- pending checkpoints:");
    for (const question of inspection.pendingQuestions ?? []) {
      lines.push(`  - ${question.required ? "required" : "advisory"}: ${question.question}`);
    }
    lines.push("- recent decisions:");
    for (const decision of inspection.recentDecisions ?? []) {
      lines.push(`  - ${decision.summary}`);
    }
  }
  return lines.join("\n");
}

async function runHud(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const preset = typeof args.preset === "string" ? args.preset : "full";
  if (args.tmux === true) {
    if (!process.env.TMUX) {
      throw new Error("`longtable hud --tmux` must be run inside an existing tmux session.");
    }
    const launcher = process.argv[1] ?? "longtable";
    const command = `node ${shellEscape(launcher)} hud --watch --preset ${shellEscape(preset)} --cwd ${shellEscape(workingDirectory)}`;
    execFileSync("tmux", ["split-window", "-v", "-l", "10", command], { stdio: "inherit" });
    return;
  }

  while (true) {
    const inspection = await inspectProjectWorkspace(workingDirectory);
    if (args.json === true) {
      console.log(JSON.stringify(inspection, null, 2));
      return;
    }
    if (args.watch === true) {
      process.stdout.write("\u001Bc");
    }
    console.log(renderHudText(inspection, preset));
    if (args.watch !== true) {
      return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  }
}

async function runTeam(args: Record<string, string | boolean>): Promise<void> {
  const workingDirectory = typeof args.cwd === "string" ? args.cwd : cwd();
  const prompt = await resolvePrompt(typeof args.prompt === "string" ? args.prompt : undefined);
  if (!prompt) {
    throw new Error("A prompt is required.");
  }
  const rounds = typeof args.rounds === "string" ? Number(args.rounds) : 5;
  if (!Number.isInteger(rounds) || rounds !== 5) {
    throw new Error("LongTable team debate v1 supports `--rounds 5` only.");
  }
  const setup = await loadOptionalSetup(typeof args.setup === "string" ? args.setup : undefined);
  const projectContext = await loadProjectContextFromDirectory(workingDirectory);
  if (projectContext) {
    await assertWorkspaceNotBlocked(projectContext);
  }
  const projectAware = await buildProjectAwarePrompt(prompt, workingDirectory);
  const fallback = buildPanelFallback({
    prompt,
    mode: "review",
    roleFlag: typeof args.role === "string" ? args.role : undefined,
    provider: setup?.providerSelection.provider as ProviderKind | undefined,
    visibility: "always_visible"
  });
  const teamId = localId("team");
  const teamDir = join(workingDirectory, ".longtable", "team", teamId);

  if (args.debate === true) {
    const debate = buildTeamDebate({
      teamId,
      teamDir,
      prompt: projectAware.prompt,
      roleFlag: typeof args.role === "string" ? args.role : undefined,
      provider: setup?.providerSelection.provider as ProviderKind | undefined,
      visibility: "always_visible",
      roundCount: rounds,
      tmux: args.tmux === true
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

    if (args.tmux === true) {
      const sessionName = `longtable-${teamId.replaceAll("_", "-")}`;
      const shell = process.env.SHELL || "/bin/sh";
      const launcher = process.argv[1] ?? "longtable";
      const leaderCommand = [
        `echo ${shellEscape(`LongTable debate ${teamId}`)}`,
        `echo ${shellEscape(`Artifacts: ${teamDir}`)}`,
        `echo ${shellEscape("Fixed rounds are recorded. Role panes can add live review logs.")}`,
        `echo ${shellEscape(`Checkpoint: ${debate.questionRecord.id}`)}`,
        `exec ${shellEscape(shell)}`
      ].join("; ");
      execFileSync("tmux", ["new-session", "-d", "-s", sessionName, "-c", workingDirectory, leaderCommand], { stdio: "inherit" });

      for (const member of debate.plan.members) {
        const rolePrompt = [
          `LongTable autonomous debate role: ${member.label} (${member.role}).`,
          "Use the fixed debate artifacts as the shared record. Add live notes only; do not answer the researcher checkpoint.",
          `Artifacts: ${teamDir}`,
          "",
          projectAware.prompt
        ].join("\n");
        const logPath = join(teamDir, `${member.role}.debate.log`);
        const command = [
          `node ${shellEscape(launcher)} review --role ${shellEscape(member.role)} --prompt ${shellEscape(rolePrompt)} --cwd ${shellEscape(workingDirectory)} 2>&1 | tee ${shellEscape(logPath)}`,
          `echo ${shellEscape(`Debate role log written to ${logPath}`)}`,
          `exec ${shellEscape(shell)}`
        ].join("; ");
        execFileSync("tmux", ["split-window", "-t", sessionName, "-c", workingDirectory, command], { stdio: "inherit" });
        execFileSync("tmux", ["select-layout", "-t", sessionName, "tiled"], { stdio: "ignore" });
      }

      console.log(`LongTable tmux debate launched: ${sessionName}`);
      console.log(`Attach with: tmux attach -t ${sessionName}`);
      console.log(`Artifacts: ${teamDir}`);
      return;
    }

    console.log(renderTeamDebateSummary(debate.run));
    console.log(`- checkpoint: ${debate.questionRecord.id}`);
    return;
  }

  await mkdir(teamDir, { recursive: true });
  await writeFile(join(teamDir, "prompt.txt"), prompt, "utf8");
  await writeFile(join(teamDir, "plan.json"), JSON.stringify(fallback.plan, null, 2), "utf8");

  if (args.json === true) {
    console.log(JSON.stringify({ teamId, teamDir, plan: fallback.plan }, null, 2));
    return;
  }

  if (args.tmux !== true) {
    console.log(renderPanelSummary(fallback.plan));
    console.log("");
    console.log("Run with `--tmux` to launch role panes for parallel discussion.");
    return;
  }

  const sessionName = `longtable-${teamId.replaceAll("_", "-")}`;
  const shell = process.env.SHELL || "/bin/sh";
  const launcher = process.argv[1] ?? "longtable";
  const leaderCommand = [
    `echo ${shellEscape(`LongTable team ${teamId}`)}`,
    `echo ${shellEscape(`Logs: ${teamDir}`)}`,
    "echo 'Role panes are running. Review logs, then run:'",
    `echo ${shellEscape(`longtable panel --role ${fallback.plan.members.map((member) => member.role).join(",")} --prompt ${JSON.stringify(prompt)}`)}`,
    `exec ${shellEscape(shell)}`
  ].join("; ");
  execFileSync("tmux", ["new-session", "-d", "-s", sessionName, "-c", workingDirectory, leaderCommand], { stdio: "inherit" });

  for (const member of fallback.plan.members) {
    const rolePrompt = [
      `LongTable team discussion role: ${member.label} (${member.role}).`,
      "Give claims, objections, open questions, and evidence needs. Address likely disagreement with other roles.",
      "",
      prompt
    ].join("\n");
    const logPath = join(teamDir, `${member.role}.log`);
    const command = [
      `node ${shellEscape(launcher)} review --role ${shellEscape(member.role)} --prompt ${shellEscape(rolePrompt)} --cwd ${shellEscape(workingDirectory)} 2>&1 | tee ${shellEscape(logPath)}`,
      `echo ${shellEscape(`Role log written to ${logPath}`)}`,
      `exec ${shellEscape(shell)}`
    ].join("; ");
    execFileSync("tmux", ["split-window", "-t", sessionName, "-c", workingDirectory, command], { stdio: "inherit" });
    execFileSync("tmux", ["select-layout", "-t", sessionName, "tiled"], { stdio: "ignore" });
  }

  console.log(`LongTable tmux team launched: ${sessionName}`);
  console.log(`Attach with: tmux attach -t ${sessionName}`);
  console.log(`Logs: ${teamDir}`);
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
  const setupPath = typeof args.setup === "string" ? args.setup : undefined;
  const existingSetup = await loadOptionalSetup(setupPath);

  if (!existingSetup) {
    throw new Error("LongTable global setup is missing. Run `longtable init --flow interview` first.");
  }

  const interview = await collectProjectInterview(existingSetup, args);
  await verifyWritableWorkspaceParent(interview.projectPath);
  const context = await createOrUpdateProjectWorkspace({
    projectName: interview.projectName,
    projectPath: interview.projectPath,
    currentGoal: interview.currentGoal,
    currentBlocker: interview.currentBlocker,
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

  if (subcommand === "install-skills") {
    const installed = await installCodexSkills(roles, customDir);
    console.log(`Installed ${installed.length} LongTable Codex skills in ${resolveCodexSkillsDir(customDir)}`);
    console.log("Use them inside Codex with natural-language triggers such as `lt explore: ...` or `lt panel: ...`.");
    console.log("If you want an explicit trigger, use `$longtable` when your Codex build exposes skills that way.");
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

  if (subcommand === "status") {
    const aliases = await listInstalledCodexPromptAliases(customDir);
    const skills = await listInstalledCodexSkills(roles, customDir);
    const setupPath = resolveDefaultSetupPath(typeof args.path === "string" ? args.path : undefined).path;
    const runtimePath = resolveDefaultRuntimeConfigPath("codex", typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined).path;
    const status = {
      setupPath,
      setupExists: existsSync(setupPath),
      runtimePath,
      runtimeExists: existsSync(runtimePath),
      skillsDir: resolveCodexSkillsDir(customDir),
      skillsInstalled: skills.map((skill) => skill.name),
      promptsDir: resolveCodexPromptsDir(customDir),
      legacyPromptFilesInstalled: aliases.map((alias) => alias.name)
    };

    if (args.json === true) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    console.log("LongTable Codex status");
    console.log(`- setup: ${status.setupExists ? "present" : "missing"} (${setupPath})`);
    console.log(`- codex runtime artifact: ${status.runtimeExists ? "present" : "missing"} (${runtimePath})`);
    console.log(`- skills dir: ${status.skillsDir}`);
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

  if (subcommand === "install-skills") {
    const installed = await installClaudeSkills(roles, customDir);
    console.log(`Installed ${installed.length} LongTable Claude skills in ${resolveClaudeSkillsDir(customDir)}`);
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
    const skills = await listInstalledClaudeSkills(roles, customDir);
    const setupPath = resolveDefaultSetupPath(typeof args.path === "string" ? args.path : undefined).path;
    const runtimePath = resolveDefaultRuntimeConfigPath("claude", typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined).path;
    const status = {
      setupPath,
      setupExists: existsSync(setupPath),
      runtimePath,
      runtimeExists: existsSync(runtimePath),
      skillsDir: resolveClaudeSkillsDir(customDir),
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

  if (command === "panel") {
    await runPanelCommand(values);
    return;
  }

  if (command === "hud") {
    await runHud(values);
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
