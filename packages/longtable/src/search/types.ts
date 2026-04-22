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
  legalFullTextAvailable: boolean;
  fullTextUrl?: string;
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
}
