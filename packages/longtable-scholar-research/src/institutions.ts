import type { InstitutionProfile } from "./workflow-types.js";

export interface InstitutionCalibrationEvidence {
  readonly researcherLoginVerified?: boolean;
  readonly resolverDiscoveryVerified?: boolean;
  readonly calibrationDatabaseIds: readonly string[];
  readonly fixtureReplayDatabaseIds: readonly string[];
  readonly liveSmokeDatabaseIds: readonly string[];
  readonly decisionRecordIds: readonly string[];
}

export interface InstitutionProductionEligibility {
  readonly eligible: boolean;
  readonly missing: readonly string[];
  readonly coveredDatabaseIds: readonly string[];
}

export interface InstitutionCalibrationStep {
  readonly key:
    | "researcher_login"
    | "database_and_resolver_discovery"
    | "supervised_dry_run"
    | "profile_approval"
    | "fixture_replay"
    | "live_smoke"
    | "production_eligibility";
  readonly complete: boolean;
  readonly evidence: readonly string[];
}

export interface InstitutionCalibrationChecklist {
  readonly institutionProfileId: string;
  readonly steps: readonly InstitutionCalibrationStep[];
}

function missingDatabaseEvidence(
  databaseIds: readonly string[],
  evidencedIds: readonly string[],
  label: string
): string[] {
  const present = new Set(evidencedIds);
  return databaseIds
    .filter((databaseId) => !present.has(databaseId))
    .map((databaseId) => `${label} evidence is missing for database ${databaseId}.`);
}

function allCovered(databaseIds: readonly string[], evidencedIds: readonly string[]): boolean {
  const present = new Set(evidencedIds);
  return databaseIds.every((databaseId) => present.has(databaseId));
}

export function assessInstitutionProductionEligibility(
  profile: InstitutionProfile,
  evidence: InstitutionCalibrationEvidence
): InstitutionProductionEligibility {
  const databaseIds = profile.databases.map((database) => database.databaseId);
  const missing: string[] = [];
  if (evidence.researcherLoginVerified !== true) {
    missing.push("Researcher login verification is missing; login and MFA remain researcher-owned.");
  }
  if (evidence.resolverDiscoveryVerified !== true) {
    missing.push("Database and resolver discovery evidence is missing.");
  }
  missing.push(...missingDatabaseEvidence(databaseIds, evidence.calibrationDatabaseIds, "Supervised calibration dry run"));
  missing.push(...missingDatabaseEvidence(databaseIds, evidence.fixtureReplayDatabaseIds, "Local fixture replay"));
  missing.push(...missingDatabaseEvidence(databaseIds, evidence.liveSmokeDatabaseIds, "Limited live smoke"));
  if (!evidence.decisionRecordIds.includes(profile.approvedDecisionRecordId)) {
    missing.push(`Profile approval DecisionRecord ${profile.approvedDecisionRecordId} is missing.`);
  }
  return {
    eligible: missing.length === 0,
    missing,
    coveredDatabaseIds: databaseIds.filter((databaseId) =>
      evidence.calibrationDatabaseIds.includes(databaseId) &&
      evidence.fixtureReplayDatabaseIds.includes(databaseId) &&
      evidence.liveSmokeDatabaseIds.includes(databaseId)
    ).sort()
  };
}

export function buildInstitutionCalibrationChecklist(
  profile: InstitutionProfile,
  evidence: InstitutionCalibrationEvidence
): InstitutionCalibrationChecklist {
  const databaseIds = profile.databases.map((database) => database.databaseId);
  const approvalComplete = evidence.decisionRecordIds.includes(profile.approvedDecisionRecordId);
  const dryRunComplete = allCovered(databaseIds, evidence.calibrationDatabaseIds);
  const fixtureComplete = allCovered(databaseIds, evidence.fixtureReplayDatabaseIds);
  const liveSmokeComplete = allCovered(databaseIds, evidence.liveSmokeDatabaseIds);
  const eligibility = assessInstitutionProductionEligibility(profile, evidence);
  return {
    institutionProfileId: profile.id,
    steps: [
      {
        key: "researcher_login",
        complete: evidence.researcherLoginVerified === true,
        evidence: [evidence.researcherLoginVerified ? "Researcher confirmed the authenticated database session without sharing credentials." : "Researcher login confirmation pending."]
      },
      {
        key: "database_and_resolver_discovery",
        complete: evidence.resolverDiscoveryVerified === true,
        evidence: [evidence.resolverDiscoveryVerified ? `Resolver discovery recorded for ${profile.resolverUrls?.length ?? 0} configured resolver route(s).` : "Database and resolver discovery pending."]
      },
      {
        key: "supervised_dry_run",
        complete: dryRunComplete,
        evidence: [evidence.calibrationDatabaseIds.length > 0 ? `Dry-run databases: ${[...evidence.calibrationDatabaseIds].sort().join(", ")}.` : "Supervised dry run pending."]
      },
      {
        key: "profile_approval",
        complete: approvalComplete,
        evidence: [approvalComplete ? `DecisionRecord: ${profile.approvedDecisionRecordId}.` : `DecisionRecord ${profile.approvedDecisionRecordId} pending.`]
      },
      {
        key: "fixture_replay",
        complete: fixtureComplete,
        evidence: [evidence.fixtureReplayDatabaseIds.length > 0 ? `Fixture replay databases: ${[...evidence.fixtureReplayDatabaseIds].sort().join(", ")}.` : "Fixture replay pending."]
      },
      {
        key: "live_smoke",
        complete: liveSmokeComplete,
        evidence: [evidence.liveSmokeDatabaseIds.length > 0 ? `Live-smoke databases: ${[...evidence.liveSmokeDatabaseIds].sort().join(", ")}.` : "Limited live smoke pending."]
      },
      {
        key: "production_eligibility",
        complete: eligibility.eligible,
        evidence: [eligibility.eligible ? "All production gates passed." : eligibility.missing.join(" ")]
      }
    ]
  };
}
