import { resolveCheckpointPolicy } from "@longtable/checkpoints";
import type { ProviderCapabilities, QuestionRecord } from "@longtable/core";
import type {
  CheckpointSignal,
  ResearcherProfile,
  ResolvedCheckpointPolicy,
  RuntimeGuidance
} from "@longtable/checkpoints";
import { resolveRuntimeGuidance } from "@longtable/checkpoints";
import type {
  NumberedCheckpointSpec,
  SetupPersistedOutput
} from "@longtable/setup";

export interface ClaudeChoice {
  id: string;
  label: string;
}

export interface ClaudeAskUserQuestionInput {
  questions: Array<{
    question: string;
    header: string;
    options: Array<{
      label: string;
    }>;
    multiSelect: boolean;
  }>;
}

export interface ClaudeStructuredCheckpoint {
  title: string;
  instructions?: string;
  choices: ClaudeChoice[];
  guidance?: {
    closureDisposition: RuntimeGuidance["closureDisposition"];
    minimumQuestions: number;
    requiredSections: string[];
    mandatoryQuestions: string[];
  };
}

export interface ClaudeCheckpointContext {
  profile: ResearcherProfile;
  signal: CheckpointSignal;
  spec: NumberedCheckpointSpec;
}

export interface ClaudeCheckpointResult {
  policy: ResolvedCheckpointPolicy;
  guidance: RuntimeGuidance;
  structuredPrompt: ClaudeStructuredCheckpoint;
  askUserQuestionInput: ClaudeAskUserQuestionInput;
  blocking: boolean;
}

export interface ClaudeRenderedQuestionRecord {
  questionId: string;
  checkpointKey: string;
  structuredPrompt: ClaudeStructuredCheckpoint;
  askUserQuestionInput: ClaudeAskUserQuestionInput;
}

export interface ClaudeRuntimeDefaults {
  askAtLeastTwoQuestionsInExplore: boolean;
  preserveNarrativeTraceInDraft: boolean;
  requireWhyMayBeWrongInReview: boolean;
  structuredQuestionBias: "strong";
}

export interface ClaudeRuntimeBridge {
  provider: "claude";
  checkpointProtocol: "native_structured";
  supportsStructuredQuestions: true;
  defaultInteractionMode: SetupPersistedOutput["defaultInteractionMode"];
  profile: SetupPersistedOutput["profileSeed"];
  runtimeDefaults: ClaudeRuntimeDefaults;
}

export const CLAUDE_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  provider: "claude",
  nativeStructuredQuestions: true,
  generatedSkills: "stable",
  promptAliases: "unavailable",
  nativeParallelSubagents: "session_dependent",
  sequentialFallback: true,
  mcpTransport: "planned",
  notes: [
    "Claude should prefer native structured questions when the runtime exposes them.",
    "Generated LongTable skills are adapter output from the shared role registry.",
    "Sequential panel fallback remains required so Claude and Codex share one semantic contract."
  ]
};

export function getClaudeProviderCapabilities(): ProviderCapabilities {
  return CLAUDE_PROVIDER_CAPABILITIES;
}

function buildRequiredSections(guidance: RuntimeGuidance): string[] {
  const sections: string[] = [];

  if (guidance.preferQuestionsFirst || guidance.minimumQuestions > 0) {
    sections.push("questions-first");
  }

  if (guidance.includeOpenTensions) {
    sections.push("open-tensions");
  }

  if (guidance.includeWhyMayBeWrong) {
    sections.push("why-this-may-be-wrong");
  }

  if (guidance.preserveNarrativeTrace) {
    sections.push("narrative-trace");
  }

  if (guidance.surfaceHumanCommitment) {
    sections.push("human-commitment");
  }

  return sections;
}

export function renderStructuredCheckpoint(
  spec: NumberedCheckpointSpec,
  guidance?: RuntimeGuidance
): ClaudeStructuredCheckpoint {
  const instructions = [spec.instructions];

  if (guidance) {
    instructions.push(
      `Closure: ${guidance.closureDisposition}. Minimum questions before closure: ${guidance.minimumQuestions}.`
    );
  }

  return {
    title: spec.title,
    instructions: instructions.filter(Boolean).join(" "),
    choices: spec.options.map((option) => ({
      id: option.value,
      label: option.label
    })),
    guidance: guidance
      ? {
          closureDisposition: guidance.closureDisposition,
          minimumQuestions: guidance.minimumQuestions,
          requiredSections: buildRequiredSections(guidance),
          mandatoryQuestions: guidance.mandatoryQuestions
        }
      : undefined
  };
}

export function renderAskUserQuestionInput(
  checkpoint: ClaudeStructuredCheckpoint
): ClaudeAskUserQuestionInput {
  return {
    questions: [
      {
        header: checkpoint.title,
        question: checkpoint.instructions || checkpoint.title,
        options: checkpoint.choices.map((choice) => ({
          label: choice.label
        })),
        multiSelect: false
      }
    ]
  };
}

export function renderStructuredQuestionRecord(
  record: QuestionRecord
): ClaudeStructuredCheckpoint {
  const choices = [
    ...record.prompt.options.map((option) => ({
      id: option.value,
      label: [
        option.label,
        option.recommended ? "(Recommended)" : "",
        option.description ? `— ${option.description}` : ""
      ].filter(Boolean).join(" ")
    })),
    ...(record.prompt.allowOther
      ? [{
          id: "other",
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
    ].join(" "),
    choices
  };
}

export function renderQuestionRecordInput(
  record: QuestionRecord
): ClaudeRenderedQuestionRecord {
  const structuredPrompt = renderStructuredQuestionRecord(record);
  return {
    questionId: record.id,
    checkpointKey: record.prompt.checkpointKey ?? "manual",
    structuredPrompt,
    askUserQuestionInput: renderAskUserQuestionInput(structuredPrompt)
  };
}

export function createClaudeCheckpoint(
  context: ClaudeCheckpointContext
): ClaudeCheckpointResult {
  const policy = resolveCheckpointPolicy(context.profile, context.signal);
  const guidance = resolveRuntimeGuidance(context.profile, context.signal, policy);
  const structuredPrompt = renderStructuredCheckpoint(context.spec, guidance);

  return {
    policy,
    guidance,
    structuredPrompt,
    askUserQuestionInput: renderAskUserQuestionInput(structuredPrompt),
    blocking: policy.blocking
  };
}

export function createClaudeRuntimeBridge(
  setup: SetupPersistedOutput
): ClaudeRuntimeBridge {
  return {
    provider: "claude",
    checkpointProtocol: "native_structured",
    supportsStructuredQuestions: true,
    defaultInteractionMode: setup.defaultInteractionMode,
    profile: setup.profileSeed,
    runtimeDefaults: {
      askAtLeastTwoQuestionsInExplore: true,
      preserveNarrativeTraceInDraft: true,
      requireWhyMayBeWrongInReview: true,
      structuredQuestionBias: "strong"
    }
  };
}

export * from "./config.js";
export * from "./skills.js";
