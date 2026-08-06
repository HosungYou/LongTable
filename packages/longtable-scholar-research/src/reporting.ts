import { createHash } from "node:crypto";
import type { CorpusCounts } from "./invariants.js";
import { verifyCorpusInvariants } from "./invariants.js";
import { renderPrismaCountTable, renderPrismaFlowSvg } from "./prisma.js";
import type { ArtifactProvenance, ProtocolRevision, ResearchRun } from "./workflow-types.js";

export interface DatabaseYield {
  readonly databaseId: string;
  readonly searchedAt: string;
  readonly resultCount: number;
  readonly exportedCount: number;
}

export interface ResearchFailureSummary {
  readonly code: string;
  readonly count: number;
  readonly resolution: string;
}

export interface ProtocolDeviation {
  readonly id: string;
  readonly description: string;
  readonly decisionRecordId: string;
}

export interface ResearchReportInput {
  readonly run: ResearchRun;
  readonly protocol: ProtocolRevision;
  readonly counts: CorpusCounts;
  readonly databaseYields: readonly DatabaseYield[];
  readonly failures: readonly ResearchFailureSummary[];
  readonly unresolvedIssues: readonly string[];
  readonly deviations: readonly ProtocolDeviation[];
  readonly analysisReadiness: string;
  readonly requiredActions: readonly string[];
  readonly generatedArtifacts: readonly string[];
  readonly inputArtifactIds: readonly string[];
  readonly renderTimestamp: string;
  readonly generatorVersion: string;
}

export interface SystematicReviewNarrative {
  readonly methodsMarkdown: string;
  readonly resultsMarkdown?: string;
}

export interface ResearchOutputs {
  readonly researcherReportMarkdown: string;
  readonly prismaCountTableMarkdown: string;
  readonly prismaFlowSvg: string;
  readonly systematicReviewMarkdown: string;
  readonly artifactProvenance: readonly ArtifactProvenance[];
}

function bullets(values: readonly string[], empty: string): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : `- ${empty}`;
}

function numberWord(value: number): string {
  const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
  return words[value] ?? String(value);
}

export function renderSystematicReviewNarrative(input: {
  readonly status: "planned" | "completed";
  readonly protocol: ProtocolRevision;
  readonly counts: CorpusCounts;
}): SystematicReviewNarrative {
  const databases = input.protocol.databases.join(", ");
  if (input.status === "planned") {
    return {
      methodsMarkdown: `### Planned methods\n\n${databases} will be searched using the frozen database-specific queries and filters recorded in protocol revision ${input.protocol.revision}. Export, normalization, deduplication, screening, full-text acquisition, and synthesis decisions will be retained in append-only audit ledgers.`
    };
  }
  if (!verifyCorpusInvariants(input.counts).passed) {
    throw new Error("Cannot render completed systematic review narrative because corpus count invariants failed.");
  }
  return {
    methodsMarkdown: `### Methods\n\n${databases} were searched using the frozen database-specific queries and filters recorded in protocol revision ${input.protocol.revision}. Export, normalization, deduplication, screening, full-text acquisition, and synthesis decisions were retained in append-only audit ledgers.`,
    resultsMarkdown: `### Results\n\n${numberWord(input.counts.identified)} records were identified. After normalization and duplicate linkage, ${input.counts.unique} unique records remained; ${input.counts.fulltextAssessed} reports were assessed in full text and ${input.counts.finalIncluded} studies were included.`
  };
}

function renderResearcherReport(input: ResearchReportInput): string {
  const yields = [...input.databaseYields]
    .sort((left, right) => left.databaseId.localeCompare(right.databaseId))
    .map((entry) => `| ${entry.databaseId} | ${entry.searchedAt} | ${entry.resultCount} | ${entry.exportedCount} |`);
  const failures = [...input.failures]
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((entry) => `- ${entry.code}: ${entry.count} occurrence(s); ${entry.resolution}`);
  const deviations = [...input.deviations]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entry) => `- ${entry.id}: ${entry.description} (DecisionRecord: ${entry.decisionRecordId})`);
  return [
    "# Researcher audit report",
    "",
    `Run: ${input.run.id}`,
    `Rendered: ${input.renderTimestamp}`,
    "",
    "## Protocol and databases",
    "",
    `- Frozen protocol: ${input.protocol.id}, revision ${input.protocol.revision}, hash ${input.protocol.protocolHash}`,
    ...input.protocol.databases.map((database) => `- ${database}: ${input.protocol.queries[database] ?? "query not recorded"}`),
    "",
    "## Database yields",
    "",
    "| Database | Searched at | Results | Exported |",
    "|---|---|---:|---:|",
    ...yields,
    "",
    "## Failures and recoveries",
    "",
    failures.length > 0 ? failures.join("\n") : "- None recorded.",
    "",
    "## Unresolved issues",
    "",
    bullets(input.unresolvedIssues, "None."),
    "",
    "## Deviations",
    "",
    deviations.length > 0 ? deviations.join("\n") : "- None recorded.",
    "",
    "## Analysis readiness",
    "",
    `- ${input.analysisReadiness}`,
    "",
    "## Required researcher actions",
    "",
    bullets(input.requiredActions, "None."),
    "",
    "## Generated artifacts",
    "",
    bullets(input.generatedArtifacts, "None."),
    ""
  ].join("\n");
}

function provenance(input: ResearchReportInput, kind: string, content: string): ArtifactProvenance {
  const sha256 = createHash("sha256").update(content).digest("hex");
  return {
    id: `artifact_${kind}_${sha256.slice(0, 16)}`,
    sourceStage: "RESEARCHER_REPORT",
    inputArtifactIds: [...input.inputArtifactIds].sort(),
    protocolRevisionId: input.protocol.id,
    generator: `longtable-research-${kind}`,
    generatorVersion: input.generatorVersion,
    sha256,
    createdAt: input.renderTimestamp
  };
}

export function renderResearchOutputs(input: ResearchReportInput): ResearchOutputs {
  const audit = verifyCorpusInvariants(input.counts);
  if (!audit.passed) {
    throw new Error(`Cannot render research outputs because corpus count invariants failed: ${audit.equations.filter((entry) => !entry.passed).map((entry) => entry.expression).join(", ")}`);
  }
  const researcherReportMarkdown = renderResearcherReport(input);
  const prismaCountTableMarkdown = renderPrismaCountTable(input.counts);
  const prismaFlowSvg = renderPrismaFlowSvg(input.counts);
  const narrative = renderSystematicReviewNarrative({ status: "completed", protocol: input.protocol, counts: input.counts });
  const systematicReviewMarkdown = [narrative.methodsMarkdown, narrative.resultsMarkdown].filter(Boolean).join("\n\n");
  const contents = [
    ["researcher-report", researcherReportMarkdown],
    ["review-flow-table", prismaCountTableMarkdown],
    ["review-flow-svg", prismaFlowSvg],
    ["systematic-review", systematicReviewMarkdown]
  ] as const;
  return {
    researcherReportMarkdown,
    prismaCountTableMarkdown,
    prismaFlowSvg,
    systematicReviewMarkdown,
    artifactProvenance: contents.map(([kind, content]) => provenance(input, kind, content))
  };
}

