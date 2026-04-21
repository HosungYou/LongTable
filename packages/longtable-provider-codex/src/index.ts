import { resolveCheckpointPolicy } from "@longtable/checkpoints";
import type { ProviderCapabilities, QuestionRecord } from "@longtable/core";
import type {
  CheckpointSignal,
  ResearcherProfile,
  ResolvedCheckpointPolicy,
  RuntimeGuidance
} from "@longtable/checkpoints";
import { resolveRuntimeGuidance } from "@longtable/checkpoints";
import {
  buildNumberedCheckpointPrompt,
  parseNumberedCheckpointResponse
} from "@longtable/setup";
import type {
  NumberedCheckpointSpec,
  ParsedCheckpointSelection,
  SetupPersistedOutput
} from "@longtable/setup";

export interface CodexCheckpointContext {
  profile: ResearcherProfile;
  signal: CheckpointSignal;
  spec: NumberedCheckpointSpec;
}

export interface CodexCheckpointResult {
  policy: ResolvedCheckpointPolicy;
  guidance: RuntimeGuidance;
  prompt: string;
  selection?: ParsedCheckpointSelection;
  accepted: boolean;
  reprompt?: string;
}

export interface CodexRuntimeDefaults {
  askAtLeastTwoQuestionsInExplore: boolean;
  preserveNarrativeTraceInDraft: boolean;
  requireWhyMayBeWrongInReview: boolean;
  questionBiasCompensation: "strong";
}

export interface CodexRuntimeBridge {
  provider: "codex";
  checkpointProtocol: "numbered";
  supportsStructuredQuestions: false;
  defaultInteractionMode: SetupPersistedOutput["defaultInteractionMode"];
  profile: ResearcherProfile;
  runtimeDefaults: CodexRuntimeDefaults;
}

export interface CodexRenderedQuestionRecord {
  questionId: string;
  checkpointKey: string;
  spec: NumberedCheckpointSpec;
  prompt: string;
}

export const CODEX_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  provider: "codex",
  nativeStructuredQuestions: false,
  generatedSkills: "stable",
  promptAliases: "unavailable",
  nativeParallelSubagents: "session_dependent",
  sequentialFallback: true,
  mcpTransport: "planned",
  notes: [
    "Codex generated skills are the preferred native surface.",
    "Installed prompt files are not guaranteed to become slash commands in current Codex builds.",
    "Native parallel subagents may exist in an interactive session, but the npm CLI must not require them.",
    "Sequential panel fallback is the stable provider-neutral path."
  ]
};

export function getCodexProviderCapabilities(): ProviderCapabilities {
  return CODEX_PROVIDER_CAPABILITIES;
}

export function normalizeResearcherProfile(
  profile: SetupPersistedOutput["profileSeed"]
): ResearcherProfile {
  return {
    field: profile.field ?? "unspecified",
    careerStage: profile.careerStage,
    experienceLevel: profile.experienceLevel,
    preferredCheckpointIntensity: profile.preferredCheckpointIntensity,
    currentProjectType: profile.currentProjectType ?? "unspecified research task",
    ...(profile.humanAuthorshipSignal ? { humanAuthorshipSignal: profile.humanAuthorshipSignal } : {}),
    ...(profile.aiAutonomyPreference ? { aiAutonomyPreference: profile.aiAutonomyPreference } : {})
  };
}

export function renderRuntimeGuidance(guidance: RuntimeGuidance): string {
  const lines = [
    "LongTable runtime guidance",
    `- mode: ${guidance.mode}`,
    `- closure: ${guidance.closureDisposition}`,
    `- minimum questions before closure: ${guidance.minimumQuestions}`,
    `- question types: ${guidance.questionTypes.length > 0 ? guidance.questionTypes.join(", ") : "none"}`,
    `- questions first: ${guidance.preferQuestionsFirst ? "yes" : "no"}`,
    `- preserve narrative trace: ${guidance.preserveNarrativeTrace ? "yes" : "no"}`
  ];

  if (guidance.includeWhyMayBeWrong) {
    lines.push("- include: why this may be wrong");
  }

  if (guidance.includeOpenTensions) {
    lines.push("- include: open tensions");
  }

  if (guidance.surfaceHumanCommitment) {
    lines.push("- include: why this requires explicit human commitment");
  }

  if (guidance.mandatoryQuestions.length > 0) {
    lines.push("- ask first:");
    for (const question of guidance.mandatoryQuestions) {
      lines.push(`  - ${question}`);
    }
  }

  return lines.join("\n");
}

export function renderCheckpointPrompt(
  spec: NumberedCheckpointSpec,
  guidance?: RuntimeGuidance
): string {
  const sections = [];

  if (guidance) {
    sections.push(renderRuntimeGuidance(guidance));
  }

  sections.push(buildNumberedCheckpointPrompt(spec));
  return sections.join("\n\n");
}

export function questionRecordToNumberedCheckpointSpec(
  record: QuestionRecord
): NumberedCheckpointSpec {
  const options = [
    ...record.prompt.options.map((option) => ({
      value: option.value,
      label: [
        option.label,
        option.recommended ? "(Recommended)" : "",
        option.description ? `— ${option.description}` : ""
      ].filter(Boolean).join(" ")
    })),
    ...(record.prompt.allowOther
      ? [{
          value: "other",
          label: record.prompt.otherLabel ?? "Other"
        }]
      : [])
  ];

  return {
    title: record.prompt.title,
    instructions: [
      record.prompt.question,
      ...record.prompt.rationale.map((entry) => `Why now: ${entry}`),
      `Question id: ${record.id}`,
      `Checkpoint: ${record.prompt.checkpointKey ?? "manual"}`,
      `Required: ${record.prompt.required ? "yes" : "no"}`
    ].join("\n"),
    options,
    allowRationale: true
  };
}

export function renderQuestionRecordPrompt(record: QuestionRecord): CodexRenderedQuestionRecord {
  const spec = questionRecordToNumberedCheckpointSpec(record);
  return {
    questionId: record.id,
    checkpointKey: record.prompt.checkpointKey ?? "manual",
    spec,
    prompt: buildNumberedCheckpointPrompt(spec)
  };
}

export function parseCheckpointResponse(
  spec: NumberedCheckpointSpec,
  input: string
): ParsedCheckpointSelection | null {
  return parseNumberedCheckpointResponse(spec, input);
}

export function buildReprompt(
  spec: NumberedCheckpointSpec,
  guidance?: RuntimeGuidance
): string {
  return [
    "Your response could not be parsed.",
    renderCheckpointPrompt(spec, guidance)
  ].join("\n\n");
}

export function runBlockingCheckpoint(
  context: CodexCheckpointContext,
  input?: string
): CodexCheckpointResult {
  const policy = resolveCheckpointPolicy(context.profile, context.signal);
  const guidance = resolveRuntimeGuidance(context.profile, context.signal, policy);
  const prompt = renderCheckpointPrompt(context.spec, guidance);

  if (!policy.blocking) {
    return {
      policy,
      guidance,
      prompt,
      accepted: false
    };
  }

  const selection = input ? parseCheckpointResponse(context.spec, input) : null;

  if (!selection) {
    return {
      policy,
      guidance,
      prompt,
      accepted: false,
      reprompt: buildReprompt(context.spec, guidance)
    };
  }

  return {
    policy,
    guidance,
    prompt,
    selection,
    accepted: true
  };
}

export function createCodexRuntimeBridge(
  setup: SetupPersistedOutput
): CodexRuntimeBridge {
  return {
    provider: "codex",
    checkpointProtocol: "numbered",
    supportsStructuredQuestions: false,
    defaultInteractionMode: setup.defaultInteractionMode,
    profile: normalizeResearcherProfile(setup.profileSeed),
    runtimeDefaults: {
      askAtLeastTwoQuestionsInExplore: true,
      preserveNarrativeTraceInDraft: true,
      requireWhyMayBeWrongInReview: true,
      questionBiasCompensation: "strong"
    }
  };
}

export * from "./config.js";
export * from "./skills.js";
export * from "./wrapper.js";
