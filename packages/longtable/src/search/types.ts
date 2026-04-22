export const SEARCH_SOURCES = [
  "crossref",
  "arxiv",
  "openalex",
  "semantic_scholar",
  "pubmed",
  "eric",
  "doaj",
  "unpaywall"
] as const;

export type SearchSource = typeof SEARCH_SOURCES[number];

export const PUBLISHERS = [
  "elsevier",
  "springer_nature",
  "wiley",
  "taylor_francis"
] as const;

export type Publisher = typeof PUBLISHERS[number];
export type PublisherProbeTarget = Publisher | "auto";

export type ResearchSearchIntentKind =
  | "literature"
  | "theory"
  | "measurement"
  | "citation"
  | "metadata"
  | "venue";

export type EvidenceDepth =
  | "metadata_only"
  | "abstract_only"
  | "legal_full_text_available"
  | "legal_full_text_unavailable"
  | "secondary_summary_only";

export type AccessStatus =
  | "metadata_only"
  | "abstract_available"
  | "legal_full_text_available"
  | "licensed_full_text_available"
  | "licensed_full_text_checked"
  | "access_denied"
  | "license_unknown";

export type VerificationDepth =
  | "metadata"
  | "abstract"
  | "legal_full_text"
  | "licensed_snippet"
  | "secondary";

export type EntitlementSource =
  | "crossref_tdm"
  | "publisher_api"
  | "institutional_token"
  | "user_api_key"
  | "none";

export type CollectionDepth =
  | "metadata"
  | "abstract"
  | "licensed_snippet"
  | "licensed_full_text_local_only";

export type CredentialStatus = "missing" | "present" | "valid" | "invalid";
export type EntitlementStatus =
  | "unknown"
  | "no_access"
  | "metadata_only"
  | "abstract_available"
  | "licensed_full_text_available";
export type TdmStatus =
  | "unknown"
  | "not_configured"
  | "permitted"
  | "denied"
  | "requires_license_review";

export type CitationSupportStatus =
  | "direct_support"
  | "indirect_support"
  | "background"
  | "questionable_fit"
  | "not_verified";

export type SourceRunStatus = "completed" | "skipped" | "failed";

export type EvidenceRunStatus = "completed" | "partial" | "blocked";

export interface ResearchSearchIntent {
  id: string;
  createdAt: string;
  kind: ResearchSearchIntentKind;
  query: string;
  normalizedQuery: string;
  queryVariants: string[];
  keywords: string[];
  field?: string;
  mustTerms: string[];
  excludeTerms: string[];
  requestedSources: SearchSource[];
  limit: number;
  source: "cli" | "runtime" | "test";
}

export interface EvidenceCard {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  doi?: string;
  pmid?: string;
  arxivId?: string;
  openAlexId?: string;
  semanticScholarId?: string;
  ericId?: string;
  url?: string;
  sourceRoute: SearchSource;
  sourceRoutes: SearchSource[];
  sourceRecordId?: string;
  abstract?: string;
  abstractAvailable: boolean;
  evidenceDepth: EvidenceDepth;
  accessStatus: AccessStatus;
  verificationDepth: VerificationDepth;
  verificationNote: string;
  legalFullTextAvailable: boolean;
  fullTextUrl?: string;
  publisher?: Publisher | "other";
  entitlementSource?: EntitlementSource;
  collectionDepth?: CollectionDepth;
  licenseNote?: string;
  publisherAccess?: PublisherAccessRecord;
  citationCount?: number;
  researchDesign?: string;
  constructsOrMeasures?: string[];
  mainFinding?: string;
  relevanceToProject?: string;
  citationSupportStatus: CitationSupportStatus;
  limitations: string[];
  matchedKeywords: string[];
  relevanceScore: number;
}

export interface SearchSourceCapability {
  source: SearchSource;
  enabled: boolean;
  requiredEnv: string[];
  missingEnv: string[];
  reason?: string;
  setupHint?: string;
}

export interface SourceReport {
  source: SearchSource;
  status: SourceRunStatus;
  count: number;
  elapsedMs: number;
  reason?: string;
  endpoint?: string;
}

export interface EvidenceRun {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: EvidenceRunStatus;
  intent: ResearchSearchIntent;
  sourceReports: SourceReport[];
  cards: EvidenceCard[];
  skippedSources: SearchSourceCapability[];
  warnings: string[];
  blockedReason?: string;
}

export interface BuildSearchIntentInput {
  query?: string;
  prompt?: string;
  projectGoal?: string;
  projectBlocker?: string;
  intent?: string;
  field?: string;
  must?: string;
  exclude?: string;
  sources?: string;
  limit?: number;
  source?: ResearchSearchIntent["source"];
}

export interface HttpResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type SearchFetch = (url: string, init?: {
  headers?: Record<string, string>;
}) => Promise<HttpResponseLike>;

export interface SourceSearchContext {
  fetch: SearchFetch;
  env: Record<string, string | undefined>;
}

export interface SourceSearchRequest {
  intent: ResearchSearchIntent;
  source: SearchSource;
  limit: number;
}

export interface SourceSearchResult {
  source: SearchSource;
  endpoint: string;
  cards: EvidenceCard[];
}

export interface RunResearchSearchInput extends BuildSearchIntentInput {
  env?: Record<string, string | undefined>;
  fetch?: SearchFetch;
  allowPartial?: boolean;
  publisherAccess?: boolean;
}

export interface CrossrefTdmLink {
  url: string;
  contentType?: string;
  contentVersion?: string;
  intendedApplication?: string;
}

export interface CrossrefTdmDiscovery {
  doi: string;
  publisher?: string;
  inferredPublisher?: Publisher | "other";
  title?: string;
  sourceUrl?: string;
  licenseUrls: string[];
  links: CrossrefTdmLink[];
}

export interface PublisherAccessRecord {
  publisher: Publisher | "other";
  checkedAt: string;
  credentialStatus: CredentialStatus;
  entitlementStatus: EntitlementStatus;
  tdmStatus: TdmStatus;
  collectionDepth: CollectionDepth;
  requiredEnv: string[];
  presentEnv: string[];
  missingEnv: string[];
  testedDoi?: string;
  endpoint?: string;
  setupHint: string;
  licenseNote?: string;
  verificationNote: string;
  evidenceSnippet?: string;
  crossref?: CrossrefTdmDiscovery;
}

export interface SearchCapabilitySnapshot {
  version: 1;
  updatedAt: string;
  contactEmailPresent: boolean;
  records: PublisherAccessRecord[];
}

export interface PublisherProbeInput {
  doi: string;
  publisher?: PublisherProbeTarget;
  env?: Record<string, string | undefined>;
  fetch?: SearchFetch;
}
