#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import type { Interface as ReadlineInterface } from "node:readline/promises";
import { stdin as input, stdout as output, cwd, exit } from "node:process";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import type { InteractionMode, ResearchStage } from "@longtable/core";
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
  type SetupAnswers,
  type SetupChoice,
  type SetupFlow
} from "@longtable/setup";
import { buildCodexThinWrappedPrompt, runCodexThinWrapper } from "@longtable/provider-codex";
import {
  installCodexPromptAliases,
  listInstalledCodexPromptAliases,
  removeCodexPromptAliases,
  resolveCodexPromptsDir
} from "./prompt-aliases.js";
import { buildPersonaGuidance, parseInvocationDirective } from "./persona-router.js";
import { PERSONA_DEFINITIONS } from "./personas.js";
import {
  createOrUpdateProjectWorkspace,
  loadProjectContextFromDirectory,
  renderProjectWorkspaceSummary,
  syncCurrentWorkspaceView,
  type ProjectDisagreementPreference
} from "./project-session.js";

interface ParsedArgs {
  command?: string;
  subcommand?: string;
  values: Record<string, string | boolean>;
}

interface CodexPersistAnswers {
  provider: "codex" | "claude";
  flow?: SetupFlow;
  field: string;
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
    "  longtable init [--flow quickstart|interview] [--provider codex|claude] [--field <field>] [--career-stage <stage>] [--experience novice|intermediate|advanced] [--checkpoint low|balanced|high] [--authorship-signal <text>] [--entry-mode explore|review|critique|draft|commit] [--weakest-domain theory|methodology|measurement|analysis|writing] [--panel-preference synthesis_only|show_on_conflict|always_visible] [--json] [--no-install] [--install-prompts]",
    "  longtable start [--path <dir>] [--name <project>] [--goal <text>] [--blocker <text>] [--perspectives <role[,role]>] [--disagreement synthesis_only|show_on_conflict|always_visible] [--setup <path>] [--json]",
    "  longtable resume [--cwd <path>] [--json]",
    "  longtable roles [--json]",
    "  longtable show [--json] [--path <file>]",
    "  longtable install [--json] [--path <file>] [--runtime-path <file>]",
    "  longtable ask [--prompt <text>] [--print] [--json] [--setup <path>] [--cwd <path>]",
    "  longtable explore|review|critique|draft|commit|submit [--prompt <text>] [--role <role[,role]>] [--panel] [--show-conflicts] [--show-deliberation] [--print] [--json] [--stage <stage>] [--setup <path>] [--cwd <path>]",
    "  longtable codex persist-init [--answers-json <json> | --stdin | full setup flags] [--install-prompts] [--json]",
    "  longtable codex install-prompts [--dir <path>]",
    "  longtable codex remove-prompts [--dir <path>]",
    "  longtable codex status [--dir <path>] [--json]",
    "",
    "Examples:",
    "  longtable init --flow interview --install-prompts",
    "  longtable start",
    "  longtable start --path ~/Research/My-Project --name \"AI Adoption Meta-Analysis\" --goal \"Narrow the review question\"",
    "  cd \"<project-path>\" && codex",
    "  longtable roles",
    "  longtable ask --prompt \"연구를 시작하고 싶어. 지금 어디서부터 좁혀야 할지 모르겠어.\"",
    "  printf '{\"provider\":\"codex\",...}' | longtable codex persist-init --stdin --install-prompts",
    "  longtable codex install-prompts"
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, maybeSubcommand] = argv;
  const values: Record<string, string | boolean> = {};
  let subcommand: string | undefined = maybeSubcommand;

  const modeCommand = command && VALID_MODES.has(command as InteractionMode);
  const directCommand =
    command && ["init", "start", "resume", "roles", "show", "install", "codex", "ask"].includes(command);

  let startIndex = 1;
  if (modeCommand) {
    subcommand = undefined;
    startIndex = 1;
  } else if (command === "codex") {
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
  if (questionId === "field" || questionId === "careerStage" || questionId === "experienceLevel") {
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
  const required = ["provider", "field", "career-stage", "experience", "checkpoint"];
  return required.every((key) => typeof args[key] === "string" && String(args[key]).trim().length > 0);
}

function resolveSetupFlow(args: Record<string, string | boolean>): SetupFlow {
  return String(args.flow) === "interview" ? "interview" : "quickstart";
}

function toSetupAnswers(args: Record<string, string | boolean>): SetupAnswers {
  return {
    field: String(args.field),
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

      if (question.id === "field") answers.field = value;
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
      field: raw.field,
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
  const customPath = typeof args.path === "string" ? args.path : undefined;
  const runtimePath = typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined;
  const promptsDir = typeof args.dir === "string" ? args.dir : undefined;

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

  if (json) {
    console.log(serializeSetupOutput(outputValue));
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
      console.log(`- /prompts:${prompt.name}`);
    }
    console.log("  Note: whether Codex exposes these as slash commands depends on your Codex build.");
  }

  if (provider === "codex") {
    console.log("");
    console.log("Next step:");
    console.log("- Start here: `longtable start`.");
    console.log("- If you want a direct natural-language entry: `longtable ask --prompt \"...\"`.");
    console.log("- Codex prompt files are available as an experimental integration, not the primary path.");
    console.log("- Suggested next action: create a project workspace and let LongTable interview the current session.");
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

  if (args.json === true) {
    console.log(
      JSON.stringify(
        {
          setup: outputValue,
          install: result,
          installedPrompts: installedPrompts.map((prompt) => prompt.name)
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
      console.log(`- /prompts:${prompt.name}`);
    }
    console.log("  Note: whether Codex exposes these as slash commands depends on your Codex build.");
  }

  if (provider === "codex") {
    console.log("");
    console.log("Next step:");
    console.log("- Start here: `longtable start`.");
    console.log("- If you want a direct natural-language entry: `longtable ask --prompt \"...\"`.");
    console.log("- Codex prompt files are available as an experimental integration, not the primary path.");
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

async function runAsk(args: Record<string, string | boolean>): Promise<void> {
  const prompt = await resolvePrompt(typeof args.prompt === "string" ? args.prompt : undefined);
  if (!prompt) {
    throw new Error("A prompt is required.");
  }

  const directive = parseInvocationDirective(prompt);
  const effectivePrompt = directive.cleanedPrompt;
  const inferred = directive.mode ?? inferModeFromPrompt(effectivePrompt);
  if (inferred === "status") {
    await runCodexSubcommand("status", args);
    return;
  }

  const mode = inferred === "panel" ? "review" : inferred;
  const delegatedArgs: Record<string, string | boolean> = {
    ...args,
    prompt: effectivePrompt
  };
  if (directive.roles.length > 0 && typeof delegatedArgs.role !== "string") {
    delegatedArgs.role = directive.roles.join(",");
  }
  if ((inferred === "panel" || directive.panel) && delegatedArgs.panel !== true) {
    delegatedArgs.panel = true;
    delegatedArgs["show-conflicts"] = true;
  }
  await runModeCommand(mode, delegatedArgs);
}

async function runRoles(args: Record<string, string | boolean>): Promise<void> {
  const payload = PERSONA_DEFINITIONS.map((persona) => ({
    key: persona.key,
    label: persona.label,
    description: persona.shortDescription,
    triggerMode: persona.triggerMode,
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

  if (subcommand === "install-prompts") {
    const installed = await installCodexPromptAliases(customDir);
    console.log(`Installed ${installed.length} LongTable prompt aliases in ${resolveCodexPromptsDir(customDir)}`);
    console.log("Note: prompt-file discovery depends on the Codex build. Treat this as an experimental integration.");
    for (const prompt of installed) {
      console.log(`- /prompts:${prompt.name}`);
    }
    return;
  }

  if (subcommand === "persist-init") {
    await runCodexPersistInit(args);
    return;
  }

  if (subcommand === "remove-prompts") {
    const removed = await removeCodexPromptAliases(customDir);
    console.log(`Removed ${removed.length} LongTable prompt aliases from ${resolveCodexPromptsDir(customDir)}`);
    return;
  }

  if (subcommand === "status") {
    const aliases = await listInstalledCodexPromptAliases(customDir);
    const setupPath = resolveDefaultSetupPath(typeof args.path === "string" ? args.path : undefined).path;
    const runtimePath = resolveDefaultRuntimeConfigPath("codex", typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined).path;
    const status = {
      setupPath,
      setupExists: existsSync(setupPath),
      runtimePath,
      runtimeExists: existsSync(runtimePath),
      promptsDir: resolveCodexPromptsDir(customDir),
      promptAliasesInstalled: aliases.map((alias) => alias.name)
    };

    if (args.json === true) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    console.log("LongTable Codex status");
    console.log(`- setup: ${status.setupExists ? "present" : "missing"} (${setupPath})`);
    console.log(`- codex runtime artifact: ${status.runtimeExists ? "present" : "missing"} (${runtimePath})`);
    console.log(`- prompt aliases dir: ${status.promptsDir}`);
    console.log("- prompt-file integration: experimental (your Codex build may not expose these as slash commands)");
    if (aliases.length === 0) {
      console.log("- prompt aliases: none");
    } else {
      console.log("- prompt aliases:");
      for (const alias of aliases) {
        console.log(`  - /prompts:${alias.name}`);
      }
    }
    return;
  }

  throw new Error("Unknown codex subcommand.");
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

  if (command === "start") {
    await runStart(values);
    return;
  }

  if (command === "resume") {
    await runResume(values);
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

  if (command === "ask") {
    await runAsk(values);
    return;
  }

  if (command === "codex") {
    await runCodexSubcommand(subcommand, values);
    return;
  }

  if (VALID_MODES.has(command as InteractionMode)) {
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
