import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { buildSearchStrategyCheckpoint } from "./checkpoints.js";
import { createResearchRun, createStageReceipt } from "./workflow-state.js";
import { createProtocolRevision } from "./workflow-types.js";
import {
  appendJsonlRecord,
  buildResearchProjectLayout,
  readJsonlRecords,
  writeFrozenProtocolRevision,
  writeResearchProjectScaffold
} from "./project-store.js";
import { parseExportArtifact, type ExportFormat } from "./export-parsers.js";
import { deduplicateBibliographicRecords, normalizeBibliographicRecords } from "./corpus.js";
import { createScreeningDecision, type ScreeningDecisionInput } from "./screening.js";
import { intakeResearchPdf, type PdfAccessBasis, type PdfAcquisitionMethod } from "./pdf-vault.js";
import { renderResearchOutputs, type ResearchReportInput } from "./reporting.js";
import { buildApprovedManuscript, type BuildApprovedManuscriptInput } from "./manuscript.js";
import { validateRenderProfile } from "./render-profiles.js";
import { renderWordManuscript } from "./word-renderer.js";
import {
  adjudicateExtractionConflict,
  createExtractionProfile,
  detectExtractionConflicts,
  freezeExtractedDataset,
  validateExtractionRecord,
  type ExtractedDatasetFreezeInput,
  type ExtractionAdjudication,
  type ExtractionAdjudicationInput,
  type ExtractionConflict,
  type ExtractionProfile,
  type ExtractionProfileInput,
  type ExtractionRecord
} from "./extraction.js";

export type InstitutionalResearchCommand = "pilot" | "freeze" | "ingest-export" | "screen" | "acquire" | "freeze-extraction" | "extract" | "adjudicate-extraction" | "freeze-data" | "report" | "package" | "live-smoke";
export const INSTITUTIONAL_RESEARCH_COMMANDS: readonly InstitutionalResearchCommand[] = [
  "pilot", "freeze", "ingest-export", "screen", "acquire", "freeze-extraction", "extract", "adjudicate-extraction", "freeze-data", "report", "package", "live-smoke"
];
export type InstitutionalResearchCommandArgs = Readonly<Record<string, string | boolean | undefined>>;

function text(args: InstitutionalResearchCommandArgs, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Research command requires --${key}.`);
  return value.trim();
}

function optionalText(args: InstitutionalResearchCommandArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function jsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeJsonl(path: string, values: readonly object[]): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, values.length ? `${values.map((value) => JSON.stringify(value)).join("\n")}\n` : "", "utf8");
}

async function writeImmutableJson(path: string, value: unknown): Promise<boolean> {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await mkdir(resolve(path, ".."), { recursive: true });
  try {
    await writeFile(path, content, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (await readFile(path, "utf8") !== content) throw new Error(`Immutable extraction-profile collision at ${path}.`);
    return false;
  }
}

function projectRoot(args: InstitutionalResearchCommandArgs): string {
  return resolve(optionalText(args, "cwd") ?? process.cwd());
}

async function pilot(args: InstitutionalResearchCommandArgs) {
  const root = projectRoot(args);
  const layout = await writeResearchProjectScaffold(root);
  const createdAt = optionalText(args, "createdAt") ?? new Date().toISOString();
  const runId = text(args, "runId");
  const protocolReference = optionalText(args, "protocolReference") ?? "draft-1";
  const run = createResearchRun({ id: runId, createdAt });
  const checkpoint = buildSearchStrategyCheckpoint({
    runId,
    protocolReference,
    createdAt,
    reviewType: "systematic document analysis",
    objective: "Pilot the frozen demand-supply mismatch review frame before production.",
    databaseGroups: {
      core: ["web-of-science", "scopus"],
      domain: ["ERIC", "RISS"],
      complementary: [],
      normalization: ["Crossref"],
      fulltextResolution: ["institutional resolver", "Research PDF Vault"]
    },
    filters: { languages: ["Korean", "English"], publicationTypes: ["Article", "Conference Paper"] },
    recallPrecisionPosture: "recall_first",
    accessLimitations: ["Researcher owns login, MFA, CAPTCHA, and terms decisions."]
  });
  await appendJsonlRecord(layout.audit.checkpoints, checkpoint);
  await writeJson(join(layout.researchRuns, `${runId}.json`), run);
  return { surface: "longtable-research", run, checkpoint, layout };
}

async function freeze(args: InstitutionalResearchCommandArgs) {
  const root = projectRoot(args);
  const layout = await writeResearchProjectScaffold(root);
  const protocol = createProtocolRevision(await jsonFile(text(args, "protocolFile")));
  const path = await writeFrozenProtocolRevision(layout, protocol);
  return { protocol, path };
}

async function immutableRawExport(path: string, target: string): Promise<boolean> {
  await mkdir(resolve(target, ".."), { recursive: true });
  try {
    await copyFile(path, target, constants.COPYFILE_EXCL);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const [source, existing] = await Promise.all([readFile(path), readFile(target)]);
    if (!source.equals(existing)) throw new Error(`Immutable raw-export collision at ${target}.`);
    return false;
  }
}

async function ingestExport(args: InstitutionalResearchCommandArgs) {
  const root = projectRoot(args);
  const layout = await writeResearchProjectScaffold(root);
  const path = resolve(text(args, "file"));
  const database = text(args, "database");
  const format = text(args, "format") as ExportFormat;
  const content = await readFile(path);
  const parsed = parseExportArtifact({ filename: basename(path), format, database, content });
  if (parsed.records.length === 0) throw new Error(`Export intake produced no records: ${parsed.rejections.map((entry) => entry.reason).join(", ")}.`);
  const extension = extname(path) || `.${format}`;
  const rawPath = join(layout.data.rawExports, `${parsed.artifactSha256}${extension}`);
  const rawArtifactCreated = await immutableRawExport(path, rawPath);
  const normalized = normalizeBibliographicRecords(parsed.records);
  const corpus = deduplicateBibliographicRecords(normalized);
  await writeJson(join(layout.data.normalized, `${parsed.artifactSha256}.json`), normalized);
  await writeJson(join(layout.data.deduplicated, `${parsed.artifactSha256}.json`), corpus);
  await writeFile(layout.corpus.papers, corpus.papers.map((paper) => JSON.stringify(paper)).join("\n") + "\n", "utf8");
  return { parsed, corpus, rawPath, rawArtifactCreated };
}

async function screen(args: InstitutionalResearchCommandArgs) {
  const root = projectRoot(args);
  const layout = await writeResearchProjectScaffold(root);
  const inputs = await jsonFile<ScreeningDecisionInput[]>(text(args, "decisionsFile"));
  const existing = await readJsonlRecords(layout.corpus.screeningDecisions) as unknown as { id: string }[];
  const ids = new Set(existing.map((entry) => entry.id));
  let appended = 0;
  for (const input of inputs) {
    const decision = createScreeningDecision(input);
    if (ids.has(decision.id)) continue;
    await appendJsonlRecord(layout.corpus.screeningDecisions, decision);
    ids.add(decision.id);
    appended += 1;
  }
  return { appended, total: ids.size };
}

async function acquire(args: InstitutionalResearchCommandArgs) {
  const root = projectRoot(args);
  const layout = await writeResearchProjectScaffold(root);
  return intakeResearchPdf({
    projectRoot: root,
    vaultRoot: text(args, "vaultRoot"),
    projectManifestPath: layout.corpus.pdfManifest,
    candidatePath: text(args, "candidatePath"),
    paperId: text(args, "paperId"),
    acquisitionMethod: text(args, "acquisitionMethod") as PdfAcquisitionMethod,
    accessBasis: text(args, "accessBasis") as PdfAccessBasis,
    version: text(args, "version"),
    projectInclusion: text(args, "projectInclusion"),
    screeningState: text(args, "screeningState"),
    ...(optionalText(args, "sourceUrl") ? { sourceUrl: optionalText(args, "sourceUrl") } : {}),
    ...(optionalText(args, "acquiredAt") ? { acquiredAt: optionalText(args, "acquiredAt") } : {})
  });
}

async function freezeExtraction(args: InstitutionalResearchCommandArgs) {
  const layout = await writeResearchProjectScaffold(projectRoot(args));
  const profile = createExtractionProfile(await jsonFile<ExtractionProfileInput>(text(args, "profileFile")));
  const path = join(layout.protocol.extractionProfiles, `${profile.id}.json`);
  const created = await writeImmutableJson(path, profile);
  return { profile, path, created };
}

async function loadExtractionProfile(args: InstitutionalResearchCommandArgs): Promise<ExtractionProfile> {
  const input = await jsonFile<ExtractionProfileInput | ExtractionProfile>(text(args, "profileFile"));
  return createExtractionProfile(input);
}

async function extract(args: InstitutionalResearchCommandArgs) {
  const layout = await writeResearchProjectScaffold(projectRoot(args));
  const profile = await loadExtractionProfile(args);
  const inputs = await jsonFile<ExtractionRecord[]>(text(args, "recordsFile"));
  const existing = await readJsonlRecords(layout.corpus.extractionRecords) as unknown as ExtractionRecord[];
  const byId = new Map(existing.map((record) => [record.id, validateExtractionRecord(profile, record)]));
  let appended = 0;
  for (const input of inputs) {
    const record = validateExtractionRecord(profile, input);
    const current = byId.get(record.id);
    if (current && JSON.stringify(current) !== JSON.stringify(record)) throw new Error(`Immutable extraction-record collision: ${record.id}.`);
    if (!current) {
      byId.set(record.id, record);
      appended += 1;
    }
  }
  const records = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const conflicts = detectExtractionConflicts(profile, records);
  await Promise.all([
    writeJsonl(layout.corpus.extractionRecords, records),
    writeJsonl(layout.corpus.extractionConflicts, conflicts)
  ]);
  return { appended, total: records.length, conflicts: conflicts.length };
}

type AdjudicationFileEntry = ExtractionAdjudicationInput & { readonly conflictId: string };

async function adjudicateExtraction(args: InstitutionalResearchCommandArgs) {
  const layout = await writeResearchProjectScaffold(projectRoot(args));
  const profile = await loadExtractionProfile(args);
  const inputs = await jsonFile<AdjudicationFileEntry[]>(text(args, "adjudicationsFile"));
  const conflicts = await readJsonlRecords(layout.corpus.extractionConflicts) as unknown as ExtractionConflict[];
  const existing = await readJsonlRecords(layout.corpus.extractionAdjudications) as unknown as ExtractionAdjudication[];
  const byId = new Map(existing.map((item) => [item.id, item]));
  let appended = 0;
  for (const { conflictId, ...input } of inputs) {
    const conflict = conflicts.find((item) => item.id === conflictId);
    if (!conflict) throw new Error(`Unknown extraction conflict: ${conflictId}.`);
    const adjudication = adjudicateExtractionConflict(profile, conflict, input);
    const current = byId.get(adjudication.id);
    if (current && JSON.stringify(current) !== JSON.stringify(adjudication)) throw new Error(`Immutable extraction-adjudication collision: ${adjudication.id}.`);
    if (!current) {
      byId.set(adjudication.id, adjudication);
      appended += 1;
    }
  }
  const adjudications = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  await writeJsonl(layout.corpus.extractionAdjudications, adjudications);
  return { appended, total: adjudications.length };
}

type FreezeDataFile = Pick<ExtractedDatasetFreezeInput, "id" | "decisionRecordId" | "frozenAt" | "reliability">;

async function freezeData(args: InstitutionalResearchCommandArgs) {
  const layout = await writeResearchProjectScaffold(projectRoot(args));
  const profile = await loadExtractionProfile(args);
  const metadata = await jsonFile<FreezeDataFile>(text(args, "freezeFile"));
  const records = await readJsonlRecords(layout.corpus.extractionRecords) as unknown as ExtractionRecord[];
  const conflicts = await readJsonlRecords(layout.corpus.extractionConflicts) as unknown as ExtractionConflict[];
  const adjudications = await readJsonlRecords(layout.corpus.extractionAdjudications) as unknown as ExtractionAdjudication[];
  const freeze = freezeExtractedDataset({ ...metadata, profile, records, conflicts, adjudications });
  const existing = await readJsonlRecords(layout.audit.extractedDataFreezes) as unknown as { id: string; datasetHash: string }[];
  const current = existing.find((item) => item.id === freeze.id);
  if (current && current.datasetHash !== freeze.datasetHash) throw new Error(`Immutable extracted-data freeze collision: ${freeze.id}.`);
  if (!current) await appendJsonlRecord(layout.audit.extractedDataFreezes, freeze);
  await writeJson(join(layout.data.analysisReady, `${freeze.datasetHash}.json`), { profile, records, adjudications, freeze });
  return { freeze, created: !current };
}

async function report(args: InstitutionalResearchCommandArgs) {
  const root = projectRoot(args);
  const layout = await writeResearchProjectScaffold(root);
  const input = await jsonFile<ResearchReportInput>(text(args, "inputFile"));
  const outputs = renderResearchOutputs(input);
  await Promise.all([
    writeFile(join(layout.reports, "researcher-report.md"), outputs.researcherReportMarkdown, "utf8"),
    writeFile(join(layout.reports, "review-flow-counts.md"), outputs.prismaCountTableMarkdown, "utf8"),
    writeFile(join(layout.reports, "review-flow.svg"), outputs.prismaFlowSvg, "utf8"),
    writeFile(join(layout.reports, "systematic-review.md"), outputs.systematicReviewMarkdown, "utf8"),
    writeJson(join(layout.reports, "artifact-provenance.json"), outputs.artifactProvenance)
  ]);
  return { outputs, reportsDirectory: layout.reports };
}

async function packageManuscript(args: InstitutionalResearchCommandArgs) {
  const root = projectRoot(args);
  const layout = await writeResearchProjectScaffold(root);
  const input = await jsonFile<BuildApprovedManuscriptInput>(text(args, "inputFile"));
  const profile = validateRenderProfile(await jsonFile(text(args, "profileFile")));
  const manuscript = buildApprovedManuscript(input);
  const outputPath = resolve(optionalText(args, "outputPath") ?? join(layout.manuscript, "manuscript.docx"));
  const rendered = renderWordManuscript({ manuscript, profile, outputPath });
  await writeJson(join(layout.manuscript, `${basename(outputPath, extname(outputPath))}.provenance.json`), manuscript.provenanceMap);
  return { manuscript, rendered };
}

export function validateLiveSmokeGate(input: { readonly recordCount: number; readonly pdfCount: number; readonly researcherApproved: boolean }): void {
  if (!Number.isInteger(input.recordCount) || input.recordCount < 5 || input.recordCount > 20) throw new Error("Live smoke requires 5–20 metadata records.");
  if (!Number.isInteger(input.pdfCount) || input.pdfCount < 1 || input.pdfCount > 2) throw new Error("Live smoke requires one or two permitted PDFs.");
  if (!input.researcherApproved) throw new Error("Live smoke requires explicit researcher approval.");
}

async function liveSmoke(args: InstitutionalResearchCommandArgs) {
  const root = projectRoot(args);
  const layout = await writeResearchProjectScaffold(root);
  const recordCount = Number(text(args, "recordCount"));
  const pdfCount = Number(text(args, "pdfCount"));
  const researcherApproved = args.researcherApproved === true;
  validateLiveSmokeGate({ recordCount, pdfCount, researcherApproved });
  const productionEligible = researcherApproved && args.profileApproved === true && args.calibrated === true && args.replayPassed === true;
  const completedAt = optionalText(args, "completedAt") ?? new Date().toISOString();
  const receipt = createStageReceipt({
    id: `live-smoke-${text(args, "runId")}`,
    runId: text(args, "runId"),
    stage: "PILOT",
    protocolRevisionId: "institution-profile-calibration",
    inputArtifactIds: [],
    outputArtifactIds: [`metadata:${recordCount}`, `permitted-pdfs:${pdfCount}`, `production-eligible:${productionEligible}`],
    cursor: `live-smoke:${completedAt}`,
    createdAt: completedAt
  });
  await appendJsonlRecord(layout.audit.stageReceipts, receipt);
  return { productionEligible, receipt };
}

export async function executeInstitutionalResearchCommand(command: InstitutionalResearchCommand, args: InstitutionalResearchCommandArgs): Promise<unknown> {
  if (command === "pilot") return pilot(args);
  if (command === "freeze") return freeze(args);
  if (command === "ingest-export") return ingestExport(args);
  if (command === "screen") return screen(args);
  if (command === "acquire") return acquire(args);
  if (command === "freeze-extraction") return freezeExtraction(args);
  if (command === "extract") return extract(args);
  if (command === "adjudicate-extraction") return adjudicateExtraction(args);
  if (command === "freeze-data") return freezeData(args);
  if (command === "report") return report(args);
  if (command === "package") return packageManuscript(args);
  if (command === "live-smoke") return liveSmoke(args);
  throw new Error(`Unknown institutional research command: ${command}`);
}
