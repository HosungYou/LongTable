import type { SetupPersistedOutput } from "@longtable/setup";
import { createClaudeRuntimeBridge } from "./index.js";

export interface ClaudeConfigFragment {
  setupPath: string;
  provider: "claude";
  checkpointProtocol: "native_structured";
  defaultInteractionMode: SetupPersistedOutput["defaultInteractionMode"];
  profileSummary: {
    field: string;
    careerStage: string;
    experienceLevel: string;
    currentProjectType: string;
  };
  runtimeGuidance: ReturnType<typeof createClaudeRuntimeBridge>["runtimeDefaults"];
}

export function createClaudeConfigFragment(
  setup: SetupPersistedOutput,
  setupPath: string
): ClaudeConfigFragment {
  const bridge = createClaudeRuntimeBridge(setup);

  return {
    setupPath,
    provider: "claude",
    checkpointProtocol: bridge.checkpointProtocol,
    defaultInteractionMode: bridge.defaultInteractionMode,
    profileSummary: {
      field: bridge.profile.field ?? "unspecified",
      careerStage: bridge.profile.careerStage,
      experienceLevel: bridge.profile.experienceLevel,
      currentProjectType: bridge.profile.currentProjectType ?? "unspecified research task"
    },
    runtimeGuidance: bridge.runtimeDefaults
  };
}

export function renderClaudeConfigJson(
  setup: SetupPersistedOutput,
  setupPath: string
): string {
  return JSON.stringify(createClaudeConfigFragment(setup, setupPath), null, 2);
}
