import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cli = join(repoRoot, "packages", "longtable", "dist", "cli.js");

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
}

const scholar = await import(join(repoRoot, "packages", "longtable-research", "dist", "index.js"));
const compatibility = await import(join(repoRoot, "packages", "longtable-research-search", "dist", "index.js"));
const codex = await import(join(repoRoot, "packages", "longtable-provider-codex", "dist", "index.js"));
const claude = await import(join(repoRoot, "packages", "longtable-provider-claude", "dist", "index.js"));
const personas = await import(join(repoRoot, "packages", "longtable", "dist", "personas.js"));

assertEqual(compatibility.SCHOLAR_RESEARCH_SKILL_NAME, scholar.SCHOLAR_RESEARCH_SKILL_NAME, "compatibility package re-export");
assertEqual(scholar.LONGTABLE_RESEARCH_SKILL_NAME, "longtable-research", "canonical skill name");
assertEqual(scholar.SCHOLAR_RESEARCH_SKILL_NAME, "longtable-research", "compatibility skill constant");
assert(scholar.SCHOLAR_RESEARCH_FAILURE_REASONS.includes("restricted_access"), "restricted access failure reason");
assert(scholar.SCHOLAR_RESEARCH_FAILURE_REASONS.includes("robots_or_terms_blocked"), "robots/terms failure reason");
assert(scholar.SCHOLAR_RESEARCH_SLOT_STATUSES.includes("filled"), "filled slot status");
assert(scholar.SCHOLAR_RESEARCH_SLOT_STATUSES.includes("blocked"), "blocked slot status");

const readiness = scholar.assessScholarResearchReadiness({
  LONGTABLE_CONTACT_EMAIL: "researcher@example.test",
  OPENALEX_API_KEY: "test-openalex",
  CORE_API_KEY: "test-core"
});
assertEqual(readiness.safety.paywallBypassAllowed, false, "paywall bypass must be disabled");
assertEqual(readiness.safety.institutionLoginAutomationAllowed, false, "institution login automation must be disabled");
assert(!scholar.SEARCH_SOURCES.includes("unpaywall"), "Unpaywall should not be included as a scholar-research source");
assert(readiness.connectors.some((connector) => connector.name === "Crossref" && connector.status === "ready"), "Crossref readiness");
assert(!readiness.connectors.some((connector) => connector.name === "Unpaywall"), "Unpaywall should not be included in scholar-research readiness");
assert(readiness.connectors.some((connector) => connector.name === "CORE" && connector.status === "ready"), "CORE readiness");

const fixture = scholar.buildScholarResearchSmokeFixture();
assertEqual(fixture.length, 10, "smoke fixture size");
assertEqual(fixture.filter((item) => item.category === "oa_pdf").length, 3, "OA PDF fixture count");
assertEqual(fixture.filter((item) => item.category === "restricted_fallback").length, 2, "restricted fallback fixture count");
assertEqual(fixture.filter((item) => item.category === "korean_institutional_report").length, 1, "Korean report fixture count");

assertEqual(scholar.citationSlotIsStrictlyFilled({
  id: "slot-1",
  claim: "A claim",
  status: "filled",
  relation: "supports",
  evidence: {
    sourceId: "doi:10.1000/example",
    quote: "Evidence text",
    locator: "page=2,paragraph=3",
    contentHash: "sha256:fixture",
    sourceVersion: "version-of-record",
    accessClass: "open_access"
  }
}), true, "strict filled citation slot");
assertEqual(scholar.citationSlotIsStrictlyFilled({
  id: "slot-2",
  claim: "A claim",
  status: "filled"
}), false, "filled label alone is insufficient");

const providerPacket = scholar.buildProviderTaskPacket({
  runId: "packet-run",
  stage: "extract",
  objective: "Propose claim-evidence links",
  boundedEvidence: [{
    spanId: "span-1",
    sourceId: "doi:10.1000/packet",
    quote: "Packet evidence",
    locator: "page:1;chars:0-15",
    contentHash: "sha256:packet",
    sourceVersion: "version-of-record",
    accessClass: "public_oa"
  }],
  allowedPatchPaths: ["/citationSlots"],
  maxOutputCharacters: 2000
});
assertEqual(scholar.validateProviderProposedPatch(providerPacket, {
  schema: "longtable.provider-proposed-patch",
  version: 1,
  runId: "packet-run",
  stage: "extract",
  operations: [{
    op: "add",
    path: "/citationSlots/0",
    value: {
      id: "slot-1",
      claim: "Packet claim",
      status: "provisional",
      relation: "supports",
      evidence: providerPacket.boundedEvidence[0]
    }
  }]
}).valid, true, "bounded provider patch");
assertEqual(scholar.validateProviderProposedPatch(providerPacket, {
  schema: "longtable.provider-proposed-patch",
  version: 1,
  runId: "packet-run",
  stage: "extract",
  operations: [{ op: "replace", path: "/input/query", value: "mutated" }]
}).valid, false, "provider cannot mutate outside allowed paths");
assertEqual(scholar.validateProviderProposedPatch(providerPacket, {
  schema: "longtable.provider-proposed-patch",
  version: 1,
  runId: "packet-run",
  stage: "extract",
  operations: [{ op: "add", path: "/citationSlots/0", value: { status: "filled" } }]
}).valid, false, "provider cannot self-promote citation slots to filled");

const evaluationPlan = scholar.buildScholarResearchEvaluationPlan();
assertEqual(evaluationPlan.tasks.length, 12, "evaluation task count");
assertEqual(evaluationPlan.repeatsPerFrozenCondition, 3, "frozen condition repeat count");
assertEqual(evaluationPlan.replayCases[0].posture, "replay_only", "Paper B thread is replay-only");

const visualContract = {
  schema: "longtable.visual-evidence-contract",
  version: 1,
  id: "visual-1",
  kind: "figure",
  status: "proposed",
  analyticalQuestion: "How does validation scope change the evidence pattern?",
  readerTakeaway: "Scope is visible before outcome magnitude.",
  necessity: "A pattern comparison is faster than exact row lookup.",
  manuscriptClaimIds: ["claim-1"],
  targetJournal: "Fixture Journal",
  journalGrammar: {
    journal: "Fixture Journal",
    derivedFrom: [{
      sourceId: "doi:10.1000/visual",
      sourceVersion: "version-of-record",
      accessClass: "public_oa",
      pageRenderPath: "page-4.png",
      page: 4,
      boundingBox: { x: 10, y: 10, width: 100, height: 80 },
      caption: "Fixture caption",
      surroundingContext: "Fixture results context",
      observedPattern: "Direct labels and grayscale marks"
    }],
    pageOrColumnWidth: "single-column",
    typography: ["sans-serif"],
    lineAndMarkerRules: ["grayscale"],
    tableRules: [],
    captionRules: ["title outside artwork"],
    colorPolicy: "grayscale",
    notes: []
  },
  evidenceBoundary: { performed: ["audit"], proposed: [], prohibitedInferences: ["causality"] },
  dataContract: {
    dataSnapshotPath: "data.json",
    unitOfAnalysis: "report-estimand",
    denominator: "all eligible reports",
    estimandOrConstruct: "validation coverage",
    uncertainty: "exact counts",
    independentUnitField: "report_id"
  },
  readingOrder: ["question", "pattern", "denominator", "conclusion"],
  mainTextRole: "Pattern interpretation",
  supplementRole: "Complete rows and locators",
  directLabels: true,
  output: {
    editableSourceFormat: "svg",
    renderer: "fixture",
    rendererVersion: "1",
    journalSizedExports: ["figure.svg"],
    placementManifestPath: "placement.json"
  },
  readerTest: {
    seconds: 20,
    recover: ["question", "denominator", "key_value_or_relation", "conclusion"]
  }
};
assertEqual(scholar.validateVisualEvidenceContract(visualContract).valid, true, "visual evidence contract");
const approvedVisualContract = {
  ...visualContract,
  status: "approved",
  accessibility: {
    grayscaleSafe: true,
    colorVisionSafe: true,
    textAlternative: "A compact description of the evidenced pattern and its denominator.",
    minimumFontSizePt: 8
  },
  verificationPlan: {
    domainMeaning: "A domain reviewer checks the interpretation against the cited claims.",
    statisticalIntegrity: "A methods reviewer checks units, denominators, axes, and uncertainty.",
    journalFit: "An editor checks the located exemplars and journal-sized export.",
    readerComprehension: "A blinded reader performs the 15-second recovery test."
  },
  approval: {
    approvedBy: "human-fixture",
    approvedAt: "2026-07-27T00:00:00.000Z",
    decisionRecordId: "decision-visual-1"
  }
};
assertEqual(scholar.validateVisualEvidenceContract(approvedVisualContract).valid, true, "approved visual requires four-lens verification");
const inaccessibleApprovedVisual = {
  ...approvedVisualContract,
  accessibility: { ...approvedVisualContract.accessibility, grayscaleSafe: false }
};
assert(
  scholar.validateVisualEvidenceContract(inaccessibleApprovedVisual).hardFailures.some((failure) => failure.includes("grayscale-safe")),
  "approved visual rejects inaccessible output"
);
assertEqual(scholar.recommendVisualArtifactKind({
  needsExactLookup: false,
  needsPatternComparison: true,
  needsProcessOrConceptualRelation: false
}), "figure", "visual kind recommendation");

const workflowCwd = mkdtempSync(join(tmpdir(), "longtable-scholar-workflow-"));
try {
  const fixtureFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => "",
    json: async () => ({
      message: {
        items: [{
          DOI: "10.1000/workflow",
          title: ["Workflow evidence"],
          author: [{ given: "Ada", family: "Lovelace" }],
          published: { "date-parts": [[2025]] },
          "container-title": ["Fixture Journal"],
          abstract: "This fixture evaluates a durable scholarly research workflow."
        }]
      }
    })
  });
  const bundle = await scholar.runScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: "workflow-run",
    query: "durable scholarly research workflow",
    sources: "crossref",
    allowPartial: true,
    fetch: fixtureFetch,
    env: {}
  });
  assertEqual(bundle.status, "paused", "workflow pauses honestly at unimplemented fulltext boundary");
  assertEqual(bundle.stages.collect.status, "completed", "collect stage completed");
  assertEqual(bundle.stages.fulltext.status, "pending", "fulltext remains pending");
  assertEqual(bundle.artifacts.searchRun.cards.length, 1, "search result stored in bundle");
  const eventPath = join(bundle.runDir, "events.jsonl");
  const eventCount = readFileSync(eventPath, "utf8").trim().split("\n").length;
  const resumed = await scholar.resumeScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: bundle.runId,
    fetch: fixtureFetch,
    env: {}
  });
  assertEqual(resumed.status, "paused", "resume preserves capability boundary");
  assertEqual(readFileSync(eventPath, "utf8").trim().split("\n").length, eventCount, "resume is idempotent");
  await scholar.runScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: bundle.runId,
    query: "durable scholarly research workflow",
    sources: "crossref",
    allowPartial: true,
    fetch: fixtureFetch,
    env: {}
  });
  assertEqual(readFileSync(eventPath, "utf8").trim().split("\n").length, eventCount, "run with the same id and input is idempotent");

  const oaRequestInits = [];
  const oaBytes = Buffer.from("%PDF-1.7\nfixture OA bytes\n%%EOF", "utf8");
  const oaSearchFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => "",
    json: async () => ({
      results: [{
        id: "https://openalex.org/W123",
        display_name: "Open-access workflow evidence",
        publication_year: 2026,
        primary_location: {
          pdf_url: "https://oa.example.test/article.pdf",
          source: { display_name: "Fixture OA Journal" }
        },
        open_access: { is_oa: true },
        authorships: [],
        cited_by_count: 0
      }]
    })
  });
  const oaBundle = await scholar.runScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: "oa-auto-run",
    query: "open access workflow evidence",
    sources: "openalex",
    allowPartial: true,
    fetch: oaSearchFetch,
    oaFetch: async (url, init) => {
      oaRequestInits.push({ url, init });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        url,
        headers: {
          get: (name) => {
            if (name.toLowerCase() === "content-type") return "application/pdf";
            if (name.toLowerCase() === "content-length") return String(oaBytes.length);
            return null;
          }
        },
        arrayBuffer: async () => oaBytes.buffer.slice(
          oaBytes.byteOffset,
          oaBytes.byteOffset + oaBytes.byteLength
        )
      };
    },
    oaResolveHost: async () => ["93.184.216.34"],
    globalPublicOaCacheRoot: join(workflowCwd, "oa-cache"),
    fullTextParser: async () => ({
      pageCount: 1,
      pages: [{
        page: 1,
        text: "Open-access full-text evidence was acquired through a validated public route.",
        locator: "page:1",
        extraction: "text"
      }],
      ocrPages: [],
      parser: { pdfinfo: "fixture", pdftotext: "fixture" }
    }),
    env: { OPENALEX_API_KEY: "fixture-openalex" }
  });
  assertEqual(oaBundle.stages.fulltext.status, "completed", "automatic public OA acquisition completes fulltext");
  assertEqual(oaBundle.artifacts.fullTextRecords.length, 1, "automatic OA record stored");
  assertEqual(oaBundle.artifacts.fullTextRecords[0].accessClass, "public_oa", "automatic OA access class");
  assertEqual(oaBundle.artifacts.publicOaAcquisition.acquired, 1, "automatic OA acquisition telemetry");
  assertEqual(oaRequestInits[0].init.redirect, "manual", "OA redirects require validation");
  assertEqual(oaRequestInits[0].init.credentials, "omit", "OA acquisition omits credentials");
  let unsafeOaFetchCalled = false;
  const unsafeOaBundle = await scholar.runScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: "oa-unsafe-run",
    query: "unsafe OA route",
    sources: "openalex",
    allowPartial: true,
    fetch: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({
        results: [{
          id: "https://openalex.org/W124",
          display_name: "Unsafe OA route",
          publication_year: 2026,
          primary_location: {
            pdf_url: "https://127.0.0.1/article.pdf",
            source: { display_name: "Unsafe Fixture" }
          },
          open_access: { is_oa: true },
          authorships: []
        }]
      })
    }),
    oaFetch: async () => {
      unsafeOaFetchCalled = true;
      throw new Error("unsafe fetch should not execute");
    },
    fullTextParser: async () => {
      throw new Error("unsafe parser should not execute");
    },
    env: { OPENALEX_API_KEY: "fixture-openalex" }
  });
  assertEqual(unsafeOaFetchCalled, false, "private OA target is rejected before fetch");
  assertEqual(unsafeOaBundle.status, "waiting_for_checkpoint", "unsafe-only OA corpus blocks at access boundary");
  assertEqual(
    unsafeOaBundle.artifacts.publicOaAcquisition.events[0].failureReason,
    "restricted_access",
    "unsafe OA target receives typed failure"
  );

  const pdfDirectory = join(workflowCwd, "pdf-input");
  mkdirSync(pdfDirectory, { recursive: true });
  writeFileSync(join(pdfDirectory, "fixture.pdf"), "%PDF fixture bytes", "utf8");
  const fullTextBundle = await scholar.runScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: "fulltext-run",
    query: "durable scholarly research workflow",
    sources: "crossref",
    allowPartial: true,
    pdfDirectory,
    pdfAccessClass: "manual_legitimate_access",
    fetch: fixtureFetch,
    env: {},
    fullTextParser: async () => ({
      pageCount: 2,
      pages: [
        { page: 1, text: "First page evidence", locator: "page:1", extraction: "text" },
        { page: 2, text: "Second page evidence", locator: "page:2", extraction: "ocr" }
      ],
      ocrPages: [2],
      parser: { pdfinfo: "fixture", pdftotext: "fixture" }
    })
  });
  assertEqual(fullTextBundle.stages.fulltext.status, "completed", "fulltext stage completed");
  assertEqual(fullTextBundle.stages.extract.status, "awaiting_provider", "extract packets await provider");
  assertEqual(fullTextBundle.artifacts.fullTextRecords[0].storageClass, "project_isolated", "manual PDF isolation");
  assert(fullTextBundle.artifacts.fullTextRecords[0].contentHash.startsWith("sha256:"), "content-addressed PDF hash");
  assert(existsSync(fullTextBundle.artifacts.fullTextRecords[0].derivedTextPath), "parsed fulltext artifact exists");
  assert(fullTextBundle.artifacts.extractionTasks.packets.length > 0, "bounded extraction packets created");
  const extractionPacket = JSON.parse(readFileSync(fullTextBundle.artifacts.extractionTasks.packets[0].path, "utf8"));
  assertEqual(extractionPacket.stage, "extract", "extraction packet stage");
  assert(extractionPacket.boundedEvidence.every((span) => span.locator.includes("page:")), "extraction spans preserve page locators");
  assert(extractionPacket.instructions.some((line) => line.includes("never mark")), "packet prohibits provider-filled slots");
  const patchPath = join(workflowCwd, "provider-patch.json");
  writeFileSync(patchPath, JSON.stringify({
    schema: "longtable.provider-proposed-patch",
    version: 1,
    runId: fullTextBundle.runId,
    stage: "extract",
    operations: [{
      op: "add",
      path: "/citationSlots/0",
      value: {
        id: "workflow-slot-1",
        claim: "The fixture contains page evidence.",
        status: "provisional",
        relation: "supports",
        evidence: extractionPacket.boundedEvidence[0]
      }
    }]
  }), "utf8");
  const recordedPatch = await scholar.recordScholarResearchProviderPatch({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    packetPath: fullTextBundle.artifacts.extractionTasks.packets[0].path,
    patchPath,
    provider: "codex-fixture"
  });
  assert(existsSync(recordedPatch.record.path), "validated provider patch persisted");
  const recordedAgain = await scholar.recordScholarResearchProviderPatch({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    packetPath: fullTextBundle.artifacts.extractionTasks.packets[0].path,
    patchPath,
    provider: "codex-fixture"
  });
  assertEqual(recordedAgain.bundle.artifacts.providerPatches.length, 1, "provider patch recording is idempotent");
  const verificationPath = join(workflowCwd, "provider-verification.json");
  writeFileSync(verificationPath, JSON.stringify({
    schema: "longtable.provider-verification",
    version: 1,
    runId: fullTextBundle.runId,
    packetId: recordedPatch.record.packetId,
    provider: "claude-fixture",
    independent: true,
    proposalPatchHash: recordedPatch.record.patchHash,
    decisions: [{
      citationSlotId: "workflow-slot-1",
      decision: "agree",
      evidenceSpanIds: [extractionPacket.boundedEvidence[0].spanId],
      rationale: "The exact supplied span supports the bounded claim."
    }]
  }), "utf8");
  const verificationRecord = await scholar.recordScholarResearchVerification({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    verificationPath
  });
  assertEqual(verificationRecord.bundle.stages.extract.status, "awaiting_human", "provider agreement does not replace human review");
  assertEqual(verificationRecord.adjudicationPaths.length, 1, "adjudication record created");
  const adjudicationBeforeHuman = JSON.parse(
    readFileSync(verificationRecord.adjudicationPaths[0], "utf8")
  );
  assertEqual(adjudicationBeforeHuman.stage, "extract", "adjudication records its semantic stage");
  assertEqual(adjudicationBeforeHuman.errorClass, "none", "agreement has explicit no-error class");
  assert(adjudicationBeforeHuman.inputBundleHash.startsWith("sha256:"), "adjudication binds the input bundle");
  assert(adjudicationBeforeHuman.replayFixtureRef.includes(adjudicationBeforeHuman.id), "adjudication is replay-addressable");

  const humanReviewPath = join(workflowCwd, "human-review.json");
  writeFileSync(humanReviewPath, JSON.stringify({
    schema: "longtable.human-citation-review",
    version: 1,
    runId: fullTextBundle.runId,
    reviewer: "human-fixture",
    reviewedAt: "2026-07-27T00:00:00.000Z",
    decisions: [{
      citationSlotId: "workflow-slot-1",
      decision: "accept",
      rationale: "The quote, locator, version, and claim relation were manually checked."
    }]
  }), "utf8");
  const humanReview = await scholar.recordScholarResearchHumanCitationReview({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    reviewPath: humanReviewPath
  });
  assertEqual(humanReview.bundle.stages.extract.status, "completed", "human review completes extract");
  assertEqual(humanReview.citationSlots[0].status, "filled", "human-accepted strict slot becomes filled");
  assertEqual(scholar.citationSlotIsStrictlyFilled(humanReview.citationSlots[0]), true, "human accepted slot remains strict");
  const adjudicationAfterHuman = JSON.parse(
    readFileSync(verificationRecord.adjudicationPaths[0], "utf8")
  );
  assertEqual(adjudicationAfterHuman.humanDecision.adjudicatorRole, "domain_researcher", "adjudication records role-specific human authority");
  const synthesisReady = await scholar.resumeScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    fetch: fixtureFetch,
    env: {}
  });
  assertEqual(synthesisReady.stages.synthesize.status, "awaiting_provider", "human-reviewed slots feed synthesis");
  assert(existsSync(synthesisReady.artifacts.synthesisTask.path), "bounded synthesis packet exists");
  const synthesisPacket = JSON.parse(readFileSync(synthesisReady.artifacts.synthesisTask.path, "utf8"));
  assertEqual(synthesisPacket.citationSlots[0].status, "filled", "synthesis receives reviewed slot state");
  const synthesisPatchPath = join(workflowCwd, "synthesis-patch.json");
  writeFileSync(synthesisPatchPath, JSON.stringify({
    schema: "longtable.provider-proposed-patch",
    version: 1,
    runId: fullTextBundle.runId,
    stage: "synthesize",
    operations: [{
      op: "add",
      path: "/synthesis",
      value: {
        title: "Fixture synthesis",
        claims: [{
          id: "synthesis-claim-1",
          text: "The fixture contains located page evidence.",
          citationSlotIds: ["workflow-slot-1"],
          role: "finding"
        }],
        readingOrder: ["synthesis-claim-1"]
      }
    }]
  }), "utf8");
  const synthesisPatch = await scholar.recordScholarResearchProviderPatch({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    packetPath: synthesisReady.artifacts.synthesisTask.path,
    patchPath: synthesisPatchPath,
    provider: "claude-synthesis-fixture"
  });
  assertEqual(synthesisPatch.record.stage, "synthesize", "synthesis proposal is stage-scoped");
  const synthesisVerificationPath = join(workflowCwd, "synthesis-verification.json");
  writeFileSync(synthesisVerificationPath, JSON.stringify({
    schema: "longtable.provider-synthesis-verification",
    version: 1,
    runId: fullTextBundle.runId,
    packetId: synthesisPatch.record.packetId,
    provider: "codex-synthesis-fixture",
    independent: true,
    proposalPatchHash: synthesisPatch.record.patchHash,
    decisions: [{
      claimId: "synthesis-claim-1",
      decision: "agree",
      rationale: "The claim is bounded to the accepted citation slot."
    }]
  }), "utf8");
  const synthesisVerification = await scholar.recordScholarResearchSynthesisVerification({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    verificationPath: synthesisVerificationPath
  });
  assertEqual(synthesisVerification.bundle.stages.synthesize.status, "awaiting_human", "synthesis verification preserves human gate");
  const synthesisReviewPath = join(workflowCwd, "synthesis-review.json");
  writeFileSync(synthesisReviewPath, JSON.stringify({
    schema: "longtable.human-synthesis-review",
    version: 1,
    runId: fullTextBundle.runId,
    proposalPatchHash: synthesisPatch.record.patchHash,
    reviewer: "human-fixture",
    reviewedAt: "2026-07-27T00:05:00.000Z",
    decisions: [{
      claimId: "synthesis-claim-1",
      decision: "accept",
      rationale: "The wording and direction match the reviewed evidence."
    }]
  }), "utf8");
  const synthesisReview = await scholar.recordScholarResearchHumanSynthesisReview({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    reviewPath: synthesisReviewPath
  });
  assertEqual(synthesisReview.bundle.stages.synthesize.status, "completed", "human synthesis review completes synthesis");
  const visualBoundary = await scholar.resumeScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    fetch: fixtureFetch,
    env: {}
  });
  assertEqual(visualBoundary.stages.visual_contract.status, "blocked", "visual implementation is blocked before human contract approval");
  assertEqual(visualBoundary.pendingCheckpoint.class, "visual_evidence_contract", "visual checkpoint class");
  const workflowVisualDataPath = join(workflowCwd, "visual-data.json");
  writeFileSync(workflowVisualDataPath, JSON.stringify([
    { scope: "Internal", coverage: 2 },
    { scope: "External", coverage: 5 }
  ]), "utf8");
  const tableDataPath = join(workflowCwd, "table-data.json");
  writeFileSync(tableDataPath, JSON.stringify([
    { study: "A", scope: "Internal", count: 2 },
    { study: "B", scope: "External", count: 5 }
  ]), "utf8");
  const diagramDataPath = join(workflowCwd, "diagram-data.json");
  writeFileSync(diagramDataPath, JSON.stringify({
    nodes: [
      { id: "extract", label: "Data extraction", layer: "performed" },
      { id: "audit", label: "Evidence audit", layer: "performed" },
      { id: "control", label: "Claim-control model", layer: "proposed" }
    ],
    edges: [
      { source: "extract", target: "audit", label: "performed" },
      { source: "audit", target: "control", label: "informs" }
    ]
  }), "utf8");
  const workflowVisualContractPath = join(workflowCwd, "visual-contract.json");
  const proposedFigureContract = {
    ...approvedVisualContract,
    status: "proposed",
    approval: undefined,
    dataContract: {
      ...approvedVisualContract.dataContract,
      dataSnapshotPath: workflowVisualDataPath
    },
    output: {
      ...approvedVisualContract.output,
      renderer: "longtable-svg-v1",
      rendererVersion: "1",
      editableSourceFormat: "svg"
    }
  };
  writeFileSync(workflowVisualContractPath, JSON.stringify(proposedFigureContract), "utf8");
  const { axis: _unusedTableAxis, ...tableContractWithoutAxis } = proposedFigureContract;
  const proposedTableContract = {
    ...tableContractWithoutAxis,
    id: "visual-table-fixture",
    kind: "table",
    analyticalQuestion: "Which study and scope values require exact lookup?",
    readerTakeaway: "Exact values remain visible by study and validation scope.",
    necessity: "A compact table supports precise row lookup.",
    dataContract: {
      ...proposedFigureContract.dataContract,
      dataSnapshotPath: tableDataPath,
      independentUnitField: "study"
    }
  };
  const tableContractPath = join(workflowCwd, "visual-table-contract.json");
  writeFileSync(tableContractPath, JSON.stringify(proposedTableContract), "utf8");
  const proposedDiagramContract = {
    ...proposedFigureContract,
    id: "visual-diagram-fixture",
    kind: "diagram",
    analyticalQuestion: "Which workflow layers were performed and which remain proposed?",
    readerTakeaway: "Performed evidence work is visually separated from the proposed claim-control model.",
    necessity: "A diagram is required to distinguish process and conceptual layers.",
    evidenceBoundary: {
      performed: ["Data extraction", "Evidence audit"],
      proposed: ["Claim-control model"],
      prohibitedInferences: ["The proposed model was empirically tested"]
    },
    dataContract: {
      ...proposedFigureContract.dataContract,
      dataSnapshotPath: diagramDataPath,
      unitOfAnalysis: "workflow node",
      denominator: "all declared workflow nodes",
      estimandOrConstruct: "performed versus proposed layer",
      independentUnitField: "id"
    },
    readingOrder: ["performed layer", "transition", "proposed layer", "boundary"]
  };
  const diagramContractPath = join(workflowCwd, "visual-diagram-contract.json");
  writeFileSync(diagramContractPath, JSON.stringify(proposedDiagramContract), "utf8");
  const portfolioPlanPath = join(workflowCwd, "visual-portfolio-plan.json");
  writeFileSync(portfolioPlanPath, JSON.stringify({
    schema: "longtable.visual-portfolio-plan",
    version: 1,
    runId: fullTextBundle.runId,
    portfolioId: "fixture-portfolio",
    contractIds: [
      proposedFigureContract.id,
      proposedTableContract.id,
      proposedDiagramContract.id
    ],
    rationale: "The manuscript requires a pattern figure, exact-lookup table, and performed/proposed diagram.",
    registeredBy: "human-visual-fixture",
    registeredAt: "2026-07-27T00:09:00.000Z"
  }), "utf8");
  const portfolio = JSON.parse(execFileSync("node", [
    cli,
    "scholar-research",
    "register-visual-portfolio",
    "--cwd", workflowCwd,
    "--run-id", fullTextBundle.runId,
    "--plan", portfolioPlanPath,
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  }));
  assertEqual(portfolio.plan.contractIds.length, 3, "visual portfolio freezes three contract IDs");
  const workflowVisualReviewPath = join(workflowCwd, "visual-review.json");
  writeFileSync(workflowVisualReviewPath, JSON.stringify({
    schema: "longtable.human-visual-contract-review",
    version: 1,
    runId: fullTextBundle.runId,
    reviewer: "human-visual-fixture",
    reviewedAt: "2026-07-27T00:10:00.000Z",
    decisionRecordId: "decision-visual-workflow",
    decision: "approve",
    checks: {
      domainMeaning: true,
      statisticalIntegrity: true,
      journalFit: true,
      readerComprehension: true
    },
    rationale: "All four review lenses and the 15-second recovery test passed."
  }), "utf8");
  const visualReview = await scholar.recordScholarResearchHumanVisualReview({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    contractPath: workflowVisualContractPath,
    reviewPath: workflowVisualReviewPath
  });
  assertEqual(visualReview.contract.status, "approved", "human review approves valid visual contract");
  assertEqual(visualReview.bundle.stages.visual_contract.status, "blocked", "one portfolio approval does not complete checkpoint");
  const tableVisualReviewPath = join(workflowCwd, "visual-table-review.json");
  writeFileSync(tableVisualReviewPath, JSON.stringify({
    ...JSON.parse(readFileSync(workflowVisualReviewPath, "utf8")),
    reviewedAt: "2026-07-27T00:11:00.000Z",
    decisionRecordId: "decision-visual-table"
  }), "utf8");
  const tableVisualReview = await scholar.recordScholarResearchHumanVisualReview({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    contractPath: tableContractPath,
    reviewPath: tableVisualReviewPath
  });
  assertEqual(tableVisualReview.bundle.stages.visual_contract.status, "blocked", "two portfolio approvals remain incomplete");
  const diagramVisualReviewPath = join(workflowCwd, "visual-diagram-review.json");
  writeFileSync(diagramVisualReviewPath, JSON.stringify({
    ...JSON.parse(readFileSync(workflowVisualReviewPath, "utf8")),
    reviewedAt: "2026-07-27T00:12:00.000Z",
    decisionRecordId: "decision-visual-diagram"
  }), "utf8");
  const diagramVisualReview = await scholar.recordScholarResearchHumanVisualReview({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    contractPath: diagramContractPath,
    reviewPath: diagramVisualReviewPath
  });
  assertEqual(diagramVisualReview.bundle.stages.visual_contract.status, "completed", "all portfolio approvals complete checkpoint");
  const rendererBoundary = await scholar.resumeScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    fetch: fixtureFetch,
    env: {}
  });
  assertEqual(rendererBoundary.stages.visual_contract.status, "completed", "visual approval survives resume");
  assertEqual(rendererBoundary.pauseReason.includes("allowlisted render"), true, "workflow pauses honestly before renderer implementation");
  const visualRenderRequestPath = join(workflowCwd, "visual-render-request.json");
  writeFileSync(visualRenderRequestPath, JSON.stringify({
    schema: "longtable.visual-render-request",
    version: 1,
    runId: fullTextBundle.runId,
    contractId: visualReview.contract.id,
    renderer: "longtable-svg-v1",
    widthPx: 540,
    heightPx: 360,
    specification: {
      kind: "figure",
      mark: "bar",
      xField: "scope",
      yField: "coverage",
      xLabel: "Validation scope",
      yLabel: "Evidence count"
    }
  }), "utf8");
  const renderedVisual = await scholar.recordScholarResearchVisualRender({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    contractId: visualReview.contract.id,
    requestPath: visualRenderRequestPath
  });
  assertEqual(renderedVisual.qa.passed, true, "allowlisted render passes mechanical QA");
  assert(existsSync(renderedVisual.manifest.editableSourcePath), "editable SVG output exists");
  assertEqual(renderedVisual.bundle.stages.verify.status, "awaiting_human", "mechanical QA does not replace human render review");
  const tableRenderRequestPath = join(workflowCwd, "table-render-request.json");
  writeFileSync(tableRenderRequestPath, JSON.stringify({
    schema: "longtable.visual-render-request",
    version: 1,
    runId: fullTextBundle.runId,
    contractId: tableVisualReview.contract.id,
    renderer: "longtable-svg-v1",
    widthPx: 540,
    heightPx: 300,
    specification: {
      kind: "table",
      columns: [
        { field: "study", label: "Study" },
        { field: "scope", label: "Validation scope" },
        { field: "count", label: "Count", align: "right" }
      ]
    }
  }), "utf8");
  const tableRender = await scholar.recordScholarResearchVisualRender({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    contractId: tableVisualReview.contract.id,
    requestPath: tableRenderRequestPath
  });
  assertEqual(tableRender.qa.passed, true, "editable table rendering passes mechanical QA");
  const diagramRenderRequestPath = join(workflowCwd, "diagram-render-request.json");
  writeFileSync(diagramRenderRequestPath, JSON.stringify({
    schema: "longtable.visual-render-request",
    version: 1,
    runId: fullTextBundle.runId,
    contractId: diagramVisualReview.contract.id,
    renderer: "longtable-svg-v1",
    widthPx: 640,
    heightPx: 360,
    specification: {
      kind: "diagram",
      nodeIdField: "id",
      nodeLabelField: "label",
      nodeLayerField: "layer",
      edgeSourceField: "source",
      edgeTargetField: "target",
      edgeLabelField: "label"
    }
  }), "utf8");
  const diagramRender = await scholar.recordScholarResearchVisualRender({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    contractId: diagramVisualReview.contract.id,
    requestPath: diagramRenderRequestPath
  });
  assertEqual(diagramRender.qa.passed, true, "performed/proposed diagram rendering passes mechanical QA");
  const journalProfilePath = join(workflowCwd, "target-journal-profile.json");
  writeFileSync(journalProfilePath, JSON.stringify({
    schema: "longtable.target-journal-profile",
    version: "1.0.0",
    profileId: "fixture-journal-profile",
    targetJournal: "Fixture Journal",
    createdAt: "2026-07-27T00:14:00.000Z",
    evidenceSources: [{
      sourceId: "doi:10.1000/visual",
      title: "Fixture journal exemplar",
      locator: "page:4",
      contentHash: "sha256:fixture-journal-evidence",
      accessClass: "public_oa"
    }],
    topicPatterns: ["Evidence-bound validation studies"],
    formatPatterns: {
      manuscriptStructure: ["Question, method, evidence, limitation"],
      tables: ["Exact lookup values with denominators"],
      figures: ["Direct labels and grayscale marks"],
      diagrams: ["Performed and proposed layers are visibly distinct"]
    },
    humanReview: {
      reviewer: "human-journal-fixture",
      reviewedAt: "2026-07-27T00:14:30.000Z",
      decision: "accept",
      notes: "Observed patterns match the exemplar set."
    }
  }), "utf8");
  await scholar.recordTargetJournalProfile({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    profile: JSON.parse(readFileSync(journalProfilePath, "utf8"))
  });
  const renderedVisualReviewPath = join(workflowCwd, "rendered-visual-review.json");
  writeFileSync(renderedVisualReviewPath, JSON.stringify({
    schema: "longtable.human-rendered-visual-review",
    version: 1,
    runId: fullTextBundle.runId,
    contractId: visualReview.contract.id,
    reviewer: "human-reader-fixture",
    reviewedAt: "2026-07-27T00:15:00.000Z",
    decision: "accept",
    checks: {
      domainMeaning: true,
      statisticalIntegrity: true,
      journalFit: true,
      readerComprehension: true
    },
    readerTest: {
      seconds: 15,
      recoveredQuestion: true,
      recoveredDenominator: true,
      recoveredKeyValueOrRelation: true,
      recoveredConclusion: true
    },
    rationale: "The rendered figure preserved meaning and passed the timed recovery test."
  }), "utf8");
  const renderedVisualReview = await scholar.recordScholarResearchHumanRenderedVisualReview({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    reviewPath: renderedVisualReviewPath
  });
  assertEqual(renderedVisualReview.bundle.stages.verify.status, "awaiting_human", "one portfolio render review does not complete verification");
  const tableRenderedReviewPath = join(workflowCwd, "rendered-table-review.json");
  writeFileSync(tableRenderedReviewPath, JSON.stringify({
    ...JSON.parse(readFileSync(renderedVisualReviewPath, "utf8")),
    contractId: tableVisualReview.contract.id,
    reviewedAt: "2026-07-27T00:16:00.000Z",
    rationale: "The exact-lookup table preserved every reviewed row and value."
  }), "utf8");
  const tableRenderedReview = await scholar.recordScholarResearchHumanRenderedVisualReview({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    reviewPath: tableRenderedReviewPath
  });
  assertEqual(tableRenderedReview.bundle.stages.verify.status, "awaiting_human", "two portfolio render reviews remain incomplete");
  const diagramRenderedReviewPath = join(workflowCwd, "rendered-diagram-review.json");
  writeFileSync(diagramRenderedReviewPath, JSON.stringify({
    ...JSON.parse(readFileSync(renderedVisualReviewPath, "utf8")),
    contractId: diagramVisualReview.contract.id,
    reviewedAt: "2026-07-27T00:17:00.000Z",
    rationale: "The diagram clearly separated performed and proposed layers."
  }), "utf8");
  const diagramRenderedReview = await scholar.recordScholarResearchHumanRenderedVisualReview({
    cwd: workflowCwd,
    runId: fullTextBundle.runId,
    reviewPath: diagramRenderedReviewPath
  });
  assertEqual(diagramRenderedReview.bundle.stages.verify.status, "completed", "all portfolio render reviews complete verification");
  assertEqual(diagramRenderedReview.bundle.stages.handoff.status, "completed", "verified portfolio writes handoff");
  assertEqual(diagramRenderedReview.bundle.status, "completed", "portfolio fixture workflow completes");
  assert(existsSync(diagramRenderedReview.bundle.artifacts.verifiedPackage.manifestPath), "verified package manifest exists");
  assert(existsSync(diagramRenderedReview.bundle.artifacts.verifiedPackage.verificationPath), "verified package verification exists");
  const runVerification = await scholar.verifyScholarResearchRun({
    cwd: workflowCwd,
    runId: fullTextBundle.runId
  });
  assertEqual(runVerification.passed, true, "completed portfolio run passes durable readback verification");
  const cliStatus = JSON.parse(execFileSync("node", [
    cli,
    "scholar-research",
    "status",
    "--cwd", workflowCwd,
    "--run-id", fullTextBundle.runId,
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  }));
  assertEqual(cliStatus.status, "completed", "CLI status reads the durable bundle");
  const cliExplanation = JSON.parse(execFileSync("node", [
    cli,
    "scholar-research",
    "explain",
    "--cwd", workflowCwd,
    "--run-id", fullTextBundle.runId,
    "--stage", "verify",
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  }));
  assertEqual(cliExplanation.state.status, "completed", "CLI explain reads stage state and events");
  const cliVerification = JSON.parse(execFileSync("node", [
    cli,
    "scholar-research",
    "verify",
    "--cwd", workflowCwd,
    "--run-id", fullTextBundle.runId,
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  }));
  assertEqual(cliVerification.passed, true, "CLI verify independently reads durable artifacts");

  const blockedBundle = await scholar.runScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: "access-blocked-run",
    query: "durable scholarly research workflow",
    sources: "crossref",
    allowPartial: true,
    pdfDirectory,
    fetch: fixtureFetch,
    env: {}
  });
  assertEqual(blockedBundle.status, "waiting_for_checkpoint", "missing PDF access class blocks");
  assertEqual(blockedBundle.pendingCheckpoint.class, "access_corpus_boundary", "access checkpoint class");
  const accessResumed = await scholar.resumeScholarResearchWorkflow({
    cwd: workflowCwd,
    runId: blockedBundle.runId,
    pdfAccessClass: "private",
    fetch: fixtureFetch,
    env: {},
    fullTextParser: async () => ({
      pageCount: 1,
      pages: [{ page: 1, text: "Private corpus evidence", locator: "page:1", extraction: "text" }],
      ocrPages: [],
      parser: { pdfinfo: "fixture", pdftotext: "fixture" }
    })
  });
  assertEqual(accessResumed.stages.fulltext.status, "completed", "access amendment resumes fulltext");
  assertEqual(accessResumed.artifacts.fullTextRecords[0].accessClass, "private", "amended access class recorded");
} finally {
  rmSync(workflowCwd, { recursive: true, force: true });
}

const cwd = mkdtempSync(join(tmpdir(), "longtable-scholar-smoke-"));
try {
  const scaffold = JSON.parse(execFileSync("node", [
    cli,
    "scholar-research",
    "scaffold",
    "--cwd", cwd,
    "--run-id", "smoke-run",
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  }));
  assert(scaffold.runDir.endsWith(join(".longtable", "research-runs", "smoke-run")), "scaffold run dir");
  assert(existsSync(join(cwd, ".longtable", "research-runs", "smoke-run", "journal.md")), "journal scaffold exists");
  assert(existsSync(join(cwd, ".longtable", "research-runs", "smoke-run", "evidence-ledger.md")), "evidence ledger scaffold exists");
  assert(existsSync(join(cwd, ".longtable", "research-runs", "smoke-run", "citation-slot-matrix.md")), "citation slot scaffold exists");
  const evaluation = await scholar.writeScholarResearchEvaluationPlan({
    cwd,
    planId: "smoke-evaluation"
  });
  const observationPath = join(cwd, "evaluation-observation.json");
  writeFileSync(observationPath, JSON.stringify({
    schema: "longtable.scholar-research-evaluation-observation",
    version: 1,
    observationId: "prospective-smoke-1",
    planId: evaluation.plan.planId,
    taskId: "visual-e2e-1",
    layer: "prospective",
    condition: "workflow_on",
    crossoverPairId: "pair-1",
    provider: "codex",
    model: "fixture",
    modelVersion: "1",
    corpusCutoff: "2026-07-27",
    permissionsProfile: "fixture-local-only",
    stageProfile: ["extract-verifier", "visual-contract", "human-render-review"],
    startedAt: "2026-07-27T00:00:00.000Z",
    acceptedArtifactAt: "2026-07-27T00:09:00.000Z",
    completedAt: "2026-07-27T00:10:00.000Z",
    quality: {
      unsupportedFinalClaim: false,
      wrongSourceVersionOrCitation: false,
      visualDistortion: false,
      prohibitedAccess: false,
      preapprovalMutation: false
    },
    metrics: {
      elapsedMs: 600000,
      activeHumanMs: 120000,
      interruptionCount: 1,
      repeatedQuestionCount: 0,
      contextSwitchCount: 1,
      reworkCount: 0,
      toolCallCount: 12,
      abandoned: false,
      researcherEffort: 3,
      researcherTrust: 6
    },
    artifactRefs: ["fixture-artifact.svg"],
    notes: ["prospective fixture only"]
  }), "utf8");
  const recordedObservation = await scholar.recordScholarResearchEvaluationObservation({
    cwd,
    planId: evaluation.plan.planId,
    observationPath
  });
  assert(existsSync(recordedObservation.path), "evaluation observation ledger exists");
  const recordedObservationAgain = await scholar.recordScholarResearchEvaluationObservation({
    cwd,
    planId: evaluation.plan.planId,
    observationPath
  });
  assertEqual(recordedObservationAgain.path, recordedObservation.path, "evaluation observation recording is idempotent");
  const trialConfigPath = join(cwd, "prospective-trial-config.json");
  writeFileSync(trialConfigPath, JSON.stringify({
    schema: "longtable.prospective-trial-config",
    version: 1,
    planId: evaluation.plan.planId,
    trialId: "smoke-crossover",
    taskId: "visual-e2e-2",
    researchQuestion: "Which visual contract best preserves report-level evidence?",
    targetJournal: "Educational Psychology Review",
    provider: "codex",
    model: "fixture",
    modelVersion: "1",
    corpusCutoff: "2026-07-27",
    permissionsProfile: "fixture-local-only",
    crossoverSeed: "smoke-seed",
    workflowOnStages: ["visual-contract", "human-render-review"],
    workflowOffStages: ["human-render-review"]
  }), "utf8");
  const trial = await scholar.createProspectiveTrialProtocol({
    cwd,
    configPath: trialConfigPath
  });
  assertEqual(trial.protocol.conditionOrder.length, 2, "trial has two crossover conditions");
  assert(
    trial.protocol.conditionOrder.every((condition) =>
      scholar.PROSPECTIVE_TRIAL_PROTECTED_STAGES.every((stage) =>
        condition.stageProfile.includes(stage)
      )
    ),
    "protected stages are injected into both conditions"
  );
  assert(
    trial.protocol.conditionOrder[0].condition !== trial.protocol.conditionOrder[1].condition,
    "trial condition order contains workflow on and off"
  );
  const trialAgain = await scholar.createProspectiveTrialProtocol({
    cwd,
    configPath: trialConfigPath
  });
  assertEqual(trialAgain.protocol.createdAt, trial.protocol.createdAt, "trial creation is idempotent");
  const session = await scholar.startProspectiveTrialSession({
    cwd,
    planId: evaluation.plan.planId,
    trialId: trial.protocol.trialId,
    conditionIndex: 0
  });
  const sessionAgain = await scholar.startProspectiveTrialSession({
    cwd,
    planId: evaluation.plan.planId,
    trialId: trial.protocol.trialId,
    conditionIndex: 0
  });
  assertEqual(sessionAgain.session.startedAt, session.session.startedAt, "trial start is idempotent");
  assertEqual(
    session.taskCapsule.researchQuestion,
    trial.protocol.researchQuestion,
    "task capsule freezes the research question"
  );
  const trialResultPath = join(cwd, "prospective-trial-result.json");
  writeFileSync(trialResultPath, JSON.stringify({
    schema: "longtable.prospective-trial-session-result",
    version: 1,
    acceptedArtifactAt: session.session.startedAt,
    activeHumanMs: 0,
    interruptionCount: 0,
    repeatedQuestionCount: 0,
    contextSwitchCount: 0,
    reworkCount: 0,
    toolCallCount: 1,
    abandoned: false,
    researcherEffort: 2,
    researcherTrust: 6,
    quality: {
      unsupportedFinalClaim: false,
      wrongSourceVersionOrCitation: false,
      visualDistortion: false,
      prohibitedAccess: false,
      preapprovalMutation: false
    },
    artifactRefs: ["fixture-crossover-artifact.svg"],
    notes: ["prospective trial fixture"]
  }), "utf8");
  const finished = await scholar.finishProspectiveTrialSession({
    cwd,
    planId: evaluation.plan.planId,
    trialId: trial.protocol.trialId,
    conditionIndex: 0,
    resultPath: trialResultPath
  });
  assertEqual(finished.session.status, "completed", "trial finish completes the session");
  const finishedAgain = await scholar.finishProspectiveTrialSession({
    cwd,
    planId: evaluation.plan.planId,
    trialId: trial.protocol.trialId,
    conditionIndex: 0,
    resultPath: trialResultPath
  });
  assertEqual(
    finishedAgain.observation.observationId,
    finished.observation.observationId,
    "trial finish is idempotent"
  );
  const trialStatus = await scholar.readProspectiveTrialStatus({
    cwd,
    planId: evaluation.plan.planId,
    trialId: trial.protocol.trialId
  });
  assertEqual(trialStatus.nextConditionIndex, 1, "trial status advances to the second condition");
  const cliTrial = JSON.parse(execFileSync("node", [
    cli,
    "scholar-research",
    "trial-create",
    "--cwd", cwd,
    "--config", trialConfigPath,
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  }));
  assertEqual(cliTrial.protocol.createdAt, trial.protocol.createdAt, "CLI trial-create is idempotent");
  const cliSession = JSON.parse(execFileSync("node", [
    cli,
    "scholar-research",
    "trial-start",
    "--cwd", cwd,
    "--plan-id", evaluation.plan.planId,
    "--trial-id", trial.protocol.trialId,
    "--condition-index", "1",
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  }));
  const cliTrialResultPath = join(cwd, "prospective-trial-result-cli.json");
  writeFileSync(cliTrialResultPath, JSON.stringify({
    schema: "longtable.prospective-trial-session-result",
    version: 1,
    acceptedArtifactAt: cliSession.session.startedAt,
    activeHumanMs: 0,
    interruptionCount: 0,
    repeatedQuestionCount: 0,
    contextSwitchCount: 0,
    reworkCount: 0,
    toolCallCount: 1,
    abandoned: false,
    researcherEffort: 2,
    researcherTrust: 6,
    quality: {
      unsupportedFinalClaim: false,
      wrongSourceVersionOrCitation: false,
      visualDistortion: false,
      prohibitedAccess: false,
      preapprovalMutation: false
    },
    artifactRefs: ["fixture-crossover-artifact-cli.svg"],
    notes: ["prospective trial CLI fixture"]
  }), "utf8");
  const cliFinished = JSON.parse(execFileSync("node", [
    cli,
    "scholar-research",
    "trial-finish",
    "--cwd", cwd,
    "--plan-id", evaluation.plan.planId,
    "--trial-id", trial.protocol.trialId,
    "--condition-index", "1",
    "--result", cliTrialResultPath,
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  }));
  assertEqual(cliFinished.session.status, "completed", "CLI trial-finish completes the session");
  const cliStatus = JSON.parse(execFileSync("node", [
    cli,
    "scholar-research",
    "trial-status",
    "--cwd", cwd,
    "--plan-id", evaluation.plan.planId,
    "--trial-id", trial.protocol.trialId,
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? ""
    }
  }));
  assertEqual(cliStatus.nextConditionIndex, null, "CLI trial-status reports a completed pair");
  const evaluationReport = await scholar.writeScholarResearchEvaluationReport({
    cwd,
    planId: evaluation.plan.planId
  });
  assertEqual(evaluationReport.report.prospectiveCount, 3, "prospective observation count");
  assertEqual(evaluationReport.report.matchedProspectivePairs, 1, "complete crossover pair count");
  assertEqual(evaluationReport.report.promotionEligible, false, "one crossover pair cannot promote workflow");
} finally {
  rmSync(cwd, { recursive: true, force: true });
}

const doctor = JSON.parse(execFileSync("node", [
  cli,
  "doctor",
  "--json"
], {
  cwd: repoRoot,
  encoding: "utf8",
  env: {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    LONGTABLE_CONTACT_EMAIL: "researcher@example.test",
    OPENALEX_API_KEY: "test-openalex",
    CORE_API_KEY: "test-core"
  }
}));
assert(doctor.scholarResearch, "doctor should include scholarResearch readiness");
assertEqual(doctor.scholarResearch.safety.paywallBypassAllowed, false, "doctor safety gate");
assert(!doctor.scholarResearch.connectors.some((connector) => connector.name === "Unpaywall"), "doctor should not report Unpaywall readiness");

const roles = personas.listRoleDefinitions();
const codexSkillNames = codex.buildCodexSkillSpecs(roles, "compact").map((skill) => skill.name);
assert(codexSkillNames.includes("longtable-research"), "Codex skill bundle includes longtable-research");
assert(!codexSkillNames.includes("critical-interview"), "Codex skill bundle should not include critical-interview");
const codexScholar = codex.buildCodexSkillSpecs(roles, "compact").find((skill) => skill.name === "longtable-research");
assert(codexScholar.body.join("\n").includes("Do not bypass paywalls"), "Codex longtable-research states safety boundary");

const claudeSkillNames = claude.buildClaudeSkillSpecs(roles, "compact").map((skill) => skill.name);
assert(claudeSkillNames.includes("longtable-research"), "Claude skill bundle includes longtable-research");
assert(!claudeSkillNames.includes("critical-interview"), "Claude skill bundle should not include critical-interview");
const claudeScholar = claude.buildClaudeSkillSpecs(roles, "compact").find((skill) => skill.name === "longtable-research");
assertEqual(claudeScholar.body.join("\n"), codexScholar.body.join("\n"), "Codex and Claude longtable-research semantics match");
assert(codexScholar.body.join("\n").includes("provider-tasks/extract/manifest.json"), "provider skill explains bounded extraction packets");

console.log("scholar research smoke passed");
