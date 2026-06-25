import {
  SEARCH_SOURCES,
  type BuildSearchIntentInput,
  type ResearchSearchIntent,
  type ResearchSearchIntentKind,
  type SearchSource
} from "./types.js";

const STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "between",
  "but",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "has",
  "have",
  "how",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "should",
  "study",
  "that",
  "the",
  "their",
  "this",
  "to",
  "what",
  "when",
  "where",
  "whether",
  "which",
  "with"
]);

function searchId(): string {
  return `search_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/doi:\s*/g, "doi ")
    .replace(/[^a-z0-9가-힣._:/-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitCsvTerms(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => normalizeSearchText(entry))
    .filter(Boolean);
}

export function extractSearchKeywords(text: string, limit = 12): string[] {
  const normalized = normalizeSearchText(text);
  const counts = new Map<string, number>();
  for (const token of normalized.split(" ")) {
    if (token.length < 3 || STOP_WORDS.has(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => {
      const countDelta = b[1] - a[1];
      return countDelta !== 0 ? countDelta : a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([token]) => token);
}

export function parseSearchSources(value?: string): SearchSource[] {
  if (!value || value === "all") {
    return [...SEARCH_SOURCES];
  }

  const requested = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const sources: SearchSource[] = [];
  for (const source of requested) {
    if (!SEARCH_SOURCES.includes(source as SearchSource)) {
      throw new Error(`Unknown search source: ${source}`);
    }
    sources.push(source as SearchSource);
  }

  return sources.length > 0 ? sources : [...SEARCH_SOURCES];
}

function inferIntentKind(text: string, explicit?: string): ResearchSearchIntentKind {
  if (explicit) {
    if (
      explicit === "literature" ||
      explicit === "theory" ||
      explicit === "measurement" ||
      explicit === "citation" ||
      explicit === "metadata" ||
      explicit === "venue"
    ) {
      return explicit;
    }
    throw new Error(`Unknown search intent: ${explicit}`);
  }

  const normalized = normalizeSearchText(text);
  if (/\b(citation|reference|doi|source|hallucination|verify|support)\b|인용|레퍼런스|출처|근거/.test(normalized)) {
    return "citation";
  }
  if (/\b(scale|measure|measurement|instrument|validity|reliability)\b|측정|척도|타당도|도구/.test(normalized)) {
    return "measurement";
  }
  if (/\b(theory|theoretical|framework|construct|conceptual)\b|이론|개념|프레임워크/.test(normalized)) {
    return "theory";
  }
  if (/\b(journal|venue|conference|submission|scope|fit)\b|저널|학회|투고/.test(normalized)) {
    return "venue";
  }
  if (/\b(metadata|pmid|arxiv|openalex|semantic scholar)\b/.test(normalized)) {
    return "metadata";
  }
  return "literature";
}

function buildQueryVariants(baseQuery: string, keywords: string[], field?: string, mustTerms: string[] = []): string[] {
  const variants = new Set<string>();
  variants.add(baseQuery);
  const compact = [...mustTerms, ...keywords].slice(0, 8).join(" ");
  if (compact) {
    variants.add(compact);
  }
  if (field && compact) {
    variants.add(`${field} ${compact}`);
  }
  return [...variants].filter(Boolean).slice(0, 3);
}

export function buildResearchSearchIntent(input: BuildSearchIntentInput): ResearchSearchIntent {
  const explicitQuery = input.query?.trim();
  const baseText = explicitQuery || [
    input.prompt,
    input.projectGoal,
    input.projectBlocker
  ]
    .filter((entry): entry is string => Boolean(entry && entry.trim()))
    .join(" ");

  if (!baseText.trim()) {
    throw new Error("A search query is required. Pass --query or run inside a workspace with a current goal.");
  }

  const mustTerms = splitCsvTerms(input.must);
  const excludeTerms = splitCsvTerms(input.exclude);
  const field = input.field?.trim() || undefined;
  const keywordText = [baseText, field, ...mustTerms].filter(Boolean).join(" ");
  const keywords = extractSearchKeywords(keywordText);
  const normalizedQuery = normalizeSearchText(baseText);
  const query = keywords.length > 0 ? keywords.slice(0, 10).join(" ") : normalizedQuery;
  const limit = Number.isInteger(input.limit) && input.limit && input.limit > 0
    ? Math.min(input.limit, 50)
    : 10;

  return {
    id: searchId(),
    createdAt: new Date().toISOString(),
    kind: inferIntentKind(baseText, input.intent),
    query,
    normalizedQuery,
    queryVariants: buildQueryVariants(query, keywords, field, mustTerms),
    keywords,
    ...(field ? { field } : {}),
    mustTerms,
    excludeTerms,
    requestedSources: parseSearchSources(input.sources),
    limit,
    source: input.source ?? "cli"
  };
}
