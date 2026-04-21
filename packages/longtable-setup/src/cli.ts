import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  buildProviderChoices,
  buildQuickSetupFlow,
  createPersistedSetupOutput
} from "./onboarding.js";
import {
  installRuntimeConfigFromStoredSetup,
  loadSetupOutput,
  renderInstallSummary,
  renderSetupSummary,
  resolveDefaultSetupPath,
  saveSetupAndRuntimeConfig,
  saveSetupOutput,
  serializeSetupOutput
} from "./persistence.js";
import type {
  ProviderKind,
  SetupChoice,
  SetupAnswers,
  SetupFlow
} from "./types.js";

function printUsage(): void {
  console.log(`Usage:
  longtable-setup init [--flow quickstart|interview] --provider <codex|claude> --career-stage <stage> --experience <novice|intermediate|advanced> --checkpoint <low|balanced|high> [--field <field>] [--authorship-signal <text>] [--entry-mode <explore|review|critique|draft|commit>] [--weakest-domain <theory|methodology|measurement|analysis|writing>] [--panel-preference <synthesis_only|show_on_conflict|always_visible>] [--json]
  longtable-setup install [--path <file>] [--runtime-path <file>] [--json]
  longtable-setup show [--path <file>] [--json]

Example:
  longtable-setup init --flow interview --provider codex --career-stage doctoral --experience intermediate --checkpoint balanced --entry-mode explore --panel-preference show_on_conflict --json

If required flags are omitted, interactive setup starts automatically.
Use --write to save setup.json and --install to also generate provider runtime config.`);
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      parsed._command = token;
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function requireString(
  args: Record<string, string | boolean>,
  key: string
): string {
  const value = args[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required argument: --${key}`);
  }

  return value;
}

function toSetupAnswers(args: Record<string, string | boolean>): SetupAnswers {
  return {
    field:
      typeof args.field === "string" && args.field.trim().length > 0
        ? args.field.trim()
        : "unspecified",
    careerStage: requireString(args, "career-stage"),
    experienceLevel: requireString(args, "experience") as SetupAnswers["experienceLevel"],
    preferredCheckpointIntensity: requireString(args, "checkpoint") as SetupAnswers["preferredCheckpointIntensity"],
    humanAuthorshipSignal:
      typeof args["authorship-signal"] === "string" && args["authorship-signal"].trim().length > 0
        ? args["authorship-signal"].trim()
        : undefined,
    preferredEntryMode:
      typeof args["entry-mode"] === "string" && args["entry-mode"].trim().length > 0
        ? (args["entry-mode"].trim() as SetupAnswers["preferredEntryMode"])
        : undefined,
    weakestDomain:
      typeof args["weakest-domain"] === "string" && args["weakest-domain"].trim().length > 0
        ? (args["weakest-domain"].trim() as SetupAnswers["weakestDomain"])
        : undefined,
    panelPreference:
      typeof args["panel-preference"] === "string" && args["panel-preference"].trim().length > 0
        ? (args["panel-preference"].trim() as SetupAnswers["panelPreference"])
        : undefined
  };
}

function hasCompleteFlagInput(args: Record<string, string | boolean>): boolean {
  const requiredKeys = [
    "provider",
    "career-stage",
    "experience",
    "checkpoint"
  ];

  return requiredKeys.every((key) => typeof args[key] === "string" && String(args[key]).trim().length > 0);
}

function resolveSetupFlow(args: Record<string, string | boolean>): SetupFlow {
  return args.flow === "interview" ? "interview" : "quickstart";
}

function renderChoices(choices: SetupChoice[]): string {
  return choices
    .map((choice, index) => `${index + 1}. ${choice.label} — ${choice.description}`)
    .join("\n");
}

async function readPipedLines(): Promise<string[]> {
  const chunks: string[] = [];

  for await (const chunk of input) {
    chunks.push(String(chunk));
  }

  return chunks
    .join("")
    .split(/\r?\n/);
}

async function promptChoice(
  rl: ReturnType<typeof createInterface>,
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

      if (freeText.trim().length === 0) {
        console.log("Custom value cannot be empty.");
        continue;
      }

      return freeText.trim();
    }

    return choice.id;
  }
}

function promptChoiceFromLines(
  prompt: string,
  choices: SetupChoice[],
  lines: string[],
  state: { index: number }
): string {
  while (true) {
    console.log(`${prompt}\n${renderChoices(choices)}\nSelect one number: `);

    const answer = lines[state.index] ?? "";
    state.index += 1;

    const numeric = Number(answer.trim());

    if (!Number.isInteger(numeric) || numeric < 1 || numeric > choices.length) {
      console.log("Invalid selection. Enter one of the listed numbers.");
      continue;
    }

    const choice = choices[numeric - 1];

    if (choice.fallbackToText) {
      console.log("Type your custom value: ");
      const freeText = (lines[state.index] ?? "").trim();
      state.index += 1;

      if (freeText.length === 0) {
        console.log("Custom value cannot be empty.");
        continue;
      }

      return freeText;
    }

    return choice.id;
  }
}

interface InitRunOptions {
  jsonOutput: boolean;
  writeOutput: boolean;
  customPath?: string;
  installRuntime: boolean;
  runtimePath?: string;
}

function printInitResult(
  outputValue: ReturnType<typeof createPersistedSetupOutput>,
  options: InitRunOptions,
  installResult?: Awaited<ReturnType<typeof saveSetupAndRuntimeConfig>>
): void {
  if (options.writeOutput && installResult) {
    console.error(`Saved setup output to ${installResult.setupTarget.path}`);
    console.error(`Installed runtime config to ${installResult.runtimeTarget.path}`);
  } else if (options.writeOutput) {
    const target = resolveDefaultSetupPath(options.customPath);
    console.error(`Saved setup output to ${target.path}`);
  }

  if (options.jsonOutput) {
    console.log(serializeSetupOutput(outputValue));
    return;
  }

  const summary = [renderSetupSummary(outputValue)];
  if (installResult) {
    summary.push("");
    summary.push(renderInstallSummary(installResult));
  }

  console.log(summary.join("\n"));
}

async function persistInitResult(
  outputValue: ReturnType<typeof createPersistedSetupOutput>,
  options: InitRunOptions
): Promise<void> {
  let installResult: Awaited<ReturnType<typeof saveSetupAndRuntimeConfig>> | undefined;

  if (options.installRuntime) {
    installResult = await saveSetupAndRuntimeConfig(outputValue, {
      setupPath: options.customPath,
      runtimePath: options.runtimePath
    });
  } else if (options.writeOutput) {
    await saveSetupOutput(outputValue, options.customPath);
  }

  printInitResult(outputValue, options, installResult);
}

async function runNonInteractiveInputSetup(
  options: InitRunOptions,
  flow: SetupFlow
): Promise<void> {
  const lines = await readPipedLines();
  const state = { index: 0 };

  const provider = promptChoiceFromLines(
    "Which provider do you want to configure?",
    buildProviderChoices(),
    lines,
    state
  );

  const answers: Partial<SetupAnswers> = {};

  for (const question of buildQuickSetupFlow(flow)) {
    if (!question.choices) {
      throw new Error(`Question ${question.id} requires choices in non-interactive mode.`);
    }

    const value = promptChoiceFromLines(question.prompt, question.choices, lines, state);
    (answers as Record<string, string>)[question.id] = value;
  }

  const outputValue = createPersistedSetupOutput(
    answers as SetupAnswers,
    provider as ProviderKind,
    flow
  );

  await persistInitResult(outputValue, options);
}

async function runInteractiveSetup(
  options: InitRunOptions,
  flow: SetupFlow
): Promise<void> {
  if (!input.isTTY) {
    await runNonInteractiveInputSetup(options, flow);
    return;
  }

  const rl = createInterface({ input, output });

  try {
    const provider = await promptChoice(
      rl,
      "Which provider do you want to configure?",
      buildProviderChoices()
    );

    const answers: Partial<SetupAnswers> = {};

    for (const question of buildQuickSetupFlow(flow)) {
      if (question.kind !== "single_choice" || !question.choices) {
        const response = await rl.question(`${question.prompt}\n> `);
        if (response.trim().length === 0) {
          console.log("This field cannot be empty.");
          return await runInteractiveSetup(options, flow);
        }
        (answers as Record<string, string>)[question.id] = response.trim();
        continue;
      }

      const value = await promptChoice(rl, question.prompt, question.choices);
      (answers as Record<string, string>)[question.id] = value;
    }

    const outputValue = createPersistedSetupOutput(
      answers as SetupAnswers,
      provider as ProviderKind,
      flow
    );

    await persistInitResult(outputValue, options);
  } finally {
    rl.close();
  }
}

async function printStoredSetup(
  customPath: string | undefined,
  jsonOutput: boolean
): Promise<void> {
  const setup = await loadSetupOutput(customPath);
  console.log(jsonOutput ? serializeSetupOutput(setup) : renderSetupSummary(setup));
}

async function installStoredSetup(
  customPath: string | undefined,
  runtimePath: string | undefined,
  jsonOutput: boolean
): Promise<void> {
  const result = await installRuntimeConfigFromStoredSetup({
    setupPath: customPath,
    runtimePath
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(renderInstallSummary(result));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args._command || args._command === "help" || args._command === "--help") {
    printUsage();
    process.exit(0);
  }

  if (args._command === "show") {
    await printStoredSetup(
      typeof args.path === "string" ? args.path : undefined,
      args.json === true
    );
    return;
  }

  if (args._command === "install") {
    await installStoredSetup(
      typeof args.path === "string" ? args.path : undefined,
      typeof args["runtime-path"] === "string" ? args["runtime-path"] : undefined,
      args.json === true
    );
    return;
  }

  if (args._command !== "init") {
    printUsage();
    throw new Error(`Unknown command: ${String(args._command)}`);
  }

  if (hasCompleteFlagInput(args)) {
    const provider = requireString(args, "provider") as "codex" | "claude";
    const outputValue = createPersistedSetupOutput(
      toSetupAnswers(args),
      provider,
      resolveSetupFlow(args)
    );
    const shouldWrite = args.write === true;
    const shouldInstall = args.install === true;
    const customPath = typeof args.path === "string" ? args.path : undefined;
    const runtimePath = typeof args["runtime-path"] === "string"
      ? args["runtime-path"]
      : undefined;

    await persistInitResult(outputValue, {
      jsonOutput: args.json === true,
      writeOutput: shouldWrite || shouldInstall,
      customPath,
      installRuntime: shouldInstall,
      runtimePath
    });

    return;
  }

  await runInteractiveSetup({
    jsonOutput: args.json === true,
    writeOutput: args.write === true || args.install === true,
    customPath: typeof args.path === "string" ? args.path : undefined,
    installRuntime: args.install === true,
    runtimePath: typeof args["runtime-path"] === "string"
      ? args["runtime-path"]
      : undefined
  }, resolveSetupFlow(args));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
