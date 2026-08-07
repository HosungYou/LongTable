import { createHash } from "node:crypto";
import type { CanonicalBibliographicRecord } from "./export-parsers.js";

export interface BibliographicSourceLink {
  readonly sourceDatabase: string;
  readonly sourceRecordId: string;
  readonly sourceRow: number;
  readonly exportArtifactSha256: string;
}

export interface NormalizedBibliographicRecord extends CanonicalBibliographicRecord {
  readonly normalizedTitle: string;
  readonly recordFingerprint: string;
  readonly sourceLink: BibliographicSourceLink;
}

export interface CanonicalPaper {
  readonly paperId: string;
  readonly title: string;
  readonly normalizedTitle: string;
  readonly authors: readonly string[];
  readonly year?: number;
  readonly abstract?: string;
  readonly doi?: string;
  readonly venue?: string;
  readonly keywords: readonly string[];
  readonly sourceLinks: readonly BibliographicSourceLink[];
  readonly provenanceBasis: readonly string[];
}

export interface DuplicateLink {
  readonly paperId: string;
  readonly primarySource: BibliographicSourceLink;
  readonly duplicateSource: BibliographicSourceLink;
  readonly basis: "exact_doi" | "exact_normalized_title_year";
}

export interface VersionLink {
  readonly leftPaperId: string;
  readonly rightPaperId: string;
  readonly reason: "same_title_year_different_identifier";
}

export interface DeduplicatedBibliographicCorpus {
  readonly papers: readonly CanonicalPaper[];
  readonly duplicateLinks: readonly DuplicateLink[];
  readonly versionLinks: readonly VersionLink[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeDoi(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  return value
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .toLowerCase() || undefined;
}

export function normalizeBibliographicTitle(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/&/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceLink(record: CanonicalBibliographicRecord): BibliographicSourceLink {
  return {
    sourceDatabase: record.sourceDatabase,
    sourceRecordId: record.sourceRecordId,
    sourceRow: record.sourceRow,
    exportArtifactSha256: record.exportArtifactSha256
  };
}

export function normalizeBibliographicRecords(
  records: readonly CanonicalBibliographicRecord[]
): NormalizedBibliographicRecord[] {
  return records.map((record) => {
    const doi = normalizeDoi(record.doi);
    const normalizedTitle = normalizeBibliographicTitle(record.title);
    const link = sourceLink(record);
    return {
      ...record,
      ...(doi ? { doi } : {}),
      normalizedTitle,
      sourceLink: link,
      recordFingerprint: sha256(JSON.stringify(link))
    };
  });
}

function deduplicationKey(record: NormalizedBibliographicRecord): string {
  if (record.doi) return `doi:${record.doi}`;
  return `title-year:${record.normalizedTitle}:${record.year ?? "unknown"}`;
}

function compareSourceLinks(left: BibliographicSourceLink, right: BibliographicSourceLink): number {
  return left.sourceDatabase.localeCompare(right.sourceDatabase) ||
    left.sourceRecordId.localeCompare(right.sourceRecordId) ||
    left.exportArtifactSha256.localeCompare(right.exportArtifactSha256) ||
    left.sourceRow - right.sourceRow;
}

function compareRepresentatives(left: NormalizedBibliographicRecord, right: NormalizedBibliographicRecord): number {
  return Number(Boolean(right.abstract)) - Number(Boolean(left.abstract)) ||
    (right.abstract?.length ?? 0) - (left.abstract?.length ?? 0) ||
    right.authors.length - left.authors.length ||
    right.title.length - left.title.length ||
    left.title.localeCompare(right.title) ||
    compareSourceLinks(left.sourceLink, right.sourceLink);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function paperFromGroup(key: string, group: readonly NormalizedBibliographicRecord[]): CanonicalPaper {
  const sorted = [...group].sort(compareRepresentatives);
  const representative = sorted[0];
  const sourceLinks = group.map((record) => record.sourceLink).sort(compareSourceLinks);
  const paperId = `paper_${sha256(key).slice(0, 24)}`;
  return {
    paperId,
    title: representative.title,
    normalizedTitle: representative.normalizedTitle,
    authors: [...representative.authors],
    ...(representative.year ? { year: representative.year } : {}),
    ...(representative.abstract ? { abstract: representative.abstract } : {}),
    ...(representative.doi ? { doi: representative.doi } : {}),
    ...(representative.venue ? { venue: representative.venue } : {}),
    keywords: uniqueSorted(group.flatMap((record) => record.keywords)),
    sourceLinks,
    provenanceBasis: [
      representative.doi ? `canonical exact DOI ${representative.doi}` : `canonical exact normalized title/year ${representative.normalizedTitle}/${representative.year ?? "unknown"}`,
      ...sourceLinks.map((link) => `${link.sourceDatabase}:${link.sourceRecordId}@${link.exportArtifactSha256}`)
    ]
  };
}

function versionLinks(papers: readonly CanonicalPaper[]): VersionLink[] {
  const links: VersionLink[] = [];
  for (let leftIndex = 0; leftIndex < papers.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < papers.length; rightIndex += 1) {
      const left = papers[leftIndex];
      const right = papers[rightIndex];
      if (
        left.normalizedTitle === right.normalizedTitle &&
        left.year === right.year &&
        left.doi && right.doi && left.doi !== right.doi
      ) {
        links.push({
          leftPaperId: left.paperId,
          rightPaperId: right.paperId,
          reason: "same_title_year_different_identifier"
        });
      }
    }
  }
  return links.sort((left, right) =>
    left.leftPaperId.localeCompare(right.leftPaperId) || left.rightPaperId.localeCompare(right.rightPaperId)
  );
}

export function deduplicateBibliographicRecords(
  records: readonly NormalizedBibliographicRecord[]
): DeduplicatedBibliographicCorpus {
  const groups = new Map<string, NormalizedBibliographicRecord[]>();
  for (const record of records) {
    const key = deduplicationKey(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const papers: CanonicalPaper[] = [];
  const duplicateLinks: DuplicateLink[] = [];
  for (const [key, group] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const paper = paperFromGroup(key, group);
    papers.push(paper);
    const sources = [...paper.sourceLinks];
    for (const duplicateSource of sources.slice(1)) {
      duplicateLinks.push({
        paperId: paper.paperId,
        primarySource: sources[0],
        duplicateSource,
        basis: key.startsWith("doi:") ? "exact_doi" : "exact_normalized_title_year"
      });
    }
  }
  papers.sort((left, right) => left.paperId.localeCompare(right.paperId));
  duplicateLinks.sort((left, right) =>
    left.paperId.localeCompare(right.paperId) || compareSourceLinks(left.duplicateSource, right.duplicateSource)
  );
  return { papers, duplicateLinks, versionLinks: versionLinks(papers) };
}
