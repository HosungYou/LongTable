import type { CitationSupportStatus, EvidenceCard, ResearchSearchIntent } from "./types.js";
import { normalizeSearchText } from "./query.js";

function keyForCard(card: EvidenceCard): string {
  if (card.doi) return `doi:${card.doi.toLowerCase()}`;
  if (card.pmid) return `pmid:${card.pmid}`;
  if (card.arxivId) return `arxiv:${card.arxivId.toLowerCase()}`;
  if (card.openAlexId) return `openalex:${card.openAlexId}`;
  if (card.semanticScholarId) return `s2:${card.semanticScholarId}`;
  const title = normalizeSearchText(card.title).replace(/\s+/g, "-");
  return `title:${title}:${card.year ?? "unknown"}`;
}

function keywordMatches(card: EvidenceCard, keywords: string[]): string[] {
  const haystack = normalizeSearchText([
    card.title,
    card.abstract,
    card.venue,
    card.researchDesign,
    card.mainFinding
  ].filter(Boolean).join(" "));

  return keywords.filter((keyword) => haystack.includes(normalizeSearchText(keyword)));
}

function sourceBoost(card: EvidenceCard): number {
  if (card.sourceRoutes.includes("openalex")) return 6;
  if (card.sourceRoutes.includes("semantic_scholar")) return 5;
  if (card.sourceRoutes.includes("pubmed")) return 5;
  if (card.sourceRoutes.includes("crossref")) return 4;
  if (card.sourceRoutes.includes("arxiv")) return 3;
  if (card.sourceRoutes.includes("doaj")) return 3;
  if (card.sourceRoutes.includes("eric")) return 3;
  return 1;
}

function supportStatus(card: EvidenceCard, matches: string[], keywords: string[]): CitationSupportStatus {
  if (card.verificationDepth === "metadata" || !card.abstractAvailable) {
    return "not_verified";
  }
  const ratio = keywords.length === 0 ? 0 : matches.length / keywords.length;
  const fullTextChecked = card.verificationDepth === "licensed_snippet" || card.verificationDepth === "legal_full_text";
  if (fullTextChecked && ratio >= 0.65) return "direct_support";
  if (ratio >= 0.35) return "indirect_support";
  if (ratio > 0) return "background";
  return "questionable_fit";
}

function scoreCard(card: EvidenceCard, intent: ResearchSearchIntent, matches: string[]): number {
  const title = normalizeSearchText(card.title);
  const abstract = normalizeSearchText(card.abstract ?? "");
  let score = 0;

  for (const keyword of intent.keywords) {
    const normalized = normalizeSearchText(keyword);
    if (title.includes(normalized)) score += 8;
    if (abstract.includes(normalized)) score += 3;
  }

  for (const term of intent.mustTerms) {
    const normalized = normalizeSearchText(term);
    if (title.includes(normalized) || abstract.includes(normalized)) {
      score += 10;
    } else {
      score -= 20;
    }
  }

  for (const term of intent.excludeTerms) {
    const normalized = normalizeSearchText(term);
    if (title.includes(normalized) || abstract.includes(normalized)) {
      score -= 30;
    }
  }

  if (card.year) {
    const age = Math.max(0, new Date().getUTCFullYear() - card.year);
    score += Math.max(0, 10 - Math.min(age, 10));
  }
  if (card.citationCount) {
    score += Math.min(12, Math.log10(card.citationCount + 1) * 4);
  }
  if (card.legalFullTextAvailable) score += 4;
  score += sourceBoost(card);
  score += matches.length * 2;

  return Math.max(0, Math.round(score * 10) / 10);
}

function accessStrength(card: EvidenceCard): number {
  if (card.accessStatus === "licensed_full_text_checked") return 6;
  if (card.accessStatus === "licensed_full_text_available") return 5;
  if (card.accessStatus === "legal_full_text_available") return 4;
  if (card.accessStatus === "abstract_available") return 3;
  if (card.accessStatus === "metadata_only") return 2;
  if (card.accessStatus === "license_unknown") return 1;
  return 0;
}

function strongerAccess(existing: EvidenceCard, incoming: EvidenceCard): EvidenceCard {
  return accessStrength(incoming) > accessStrength(existing) ? incoming : existing;
}

function mergeCards(existing: EvidenceCard, incoming: EvidenceCard): EvidenceCard {
  const sourceRoutes = [...new Set([...existing.sourceRoutes, ...incoming.sourceRoutes])];
  const stronger = strongerAccess(existing, incoming);
  return {
    ...existing,
    authors: existing.authors.length > 0 ? existing.authors : incoming.authors,
    year: existing.year ?? incoming.year,
    venue: existing.venue ?? incoming.venue,
    doi: existing.doi ?? incoming.doi,
    pmid: existing.pmid ?? incoming.pmid,
    arxivId: existing.arxivId ?? incoming.arxivId,
    openAlexId: existing.openAlexId ?? incoming.openAlexId,
    semanticScholarId: existing.semanticScholarId ?? incoming.semanticScholarId,
    ericId: existing.ericId ?? incoming.ericId,
    url: existing.url ?? incoming.url,
    abstract: existing.abstract ?? incoming.abstract,
    abstractAvailable: existing.abstractAvailable || incoming.abstractAvailable,
    legalFullTextAvailable: existing.legalFullTextAvailable || incoming.legalFullTextAvailable,
    fullTextUrl: existing.fullTextUrl ?? incoming.fullTextUrl,
    publisher: existing.publisher ?? incoming.publisher,
    entitlementSource: stronger.entitlementSource ?? existing.entitlementSource ?? incoming.entitlementSource,
    collectionDepth: stronger.collectionDepth ?? existing.collectionDepth ?? incoming.collectionDepth,
    licenseNote: stronger.licenseNote ?? existing.licenseNote ?? incoming.licenseNote,
    publisherAccess: stronger.publisherAccess ?? existing.publisherAccess ?? incoming.publisherAccess,
    accessStatus: stronger.accessStatus,
    verificationDepth: stronger.verificationDepth,
    verificationNote: stronger.verificationNote,
    citationCount: Math.max(existing.citationCount ?? 0, incoming.citationCount ?? 0) || undefined,
    researchDesign: existing.researchDesign ?? incoming.researchDesign,
    constructsOrMeasures: [...new Set([...(existing.constructsOrMeasures ?? []), ...(incoming.constructsOrMeasures ?? [])])],
    mainFinding: existing.mainFinding ?? incoming.mainFinding,
    sourceRoutes,
    limitations: [...new Set([...existing.limitations, ...incoming.limitations])],
    matchedKeywords: [...new Set([...existing.matchedKeywords, ...incoming.matchedKeywords])],
    relevanceScore: Math.max(existing.relevanceScore, incoming.relevanceScore)
  };
}

export function dedupeAndRankCards(cards: EvidenceCard[], intent: ResearchSearchIntent): EvidenceCard[] {
  const byKey = new Map<string, EvidenceCard>();
  for (const card of cards) {
    const matches = keywordMatches(card, intent.keywords);
    const scored: EvidenceCard = {
      ...card,
      matchedKeywords: matches,
      citationSupportStatus: supportStatus(card, matches, intent.keywords),
      relevanceScore: scoreCard(card, intent, matches)
    };
    const key = keyForCard(scored);
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeCards(existing, scored) : scored);
  }

  return [...byKey.values()]
    .sort((a, b) => {
      const scoreDelta = b.relevanceScore - a.relevanceScore;
      if (scoreDelta !== 0) return scoreDelta;
      return (b.year ?? 0) - (a.year ?? 0);
    })
    .slice(0, intent.limit);
}
