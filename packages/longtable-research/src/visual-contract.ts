export const VISUAL_ARTIFACT_KINDS = ["table", "figure", "diagram"] as const;
export type VisualArtifactKind = typeof VISUAL_ARTIFACT_KINDS[number];

export interface JournalVisualExemplar {
  sourceId: string;
  sourceVersion: string;
  accessClass: string;
  pageRenderPath: string;
  page: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  caption: string;
  surroundingContext: string;
  observedPattern: string;
}

export interface VisualGrammar {
  journal: string;
  derivedFrom: JournalVisualExemplar[];
  pageOrColumnWidth: string;
  typography: string[];
  lineAndMarkerRules: string[];
  tableRules: string[];
  captionRules: string[];
  colorPolicy: string;
  notes: string[];
}

export interface VisualEvidenceContract {
  schema: "longtable.visual-evidence-contract";
  version: 1;
  id: string;
  kind: VisualArtifactKind;
  status: "proposed" | "approved" | "rejected";
  analyticalQuestion: string;
  readerTakeaway: string;
  necessity: string;
  manuscriptClaimIds: string[];
  targetJournal: string;
  journalGrammar: VisualGrammar;
  evidenceBoundary: {
    performed: string[];
    proposed: string[];
    prohibitedInferences: string[];
  };
  dataContract: {
    dataSnapshotPath: string;
    unitOfAnalysis: string;
    denominator: string;
    estimandOrConstruct: string;
    uncertainty: string;
    independentUnitField: string;
    repeatedConditionField?: string;
  };
  readingOrder: string[];
  mainTextRole: string;
  supplementRole: string;
  directLabels: boolean;
  redundantEncodingJustification?: string;
  axis?: {
    domain: [number, number];
    transformation?: string;
    truncationJustification?: string;
  };
  output: {
    editableSourceFormat: "svg" | "pdf" | "docx" | "xlsx" | "tex";
    renderer: string;
    rendererVersion: string;
    journalSizedExports: string[];
    placementManifestPath: string;
  };
  readerTest: {
    seconds: 10 | 15 | 20;
    recover: ["question", "denominator", "key_value_or_relation", "conclusion"];
  };
  accessibility?: {
    grayscaleSafe: boolean;
    colorVisionSafe: boolean;
    textAlternative: string;
    minimumFontSizePt: number;
  };
  verificationPlan?: {
    domainMeaning: string;
    statisticalIntegrity: string;
    journalFit: string;
    readerComprehension: string;
  };
  approval?: {
    approvedBy: string;
    approvedAt: string;
    decisionRecordId: string;
  };
}

export interface VisualContractValidation {
  valid: boolean;
  hardFailures: string[];
  warnings: string[];
}

export interface HumanVisualContractReview {
  schema: "longtable.human-visual-contract-review";
  version: 1;
  runId: string;
  reviewer: string;
  reviewedAt: string;
  decisionRecordId: string;
  decision: "approve" | "reject";
  checks: {
    domainMeaning: boolean;
    statisticalIntegrity: boolean;
    journalFit: boolean;
    readerComprehension: boolean;
  };
  rationale: string;
}

export interface HumanRenderedVisualReview {
  schema: "longtable.human-rendered-visual-review";
  version: 1;
  runId: string;
  contractId: string;
  reviewer: string;
  reviewedAt: string;
  decision: "accept" | "reject";
  checks: {
    domainMeaning: boolean;
    statisticalIntegrity: boolean;
    journalFit: boolean;
    readerComprehension: boolean;
  };
  readerTest: {
    seconds: number;
    recoveredQuestion: boolean;
    recoveredDenominator: boolean;
    recoveredKeyValueOrRelation: boolean;
    recoveredConclusion: boolean;
  };
  rationale: string;
}

export interface VisualPortfolioPlan {
  schema: "longtable.visual-portfolio-plan";
  version: 1;
  runId: string;
  portfolioId: string;
  contractIds: string[];
  rationale: string;
  registeredBy: string;
  registeredAt: string;
}

export function validateVisualPortfolioPlan(plan: VisualPortfolioPlan): string[] {
  const errors: string[] = [];
  if (plan.schema !== "longtable.visual-portfolio-plan" || plan.version !== 1) {
    errors.push("Unsupported visual portfolio plan schema or version.");
  }
  for (const [field, value] of [
    ["runId", plan.runId],
    ["portfolioId", plan.portfolioId],
    ["rationale", plan.rationale],
    ["registeredBy", plan.registeredBy],
    ["registeredAt", plan.registeredAt]
  ] as const) {
    if (!value?.trim()) errors.push(`${field} is required.`);
  }
  if (!Number.isFinite(Date.parse(plan.registeredAt))) {
    errors.push("registeredAt must be a valid timestamp.");
  }
  if (!Array.isArray(plan.contractIds) || plan.contractIds.length < 2 ||
      plan.contractIds.some((id) => typeof id !== "string" || !id.trim())) {
    errors.push("A visual portfolio must declare at least two non-empty contract IDs.");
  } else if (new Set(plan.contractIds).size !== plan.contractIds.length) {
    errors.push("Visual portfolio contract IDs must be unique.");
  }
  return errors;
}

export function recommendVisualArtifactKind(input: {
  needsExactLookup: boolean;
  needsPatternComparison: boolean;
  needsProcessOrConceptualRelation: boolean;
}): VisualArtifactKind {
  if (input.needsProcessOrConceptualRelation) return "diagram";
  if (input.needsPatternComparison) return "figure";
  return "table";
}

export function validateVisualEvidenceContract(contract: VisualEvidenceContract): VisualContractValidation {
  const hardFailures: string[] = [];
  const warnings: string[] = [];
  const requiredText: Array<[string, string]> = [
    ["analyticalQuestion", contract.analyticalQuestion],
    ["readerTakeaway", contract.readerTakeaway],
    ["necessity", contract.necessity],
    ["unitOfAnalysis", contract.dataContract.unitOfAnalysis],
    ["denominator", contract.dataContract.denominator],
    ["estimandOrConstruct", contract.dataContract.estimandOrConstruct],
    ["uncertainty", contract.dataContract.uncertainty],
    ["independentUnitField", contract.dataContract.independentUnitField]
  ];
  for (const [field, value] of requiredText) {
    if (!value.trim()) hardFailures.push(`${field} is required.`);
  }
  if (contract.manuscriptClaimIds.length === 0) {
    hardFailures.push("A main-text visual must map to at least one manuscript claim.");
  }
  if (contract.journalGrammar.derivedFrom.length === 0) {
    hardFailures.push("Journal visual grammar requires at least one located exemplar.");
  }
  if (contract.targetJournal.trim() !== contract.journalGrammar.journal.trim()) {
    hardFailures.push("Target journal and journal visual grammar must identify the same venue.");
  }
  for (const exemplar of contract.journalGrammar.derivedFrom) {
    if (!exemplar.sourceId || !exemplar.sourceVersion || !exemplar.accessClass ||
        !exemplar.pageRenderPath || !exemplar.caption || !exemplar.surroundingContext) {
      hardFailures.push(`Journal exemplar ${exemplar.sourceId || "unknown"} lacks provenance or context.`);
    }
    if (!Number.isInteger(exemplar.page) || exemplar.page < 1) {
      hardFailures.push(`Journal exemplar ${exemplar.sourceId || "unknown"} requires a positive page number.`);
    }
    const box = exemplar.boundingBox;
    if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) {
      hardFailures.push(`Journal exemplar ${exemplar.sourceId || "unknown"} requires a finite, positive bounding box.`);
    }
    if (!exemplar.observedPattern.trim()) {
      hardFailures.push(`Journal exemplar ${exemplar.sourceId || "unknown"} requires an observed pattern.`);
    }
  }
  if (contract.evidenceBoundary.performed.length > 0 &&
      contract.evidenceBoundary.proposed.length > 0 &&
      contract.kind === "diagram" &&
      contract.readingOrder.length < 2) {
    hardFailures.push("A diagram mixing performed and proposed content must expose separate reading layers.");
  }
  if (!contract.directLabels && !contract.redundantEncodingJustification) {
    warnings.push("Indirect legend lookup requires an explicit justification.");
  }
  const performed = new Set(contract.evidenceBoundary.performed.map((item) => item.trim().toLocaleLowerCase()));
  if (contract.evidenceBoundary.proposed.some((item) => performed.has(item.trim().toLocaleLowerCase()))) {
    hardFailures.push("Performed and proposed content must not contain the same unlabeled statement.");
  }
  if (contract.kind === "table" && contract.axis) {
    hardFailures.push("A table must not declare a chart axis.");
  }
  if (contract.axis) {
    const [minimum, maximum] = contract.axis.domain;
    if (!(Number.isFinite(minimum) && Number.isFinite(maximum) && minimum < maximum)) {
      hardFailures.push("Axis domain must be finite and increasing.");
    }
    if ((minimum !== 0 || contract.axis.transformation) && !contract.axis.truncationJustification) {
      warnings.push("A transformed or non-zero-baseline axis needs a reader-facing justification.");
    }
  }
  if (contract.status === "approved" && !contract.approval) {
    hardFailures.push("Approved visual contracts require a human approval record.");
  }
  if (contract.status === "approved") {
    if (!contract.accessibility?.grayscaleSafe || !contract.accessibility.colorVisionSafe ||
        !contract.accessibility.textAlternative.trim() ||
        !Number.isFinite(contract.accessibility.minimumFontSizePt) ||
        contract.accessibility.minimumFontSizePt < 7) {
      hardFailures.push("Approved visual contracts require grayscale-safe, color-vision-safe, readable, text-described output.");
    }
    const verification = contract.verificationPlan;
    if (!verification || [
      verification.domainMeaning,
      verification.statisticalIntegrity,
      verification.journalFit,
      verification.readerComprehension
    ].some((item) => !item.trim())) {
      hardFailures.push("Approved visual contracts require separate domain, statistical, journal, and reader verification plans.");
    }
  } else {
    if (!contract.accessibility) warnings.push("Add an accessibility contract before human approval.");
    if (!contract.verificationPlan) warnings.push("Add four-lens human verification before approval.");
  }
  if (contract.output.journalSizedExports.length === 0) {
    hardFailures.push("At least one journal-sized export is required.");
  }
  if (!contract.output.placementManifestPath) {
    hardFailures.push("A placement manifest is required.");
  }
  if (!contract.dataContract.dataSnapshotPath.trim()) {
    hardFailures.push("A versioned data snapshot path is required.");
  }
  if (!contract.output.renderer.trim() || !contract.output.rendererVersion.trim()) {
    hardFailures.push("Renderer identity and version are required.");
  }
  if (!contract.mainTextRole.trim() || !contract.supplementRole.trim()) {
    hardFailures.push("Main-text and supplement roles must both be explicit.");
  }
  if (contract.readingOrder.length === 0 || contract.readingOrder.some((step) => !step.trim())) {
    hardFailures.push("A non-empty reader-facing reading order is required.");
  }
  if (contract.readerTest.recover.join("|") !== "question|denominator|key_value_or_relation|conclusion") {
    hardFailures.push("Reader test must recover question, denominator, key value or relation, and conclusion.");
  }
  if (contract.readingOrder.length > 7 && contract.kind === "diagram") {
    warnings.push("A main-text reader map with more than seven steps should be simplified or moved to the supplement.");
  }
  return { valid: hardFailures.length === 0, hardFailures, warnings };
}
