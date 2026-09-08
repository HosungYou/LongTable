import { SEARCH_SOURCES, type SearchSource, type SearchSourceCapability } from "./types.js";

/** Setup readiness, not a promise that a live remote endpoint is healthy. */
export const SEARCH_SOURCE_REGISTRY: Record<SearchSource, { name: string; requiredEnv: string[]; purpose: string }> = {
  crossref: { name: "Crossref", requiredEnv: [], purpose: "DOI and publisher metadata resolution." },
  arxiv: { name: "arXiv", requiredEnv: [], purpose: "Preprint metadata and open PDF discovery." },
  openalex: { name: "OpenAlex", requiredEnv: [], purpose: "Basic anonymous metadata lookup; optional OPENALEX_API_KEY raises limits. Remote quotas still apply." },
  semantic_scholar: { name: "Semantic Scholar", requiredEnv: [], purpose: "Paper metadata, abstracts, citations, and open PDF hints." },
  pubmed: { name: "PubMed/PMC", requiredEnv: [], purpose: "Biomedical metadata and open full text discovery." },
  eric: { name: "ERIC", requiredEnv: [], purpose: "Education research metadata and abstracts." },
  doaj: { name: "DOAJ", requiredEnv: [], purpose: "Open-access journal metadata and full-text links." }
};

export function assessSearchSourceCapabilities(sources: SearchSource[] = [...SEARCH_SOURCES], env: Record<string, string | undefined> = process.env): SearchSourceCapability[] {
  return sources.map((source) => {
    const { requiredEnv } = SEARCH_SOURCE_REGISTRY[source];
    const missingEnv = requiredEnv.filter((key) => !env[key]?.trim());
    return { source, enabled: missingEnv.length === 0, requiredEnv, missingEnv,
      ...(missingEnv.length ? { reason: `${source} requires ${missingEnv.join(", ")}.` } : {}) };
  });
}
