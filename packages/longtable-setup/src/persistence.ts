import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ProviderKind } from "@longtable/core";
import {
  createPersistedSetupOutput
} from "./onboarding.js";
import type {
  RuntimeConfigTarget,
  SetupAnswers,
  SetupInstallResult,
  SetupPersistedOutput,
  SetupStorageTarget
} from "./types.js";

export function serializeSetupOutput(output: SetupPersistedOutput): string {
  return JSON.stringify(output, null, 2);
}

export function parseSetupOutput(input: string): SetupPersistedOutput {
  return JSON.parse(input) as SetupPersistedOutput;
}

export function createSetupOutputExample(
  provider: ProviderKind,
  overrides: Partial<SetupAnswers> = {}
): SetupPersistedOutput {
  return createPersistedSetupOutput(
    {
      field: overrides.field ?? "education",
      careerStage: overrides.careerStage ?? "doctoral",
      experienceLevel: overrides.experienceLevel ?? "intermediate",
      preferredCheckpointIntensity: overrides.preferredCheckpointIntensity ?? "balanced"
    },
    provider
  );
}

export function renderSetupSummary(output: SetupPersistedOutput): string {
  const lines = [
    "LongTable setup summary",
    `setup flow: ${output.setupFlow}`,
    `provider: ${output.providerSelection.provider}`,
    `checkpoint protocol: ${output.providerSelection.checkpointProtocol}`,
    `default mode: ${output.defaultInteractionMode}`,
    `field: ${output.profileSeed.field}`,
    `career stage: ${output.profileSeed.careerStage}`,
    `experience: ${output.profileSeed.experienceLevel}`,
    `checkpoint intensity: ${output.profileSeed.preferredCheckpointIntensity}`
  ];

  if (output.profileSeed.weakestDomain) {
    lines.push(`challenge first: ${output.profileSeed.weakestDomain}`);
  }
  if (output.profileSeed.panelPreference) {
    lines.push(`panel preference: ${output.profileSeed.panelPreference}`);
  }

  return lines.join("\n");
}

export function resolveDefaultSetupPath(
  customPath?: string
): SetupStorageTarget {
  const targetPath = customPath
    ? resolve(customPath)
    : join(homedir(), ".longtable", "setup.json");

  return {
    path: targetPath,
    directory: dirname(targetPath)
  };
}

export function resolveDefaultRuntimeConfigPath(
  provider: ProviderKind,
  customPath?: string
): RuntimeConfigTarget {
  const format = provider === "codex" ? "toml" : "json";
  const fileName = provider === "codex" ? "longtable.toml" : "longtable.json";
  const targetPath = customPath
    ? resolve(customPath)
    : join(homedir(), ".longtable", "runtime", provider, fileName);

  return {
    provider,
    path: targetPath,
    directory: dirname(targetPath),
    format
  };
}

export async function saveSetupOutput(
  output: SetupPersistedOutput,
  customPath?: string
): Promise<SetupStorageTarget> {
  const target = resolveDefaultSetupPath(customPath);

  await mkdir(target.directory, { recursive: true });
  await writeFile(target.path, serializeSetupOutput(output), "utf8");

  return target;
}

export async function loadSetupOutput(
  customPath?: string
): Promise<SetupPersistedOutput> {
  const target = resolveDefaultSetupPath(customPath);
  const content = await readFile(target.path, "utf8");
  return parseSetupOutput(content);
}

function resolveRuntimeGuidance(output: SetupPersistedOutput): Record<string, string | boolean> {
  if (output.providerSelection.provider === "codex") {
    return {
      askAtLeastTwoQuestionsInExplore: true,
      preserveNarrativeTraceInDraft: true,
      requireWhyMayBeWrongInReview: true,
      questionBiasCompensation: "strong"
    };
  }

  return {
    askAtLeastTwoQuestionsInExplore: true,
    preserveNarrativeTraceInDraft: true,
    requireWhyMayBeWrongInReview: true,
    structuredQuestionBias: "strong"
  };
}

function renderCodexRuntimeConfig(
  output: SetupPersistedOutput,
  setupPath: string
): string {
  const runtimeGuidance = resolveRuntimeGuidance(output);

  return [
    "[longtable]",
    `provider = "${output.providerSelection.provider}"`,
    `setup_path = "${setupPath}"`,
    `checkpoint_protocol = "${output.providerSelection.checkpointProtocol}"`,
    `default_interaction_mode = "${output.defaultInteractionMode}"`,
    `setup_flow = "${output.setupFlow}"`,
    "",
    "[longtable.profile]",
    `field = "${output.profileSeed.field}"`,
    `career_stage = "${output.profileSeed.careerStage}"`,
    `experience_level = "${output.profileSeed.experienceLevel}"`,
    ...(output.profileSeed.currentProjectType && output.profileSeed.currentProjectType !== "unspecified research task"
      ? [`current_project_type = "${output.profileSeed.currentProjectType}"`]
      : []),
    ...(output.profileSeed.weakestDomain
      ? [`weakest_domain = "${output.profileSeed.weakestDomain}"`]
      : []),
    ...(output.profileSeed.panelPreference
      ? [`panel_preference = "${output.profileSeed.panelPreference}"`]
      : []),
    "",
    "[longtable.runtime_guidance]",
    `ask_at_least_two_questions_in_explore = ${runtimeGuidance.askAtLeastTwoQuestionsInExplore}`,
    `preserve_narrative_trace_in_draft = ${runtimeGuidance.preserveNarrativeTraceInDraft}`,
    `require_why_may_be_wrong_in_review = ${runtimeGuidance.requireWhyMayBeWrongInReview}`,
    `question_bias_compensation = "${runtimeGuidance.questionBiasCompensation}"`
  ].join("\n");
}

function renderClaudeRuntimeConfig(
  output: SetupPersistedOutput,
  setupPath: string
): string {
  const runtimeGuidance = resolveRuntimeGuidance(output);

  return JSON.stringify(
    {
      setupPath,
      provider: output.providerSelection.provider,
      checkpointProtocol: output.providerSelection.checkpointProtocol,
      defaultInteractionMode: output.defaultInteractionMode,
      setupFlow: output.setupFlow,
      profileSummary: {
        field: output.profileSeed.field,
        careerStage: output.profileSeed.careerStage,
        experienceLevel: output.profileSeed.experienceLevel,
        currentProjectType:
          output.profileSeed.currentProjectType && output.profileSeed.currentProjectType !== "unspecified research task"
            ? output.profileSeed.currentProjectType
            : undefined,
        weakestDomain: output.profileSeed.weakestDomain,
        panelPreference: output.profileSeed.panelPreference
      },
      runtimeGuidance
    },
    null,
    2
  );
}

export function renderRuntimeConfig(
  output: SetupPersistedOutput,
  setupPath: string
): string {
  return output.providerSelection.provider === "codex"
    ? renderCodexRuntimeConfig(output, setupPath)
    : renderClaudeRuntimeConfig(output, setupPath);
}

export async function writeRuntimeConfig(
  output: SetupPersistedOutput,
  setupPath: string,
  customPath?: string
): Promise<RuntimeConfigTarget> {
  const target = resolveDefaultRuntimeConfigPath(
    output.providerSelection.provider,
    customPath
  );

  await mkdir(target.directory, { recursive: true });
  await writeFile(target.path, renderRuntimeConfig(output, setupPath), "utf8");

  return target;
}

export async function saveSetupAndRuntimeConfig(
  output: SetupPersistedOutput,
  options: {
    setupPath?: string;
    runtimePath?: string;
  } = {}
): Promise<SetupInstallResult> {
  const setupTarget = await saveSetupOutput(output, options.setupPath);
  const runtimeTarget = await writeRuntimeConfig(
    output,
    setupTarget.path,
    options.runtimePath
  );

  return {
    provider: output.providerSelection.provider,
    setupTarget,
    runtimeTarget
  };
}

export async function installRuntimeConfigFromStoredSetup(
  options: {
    setupPath?: string;
    runtimePath?: string;
  } = {}
): Promise<SetupInstallResult> {
  const setupTarget = resolveDefaultSetupPath(options.setupPath);
  const output = await loadSetupOutput(options.setupPath);
  const runtimeTarget = await writeRuntimeConfig(
    output,
    setupTarget.path,
    options.runtimePath
  );

  return {
    provider: output.providerSelection.provider,
    setupTarget,
    runtimeTarget
  };
}

export function renderInstallSummary(result: SetupInstallResult): string {
  return [
    "LongTable runtime install summary",
    `provider: ${result.provider}`,
    `setup path: ${result.setupTarget.path}`,
    `runtime config path: ${result.runtimeTarget.path}`,
    `runtime config format: ${result.runtimeTarget.format}`
  ].join("\n");
}
