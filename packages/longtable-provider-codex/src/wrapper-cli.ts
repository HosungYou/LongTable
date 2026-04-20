#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { cwd, exit } from "node:process";
import type { InteractionMode, ResearchStage } from "@longtable/core";
import { buildCodexThinWrappedPrompt, runCodexThinWrapper } from "./wrapper.js";

interface ParsedArgs {
  prompt?: string;
  mode?: InteractionMode;
  stage?: ResearchStage;
  setupPath?: string;
  workingDirectory?: string;
  json: boolean;
  print: boolean;
  exec: boolean;
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

function usage(): string {
  return [
    "Usage:",
    "  longtable-codex-wrapper --print --prompt \"...\" [--mode explore] [--stage problem_framing]",
    "  longtable-codex-wrapper --exec --prompt \"...\" [--mode review] [--json]",
    "",
    "Options:",
    "  --prompt <text>       Prompt to wrap before sending to Codex",
    "  --mode <mode>         explore|review|critique|draft|commit|submit",
    "  --stage <stage>       problem_framing|theory_selection|method_design|measurement_design|analysis_planning|writing|submission",
    "  --setup <path>        Override managed setup path",
    "  --cwd <path>          Working directory to pass to codex exec",
    "  --print               Print the wrapped prompt only",
    "  --exec                Run codex exec with the wrapped prompt",
    "  --json                When used with --exec, request JSONL events from Codex",
    "  --help                Show this message"
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    workingDirectory: cwd(),
    json: false,
    print: false,
    exec: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case "--prompt":
        parsed.prompt = argv[index + 1];
        index += 1;
        break;
      case "--mode":
        if (!VALID_MODES.has(argv[index + 1] as InteractionMode)) {
          throw new Error(`Invalid mode: ${argv[index + 1]}`);
        }
        parsed.mode = argv[index + 1] as InteractionMode;
        index += 1;
        break;
      case "--stage":
        if (!VALID_STAGES.has(argv[index + 1] as ResearchStage)) {
          throw new Error(`Invalid stage: ${argv[index + 1]}`);
        }
        parsed.stage = argv[index + 1] as ResearchStage;
        index += 1;
        break;
      case "--setup":
        parsed.setupPath = argv[index + 1];
        index += 1;
        break;
      case "--cwd":
        parsed.workingDirectory = argv[index + 1];
        index += 1;
        break;
      case "--json":
        parsed.json = true;
        break;
      case "--print":
        parsed.print = true;
        break;
      case "--exec":
        parsed.exec = true;
        break;
      case "--help":
        console.log(usage());
        exit(0);
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!parsed.print && !parsed.exec) {
    parsed.print = true;
  }

  return parsed;
}

function resolvePrompt(prompt?: string): string {
  if (prompt && prompt.trim()) {
    return prompt.trim();
  }

  if (!process.stdin.isTTY) {
    return readFileSync(0, "utf8").trim();
  }

  return "";
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const prompt = resolvePrompt(args.prompt);

  if (!prompt) {
    throw new Error("A prompt is required. Pass --prompt or pipe text on stdin.");
  }

  if (args.print) {
    const wrapped = await buildCodexThinWrappedPrompt({
      prompt,
      mode: args.mode,
      researchStage: args.stage,
      setupPath: args.setupPath,
      workingDirectory: args.workingDirectory
    });

    console.log(wrapped.wrappedPrompt);
    return;
  }

  const exitCode = await runCodexThinWrapper({
    prompt,
    mode: args.mode,
    researchStage: args.stage,
    setupPath: args.setupPath,
    workingDirectory: args.workingDirectory,
    json: args.json
  });

  exit(exitCode);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  console.error(usage());
  exit(1);
});
