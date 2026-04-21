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
  const baseQuestions: SetupQuestion[] = [
    {
      id: "careerStage",
      prompt: "What kind of researcher role best fits you today?",
      required: true,
      kind: "single_choice",
      choices: buildCareerStageChoices()
    },
    {
      id: "experienceLevel",
      prompt: "How comfortable are you making independent research design decisions right now?",
      required: true,
      kind: "single_choice",
      choices: [
        { id: "novice", label: "Novice", description: "Needs stronger checkpoint guidance." },
        { id: "intermediate", label: "Intermediate", description: "Wants balanced guidance." },
        { id: "advanced", label: "Advanced", description: "Prefers lighter intervention." }
      ]
    },
    {
      id: "preferredCheckpointIntensity",
      prompt: "How strongly should LongTable challenge or slow you down by default?",
      required: true,
      kind: "single_choice",
      choices: [
        { id: "low", label: "Low", description: "Mostly lightweight logging and advisory prompts." },
        { id: "balanced", label: "Balanced", description: "Recommended by default." },
        { id: "high", label: "High", description: "Frequent structured commitment prompts." }
      ]
    },
    {
      id: "humanAuthorshipSignal",
      prompt: "When a piece of writing still feels like yours, what usually makes that true?",
      required: false,
      kind: "single_choice",
      choices: [
        { id: "personal experience in the narrative", label: "Personal experience", description: "Humanity appears through lived experience and situated voice." },
        { id: "visible judgment and reasoning path", label: "Judgment trail", description: "Humanity appears through explicit choices and reasoning history." },
        { id: "contextual nuance that avoids generic fluency", label: "Contextual nuance", description: "Humanity appears through specificity and non-generic framing." },
        { id: "a distinctive voice that still sounds like the researcher", label: "Distinctive voice", description: "Humanity appears through authorial tone and cadence." },
        { id: "other", label: "None of the above", description: "Enter a custom authorship signal.", fallbackToText: true }
      ]
    }
  ];

  if (flow === "quickstart") {
    return baseQuestions;
  }

  return [
    ...baseQuestions,
    {
      id: "preferredEntryMode",
      prompt: "When you first open LongTable, where do you want it to begin?",
      required: false,
      kind: "single_choice",
      choices: [
        { id: "explore", label: "Explore", description: "Open the problem, surface tensions, and ask better questions." },
        { id: "review", label: "Review", description: "Critically inspect a claim, plan, or draft." },
        { id: "critique", label: "Critique", description: "Stress-test weak assumptions and generate counterarguments." },
        { id: "draft", label: "Draft", description: "Write while preserving narrative trace and authorship." },
        { id: "commit", label: "Commit", description: "Slow down and make an explicit research decision." }
      ]
    },
    {
      id: "weakestDomain",
      prompt: "Where do you most want LongTable to push back on you first?",
      required: false,
      kind: "single_choice",
      choices: [
        { id: "theory", label: "Theory", description: "Sharpen framing, constructs, and theoretical defensibility." },
        { id: "methodology", label: "Methodology", description: "Question design fit, sampling, and study structure." },
        { id: "measurement", label: "Measurement", description: "Challenge scales, validity, and operationalization." },
        { id: "analysis", label: "Analysis", description: "Probe analytic logic, interpretation, and evidence claims." },
        { id: "writing", label: "Writing", description: "Preserve voice while improving clarity and argument flow." }
      ]
    },
    {
      id: "panelPreference",
      prompt: "How visible should disagreement between roles be by default?",
      required: false,
      kind: "single_choice",
      choices: [
        { id: "synthesis_only", label: "Synthesis only", description: "Show one LongTable answer unless I ask for more." },
        { id: "show_on_conflict", label: "Show on conflict", description: "Surface panel disagreement when roles materially diverge." },
        { id: "always_visible", label: "Always visible", description: "Keep panel opinions visible by default." }
      ]
    }
  ];
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
    field: answers.field ?? "unspecified",
    currentProjectType: answers.currentProjectType ?? "unspecified research task",
    ...answers,
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
