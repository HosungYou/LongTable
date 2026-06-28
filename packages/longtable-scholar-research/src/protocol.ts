import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const SCHOLAR_RESEARCH_SKILL_NAME = "scholar-research";

export const SCHOLAR_RESEARCH_FAILURE_REASONS = [
  "not_found",
  "no_full_text",
  "restricted_access",
  "robots_or_terms_blocked",
  "ambiguous_match",
  "download_failed",
  "parse_failed",
  "weak_evidence"
] as const;

export type ScholarResearchFailureReason = typeof SCHOLAR_RESEARCH_FAILURE_REASONS[number];

export const SCHOLAR_RESEARCH_SLOT_STATUSES = [
  "filled",
  "provisional",
  "unfilled",
  "blocked"
] as const;

export type ScholarResearchSlotStatus = typeof SCHOLAR_RESEARCH_SLOT_STATUSES[number];

export const SCHOLAR_RESEARCH_SMOKE_CATEGORIES = [
  "oa_pdf",
  "publisher_landing",
  "preprint_and_published",
  "restricted_fallback",
  "korean_institutional_report"
] as const;

export type ScholarResearchSmokeCategory = typeof SCHOLAR_RESEARCH_SMOKE_CATEGORIES[number];

export type ScholarResearchConnectorStatus = "ready" | "optional" | "missing";

export interface ScholarResearchConnectorReadiness {
  readonly name: string;
  readonly status: ScholarResearchConnectorStatus;
  readonly requiredEnv: readonly string[];
  readonly missingEnv: readonly string[];
  readonly purpose: string;
}

export interface ScholarResearchSafetyStatus {
  readonly paywallBypassAllowed: false;
  readonly institutionLoginAutomationAllowed: false;
  readonly cookieReuseAllowed: false;
  readonly robotsOrTermsBypassAllowed: false;
}

export interface ScholarResearchReadiness {
  readonly skillName: typeof SCHOLAR_RESEARCH_SKILL_NAME;
  readonly connectors: readonly ScholarResearchConnectorReadiness[];
  readonly safety: ScholarResearchSafetyStatus;
  readonly fallbackLedgerRequired: true;
  readonly citationSlotFilledRequiresFullTextQuote: true;
}

export interface ScholarResearchSmokeItem {
  readonly id: string;
  readonly category: ScholarResearchSmokeCategory;
  readonly label: string;
  readonly expectedBehavior: string;
}

export interface ScholarResearchRunScaffoldInput {
  readonly cwd: string;
  readonly runId?: string;
  readonly createdAt?: string;
}

export interface ScholarResearchRunScaffold {
  readonly runId: string;
  readonly runDir: string;
  readonly files: {
    readonly journal: string;
    readonly expansionLog: string;
    readonly claimLedger: string;
    readonly evidenceLedger: string;
    readonly fallbackLedger: string;
    readonly citationSlotMatrix: string;
    readonly manifest: string;
  };
}

interface ConnectorRequirement {
  readonly name: string;
  readonly requiredEnv: readonly string[];
  readonly purpose: string;
}

const CONNECTORS: readonly ConnectorRequirement[] = [
  {
    name: "Crossref",
    requiredEnv: [],
    purpose: "DOI and publisher metadata resolution."
  },
  {
    name: "OpenAlex",
    requiredEnv: [],
    purpose: "Open scholarly metadata and citation graph lookup; OPENALEX_API_KEY remains optional."
  },
  {
    name: "Semantic Scholar",
    requiredEnv: [],
    purpose: "Paper metadata, abstracts, citation counts, and open PDF hints."
  },
  {
    name: "arXiv",
    requiredEnv: [],
    purpose: "Preprint metadata and open PDF route discovery."
  },
  {
    name: "PubMed/PMC",
    requiredEnv: [],
    purpose: "Biomedical metadata and PubMed Central open full text discovery."
  },
  {
    name: "CORE",
    requiredEnv: ["CORE_API_KEY"],
    purpose: "Repository sweep for legal full text and institutional copies."
  },
  {
    name: "DOAJ",
    requiredEnv: [],
    purpose: "Open-access journal metadata and full-text links."
  },
  {
    name: "Local PDF folder/manual upload",
    requiredEnv: [],
    purpose: "Researcher-provided files when the researcher has legitimate access."
  }
];

const SAFETY_STATUS: ScholarResearchSafetyStatus = {
  paywallBypassAllowed: false,
  institutionLoginAutomationAllowed: false,
  cookieReuseAllowed: false,
  robotsOrTermsBypassAllowed: false
};

function hasEnv(env: Record<string, string | undefined>, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function connectorStatus(
  requirement: ConnectorRequirement,
  env: Record<string, string | undefined>
): ScholarResearchConnectorReadiness {
  const missingEnv = requirement.requiredEnv.filter((key) => !hasEnv(env, key));
  return {
    name: requirement.name,
    status: missingEnv.length === 0 ? "ready" : "missing",
    requiredEnv: requirement.requiredEnv,
    missingEnv,
    purpose: requirement.purpose
  };
}

export function assessScholarResearchReadiness(
  env: Record<string, string | undefined> = process.env
): ScholarResearchReadiness {
  return {
    skillName: SCHOLAR_RESEARCH_SKILL_NAME,
    connectors: CONNECTORS.map((connector) => connectorStatus(connector, env)),
    safety: SAFETY_STATUS,
    fallbackLedgerRequired: true,
    citationSlotFilledRequiresFullTextQuote: true
  };
}

export function buildScholarResearchSmokeFixture(): readonly ScholarResearchSmokeItem[] {
  return [
    { id: "oa-1", category: "oa_pdf", label: "Known open-access PDF seed", expectedBehavior: "Recover legal PDF/full text and mark citation slots filled only after quote extraction." },
    { id: "oa-2", category: "oa_pdf", label: "Open repository PDF seed", expectedBehavior: "Prefer repository PDF when publisher full text is not needed." },
    { id: "oa-3", category: "oa_pdf", label: "DOAJ full-text seed", expectedBehavior: "Resolve journal metadata and full-text route." },
    { id: "landing-1", category: "publisher_landing", label: "DOI landing page seed", expectedBehavior: "Resolve metadata and record landing-page-only fallback until full text is legal." },
    { id: "landing-2", category: "publisher_landing", label: "Publisher metadata seed", expectedBehavior: "Avoid claiming filled citation support from metadata alone." },
    { id: "preprint-1", category: "preprint_and_published", label: "arXiv plus published version", expectedBehavior: "Link preprint and version-of-record without treating them as identical evidence." },
    { id: "preprint-2", category: "preprint_and_published", label: "Repository manuscript plus DOI", expectedBehavior: "Record both routes and choose the evidence source explicitly." },
    { id: "restricted-1", category: "restricted_fallback", label: "Restricted publisher article", expectedBehavior: "Create fallback ledger and Researcher Checkpoint instead of bypassing access control." },
    { id: "restricted-2", category: "restricted_fallback", label: "Login-required full text", expectedBehavior: "Request manual upload only when the researcher has legitimate access." },
    { id: "kr-report-1", category: "korean_institutional_report", label: "Korean institutional PDF/report", expectedBehavior: "Recover legal report PDF and preserve Korean metadata." }
  ];
}

function generatedRunId(createdAt: string): string {
  return `scholar-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
}

function normalizeRunId(value: string): string {
  return value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "scholar-run";
}

export function buildScholarResearchRunScaffold(input: ScholarResearchRunScaffoldInput): ScholarResearchRunScaffold {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const runId = normalizeRunId(input.runId ?? generatedRunId(createdAt));
  const runDir = resolve(input.cwd, ".longtable", "research-runs", runId);
  return {
    runId,
    runDir,
    files: {
      journal: join(runDir, "journal.md"),
      expansionLog: join(runDir, "expansion-log.md"),
      claimLedger: join(runDir, "claim-ledger.md"),
      evidenceLedger: join(runDir, "evidence-ledger.md"),
      fallbackLedger: join(runDir, "fallback-ledger.md"),
      citationSlotMatrix: join(runDir, "citation-slot-matrix.md"),
      manifest: join(runDir, "sources", "manifest.jsonl")
    }
  };
}

function markdownFile(title: string, createdAt: string, lines: readonly string[] = []): string {
  return [`# ${title}`, "", `Created: ${createdAt}`, "", ...lines, ""].join("\n");
}

export async function writeScholarResearchRunScaffold(
  input: ScholarResearchRunScaffoldInput
): Promise<ScholarResearchRunScaffold> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const scaffold = buildScholarResearchRunScaffold({ ...input, createdAt });
  await mkdir(join(scaffold.runDir, "sources"), { recursive: true });
  await writeFile(scaffold.files.journal, markdownFile("Scholar Research Journal", createdAt), "utf8");
  await writeFile(scaffold.files.expansionLog, markdownFile("Expansion Log", createdAt), "utf8");
  await writeFile(scaffold.files.claimLedger, markdownFile("Claim Ledger", createdAt, ["| claim | risk | sources | status |", "| --- | --- | --- | --- |"]), "utf8");
  await writeFile(scaffold.files.evidenceLedger, markdownFile("Evidence Ledger", createdAt, ["| source | slot | status | note |", "| --- | --- | --- | --- |"]), "utf8");
  await writeFile(scaffold.files.fallbackLedger, markdownFile("Fallback Ledger", createdAt, ["| source | reason | fallback | checkpoint |", "| --- | --- | --- | --- |"]), "utf8");
  await writeFile(scaffold.files.citationSlotMatrix, markdownFile("Citation Slot Matrix", createdAt, ["| slot | claim | status | quote/claim | source |", "| --- | --- | --- | --- | --- |"]), "utf8");
  await writeFile(scaffold.files.manifest, "", "utf8");
  return scaffold;
}
