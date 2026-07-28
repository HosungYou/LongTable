import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { FullTextManifestRecord, ParsedPdfPage } from "./fulltext.js";
import type {
  CitationSlot,
  EvidenceSpan,
  ProviderProposedPatch,
  ProviderTaskPacket
} from "./workflow.js";

export interface ExtractionTaskPacket extends ProviderTaskPacket {
  packetId: string;
  sourceIds: string[];
  instructions: string[];
}

export interface PreparedExtractionTasks {
  schema: "longtable.prepared-extraction-tasks";
  version: 1;
  createdAt: string;
  runId: string;
  packets: Array<{
    packetId: string;
    path: string;
    sourceIds: string[];
    spanCount: number;
    characterCount: number;
  }>;
}

export interface PreparedSynthesisTask {
  packetId: string;
  path: string;
  filledSlotCount: number;
  provisionalOrConflictCount: number;
}

export interface SynthesisClaim {
  id: string;
  text: string;
  citationSlotIds: string[];
  role: "finding" | "qualification" | "conflict" | "limitation";
}

export interface SynthesisProposal {
  title: string;
  claims: SynthesisClaim[];
  readingOrder: string[];
}

export interface ProviderSynthesisVerification {
  schema: "longtable.provider-synthesis-verification";
  version: 1;
  runId: string;
  packetId: string;
  provider: string;
  independent: true;
  proposalPatchHash: string;
  decisions: Array<{
    claimId: string;
    decision: "agree" | "disagree" | "uncertain";
    rationale: string;
  }>;
}

export interface HumanSynthesisReview {
  schema: "longtable.human-synthesis-review";
  version: 1;
  runId: string;
  proposalPatchHash: string;
  reviewer: string;
  reviewedAt: string;
  decisions: Array<{
    claimId: string;
    decision: "accept" | "reject" | "preserve_disagreement";
    rationale: string;
  }>;
}

export interface AdjudicationRecord {
  schema: "longtable.adjudication-record";
  version: 1;
  id: string;
  runId: string;
  stage: "extract";
  inputBundleVersion: string;
  inputBundleHash: string;
  citationSlotId: string;
  proposer: {
    provider: string;
    decision: "supports" | "qualifies" | "contradicts" | "insufficient";
    evidenceSpanIds: string[];
  };
  verifier: {
    provider: string;
    independent: true;
    decision: "agree" | "disagree" | "uncertain";
    evidenceSpanIds: string[];
    rationale: string;
  };
  errorClass:
    | "none"
    | "claim_evidence_relation"
    | "insufficient_evidence"
    | "source_or_version"
    | "access_or_provenance";
  severity: "none" | "low" | "medium" | "high" | "critical";
  humanRequired: boolean;
  createdAt: string;
  replayFixtureRef: string;
  humanDecision?: {
    reviewer: string;
    adjudicatorRole: "domain_researcher";
    decision: "accept" | "revise" | "reject" | "preserve_disagreement";
    decidedAt: string;
    rationale: string;
  };
}

export interface ProviderVerification {
  schema: "longtable.provider-verification";
  version: 1;
  runId: string;
  packetId: string;
  provider: string;
  independent: true;
  proposalPatchHash: string;
  decisions: Array<{
    citationSlotId: string;
    decision: "agree" | "disagree" | "uncertain";
    evidenceSpanIds: string[];
    rationale: string;
  }>;
}

export interface HumanCitationReview {
  schema: "longtable.human-citation-review";
  version: 1;
  runId: string;
  reviewer: string;
  reviewedAt: string;
  decisions: Array<{
    citationSlotId: string;
    decision: "accept" | "reject" | "preserve_disagreement";
    rationale: string;
  }>;
}

interface ParsedFullTextFile {
  contentHash: string;
  sourceVersion: string;
  accessClass: string;
  pages: ParsedPdfPage[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function cleanText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitPage(page: ParsedPdfPage, record: FullTextManifestRecord, maxSpanCharacters: number): EvidenceSpan[] {
  const text = cleanText(page.text);
  if (!text) return [];
  const spans: EvidenceSpan[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + maxSpanCharacters);
    if (end < text.length) {
      const paragraph = text.lastIndexOf("\n\n", end);
      const sentence = text.lastIndexOf(". ", end);
      const boundary = Math.max(paragraph, sentence);
      if (boundary > start + Math.floor(maxSpanCharacters * 0.5)) end = boundary + (boundary === sentence ? 1 : 0);
    }
    const quote = text.slice(start, end).trim();
    if (quote) {
      spans.push({
        spanId: `span-${record.contentHash.replace(/^sha256:/, "").slice(0, 12)}-p${page.page}-${start}-${end}`,
        sourceId: record.sourceId,
        quote,
        locator: `${page.locator};chars:${start}-${end};extraction:${page.extraction}`,
        contentHash: record.contentHash,
        sourceVersion: record.sourceVersion,
        accessClass: record.accessClass
      });
    }
    start = Math.max(end, start + 1);
  }
  return spans;
}

export async function prepareExtractionTaskPackets(input: {
  runId: string;
  runDir: string;
  query: string;
  records: FullTextManifestRecord[];
  maxSpanCharacters?: number;
  maxPacketCharacters?: number;
}): Promise<PreparedExtractionTasks> {
  const maxSpanCharacters = Math.max(500, Math.min(8_000, input.maxSpanCharacters ?? 3_500));
  const maxPacketCharacters = Math.max(maxSpanCharacters, Math.min(50_000, input.maxPacketCharacters ?? 20_000));
  const allSpans: EvidenceSpan[] = [];
  for (const record of [...input.records].sort((a, b) => a.sourceId.localeCompare(b.sourceId))) {
    const parsed = JSON.parse(await readFile(record.derivedTextPath, "utf8")) as ParsedFullTextFile;
    if (parsed.contentHash !== record.contentHash || parsed.sourceVersion !== record.sourceVersion ||
        parsed.accessClass !== record.accessClass) {
      throw new Error(`Parsed full text provenance mismatch for ${basename(record.derivedTextPath)}.`);
    }
    for (const page of parsed.pages.sort((a, b) => a.page - b.page)) {
      allSpans.push(...splitPage(page, record, maxSpanCharacters));
    }
  }
  if (allSpans.length === 0) throw new Error("No non-empty full-text evidence spans were available for extraction.");

  const outputDirectory = join(input.runDir, "provider-tasks", "extract");
  await mkdir(outputDirectory, { recursive: true });
  const packetMetadata: PreparedExtractionTasks["packets"] = [];
  let packetSpans: EvidenceSpan[] = [];
  let packetCharacters = 0;

  async function flush(): Promise<void> {
    if (packetSpans.length === 0) return;
    const packetNumber = packetMetadata.length + 1;
    const packetId = `extract-${String(packetNumber).padStart(4, "0")}-${sha256(JSON.stringify(packetSpans)).slice(0, 12)}`;
    const packet: ExtractionTaskPacket = {
      schema: "longtable.provider-task-packet",
      version: 1,
      packetId,
      runId: input.runId,
      stage: "extract",
      objective: `Propose claim-evidence relations relevant to: ${input.query}`,
      boundedEvidence: packetSpans,
      allowedPatchPaths: ["/citationSlots"],
      maxOutputCharacters: 20_000,
      sourceIds: [...new Set(packetSpans.map((span) => span.sourceId))],
      instructions: [
        "Return only a longtable.provider-proposed-patch JSON object.",
        "Create provisional citation slots only; never mark a provider-proposed slot filled.",
        "Quote only supplied evidence spans and preserve their exact locator, content hash, source version, and access class.",
        "Use supports, qualifies, or contradicts; preserve conflicting evidence instead of collapsing it.",
        "Do not infer full-text support beyond the supplied spans."
      ]
    };
    const path = join(outputDirectory, `${packetId}.json`);
    await writeFile(path, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
    packetMetadata.push({
      packetId,
      path,
      sourceIds: packet.sourceIds,
      spanCount: packetSpans.length,
      characterCount: packetCharacters
    });
    packetSpans = [];
    packetCharacters = 0;
  }

  for (const span of allSpans) {
    if (packetSpans.length > 0 && packetCharacters + span.quote.length > maxPacketCharacters) await flush();
    packetSpans.push(span);
    packetCharacters += span.quote.length;
  }
  await flush();
  const manifest: PreparedExtractionTasks = {
    schema: "longtable.prepared-extraction-tasks",
    version: 1,
    createdAt: new Date().toISOString(),
    runId: input.runId,
    packets: packetMetadata
  };
  await writeFile(join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export function adjudicationNeedsHuman(record: AdjudicationRecord): boolean {
  return record.verifier.decision !== "agree" || record.humanRequired;
}

function collectSlotLike(value: unknown): CitationSlot[] {
  if (Array.isArray(value)) return value.flatMap(collectSlotLike);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (typeof record.id === "string" && typeof record.claim === "string" && "evidence" in record) {
    return [record as unknown as CitationSlot];
  }
  return Object.values(record).flatMap(collectSlotLike);
}

export function citationSlotsFromProviderPatch(patch: ProviderProposedPatch): CitationSlot[] {
  const slots = patch.operations.flatMap((operation) => collectSlotLike(operation.value));
  const ids = new Set<string>();
  for (const slot of slots) {
    if (ids.has(slot.id)) throw new Error(`Duplicate citation slot id in provider patch: ${slot.id}`);
    ids.add(slot.id);
  }
  return slots;
}

export function synthesisProposalFromProviderPatch(patch: ProviderProposedPatch): SynthesisProposal {
  const synthesisOperations = patch.operations.filter(
    (operation) => operation.path === "/synthesis"
  );
  if (synthesisOperations.length !== 1) {
    throw new Error("A synthesis patch must contain exactly one /synthesis operation.");
  }
  return synthesisOperations[0].value as SynthesisProposal;
}

export async function prepareSynthesisTaskPacket(input: {
  runId: string;
  runDir: string;
  query: string;
  citationSlots: CitationSlot[];
}): Promise<PreparedSynthesisTask> {
  const boundedEvidence = input.citationSlots
    .filter((slot) => Boolean(slot.evidence))
    .map((slot) => slot.evidence!);
  if (boundedEvidence.length === 0) {
    throw new Error("Synthesis requires at least one human-reviewed citation slot with evidence.");
  }
  const packetId = `synthesize-${sha256(JSON.stringify(input.citationSlots)).slice(0, 16)}`;
  const packet: ExtractionTaskPacket = {
    schema: "longtable.provider-task-packet",
    version: 1,
    packetId,
    runId: input.runId,
    stage: "synthesize",
    objective: `Propose a bounded synthesis for: ${input.query}`,
    boundedEvidence,
    allowedPatchPaths: ["/synthesis"],
    maxOutputCharacters: 30_000,
    sourceIds: [...new Set(boundedEvidence.map((span) => span.sourceId))],
    instructions: [
      "Return only a longtable.provider-proposed-patch JSON object.",
      "Set /synthesis to {title, claims, readingOrder}; do not return free-standing narrative.",
      "Every claim must contain id, text, role, and citationSlotIds supplied in citationSlots.",
      "Treat provisional, rejected, and preserved-disagreement slots as limits, not supporting facts.",
      "Preserve contradicting evidence and legitimate disagreement.",
      "Do not introduce claims, sources, locators, or numbers absent from the packet."
    ]
  };
  const outputDirectory = join(input.runDir, "provider-tasks", "synthesize");
  await mkdir(outputDirectory, { recursive: true });
  const path = join(outputDirectory, `${packetId}.json`);
  await writeFile(path, `${JSON.stringify({
    ...packet,
    citationSlots: input.citationSlots
  }, null, 2)}\n`, "utf8");
  return {
    packetId,
    path,
    filledSlotCount: input.citationSlots.filter((slot) => slot.status === "filled").length,
    provisionalOrConflictCount: input.citationSlots.filter((slot) => slot.status !== "filled").length
  };
}
