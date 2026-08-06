import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { appendJsonlRecord, readJsonlRecords } from "./project-store.js";

export type PdfInspectionFailureReason =
  | "placeholder_or_empty"
  | "not_a_pdf"
  | "incomplete_download"
  | "corrupt_pdf_structure"
  | "symbolic_link_not_allowed";

export type PdfInspection =
  | { readonly valid: true; readonly path: string; readonly sha256: string; readonly byteLength: number }
  | { readonly valid: false; readonly path: string; readonly reason: PdfInspectionFailureReason; readonly byteLength: number };

export type PdfAccessBasis =
  | "open_access"
  | "institutional_subscription"
  | "author_copy"
  | "repository"
  | "researcher_provided"
  | "public_domain";

export type PdfAcquisitionMethod =
  | "official_api"
  | "tdm"
  | "institutional_browser_download"
  | "open_repository_download"
  | "researcher_manual_upload";

export interface PdfManifestRecord {
  readonly paperId: string;
  readonly sha256: string;
  readonly canonicalLocalPath: string;
  readonly acquisitionMethod: PdfAcquisitionMethod;
  readonly accessBasis: PdfAccessBasis;
  readonly sourceUrl?: string;
  readonly version: string;
  readonly projectInclusion: string;
  readonly screeningState: string;
  readonly acquiredAt: string;
}

export interface IntakeResearchPdfInput {
  readonly projectRoot: string;
  readonly vaultRoot: string;
  readonly projectManifestPath: string;
  readonly paperId: string;
  readonly candidatePath: string;
  readonly acquisitionMethod: PdfAcquisitionMethod;
  readonly accessBasis: PdfAccessBasis;
  readonly sourceUrl?: string;
  readonly version: string;
  readonly projectInclusion: string;
  readonly screeningState: string;
  readonly acquiredAt?: string;
}

export interface PdfIntakeResult {
  readonly created: boolean;
  readonly manifestAppended: boolean;
  readonly manifest: PdfManifestRecord;
}

export interface PdfManifestVerification {
  readonly passed: boolean;
  readonly issues: readonly string[];
}

const SENSITIVE_URL_PARAMETER = /(?:access[_-]?token|refresh[_-]?token|session|cookie|auth|authorization|password|passphrase|credential|api[_-]?key|signature|x-amz-signature|mfa)/i;

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function isInside(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function requireText(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`${label} is required for Research PDF Vault intake.`);
  return value.trim();
}

function assertSafeSourceUrl(value?: string): void {
  if (!value) return;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("PDF source URL is invalid.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("PDF source URL contains forbidden authentication material.");
  }
  for (const key of parsed.searchParams.keys()) {
    if (SENSITIVE_URL_PARAMETER.test(key)) {
      throw new Error("PDF source URL contains forbidden authentication material.");
    }
  }
}

export async function inspectPdfCandidate(path: string): Promise<PdfInspection> {
  const resolvedPath = resolve(path);
  const metadata = await lstat(resolvedPath);
  if (metadata.isSymbolicLink()) {
    return { valid: false, path: resolvedPath, reason: "symbolic_link_not_allowed", byteLength: metadata.size };
  }
  if (!metadata.isFile() || metadata.size === 0) {
    return { valid: false, path: resolvedPath, reason: "placeholder_or_empty", byteLength: metadata.size };
  }
  const buffer = await readFile(resolvedPath);
  const text = buffer.toString("latin1");
  if (!text.startsWith("%PDF-")) {
    return { valid: false, path: resolvedPath, reason: "not_a_pdf", byteLength: buffer.length };
  }
  if (!/%%EOF\s*$/.test(text)) {
    return { valid: false, path: resolvedPath, reason: "incomplete_download", byteLength: buffer.length };
  }
  if (!/\/Type\s*\/Page\b/.test(text) || !/\bxref\b/.test(text) || !/\btrailer\b/.test(text) || !/\bstartxref\b/.test(text)) {
    return { valid: false, path: resolvedPath, reason: "corrupt_pdf_structure", byteLength: buffer.length };
  }
  return { valid: true, path: resolvedPath, sha256: sha256(buffer), byteLength: buffer.length };
}

export function buildPdfManifestRecord(
  input: IntakeResearchPdfInput,
  inspection: Extract<PdfInspection, { valid: true }>,
  canonicalLocalPath: string
): PdfManifestRecord {
  assertSafeSourceUrl(input.sourceUrl);
  return {
    paperId: requireText(input.paperId, "Paper ID"),
    sha256: inspection.sha256,
    canonicalLocalPath: resolve(canonicalLocalPath),
    acquisitionMethod: input.acquisitionMethod,
    accessBasis: input.accessBasis,
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    version: requireText(input.version, "PDF version"),
    projectInclusion: requireText(input.projectInclusion, "Project inclusion state"),
    screeningState: requireText(input.screeningState, "Screening state"),
    acquiredAt: input.acquiredAt ?? new Date().toISOString()
  };
}

function canonicalPdfPath(vaultRoot: string, hash: string): string {
  return join(resolve(vaultRoot), hash.slice(0, 2), `${hash}.pdf`);
}

async function ensureCanonicalPdf(
  candidatePath: string,
  canonicalPath: string,
  expectedSha256: string
): Promise<boolean> {
  await mkdir(dirname(canonicalPath), { recursive: true });
  try {
    await copyFile(candidatePath, canonicalPath, constants.COPYFILE_EXCL);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = await inspectPdfCandidate(canonicalPath);
    if (!existing.valid || existing.sha256 !== expectedSha256) {
      throw new Error(`Research PDF Vault collision or corrupt canonical file at ${canonicalPath}.`);
    }
    return false;
  }
}

export async function intakeResearchPdf(input: IntakeResearchPdfInput): Promise<PdfIntakeResult> {
  const projectRoot = resolve(input.projectRoot);
  const vaultRoot = resolve(input.vaultRoot);
  const candidatePath = resolve(input.candidatePath);
  const manifestPath = resolve(input.projectManifestPath);
  if (isInside(projectRoot, vaultRoot)) {
    throw new Error("Research PDF Vault must be outside the research project.");
  }
  if (isInside(projectRoot, candidatePath)) {
    throw new Error("PDF candidate bytes must not be staged inside the research project.");
  }
  if (!isInside(projectRoot, manifestPath)) {
    throw new Error("The PDF manifest must remain inside the research project.");
  }
  assertSafeSourceUrl(input.sourceUrl);
  const inspection = await inspectPdfCandidate(candidatePath);
  if (!inspection.valid) {
    throw new Error(`PDF intake rejected: ${inspection.reason}.`);
  }
  const canonicalPath = canonicalPdfPath(vaultRoot, inspection.sha256);
  if (!isInside(vaultRoot, canonicalPath)) {
    throw new Error("Canonical PDF path escaped the configured Research PDF Vault.");
  }
  const created = await ensureCanonicalPdf(candidatePath, canonicalPath, inspection.sha256);
  const manifest = buildPdfManifestRecord(input, inspection, canonicalPath);
  const existingRecords = await readJsonlRecords(manifestPath) as unknown as PdfManifestRecord[];
  const alreadyRecorded = existingRecords.some((record) =>
    record.paperId === manifest.paperId &&
    record.sha256 === manifest.sha256 &&
    record.version === manifest.version
  );
  if (!alreadyRecorded) {
    await appendJsonlRecord(manifestPath, manifest);
  }
  return { created, manifestAppended: !alreadyRecorded, manifest };
}

export async function verifyPdfManifest(
  records: readonly PdfManifestRecord[],
  vaultRoot: string
): Promise<PdfManifestVerification> {
  const resolvedVaultRoot = resolve(vaultRoot);
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const key = `${record.paperId}:${record.sha256}:${record.version}`;
    if (seen.has(key)) {
      issues.push(`Duplicate PDF manifest record: ${key}.`);
      continue;
    }
    seen.add(key);
    if (!isAbsolute(record.canonicalLocalPath) || !isInside(resolvedVaultRoot, record.canonicalLocalPath)) {
      issues.push(`PDF path is outside the configured Research PDF Vault: ${record.paperId}.`);
      continue;
    }
    if (basename(record.canonicalLocalPath) !== `${record.sha256}.pdf`) {
      issues.push(`PDF filename does not match its SHA-256: ${record.paperId}.`);
      continue;
    }
    try {
      const inspection = await inspectPdfCandidate(record.canonicalLocalPath);
      if (!inspection.valid) {
        issues.push(`Canonical PDF is invalid (${inspection.reason}): ${record.paperId}.`);
      } else if (inspection.sha256 !== record.sha256) {
        issues.push(`Canonical PDF SHA-256 mismatch: ${record.paperId}.`);
      }
    } catch (error) {
      issues.push(`Canonical PDF is unavailable for ${record.paperId}: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }
  return { passed: issues.length === 0, issues };
}
