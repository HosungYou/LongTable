import { createEmptyResearchState } from "@longtable/memory";
import type {
  ProviderKind,
  SetupChoice,
  SetupFlow,
  ProviderSelection,
  ResearcherProfileSeed,
  SetupAnswers,
  SetupPersistedOutput,
  SetupQuestion
} from "./types.js";

export function buildQuickSetupFlow(flow: SetupFlow = "quickstart"): SetupQuestion[] {
  void flow;
  return [];
}

export function buildProviderChoices(): SetupChoice[] {
  return [
    {
      id: "codex",
      label: "Codex",
      description: "Use numbered checkpoints and Codex runtime surfaces."
    },
    {
      id: "claude",
      label: "Claude",
      description: "Use structured-question capable Claude runtime surfaces."
    }
  ];
}

export function buildFieldChoices(): SetupChoice[] {
  return [
    { id: "education", label: "Education", description: "Learning, instruction, or educational technology." },
    { id: "psychology", label: "Psychology", description: "Behavior, cognition, or social psychology." },
    { id: "hrd", label: "HRD", description: "Human resource development and workplace learning." },
    { id: "management", label: "Management", description: "Organizations, strategy, or business research." },
    { id: "other", label: "None of the above", description: "Enter a custom field.", fallbackToText: true }
  ];
}

export function buildCareerStageChoices(): SetupChoice[] {
  return [
    { id: "doctoral", label: "Doctoral student", description: "Currently in doctoral training." },
    { id: "postdoctoral", label: "Postdoctoral researcher", description: "Research-focused early career stage." },
    { id: "faculty", label: "Faculty", description: "Professor or lecturer role." },
    { id: "industry", label: "Industry researcher", description: "Research outside a university role." },
    { id: "other", label: "None of the above", description: "Enter a custom career stage.", fallbackToText: true }
  ];
}

export function buildProjectTypeChoices(): SetupChoice[] {
  return [
    { id: "journal article", label: "Journal article", description: "A paper targeted at an academic journal." },
    { id: "conference paper", label: "Conference paper", description: "A paper targeted at a conference venue." },
    { id: "proposal", label: "Proposal", description: "A grant, dissertation, or research proposal." },
    { id: "mixed-methods study", label: "Mixed-methods study", description: "A study design spanning multiple methods." },
    { id: "other", label: "None of the above", description: "Enter a custom project type.", fallbackToText: true }
  ];
}

export function isFallbackChoice(choice: SetupChoice | undefined): boolean {
  return choice?.fallbackToText === true;
}

export function normalizeProviderChoice(choice: string): ProviderKind {
  return choice === "claude" ? "claude" : "codex";
}

export function createResearcherProfileSeed(answers: SetupAnswers): ResearcherProfileSeed {
  return {
    ...answers,
    field: answers.field ?? "unspecified",
    careerStage: answers.careerStage ?? "unspecified",
    experienceLevel: answers.experienceLevel ?? "advanced",
    preferredCheckpointIntensity: answers.preferredCheckpointIntensity ?? "balanced",
    currentProjectType: answers.currentProjectType ?? "unspecified research task",
    aiAutonomyPreference:
      answers.experienceLevel === "advanced"
        ? "balanced"
        : answers.experienceLevel === "intermediate"
          ? "balanced"
          : "low"
  };
}

export function resolveProviderSelection(provider: ProviderSelection["provider"]): ProviderSelection {
  if (provider === "claude") {
    return {
      provider,
      checkpointProtocol: "native_structured",
      supportsStructuredQuestions: true
    };
  }

  return {
    provider,
    checkpointProtocol: "numbered",
    supportsStructuredQuestions: false
  };
}

export function createPersistedSetupOutput(
  answers: SetupAnswers,
  provider: ProviderSelection["provider"],
  flow: SetupFlow = "quickstart"
): SetupPersistedOutput {
  const profileSeed = createResearcherProfileSeed(answers);
  const initialState = createEmptyResearchState();

  initialState.explicitState = {
    field: profileSeed.field,
    careerStage: profileSeed.careerStage,
    experienceLevel: profileSeed.experienceLevel,
    ...(profileSeed.currentProjectType
      ? { currentProjectType: profileSeed.currentProjectType }
      : {}),
    preferredCheckpointIntensity: profileSeed.preferredCheckpointIntensity,
    ...(profileSeed.humanAuthorshipSignal
      ? { humanAuthorshipSignal: profileSeed.humanAuthorshipSignal }
      : {}),
    ...(profileSeed.preferredEntryMode
      ? { preferredEntryMode: profileSeed.preferredEntryMode }
      : {}),
    ...(profileSeed.weakestDomain
      ? { weakestDomain: profileSeed.weakestDomain }
      : {}),
    ...(profileSeed.panelPreference
      ? { panelPreference: profileSeed.panelPreference }
      : {}),
    ...(profileSeed.checkpointUiMode
      ? { checkpointUiMode: profileSeed.checkpointUiMode }
      : {})
  };

  if (profileSeed.humanAuthorshipSignal) {
    initialState.narrativeTraces.push({
      id: "setup-human-authorship-signal",
      timestamp: new Date().toISOString(),
      source: "setup",
      traceType: "voice",
      summary: `Researcher identifies human authorship through ${profileSeed.humanAuthorshipSignal}.`,
      visibility: "explicit",
      importance: "high"
    });
  }

  return {
    setupFlow: flow,
    profileSeed,
    providerSelection: resolveProviderSelection(provider),
    defaultInteractionMode: profileSeed.preferredEntryMode ?? "explore",
    initialState
  };
}
