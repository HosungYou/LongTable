import type {
  CheckpointSensitivity,
  InteractionMode,
  InvocationIntent,
  InvocationRecord,
  PanelMember,
  PanelPlan,
  PanelResult,
  PanelVisibility,
  QuestionRecord,
  ProviderKind,
  RoleKey
} from "@longtable/core";
import {
  getPersonaDefinition,
  parsePersonaKey,
  PERSONA_DEFINITIONS,
  type CanonicalPersona
} from "./personas.js";
import { detectOutputLanguage, parseRoleFlag, routePersonas, type OutputLanguage } from "./persona-router.js";

export interface BuildPanelPlanOptions {
  prompt: string;
  mode?: InteractionMode;
  roleFlag?: string;
  roles?: CanonicalPersona[];
  provider?: ProviderKind;
  visibility?: PanelVisibility;
}

export interface PanelFallback {
  intent: InvocationIntent;
  plan: PanelPlan;
  result: PanelResult;
  invocationRecord: InvocationRecord;
  questionRecord: QuestionRecord;
  prompt: string;
}

const DEFAULT_PANEL_ROLES: CanonicalPersona[] = [
  "reviewer",
  "methods_critic",
  "measurement_auditor",
  "theory_critic"
];

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function highestSensitivity(keys: CanonicalPersona[]): CheckpointSensitivity {
  if (keys.some((key) => getPersonaDefinition(key).checkpointSensitivity === "high")) {
    return "high";
  }
  if (keys.some((key) => getPersonaDefinition(key).checkpointSensitivity === "medium")) {
    return "medium";
  }
  return "low";
}

function supportsMode(key: CanonicalPersona, mode: InteractionMode): boolean {
  return getPersonaDefinition(key).supportedModes.includes(mode);
}

function reasonForRole(
  key: CanonicalPersona,
  explicitRoles: CanonicalPersona[],
  routedRoles: CanonicalPersona[]
): string {
  if (explicitRoles.includes(key)) {
    return "explicitly requested";
  }
  if (routedRoles.includes(key)) {
    return "matched prompt language";
  }
  if (DEFAULT_PANEL_ROLES.includes(key)) {
    return "default panel member";
  }
  return "panel support role";
}

function resolvePanelRoles(options: BuildPanelPlanOptions): CanonicalPersona[] {
  const mode = options.mode ?? "review";
  const explicitFromFlag = parseRoleFlag(options.roleFlag);
  const explicitRoles = unique([...(options.roles ?? []), ...explicitFromFlag]);

  if (explicitRoles.length > 0) {
    return explicitRoles.filter((role) => supportsMode(role, mode));
  }

  const routed = routePersonas(options.prompt).consultedRoles.filter((role) => supportsMode(role, mode));
  return unique([
    ...DEFAULT_PANEL_ROLES.filter((role) => supportsMode(role, mode)),
    ...routed
  ]);
}

function memberForRole(
  role: CanonicalPersona,
  explicitRoles: CanonicalPersona[],
  routedRoles: CanonicalPersona[]
): PanelMember {
  const definition = getPersonaDefinition(role);
  return {
    role,
    label: definition.label,
    reason: reasonForRole(role, explicitRoles, routedRoles),
    required: DEFAULT_PANEL_ROLES.includes(role) || explicitRoles.includes(role)
  };
}

export function buildPanelPlan(options: BuildPanelPlanOptions): PanelPlan {
  const mode = options.mode ?? "review";
  const explicitRoles = unique([...(options.roles ?? []), ...parseRoleFlag(options.roleFlag)]);
  const routedRoles = routePersonas(options.prompt).consultedRoles;
  const roles = resolvePanelRoles(options);
  const createdAt = nowIso();

  return {
    id: createId("panel_plan"),
    createdAt,
    mode,
    prompt: options.prompt,
    members: roles.map((role) => memberForRole(role, explicitRoles, routedRoles)),
    visibility: options.visibility ?? "always_visible",
    preferredSurface: "sequential_fallback",
    fallbackSurface: "sequential_fallback",
    checkpointSensitivity: highestSensitivity(roles),
    rationale: [
      "Option A uses provider-neutral panel semantics before native provider orchestration.",
      "Sequential fallback is the stable execution path for both Claude Code and Codex.",
      roles.length === explicitRoles.length && explicitRoles.length > 0
        ? "The panel is constrained by explicitly requested roles."
        : "The panel combines default research-review roles with prompt-triggered roles."
    ]
  };
}

export function buildInvocationIntent(options: {
  prompt: string;
  mode?: InteractionMode;
  roles: RoleKey[];
  provider?: ProviderKind;
  visibility?: PanelVisibility;
  checkpointSensitivity?: CheckpointSensitivity;
  rationale?: string[];
}): InvocationIntent {
  return {
    id: createId("invocation"),
    kind: "panel",
    mode: options.mode ?? "review",
    prompt: options.prompt,
    roles: options.roles,
    provider: options.provider,
    requestedSurface: "sequential_fallback",
    visibility: options.visibility ?? "always_visible",
    checkpointSensitivity: options.checkpointSensitivity ?? "medium",
    rationale: options.rationale ?? ["Panel invocation requested."]
  };
}

export function createPlannedPanelQuestionRecord(
  plan: PanelPlan,
  provider?: ProviderKind
): QuestionRecord {
  const createdAt = nowIso();
  return {
    id: createId("question_record"),
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    prompt: {
      id: createId("question_prompt"),
      checkpointKey: "panel_next_decision",
      title: "Panel follow-up decision",
      question: "What should LongTable treat as the next human decision after this panel review?",
      type: "single_choice",
      options: [
        {
          value: "revise",
          label: "Revise before proceeding",
          description: "Use the panel result to revise the claim, design, or draft first."
        },
        {
          value: "evidence",
          label: "Gather or verify evidence first",
          description: "Do not proceed until the relevant evidence or citation support is checked."
        },
        {
          value: "proceed",
          label: "Proceed with current direction",
          description: "Accept the risk profile and continue with the current direction."
        },
        {
          value: "defer",
          label: "Keep this open",
          description: "Do not commit yet; keep the panel issue visible as an open tension."
        }
      ],
      allowOther: true,
      otherLabel: "Other decision",
      required: plan.checkpointSensitivity === "high",
      source: "runtime_guidance",
      rationale: [
        "Panel review creates disagreement or risk visibility that should connect to an explicit researcher decision.",
        `Panel checkpoint sensitivity: ${plan.checkpointSensitivity}.`
      ],
      preferredSurfaces: provider === "claude"
        ? ["native_structured", "numbered"]
        : ["mcp_elicitation", "numbered"]
    }
  };
}

export function createPlannedPanelResult(
  plan: PanelPlan,
  provider?: ProviderKind,
  linkedQuestionRecordIds: string[] = []
): PanelResult {
  const createdAt = nowIso();
  return {
    id: createId("panel_result"),
    planId: plan.id,
    createdAt,
    updatedAt: createdAt,
    provider,
    surface: "sequential_fallback",
    status: "planned",
    memberResults: plan.members.map((member) => ({
      role: member.role,
      label: member.label,
      status: "planned"
    })),
    linkedQuestionRecordIds,
    linkedDecisionRecordIds: []
  };
}

export function createPlannedInvocationRecord(options: {
  intent: InvocationIntent;
  plan: PanelPlan;
  result: PanelResult;
  provider?: ProviderKind;
}): InvocationRecord {
  const createdAt = nowIso();
  return {
    id: createId("invocation_record"),
    createdAt,
    updatedAt: createdAt,
    intent: options.intent,
    status: "planned",
    provider: options.provider,
    surface: "sequential_fallback",
    panelPlan: options.plan,
    panelResult: options.result,
    degradationReason: "Native provider team execution is optional; sequential fallback is the stable LongTable surface."
  };
}

function roleInstruction(member: PanelMember): string {
  const key = parsePersonaKey(member.role);
  const definition = key ? getPersonaDefinition(key) : null;
  return [
    `Role: ${member.label} (${member.role})`,
    `Reason: ${member.reason}.`,
    definition ? `Focus: ${definition.shortDescription}` : undefined,
    "Output: claims, objections, open questions, and evidence/file references when available."
  ].filter(Boolean).join("\n");
}

function languageNote(language: OutputLanguage): string {
  return language === "ko"
    ? "Respond in Korean unless the research artifact itself requires English."
    : "Respond in the user's language unless the research artifact requires another language.";
}

export function renderSequentialFallbackPrompt(plan: PanelPlan): string {
  const language = detectOutputLanguage(plan.prompt);
  return [
    "LongTable mode: Panel",
    "Execution surface: sequential_fallback",
    "",
    "Run this as a structured panel review. Treat each role as an independent pass, then synthesize.",
    "Do not expose hidden reasoning, private tool traces, or provider chain-of-thought.",
    "Make disagreement inspectable through structured role outputs.",
    languageNote(language),
    "",
    "Panel roles:",
    ...plan.members.map((member, index) => `${index + 1}. ${roleInstruction(member)}`),
    "",
    "Return format:",
    "1. LongTable synthesis",
    "2. Panel opinions by role",
    "3. Conflict summary",
    "4. Decision prompt for the researcher",
    "5. Technical record: roles consulted, execution surface, fallback/native mode, and source/file references used",
    "",
    "Research object:",
    plan.prompt
  ].join("\n");
}

export function buildPanelFallback(options: BuildPanelPlanOptions): PanelFallback {
  const plan = buildPanelPlan(options);
  const intent = buildInvocationIntent({
    prompt: plan.prompt,
    mode: plan.mode,
    roles: plan.members.map((member) => member.role),
    provider: options.provider,
    visibility: plan.visibility,
    checkpointSensitivity: plan.checkpointSensitivity,
    rationale: plan.rationale
  });
  const questionRecord = createPlannedPanelQuestionRecord(plan, options.provider);
  const result = createPlannedPanelResult(plan, options.provider, [questionRecord.id]);
  return {
    intent,
    plan,
    result,
    invocationRecord: createPlannedInvocationRecord({
      intent,
      plan,
      result,
      provider: options.provider
    }),
    questionRecord,
    prompt: renderSequentialFallbackPrompt(plan)
  };
}

export function renderPanelSummary(plan: PanelPlan): string {
  return [
    "LongTable Panel Plan",
    `- mode: ${plan.mode}`,
    `- execution surface: ${plan.preferredSurface}`,
    `- visibility: ${plan.visibility}`,
    `- checkpoint sensitivity: ${plan.checkpointSensitivity}`,
    "- roles:",
    ...plan.members.map((member) => `  - ${member.label} (${member.role}): ${member.reason}`),
    "",
    "This is panel orchestration, not persistent team orchestration."
  ].join("\n");
}

export function listDefaultPanelRoles(): CanonicalPersona[] {
  return PERSONA_DEFINITIONS.filter((persona) => persona.defaultPanelMember).map((persona) => persona.key);
}
