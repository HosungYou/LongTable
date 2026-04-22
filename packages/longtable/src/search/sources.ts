import {
  SEARCH_SOURCES,
  type AccessStatus,
  type EvidenceCard,
  type EvidenceDepth,
  type ResearchSearchIntent,
  type SearchSource,
  type SearchSourceCapability,
  type SourceSearchContext,
  type SourceSearchRequest,
  type SourceSearchResult,
  type VerificationDepth
} from "./types.js";

function endpoint(url: string, params: Record<string, string | number | undefined>): string {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      parsed.searchParams.set(key, String(value));
    }
  }
  return parsed.toString();
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const cleaned = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeDoi(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .toLowerCase() || undefined;
}

function firstString(value: unknown): string | undefined {
  const entries = asArray(value);
  return asString(entries[0]);
}

function yearFromParts(value: unknown): number | undefined {
  const parts = asRecord(value)["date-parts"];
  const first = asArray(parts)[0];
  const year = asArray(first)[0];
  return asNumber(year);
}

function inferEvidenceDepth(abstract?: string, legalFullTextAvailable = false): EvidenceDepth {
  if (legalFullTextAvailable) return "legal_full_text_available";
  if (abstract) return "abstract_only";
  return "metadata_only";
}

function inferAccessStatus(abstract?: string, legalFullTextAvailable = false): AccessStatus {
  if (legalFullTextAvailable) return "legal_full_text_available";
  if (abstract) return "abstract_available";
  return "metadata_only";
}

function inferVerificationDepth(abstract?: string): VerificationDepth {
  if (abstract) return "abstract";
  return "metadata";
}

function verificationNote(abstract?: string, legalFullTextAvailable = false): string {
  if (legalFullTextAvailable && abstract) {
    return "Legal full text URL was found, but this card is abstract-based and not full-paper verified.";
  }
  if (legalFullTextAvailable) {
    return "Legal full text URL was found, but LongTable did not retrieve or verify the full text.";
  }
  if (abstract) {
    return "Abstract is available; citation support is abstract-based, not full-paper verified.";
  }
  return "Metadata exists; citation support has not been verified against abstract or full text.";
}

function inferResearchDesign(abstract?: string): string | undefined {
  const normalized = abstract?.toLowerCase() ?? "";
  if (!normalized) return undefined;
  if (/\bsystematic review\b|\bmeta-analysis\b/.test(normalized)) return "review or meta-analysis";
  if (/\brandomi[sz]ed\b|\bexperiment\b|\btrial\b/.test(normalized)) return "experimental or trial design";
  if (/\bsurvey\b|\bquestionnaire\b|\bscale\b/.test(normalized)) return "survey or scale-based design";
  if (/\binterview\b|\bqualitative\b|\bcase study\b/.test(normalized)) return "qualitative design";
  if (/\blongitudinal\b|\bpanel data\b/.test(normalized)) return "longitudinal design";
  return undefined;
}

function inferMainFinding(abstract?: string): string | undefined {
  if (!abstract) return undefined;
  const sentence = abstract.split(/(?<=[.!?])\s+/).find((entry) => entry.length > 40);
  return sentence ? sentence.slice(0, 360) : undefined;
}

function baseCard(input: {
  title?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  doi?: string;
  pmid?: string;
  arxivId?: string;
  openAlexId?: string;
  semanticScholarId?: string;
  ericId?: string;
  url?: string;
  source: SearchSource;
  sourceRecordId?: string;
  abstract?: string;
  legalFullTextAvailable?: boolean;
  fullTextUrl?: string;
  citationCount?: number;
}): EvidenceCard {
  const title = cleanText(input.title) ?? "Untitled scholarly record";
  const abstract = cleanText(input.abstract);
  const legalFullTextAvailable = input.legalFullTextAvailable === true;
  const limitations = [
    abstract ? "" : "No abstract was available from this source.",
    legalFullTextAvailable ? "" : "LongTable did not retrieve full text for this card."
  ].filter(Boolean);

  return {
    id: `${input.source}:${input.sourceRecordId ?? normalizeDoi(input.doi) ?? title.toLowerCase().replace(/\s+/g, "-").slice(0, 80)}`,
    title,
    authors: input.authors ?? [],
    year: input.year,
    venue: cleanText(input.venue),
    doi: normalizeDoi(input.doi),
    pmid: input.pmid,
    arxivId: input.arxivId,
    openAlexId: input.openAlexId,
    semanticScholarId: input.semanticScholarId,
    ericId: input.ericId,
    url: input.url,
    sourceRoute: input.source,
    sourceRoutes: [input.source],
    sourceRecordId: input.sourceRecordId,
    abstract,
    abstractAvailable: Boolean(abstract),
    evidenceDepth: inferEvidenceDepth(abstract, legalFullTextAvailable),
    accessStatus: inferAccessStatus(abstract, legalFullTextAvailable),
    verificationDepth: inferVerificationDepth(abstract),
    verificationNote: verificationNote(abstract, legalFullTextAvailable),
    legalFullTextAvailable,
    fullTextUrl: input.fullTextUrl,
    citationCount: input.citationCount,
    researchDesign: inferResearchDesign(abstract),
    constructsOrMeasures: undefined,
    mainFinding: inferMainFinding(abstract),
    relevanceToProject: undefined,
    citationSupportStatus: "not_verified",
    limitations,
    matchedKeywords: [],
    relevanceScore: 0
  };
}

async function fetchJson(context: SourceSearchContext, url: string): Promise<unknown> {
  const response = await context.fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "LongTable/0.1.31 (https://github.com/HosungYou/LongTable)"
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchText(context: SourceSearchContext, url: string): Promise<string> {
  const response = await context.fetch(url, {
    headers: {
      "accept": "application/xml, text/xml, application/atom+xml, text/plain",
      "user-agent": "LongTable/0.1.31 (https://github.com/HosungYou/LongTable)"
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function queryForSource(intent: ResearchSearchIntent): string {
  return intent.queryVariants[0] ?? intent.query;
}

function getCapability(source: SearchSource, env: Record<string, string | undefined>): SearchSourceCapability {
  if (source === "openalex" && !env.OPENALEX_API_KEY) {
    return {
      source,
      enabled: false,
      requiredEnv: ["OPENALEX_API_KEY"],
      missingEnv: ["OPENALEX_API_KEY"],
      reason: "OpenAlex route is disabled because OPENALEX_API_KEY is missing.",
      setupHint: "Set OPENALEX_API_KEY to enable reliable OpenAlex API use."
    };
  }
  if (source === "unpaywall" && !env.LONGTABLE_CONTACT_EMAIL) {
    return {
      source,
      enabled: false,
      requiredEnv: ["LONGTABLE_CONTACT_EMAIL"],
      missingEnv: ["LONGTABLE_CONTACT_EMAIL"],
      reason: "Unpaywall route is disabled because LONGTABLE_CONTACT_EMAIL is missing.",
      setupHint: "Set LONGTABLE_CONTACT_EMAIL so Unpaywall can receive the required email parameter."
    };
  }
  return {
    source,
    enabled: true,
    requiredEnv: [],
    missingEnv: []
  };
}

export function assessSearchSourceCapabilities(
  sources: SearchSource[],
  env: Record<string, string | undefined> = process.env
): SearchSourceCapability[] {
  return sources.map((source) => getCapability(source, env));
}

export function enabledSearchSources(
  sources: SearchSource[],
  env: Record<string, string | undefined> = process.env
): SearchSource[] {
  return assessSearchSourceCapabilities(sources, env)
    .filter((capability) => capability.enabled)
    .map((capability) => capability.source);
}

function authorNameFromCrossref(value: unknown): string | undefined {
  const author = asRecord(value);
  const given = asString(author.given);
  const family = asString(author.family);
  return [given, family].filter(Boolean).join(" ") || asString(author.name);
}

async function searchCrossref(request: SourceSearchRequest, context: SourceSearchContext): Promise<SourceSearchResult> {
  const url = endpoint("https://api.crossref.org/works", {
    "query.bibliographic": queryForSource(request.intent),
    rows: request.limit,
    mailto: context.env.LONGTABLE_CONTACT_EMAIL
  });
  const payload = asRecord(await fetchJson(context, url));
  const message = asRecord(payload.message);
  const cards = asArray(message.items).map((item) => {
    const record = asRecord(item);
    const authors = asArray(record.author)
      .map(authorNameFromCrossref)
      .filter((author): author is string => Boolean(author));
    return baseCard({
      source: "crossref",
      title: firstString(record.title),
      authors,
      year: yearFromParts(record.issued),
      venue: firstString(record["container-title"]),
      doi: asString(record.DOI),
      url: asString(record.URL),
      sourceRecordId: asString(record.DOI),
      abstract: asString(record.abstract),
      citationCount: asNumber(record["is-referenced-by-count"])
    });
  });
  return { source: "crossref", endpoint: url, cards };
}

function extractXmlBlocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    blocks.push(match[1] ?? "");
  }
  return blocks;
}

function extractXmlTag(xml: string, tag: string): string | undefined {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`, "i");
  return cleanText(pattern.exec(xml)?.[1]);
}

async function searchArxiv(request: SourceSearchRequest, context: SourceSearchContext): Promise<SourceSearchResult> {
  const url = endpoint("https://export.arxiv.org/api/query", {
    search_query: `all:${queryForSource(request.intent)}`,
    start: 0,
    max_results: request.limit,
    sortBy: "relevance"
  });
  const xml = await fetchText(context, url);
  const cards = extractXmlBlocks(xml, "entry").map((entry) => {
    const idUrl = extractXmlTag(entry, "id");
    const arxivId = idUrl?.split("/abs/")[1];
    const authors = extractXmlBlocks(entry, "author")
      .map((author) => extractXmlTag(author, "name"))
      .filter((author): author is string => Boolean(author));
    const published = extractXmlTag(entry, "published");
    return baseCard({
      source: "arxiv",
      title: extractXmlTag(entry, "title"),
      authors,
      year: published ? Number(published.slice(0, 4)) : undefined,
      venue: "arXiv",
      doi: extractXmlTag(entry, "arxiv:doi"),
      arxivId,
      url: idUrl,
      sourceRecordId: arxivId,
      abstract: extractXmlTag(entry, "summary")
    });
  });
  return { source: "arxiv", endpoint: url, cards };
}

async function searchOpenAlex(request: SourceSearchRequest, context: SourceSearchContext): Promise<SourceSearchResult> {
  const url = endpoint("https://api.openalex.org/works", {
    search: queryForSource(request.intent),
    "per-page": request.limit,
    api_key: context.env.OPENALEX_API_KEY,
    mailto: context.env.LONGTABLE_CONTACT_EMAIL
  });
  const payload = asRecord(await fetchJson(context, url));
  const cards = asArray(payload.results).map((item) => {
    const record = asRecord(item);
    const primaryLocation = asRecord(record.primary_location);
    const source = asRecord(primaryLocation.source);
    const oaLocation = asRecord(record.open_access);
    const fullTextUrl = asString(primaryLocation.pdf_url) ?? asString(primaryLocation.landing_page_url);
    const authors = asArray(record.authorships)
      .map((authorship) => asString(asRecord(asRecord(authorship).author).display_name))
      .filter((author): author is string => Boolean(author));
    return baseCard({
      source: "openalex",
      title: asString(record.display_name),
      authors,
      year: asNumber(record.publication_year),
      venue: asString(source.display_name),
      doi: asString(record.doi),
      openAlexId: asString(record.id),
      url: asString(record.id),
      sourceRecordId: asString(record.id),
      abstract: invertedIndexToAbstract(record.abstract_inverted_index),
      legalFullTextAvailable: asString(oaLocation.is_oa) === "true" || oaLocation.is_oa === true,
      fullTextUrl,
      citationCount: asNumber(record.cited_by_count)
    });
  });
  return { source: "openalex", endpoint: url, cards };
}

function invertedIndexToAbstract(value: unknown): string | undefined {
  const index = asRecord(value);
  const positions: Array<[number, string]> = [];
  for (const [word, rawPositions] of Object.entries(index)) {
    for (const position of asArray(rawPositions)) {
      const numeric = asNumber(position);
      if (numeric !== undefined) {
        positions.push([numeric, word]);
      }
    }
  }
  if (positions.length === 0) {
    return undefined;
  }
  return positions.sort((a, b) => a[0] - b[0]).map(([, word]) => word).join(" ");
}

async function searchSemanticScholar(request: SourceSearchRequest, context: SourceSearchContext): Promise<SourceSearchResult> {
  const url = endpoint("https://api.semanticscholar.org/graph/v1/paper/search", {
    query: queryForSource(request.intent),
    limit: request.limit,
    fields: "title,authors,year,venue,externalIds,abstract,citationCount,openAccessPdf,url"
  });
  const headers: Record<string, string> = {};
  if (context.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers["x-api-key"] = context.env.SEMANTIC_SCHOLAR_API_KEY;
  }
  const response = await context.fetch(url, {
    headers: {
      accept: "application/json",
      ...headers
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const payload = asRecord(await response.json());
  const cards = asArray(payload.data).map((item) => {
    const record = asRecord(item);
    const externalIds = asRecord(record.externalIds);
    const oaPdf = asRecord(record.openAccessPdf);
    const authors = asArray(record.authors)
      .map((author) => asString(asRecord(author).name))
      .filter((author): author is string => Boolean(author));
    return baseCard({
      source: "semantic_scholar",
      title: asString(record.title),
      authors,
      year: asNumber(record.year),
      venue: asString(record.venue),
      doi: asString(externalIds.DOI),
      pmid: asString(externalIds.PubMed),
      arxivId: asString(externalIds.ArXiv),
      semanticScholarId: asString(record.paperId),
      url: asString(record.url),
      sourceRecordId: asString(record.paperId),
      abstract: asString(record.abstract),
      legalFullTextAvailable: Boolean(asString(oaPdf.url)),
      fullTextUrl: asString(oaPdf.url),
      citationCount: asNumber(record.citationCount)
    });
  });
  return { source: "semantic_scholar", endpoint: url, cards };
}

async function searchPubMed(request: SourceSearchRequest, context: SourceSearchContext): Promise<SourceSearchResult> {
  const searchUrl = endpoint("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", {
    db: "pubmed",
    retmode: "json",
    term: queryForSource(request.intent),
    retmax: request.limit,
    api_key: context.env.NCBI_API_KEY
  });
  const searchPayload = asRecord(await fetchJson(context, searchUrl));
  const ids = asArray(asRecord(searchPayload.esearchresult).idlist)
    .map(asString)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return { source: "pubmed", endpoint: searchUrl, cards: [] };
  }
  const summaryUrl = endpoint("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi", {
    db: "pubmed",
    retmode: "json",
    id: ids.join(","),
    api_key: context.env.NCBI_API_KEY
  });
  const summaryPayload = asRecord(await fetchJson(context, summaryUrl));
  const result = asRecord(summaryPayload.result);
  const cards = ids.map((id) => {
    const record = asRecord(result[id]);
    const authors = asArray(record.authors)
      .map((author) => asString(asRecord(author).name))
      .filter((author): author is string => Boolean(author));
    const pubdate = asString(record.pubdate);
    return baseCard({
      source: "pubmed",
      title: asString(record.title),
      authors,
      year: pubdate ? Number(pubdate.slice(0, 4)) : undefined,
      venue: asString(record.fulljournalname) ?? asString(record.source),
      pmid: id,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      sourceRecordId: id
    });
  });
  return { source: "pubmed", endpoint: summaryUrl, cards };
}

async function searchEric(request: SourceSearchRequest, context: SourceSearchContext): Promise<SourceSearchResult> {
  const url = endpoint("https://api.ies.ed.gov/eric/", {
    search: queryForSource(request.intent),
    format: "json",
    rows: request.limit
  });
  const payload = asRecord(await fetchJson(context, url));
  const docs = asArray(asRecord(payload.response).docs);
  const cards = docs.map((item) => {
    const record = asRecord(item);
    const id = asString(record.id) ?? asString(record.ericNumber);
    return baseCard({
      source: "eric",
      title: asString(record.title),
      authors: asArray(record.author).map(asString).filter((author): author is string => Boolean(author)),
      year: asNumber(record.publicationdateyear) ?? asNumber(record.year),
      venue: asString(record.source),
      ericId: id,
      url: id ? `https://eric.ed.gov/?id=${id}` : undefined,
      sourceRecordId: id,
      abstract: asString(record.description) ?? asString(record.abstract)
    });
  });
  return { source: "eric", endpoint: url, cards };
}

async function searchDoaj(request: SourceSearchRequest, context: SourceSearchContext): Promise<SourceSearchResult> {
  const url = endpoint(`https://doaj.org/api/v4/search/articles/${encodeURIComponent(queryForSource(request.intent))}`, {
    page: 1,
    pageSize: request.limit
  });
  const payload = asRecord(await fetchJson(context, url));
  const cards = asArray(payload.results).map((item) => {
    const record = asRecord(item);
    const bibjson = asRecord(record.bibjson);
    const journal = asRecord(bibjson.journal);
    const identifiers = asArray(bibjson.identifier).map(asRecord);
    const doi = identifiers.find((identifier) => asString(identifier.type)?.toLowerCase() === "doi");
    const links = asArray(bibjson.link).map(asRecord);
    const fullText = links.find((link) => asString(link.type)?.toLowerCase().includes("fulltext"));
    return baseCard({
      source: "doaj",
      title: asString(bibjson.title),
      authors: asArray(bibjson.author).map((author) => asString(asRecord(author).name)).filter((author): author is string => Boolean(author)),
      year: asNumber(bibjson.year),
      venue: asString(journal.title),
      doi: asString(doi?.id),
      url: asString(record.id) ? `https://doaj.org/article/${record.id}` : undefined,
      sourceRecordId: asString(record.id),
      abstract: asString(bibjson.abstract),
      legalFullTextAvailable: Boolean(fullText),
      fullTextUrl: asString(fullText?.url)
    });
  });
  return { source: "doaj", endpoint: url, cards };
}

async function searchUnpaywall(request: SourceSearchRequest, context: SourceSearchContext): Promise<SourceSearchResult> {
  const url = endpoint("https://api.unpaywall.org/v2/search/", {
    query: queryForSource(request.intent),
    email: context.env.LONGTABLE_CONTACT_EMAIL
  });
  const payload = asRecord(await fetchJson(context, url));
  const cards = asArray(payload.results).map((item) => {
    const result = asRecord(item);
    const response = asRecord(result.response);
    const best = asRecord(response.best_oa_location);
    return baseCard({
      source: "unpaywall",
      title: asString(response.title),
      authors: [],
      year: asNumber(response.year),
      venue: asString(response.journal_name),
      doi: asString(response.doi),
      url: asString(response.doi_url),
      sourceRecordId: asString(response.doi),
      legalFullTextAvailable: Boolean(asString(best.url)),
      fullTextUrl: asString(best.url)
    });
  });
  return { source: "unpaywall", endpoint: url, cards };
}

export async function runSourceSearch(
  request: SourceSearchRequest,
  context: SourceSearchContext
): Promise<SourceSearchResult> {
  switch (request.source) {
    case "crossref":
      return searchCrossref(request, context);
    case "arxiv":
      return searchArxiv(request, context);
    case "openalex":
      return searchOpenAlex(request, context);
    case "semantic_scholar":
      return searchSemanticScholar(request, context);
    case "pubmed":
      return searchPubMed(request, context);
    case "eric":
      return searchEric(request, context);
    case "doaj":
      return searchDoaj(request, context);
    case "unpaywall":
      return searchUnpaywall(request, context);
  }
}

export function allSearchSources(): SearchSource[] {
  return [...SEARCH_SOURCES];
}
