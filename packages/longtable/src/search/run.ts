import { buildResearchSearchIntent } from "./query.js";
import { dedupeAndRankCards } from "./rank.js";
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
  return fetch as unknown as SearchFetch;
}

export async function runResearchSearch(input: RunResearchSearchInput): Promise<EvidenceRun> {
  const createdAt = now();
  const id = runId();
  const intent = buildResearchSearchIntent(input);
  const env = input.env ?? process.env;
  const capabilities = assessSearchSourceCapabilities(intent.requestedSources, env);
  const skippedSources = capabilities.filter((capability) => !capability.enabled);

  if (skippedSources.length > 0 && input.allowPartial !== true) {
    const updatedAt = now();
    return {
      id,
      createdAt,
      updatedAt,
      status: "blocked",
      intent,
      sourceReports: skippedSources.map((capability): SourceReport => ({
        source: capability.source,
        status: "skipped",
        count: 0,
        elapsedMs: 0,
        reason: capability.reason
      })),
      cards: [],
      skippedSources,
      warnings: skippedSources.map((capability) => capability.reason ?? `${capability.source} unavailable.`),
      blockedReason: "One or more requested scholarly sources are unavailable. Confirm partial search or configure credentials."
    };
  }

  const httpFetch = input.fetch ?? defaultFetch();
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
    try {
      const result = await runSourceSearch({
        intent,
        source: capability.source,
        limit: intent.limit
      }, {
        fetch: httpFetch,
        env
      });
      cards.push(...result.cards);
      sourceReports.push({
        source: capability.source,
        status: "completed",
        count: result.cards.length,
        elapsedMs: Date.now() - started,
        endpoint: result.endpoint
      });
    } catch (error) {
      sourceReports.push({
        source: capability.source,
        status: "failed",
        count: 0,
        elapsedMs: Date.now() - started,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const rankedCards = dedupeAndRankCards(cards, intent);
  const hasFailure = sourceReports.some((report) => report.status === "failed" || report.status === "skipped");
  const status: EvidenceRunStatus = hasFailure ? "partial" : "completed";

  return {
    id,
    createdAt,
    updatedAt: now(),
    status,
    intent,
    sourceReports,
    cards: rankedCards,
    skippedSources,
    warnings: [
      ...skippedSources.map((capability) => capability.reason ?? `${capability.source} unavailable.`),
      ...sourceReports
        .filter((report) => report.status === "failed")
        .map((report) => `${report.source} failed: ${report.reason ?? "unknown error"}`)
    ]
  };
}
