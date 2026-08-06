import { createHash } from "node:crypto";

export const INSTITUTIONAL_RESEARCH_STAGES = [
  "SETUP",
  "PILOT",
  "PROTOCOL_CHECKPOINT",
  "PRODUCTION_SEARCH",
  "EXPORT_AUDIT",
  "TITLE_ABSTRACT_SCREENING",
  "FULLTEXT_PLAN_CHECKPOINT",
  "FULLTEXT_ACQUISITION",
  "FULLTEXT_SCREENING",
  "CORPUS_FREEZE_CHECKPOINT",
  "ANALYSIS",
  "SYNTHESIS",
  "RESEARCHER_REPORT",
  "MANUSCRIPT_PACKAGE"
] as const;

export type InstitutionalResearchStage = typeof INSTITUTIONAL_RESEARCH_STAGES[number];

export const INSTITUTIONAL_RESEARCH_HARD_STOPS = [
  "LOGIN_REQUIRED",
  "MFA_OR_CAPTCHA_REQUIRED",
  "SESSION_EXPIRED",
  "TERMS_OR_ACCESS_UNCLEAR",
  "QUERY_DRIFT_DETECTED",
  "DATABASE_RESULT_CAP_REACHED",
  "EXPORT_COUNT_MISMATCH",
  "DOWNLOAD_PATTERN_CHANGED",
  "UI_SIGNATURE_CHANGED",
  "SCREENING_RULE_AMBIGUOUS",
  "HUMAN_AI_SCREENING_CONFLICT",
  "FULLTEXT_MISSING_THRESHOLD_EXCEEDED",
  "ANALYSIS_METHOD_CHANGE",
  "CORPUS_FREEZE_REQUIRED"
] as const;

export type InstitutionalResearchHardStop = typeof INSTITUTIONAL_RESEARCH_HARD_STOPS[number];

export const INSTITUTIONAL_RESEARCH_RETRYABLE_EVENTS = [
  "TRANSIENT_NETWORK_TIMEOUT",
  "DELAYED_EXPORT_GENERATION",
  "INCOMPLETE_DOWNLOAD",
  "TEMPORARY_PAGE_RENDER_FAILURE",
  "FILE_PROVIDER_HYDRATION_DELAY"
] as const;

export type InstitutionalResearchRetryableEvent = typeof INSTITUTIONAL_RESEARCH_RETRYABLE_EVENTS[number];

export const INSTITUTIONAL_RESEARCH_CAPABILITIES = [
  "open",
  "verifyAuthenticated",
  "submitQuery",
  "applyFilters",
  "readResultCount",
  "exportMetadata",
  "verifyExport",
  "resolveFulltext",
  "downloadPermittedPdf",
  "suspend",
  "resume"
] as const;

export type InstitutionalResearchCapability = typeof INSTITUTIONAL_RESEARCH_CAPABILITIES[number];
export type ResearchRunStatus = "planned" | "running" | "blocked" | "completed" | "failed";

export interface SearchFilters {
  readonly years?: readonly [number, number];
  readonly languages: readonly string[];
  readonly publicationTypes: readonly string[];
  readonly sourceTypes?: readonly string[];
}

export interface ProtocolRevisionInput {
  readonly id: string;
  readonly revision: number;
  readonly frozenAt: string;
  readonly decisionRecordId: string;
  readonly databases: readonly string[];
  readonly queries: Readonly<Record<string, string>>;
  readonly filters: SearchFilters;
}

export interface ProtocolRevision extends ProtocolRevisionInput {
  readonly protocolHash: string;
}

export interface ResearchRun {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: ResearchRunStatus;
  readonly stage: InstitutionalResearchStage;
  readonly protocolRevisionId?: string;
  readonly institutionProfileId?: string;
  readonly latestSafeCursor?: string;
  readonly blockingQuestionRecordId?: string;
  readonly blockingCode?: InstitutionalResearchHardStop;
}

export interface StageReceipt {
  readonly id: string;
  readonly runId: string;
  readonly stage: InstitutionalResearchStage;
  readonly protocolRevisionId: string;
  readonly inputArtifactIds: readonly string[];
  readonly outputArtifactIds: readonly string[];
  readonly cursor: string;
  readonly createdAt: string;
}

export type InstitutionAccessMode = "official_api" | "tdm" | "browser_sso" | "public_browser" | "manual_export";

export interface InstitutionDatabaseAccess {
  readonly databaseId: string;
  readonly accessMode: InstitutionAccessMode;
  readonly exportFormats?: readonly string[];
  readonly resultCap?: number;
  readonly recipeId?: string;
}

export interface InstitutionStorageProfile {
  readonly pdfVaultRoot: string;
  readonly exportRoot?: string;
}

export interface InstitutionProfileInput {
  readonly id: string;
  readonly institutionName: string;
  readonly approvedDecisionRecordId: string;
  readonly databases: readonly InstitutionDatabaseAccess[];
  readonly storage: InstitutionStorageProfile;
  readonly checkpointPolicy: "mcp_first";
  readonly calibratedAt: string;
  readonly lastVerifiedAt: string;
  readonly resolverUrls?: readonly string[];
}

export interface InstitutionProfile extends InstitutionProfileInput {}

export interface ArtifactProvenance {
  readonly id: string;
  readonly sourceStage: InstitutionalResearchStage;
  readonly inputArtifactIds: readonly string[];
  readonly protocolRevisionId: string;
  readonly generator: string;
  readonly generatorVersion: string;
  readonly localPath?: string;
  readonly paperId?: string;
  readonly sha256: string;
  readonly accessBasis?: string;
  readonly createdAt: string;
}

export type CapabilityResult<T> =
  | { readonly status: "supported"; readonly value: T }
  | { readonly status: "unsupported"; readonly reason: string }
  | { readonly status: "hard_stop"; readonly code: InstitutionalResearchHardStop; readonly reason: string }
  | { readonly status: "retryable"; readonly code: InstitutionalResearchRetryableEvent; readonly reason: string };

export interface DatabaseAdapter {
  readonly id: string;
  readonly version: string;
  readonly capabilities: readonly InstitutionalResearchCapability[];
}

const FORBIDDEN_PROFILE_KEY = /(?:password|passphrase|credential|cookie|session[_-]?token|access[_-]?token|refresh[_-]?token|auth(?:entication|orization)?[_-]?header|mfa|one[_-]?time[_-]?(?:code|password)|captcha)/i;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function assertNoAuthenticationMaterial(value: unknown, path = "profile"): void {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nestedPath = `${path}.${key}`;
    if (FORBIDDEN_PROFILE_KEY.test(key)) {
      throw new Error(`Institution profile contains forbidden authentication material at ${nestedPath}.`);
    }
    assertNoAuthenticationMaterial(nested, nestedPath);
  }
}

function protocolHash(input: ProtocolRevisionInput): string {
  const canonicalProtocol = stableValue({
    databases: input.databases,
    queries: input.queries,
    filters: input.filters
  });
  return createHash("sha256").update(JSON.stringify(canonicalProtocol)).digest("hex");
}

export function nextInstitutionalResearchStage(
  stage: InstitutionalResearchStage
): InstitutionalResearchStage | undefined {
  const index = INSTITUTIONAL_RESEARCH_STAGES.indexOf(stage);
  return index >= 0 ? INSTITUTIONAL_RESEARCH_STAGES[index + 1] : undefined;
}

export function createProtocolRevision(input: ProtocolRevisionInput): ProtocolRevision {
  if (!input.id.trim() || !input.decisionRecordId.trim()) {
    throw new Error("A protocol revision requires stable protocol and DecisionRecord IDs.");
  }
  if (!Number.isInteger(input.revision) || input.revision < 1) {
    throw new Error("A protocol revision number must be a positive integer.");
  }
  if (input.databases.length === 0) {
    throw new Error("A protocol revision requires at least one database.");
  }
  const copy = cloneJson(input);
  return deepFreeze({
    ...copy,
    protocolHash: protocolHash(copy)
  }) as ProtocolRevision;
}

export function createInstitutionProfile(input: InstitutionProfileInput): InstitutionProfile {
  assertNoAuthenticationMaterial(input);
  if (!input.id.trim() || !input.institutionName.trim() || !input.approvedDecisionRecordId.trim()) {
    throw new Error("An institution profile requires stable institution and approval DecisionRecord IDs.");
  }
  if (!input.storage.pdfVaultRoot.trim()) {
    throw new Error("An institution profile requires a Research PDF Vault root.");
  }
  return deepFreeze(cloneJson(input)) as InstitutionProfile;
}
