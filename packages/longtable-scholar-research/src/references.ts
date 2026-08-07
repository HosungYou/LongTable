import type { CanonicalPaper } from "./corpus.js";

export interface UnresolvedCitation {
  readonly paperId: string;
  readonly missingFields: readonly string[];
}

export interface ReferenceFormats {
  readonly cslJson: readonly Record<string, unknown>[];
  readonly ris: string;
  readonly bibtex: string;
  readonly apa7References: readonly string[];
  readonly unresolvedCitations: readonly UnresolvedCitation[];
  readonly unresolvedCitationReportMarkdown: string;
}

function sortedPapers(papers: readonly CanonicalPaper[]): CanonicalPaper[] {
  return [...papers].sort((left, right) =>
    (left.authors[0] ?? "").localeCompare(right.authors[0] ?? "") ||
    (left.year ?? 0) - (right.year ?? 0) ||
    left.title.localeCompare(right.title) ||
    left.paperId.localeCompare(right.paperId)
  );
}

function authorParts(author: string): { family?: string; given?: string; literal?: string } {
  const [family, ...givenParts] = author.split(",").map((part) => part.trim());
  if (givenParts.length === 0) return { literal: author };
  return { family, given: givenParts.join(", ") };
}

function initials(value: string): string {
  return value.split(/[\s-]+/).filter(Boolean).map((part) => `${part[0]?.toUpperCase() ?? ""}.`).join(" ");
}

function apaAuthors(authors: readonly string[]): string {
  const rendered = authors.map((author) => {
    const parts = authorParts(author);
    return parts.literal ?? `${parts.family}, ${initials(parts.given ?? "")}`;
  });
  if (rendered.length <= 1) return rendered[0] ?? "Unknown author";
  if (rendered.length === 2) return `${rendered[0]}, & ${rendered[1]}`;
  return `${rendered.slice(0, -1).join(", ")}, & ${rendered.at(-1)}`;
}

function bibtexKey(paper: CanonicalPaper): string {
  const lead = (paper.authors[0] ?? "unknown").split(",")[0].normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");
  return `${lead || "unknown"}${paper.year ?? "nd"}_${paper.paperId.replace(/^paper_?/, "").slice(0, 8)}`;
}

function escapeBibtex(value: string): string {
  return value.replaceAll("{", "\\{").replaceAll("}", "\\}");
}

export function renderReferenceFormats(papers: readonly CanonicalPaper[]): ReferenceFormats {
  const ordered = sortedPapers(papers);
  const cslJson = ordered.map((paper) => ({
    id: paper.paperId,
    type: "article-journal",
    title: paper.title,
    author: paper.authors.map(authorParts),
    ...(paper.year ? { issued: { "date-parts": [[paper.year]] } } : {}),
    ...(paper.venue ? { "container-title": paper.venue } : {}),
    ...(paper.doi ? { DOI: paper.doi } : {})
  }));
  const ris = ordered.map((paper) => [
    "TY  - JOUR",
    `ID  - ${paper.paperId}`,
    ...paper.authors.map((author) => `AU  - ${author}`),
    `TI  - ${paper.title}`,
    ...(paper.year ? [`PY  - ${paper.year}`] : []),
    ...(paper.venue ? [`JO  - ${paper.venue}`] : []),
    ...(paper.doi ? [`DO  - ${paper.doi}`] : []),
    "ER  -"
  ].join("\n")).join("\n\n");
  const bibtex = ordered.map((paper) => [
    `@article{${bibtexKey(paper)},`,
    `  title = {${escapeBibtex(paper.title)}},`,
    `  author = {${paper.authors.map(escapeBibtex).join(" and ")}},`,
    ...(paper.year ? [`  year = {${paper.year}},`] : []),
    ...(paper.venue ? [`  journal = {${escapeBibtex(paper.venue)}},`] : []),
    ...(paper.doi ? [`  doi = {${paper.doi}},`] : []),
    `  longtable_id = {${paper.paperId}}`,
    "}"
  ].join("\n")).join("\n\n");
  const apa7References = ordered.map((paper) => {
    const year = paper.year ? String(paper.year) : "n.d.";
    const venue = paper.venue ? ` *${paper.venue}*.` : "";
    const doi = paper.doi ? ` https://doi.org/${paper.doi}` : "";
    return `${apaAuthors(paper.authors)} (${year}). ${paper.title}.${venue}${doi}`;
  });
  const unresolvedCitations = ordered.flatMap((paper) => {
    const missingFields = [
      ...(paper.authors.length === 0 ? ["authors"] : []),
      ...(!paper.year ? ["year"] : []),
      ...(!paper.venue ? ["venue"] : []),
      ...(!paper.doi ? ["doi"] : [])
    ];
    return missingFields.length > 0 ? [{ paperId: paper.paperId, missingFields }] : [];
  });
  const unresolvedCitationReportMarkdown = [
    "# Unresolved citation fields",
    "",
    ...(unresolvedCitations.length > 0
      ? unresolvedCitations.map((entry) => `- ${entry.paperId}: ${entry.missingFields.join(", ")}`)
      : ["- None."])
  ].join("\n");
  return { cslJson, ris, bibtex, apa7References, unresolvedCitations, unresolvedCitationReportMarkdown };
}
