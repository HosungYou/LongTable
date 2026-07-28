export const TARGET_JOURNAL_PROFILE_VERSION = "1.0.0";

export interface TargetJournalProfile {
  schema: "longtable.target-journal-profile";
  version: typeof TARGET_JOURNAL_PROFILE_VERSION;
  profileId: string;
  targetJournal: string;
  createdAt: string;
  evidenceSources: Array<{
    sourceId: string;
    title: string;
    locator: string;
    contentHash: string;
    accessClass: string;
  }>;
  topicPatterns: string[];
  formatPatterns: {
    manuscriptStructure: string[];
    tables: string[];
    figures: string[];
    diagrams: string[];
  };
  humanReview: {
    reviewer: string;
    reviewedAt: string;
    decision: "accept" | "reject";
    notes: string;
  };
}

export function validateTargetJournalProfile(value: unknown): TargetJournalProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Target-journal profile must be a JSON object.");
  }
  const profile = value as Partial<TargetJournalProfile>;
  if (profile.schema !== "longtable.target-journal-profile" ||
      profile.version !== TARGET_JOURNAL_PROFILE_VERSION) {
    throw new Error(`Target-journal profile must use version ${TARGET_JOURNAL_PROFILE_VERSION}.`);
  }
  for (const [field, content] of [
    ["profileId", profile.profileId],
    ["targetJournal", profile.targetJournal],
    ["createdAt", profile.createdAt]
  ] as const) {
    if (typeof content !== "string" || !content.trim()) {
      throw new Error(`Target-journal profile field ${field} is required.`);
    }
  }
  if (!Array.isArray(profile.evidenceSources) || profile.evidenceSources.length === 0 ||
      profile.evidenceSources.some((source) =>
        !source.sourceId?.trim() ||
        !source.title?.trim() ||
        !source.locator?.trim() ||
        !source.contentHash?.startsWith("sha256:") ||
        !source.accessClass?.trim()
      )) {
    throw new Error("Target-journal profile requires at least one provenance-complete evidence source.");
  }
  if (!Array.isArray(profile.topicPatterns) || profile.topicPatterns.length === 0) {
    throw new Error("Target-journal profile requires at least one topic pattern.");
  }
  const format = profile.formatPatterns;
  if (!format ||
      !Array.isArray(format.manuscriptStructure) ||
      !Array.isArray(format.tables) ||
      !Array.isArray(format.figures) ||
      !Array.isArray(format.diagrams) ||
      format.manuscriptStructure.length + format.tables.length + format.figures.length + format.diagrams.length === 0) {
    throw new Error("Target-journal profile requires observed manuscript or visual format patterns.");
  }
  if (!profile.humanReview ||
      !profile.humanReview.reviewer?.trim() ||
      !profile.humanReview.reviewedAt?.trim() ||
      profile.humanReview.decision !== "accept") {
    throw new Error("Target-journal profile requires an accepted human review.");
  }
  return profile as TargetJournalProfile;
}
