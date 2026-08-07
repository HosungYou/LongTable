import { createHash } from "node:crypto";

export const EXPORT_FORMATS = ["csv", "ris", "nbib", "json", "spreadsheet_xml"] as const;
export type ExportFormat = typeof EXPORT_FORMATS[number];

export interface CanonicalBibliographicRecord {
  readonly title: string;
  readonly authors: readonly string[];
  readonly year?: number;
  readonly abstract?: string;
  readonly doi?: string;
  readonly venue?: string;
  readonly keywords: readonly string[];
  readonly sourceDatabase: string;
  readonly sourceRecordId: string;
  readonly sourceRow: number;
  readonly exportArtifactSha256: string;
}

export type ExportParseRejectionReason =
  | "missing_title"
  | "malformed_row"
  | "malformed_export"
  | "empty_export";

export interface ExportParseRejection {
  readonly reason: ExportParseRejectionReason;
  readonly sourceRow?: number;
  readonly sourceRecordId?: string;
  readonly detail: string;
}

export interface ParsedExport {
  readonly format: ExportFormat;
  readonly artifactSha256: string;
  readonly records: readonly CanonicalBibliographicRecord[];
  readonly rejections: readonly ExportParseRejection[];
}

export interface ParserContext {
  readonly database: string;
  readonly artifactSha256: string;
}

export interface ParseExportArtifactInput {
  readonly filename: string;
  readonly format: ExportFormat | string;
  readonly database: string;
  readonly content: string | Buffer;
}

interface RecordFields {
  readonly title?: string;
  readonly authors?: readonly string[];
  readonly year?: string | number;
  readonly abstract?: string;
  readonly doi?: string;
  readonly venue?: string;
  readonly keywords?: readonly string[];
  readonly sourceRecordId?: string;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const cleaned = decodeEntities(String(value))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}

function normalizeDoi(value: unknown): string | undefined {
  const cleaned = cleanText(value);
  if (!cleaned) return undefined;
  const normalized = cleaned
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/\s*\[doi\]\s*$/i, "")
    .trim()
    .toLowerCase();
  return normalized || undefined;
}

function parseYear(value: unknown): number | undefined {
  const match = cleanText(value)?.match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}

function cleanList(values: readonly unknown[] | undefined): string[] {
  return (values ?? []).map(cleanText).filter((value): value is string => Boolean(value));
}

function splitList(value: unknown): string[] {
  const cleaned = cleanText(value);
  return cleaned ? cleaned.split(/\s*;\s*/).map((entry) => entry.trim()).filter(Boolean) : [];
}

function buildRecord(
  fields: RecordFields,
  context: ParserContext,
  sourceRow: number
): { readonly record?: CanonicalBibliographicRecord; readonly rejection?: ExportParseRejection } {
  const title = cleanText(fields.title);
  const sourceRecordId = cleanText(fields.sourceRecordId) ?? `${context.database}:row:${sourceRow}`;
  if (!title) {
    return {
      rejection: {
        reason: "missing_title",
        sourceRow,
        sourceRecordId,
        detail: "The export row has no usable title."
      }
    };
  }
  const year = parseYear(fields.year);
  const abstract = cleanText(fields.abstract);
  const doi = normalizeDoi(fields.doi);
  const venue = cleanText(fields.venue);
  return {
    record: {
      title,
      authors: cleanList(fields.authors),
      ...(year ? { year } : {}),
      ...(abstract ? { abstract } : {}),
      ...(doi ? { doi } : {}),
      ...(venue ? { venue } : {}),
      keywords: cleanList(fields.keywords),
      sourceDatabase: context.database,
      sourceRecordId,
      sourceRow,
      exportArtifactSha256: context.artifactSha256
    }
  };
}

function resultFromFields(
  format: ExportFormat,
  fields: readonly RecordFields[],
  context: ParserContext,
  firstSourceRow = 1
): ParsedExport {
  const records: CanonicalBibliographicRecord[] = [];
  const rejections: ExportParseRejection[] = [];
  fields.forEach((entry, index) => {
    const parsed = buildRecord(entry, context, firstSourceRow + index);
    if (parsed.record) records.push(parsed.record);
    if (parsed.rejection) rejections.push(parsed.rejection);
  });
  return { format, artifactSha256: context.artifactSha256, records, rejections };
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === "\"") {
        if (content[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === "\"") {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) {
    throw new Error("CSV ended inside a quoted field.");
  }
  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim()));
}

const HEADER_ALIASES: Record<string, readonly string[]> = {
  title: ["title", "article title", "document title", "ti"],
  authors: ["authors", "author", "author full names", "au"],
  year: ["publication year", "year", "py"],
  abstract: ["abstract", "ab"],
  doi: ["doi", "digital object identifier"],
  venue: ["source title", "publication name", "journal", "venue", "so"],
  sourceRecordId: ["accession number", "record id", "eid", "ut", "pmid", "an"],
  keywords: ["author keywords", "keywords", "kw"]
};

function normalizedHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function headerIndex(headers: readonly string[], field: keyof typeof HEADER_ALIASES): number {
  return headers.findIndex((header) => HEADER_ALIASES[field].includes(normalizedHeader(header)));
}

function cell(row: readonly string[], index: number): string | undefined {
  return index >= 0 ? row[index] : undefined;
}

function fieldsFromRows(rows: readonly string[][]): RecordFields[] {
  const headers = rows[0] ?? [];
  const indexes = {
    title: headerIndex(headers, "title"),
    authors: headerIndex(headers, "authors"),
    year: headerIndex(headers, "year"),
    abstract: headerIndex(headers, "abstract"),
    doi: headerIndex(headers, "doi"),
    venue: headerIndex(headers, "venue"),
    sourceRecordId: headerIndex(headers, "sourceRecordId"),
    keywords: headerIndex(headers, "keywords")
  };
  return rows.slice(1).map((row) => ({
    title: cell(row, indexes.title),
    authors: splitList(cell(row, indexes.authors)),
    year: cell(row, indexes.year),
    abstract: cell(row, indexes.abstract),
    doi: cell(row, indexes.doi),
    venue: cell(row, indexes.venue),
    sourceRecordId: cell(row, indexes.sourceRecordId),
    keywords: splitList(cell(row, indexes.keywords))
  }));
}

export function parseCsvExport(content: string, context: ParserContext): ParsedExport {
  return resultFromFields("csv", fieldsFromRows(parseCsvRows(content)), context, 2);
}

function parseTaggedRecords(
  content: string,
  linePattern: RegExp,
  recordEnd: (tag: string) => boolean
): Array<Map<string, string[]>> {
  const records: Array<Map<string, string[]>> = [];
  let current = new Map<string, string[]>();
  let lastTag: string | undefined;
  const finish = () => {
    if (current.size > 0) records.push(current);
    current = new Map<string, string[]>();
    lastTag = undefined;
  };
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(linePattern);
    if (match) {
      const tag = match[1];
      const value = match[2].trim();
      if (recordEnd(tag)) {
        finish();
        continue;
      }
      current.set(tag, [...(current.get(tag) ?? []), value]);
      lastTag = tag;
    } else if (/^\s+\S/.test(line) && lastTag) {
      const values = current.get(lastTag) ?? [];
      const lastIndex = values.length - 1;
      values[lastIndex] = `${values[lastIndex]} ${line.trim()}`;
      current.set(lastTag, values);
    } else if (!line.trim() && current.size > 0) {
      finish();
    }
  }
  finish();
  return records;
}

function firstTag(record: Map<string, string[]>, tags: readonly string[]): string | undefined {
  for (const tag of tags) {
    const value = record.get(tag)?.[0];
    if (value) return value;
  }
  return undefined;
}

function allTags(record: Map<string, string[]>, tags: readonly string[]): string[] {
  return tags.flatMap((tag) => record.get(tag) ?? []);
}

export function parseRisExport(content: string, context: ParserContext): ParsedExport {
  const records = parseTaggedRecords(content, /^([A-Z0-9]{2})  -\s?(.*)$/, (tag) => tag === "ER");
  const fields = records.map((record): RecordFields => ({
    title: firstTag(record, ["TI", "T1"]),
    authors: allTags(record, ["AU", "A1"]),
    year: firstTag(record, ["PY", "Y1"]),
    abstract: firstTag(record, ["AB", "N2"]),
    doi: firstTag(record, ["DO"]),
    venue: firstTag(record, ["JO", "JF", "T2"]),
    sourceRecordId: firstTag(record, ["AN", "ID"]),
    keywords: allTags(record, ["KW"])
  }));
  return resultFromFields("ris", fields, context);
}

export function parseNbibExport(content: string, context: ParserContext): ParsedExport {
  const records = parseTaggedRecords(content, /^([A-Z0-9]{2,4})\s*-\s?(.*)$/, () => false);
  const fields = records.map((record): RecordFields => ({
    title: firstTag(record, ["TI"]),
    authors: allTags(record, ["FAU", "AU"]),
    year: firstTag(record, ["DP"]),
    abstract: firstTag(record, ["AB"]),
    doi: firstTag(record, ["LID", "AID"]),
    venue: firstTag(record, ["JT", "TA"]),
    sourceRecordId: firstTag(record, ["PMID"]),
    keywords: allTags(record, ["OT", "MH"])
  }));
  return resultFromFields("nbib", fields, context);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function crossrefYear(item: Record<string, unknown>): number | undefined {
  const date = asObject(item.published ?? item.issued);
  const parts = asArray(date["date-parts"]);
  return parseYear(asArray(parts[0])[0]);
}

function crossrefAuthor(value: unknown): string | undefined {
  const author = asObject(value);
  return cleanText([author.given, author.family].map(cleanText).filter(Boolean).join(" ") || author.name);
}

export function parseJsonExport(content: string, context: ParserContext): ParsedExport {
  const parsed = JSON.parse(content) as unknown;
  const root = asObject(parsed);
  const message = asObject(root.message);
  const items = Array.isArray(parsed) ? parsed : asArray(message.items).length > 0 ? asArray(message.items) : asArray(root.records);
  const fields = items.map((value): RecordFields => {
    const item = asObject(value);
    const doi = cleanText(item.DOI ?? item.doi);
    return {
      title: cleanText(asArray(item.title)[0] ?? item.title),
      authors: asArray(item.author ?? item.authors).map(crossrefAuthor).filter((entry): entry is string => Boolean(entry)),
      year: crossrefYear(item) ?? parseYear(item.year),
      abstract: cleanText(item.abstract),
      doi,
      venue: cleanText(asArray(item["container-title"])[0] ?? item.venue),
      sourceRecordId: cleanText(item.id ?? item.sourceRecordId) ?? normalizeDoi(doi),
      keywords: cleanList(asArray(item.subject ?? item.keywords))
    };
  });
  return resultFromFields("json", fields, context);
}

export function parseSpreadsheetXmlExport(content: string, context: ParserContext): ParsedExport {
  const rows = [...content.matchAll(/<Row\b[^>]*>([\s\S]*?)<\/Row>/gi)].map((rowMatch) =>
    [...rowMatch[1].matchAll(/<Cell\b[^>]*>([\s\S]*?)<\/Cell>/gi)].map((cellMatch) => {
      const data = cellMatch[1].match(/<Data\b[^>]*>([\s\S]*?)<\/Data>/i)?.[1] ?? "";
      return cleanText(data) ?? "";
    })
  );
  return resultFromFields("spreadsheet_xml", fieldsFromRows(rows), context, 2);
}

function withEmptyRejection(result: ParsedExport): ParsedExport {
  if (result.records.length > 0 || result.rejections.length > 0) {
    return result;
  }
  return {
    ...result,
    rejections: [{ reason: "empty_export", detail: "The export contains no bibliographic records." }]
  };
}

export function parseExportArtifact(input: ParseExportArtifactInput): ParsedExport {
  if (!EXPORT_FORMATS.includes(input.format as ExportFormat)) {
    throw new Error(`Unsupported export format: ${input.format}`);
  }
  const buffer = typeof input.content === "string" ? Buffer.from(input.content, "utf8") : input.content;
  const artifactSha256 = createHash("sha256").update(buffer).digest("hex");
  const context = { database: input.database, artifactSha256 };
  const content = buffer.toString("utf8");
  try {
    const parsed = input.format === "csv"
      ? parseCsvExport(content, context)
      : input.format === "ris"
        ? parseRisExport(content, context)
        : input.format === "nbib"
          ? parseNbibExport(content, context)
          : input.format === "json"
            ? parseJsonExport(content, context)
            : parseSpreadsheetXmlExport(content, context);
    return withEmptyRejection(parsed);
  } catch (error) {
    return {
      format: input.format as ExportFormat,
      artifactSha256,
      records: [],
      rejections: [{
        reason: "malformed_export",
        detail: `${input.filename}: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}
