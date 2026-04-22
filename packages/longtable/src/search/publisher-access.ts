import { join } from "node:path";
import { homedir } from "node:os";
import {
  PUBLISHERS,
  type CollectionDepth,
  type CrossrefTdmDiscovery,
  type CrossrefTdmLink,
  type EntitlementStatus,
  type EvidenceCard,
  type Publisher,
  type PublisherAccessRecord,
  type PublisherProbeInput,
  type PublisherProbeTarget,
  type SearchCapabilitySnapshot,
  type SearchFetch,
  type TdmStatus
} from "./types.js";

interface HttpProbeResult {
  ok: boolean;
  status: number;
  statusText: string;
  text?: string;
  endpoint: string;
}

interface PublisherConfig {
  publisher: Publisher;
  label: string;
  requiredEnv: string[];
  optionalEnv: string[];
  setupHint: string;
}

const PUBLISHER_CONFIGS: Record<Publisher, PublisherConfig> = {
  elsevier: {
    publisher: "elsevier",
    label: "Elsevier / ScienceDirect",
    requiredEnv: ["ELSEVIER_API_KEY"],
    optionalEnv: ["ELSEVIER_INST_TOKEN", "ELSEVIER_AUTHTOKEN"],
    setupHint: "Set ELSEVIER_API_KEY and, when your institution provides one, ELSEVIER_INST_TOKEN or ELSEVIER_AUTHTOKEN."
  },
  springer_nature: {
    publisher: "springer_nature",
    label: "Springer Nature",
    requiredEnv: ["SPRINGER_NATURE_API_KEY"],
    optionalEnv: ["SPRINGER_NATURE_TDM_API_KEY", "SPRINGER_NATURE_TDM_ENDPOINT"],
    setupHint: "Set SPRINGER_NATURE_API_KEY. Add SPRINGER_NATURE_TDM_ENDPOINT when your TDM agreement provides a licensed full-text endpoint."
  },
  wiley: {
    publisher: "wiley",
    label: "Wiley",
    requiredEnv: ["WILEY_TDM_TOKEN"],
    optionalEnv: ["WILEY_TDM_CLIENT_TOKEN"],
    setupHint: "Set WILEY_TDM_TOKEN or WILEY_TDM_CLIENT_TOKEN after accepting Wiley's TDM terms."
  },
  taylor_francis: {
    publisher: "taylor_francis",
    label: "Taylor & Francis",
    requiredEnv: ["TANDF_TDM_TOKEN"],
    optionalEnv: ["TANDF_TDM_ENDPOINT", "TAYLOR_FRANCIS_TDM_TOKEN", "TAYLOR_FRANCIS_TDM_ENDPOINT"],
    setupHint: "Taylor & Francis TDM often requires an institutional arrangement. Set TANDF_TDM_ENDPOINT and TANDF_TDM_TOKEN when your institution provides them."
  }
};

function now(): string {
  return new Date().toISOString();
}

function defaultFetch(): SearchFetch {
  if (typeof fetch !== "function") {
    throw new Error("LongTable publisher access probing requires a fetch-capable Node runtime.");
  }
  return fetch as unknown as SearchFetch;
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

function firstString(value: unknown): string | undefined {
  return asString(asArray(value)[0]);
}

export function normalizeDoi(value: string): string {
  return value
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .toLowerCase();
}

function endpoint(url: string, params: Record<string, string | number | undefined>): string {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      parsed.searchParams.set(key, String(value));
    }
  }
  return parsed.toString();
}

function envValue(env: Record<string, string | undefined>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function presentEnv(config: PublisherConfig, env: Record<string, string | undefined>): string[] {
  return [...config.requiredEnv, ...config.optionalEnv].filter((key) => Boolean(env[key]?.trim()));
}

function missingRequiredEnv(config: PublisherConfig, env: Record<string, string | undefined>): string[] {
  return config.requiredEnv.filter((key) => !envValue(env, key === "WILEY_TDM_TOKEN"
    ? ["WILEY_TDM_TOKEN", "WILEY_TDM_CLIENT_TOKEN"]
    : key === "TANDF_TDM_TOKEN"
      ? ["TANDF_TDM_TOKEN", "TAYLOR_FRANCIS_TDM_TOKEN"]
      : [key]));
}

function inferPublisherFromText(value?: string): Publisher | "other" | undefined {
  const normalized = value?.toLowerCase() ?? "";
  if (!normalized) return undefined;
  if (/elsevier|sciencedirect/.test(normalized)) return "elsevier";
  if (/springer|nature\.com|springernature/.test(normalized)) return "springer_nature";
  if (/wiley|onlinelibrary/.test(normalized)) return "wiley";
  if (/taylor\s*&?\s*francis|tandfonline|routledge/.test(normalized)) return "taylor_francis";
  return undefined;
}

function inferPublisherFromDoi(doi: string): Publisher | undefined {
  if (doi.startsWith("10.1016/")) return "elsevier";
  if (doi.startsWith("10.1007/") || doi.startsWith("10.1038/")) return "springer_nature";
  if (doi.startsWith("10.1002/") || doi.startsWith("10.1111/")) return "wiley";
  if (doi.startsWith("10.1080/") || doi.startsWith("10.1207/")) return "taylor_francis";
  return undefined;
}

export function parsePublisherTarget(value?: string | boolean): PublisherProbeTarget {
  if (typeof value !== "string" || value.trim() === "" || value === "auto") {
    return "auto";
  }
  if (PUBLISHERS.includes(value as Publisher)) {
    return value as Publisher;
  }
  throw new Error(`Unknown publisher: ${value}`);
}

function tdmLinksFromCrossref(rawLinks: unknown): CrossrefTdmLink[] {
  const links: CrossrefTdmLink[] = [];
  for (const entry of asArray(rawLinks)) {
    const record = asRecord(entry);
    const url = asString(record.URL) ?? asString(record.url);
    if (!url) {
      continue;
    }
    links.push({
      url,
      contentType: asString(record["content-type"]),
      contentVersion: asString(record["content-version"]),
      intendedApplication: asString(record["intended-application"])
    });
  }
  return links;
}

function licenseUrlsFromCrossref(rawLicenses: unknown): string[] {
  return asArray(rawLicenses)
    .map((entry) => asString(asRecord(entry).URL) ?? asString(asRecord(entry).url))
    .filter((entry): entry is string => Boolean(entry));
}

export async function discoverCrossrefTdm(
  doi: string,
  env: Record<string, string | undefined> = process.env,
  httpFetch: SearchFetch = defaultFetch()
): Promise<CrossrefTdmDiscovery> {
  const normalizedDoi = normalizeDoi(doi);
  const url = endpoint(`https://api.crossref.org/works/${encodeURIComponent(normalizedDoi)}`, {
    mailto: env.LONGTABLE_CONTACT_EMAIL
  });
  const response = await httpFetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "LongTable/0.1.30 (https://github.com/HosungYou/LongTable)"
    }
  });
  if (!response.ok) {
    throw new Error(`Crossref DOI discovery failed: HTTP ${response.status} ${response.statusText}`);
  }
  const payload = asRecord(await response.json());
  const message = asRecord(payload.message);
  const publisher = asString(message.publisher);
  const links = tdmLinksFromCrossref(message.link);
  const title = firstString(message.title);
  const sourceUrl = asString(message.URL);
  const inferredPublisher =
    inferPublisherFromText(publisher) ??
    inferPublisherFromText(sourceUrl) ??
    links.map((link) => inferPublisherFromText(link.url)).find(Boolean) ??
    inferPublisherFromDoi(normalizedDoi) ??
    "other";

  return {
    doi: normalizedDoi,
    publisher,
    inferredPublisher,
    title,
    sourceUrl,
    licenseUrls: licenseUrlsFromCrossref(message.license),
    links
  };
}

function buildMissingCredentialRecord(publisher: Publisher, doi?: string, crossref?: CrossrefTdmDiscovery): PublisherAccessRecord {
  const config = PUBLISHER_CONFIGS[publisher];
  return {
    publisher,
    checkedAt: now(),
    credentialStatus: "missing",
    entitlementStatus: "unknown",
    tdmStatus: "not_configured",
    collectionDepth: "metadata",
    requiredEnv: config.requiredEnv,
    presentEnv: [],
    missingEnv: config.requiredEnv,
    testedDoi: doi,
    setupHint: config.setupHint,
    verificationNote: "Publisher credential is not configured; LongTable can only use metadata or abstract routes.",
    crossref
  };
}

function baseRecord(input: {
  publisher: Publisher | "other";
  doi?: string;
  config?: PublisherConfig;
  env?: Record<string, string | undefined>;
  crossref?: CrossrefTdmDiscovery;
  endpoint?: string;
  credentialStatus: PublisherAccessRecord["credentialStatus"];
  entitlementStatus: EntitlementStatus;
  tdmStatus: TdmStatus;
  collectionDepth: CollectionDepth;
  setupHint: string;
  verificationNote: string;
  licenseNote?: string;
  evidenceSnippet?: string;
}): PublisherAccessRecord {
  const requiredEnv = input.config?.requiredEnv ?? [];
  const present = input.config && input.env ? presentEnv(input.config, input.env) : [];
  const missing = input.config && input.env ? missingRequiredEnv(input.config, input.env) : requiredEnv;
  return {
    publisher: input.publisher,
    checkedAt: now(),
    credentialStatus: input.credentialStatus,
    entitlementStatus: input.entitlementStatus,
    tdmStatus: input.tdmStatus,
    collectionDepth: input.collectionDepth,
    requiredEnv,
    presentEnv: present,
    missingEnv: missing,
    testedDoi: input.doi,
    endpoint: input.endpoint,
    setupHint: input.setupHint,
    verificationNote: input.verificationNote,
    licenseNote: input.licenseNote,
    evidenceSnippet: input.evidenceSnippet,
    crossref: input.crossref
  };
}

function chooseTextLink(discovery?: CrossrefTdmDiscovery, publisher?: Publisher): CrossrefTdmLink | undefined {
  return discovery?.links.find((link) => {
    const application = link.intendedApplication?.toLowerCase() ?? "";
    const contentType = link.contentType?.toLowerCase() ?? "";
    const publisherMatches = publisher ? inferPublisherFromText(link.url) === publisher : true;
    return publisherMatches &&
      (application === "" || application.includes("text-mining")) &&
      !contentType.includes("pdf");
  });
}

async function fetchTextProbe(
  httpFetch: SearchFetch,
  url: string,
  headers: Record<string, string>
): Promise<HttpProbeResult> {
  const response = await httpFetch(url, { headers });
  const contentType = Object.entries(headers).find(([key]) => key.toLowerCase() === "accept")?.[1] ?? "";
  let text: string | undefined;
  if (response.ok && !contentType.includes("application/pdf")) {
    text = await response.text();
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    text,
    endpoint: url
  };
}

function snippetFromText(value?: string): string | undefined {
  const cleaned = value
    ?.replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return undefined;
  }
  return cleaned.slice(0, 500);
}

function recordFromProbeResult(
  publisher: Publisher,
  doi: string,
  env: Record<string, string | undefined>,
  result: HttpProbeResult,
  crossref: CrossrefTdmDiscovery | undefined,
  fallbackHint: string
): PublisherAccessRecord {
  const config = PUBLISHER_CONFIGS[publisher];
  const snippet = snippetFromText(result.text);
  if (result.ok) {
    return baseRecord({
      publisher,
      doi,
      config,
      env,
      crossref,
      endpoint: result.endpoint,
      credentialStatus: "valid",
      entitlementStatus: "licensed_full_text_available",
      tdmStatus: "permitted",
      collectionDepth: snippet ? "licensed_snippet" : "licensed_full_text_local_only",
      setupHint: config.setupHint,
      licenseNote: "Publisher endpoint returned content for this DOI. Follow the applicable publisher and institutional TDM terms.",
      verificationNote: snippet
        ? "Licensed publisher content was reachable and a short local snippet was extracted."
        : "Licensed publisher content was reachable, but LongTable did not extract text from the returned format.",
      evidenceSnippet: snippet
    });
  }

  if (result.status === 401) {
    return baseRecord({
      publisher,
      doi,
      config,
      env,
      crossref,
      endpoint: result.endpoint,
      credentialStatus: "invalid",
      entitlementStatus: "no_access",
      tdmStatus: "denied",
      collectionDepth: "metadata",
      setupHint: config.setupHint,
      verificationNote: `Publisher rejected the credential for this DOI: HTTP ${result.status} ${result.statusText}.`
    });
  }

  if (result.status === 403) {
    return baseRecord({
      publisher,
      doi,
      config,
      env,
      crossref,
      endpoint: result.endpoint,
      credentialStatus: "valid",
      entitlementStatus: "no_access",
      tdmStatus: "denied",
      collectionDepth: "metadata",
      setupHint: config.setupHint,
      verificationNote: `Credential was present, but the publisher denied entitlement for this DOI: HTTP ${result.status} ${result.statusText}.`
    });
  }

  return baseRecord({
    publisher,
    doi,
    config,
    env,
    crossref,
    endpoint: result.endpoint,
    credentialStatus: "present",
    entitlementStatus: "unknown",
    tdmStatus: "unknown",
    collectionDepth: "metadata",
    setupHint: fallbackHint,
    verificationNote: `Publisher probe could not confirm access: HTTP ${result.status} ${result.statusText}.`
  });
}

async function probeElsevier(
  doi: string,
  env: Record<string, string | undefined>,
  httpFetch: SearchFetch,
  crossref?: CrossrefTdmDiscovery
): Promise<PublisherAccessRecord> {
  const config = PUBLISHER_CONFIGS.elsevier;
  const apiKey = env.ELSEVIER_API_KEY?.trim();
  if (!apiKey) {
    return buildMissingCredentialRecord("elsevier", doi, crossref);
  }
  const link = chooseTextLink(crossref, "elsevier");
  const url = link?.url ?? endpoint(`https://api.elsevier.com/content/article/doi/${encodeURIComponent(doi)}`, {
    httpAccept: "text/plain"
  });
  const headers: Record<string, string> = {
    accept: "text/plain, application/xml, application/json",
    "X-ELS-APIKey": apiKey
  };
  if (env.ELSEVIER_INST_TOKEN?.trim()) {
    headers["X-ELS-Insttoken"] = env.ELSEVIER_INST_TOKEN.trim();
  }
  if (env.ELSEVIER_AUTHTOKEN?.trim()) {
    headers["X-ELS-Authtoken"] = env.ELSEVIER_AUTHTOKEN.trim();
  }
  const result = await fetchTextProbe(httpFetch, url, headers);
  return recordFromProbeResult("elsevier", doi, env, result, crossref, config.setupHint);
}

async function probeSpringerNature(
  doi: string,
  env: Record<string, string | undefined>,
  httpFetch: SearchFetch,
  crossref?: CrossrefTdmDiscovery
): Promise<PublisherAccessRecord> {
  const config = PUBLISHER_CONFIGS.springer_nature;
  const apiKey = env.SPRINGER_NATURE_API_KEY?.trim();
  if (!apiKey) {
    return buildMissingCredentialRecord("springer_nature", doi, crossref);
  }
  const configuredEndpoint = env.SPRINGER_NATURE_TDM_ENDPOINT?.trim();
  if (configuredEndpoint) {
    const url = configuredEndpoint.replace("{doi}", encodeURIComponent(doi));
    const result = await fetchTextProbe(httpFetch, url, {
      accept: "text/plain, application/xml, application/json",
      "X-Api-Key": env.SPRINGER_NATURE_TDM_API_KEY?.trim() ?? apiKey
    });
    return recordFromProbeResult("springer_nature", doi, env, result, crossref, config.setupHint);
  }

  const url = endpoint("https://api.springernature.com/meta/v2/json", {
    q: `doi:${doi}`,
    api_key: apiKey,
    p: 1
  });
  const response = await httpFetch(url, {
    headers: {
      accept: "application/json"
    }
  });
  if (!response.ok) {
    return recordFromProbeResult("springer_nature", doi, env, {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      endpoint: url
    }, crossref, config.setupHint);
  }
  const payload = asRecord(await response.json());
  const records = asArray(payload.records);
  const hasRecord = records.length > 0;
  return baseRecord({
    publisher: "springer_nature",
    doi,
    config,
    env,
    crossref,
    endpoint: url,
    credentialStatus: "valid",
    entitlementStatus: hasRecord ? "abstract_available" : "metadata_only",
    tdmStatus: "requires_license_review",
    collectionDepth: hasRecord ? "abstract" : "metadata",
    setupHint: config.setupHint,
    licenseNote: "Springer Nature metadata access was verified. Licensed full-text TDM requires a configured TDM endpoint or subscription arrangement.",
    verificationNote: hasRecord
      ? "Springer Nature metadata API responded for this DOI; licensed full-text access was not confirmed."
      : "Springer Nature credential worked, but no metadata record was returned for this DOI."
  });
}

async function probeWiley(
  doi: string,
  env: Record<string, string | undefined>,
  httpFetch: SearchFetch,
  crossref?: CrossrefTdmDiscovery
): Promise<PublisherAccessRecord> {
  const config = PUBLISHER_CONFIGS.wiley;
  const token = envValue(env, ["WILEY_TDM_TOKEN", "WILEY_TDM_CLIENT_TOKEN"]);
  if (!token) {
    return buildMissingCredentialRecord("wiley", doi, crossref);
  }
  const url = `https://api.wiley.com/onlinelibrary/tdm/v1/articles/${encodeURIComponent(doi)}`;
  const result = await fetchTextProbe(httpFetch, url, {
    accept: "text/plain, application/xml, application/pdf",
    "Wiley-TDM-Client-Token": token
  });
  return recordFromProbeResult("wiley", doi, env, result, crossref, config.setupHint);
}

async function probeTaylorFrancis(
  doi: string,
  env: Record<string, string | undefined>,
  httpFetch: SearchFetch,
  crossref?: CrossrefTdmDiscovery
): Promise<PublisherAccessRecord> {
  const config = PUBLISHER_CONFIGS.taylor_francis;
  const token = envValue(env, ["TANDF_TDM_TOKEN", "TAYLOR_FRANCIS_TDM_TOKEN"]);
  const configuredEndpoint = envValue(env, ["TANDF_TDM_ENDPOINT", "TAYLOR_FRANCIS_TDM_ENDPOINT"]);
  if (!token || !configuredEndpoint) {
    return baseRecord({
      publisher: "taylor_francis",
      doi,
      config,
      env,
      crossref,
      credentialStatus: token ? "present" : "missing",
      entitlementStatus: "unknown",
      tdmStatus: "requires_license_review",
      collectionDepth: "metadata",
      setupHint: config.setupHint,
      licenseNote: "Taylor & Francis indicates TDM access may require institutional support or a license supplement.",
      verificationNote: "No Taylor & Francis licensed TDM endpoint was configured, so LongTable did not attempt full-text access."
    });
  }
  const url = configuredEndpoint.replace("{doi}", encodeURIComponent(doi));
  const result = await fetchTextProbe(httpFetch, url, {
    accept: "text/plain, application/xml, application/json",
    authorization: `Bearer ${token}`
  });
  return recordFromProbeResult("taylor_francis", doi, env, result, crossref, config.setupHint);
}

async function probeKnownPublisher(
  publisher: Publisher,
  doi: string,
  env: Record<string, string | undefined>,
  httpFetch: SearchFetch,
  crossref?: CrossrefTdmDiscovery
): Promise<PublisherAccessRecord> {
  switch (publisher) {
    case "elsevier":
      return probeElsevier(doi, env, httpFetch, crossref);
    case "springer_nature":
      return probeSpringerNature(doi, env, httpFetch, crossref);
    case "wiley":
      return probeWiley(doi, env, httpFetch, crossref);
    case "taylor_francis":
      return probeTaylorFrancis(doi, env, httpFetch, crossref);
  }
}

export function publisherConfigs(): PublisherConfig[] {
  return PUBLISHERS.map((publisher) => PUBLISHER_CONFIGS[publisher]);
}

export async function probePublisherAccess(input: PublisherProbeInput): Promise<PublisherAccessRecord> {
  const doi = normalizeDoi(input.doi);
  const env = input.env ?? process.env;
  const httpFetch = input.fetch ?? defaultFetch();
  let crossref: CrossrefTdmDiscovery | undefined;
  try {
    crossref = await discoverCrossrefTdm(doi, env, httpFetch);
  } catch {
    crossref = undefined;
  }

  const target = input.publisher ?? "auto";
  const publisher = target === "auto"
    ? crossref?.inferredPublisher ?? inferPublisherFromDoi(doi) ?? "other"
    : target;

  if (publisher === "other") {
    return baseRecord({
      publisher: "other",
      doi,
      crossref,
      credentialStatus: "present",
      entitlementStatus: crossref?.links.length ? "unknown" : "metadata_only",
      tdmStatus: crossref?.links.length ? "requires_license_review" : "unknown",
      collectionDepth: "metadata",
      setupHint: "No first-party publisher adapter matched this DOI. Use Crossref metadata and the publisher landing page.",
      verificationNote: "LongTable could not map this DOI to Elsevier, Springer Nature, Wiley, or Taylor & Francis."
    });
  }

  return probeKnownPublisher(publisher, doi, env, httpFetch, crossref);
}

export function summarizeConfiguredPublisherAccess(env: Record<string, string | undefined> = process.env): PublisherAccessRecord[] {
  return PUBLISHERS.map((publisher) => {
    const config = PUBLISHER_CONFIGS[publisher];
    const missing = missingRequiredEnv(config, env);
    return baseRecord({
      publisher,
      config,
      env,
      credentialStatus: missing.length === 0 ? "present" : "missing",
      entitlementStatus: "unknown",
      tdmStatus: missing.length === 0 ? "unknown" : "not_configured",
      collectionDepth: "metadata",
      setupHint: config.setupHint,
      verificationNote: missing.length === 0
        ? "Credential-like environment variables are present; run a DOI probe to confirm entitlement."
        : "Required publisher credential environment variables are missing."
    });
  });
}

export function buildSearchCapabilitySnapshot(records: PublisherAccessRecord[], env: Record<string, string | undefined> = process.env): SearchCapabilitySnapshot {
  return {
    version: 1,
    updatedAt: now(),
    contactEmailPresent: Boolean(env.LONGTABLE_CONTACT_EMAIL?.trim()),
    records
  };
}

export function searchCapabilitySnapshotPath(home = homedir()): string {
  return join(home, ".longtable", "search-capabilities.json");
}

function bestAccessStatus(record: PublisherAccessRecord): EvidenceCard["accessStatus"] {
  if (record.entitlementStatus === "licensed_full_text_available" && record.collectionDepth === "licensed_snippet") {
    return "licensed_full_text_checked";
  }
  if (record.entitlementStatus === "licensed_full_text_available") {
    return "licensed_full_text_available";
  }
  if (record.entitlementStatus === "no_access") {
    return "access_denied";
  }
  if (record.entitlementStatus === "abstract_available") {
    return "abstract_available";
  }
  if (record.entitlementStatus === "metadata_only") {
    return "metadata_only";
  }
  return "license_unknown";
}

export async function enrichCardsWithPublisherAccess(input: {
  cards: EvidenceCard[];
  env?: Record<string, string | undefined>;
  fetch?: SearchFetch;
  limit?: number;
}): Promise<EvidenceCard[]> {
  const env = input.env ?? process.env;
  const httpFetch = input.fetch ?? defaultFetch();
  const limit = input.limit ?? 3;
  const enriched: EvidenceCard[] = [];
  let probes = 0;
  for (const card of input.cards) {
    if (!card.doi || probes >= limit) {
      enriched.push(card);
      continue;
    }
    probes += 1;
    try {
      const access = await probePublisherAccess({
        doi: card.doi,
        publisher: "auto",
        env,
        fetch: httpFetch
      });
      enriched.push({
        ...card,
        publisher: access.publisher,
        publisherAccess: access,
        accessStatus: bestAccessStatus(access),
        verificationDepth: access.collectionDepth === "licensed_snippet" ? "licensed_snippet" : card.verificationDepth,
        entitlementSource: access.publisher === "other" ? "crossref_tdm" : "publisher_api",
        collectionDepth: access.collectionDepth,
        licenseNote: access.licenseNote,
        verificationNote: access.verificationNote
      });
    } catch (error) {
      enriched.push({
        ...card,
        accessStatus: "license_unknown",
        verificationNote: `Publisher access probe failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
  return enriched;
}
