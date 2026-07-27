import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  renderVisualArtifact,
  type VisualRenderManifest,
  type MechanicalVisualQa
} from "./render.js";
import {
  validateVisualEvidenceContract,
  type HumanRenderedVisualReview,
  type JournalVisualExemplar,
  type VisualEvidenceContract
} from "./visual-contract.js";

export const PAPER_B_REPLAY_THREAD_ID = "019f56ab-4f4e-7f13-9bc0-8c8d15966e0d";

const RELATIVE = {
  contract: "01_epr/EPR_HUMAN_READER_FIGURE_CHART_CONTRACT_20260713.md",
  debrief: "01_epr/EPR_HUMAN_READER_FIGURE_DEBRIEF_20260727.md",
  journal: "01_epr/EPR_TARGET_JOURNAL_CONTRACT_20260712.md",
  qa: "03_qa/epr_human_reader_figure_qa_20260713.json",
  reportEvidence: "01_epr/evidence/figure_source_data_20260713/epr_figure_7_report_evidence_source_data_20260713.csv"
} as const;

const FIGURE_7_EXPECTED = [
  { panel: "Validation safeguards", field: "complete_denominator", label: "Complete denominator", count: 110 },
  { panel: "Validation safeguards", field: "uncertainty_reported", label: "Uncertainty reported", count: 73 },
  { panel: "Validation safeguards", field: "heldout_temporal_external_scope", label: "Held-out / temporal / external", count: 85 },
  { panel: "Validation safeguards", field: "repeatability_design", label: "Repeatability design", count: 64 },
  { panel: "Validation safeguards", field: "source_trace_checked", label: "Source trace checked", count: 24 },
  { panel: "Validation safeguards", field: "typed_or_source_located_errors", label: "Typed / source-located errors", count: 90 },
  { panel: "Validation safeguards", field: "contamination_or_leakage_proxy", label: "Contamination / leakage proxy", count: 52 },
  { panel: "Evidence reporting—not prevalence", field: "omission_reporting", label: "Omission", count: 11 },
  { panel: "Evidence reporting—not prevalence", field: "incorrect_reporting", label: "Incorrect output", count: 21 },
  { panel: "Evidence reporting—not prevalence", field: "unsupported_reporting", label: "Unsupported output", count: 13 },
  { panel: "Evidence reporting—not prevalence", field: "unresolved_reporting", label: "Unresolved output", count: 2 },
  { panel: "Evidence reporting—not prevalence", field: "correction_reporting", label: "Correction / escalation", count: 28 },
  { panel: "Evidence reporting—not prevalence", field: "repeatability_result_reporting", label: "Repeatability results", count: 57 }
] as const;

interface ReplayExemplarManifest {
  schema: "longtable.journal-visual-exemplar-manifest";
  version: 1;
  journal: string;
  exemplars: JournalVisualExemplar[];
}

export interface PaperBReplayResult {
  schema: "longtable.paper-b-replay-result";
  version: 1;
  threadId: typeof PAPER_B_REPLAY_THREAD_ID;
  posture: "replay_only";
  sourceRoot: string;
  outputDirectory: string;
  executedAt: string;
  sourceArtifacts: Array<{ role: string; path: string; bytes: number; sha256: string }>;
  corpus: {
    reportRows: number;
    expectedReportRows: 148;
    exact: boolean;
  };
  figure7: Array<{
    panel: string;
    field: string;
    label: string;
    observed: number;
    expected: number;
    exact: boolean;
  }>;
  decisionRecovery: Record<string, boolean | "not_applicable">;
  priorQaAssertionsPassed: boolean;
  journalExemplarGate: {
    supplied: boolean;
    valid: boolean;
    count: number;
    hardFailures: string[];
  };
  visualContractValidation?: ReturnType<typeof validateVisualEvidenceContract>;
  render?: {
    manifestPath: string;
    manifest: VisualRenderManifest;
    qaPath: string;
    qa: MechanicalVisualQa;
  };
  replayMechanicsPassed: boolean;
  humanRenderGate: {
    supplied: boolean;
    valid: boolean;
    reviewPath?: string;
    failures: string[];
  };
  qualityGatePassed: boolean;
  interpretation: string;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (quoted) throw new Error("Unterminated quoted field in replay CSV.");
  return rows.filter((entry) => entry.some((value) => value.length > 0));
}

function recordsFromCsv(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text);
  const headers = rows.shift();
  if (!headers) return [];
  return rows.map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""])
  ));
}

function truthy(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

async function artifact(role: string, path: string): Promise<{ role: string; path: string; bytes: number; sha256: string; content: Buffer }> {
  const content = await readFile(path);
  const metadata = await stat(path);
  return { role, path, bytes: metadata.size, sha256: sha256(content), content };
}

function recoverDecisions(contract: string, debrief: string): Record<string, boolean | "not_applicable"> {
  const text = `${contract}\n${debrief}`;
  return {
    oneFigureOneQuestionOneSentence: /one figure,\s*one analytical question,\s*one sentence/i.test(text),
    noPooling: /no pooled estimates|no mean,\s*median,\s*pooled estimate/i.test(text),
    reportEstimandGrain: /strict report[–-]estimand row/i.test(text),
    performedProposedBoundary: "not_applicable",
    mainVersusSupplement: /main-reader layer[\s\S]*audit-completeness layer/i.test(text),
    exactDenominator: /n\/148/i.test(text),
    evidenceFirstOrdering: /evidence-first|never by performance/i.test(text),
    observedRangeNotCi: /observed range[—-]not ci/i.test(text),
    separateEstimands: /remain separate|distinct evidence bases/i.test(text),
    timedReaderTest: /10[–-]20 second|ten-to-twenty-second/i.test(text)
  };
}

function exemplarFailures(manifest: ReplayExemplarManifest | undefined): string[] {
  if (!manifest) return ["No located target-journal visual exemplar manifest was supplied."];
  const failures: string[] = [];
  if (manifest.schema !== "longtable.journal-visual-exemplar-manifest" ||
      manifest.version !== 1 ||
      manifest.journal !== "Educational Psychology Review") {
    failures.push("Exemplar manifest schema, version, or journal is invalid.");
  }
  if (!Array.isArray(manifest.exemplars) || manifest.exemplars.length === 0) {
    failures.push("At least one located target-journal exemplar is required.");
  }
  for (const exemplar of manifest.exemplars ?? []) {
    if (!exemplar.sourceId || !exemplar.sourceVersion || !exemplar.accessClass ||
        !exemplar.pageRenderPath || !Number.isInteger(exemplar.page) || exemplar.page < 1 ||
        !exemplar.caption || !exemplar.surroundingContext || !exemplar.observedPattern ||
        !Number.isFinite(exemplar.boundingBox.x) || !Number.isFinite(exemplar.boundingBox.y) ||
        !Number.isFinite(exemplar.boundingBox.width) || exemplar.boundingBox.width <= 0 ||
        !Number.isFinite(exemplar.boundingBox.height) || exemplar.boundingBox.height <= 0) {
      failures.push(`Exemplar ${exemplar.sourceId || "unknown"} lacks required provenance or location.`);
    }
  }
  return failures;
}

export async function runPaperBReplay(input: {
  sourceRoot: string;
  outputDirectory: string;
  exemplarManifestPath?: string;
  humanReviewPath?: string;
}): Promise<{ result: PaperBReplayResult; resultPath: string; snapshotPath: string }> {
  const sourceRoot = resolve(input.sourceRoot);
  const outputDirectory = resolve(input.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });
  const paths = Object.fromEntries(
    Object.entries(RELATIVE).map(([key, relative]) => [key, join(sourceRoot, relative)])
  ) as Record<keyof typeof RELATIVE, string>;
  const sourceArtifactsWithContent = await Promise.all([
    artifact("visual-contract", paths.contract),
    artifact("human-reader-debrief", paths.debrief),
    artifact("target-journal-contract", paths.journal),
    artifact("prior-qa", paths.qa),
    artifact("figure-7-report-evidence", paths.reportEvidence)
  ]);
  const byRole = new Map(sourceArtifactsWithContent.map((entry) => [entry.role, entry]));
  const contractText = byRole.get("visual-contract")!.content.toString("utf8");
  const debriefText = byRole.get("human-reader-debrief")!.content.toString("utf8");
  const qa = JSON.parse(byRole.get("prior-qa")!.content.toString("utf8")) as {
    assertions?: Record<string, boolean>;
  };
  const records = recordsFromCsv(byRole.get("figure-7-report-evidence")!.content.toString("utf8"));
  const figure7 = FIGURE_7_EXPECTED.map((expected) => {
    const observed = records.filter((record) => truthy(record[expected.field] ?? "")).length;
    return { ...expected, observed, expected: expected.count, exact: observed === expected.count };
  });
  const snapshot = figure7.map((entry) => ({
    panel: entry.panel,
    feature: entry.label,
    reports: entry.observed,
    denominator: records.length
  }));
  const snapshotPath = join(outputDirectory, "paper-b-figure-7-replay-data.json");
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  let exemplarManifest: ReplayExemplarManifest | undefined;
  if (input.exemplarManifestPath) {
    exemplarManifest = JSON.parse(
      await readFile(resolve(input.exemplarManifestPath), "utf8")
    ) as ReplayExemplarManifest;
  }
  const exemplarHardFailures = exemplarFailures(exemplarManifest);
  const decisionRecovery = recoverDecisions(contractText, debriefText);
  const priorQaAssertionsPassed = Boolean(qa.assertions) &&
    Object.values(qa.assertions ?? {}).every((value) => value === true);
  let visualContractValidation: ReturnType<typeof validateVisualEvidenceContract> | undefined;
  let render: PaperBReplayResult["render"];
  let renderedContract: VisualEvidenceContract | undefined;
  if (exemplarManifest && exemplarHardFailures.length === 0) {
    const visualContract: VisualEvidenceContract = {
      schema: "longtable.visual-evidence-contract",
      version: 1,
      id: "paper-b-epr-figure-7-replay",
      kind: "figure",
      status: "approved",
      analyticalQuestion: "Which validation safeguards and source-mappable reporting categories are present across the 148-report corpus?",
      readerTakeaway: "Coverage is uneven, and reporting counts indicate evidence presence rather than error prevalence.",
      necessity: "Two ranked corpus-wide displays expose exact denominators without giving small stage cells equal visual weight.",
      manuscriptClaimIds: ["paper-b-figure-7-main-claim"],
      targetJournal: exemplarManifest.journal,
      journalGrammar: {
        journal: exemplarManifest.journal,
        derivedFrom: exemplarManifest.exemplars,
        pageOrColumnWidth: "full-width",
        typography: ["Arial or Helvetica", "8–12 pt at final size"],
        lineAndMarkerRules: ["grayscale-safe", "direct labels", "no color-only meaning"],
        tableRules: [],
        captionRules: ["caption outside artwork", "state evidence presence is not prevalence"],
        colorPolicy: "grayscale",
        notes: ["Replay recovers the approved Figure 7 decision; it does not constitute holdout evidence."]
      },
      evidenceBoundary: {
        performed: ["Frozen report-level coding and exact corpus counts"],
        proposed: [],
        prohibitedInferences: ["Error prevalence", "Event prevalence", "Causal effects"]
      },
      dataContract: {
        dataSnapshotPath: snapshotPath,
        unitOfAnalysis: "included report",
        denominator: "all 148 included reports",
        estimandOrConstruct: "presence of coded safeguard or source-mappable reporting evidence",
        uncertainty: "exact corpus count; no sampling interval",
        independentUnitField: "study_id"
      },
      readingOrder: ["question", "panel", "exact n/148 label", "prohibited prevalence inference"],
      mainTextRole: "Corpus-wide evidence hierarchy and exact denominator",
      supplementRole: "Stage-specific n/N and complete report-level evidence matrix",
      directLabels: true,
      axis: { domain: [0, 148] },
      output: {
        editableSourceFormat: "svg",
        renderer: "longtable-svg-v1",
        rendererVersion: "1",
        journalSizedExports: ["paper-b-epr-figure-7-replay.svg"],
        placementManifestPath: "placement.json"
      },
      readerTest: {
        seconds: 20,
        recover: ["question", "denominator", "key_value_or_relation", "conclusion"]
      },
      accessibility: {
        grayscaleSafe: true,
        colorVisionSafe: true,
        textAlternative: "Two groups of directly labeled bars show how many of 148 reports contain each safeguard or reporting category.",
        minimumFontSizePt: 8
      },
      verificationPlan: {
        domainMeaning: "Confirm counts mean evidence presence rather than event or error prevalence.",
        statisticalIntegrity: "Recompute all 13 numerators from the frozen 148-report matrix.",
        journalFit: "Check full-width size, typography, captions, and grayscale against located exemplars.",
        readerComprehension: "Test recovery of question, 148-report denominator, uneven coverage, and prohibited prevalence inference within 20 seconds."
      },
      approval: {
        approvedBy: "Paper B replay of prior human decisions",
        approvedAt: new Date().toISOString(),
        decisionRecordId: `replay-${PAPER_B_REPLAY_THREAD_ID}`
      }
    };
    renderedContract = visualContract;
    visualContractValidation = validateVisualEvidenceContract(visualContract);
    if (visualContractValidation.valid) {
      const rendered = await renderVisualArtifact({
        runDir: outputDirectory,
        contract: visualContract,
        request: {
          schema: "longtable.visual-render-request",
          version: 1,
          runId: `replay-${PAPER_B_REPLAY_THREAD_ID}`,
          contractId: visualContract.id,
          renderer: "longtable-svg-v1",
          widthPx: 920,
          heightPx: 560,
          specification: {
            kind: "figure",
            mark: "bar",
            orientation: "horizontal",
            xField: "feature",
            yField: "reports",
            seriesField: "panel",
            denominatorField: "denominator",
            directLabel: "fraction_percent",
            xLabel: "Evidence category",
            yLabel: "Reports with evidence"
          }
        }
      });
      render = {
        manifestPath: rendered.manifestPath,
        manifest: rendered.manifest,
        qaPath: rendered.qaPath,
        qa: rendered.qa
      };
    }
  }
  const sourceArtifacts = sourceArtifactsWithContent.map(({ content: _content, ...entry }) => entry);
  const corpusExact = records.length === 148;
  const decisionsExact = Object.values(decisionRecovery).every(
    (value) => value === true || value === "not_applicable"
  );
  const countsExact = figure7.every((entry) => entry.exact);
  const replayMechanicsPassed = corpusExact && decisionsExact && countsExact &&
    priorQaAssertionsPassed && exemplarHardFailures.length === 0 &&
    visualContractValidation?.valid === true && render?.qa.passed === true;
  const humanFailures: string[] = [];
  let humanReview: HumanRenderedVisualReview | undefined;
  if (input.humanReviewPath) {
    humanReview = JSON.parse(
      await readFile(resolve(input.humanReviewPath), "utf8")
    ) as HumanRenderedVisualReview;
    if (humanReview.schema !== "longtable.human-rendered-visual-review" ||
        humanReview.version !== 1 ||
        humanReview.runId !== `replay-${PAPER_B_REPLAY_THREAD_ID}` ||
        humanReview.contractId !== renderedContract?.id ||
        humanReview.decision !== "accept" ||
        !humanReview.reviewer?.trim() || !humanReview.reviewedAt ||
        !humanReview.rationale?.trim()) {
      humanFailures.push("Human replay review schema, identity, decision, or rationale is invalid.");
    }
    const humanChecks = Object.values(humanReview.checks ?? {});
    if (humanChecks.length !== 4 || humanChecks.some((value) => value !== true)) {
      humanFailures.push("All four human verification lenses must pass.");
    }
    const readerValues = humanReview.readerTest
      ? [
          humanReview.readerTest.recoveredQuestion,
          humanReview.readerTest.recoveredDenominator,
          humanReview.readerTest.recoveredKeyValueOrRelation,
          humanReview.readerTest.recoveredConclusion
        ]
      : [];
    if (readerValues.length !== 4 || readerValues.some((value) => value !== true) ||
        !humanReview.readerTest || humanReview.readerTest.seconds <= 0 ||
        humanReview.readerTest.seconds > (renderedContract?.readerTest.seconds ?? 20)) {
      humanFailures.push("The timed reader test did not recover all four required elements within the contract threshold.");
    }
  } else {
    humanFailures.push("The newly rendered replay artifact has not received a human rendered-visual review.");
  }
  const humanRenderGate = {
    supplied: Boolean(humanReview),
    valid: Boolean(humanReview) && humanFailures.length === 0,
    ...(input.humanReviewPath ? { reviewPath: resolve(input.humanReviewPath) } : {}),
    failures: humanFailures
  };
  const qualityGatePassed = replayMechanicsPassed && humanRenderGate.valid;
  const result: PaperBReplayResult = {
    schema: "longtable.paper-b-replay-result",
    version: 1,
    threadId: PAPER_B_REPLAY_THREAD_ID,
    posture: "replay_only",
    sourceRoot,
    outputDirectory,
    executedAt: new Date().toISOString(),
    sourceArtifacts,
    corpus: { reportRows: records.length, expectedReportRows: 148, exact: corpusExact },
    figure7,
    decisionRecovery,
    priorQaAssertionsPassed,
    journalExemplarGate: {
      supplied: Boolean(exemplarManifest),
      valid: exemplarHardFailures.length === 0,
      count: exemplarManifest?.exemplars.length ?? 0,
      hardFailures: exemplarHardFailures
    },
    ...(visualContractValidation ? { visualContractValidation } : {}),
    ...(render ? { render } : {}),
    replayMechanicsPassed,
    humanRenderGate,
    qualityGatePassed,
    interpretation: qualityGatePassed
      ? "The frozen case reproduced its approved Figure 7 decision and exact counts. This is replay evidence only, not a holdout or prospective productivity result."
      : replayMechanicsPassed
        ? "The frozen decisions, exact counts, journal exemplars, render, and mechanical QA reproduced, but the new rendered artifact still requires human review. This remains replay evidence only."
        : "The replay recovered available decisions and counts but did not pass every non-compensatory mechanical gate; inspect the recorded failures."
  };
  const resultPath = join(outputDirectory, "paper-b-replay-result.json");
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return { result, resultPath, snapshotPath };
}
