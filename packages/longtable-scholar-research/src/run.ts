import { buildResearchSearchIntent } from "./query.js";
import { dedupeAndRankCards } from "./rank.js";
import { enrichCardsWithPublisherAccess } from "./publisher-access.js";
import {
  assessSearchSourceCapabilities,
  runSourceSearch
} from "./sources.js";
import type {
  EvidenceRun,
  EvidenceRunStatus,
  RunResearchSearchInput,
  SearchFetch,
  SourceReport
} from "./types.js";

function runId(): string {
  return `evidence_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

function defaultFetch(): SearchFetch {
  if (typeof fetch !== "function") {
    throw new Error("LongTable search requires a fetch-capable Node runtime.");
  }
  return fetch;
}

export async function runResearchSearch(input: RunResearchSearchInput): Promise<EvidenceRun> {
  const createdAt = now();
  const id = runId();
  const intent = buildResearchSearchIntent(input);
  const env = input.env ?? process.env;
  const capabilities = assessSearchSourceCapabilities(intent.requestedSources, env);
  const skippedSources = capabilities.filter((capability) => !capability.enabled);

  const httpFetch = input.fetch ?? defaultFetch();
  const timeoutMs = input.timeoutMs ?? 15000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    throw new Error("timeoutMs must be between 1 and 120000.");
  }
  const redact = (text: string): string => {
    let safe = text.replace(/([?&](?:api_key|apikey|key|token|mailto)=)[^&\s]+/gi, "$1[redacted]");
    for (const [key, value] of Object.entries(env)) {
      if (value && /KEY|TOKEN|SECRET|PASSWORD/i.test(key)) safe = safe.split(value).join("[redacted]");
    }
    return safe;
  };
  const sourceReports: SourceReport[] = [];
  const cards = [];

  for (const capability of capabilities) {
    if (!capability.enabled) {
      sourceReports.push({
        source: capability.source,
        status: "skipped",
        count: 0,
        elapsedMs: 0,
        reason: capability.reason
      });
      continue;
    }

    const started = Date.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Source timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      });
      const result = await Promise.race([runSourceSearch({
        intent,
        source: capability.source,
        limit: intent.limit
      }, {
        fetch: (url, init) => httpFetch(url, { ...init, signal: controller.signal }),
        env
      }), deadline]);
      cards.push(...result.cards);
      sourceReports.push({
        source: capability.source,
        status: "completed",
        count: result.cards.length,
        elapsedMs: Date.now() - started,
        endpoint: redact(result.endpoint)
      });
    } catch (error) {
      sourceReports.push({
        source: capability.source,
        status: "failed",
        count: 0,
        elapsedMs: Date.now() - started,
        reason: redact(error instanceof Error ? error.message : String(error))
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const rankedCards = dedupeAndRankCards(cards, intent);
  const finalCards = input.publisherAccess === true
    ? await enrichCardsWithPublisherAccess({
      cards: rankedCards,
      env,
      fetch: httpFetch
    })
    : rankedCards;
  const hasFailure = sourceReports.some((report) => report.status === "failed" || report.status === "skipped");
  const anyCompleted = sourceReports.some((report) => report.status === "completed");
  const status: EvidenceRunStatus = !anyCompleted || (hasFailure && input.allowPartial === false)
    ? "blocked" : hasFailure ? "partial" : "completed";

  return {
    id,
    createdAt,
    updatedAt: now(),
    status,
    intent,
    sourceReports,
    cards: finalCards,
    ...(status === "blocked" ? { blockedReason: anyCompleted
      ? "Strict source coverage was not met. Available evidence is retained; coverage-dependent conclusions remain incomplete."
      : "No requested source completed. Retry only after checking the reported failures." } : {}),
    skippedSources,
    warnings: [
      ...skippedSources.map((capability) => capability.reason ?? `${capability.source} unavailable.`),
      ...sourceReports
        .filter((report) => report.status === "failed")
        .map((report) => `${report.source} failed: ${report.reason ?? "unknown error"}`)
    ]
  };
}
