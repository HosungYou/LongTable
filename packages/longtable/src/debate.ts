import { join } from "node:path";
import type {
  InvocationIntent,
  InvocationRecord,
  PanelPlan,
  PanelVisibility,
  ProviderKind,
  QuestionRecord,
  RoleKey,
  TeamDebateContribution,
  TeamDebateRound,
  TeamDebateRun,
  TeamDebateSynthesis
} from "@longtable/core";
import { buildInvocationIntent, buildPanelPlan } from "./panel.js";
import { getPersonaDefinition, parsePersonaKey } from "./personas.js";
import type { CanonicalPersona } from "./personas.js";

export interface BuildTeamDebateOptions {
  teamId: string;
  teamDir: string;
  prompt: string;
  roleFlag?: string;
  provider?: ProviderKind;
  visibility?: PanelVisibility;
  roundCount?: number;
}

export interface TeamDebateBundle {
  plan: PanelPlan;
  run: TeamDebateRun;
  intent: InvocationIntent;
  invocationRecord: InvocationRecord;
  questionRecord: QuestionRecord;
}

type TeamRunKind = "team" | "debate";

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function signalTags(prompt: string): string[] {
  const normalized = prompt.toLowerCase();
  const tags: string[] = [];
  if (/\bmeasure|\bscale|\bvalid|reliab|측정|척도|타당|신뢰/.test(normalized)) tags.push("measurement");
  if (/\btheor|\bconstruct|\bconcept|이론|개념|구성개념/.test(normalized)) tags.push("theory");
  if (/\bmethod|\bdesign|\bsample|\banalysis|방법|설계|분석|표본/.test(normalized)) tags.push("method");
  if (/\bevidence|\bcitation|\breference|근거|인용|문헌/.test(normalized)) tags.push("evidence");
  if (/\bethic|\birb|consent|윤리|동의/.test(normalized)) tags.push("ethics");
  if (/\bvoice|\bauthor|narrative|저자|서사|문체/.test(normalized)) tags.push("authorship");
  return tags.length > 0 ? tags : ["general"];
}

function roleFocus(role: RoleKey): string {
  const key = parsePersonaKey(role);
  return key ? getPersonaDefinition(key).shortDescription : "Inspect the research decision for hidden risk.";
}

function readableSignals(tags: string[]): string {
  return tags.join(", ");
}

function contribution(options: {
  roundId: string;
  role: RoleKey;
  label: string;
  targetRole?: RoleKey;
  respondsToContributionId?: string;
  stance?: TeamDebateContribution["stance"];
  artifactPath: string;
  summary: string;
  claims: string[];
  objections: string[];
  openQuestions: string[];
  evidenceNeeds: string[];
  tacitAssumptions: string[];
  checkpointTriggers: string[];
}): TeamDebateContribution {
  return {
    id: createId("team_contribution"),
    ...options
  };
}

function independentContribution(roundId: string, plan: PanelPlan, role: RoleKey, label: string, artifactPath: string): TeamDebateContribution {
  const tags = signalTags(plan.prompt);
  return contribution({
    roundId,
    role,
    label,
    artifactPath,
    summary: `${label} independently reviews the prompt for ${readableSignals(tags)} risks before any shared synthesis.`,
    claims: [
      `${label} should preserve a separate judgment lane rather than accepting the first synthesis.`,
      `Primary role focus: ${roleFocus(role)}`
    ],
    objections: [
      "The prompt may hide a commitment that has not yet been named by the researcher.",
      "A fluent answer could collapse measurement, theory, evidence, and authorship concerns into one premature recommendation."
    ],
    openQuestions: [
      "Which decision would become hard to reverse if LongTable proceeded now?",
      "What evidence or researcher preference is still missing?"
    ],
    evidenceNeeds: [
      "Local project state, manuscript/data references, or cited literature should be checked before closure.",
      "If the prompt makes an external claim, attach source links or mark the claim as inference."
    ],
    tacitAssumptions: [
      "The researcher may know constraints not present in the prompt.",
      "The role's critique may over-weight its own domain unless challenged by other roles."
    ],
    checkpointTriggers: tags.map((tag) => `${tag}_commitment`)
  });
}

function crossReviewContribution(
  roundId: string,
  plan: PanelPlan,
  role: RoleKey,
  label: string,
  targetRole: RoleKey,
  targetLabel: string,
  targetContribution: TeamDebateContribution,
  artifactPath: string
): TeamDebateContribution {
  return contribution({
    roundId,
    role,
    label,
    targetRole,
    respondsToContributionId: targetContribution.id,
    stance: "conditional",
    artifactPath,
    summary: `${label} cross-reviews ${targetLabel}'s independent contribution (${targetContribution.id}) before synthesis.`,
    claims: [
      `Responds to ${targetLabel}'s claim: ${targetContribution.claims[0]}`,
      `${targetLabel}'s concern is useful only if it does not erase ${label}'s domain-specific risk.`,
      "The debate should expose disagreement as a researcher decision point rather than normalize it away."
    ],
    objections: [
      `${targetLabel} may be treating its own role priority as the main research problem.`,
      "The prompt still needs a concrete next decision, not only a list of concerns."
    ],
    openQuestions: [
      `What would make ${targetLabel}'s objection decisive rather than advisory?`,
      `What must the researcher answer before ${label} can accept ${targetLabel}'s framing?`
    ],
    evidenceNeeds: [
      "Compare role objections against project state and available artifacts.",
      "Separate source-backed objections from inferred risk."
    ],
    tacitAssumptions: [
      "Roles may disagree because they are protecting different commitments.",
      "The absence of evidence in the prompt is not evidence that the researcher lacks it."
    ],
    checkpointTriggers: ["role_disagreement", "unresolved_gap"]
  });
}

function rebuttalContribution(
  roundId: string,
  role: RoleKey,
  label: string,
  artifactPath: string
): TeamDebateContribution {
  return contribution({
    roundId,
    role,
    label,
    artifactPath,
    summary: `${label} revises its position after cross-review while preserving unresolved risk.`,
    claims: [
      "Some objections should be accepted as constraints, not treated as blockers.",
      "The final synthesis should distinguish actionable next steps from background concern."
    ],
    objections: [
      "A role may over-correct after critique and lose the original high-stakes warning.",
      "Convergence without a checkpoint would turn debate into hidden automation."
    ],
    openQuestions: [
      "Which objection changes the next action?",
      "Which unresolved disagreement should remain visible to the researcher?"
    ],
    evidenceNeeds: [
      "Record which objections were accepted, rejected, or deferred.",
      "Preserve references needed to verify the most consequential claim."
    ],
    tacitAssumptions: [
      "A clean synthesis may be less honest than a visible unresolved tension.",
      "The researcher should own the final prioritization."
    ],
    checkpointTriggers: ["synthesis_boundary", "researcher_authority"]
  });
}

function convergenceContribution(roundId: string, plan: PanelPlan, role: RoleKey, label: string, artifactPath: string): TeamDebateContribution {
  const otherRoles = plan.members.filter((member) => member.role !== role).map((member) => member.label);
  return contribution({
    roundId,
    role,
    label,
    artifactPath,
    summary: `${label} states what it can accept and what must remain open.`,
    claims: [
      `Can accept synthesis if it preserves ${label}'s domain warning.`,
      `Must still show disagreement with: ${otherRoles.join(", ") || "no other roles"}.`
    ],
    objections: [
      "Do not convert unresolved disagreement into a single confident recommendation.",
      "Do not let the coordinator answer the checkpoint on behalf of the researcher."
    ],
    openQuestions: [
      "Which path should LongTable recommend as the next researcher decision?",
      "Which issue should be logged as an open tension if not answered now?"
    ],
    evidenceNeeds: [
      "Link the synthesis back to role contributions and local artifacts.",
      "Mark any missing sources as evidence gaps."
    ],
    tacitAssumptions: [
      "A role's agreement may be conditional.",
      "The researcher may choose to proceed despite unresolved risk."
    ],
    checkpointTriggers: ["panel_next_decision"]
  });
}

function buildSynthesis(plan: PanelPlan, artifactPath: string, kind: TeamRunKind): TeamDebateSynthesis {
  const labels = plan.members.map((member) => member.label);
  const highSensitivity = plan.checkpointSensitivity === "high";
  const runLabel = kind === "debate" ? "debate" : "team review";
  return {
    artifactPath,
    summary: `The ${runLabel} completed across ${labels.join(", ")}. It should slow closure by turning role disagreement into an explicit researcher decision.`,
    consensus: [
      "The researcher should see role disagreement before LongTable drafts, commits, or submits a conclusion.",
      "Evidence gaps and tacit assumptions should remain visible instead of being smoothed into fluent prose."
    ],
    disagreements: [
      "Roles may prioritize different first moves: theory framing, method defensibility, measurement validity, evidence verification, or authorship trace.",
      "The coordinator should not decide which role wins without a researcher checkpoint."
    ],
    unresolvedGaps: [
      "Which role concern is decisive for the next action?",
      "What source, data, or local project artifact should be checked before closure?"
    ],
    researcherDecisionPoints: [
      "Prioritize revision, evidence gathering, proceeding with risk, or keeping the issue open.",
      "Choose whether the debate should affect the current artifact, the research design, or only the decision log."
    ],
    recommendedCheckpoint: highSensitivity
      ? `The ${runLabel} surfaced high-sensitivity disagreement. What should LongTable treat as the next human decision before closure?`
      : `The ${runLabel} surfaced role disagreement. Should LongTable revise, verify evidence, proceed, or keep the tension open?`
  };
}

export function createTeamDebateQuestionRecord(run: TeamDebateRun, provider?: ProviderKind): QuestionRecord {
  const createdAt = nowIso();
  const isDebate = run.interactionDepth === "debated";
  return {
    id: createId("question_record"),
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    prompt: {
      id: createId("question_prompt"),
      checkpointKey: "team_debate_next_decision",
      title: isDebate ? "Team debate follow-up decision" : "Agent team follow-up decision",
      question: run.synthesis.recommendedCheckpoint,
      type: "single_choice",
      options: [
        {
          value: "revise",
          label: "Revise before proceeding",
          description: "Use the debate result to revise the claim, design, or draft first."
        },
        {
          value: "evidence",
          label: "Gather or verify evidence first",
          description: "Check source, data, or local artifact support before proceeding."
        },
        {
          value: "proceed",
          label: "Proceed with current direction",
          description: "Accept the risk profile and continue with the current direction."
        },
        {
          value: "defer",
          label: "Keep this open",
          description: "Do not commit yet; keep the debate issue visible as an open tension."
        }
      ],
      allowOther: true,
      otherLabel: "Other decision",
      required: run.roles.some((member) => {
        const key = parsePersonaKey(member.role);
        return key ? getPersonaDefinition(key).checkpointSensitivity === "high" : false;
      }),
      source: "runtime_guidance",
      displayReason: isDebate
        ? "Role rebuttals and convergence should connect to an explicit researcher decision."
        : "Cross-review created role disagreement that should connect to an explicit researcher decision.",
      rationale: [
        "Agent team orchestration is a research harness surface, not a substitute for researcher judgment.",
        isDebate
          ? "The fixed debate rounds created disagreement that should connect to an explicit researcher decision."
          : "The cross-review round created disagreement that should connect to an explicit researcher decision.",
        `Agent team run: ${run.id}.`
      ],
      preferredSurfaces: provider === "claude"
        ? ["native_structured", "numbered"]
        : ["mcp_elicitation", "numbered"]
    }
  };
}

function buildTeamBundle(options: BuildTeamDebateOptions, kind: TeamRunKind): TeamDebateBundle {
  const roundCount = options.roundCount ?? (kind === "debate" ? 5 : 3);
  const expectedRounds = kind === "debate" ? 5 : 3;
  if (roundCount !== expectedRounds) {
    throw new Error(kind === "debate"
      ? "LongTable debate v1 supports fixed 5-round debate only."
      : "LongTable team v1 supports fixed 3-round cross-review only.");
  }

  const createdAt = nowIso();
  const plan = buildPanelPlan({
    prompt: options.prompt,
    mode: "review",
    roleFlag: options.roleFlag,
    provider: options.provider,
    visibility: options.visibility ?? "always_visible"
  });

  const rounds: TeamDebateRound[] = [];
  const round1Id = createId("team_round");
  const independentContributions = plan.members.map((member) =>
    independentContribution(round1Id, plan, member.role, member.label, join("round-1-independent", `${member.role}.json`))
  );
  rounds.push({
    id: round1Id,
    index: 1,
    kind: "independent_review",
    title: "Independent review",
    status: "completed",
    artifactDir: join(options.teamDir, "round-1-independent"),
    contributions: independentContributions
  });

  const round2Id = createId("team_round");
  const crossContributions = plan.members.flatMap((member) =>
    plan.members
      .filter((target) => target.role !== member.role)
      .map((target) =>
        crossReviewContribution(
          round2Id,
          plan,
          member.role,
          member.label,
          target.role,
          target.label,
          independentContributions.find((contribution) => contribution.role === target.role) as TeamDebateContribution,
          join("round-2-cross-review", `${member.role}-on-${target.role}.json`)
        )
      )
  );
  rounds.push({
    id: round2Id,
    index: 2,
    kind: "cross_review",
    title: "Cross-review",
    status: "completed",
    artifactDir: join(options.teamDir, "round-2-cross-review"),
    contributions: crossContributions
  });

  if (kind === "debate") {
    const round3Id = createId("team_round");
    rounds.push({
      id: round3Id,
      index: 3,
      kind: "rebuttal",
      title: "Rebuttal and revision",
      status: "completed",
      artifactDir: join(options.teamDir, "round-3-rebuttal"),
      contributions: plan.members.map((member) =>
        rebuttalContribution(round3Id, member.role, member.label, join("round-3-rebuttal", `${member.role}.json`))
      )
    });

    const round4Id = createId("team_round");
    rounds.push({
      id: round4Id,
      index: 4,
      kind: "convergence",
      title: "Convergence and unresolved gaps",
      status: "completed",
      artifactDir: join(options.teamDir, "round-4-convergence"),
      contributions: plan.members.map((member) =>
        convergenceContribution(round4Id, plan, member.role, member.label, join("round-4-convergence", `${member.role}.json`))
      )
    });
  }

  const synthesis = buildSynthesis(plan, "synthesis.json", kind);
  const run: TeamDebateRun = {
    id: createId("team_debate_run"),
    teamId: options.teamId,
    createdAt,
    updatedAt: createdAt,
    prompt: options.prompt,
    roles: plan.members,
    status: "completed",
    surface: "file_backed_debate",
    interactionDepth: kind === "debate" ? "debated" : "cross_reviewed",
    roundPolicy: kind === "debate" ? "fixed" : "team_cross_review",
    roundCount,
    artifactRoot: options.teamDir,
    rounds: [
      ...rounds,
      {
        id: createId("team_round"),
        index: roundCount,
        kind: "synthesis",
        title: "Coordinator synthesis and checkpoint",
        status: "completed",
        artifactDir: options.teamDir,
        contributions: []
      }
    ],
    synthesis,
    linkedQuestionRecordIds: []
  };

  const questionRecord = createTeamDebateQuestionRecord(run, options.provider);
  run.linkedQuestionRecordIds = [questionRecord.id];
  const intent = buildInvocationIntent({
    prompt: options.prompt,
    mode: "review",
    roles: plan.members.map((member) => member.role),
    provider: options.provider,
    visibility: plan.visibility,
    checkpointSensitivity: plan.checkpointSensitivity,
    rationale: [
      kind === "debate"
        ? "Autonomous debate requested through LongTable team orchestration."
        : "Agent team cross-review requested through LongTable team orchestration.",
      "File-backed rounds keep disagreement inspectable before researcher closure."
    ]
  });
  intent.kind = kind === "debate" ? "team_debate" : "team";
  intent.requestedSurface = run.surface;

  const invocationRecord: InvocationRecord = {
    id: createId("invocation_record"),
    createdAt,
    updatedAt: createdAt,
    intent,
    status: "completed",
    provider: options.provider,
    surface: run.surface,
    interactionDepth: run.interactionDepth,
    panelPlan: plan,
    teamDebateRun: run,
    degradationReason: "File-backed team artifacts are the canonical execution record."
  };

  return {
    plan,
    run,
    intent,
    invocationRecord,
    questionRecord
  };
}

export function buildTeamReview(options: BuildTeamDebateOptions): TeamDebateBundle {
  return buildTeamBundle(options, "team");
}

export function buildTeamDebate(options: BuildTeamDebateOptions): TeamDebateBundle {
  return buildTeamBundle(options, "debate");
}

export function renderTeamDebateSummary(run: TeamDebateRun): string {
  return [
    "LongTable Team Debate",
    `- team: ${run.teamId}`,
    `- surface: ${run.surface}`,
    `- interaction depth: ${run.interactionDepth}`,
    `- rounds: ${run.roundCount} ${run.roundPolicy}`,
    `- roles: ${run.roles.map((role) => `${role.label} (${role.role})`).join(", ")}`,
    `- artifacts: ${run.artifactRoot}`,
    "",
    run.synthesis.summary,
    "",
    "Researcher checkpoint:",
    `- ${run.synthesis.recommendedCheckpoint}`
  ].join("\n");
}
