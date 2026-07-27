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

async function withTimeout<T>(work: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  const sourceConcurrency = Math.max(1, Math.min(8, input.sourceConcurrency ?? 3));
  const sourceRetries = Math.max(0, Math.min(3, input.sourceRetries ?? 1));
  const sourceTimeoutMs = Math.max(100, Math.min(120_000, input.sourceTimeoutMs ?? 20_000));
  const sourceReports: Array<SourceReport | undefined> = new Array(capabilities.length);
  const sourceCards: Array<EvidenceRun["cards"]> = new Array(capabilities.length);
  const cards: EvidenceRun["cards"] = [];
  let nextCapability = 0;

  async function runWorker(): Promise<void> {
    while (nextCapability < capabilities.length) {
      const index = nextCapability++;
      const capability = capabilities[index];
      if (!capability.enabled) {
        sourceReports[index] = {
        source: capability.source,
        status: "skipped",
        count: 0,
        elapsedMs: 0,
        reason: capability.reason
        };
        sourceCards[index] = [];
        continue;
      }

      const started = Date.now();
      let lastError: unknown;
      for (let attempt = 0; attempt <= sourceRetries; attempt += 1) {
        try {
          const result = await withTimeout(runSourceSearch({
            intent,
            source: capability.source,
            limit: intent.limit
          }, {
            fetch: httpFetch,
            env
          }), sourceTimeoutMs, capability.source);
          sourceCards[index] = result.cards;
          sourceReports[index] = {
            source: capability.source,
            status: "completed",
            count: result.cards.length,
            elapsedMs: Date.now() - started,
            endpoint: result.endpoint
          };
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError) {
        sourceCards[index] = [];
        sourceReports[index] = {
          source: capability.source,
          status: "failed",
          count: 0,
          elapsedMs: Date.now() - started,
          reason: lastError instanceof Error ? lastError.message : String(lastError)
        };
      }
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(sourceConcurrency, capabilities.length) },
    () => runWorker()
  ));
  for (const entries of sourceCards) cards.push(...(entries ?? []));
  const completedReports = sourceReports.filter((report): report is SourceReport => Boolean(report));

  const rankedCards = dedupeAndRankCards(cards, intent);
  const finalCards = input.publisherAccess === true
    ? await enrichCardsWithPublisherAccess({
      cards: rankedCards,
      env,
      fetch: httpFetch
    })
    : rankedCards;
  const hasFailure = completedReports.some((report) => report.status === "failed" || report.status === "skipped");
  const status: EvidenceRunStatus = hasFailure ? "partial" : "completed";

  return {
    id,
    createdAt,
    updatedAt: now(),
    status,
    intent,
    sourceReports: completedReports,
    cards: finalCards,
    skippedSources,
    warnings: [
      ...skippedSources.map((capability) => capability.reason ?? `${capability.source} unavailable.`),
      ...completedReports
        .filter((report) => report.status === "failed")
        .map((report) => `${report.source} failed: ${report.reason ?? "unknown error"}`)
    ]
  };
}
