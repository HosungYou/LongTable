import type { SetupPersistedOutput } from "@longtable/setup";
import { createCodexRuntimeBridge } from "./index.js";

export interface CodexConfigFragment {
  setupPath: string;
  provider: "codex";
  checkpointProtocol: "numbered";
  defaultInteractionMode: SetupPersistedOutput["defaultInteractionMode"];
  profileSummary: {
    field: string;
    careerStage: string;
    experienceLevel: string;
    currentProjectType: string;
  };
  runtimeGuidance: ReturnType<typeof createCodexRuntimeBridge>["runtimeDefaults"];
}

export function createCodexConfigFragment(
  setup: SetupPersistedOutput,
  setupPath: string
): CodexConfigFragment {
  const bridge = createCodexRuntimeBridge(setup);

  return {
    setupPath,
    provider: "codex",
    checkpointProtocol: bridge.checkpointProtocol,
    defaultInteractionMode: bridge.defaultInteractionMode,
    profileSummary: {
      field: bridge.profile.field ?? "unspecified",
      careerStage: bridge.profile.careerStage,
      experienceLevel: bridge.profile.experienceLevel,
      currentProjectType: bridge.profile.currentProjectType
    },
    runtimeGuidance: bridge.runtimeDefaults
  };
}

export function renderCodexConfigToml(
  setup: SetupPersistedOutput,
  setupPath: string
): string {
  const fragment = createCodexConfigFragment(setup, setupPath);

  return [
    "[longtable]",
    `provider = "${fragment.provider}"`,
    `setup_path = "${fragment.setupPath}"`,
    `checkpoint_protocol = "${fragment.checkpointProtocol}"`,
    `default_interaction_mode = "${fragment.defaultInteractionMode}"`,
    "",
    "[longtable.profile]",
    `field = "${fragment.profileSummary.field}"`,
    `career_stage = "${fragment.profileSummary.careerStage}"`,
    `experience_level = "${fragment.profileSummary.experienceLevel}"`,
    `current_project_type = "${fragment.profileSummary.currentProjectType}"`,
    "",
    "[longtable.runtime_guidance]",
    `ask_at_least_two_questions_in_explore = ${fragment.runtimeGuidance.askAtLeastTwoQuestionsInExplore}`,
    `preserve_narrative_trace_in_draft = ${fragment.runtimeGuidance.preserveNarrativeTraceInDraft}`,
    `require_why_may_be_wrong_in_review = ${fragment.runtimeGuidance.requireWhyMayBeWrongInReview}`,
    `question_bias_compensation = "${fragment.runtimeGuidance.questionBiasCompensation}"`
  ].join("\n");
}
