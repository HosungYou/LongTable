import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const research = await import(resolve(repoRoot, "packages", "longtable-scholar-research", "dist", "index.js"));
const temp = await mkdtemp(join(tmpdir(), "longtable-institutional-e2e-"));
const projectRoot = join(temp, "project");
const vaultRoot = join(temp, "pdf-vault");
const stagingRoot = join(temp, "staging");

try {
  assert.deepEqual(research.INSTITUTIONAL_RESEARCH_COMMANDS, ["pilot", "freeze", "ingest-export", "screen", "acquire", "report", "package", "live-smoke"]);
  const pilot = await research.executeInstitutionalResearchCommand("pilot", {
    cwd: projectRoot,
    runId: "run-e2e",
    protocolReference: "draft-1",
    createdAt: "2026-08-06T09:00:00.000Z"
  });
  assert.equal(pilot.run.stage, "SETUP");
  assert.equal(pilot.checkpoint.prompt.preferredSurfaces[0], "mcp_elicitation");
  const fallback = research.deliverCheckpointWithFallback(pilot.checkpoint, {
    status: "declined",
    message: "Researcher cancelled MCP elicitation without making a decision.",
    attemptedAt: "2026-08-06T09:01:00.000Z",
    fallbackAt: "2026-08-06T09:01:01.000Z"
  });
  assert.deepEqual(fallback.delivery.attempts.map((entry) => [entry.surface, entry.status]), [
    ["mcp_elicitation", "declined"], ["numbered", "fallback_rendered"]
  ]);
  assert.equal(fallback.question.status, "pending");

  const protocolFile = join(temp, "protocol-1.json");
  await writeFile(protocolFile, JSON.stringify({
    id: "protocol-1", revision: 1, frozenAt: "2026-08-06T09:05:00.000Z", decisionRecordId: "decision-protocol-1",
    databases: ["web-of-science"], queries: { "web-of-science": "TS=(hackathon AND workplace competency)" },
    filters: { years: [2015, 2026], languages: ["English", "Korean"], publicationTypes: ["Article"] }
  }));
  const frozen = await research.executeInstitutionalResearchCommand("freeze", { cwd: projectRoot, protocolFile });
  assert.equal(frozen.protocol.revision, 1);
  const amendmentFile = join(temp, "protocol-2.json");
  await writeFile(amendmentFile, JSON.stringify({
    ...frozen.protocol, revision: 2, frozenAt: "2026-08-06T09:10:00.000Z", decisionRecordId: "decision-protocol-2",
    filters: { ...frozen.protocol.filters, publicationTypes: ["Article", "Conference Paper"] }, protocolHash: undefined
  }));
  const amendment = await research.executeInstitutionalResearchCommand("freeze", { cwd: projectRoot, protocolFile: amendmentFile });
  assert.equal(amendment.protocol.revision, 2);
  assert.notEqual(amendment.protocol.protocolHash, frozen.protocol.protocolHash);

  const csvPath = join(temp, "wos.csv");
  await writeFile(csvPath, [
    "Title,Authors,Publication Year,Abstract,DOI,Source Title,Accession Number,Author Keywords",
    '"Hackathons and workplace competency development","Kim, Mina;You, Hosung",2025,"A detailed abstract describing an intensive challenge protocol and its workplace competency outcomes in professional learning.",10.1000/example-a,"Journal of Workplace Learning",WOS:A,"hackathon;competency"',
    '"직무역량 강화를 위한 집중형 문제해결 프로그램","박지수",2024,"직무역량 수요와 교육 프로그램 공급의 불일치를 문서자료로 분석하고 집중형 문제해결 활동의 교육적 구성을 검토하였다.",,"직업교육연구",WOS:B,"직무역량;문서분석"'
  ].join("\n"));
  const ingested = await research.executeInstitutionalResearchCommand("ingest-export", {
    cwd: projectRoot, file: csvPath, database: "web-of-science", format: "csv"
  });
  const ingestedAgain = await research.executeInstitutionalResearchCommand("ingest-export", {
    cwd: projectRoot, file: csvPath, database: "web-of-science", format: "csv"
  });
  assert.equal(ingested.corpus.papers.length, 2);
  assert.equal(ingestedAgain.rawArtifactCreated, false);
  assert.deepEqual(ingested.corpus, ingestedAgain.corpus);

  const decisionsPath = join(temp, "screening.json");
  await writeFile(decisionsPath, JSON.stringify(ingested.corpus.papers.flatMap((paper, index) => [
    {
      paperId: paper.paperId, stage: "title_abstract", decision: "include", rationale: "Matches the frozen protocol.",
      ruleVersion: "rules-v1", codebookVersion: "codebook-v1", actor: "human", actorId: "reviewer-hy",
      evidenceArtifactIds: [paper.sourceLinks[0].exportArtifactSha256], decidedAt: `2026-08-06T09:2${index}:00.000Z`
    },
    {
      paperId: paper.paperId, stage: "fulltext", decision: "include", rationale: "Verified against the permitted full text.",
      ruleVersion: "rules-v1", codebookVersion: "codebook-v1", actor: "human", actorId: "reviewer-hy",
      evidenceArtifactIds: [`fulltext-${paper.paperId}`], decidedAt: `2026-08-06T09:3${index}:00.000Z`
    }
  ])));
  const screened = await research.executeInstitutionalResearchCommand("screen", { cwd: projectRoot, decisionsFile: decisionsPath });
  assert.equal(screened.appended, 4);
  const screenedAgain = await research.executeInstitutionalResearchCommand("screen", { cwd: projectRoot, decisionsFile: decisionsPath });
  assert.equal(screenedAgain.appended, 0);

  await mkdir(stagingRoot, { recursive: true });
  await writeFile(join(stagingRoot, "paper.pdf"), "%PDF-1.7\n1 0 obj<</Type /Page>>endobj\nxref\n0 1\n0000000000 65535 f \ntrailer<</Size 1>>\nstartxref\n9\n%%EOF\n", { flag: "wx" });
  const acquired = await research.executeInstitutionalResearchCommand("acquire", {
    cwd: projectRoot, vaultRoot, candidatePath: join(stagingRoot, "paper.pdf"), paperId: ingested.corpus.papers[0].paperId,
    acquisitionMethod: "researcher_manual_upload", accessBasis: "researcher_provided", version: "accepted-manuscript",
    projectInclusion: "included", screeningState: "fulltext_included", acquiredAt: "2026-08-06T09:40:00.000Z"
  });
  const acquiredAgain = await research.executeInstitutionalResearchCommand("acquire", {
    cwd: projectRoot, vaultRoot, candidatePath: join(stagingRoot, "paper.pdf"), paperId: ingested.corpus.papers[0].paperId,
    acquisitionMethod: "researcher_manual_upload", accessBasis: "researcher_provided", version: "accepted-manuscript",
    projectInclusion: "included", screeningState: "fulltext_included", acquiredAt: "2026-08-06T09:40:00.000Z"
  });
  assert.equal(acquired.manifestAppended, true);
  assert.equal(acquiredAgain.manifestAppended, false);

  const counts = {
    identified: 2, normalized: 2, parseRejected: 0, unique: 2, duplicateLinks: 0,
    titleAbstractScreened: 2, fulltextCandidates: 2, titleAbstractExcluded: 0, titleAbstractPending: 0,
    fulltextSought: 2, fulltextRetrieved: 2, fulltextNotRetrieved: 0,
    fulltextAssessed: 2, finalIncluded: 2, fulltextExcluded: 0, unresolved: 0
  };
  let run = research.createResearchRun({
    id: "run-e2e", createdAt: "2026-08-06T09:00:00.000Z", protocolRevisionId: frozen.protocol.id,
    institutionProfileId: "psu-sanitized"
  });
  const receipts = [];
  for (const [index, stage] of research.INSTITUTIONAL_RESEARCH_STAGES.entries()) {
    assert.equal(run.stage, stage);
    const receipt = research.createStageReceipt({
      id: `receipt-${index + 1}`, runId: run.id, stage, protocolRevisionId: frozen.protocol.id,
      inputArtifactIds: index === 0 ? [] : [receipts[index - 1].id], outputArtifactIds: [`artifact-${stage.toLowerCase()}`],
      cursor: `cursor:${index + 1}`, createdAt: `2026-08-06T10:${String(index).padStart(2, "0")}:00.000Z`
    });
    receipts.push(receipt);
    run = research.advanceResearchRun(run, receipt, receipt.createdAt);
  }
  assert.equal(run.status, "completed");

  const accessQuestion = research.buildAccessAmbiguityCheckpoint({
    runId: "run-interrupted", protocolRevisionId: frozen.protocol.id, databaseId: "web-of-science",
    issue: "Session expired during permitted retrieval.", createdAt: "2026-08-06T10:20:00.000Z"
  });
  const interrupted = research.blockResearchRunForQuestion(research.createResearchRun({
    id: "run-interrupted", createdAt: "2026-08-06T10:19:00.000Z", stage: "FULLTEXT_ACQUISITION", protocolRevisionId: frozen.protocol.id
  }), "TERMS_OR_ACCESS_UNCLEAR", accessQuestion, "pdf:paper-1");
  const decision = [{ id: "decision-resume", checkpointKey: accessQuestion.prompt.checkpointKey, questionRecordId: accessQuestion.id }];
  assert.deepEqual(
    research.resumeResearchRun(interrupted, decision, "2026-08-06T10:21:00.000Z"),
    research.resumeResearchRun(interrupted, decision, "2026-08-06T10:21:00.000Z")
  );

  const reportInputFile = join(temp, "report-input.json");
  await writeFile(reportInputFile, JSON.stringify({
    run: { ...run, stage: "RESEARCHER_REPORT" }, protocol: frozen.protocol, counts,
    databaseYields: [{ databaseId: "web-of-science", searchedAt: "2026-08-06T09:15:00.000Z", resultCount: 2, exportedCount: 2 }],
    failures: [{ code: "FILE_PROVIDER_HYDRATION_DELAY", count: 1, resolution: "retry_succeeded" }], unresolvedIssues: [], deviations: [],
    analysisReadiness: "ready", requiredActions: ["Researcher final review"], generatedArtifacts: ["corpus/papers.jsonl"],
    inputArtifactIds: [ingested.parsed.artifactSha256], renderTimestamp: "2026-08-06T10:30:00.000Z", generatorVersion: "0.1.72"
  }));
  const report = await research.executeInstitutionalResearchCommand("report", { cwd: projectRoot, inputFile: reportInputFile });
  assert.equal(report.outputs.artifactProvenance.length, 4);

  const manuscriptInputFile = join(temp, "manuscript-input.json");
  await writeFile(manuscriptInputFile, JSON.stringify({
    title: "해커톤형 집중 프로그램과 직무역량 수요-공급 불일치", authorLines: ["유호성"], language: "ko",
    abstract: "해커톤형 집중 프로그램과 직무역량 수요-공급 불일치를 재현 가능한 문서분석 절차로 검토하였다.",
    keywords: ["해커톤", "직무역량", "수요-공급 불일치"], protocol: frozen.protocol, counts, papers: ingested.corpus.papers,
    inputArtifactIds: [ingested.parsed.artifactSha256], generatedAt: "2026-08-06T10:31:00.000Z", generatorVersion: "0.1.72",
    approvals: { databasesExecuted: true, fulltextAvailabilityVerified: true, analysisApproved: true }, analysisPlan: "structured_document_analysis"
  }));
  const profileFile = join(repoRoot, "packages", "longtable-scholar-research", "fixtures", "render-profiles", "apa7.json");
  const outputPath = join(projectRoot, "manuscript", "review.docx");
  const packaged = await research.executeInstitutionalResearchCommand("package", { cwd: projectRoot, inputFile: manuscriptInputFile, profileFile, outputPath });
  const packagedAgain = await research.executeInstitutionalResearchCommand("package", { cwd: projectRoot, inputFile: manuscriptInputFile, profileFile, outputPath: join(projectRoot, "manuscript", "review-2.docx") });
  assert.equal(packaged.rendered.contentSha256, packagedAgain.rendered.contentSha256);
  assert.equal(spawnSync("unzip", ["-t", outputPath], { encoding: "utf8" }).status, 0);

  assert.throws(() => research.validateLiveSmokeGate({ recordCount: 4, pdfCount: 1, researcherApproved: true }), /5.*20/);
  const liveSmoke = await research.executeInstitutionalResearchCommand("live-smoke", {
    cwd: projectRoot, runId: "live-smoke-1", recordCount: "5", pdfCount: "1", researcherApproved: true,
    profileApproved: true, calibrated: true, replayPassed: true, completedAt: "2026-08-06T10:40:00.000Z"
  });
  assert.equal(liveSmoke.productionEligible, true);

  console.log("institutional review E2E passed");
} finally {
  await rm(temp, { recursive: true, force: true });
}
