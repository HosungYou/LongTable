import type {
  ArtifactStakes,
  CheckpointLevel,
  CheckpointSignal,
  PromptStyle,
  ResearcherProfile,
  ResolvedCheckpointPolicy
} from "./types.js";

const REQUIRED_LEVELS = new Set<CheckpointLevel>([
  "universal_required",
  "adaptive_required"
]);

function escalate(level: CheckpointLevel): CheckpointLevel {
  switch (level) {
    case "none":
      return "log_only";
    case "log_only":
      return "recommended";
    case "recommended":
      return "adaptive_required";
    default:
      return level;
  }
}

function downgrade(level: CheckpointLevel): CheckpointLevel {
  switch (level) {
    case "adaptive_required":
      return "recommended";
    case "recommended":
      return "log_only";
    case "log_only":
      return "none";
    default:
      return level;
  }
}

function pickPromptStyle(level: CheckpointLevel): PromptStyle {
  switch (level) {
    case "universal_required":
      return "structured_choice";
    case "adaptive_required":
      return "confirm_or_revise";
    case "recommended":
      return "advisory_summary";
    default:
      return "passive_log";
  }
}

function isHighStakeArtifact(artifactStakes: ArtifactStakes): boolean {
  return artifactStakes === "study_protocol" || artifactStakes === "external_submission";
}

export function resolveCheckpointPolicy(
  profile: ResearcherProfile,
  signal: CheckpointSignal
): ResolvedCheckpointPolicy {
  let level = signal.baseLevel;
  const rationale: string[] = [];
  const unresolvedTensions = [
    ...(signal.unresolvedTensions ?? []),
    ...(signal.studyContract?.openTensions ?? [])
  ];

  if (level === "universal_required") {
    rationale.push("Universal checkpoints stay blocking across researcher profiles.");
  }

  if (!signal.studyContract && (signal.mode === "commit" || signal.mode === "submit")) {
    rationale.push("No study contract is attached to this decision context.");
  }

  if (
    level === "adaptive_required" &&
    (signal.mode === "explore" || signal.mode === "review" || signal.mode === "critique") &&
    signal.artifactStakes === "private_note"
  ) {
    level = "recommended";
    rationale.push("Exploration on a private note should not hard-stop an adaptive checkpoint.");
  }

  if (
    profile.experienceLevel === "novice" &&
    (signal.researchStage === "theory_selection" ||
      signal.researchStage === "measurement_design" ||
      signal.researchStage === "analysis_planning") &&
    level !== "universal_required"
  ) {
    level = escalate(level);
    rationale.push("Novice researchers receive stronger guidance on high-risk research commitments.");
  }

  if (profile.forceCheckpointsOn?.includes(signal.checkpointKey) && level !== "universal_required") {
    level = escalate(level);
    rationale.push("The researcher profile explicitly asks for stronger checkpointing here.");
  }

  if (
    profile.relaxCheckpointsOn?.includes(signal.checkpointKey) &&
    level === "adaptive_required" &&
    signal.mode !== "commit" &&
    signal.mode !== "submit"
  ) {
    level = downgrade(level);
    rationale.push("The researcher profile allows lighter intervention on this checkpoint.");
  }

  if (isHighStakeArtifact(signal.artifactStakes) && level !== "universal_required" && level !== "none") {
    level = escalate(level);
    rationale.push("High-stakes artifacts raise checkpoint intensity before information leaves private drafting.");
  }

  if (
    !signal.studyContract &&
    signal.artifactStakes === "external_submission" &&
    level !== "universal_required"
  ) {
    level = "universal_required";
    rationale.push("External submission without an attached study contract should remain blocking.");
  }

  if (
    unresolvedTensions.length > 0 &&
    signal.mode === "commit" &&
    level !== "universal_required" &&
    level !== "none"
  ) {
    level = escalate(level);
    rationale.push("Unresolved tensions increase the need for explicit human commitment.");
  }

  if (profile.preferredCheckpointIntensity === "high" && level === "recommended") {
    level = "adaptive_required";
    rationale.push("Researcher preference is set to high checkpoint intensity.");
  }

  if (
    profile.preferredCheckpointIntensity === "low" &&
    level === "recommended" &&
    signal.mode !== "commit" &&
    signal.mode !== "submit"
  ) {
    level = "log_only";
    rationale.push("Low checkpoint preference keeps non-blocking guidance lightweight.");
  }

  const blocking = REQUIRED_LEVELS.has(level);

  return {
    checkpointKey: signal.checkpointKey,
    level,
    blocking,
    promptStyle: pickPromptStyle(level),
    requiresDecisionLog: blocking || level === "recommended" || isHighStakeArtifact(signal.artifactStakes),
    updateExplicitState: blocking || signal.mode === "commit" || signal.mode === "submit",
    rationale
  };
}
