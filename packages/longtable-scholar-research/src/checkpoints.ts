import { createHash } from "node:crypto";
import type {
  HardStopScope,
  QuestionCommitmentFamily,
  QuestionEpistemicBasis,
  QuestionOption,
  QuestionPromptType,
  QuestionRecord
} from "@longtable/core";
import type { InstitutionalResearchHardStop, InstitutionalResearchStage } from "./workflow-types.js";

interface CheckpointIdentity {
  readonly runId: string;
  readonly protocolRevisionId?: string;
  readonly protocolReference?: string;
  readonly createdAt?: string;
}

export interface SearchStrategyCheckpointInput extends CheckpointIdentity {
  readonly reviewType: string;
  readonly objective: string;
  readonly databaseGroups: {
    readonly core: readonly string[];
    readonly domain: readonly string[];
    readonly complementary: readonly string[];
    readonly normalization: readonly string[];
    readonly fulltextResolution: readonly string[];
  };
  readonly filters: {
    readonly years?: readonly [number, number];
    readonly languages: readonly string[];
    readonly publicationTypes: readonly string[];
  };
  readonly recallPrecisionPosture: "recall_first" | "balanced" | "precision_first";
  readonly accessLimitations: readonly string[];
}

export interface AvailableDatabase {
  readonly id: string;
  readonly label: string;
  readonly group: "core" | "domain" | "complementary" | "normalization" | "fulltext_resolution";
  readonly available: boolean;
  readonly limitation?: string;
}

export interface DatabaseSelectionCheckpointInput extends CheckpointIdentity {
  readonly availableDatabases: readonly AvailableDatabase[];
  readonly selectedDatabaseIds: readonly string[];
}

export interface PilotFreezeCheckpointInput extends CheckpointIdentity {
  readonly databaseYields: Readonly<Record<string, number>>;
  readonly estimatedOverlap: number;
  readonly missingAbstractRate: number;
  readonly relevanceSample: { readonly relevant: number; readonly reviewed: number };
  readonly resultCaps: readonly string[];
  readonly queryProblems: readonly string[];
  readonly recommendedAmendments: readonly string[];
}

export interface AccessAmbiguityCheckpointInput extends CheckpointIdentity {
  readonly databaseId: string;
  readonly issue: string;
}

export interface FulltextPlanCheckpointInput extends CheckpointIdentity {
  readonly candidateCount: number;
  readonly lawfulRoutes: readonly string[];
  readonly unresolvedCount: number;
}

export interface CorpusFreezeCheckpointInput extends CheckpointIdentity {
  readonly includedCount: number;
  readonly unresolvedCount: number;
}

export interface ScreeningConflictCheckpointInput extends CheckpointIdentity {
  readonly paperIds: readonly string[];
  readonly conflict: string;
}

export interface AnalysisMethodCheckpointInput extends CheckpointIdentity {
  readonly proposedMethod: string;
  readonly rationale: string;
}

export interface ScreeningRuleAmbiguityCheckpointInput extends CheckpointIdentity {
  readonly ruleVersion: string;
  readonly ambiguity: string;
  readonly affectedPaperIds: readonly string[];
}

export interface OperationalHardStopCheckpointInput extends CheckpointIdentity {
  readonly stage: InstitutionalResearchStage;
  readonly code: InstitutionalResearchHardStop;
  readonly issue: string;
  readonly safeCursor: string;
}

interface RequiredCheckpointInput extends CheckpointIdentity {
  readonly stage: string;
  readonly code: string;
  readonly title: string;
  readonly question: string;
  readonly type: QuestionPromptType;
  readonly options: readonly QuestionOption[];
  readonly scope: HardStopScope;
  readonly family: QuestionCommitmentFamily;
  readonly epistemicBasis: QuestionEpistemicBasis;
  readonly displayReason: string;
  readonly rationale: readonly string[];
}

function requiredText(value: string | undefined, label: string): string {
  if (!value?.trim()) {
    throw new Error(`${label} is required for a research checkpoint.`);
  }
  return value.trim();
}

function checkpointReference(input: CheckpointIdentity): string {
  return requiredText(input.protocolRevisionId ?? input.protocolReference, "Protocol reference");
}

export function buildInstitutionalCheckpointKey(
  input: CheckpointIdentity & { readonly stage: string; readonly code: string }
): string {
  return [
    "institutional",
    requiredText(input.runId, "Run ID"),
    checkpointReference(input),
    requiredText(input.stage, "Research stage"),
    requiredText(input.code, "Checkpoint code")
  ].join(":");
}

function stableRecordId(prefix: string, checkpointKey: string): string {
  return `${prefix}_${createHash("sha256").update(checkpointKey).digest("hex").slice(0, 20)}`;
}

function buildRequiredCheckpoint(input: RequiredCheckpointInput): QuestionRecord {
  const checkpointKey = buildInstitutionalCheckpointKey(input);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const recordId = stableRecordId("question_record", checkpointKey);
  return {
    id: recordId,
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    hardStop: true,
    hardStopScope: input.scope,
    commitmentFamily: input.family,
    epistemicBasis: input.epistemicBasis,
    prompt: {
      id: stableRecordId("question_prompt", checkpointKey),
      checkpointKey,
      title: input.title,
      question: input.question,
      type: input.type,
      options: [...input.options],
      allowOther: false,
      required: true,
      source: "checkpoint",
      displayReason: input.displayReason,
      rationale: [...input.rationale],
      preferredSurfaces: ["mcp_elicitation", "numbered"]
    },
    transportStatus: {
      surface: "mcp_elicitation",
      status: "not_attempted",
      updatedAt: createdAt
    }
  };
}

export function buildOperationalHardStopCheckpoint(input: OperationalHardStopCheckpointInput): QuestionRecord {
  return buildRequiredCheckpoint({
    ...input,
    title: `Research hard stop: ${input.code}`,
    question: [
      `Issue: ${requiredText(input.issue, "Hard-stop issue")}`,
      `Last safe cursor: ${requiredText(input.safeCursor, "Safe cursor")}`,
      "No automated action will be taken. Which recorded resolution should authorize a resume?"
    ].join("\n"),
    type: "single_choice",
    options: [
      { value: "researcher_resolved", label: "Researcher resolved", description: "Record the researcher-owned resolution and resume from the safe cursor." },
      { value: "amend_protocol", label: "Amend protocol", description: "Freeze a new protocol revision before resuming." },
      { value: "exclude_route", label: "Exclude route", description: "Exclude the affected database, record, or acquisition route with rationale." },
      { value: "cancel", label: "Keep blocked", description: "Preserve the checkpoint without an implicit decision." }
    ],
    scope: "protected_decision",
    family: "evidence",
    epistemicBasis: "mixed",
    displayReason: "An institutional hard stop requires an explicit researcher resolution.",
    rationale: ["The last safe cursor is preserved.", "A linked DecisionRecord is required before resume."]
  });
}

function groupLine(label: string, values: readonly string[]): string {
  return `${label}: ${values.length > 0 ? values.join(", ") : "none"}`;
}

function listLine(label: string, values: readonly string[]): string {
  return `${label}: ${values.length > 0 ? values.join(", ") : "none"}`;
}

export function buildSearchStrategyCheckpoint(input: SearchStrategyCheckpointInput): QuestionRecord {
  const yearText = input.filters.years ? `${input.filters.years[0]}–${input.filters.years[1]}` : "not limited";
  const question = [
    `Review type: ${input.reviewType}`,
    `Objective: ${input.objective}`,
    groupLine("Core databases", input.databaseGroups.core),
    groupLine("Domain databases", input.databaseGroups.domain),
    groupLine("Complementary databases", input.databaseGroups.complementary),
    groupLine("Normalization", input.databaseGroups.normalization),
    groupLine("Full-text resolution", input.databaseGroups.fulltextResolution),
    `Time: ${yearText}`,
    listLine("Languages", input.filters.languages),
    listLine("Publication types", input.filters.publicationTypes),
    `Recall/precision posture: ${input.recallPrecisionPosture}`,
    listLine("Known access limitations", input.accessLimitations),
    "How should LongTable proceed?"
  ].join("\n");
  return buildRequiredCheckpoint({
    ...input,
    stage: "SETUP",
    code: "SEARCH_STRATEGY",
    title: "Search strategy",
    question,
    type: "single_choice",
    options: [
      { value: "pilot", label: "Run the pilot", description: "Test yield, overlap, missing abstracts, result caps, and relevance before freezing production.", recommended: true },
      { value: "modify_databases", label: "Modify databases", description: "Open a focused multi-select using databases available through the institution profile." },
      { value: "modify_scope", label: "Modify scope", description: "Revise time, language, publication type, or review objective." },
      { value: "open_detailed_wizard", label: "Open detailed wizard", description: "Inspect all strategy fields through progressive disclosure." },
      { value: "cancel", label: "Cancel", description: "Leave the run blocked without an implicit decision." }
    ],
    scope: "method",
    family: "method",
    epistemicBasis: "mixed",
    displayReason: "The database and scope strategy determines the reproducible pilot frame.",
    rationale: ["One compact card is the default researcher surface.", "Production is not authorized by this pilot decision."]
  });
}

export function buildDatabaseSelectionCheckpoint(input: DatabaseSelectionCheckpointInput): QuestionRecord {
  const unavailable = input.availableDatabases.filter((database) => !database.available);
  const options = input.availableDatabases
    .filter((database) => database.available)
    .map((database): QuestionOption => ({
      value: database.id,
      label: database.label,
      description: `${database.group.replaceAll("_", " ")} database exposed by the current profile.`,
      recommended: input.selectedDatabaseIds.includes(database.id)
    }));
  return buildRequiredCheckpoint({
    ...input,
    stage: "SETUP",
    code: "DATABASE_SELECTION",
    title: "Database selection",
    question: `Select the databases for the pilot. Unavailable: ${unavailable.map((database) => `${database.label} (${database.limitation ?? "unavailable"})`).join(", ") || "none"}.`,
    type: "multi_choice",
    options,
    scope: "method",
    family: "method",
    epistemicBasis: "mixed",
    displayReason: "The researcher requested database modification.",
    rationale: ["This multi-select is progressive disclosure after modify_databases, not the default search screen."]
  });
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function buildPilotFreezeCheckpoint(input: PilotFreezeCheckpointInput): QuestionRecord {
  const yields = Object.entries(input.databaseYields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([database, count]) => `${database}: ${count}`)
    .join(", ");
  return buildRequiredCheckpoint({
    ...input,
    stage: "PROTOCOL_CHECKPOINT",
    code: "PILOT_FREEZE",
    title: "Pilot results and production freeze",
    question: [
      `Database yields: ${yields || "none"}`,
      `Estimated overlap: ${percent(input.estimatedOverlap)}`,
      `Missing-abstract rate: ${percent(input.missingAbstractRate)}`,
      `Relevance sample: ${input.relevanceSample.relevant}/${input.relevanceSample.reviewed}`,
      listLine("Result caps", input.resultCaps),
      listLine("Query problems", input.queryProblems),
      listLine("Recommended amendments", input.recommendedAmendments),
      "Freeze this revision for production or revise it?"
    ].join("\n"),
    type: "single_choice",
    options: [
      { value: "freeze_production_protocol", label: "Freeze for production", description: "Make database, query, filter, language, time, and result handling immutable for this revision.", recommended: true },
      { value: "revise_protocol", label: "Revise protocol", description: "Create a material amendment and rerun the pilot checkpoint." },
      { value: "cancel", label: "Cancel", description: "Keep production blocked." }
    ],
    scope: "method",
    family: "method",
    epistemicBasis: "mixed",
    displayReason: "Production cannot begin until the pilot evidence is reviewed and the protocol is frozen.",
    rationale: ["Pilot artifacts remain separate from the production corpus."]
  });
}

export function buildAccessAmbiguityCheckpoint(input: AccessAmbiguityCheckpointInput): QuestionRecord {
  return buildRequiredCheckpoint({
    ...input,
    stage: "PRODUCTION_SEARCH",
    code: "TERMS_OR_ACCESS_UNCLEAR",
    title: "Access or terms clarification",
    question: `${input.databaseId} reported an access or terms ambiguity: ${input.issue}`,
    type: "single_choice",
    options: [
      { value: "researcher_reviewed_and_permitted", label: "Reviewed and permitted", description: "Continue only after the researcher confirms the lawful route." },
      { value: "use_metadata_only", label: "Use metadata only", description: "Do not attempt licensed full-text acquisition." },
      { value: "suspend", label: "Suspend", description: "Keep the run blocked." }
    ],
    scope: "evidence",
    family: "evidence",
    epistemicBasis: "researcher_knowledge",
    displayReason: "LongTable must not infer access rights or terms acceptance.",
    rationale: ["Credentials and browser session material are never requested or persisted."]
  });
}

export function buildFulltextPlanCheckpoint(input: FulltextPlanCheckpointInput): QuestionRecord {
  return buildRequiredCheckpoint({
    ...input,
    stage: "FULLTEXT_PLAN_CHECKPOINT",
    code: "FULLTEXT_PLAN",
    title: "Full-text acquisition plan",
    question: `${input.candidateCount} records need full-text resolution through ${input.lawfulRoutes.join(", ") || "no configured route"}; ${input.unresolvedCount} currently have no route.`,
    type: "single_choice",
    options: [
      { value: "approve_lawful_routes", label: "Approve lawful routes", description: "Acquire only permitted PDFs into Research PDF Vault.", recommended: true },
      { value: "modify_routes", label: "Modify routes", description: "Change resolver or manual-action handling." },
      { value: "suspend", label: "Suspend", description: "Keep acquisition blocked." }
    ],
    scope: "evidence",
    family: "evidence",
    epistemicBasis: "mixed",
    displayReason: "Potential-inclusion records are screened before PDF acquisition.",
    rationale: ["Research PDF Vault is the only canonical PDF store."]
  });
}

export function buildCorpusFreezeCheckpoint(input: CorpusFreezeCheckpointInput): QuestionRecord {
  return buildRequiredCheckpoint({
    ...input,
    stage: "CORPUS_FREEZE_CHECKPOINT",
    code: "CORPUS_FREEZE_REQUIRED",
    title: "Corpus freeze",
    question: `${input.includedCount} studies are included and ${input.unresolvedCount} remain unresolved. Freeze the corpus for analysis?`,
    type: "single_choice",
    options: [
      { value: "freeze_corpus", label: "Freeze corpus", description: "Authorize analysis using the recorded included set.", recommended: input.unresolvedCount === 0 },
      { value: "resolve_remaining", label: "Resolve remaining records", description: "Return to full-text screening." },
      { value: "revise_screening_rules", label: "Revise screening rules", description: "Create a material protocol amendment before rescreening." }
    ],
    scope: "evidence",
    family: "evidence",
    epistemicBasis: "mixed",
    displayReason: "Analysis requires an explicit, auditable corpus commitment.",
    rationale: ["No unresolved record is silently dropped."]
  });
}

export function buildScreeningConflictCheckpoint(input: ScreeningConflictCheckpointInput): QuestionRecord {
  return buildRequiredCheckpoint({
    ...input,
    stage: "FULLTEXT_SCREENING",
    code: "HUMAN_AI_SCREENING_CONFLICT",
    title: "Screening conflict",
    question: `${input.conflict}. Affected records: ${input.paperIds.join(", ")}.`,
    type: "single_choice",
    options: [
      { value: "open_adjudication", label: "Open adjudication", description: "Review the evidence and write a new human adjudication decision.", recommended: true },
      { value: "revise_rule", label: "Revise screening rule", description: "Create a protocol amendment before applying a changed rule." },
      { value: "suspend", label: "Suspend", description: "Keep affected records unresolved." }
    ],
    scope: "construct",
    family: "coding",
    epistemicBasis: "mixed",
    displayReason: "Human–AI disagreement cannot be resolved by an implicit model default.",
    rationale: ["Repeated conflicts are bundled into one researcher checkpoint."]
  });
}

export function buildAnalysisMethodCheckpoint(input: AnalysisMethodCheckpointInput): QuestionRecord {
  return buildRequiredCheckpoint({
    ...input,
    stage: "ANALYSIS",
    code: "ANALYSIS_METHOD_CHANGE",
    title: "Analysis-method commitment",
    question: `Proposed method: ${input.proposedMethod}. Rationale: ${input.rationale}.`,
    type: "single_choice",
    options: [
      { value: "approve_method", label: "Approve method", description: "Record the method commitment and continue.", recommended: true },
      { value: "revise_method", label: "Revise method", description: "Return to the analysis plan without changing the frozen corpus." },
      { value: "cancel", label: "Cancel", description: "Keep analysis blocked." }
    ],
    scope: "method",
    family: "method",
    epistemicBasis: "mixed",
    displayReason: "Analysis-model selection is a protected researcher decision.",
    rationale: ["The renderer cannot claim an unapproved analysis."]
  });
}

export function buildScreeningRuleAmbiguityCheckpoint(
  input: ScreeningRuleAmbiguityCheckpointInput
): QuestionRecord {
  return buildRequiredCheckpoint({
    ...input,
    stage: "TITLE_ABSTRACT_SCREENING",
    code: "SCREENING_RULE_AMBIGUOUS",
    title: "Screening-rule ambiguity",
    question: `Rule ${input.ruleVersion} is ambiguous: ${input.ambiguity}. Affected records: ${[...input.affectedPaperIds].sort().join(", ")}.`,
    type: "single_choice",
    options: [
      { value: "clarify_rule", label: "Clarify rule", description: "Create a versioned rule clarification before screening affected records.", recommended: true },
      { value: "open_record_review", label: "Review affected records", description: "Inspect the evidence without silently changing the rule." },
      { value: "suspend", label: "Suspend", description: "Keep affected records pending." }
    ],
    scope: "construct",
    family: "coding",
    epistemicBasis: "mixed",
    displayReason: "An ambiguous inclusion or exclusion rule can change the final corpus.",
    rationale: ["Affected records remain pending until the researcher records a decision."]
  });
}
