import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(resolve(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));
const fixtureRoot = join(repoRoot, "packages", "longtable-scholar-research", "fixtures", "render-profiles");

const papers = [
  {
    paperId: "paper-a",
    title: "Hackathons and workplace competency development",
    normalizedTitle: "hackathons and workplace competency development",
    authors: ["Kim, Mina", "You, Hosung"],
    year: 2025,
    doi: "10.1000/example-a",
    venue: "Journal of Workplace Learning",
    keywords: ["hackathon", "workplace competency"],
    sourceLinks: [{ sourceDatabase: "web-of-science", sourceRecordId: "WOS:A", sourceRow: 2, exportArtifactSha256: "a".repeat(64) }],
    provenanceBasis: ["web-of-science:WOS:A"]
  },
  {
    paperId: "paper-b",
    title: "직무역량 강화를 위한 집중형 문제해결 프로그램",
    normalizedTitle: "직무역량 강화를 위한 집중형 문제해결 프로그램",
    authors: ["박지수"],
    year: 2024,
    venue: "직업교육연구",
    keywords: ["직무역량"],
    sourceLinks: [{ sourceDatabase: "riss", sourceRecordId: "RISS:B", sourceRow: 3, exportArtifactSha256: "b".repeat(64) }],
    provenanceBasis: ["riss:RISS:B"]
  }
];

const refsA = research.renderReferenceFormats(papers);
const refsB = research.renderReferenceFormats([...papers].reverse());
assert.deepEqual(refsA, refsB);
assert.equal(refsA.cslJson.length, 2);
assert.match(refsA.ris, /TY  - JOUR/);
assert.match(refsA.bibtex, /@article\{/);
assert.match(refsA.apa7References.join("\n"), /https:\/\/doi.org\/10.1000\/example-a/);
assert(refsA.unresolvedCitations.some((entry) => entry.paperId === "paper-b" && entry.missingFields.includes("doi")));
assert.match(refsA.unresolvedCitationReportMarkdown, /paper-b: doi/);

const apaProfile = research.validateRenderProfile(JSON.parse(await readFile(join(fixtureRoot, "apa7.json"), "utf8")));
assert.equal(apaProfile.id, "apa7-memory");
assert.equal(apaProfile.body.lineSpacing, 2);
const koreanProfile = research.validateRenderProfile(JSON.parse(await readFile(join(fixtureRoot, "korean-journal.json"), "utf8")));
assert.equal(koreanProfile.status, "provisional_until_journal_rules_verified");
assert.throws(() => research.validateRenderProfile({ ...apaProfile, page: { ...apaProfile.page, marginInches: 0 } }), /margin/i);
const userTemplateProfile = research.validateRenderProfile({ ...apaProfile, id: "user-template", templatePath: "/tmp/template.docx", templateSha256: "d".repeat(64) });
assert.equal(userTemplateProfile.templateSha256, "d".repeat(64));
assert.throws(() => research.validateRenderProfile({ ...apaProfile, id: "invalid-template", templatePath: "/tmp/template.docx" }), /SHA-256/i);

const counts = {
  identified: 2, normalized: 2, parseRejected: 0, unique: 2, duplicateLinks: 0,
  titleAbstractScreened: 2, fulltextCandidates: 2, titleAbstractExcluded: 0, titleAbstractPending: 0,
  fulltextSought: 2, fulltextRetrieved: 2, fulltextNotRetrieved: 0,
  fulltextAssessed: 2, finalIncluded: 2, fulltextExcluded: 0, unresolved: 0
};
const manuscript = research.buildApprovedManuscript({
  title: "해커톤형 집중 프로그램과 직무역량 수요-공급 불일치: 체계적 문서분석 프로토콜",
  authorLines: ["유호성", "소속 미정"],
  language: "ko",
  keywords: ["해커톤", "직무역량", "수요-공급 불일치", "문서분석"],
  protocol: {
    id: "protocol-1", revision: 1, frozenAt: "2026-08-06T06:10:00.000Z", decisionRecordId: "decision-protocol-1",
    databases: ["web-of-science", "riss"],
    queries: { "web-of-science": "TS=(hackathon AND competency)", riss: "해커톤 AND 직무역량" },
    filters: { years: [2015, 2026], languages: ["English", "Korean"], publicationTypes: ["Article"] },
    protocolHash: "c".repeat(64)
  },
  counts,
  papers,
  inputArtifactIds: ["corpus-frozen-1", "screening-ledger-1"],
  generatedAt: "2026-08-06T08:00:00.000Z",
  generatorVersion: "0.1.72",
  approvals: { databasesExecuted: true, fulltextAvailabilityVerified: true, analysisApproved: true },
  analysisPlan: "structured_document_analysis",
  abstract: "본 연구는 해커톤형 집중 프로그램을 직무역량 수요와 교육 공급의 불일치 관점에서 분석하기 위한 재현 가능한 체계적 문서분석 절차를 제안한다."
});
assert.match(manuscript.sections.find((entry) => entry.id === "methods").content, /검색하였다/);
assert.match(manuscript.sections.find((entry) => entry.id === "results").content, /2편/);
assert.match(manuscript.metaAnalysisReadinessMarkdown, /효과크기 산출 가능성/);
assert(manuscript.provenanceMap.every((entry) => entry.inputArtifactIds.length > 0));
for (const objectId of [
  "title", "author-line-1", "author-line-2", "abstract-heading", "abstract-body", "keywords",
  "introduction-heading", "introduction-body", "methods-heading", "methods-body", "results-heading", "results-body",
  "discussion-heading", "discussion-body", "meta-analysis-readiness", "references-heading", "reference-1", "reference-2"
]) {
  assert(manuscript.provenanceMap.some((entry) => entry.objectId === objectId), `missing provenance for ${objectId}`);
}
assert.throws(() => research.buildApprovedManuscript({
  title: "Blocked", authorLines: [], language: "en", keywords: [], protocol: manuscript.protocol,
  counts, papers, inputArtifactIds: ["corpus-frozen-1"], generatedAt: "2026-08-06T08:00:00.000Z", generatorVersion: "0.1.72",
  approvals: { databasesExecuted: false, fulltextAvailabilityVerified: true, analysisApproved: true }, analysisPlan: "meta_analysis"
}), /unexecuted database/i);

const retainedOutputDir = process.env.LONGTABLE_MANUSCRIPT_OUTPUT_DIR;
const temp = retainedOutputDir ? resolve(retainedOutputDir) : await mkdtemp(join(tmpdir(), "longtable-manuscript-"));
if (retainedOutputDir) await mkdir(temp, { recursive: true });
try {
  const outputPath = join(temp, "manuscript.docx");
  const rendered = research.renderWordManuscript({ manuscript, profile: apaProfile, outputPath });
  assert.equal(rendered.outputPath, outputPath);
  const zip = spawnSync("unzip", ["-t", outputPath], { encoding: "utf8" });
  assert.equal(zip.status, 0, zip.stderr || zip.stdout);
  const documentXml = spawnSync("unzip", ["-p", outputPath, "word/document.xml"], { encoding: "utf8" });
  assert.equal(documentXml.status, 0);
  assert.match(documentXml.stdout, /해커톤형 집중 프로그램/);
  assert.match(documentXml.stdout, /w:hanging="720"/);
  const stylesXml = spawnSync("unzip", ["-p", outputPath, "word/styles.xml"], { encoding: "utf8" });
  assert.equal(stylesXml.status, 0);
  assert.match(stylesXml.stdout, /w:line="480"/);
  const renderedAgain = research.renderWordManuscript({ manuscript, profile: apaProfile, outputPath: join(temp, "manuscript-2.docx") });
  assert.equal(rendered.contentSha256, renderedAgain.contentSha256);
} finally {
  if (!retainedOutputDir) await rm(temp, { recursive: true, force: true });
}

console.log("manuscript package tests passed");
