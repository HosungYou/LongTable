import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { promisify } from "node:util";
import {
  appendFile,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import type { EvidenceCard } from "./types.js";

const execFileAsync = promisify(execFile);

export const FULLTEXT_ACCESS_CLASSES = [
  "public_oa",
  "manual_legitimate_access",
  "licensed_tdm",
  "private"
] as const;

export type FullTextAccessClass = typeof FULLTEXT_ACCESS_CLASSES[number];

export function parseFullTextAccessClass(value?: string | boolean): FullTextAccessClass | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (!FULLTEXT_ACCESS_CLASSES.includes(value as FullTextAccessClass)) {
    throw new Error(`Unknown PDF access class: ${value}`);
  }
  return value as FullTextAccessClass;
}

export interface ParsedPdfPage {
  page: number;
  text: string;
  locator: string;
  extraction: "text" | "ocr";
}

export interface ParsedPdfDocument {
  pageCount: number;
  pages: ParsedPdfPage[];
  ocrPages: number[];
  parser: {
    pdfinfo: string;
    pdftotext: string;
    pdftoppm?: string;
    tesseract?: string;
  };
}

export interface FullTextManifestRecord {
  schema: "longtable.fulltext-manifest-record";
  version: 1;
  sourceId: string;
  originalName: string;
  originalPath: string;
  storedPath: string;
  derivedTextPath: string;
  contentHash: string;
  sourceVersion: string;
  accessClass: FullTextAccessClass;
  storageClass: "global_public_cache" | "project_isolated";
  byteLength: number;
  pageCount: number;
  ocrPages: number[];
  collectedAt: string;
  acquisition?: {
    route: "public_oa_url";
    sourceCardId: string;
    sourceRoute: string;
    requestedUrl: string;
    resolvedUrl: string;
    httpStatus: number;
    contentType?: string;
  };
}

export interface IngestPdfDirectoryInput {
  pdfDirectory: string;
  runDir: string;
  accessClass: FullTextAccessClass;
  globalCacheRoot?: string;
  parser?: (path: string) => Promise<ParsedPdfDocument>;
}

export type PublicOaAcquisitionFailureReason =
  | "not_found"
  | "no_full_text"
  | "restricted_access"
  | "robots_or_terms_blocked"
  | "ambiguous_match"
  | "download_failed"
  | "parse_failed"
  | "weak_evidence";

export interface PublicOaAcquisitionEvent {
  schema: "longtable.public-oa-acquisition-event";
  version: 1;
  sourceCardId: string;
  sourceRoute: string;
  requestedUrl?: string;
  resolvedUrl?: string;
  status: "acquired" | "failed";
  failureReason?: PublicOaAcquisitionFailureReason;
  detail: string;
  contentHash?: string;
  manifestSourceId?: string;
  occurredAt: string;
}

export interface PublicOaFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: {
    get(name: string): string | null;
  };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type PublicOaFetch = (
  input: string,
  init: {
    method: "GET";
    redirect: "manual";
    credentials: "omit";
    headers: Record<string, string>;
    signal: AbortSignal;
  }
) => Promise<PublicOaFetchResponse>;

export interface AcquirePublicOaFullTextInput {
  cards: EvidenceCard[];
  runDir: string;
  maxDocuments?: number;
  maxBytesPerDocument?: number;
  timeoutMs?: number;
  globalCacheRoot?: string;
  parser?: (path: string) => Promise<ParsedPdfDocument>;
  fetch?: PublicOaFetch;
  resolveHost?: (hostname: string) => Promise<string[]>;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function toolPath(envName: string, fallback: string): string {
  return process.env[envName]?.trim() || fallback;
}

async function pageCount(path: string, pdfinfo: string): Promise<number> {
  const result = await execFileAsync(pdfinfo, [path], { maxBuffer: 4 * 1024 * 1024 });
  const match = /^Pages:\s+(\d+)\s*$/m.exec(result.stdout);
  if (!match) throw new Error(`pdfinfo did not report a page count for ${basename(path)}.`);
  return Number(match[1]);
}

async function extractPageText(path: string, page: number, pdftotext: string): Promise<string> {
  const result = await execFileAsync(
    pdftotext,
    ["-f", String(page), "-l", String(page), "-layout", "-enc", "UTF-8", path, "-"],
    { maxBuffer: 32 * 1024 * 1024 }
  );
  return result.stdout.replace(/\u0000/g, "").trim();
}

async function ocrPage(path: string, page: number, pdftoppm: string, tesseract: string): Promise<string> {
  const temporary = await mkdtemp(join(tmpdir(), "longtable-ocr-"));
  try {
    const prefix = join(temporary, "page");
    await execFileAsync(
      pdftoppm,
      ["-f", String(page), "-l", String(page), "-r", "300", "-png", "-singlefile", path, prefix],
      { maxBuffer: 8 * 1024 * 1024 }
    );
    const image = `${prefix}.png`;
    const result = await execFileAsync(
      tesseract,
      [image, "stdout", "-l", process.env.LONGTABLE_OCR_LANG?.trim() || "eng"],
      { maxBuffer: 32 * 1024 * 1024 }
    );
    return result.stdout.replace(/\u0000/g, "").trim();
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function parsePdfWithLocalTools(path: string): Promise<ParsedPdfDocument> {
  const pdfinfo = toolPath("LONGTABLE_PDFINFO_BIN", "pdfinfo");
  const pdftotext = toolPath("LONGTABLE_PDFTOTEXT_BIN", "pdftotext");
  const pdftoppm = toolPath("LONGTABLE_PDFTOPPM_BIN", "pdftoppm");
  const tesseract = toolPath("LONGTABLE_TESSERACT_BIN", "tesseract");
  const count = await pageCount(path, pdfinfo);
  const pages: ParsedPdfPage[] = [];
  const ocrPages: number[] = [];
  for (let page = 1; page <= count; page += 1) {
    let text = await extractPageText(path, page, pdftotext);
    let extraction: ParsedPdfPage["extraction"] = "text";
    if (text.replace(/\s+/g, "").length < 20) {
      text = await ocrPage(path, page, pdftoppm, tesseract);
      extraction = "ocr";
      ocrPages.push(page);
    }
    pages.push({ page, text, locator: `page:${page}`, extraction });
  }
  return {
    pageCount: count,
    pages,
    ocrPages,
    parser: { pdfinfo, pdftotext, pdftoppm, tesseract }
  };
}

function globalPublicCacheRoot(input?: string): string {
  return resolve(input ?? join(homedir(), ".longtable", "cache", "fulltext", "sha256"));
}

function privateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  return a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && b === 51) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 203 && b === 0) ||
    a >= 224;
}

function privateIp(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (isIP(normalized) === 4) return privateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized === "::" || normalized === "::1" ||
      normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb") ||
      normalized.startsWith("2001:db8")) {
    return true;
  }
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  return mapped ? privateIpv4(mapped[1]) : false;
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  if (isIP(hostname)) return [hostname];
  return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

async function assertSafePublicOaUrl(
  raw: string,
  resolveHost: (hostname: string) => Promise<string[]>
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("The OA candidate URL is invalid.");
  }
  if (url.protocol !== "https:") throw new Error("Only HTTPS OA acquisition is allowed.");
  if (url.username || url.password) throw new Error("Credential-bearing OA URLs are prohibited.");
  if (url.port && url.port !== "443") throw new Error("Non-standard OA URL ports are prohibited.");
  if (url.hostname.toLowerCase() === "localhost" || url.hostname.endsWith(".localhost")) {
    throw new Error("Loopback OA URLs are prohibited.");
  }
  const addresses = await resolveHost(url.hostname);
  if (addresses.length === 0 || addresses.some(privateIp)) {
    throw new Error("OA URL resolution reached a private, local, or reserved network.");
  }
  return url;
}

function redirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function fetchPublicOaPdf(input: {
  url: string;
  maxBytes: number;
  timeoutMs: number;
  fetch: PublicOaFetch;
  resolveHost: (hostname: string) => Promise<string[]>;
}): Promise<{
  bytes: Buffer;
  resolvedUrl: string;
  status: number;
  contentType?: string;
}> {
  let current = await assertSafePublicOaUrl(input.url, input.resolveHost);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
    let response: PublicOaFetchResponse;
    try {
      response = await input.fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        headers: {
          Accept: "application/pdf,application/octet-stream;q=0.8",
          "User-Agent": "LongTable/0.1 scholarly-evidence-acquisition"
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    if (redirectStatus(response.status)) {
      if (redirects === 5) throw new Error("OA acquisition exceeded five validated redirects.");
      const location = response.headers.get("location");
      if (!location) throw new Error("OA redirect did not include a Location header.");
      current = await assertSafePublicOaUrl(
        new URL(location, current).toString(),
        input.resolveHost
      );
      continue;
    }
    if (response.status === 401 || response.status === 403 || response.status === 451) {
      throw new Error(`OA route returned restricted access (${response.status}).`);
    }
    if (!response.ok) throw new Error(`OA download failed with HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > input.maxBytes) {
      throw new Error(`OA PDF exceeds the ${input.maxBytes}-byte acquisition limit.`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > input.maxBytes) {
      throw new Error(`OA response size is outside the 1-${input.maxBytes} byte limit.`);
    }
    if (bytes.subarray(0, Math.min(bytes.length, 1024)).indexOf("%PDF-") < 0) {
      throw new Error("OA response did not contain a PDF signature.");
    }
    return {
      bytes,
      resolvedUrl: response.url || current.toString(),
      status: response.status,
      ...(response.headers.get("content-type")
        ? { contentType: response.headers.get("content-type")! }
        : {})
    };
  }
  throw new Error("OA acquisition ended without a terminal response.");
}

function oaFailureReason(error: unknown): PublicOaAcquisitionFailureReason {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("restricted access") || message.includes("private, local") ||
      message.includes("credential-bearing") || message.includes("prohibited")) {
    return "restricted_access";
  }
  if (message.includes("pdf signature")) return "parse_failed";
  if (message.includes("abort") || message.includes("http") || message.includes("download") ||
      message.includes("redirect") || message.includes("size") || message.includes("limit")) {
    return "download_failed";
  }
  return "download_failed";
}

async function appendOaEvent(runDir: string, event: PublicOaAcquisitionEvent): Promise<void> {
  const path = join(runDir, "sources", "acquisition-events.jsonl");
  await mkdir(resolve(path, ".."), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
}

export async function acquirePublicOaFullText(
  input: AcquirePublicOaFullTextInput
): Promise<{
  records: FullTextManifestRecord[];
  events: PublicOaAcquisitionEvent[];
  manifestPath: string;
  eventsPath: string;
}> {
  const maxDocuments = Math.max(1, Math.min(50, input.maxDocuments ?? 10));
  const maxBytes = Math.max(1_000_000, Math.min(200_000_000, input.maxBytesPerDocument ?? 50_000_000));
  const timeoutMs = Math.max(1_000, Math.min(120_000, input.timeoutMs ?? 30_000));
  const fetcher: PublicOaFetch = input.fetch ?? (async (url, init) => {
    return await fetch(url, init) as unknown as PublicOaFetchResponse;
  });
  const resolveHost = input.resolveHost ?? defaultResolveHost;
  const parser = input.parser ?? parsePdfWithLocalTools;
  const manifestPath = join(input.runDir, "sources", "manifest.jsonl");
  const eventsPath = join(input.runDir, "sources", "acquisition-events.jsonl");
  const knownHashes = await existingManifestHashes(manifestPath);
  const records: FullTextManifestRecord[] = [];
  const events: PublicOaAcquisitionEvent[] = [];
  const candidates = input.cards
    .filter((card) => card.legalFullTextAvailable)
    .filter((card, index, cards) =>
      cards.findIndex((candidate) =>
        candidate.fullTextUrl === card.fullTextUrl && candidate.id === card.id
      ) === index
    )
    .slice(0, maxDocuments);
  await mkdir(join(input.runDir, "sources"), { recursive: true });

  for (const card of candidates) {
    const occurredAt = new Date().toISOString();
    if (!card.fullTextUrl) {
      const event: PublicOaAcquisitionEvent = {
        schema: "longtable.public-oa-acquisition-event",
        version: 1,
        sourceCardId: card.id,
        sourceRoute: card.sourceRoute,
        status: "failed",
        failureReason: "no_full_text",
        detail: "The metadata source asserted OA availability but supplied no full-text URL.",
        occurredAt
      };
      events.push(event);
      await appendOaEvent(input.runDir, event);
      continue;
    }
    try {
      const downloaded = await fetchPublicOaPdf({
        url: card.fullTextUrl,
        maxBytes,
        timeoutMs,
        fetch: fetcher,
        resolveHost
      });
      const digest = sha256(downloaded.bytes);
      const contentHash = `sha256:${digest}`;
      if (knownHashes.has(contentHash)) {
        const event: PublicOaAcquisitionEvent = {
          schema: "longtable.public-oa-acquisition-event",
          version: 1,
          sourceCardId: card.id,
          sourceRoute: card.sourceRoute,
          requestedUrl: card.fullTextUrl,
          resolvedUrl: downloaded.resolvedUrl,
          status: "acquired",
          detail: "The OA PDF was already present in this run by content hash.",
          contentHash,
          occurredAt
        };
        events.push(event);
        await appendOaEvent(input.runDir, event);
        continue;
      }
      const storedPath = join(globalPublicCacheRoot(input.globalCacheRoot), digest.slice(0, 2), `${digest}.pdf`);
      await mkdir(resolve(storedPath, ".."), { recursive: true });
      try {
        await stat(storedPath);
      } catch {
        await writeFile(storedPath, downloaded.bytes);
      }
      let parsed: ParsedPdfDocument;
      try {
        parsed = await parser(storedPath);
      } catch (error) {
        const event: PublicOaAcquisitionEvent = {
          schema: "longtable.public-oa-acquisition-event",
          version: 1,
          sourceCardId: card.id,
          sourceRoute: card.sourceRoute,
          requestedUrl: card.fullTextUrl,
          resolvedUrl: downloaded.resolvedUrl,
          status: "failed",
          failureReason: "parse_failed",
          detail: error instanceof Error ? error.message : String(error),
          contentHash,
          occurredAt
        };
        events.push(event);
        await appendOaEvent(input.runDir, event);
        continue;
      }
      const derivedTextPath = join(input.runDir, "derived", "fulltext", `${digest}.json`);
      await mkdir(resolve(derivedTextPath, ".."), { recursive: true });
      await writeFile(derivedTextPath, `${JSON.stringify({
        schema: "longtable.parsed-fulltext",
        version: 1,
        contentHash,
        sourceVersion: contentHash,
        accessClass: "public_oa",
        ...parsed
      }, null, 2)}\n`, "utf8");
      const record: FullTextManifestRecord = {
        schema: "longtable.fulltext-manifest-record",
        version: 1,
        sourceId: card.id,
        originalName: `${card.doi ?? card.id}.pdf`.replace(/[^A-Za-z0-9._-]+/g, "_"),
        originalPath: card.fullTextUrl,
        storedPath,
        derivedTextPath,
        contentHash,
        sourceVersion: contentHash,
        accessClass: "public_oa",
        storageClass: "global_public_cache",
        byteLength: downloaded.bytes.length,
        pageCount: parsed.pageCount,
        ocrPages: parsed.ocrPages,
        collectedAt: occurredAt,
        acquisition: {
          route: "public_oa_url",
          sourceCardId: card.id,
          sourceRoute: card.sourceRoute,
          requestedUrl: card.fullTextUrl,
          resolvedUrl: downloaded.resolvedUrl,
          httpStatus: downloaded.status,
          ...(downloaded.contentType ? { contentType: downloaded.contentType } : {})
        }
      };
      await appendFile(manifestPath, `${JSON.stringify(record)}\n`, "utf8");
      knownHashes.add(contentHash);
      records.push(record);
      const event: PublicOaAcquisitionEvent = {
        schema: "longtable.public-oa-acquisition-event",
        version: 1,
        sourceCardId: card.id,
        sourceRoute: card.sourceRoute,
        requestedUrl: card.fullTextUrl,
        resolvedUrl: downloaded.resolvedUrl,
        status: "acquired",
        detail: "The public OA PDF passed URL, network, size, signature, hash, and parser checks.",
        contentHash,
        manifestSourceId: record.sourceId,
        occurredAt
      };
      events.push(event);
      await appendOaEvent(input.runDir, event);
    } catch (error) {
      const event: PublicOaAcquisitionEvent = {
        schema: "longtable.public-oa-acquisition-event",
        version: 1,
        sourceCardId: card.id,
        sourceRoute: card.sourceRoute,
        requestedUrl: card.fullTextUrl,
        status: "failed",
        failureReason: oaFailureReason(error),
        detail: error instanceof Error ? error.message : String(error),
        occurredAt
      };
      events.push(event);
      await appendOaEvent(input.runDir, event);
    }
  }
  return { records, events, manifestPath, eventsPath };
}

async function existingManifestHashes(path: string): Promise<Set<string>> {
  return new Set((await readFullTextManifest(path)).map((record) => record.contentHash));
}

export async function readFullTextManifest(path: string): Promise<FullTextManifestRecord[]> {
  try {
    const lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
    return lines.map((line) => {
      try {
        return JSON.parse(line) as FullTextManifestRecord;
      } catch {
        return undefined;
      }
    }).filter((record): record is FullTextManifestRecord => Boolean(record?.contentHash));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function ingestPdfDirectory(input: IngestPdfDirectoryInput): Promise<FullTextManifestRecord[]> {
  const directory = resolve(input.pdfDirectory);
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".pdf")
    .sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length === 0) throw new Error(`No PDF files were found in ${directory}.`);

  const manifestPath = join(input.runDir, "sources", "manifest.jsonl");
  const knownHashes = await existingManifestHashes(manifestPath);
  const parser = input.parser ?? parsePdfWithLocalTools;
  const records: FullTextManifestRecord[] = [];
  await mkdir(join(input.runDir, "sources"), { recursive: true });

  for (const entry of entries) {
    const originalPath = join(directory, entry.name);
    const bytes = await readFile(originalPath);
    const hash = sha256(bytes);
    if (knownHashes.has(`sha256:${hash}`)) continue;
    const metadata = await stat(originalPath);
    const publicCache = input.accessClass === "public_oa";
    const storedPath = publicCache
      ? join(globalPublicCacheRoot(input.globalCacheRoot), hash.slice(0, 2), `${hash}.pdf`)
      : join(input.runDir, "sources", "content", `${hash}.pdf`);
    await mkdir(resolve(storedPath, ".."), { recursive: true });
    try {
      await stat(storedPath);
    } catch {
      await copyFile(originalPath, storedPath);
    }
    const parsed = await parser(storedPath);
    const derivedTextPath = join(input.runDir, "derived", "fulltext", `${hash}.json`);
    await mkdir(resolve(derivedTextPath, ".."), { recursive: true });
    await writeFile(derivedTextPath, `${JSON.stringify({
      schema: "longtable.parsed-fulltext",
      version: 1,
      contentHash: `sha256:${hash}`,
      sourceVersion: `sha256:${hash}`,
      accessClass: input.accessClass,
      ...parsed
    }, null, 2)}\n`, "utf8");
    const record: FullTextManifestRecord = {
      schema: "longtable.fulltext-manifest-record",
      version: 1,
      sourceId: `file:${hash}`,
      originalName: entry.name,
      originalPath,
      storedPath,
      derivedTextPath,
      contentHash: `sha256:${hash}`,
      sourceVersion: `sha256:${hash}`,
      accessClass: input.accessClass,
      storageClass: publicCache ? "global_public_cache" : "project_isolated",
      byteLength: metadata.size,
      pageCount: parsed.pageCount,
      ocrPages: parsed.ocrPages,
      collectedAt: new Date().toISOString()
    };
    await appendFile(manifestPath, `${JSON.stringify(record)}\n`, "utf8");
    knownHashes.add(record.contentHash);
    records.push(record);
  }
  return records;
}
