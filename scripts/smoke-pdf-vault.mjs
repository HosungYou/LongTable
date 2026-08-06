import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(join(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));

function minimalPdf(text = "LongTable PDF Vault smoke") {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length + 35} >>\nstream\nBT /F1 12 Tf 20 80 Td (${text}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}

async function findPdfFiles(root) {
  const found = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) found.push(path);
    }
  }
  await visit(root);
  return found;
}

const tempRoot = await mkdtemp(join(tmpdir(), "longtable-pdf-vault-"));
const projectRoot = join(tempRoot, "project");
const vaultRoot = join(tempRoot, "research-pdf-vault");
const incomingRoot = join(tempRoot, "incoming");
await Promise.all([mkdir(projectRoot), mkdir(vaultRoot), mkdir(incomingRoot)]);

try {
  const candidatePath = join(incomingRoot, "paper.pdf");
  await writeFile(candidatePath, minimalPdf());
  const inspection = await research.inspectPdfCandidate(candidatePath);
  assert.equal(inspection.valid, true);
  assert.equal(inspection.sha256.length, 64);
  assert(inspection.byteLength > 300);

  const manifestPath = join(projectRoot, "corpus", "pdf-manifest.jsonl");
  const intakeInput = {
    projectRoot,
    vaultRoot,
    projectManifestPath: manifestPath,
    paperId: "paper-1",
    candidatePath,
    acquisitionMethod: "institutional_browser_download",
    accessBasis: "institutional_subscription",
    sourceUrl: "https://example.test/article/1",
    version: "version_of_record",
    projectInclusion: "potential_inclusion",
    screeningState: "fulltext_pending",
    acquiredAt: "2026-08-06T04:00:00.000Z"
  };
  const first = await research.intakeResearchPdf(intakeInput);
  assert.equal(first.created, true);
  assert.equal(first.manifest.paperId, "paper-1");
  assert.equal(first.manifest.sha256, inspection.sha256);
  assert.equal(first.manifest.accessBasis, "institutional_subscription");
  assert(!isAbsolute(first.manifest.canonicalVaultPath));
  assert(!first.manifest.canonicalVaultPath.startsWith(".."));
  assert.deepEqual(await readFile(join(vaultRoot, first.manifest.canonicalVaultPath)), await readFile(candidatePath));

  const second = await research.intakeResearchPdf(intakeInput);
  assert.equal(second.created, false);
  assert.equal(second.manifest.canonicalVaultPath, first.manifest.canonicalVaultPath);
  const manifestRecords = await research.readJsonlRecords(manifestPath);
  assert.equal(manifestRecords.length, 1);

  const verification = await research.verifyPdfManifest(manifestRecords, vaultRoot);
  assert.equal(verification.passed, true);
  assert.deepEqual(verification.issues, []);
  assert.deepEqual(await findPdfFiles(projectRoot), []);

  const escaped = await research.verifyPdfManifest([{ ...first.manifest, canonicalVaultPath: "../outside.pdf" }], vaultRoot);
  assert.equal(escaped.passed, false);
  assert.match(escaped.issues[0], /outside/i);

  await assert.rejects(
    research.intakeResearchPdf({ ...intakeInput, vaultRoot: join(projectRoot, "pdfs") }),
    /outside the research project/i
  );
  await assert.rejects(
    research.intakeResearchPdf({ ...intakeInput, sourceUrl: "https://example.test/article?access_token=secret" }),
    /authentication material/i
  );

  const placeholder = join(incomingRoot, "placeholder.pdf");
  const incomplete = join(incomingRoot, "incomplete.pdf");
  const corrupt = join(incomingRoot, "corrupt.pdf");
  await writeFile(placeholder, "");
  await writeFile(incomplete, "%PDF-1.4\n1 0 obj\n<< /Type /Page >>\n");
  await writeFile(corrupt, "%PDF-1.4\nxref\ntrailer\n%%EOF\n");
  assert.equal((await research.inspectPdfCandidate(placeholder)).reason, "placeholder_or_empty");
  assert.equal((await research.inspectPdfCandidate(incomplete)).reason, "incomplete_download");
  assert.equal((await research.inspectPdfCandidate(corrupt)).reason, "corrupt_pdf_structure");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log("Research PDF Vault tests passed");
