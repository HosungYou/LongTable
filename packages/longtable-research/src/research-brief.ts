import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const RESEARCH_BRIEF_VERSION = "1.0.0";

export interface ResearchBrief {
  schema: "longtable.research-brief";
  version: typeof RESEARCH_BRIEF_VERSION;
  briefId: string;
  createdAt: string;
  updatedAt: string;
  problem: string;
  decision: string;
  candidateResearchQuestion: string;
  contextAndPopulation: string;
  evidenceNeeds: string[];
  targetJournal: string | null;
  accessConstraints: string[];
  deliverables: string[];
  successCriteria: string[];
  openTensions: string[];
  provenance: {
    source: "longtable_interview" | "cli" | "imported";
    clarifyingQuestionCount: number;
  };
}

export interface ResearchBriefSeed {
  query: string;
  targetJournal?: string;
  field?: string;
  source?: ResearchBrief["provenance"]["source"];
}

function idFrom(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

export function buildResearchBrief(seed: ResearchBriefSeed): ResearchBrief {
  const query = seed.query.trim();
  if (!query) throw new Error("A Research Brief requires a candidate research question.");
  const timestamp = new Date().toISOString();
  const targetJournal = seed.targetJournal?.trim() || null;
  const field = seed.field?.trim();
  const identity = { query, targetJournal, field: field ?? null };
  return {
    schema: "longtable.research-brief",
    version: RESEARCH_BRIEF_VERSION,
    briefId: `brief-${idFrom(identity)}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    problem: query,
    decision: "Produce a verified, journal-grounded research package for the stated problem.",
    candidateResearchQuestion: query,
    contextAndPopulation: field || "Not yet specified",
    evidenceNeeds: [
      "Relevant peer-reviewed and repository evidence",
      "Exact full-text evidence spans with locators",
      "Target-journal topic and format patterns"
    ],
    targetJournal,
    accessConstraints: [
      "Use only public OA, user-supplied lawful copies, or explicitly licensed TDM routes",
      "Do not bypass paywalls, WAFs, robots controls, or institutional authentication"
    ],
    deliverables: [
      "Evidence and claim ledger",
      "Journal-grounded synthesis",
      "Human-reviewed editable tables, figures, or diagrams when warranted",
      "Verified Research Package"
    ],
    successCriteria: [
      "Every material claim is traceable to bounded evidence",
      "All hard Research Assurance gates pass",
      "The package is reproducible from its manifest"
    ],
    openTensions: targetJournal ? [] : ["Target journal remains to be selected or verified."],
    provenance: {
      source: seed.source ?? "cli",
      clarifyingQuestionCount: 0
    }
  };
}

export function validateResearchBrief(value: unknown): ResearchBrief {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Research Brief must be a JSON object.");
  }
  const brief = value as Partial<ResearchBrief>;
  if (brief.schema !== "longtable.research-brief" || brief.version !== RESEARCH_BRIEF_VERSION) {
    throw new Error(`Research Brief must use longtable.research-brief ${RESEARCH_BRIEF_VERSION}.`);
  }
  const requiredStrings: Array<keyof ResearchBrief> = [
    "briefId",
    "createdAt",
    "updatedAt",
    "problem",
    "decision",
    "candidateResearchQuestion",
    "contextAndPopulation"
  ];
  for (const field of requiredStrings) {
    if (typeof brief[field] !== "string" || !(brief[field] as string).trim()) {
      throw new Error(`Research Brief field ${field} must be a non-empty string.`);
    }
  }
  const requiredArrays: Array<keyof ResearchBrief> = [
    "evidenceNeeds",
    "accessConstraints",
    "deliverables",
    "successCriteria",
    "openTensions"
  ];
  for (const field of requiredArrays) {
    if (!Array.isArray(brief[field]) || !(brief[field] as unknown[]).every((entry) => typeof entry === "string")) {
      throw new Error(`Research Brief field ${field} must be a string array.`);
    }
  }
  if (!brief.provenance ||
      !["longtable_interview", "cli", "imported"].includes(String(brief.provenance.source)) ||
      !Number.isInteger(brief.provenance.clarifyingQuestionCount) ||
      brief.provenance.clarifyingQuestionCount < 0 ||
      brief.provenance.clarifyingQuestionCount > 3) {
    throw new Error("Research Brief provenance must identify its source and no more than three clarifying questions.");
  }
  return brief as ResearchBrief;
}

export async function readResearchBrief(path: string): Promise<ResearchBrief> {
  return validateResearchBrief(JSON.parse(await readFile(path, "utf8")));
}

export function renderResearchBriefMarkdown(brief: ResearchBrief): string {
  const list = (items: string[]): string => items.length > 0
    ? items.map((item) => `- ${item}`).join("\n")
    : "- None recorded";
  return [
    "# Research Brief",
    "",
    `Brief ID: ${brief.briefId}`,
    `Version: ${brief.version}`,
    "",
    "## Problem",
    "",
    brief.problem,
    "",
    "## Decision",
    "",
    brief.decision,
    "",
    "## Candidate research question",
    "",
    brief.candidateResearchQuestion,
    "",
    "## Context and population",
    "",
    brief.contextAndPopulation,
    "",
    "## Evidence needs",
    "",
    list(brief.evidenceNeeds),
    "",
    "## Target journal",
    "",
    brief.targetJournal ?? "Not yet selected",
    "",
    "## Access constraints",
    "",
    list(brief.accessConstraints),
    "",
    "## Deliverables",
    "",
    list(brief.deliverables),
    "",
    "## Success criteria",
    "",
    list(brief.successCriteria),
    "",
    "## Open tensions",
    "",
    list(brief.openTensions),
    ""
  ].join("\n");
}
