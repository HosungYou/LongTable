import type { CorpusCounts } from "./invariants.js";
import { verifyCorpusInvariants } from "./invariants.js";

function requireEligibleCounts(counts: CorpusCounts): void {
  if (!verifyCorpusInvariants(counts).prismaEligible) {
    throw new Error("Cannot render PRISMA artifacts because corpus count invariants failed.");
  }
}

const COUNT_ROWS: readonly [string, keyof CorpusCounts][] = [
  ["Identified records", "identified"],
  ["Parse-rejected records", "parseRejected"],
  ["Unique records", "unique"],
  ["Duplicate links", "duplicateLinks"],
  ["Title/abstract records screened", "titleAbstractScreened"],
  ["Title/abstract records excluded", "titleAbstractExcluded"],
  ["Reports sought for retrieval", "fulltextSought"],
  ["Reports not retrieved", "fulltextNotRetrieved"],
  ["Reports assessed for eligibility", "fulltextAssessed"],
  ["Full-text reports excluded", "fulltextExcluded"],
  ["Studies included in review", "finalIncluded"],
  ["Unresolved records", "unresolved"]
];

export function renderPrismaCountTable(counts: CorpusCounts): string {
  requireEligibleCounts(counts);
  return [
    "| Review flow item | Count |",
    "|---|---:|",
    ...COUNT_ROWS.map(([label, key]) => `| ${label} | ${counts[key]} |`)
  ].join("\n");
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderPrismaFlowSvg(counts: CorpusCounts): string {
  requireEligibleCounts(counts);
  const nodes = [
    ["Records identified", counts.identified],
    ["Unique records screened", counts.titleAbstractScreened],
    ["Reports sought for retrieval", counts.fulltextSought],
    ["Reports assessed for eligibility", counts.fulltextAssessed],
    ["Studies included in review", counts.finalIncluded]
  ] as const;
  const nodeHeight = 64;
  const gap = 36;
  const width = 640;
  const height = 40 + nodes.length * nodeHeight + (nodes.length - 1) * gap + 40;
  const elements: string[] = [];
  nodes.forEach(([label, count], index) => {
    const y = 40 + index * (nodeHeight + gap);
    if (index > 0) {
      elements.push(`<path d="M320 ${y - gap} V${y}" stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>`);
    }
    elements.push(`<rect x="120" y="${y}" width="400" height="${nodeHeight}" rx="8" fill="#f8fafc" stroke="#334155"/>`);
    elements.push(`<text x="320" y="${y + 27}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#0f172a">${escapeXml(label)}</text>`);
    elements.push(`<text x="320" y="${y + 49}" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#0f172a">n = ${count}</text>`);
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    "<title id=\"title\">Review study flow</title>",
    "<desc id=\"desc\">Deterministic flow generated from the audited corpus counts.</desc>",
    "<defs><marker id=\"arrow\" markerWidth=\"8\" markerHeight=\"8\" refX=\"7\" refY=\"4\" orient=\"auto\"><path d=\"M0,0 L8,4 L0,8 z\" fill=\"#475569\"/></marker></defs>",
    ...elements,
    "</svg>"
  ].join("\n");
}

