import { randomUUID } from "node:crypto";
import {
  appendFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  writeFile
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createProtocolRevision, type ProtocolRevision } from "./workflow-types.js";

export interface ResearchProjectLayout {
  readonly root: string;
  readonly protocol: {
    readonly root: string;
    readonly researchQuestion: string;
    readonly searchProtocol: string;
    readonly inclusionExclusion: string;
    readonly databaseProfiles: string;
    readonly extractionProfiles: string;
    readonly amendments: string;
  };
  readonly data: {
    readonly root: string;
    readonly rawExports: string;
    readonly normalized: string;
    readonly deduplicated: string;
    readonly titleAbstractScreening: string;
    readonly fulltextScreening: string;
    readonly extractionPilot: string;
    readonly extracted: string;
    readonly adjudicated: string;
    readonly analysisReady: string;
  };
  readonly corpus: {
    readonly root: string;
    readonly papers: string;
    readonly acquisitionLedger: string;
    readonly pdfManifest: string;
    readonly screeningDecisions: string;
    readonly extractionRecords: string;
    readonly extractionConflicts: string;
    readonly extractionAdjudications: string;
    readonly manualActionQueue: string;
  };
  readonly audit: {
    readonly root: string;
    readonly stageReceipts: string;
    readonly checkpoints: string;
    readonly decisions: string;
    readonly exclusions: string;
    readonly deviations: string;
    readonly failures: string;
    readonly extractedDataFreezes: string;
  };
  readonly reports: string;
  readonly manuscript: string;
  readonly analysis: string;
  readonly references: string;
  readonly researchRuns: string;
}

const JSONL_FILES = [
  "papers",
  "acquisitionLedger",
  "pdfManifest",
  "screeningDecisions",
  "extractionRecords",
  "extractionConflicts",
  "extractionAdjudications"
] as const;

const AUDIT_JSONL_FILES = [
  "stageReceipts",
  "checkpoints",
  "decisions",
  "exclusions",
  "deviations",
  "failures",
  "extractedDataFreezes"
] as const;

export function buildResearchProjectLayout(projectRoot: string): ResearchProjectLayout {
  const root = resolve(projectRoot);
  const protocolRoot = join(root, "protocol");
  const dataRoot = join(root, "data");
  const corpusRoot = join(root, "corpus");
  const auditRoot = join(root, "audit");
  return {
    root,
    protocol: {
      root: protocolRoot,
      researchQuestion: join(protocolRoot, "research-question.yaml"),
      searchProtocol: join(protocolRoot, "search-protocol.yaml"),
      inclusionExclusion: join(protocolRoot, "inclusion-exclusion.yaml"),
      databaseProfiles: join(protocolRoot, "database-profiles"),
      extractionProfiles: join(protocolRoot, "extraction-profiles"),
      amendments: join(protocolRoot, "amendments")
    },
    data: {
      root: dataRoot,
      rawExports: join(dataRoot, "00_raw-exports"),
      normalized: join(dataRoot, "01_normalized"),
      deduplicated: join(dataRoot, "02_deduplicated"),
      titleAbstractScreening: join(dataRoot, "03_title-abstract-screening"),
      fulltextScreening: join(dataRoot, "04_fulltext-screening"),
      extractionPilot: join(dataRoot, "05_extraction-pilot"),
      extracted: join(dataRoot, "06_extracted"),
      adjudicated: join(dataRoot, "07_adjudicated"),
      analysisReady: join(dataRoot, "08_analysis-ready")
    },
    corpus: {
      root: corpusRoot,
      papers: join(corpusRoot, "papers.jsonl"),
      acquisitionLedger: join(corpusRoot, "acquisition-ledger.jsonl"),
      pdfManifest: join(corpusRoot, "pdf-manifest.jsonl"),
      screeningDecisions: join(corpusRoot, "screening-decisions.jsonl"),
      extractionRecords: join(corpusRoot, "extraction-records.jsonl"),
      extractionConflicts: join(corpusRoot, "extraction-conflicts.jsonl"),
      extractionAdjudications: join(corpusRoot, "extraction-adjudications.jsonl"),
      manualActionQueue: join(corpusRoot, "manual-action-queue.csv")
    },
    audit: {
      root: auditRoot,
      stageReceipts: join(auditRoot, "stage-receipts.jsonl"),
      checkpoints: join(auditRoot, "checkpoints.jsonl"),
      decisions: join(auditRoot, "decisions.jsonl"),
      exclusions: join(auditRoot, "exclusions.jsonl"),
      deviations: join(auditRoot, "deviations.jsonl"),
      failures: join(auditRoot, "failures.jsonl"),
      extractedDataFreezes: join(auditRoot, "extracted-data-freezes.jsonl")
    },
    reports: join(root, "reports"),
    manuscript: join(root, "manuscript"),
    analysis: join(root, "analysis"),
    references: join(root, "references"),
    researchRuns: join(root, ".longtable", "research-runs")
  };
}

async function ensureFile(path: string, initialContent = ""): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "a");
  try {
    const metadata = await handle.stat();
    if (metadata.size === 0 && initialContent) {
      await handle.writeFile(initialContent, "utf8");
    }
  } finally {
    await handle.close();
  }
}

export async function writeResearchProjectScaffold(projectRoot: string): Promise<ResearchProjectLayout> {
  const layout = buildResearchProjectLayout(projectRoot);
  const directories = [
    layout.protocol.root,
    layout.protocol.databaseProfiles,
    layout.protocol.extractionProfiles,
    layout.protocol.amendments,
    layout.data.rawExports,
    layout.data.normalized,
    layout.data.deduplicated,
    layout.data.titleAbstractScreening,
    layout.data.fulltextScreening,
    layout.data.extractionPilot,
    layout.data.extracted,
    layout.data.adjudicated,
    layout.data.analysisReady,
    layout.corpus.root,
    layout.audit.root,
    layout.reports,
    layout.manuscript,
    layout.analysis,
    layout.references,
    layout.researchRuns
  ];
  await Promise.all(directories.map((directory) => mkdir(directory, { recursive: true })));
  await Promise.all([
    ensureFile(layout.protocol.researchQuestion, "{}\n"),
    ensureFile(layout.protocol.searchProtocol, "{}\n"),
    ensureFile(layout.protocol.inclusionExclusion, "{}\n"),
    ...JSONL_FILES.map((key) => ensureFile(layout.corpus[key])),
    ...AUDIT_JSONL_FILES.map((key) => ensureFile(layout.audit[key])),
    ensureFile(layout.corpus.manualActionQueue, "paperId,action,reason,status\n")
  ]);
  return layout;
}

export async function appendJsonlRecord(path: string, record: Readonly<object>): Promise<void> {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("A JSONL record must be an object.");
  }
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
}

export async function readJsonlRecords<T extends Record<string, unknown> = Record<string, unknown>>(
  path: string
): Promise<T[]> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch (error) {
        throw new Error(`Invalid JSONL at ${path}:${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
  await rename(temporaryPath, path);
}

function revisionFilename(revision: number): string {
  return `protocol-revision-${String(revision).padStart(4, "0")}.json`;
}

async function existingRevision(path: string): Promise<ProtocolRevision | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as ProtocolRevision;
    return createProtocolRevision(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function writeFrozenProtocolRevision(
  layout: ResearchProjectLayout,
  revision: ProtocolRevision
): Promise<string> {
  const path = join(layout.protocol.amendments, revisionFilename(revision.revision));
  const existing = await existingRevision(path);
  if (existing) {
    if (existing.protocolHash !== revision.protocolHash) {
      throw new Error(`Protocol revision ${revision.revision} is immutable and already contains a different protocol hash.`);
    }
    return path;
  }

  const serialized = `${JSON.stringify(revision, null, 2)}\n`;
  await atomicWrite(path, serialized);
  await atomicWrite(layout.protocol.searchProtocol, serialized);
  return path;
}

export async function readLatestProtocolRevision(
  layout: ResearchProjectLayout
): Promise<ProtocolRevision> {
  const entries = (await readdir(layout.protocol.amendments))
    .filter((entry) => /^protocol-revision-\d{4}\.json$/.test(entry))
    .sort();
  const latest = entries.at(-1);
  if (!latest) {
    throw new Error("No frozen ProtocolRevision exists in this research project.");
  }
  const revision = await existingRevision(join(layout.protocol.amendments, latest));
  if (!revision) {
    throw new Error(`Frozen ProtocolRevision disappeared while reading ${latest}.`);
  }
  return revision;
}
