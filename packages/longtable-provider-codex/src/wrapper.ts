import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cwd } from "node:process";
import { resolveCheckpointPolicy, resolveRuntimeGuidance } from "@longtable/checkpoints";
import type { CheckpointLevel, InteractionMode, ResearchStage, ResearcherProfile, RuntimeGuidance } from "@longtable/core";
import { loadSetupOutput, resolveDefaultSetupPath } from "@longtable/setup";
import type { SetupPersistedOutput } from "@longtable/setup";
import { normalizeResearcherProfile, renderRuntimeGuidance } from "./index.js";

export interface CodexThinWrapperOptions {
  prompt: string;
  mode?: InteractionMode;
  researchStage?: ResearchStage;
  workingDirectory?: string;
  setupPath?: string;
}

export interface CodexWrappedPrompt {
  mode: InteractionMode;
  researchStage: ResearchStage;
  guidance: RuntimeGuidance;
  wrappedPrompt: string;
  setupLoaded: boolean;
}

function defaultProfile(): ResearcherProfile {
  return {
    field: "unknown",
    careerStage: "unknown",
    experienceLevel: "intermediate",
    preferredCheckpointIntensity: "balanced",
    currentProjectType: "unspecified research task"
  };
}

function defaultMode(setup?: SetupPersistedOutput): InteractionMode {
  return setup?.defaultInteractionMode ?? "explore";
}

function defaultStage(mode: InteractionMode): ResearchStage {
  switch (mode) {
    case "draft":
      return "writing";
    case "commit":
      return "theory_selection";
    case "submit":
      return "submission";
    case "review":
    case "critique":
      return "analysis_planning";
    case "explore":
    default:
      return "problem_framing";
  }
}

function defaultCheckpointLevel(mode: InteractionMode): CheckpointLevel {
  switch (mode) {
    case "submit":
      return "adaptive_required";
    case "commit":
      return "recommended";
    case "review":
    case "critique":
    case "draft":
    case "explore":
    default:
      return "recommended";
  }
}

async function loadManagedSetup(customPath?: string): Promise<SetupPersistedOutput | null> {
  const target = resolveDefaultSetupPath(customPath).path;

  if (!existsSync(target)) {
    return null;
  }

  try {
    return await loadSetupOutput(customPath);
  } catch {
    return null;
  }
}

function readPromptFromStdin(): string {
  if (process.stdin.isTTY) {
    return "";
  }

  return readFileSync(0, "utf8").trim();
}

export async function buildCodexThinWrappedPrompt(
  options: CodexThinWrapperOptions
): Promise<CodexWrappedPrompt> {
  const setup = await loadManagedSetup(options.setupPath);
  const profile = setup ? normalizeResearcherProfile(setup.profileSeed) : defaultProfile();
  const mode = options.mode ?? defaultMode(setup ?? undefined);
  const researchStage = options.researchStage ?? defaultStage(mode);
  const prompt = options.prompt.trim();
  const signal = {
    checkpointKey: "runtime_guidance",
    baseLevel: defaultCheckpointLevel(mode),
    mode,
    artifactStakes:
      mode === "submit"
        ? "external_submission"
        : mode === "commit"
          ? "study_protocol"
          : mode === "draft"
            ? "internal_draft"
            : "private_note",
    researchStage,
    unresolvedTensions: setup?.initialState.openTensions ?? [],
    studyContract: setup?.initialState.studyContract
  } as const;
  const policy = resolveCheckpointPolicy(profile, signal);
  const guidance = resolveRuntimeGuidance(profile, signal, policy);
  const sections = [renderRuntimeGuidance(guidance)];
  const instructionLines = [
    "LongTable ordering rules",
    guidance.minimumQuestions > 0 || guidance.mustAskBeforeClosure
      ? "- surface the mandatory questions before any recommendation or closure"
      : "- keep the response aligned to the stated mode",
    guidance.includeWhyMayBeWrong ? "- include why this may be wrong before synthesis" : undefined,
    guidance.includeOpenTensions ? "- keep unresolved tensions visible" : undefined,
    guidance.preserveNarrativeTrace ? "- preserve narrative trace and avoid generic fluency" : undefined,
    guidance.surfaceHumanCommitment ? "- make the human commitment stakes explicit before closing" : undefined,
    profile.humanAuthorshipSignal
      ? `- preserve this human authorship signal: ${profile.humanAuthorshipSignal}`
      : undefined
  ].filter(Boolean) as string[];

  sections.push(instructionLines.join("\n"));
  sections.push(["User prompt", prompt].join("\n"));

  return {
    mode,
    researchStage,
    guidance,
    wrappedPrompt: sections.join("\n\n"),
    setupLoaded: Boolean(setup)
  };
}

export interface CodexThinWrapperExecOptions extends CodexThinWrapperOptions {
  json?: boolean;
}

export async function runCodexThinWrapper(
  options: CodexThinWrapperExecOptions
): Promise<number> {
  const prompt = options.prompt.trim() || readPromptFromStdin();

  if (!prompt) {
    throw new Error("A prompt is required. Pass --prompt or pipe text on stdin.");
  }

  const wrapped = await buildCodexThinWrappedPrompt({
    ...options,
    prompt
  });

  const args = [
    "exec",
    "--color",
    "never",
    "-s",
    "read-only",
    "-C",
    options.workingDirectory ?? cwd(),
    "--skip-git-repo-check"
  ];

  if (options.json) {
    args.push("--json");
  }

  args.push(wrapped.wrappedPrompt);

  const result = spawnSync("codex", args, {
    stdio: "inherit"
  });

  return result.status ?? 1;
}
