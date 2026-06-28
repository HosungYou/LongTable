import type {
  CheckpointSensitivity,
  InteractionMode,
  InvocationIntent,
  InvocationRecord,
  PanelMember,
  PanelPlan,
  PanelResult,
  PanelVisibility,
  QuestionOption,
  QuestionRecord,
  ProviderKind,
  InvocationSurface,
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
  nativeSubagents?: boolean;
  nativeWorkers?: boolean;
}

export interface PanelFallback {
  intent: InvocationIntent;
  plan: PanelPlan;
  result: PanelResult;
  invocationRecord: InvocationRecord;
  questionRecord: QuestionRecord;
  prompt: string;
}

interface PanelDecisionContext {
  language: OutputLanguage;
  focus: string;
  blockerSummary: string;
  decisionQuestion: string;
  displayReason: string;
  options: QuestionOption[];
  otherLabel: string;
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

function firstPromptClause(prompt: string): string {
  const projectContextMatch = prompt.match(/(?:^|\n)LongTable project context\n[\s\S]*?\n\n([\s\S]+)$/);
  const sourcePrompt = projectContextMatch?.[1] ?? prompt;
  const normalized = sourcePrompt.replace(/\s+/g, " ").trim();
  const sentenceEnd = normalized.search(/[.!?]\s/);
  const first = sentenceEnd >= 0 ? normalized.slice(0, sentenceEnd + 1) : normalized;
  return first
    .replace(/^(please\s+)?(run\s+)?(a\s+)?(structured\s+)?(panel\s+)?(review|critique|evaluate|assess|inspect)\s+/i, "")
    .replace(/^(whether|if|of)\s+/i, "")
    .replace(/^the\s+/i, "")
    .trim();
}

function conciseFocusFromPrompt(prompt: string): string {
  const focus = firstPromptClause(prompt)
    .replace(/[.:;,\s]+$/g, "")
    .trim();
  if (!focus) {
    return "the reviewed issue";
  }
  return focus.length > 96 ? `${focus.slice(0, 93).trim()}...` : focus;
}

type PanelDecisionDomain =
  | "manuscript_spine"
  | "manuscript_argument"
  | "measurement"
  | "method"
  | "evidence"
  | "theory"
  | "generic";

type PanelDecisionValue = "revise" | "evidence" | "proceed" | "defer";

interface PanelDecisionDomainCopy {
  focus: Record<OutputLanguage, string>;
  blockerSummary: Record<OutputLanguage, string>;
  recommendedValue: PanelDecisionValue;
  labels: Record<PanelDecisionValue, Record<OutputLanguage, string>>;
  descriptions: Record<PanelDecisionValue, Record<OutputLanguage, string>>;
}

function languageText(language: OutputLanguage, en: string, ko: string): string {
  return language === "ko" ? ko : en;
}

function withFocus(template: string, focus: string): string {
  return template.replace(/\{focus\}/g, focus);
}

function shouldIncludeDeferOption(prompt: string): boolean {
  return /\b(defer|postpone|not decide|keep open|open tension|later|uncertain|unresolved)\b/i.test(prompt)
    || /보류|미루|나중|열린\s*쟁점|열어\s*두|불확실|미해결/.test(prompt);
}

const PANEL_DECISION_COPY: Record<PanelDecisionDomain, PanelDecisionDomainCopy> = {
  manuscript_spine: {
    focus: {
      en: "the manuscript table/figure spine",
      ko: "원고의 표/그림 spine"
    },
    blockerSummary: {
      en: "The panel concern is that the current manuscript shell does not yet carry its argument through a useful table/figure spine.",
      ko: "패널이 멈춘 이유는 현재 원고 shell이 논문 주장을 운반할 표/그림 spine을 충분히 보여주지 못했기 때문입니다."
    },
    recommendedValue: "revise",
    labels: {
      revise: { en: "Revise manuscript table/figure spine", ko: "원고 표/그림 spine을 다시 설계한다" },
      evidence: { en: "Verify table/figure evidence", ko: "표/그림 근거를 먼저 확인한다" },
      proceed: { en: "Proceed with current manuscript direction", ko: "현재 원고 방향을 유지하고 표/그림만 보강한다" },
      defer: { en: "Keep manuscript spine concern open", ko: "원고 spine 우려를 열린 쟁점으로 둔다" }
    },
    descriptions: {
      revise: {
        en: "Use the panel result to redesign the table/figure spine before drafting the manuscript.",
        ko: "패널 결과를 반영해 원고를 쓰기 전에 표/그림 spine을 다시 잡습니다."
      },
      evidence: {
        en: "Check which tables, figures, analyses, and citations can actually support the manuscript claim.",
        ko: "어떤 표, 그림, 분석, 인용이 실제로 원고 주장을 지탱할 수 있는지 먼저 확인합니다."
      },
      proceed: {
        en: "Keep the current manuscript direction and only strengthen the missing table/figure pieces.",
        ko: "현재 원고 방향은 유지하고 부족한 표/그림 요소만 보강합니다."
      },
      defer: {
        en: "Do not settle the manuscript spine yet; keep the concern visible as an open issue.",
        ko: "아직 원고 spine을 확정하지 않고 이 우려를 열린 쟁점으로 남깁니다."
      }
    }
  },
  manuscript_argument: {
    focus: {
      en: "the manuscript or draft argument",
      ko: "원고 또는 초안의 논지"
    },
    blockerSummary: {
      en: "The panel concern is that the manuscript direction could settle before the argument, evidence, and reviewer risk are aligned.",
      ko: "패널이 멈춘 이유는 논지, 근거, 리뷰어 리스크가 정렬되기 전에 원고 방향이 확정될 수 있기 때문입니다."
    },
    recommendedValue: "revise",
    labels: {
      revise: { en: "Revise manuscript argument", ko: "원고 논지를 먼저 수정한다" },
      evidence: { en: "Verify manuscript evidence", ko: "원고 근거를 먼저 확인한다" },
      proceed: { en: "Proceed with current manuscript direction", ko: "현재 원고 방향으로 진행한다" },
      defer: { en: "Keep manuscript concern open", ko: "원고 우려를 열린 쟁점으로 둔다" }
    },
    descriptions: {
      revise: {
        en: "Use the panel result to revise the claim, structure, or draft before proceeding.",
        ko: "패널 결과를 반영해 주장, 구조, 초안을 먼저 수정합니다."
      },
      evidence: {
        en: "Check source, data, artifact, or citation support for the manuscript direction before proceeding.",
        ko: "현재 원고 방향을 지탱할 자료, 데이터, 산출물, 인용 근거를 먼저 확인합니다."
      },
      proceed: {
        en: "Accept the visible risk profile and continue with the current manuscript direction.",
        ko: "드러난 위험을 감수하고 현재 원고 방향으로 계속 진행합니다."
      },
      defer: {
        en: "Do not commit yet; keep the manuscript issue visible as an open tension.",
        ko: "아직 확정하지 않고 원고 쟁점을 열린 긴장으로 남깁니다."
      }
    }
  },
  measurement: {
    focus: {
      en: "the measurement or coding decision",
      ko: "측정 또는 코딩 결정"
    },
    blockerSummary: {
      en: "The panel concern is that measurement or coding rules decide what will count as evidence later.",
      ko: "패널이 멈춘 이유는 측정 또는 코딩 규칙이 이후 무엇을 근거로 볼지 결정하기 때문입니다."
    },
    recommendedValue: "revise",
    labels: {
      revise: { en: "Revise measurement/coding plan", ko: "측정/코딩 계획을 수정한다" },
      evidence: { en: "Verify measurement validity evidence", ko: "측정 타당도 근거를 확인한다" },
      proceed: { en: "Proceed with current measurement/coding plan", ko: "현재 측정/코딩 계획으로 진행한다" },
      defer: { en: "Keep measurement/coding concern open", ko: "측정/코딩 우려를 열린 쟁점으로 둔다" }
    },
    descriptions: {
      revise: {
        en: "Use the panel result to revise the variables, coding rules, or construct boundary before proceeding.",
        ko: "패널 결과를 반영해 변수, 코딩 규칙, 구성개념 경계를 먼저 수정합니다."
      },
      evidence: {
        en: "Check validity, reliability, source, or coding evidence before treating the plan as settled.",
        ko: "타당도, 신뢰도, 출처, 코딩 근거를 확인한 뒤 계획을 확정합니다."
      },
      proceed: {
        en: "Accept the visible measurement risk and continue with the current plan.",
        ko: "드러난 측정 위험을 감수하고 현재 계획으로 계속 진행합니다."
      },
      defer: {
        en: "Do not commit yet; keep the measurement or coding issue visible as an open tension.",
        ko: "아직 확정하지 않고 측정 또는 코딩 쟁점을 열린 긴장으로 남깁니다."
      }
    }
  },
  method: {
    focus: {
      en: "the method or analysis design",
      ko: "방법 또는 분석 설계"
    },
    blockerSummary: {
      en: "The panel concern is that the method or analysis choice could become a hard-to-reverse research commitment.",
      ko: "패널이 멈춘 이유는 방법 또는 분석 선택이 되돌리기 어려운 연구 결정이 될 수 있기 때문입니다."
    },
    recommendedValue: "revise",
    labels: {
      revise: { en: "Revise method/analysis plan", ko: "방법/분석 계획을 수정한다" },
      evidence: { en: "Verify method/analysis evidence", ko: "방법/분석 근거를 확인한다" },
      proceed: { en: "Proceed with current method/analysis plan", ko: "현재 방법/분석 계획으로 진행한다" },
      defer: { en: "Keep method/analysis concern open", ko: "방법/분석 우려를 열린 쟁점으로 둔다" }
    },
    descriptions: {
      revise: {
        en: "Use the panel result to revise the design, model, sample, or analysis plan before proceeding.",
        ko: "패널 결과를 반영해 설계, 모형, 표본, 분석 계획을 먼저 수정합니다."
      },
      evidence: {
        en: "Check data, model, method, or artifact support before treating the plan as settled.",
        ko: "데이터, 모형, 방법, 산출물 근거를 확인한 뒤 계획을 확정합니다."
      },
      proceed: {
        en: "Accept the visible method risk and continue with the current plan.",
        ko: "드러난 방법론적 위험을 감수하고 현재 계획으로 계속 진행합니다."
      },
      defer: {
        en: "Do not commit yet; keep the method or analysis issue visible as an open tension.",
        ko: "아직 확정하지 않고 방법 또는 분석 쟁점을 열린 긴장으로 남깁니다."
      }
    }
  },
  evidence: {
    focus: {
      en: "the evidence or source standard",
      ko: "근거 또는 출처 기준"
    },
    blockerSummary: {
      en: "The panel concern is that LongTable could proceed before the source, artifact, or citation support is explicit.",
      ko: "패널이 멈춘 이유는 출처, 산출물, 인용 근거가 명시되기 전에 LongTable이 진행할 수 있기 때문입니다."
    },
    recommendedValue: "evidence",
    labels: {
      revise: { en: "Revise evidence standard", ko: "근거 기준을 수정한다" },
      evidence: { en: "Verify source/citation support", ko: "출처/인용 근거를 확인한다" },
      proceed: { en: "Proceed with current evidence boundary", ko: "현재 근거 경계로 진행한다" },
      defer: { en: "Keep evidence concern open", ko: "근거 우려를 열린 쟁점으로 둔다" }
    },
    descriptions: {
      revise: {
        en: "Use the panel result to revise what will count as adequate evidence.",
        ko: "패널 결과를 반영해 충분한 근거의 기준을 먼저 수정합니다."
      },
      evidence: {
        en: "Check source, data, artifact, or citation support before proceeding.",
        ko: "진행하기 전에 출처, 데이터, 산출물, 인용 근거를 확인합니다."
      },
      proceed: {
        en: "Accept the visible evidence risk and continue with the current boundary.",
        ko: "드러난 근거 위험을 감수하고 현재 경계로 계속 진행합니다."
      },
      defer: {
        en: "Do not commit yet; keep the evidence issue visible as an open tension.",
        ko: "아직 확정하지 않고 근거 쟁점을 열린 긴장으로 남깁니다."
      }
    }
  },
  theory: {
    focus: {
      en: "the theory or conceptual frame",
      ko: "이론 또는 개념 프레임"
    },
    blockerSummary: {
      en: "The panel concern is that the conceptual frame could settle before its distinctions and limits are explicit.",
      ko: "패널이 멈춘 이유는 개념 구분과 한계가 명확해지기 전에 이론 프레임이 확정될 수 있기 때문입니다."
    },
    recommendedValue: "revise",
    labels: {
      revise: { en: "Revise theory/conceptual frame", ko: "이론/개념 프레임을 수정한다" },
      evidence: { en: "Verify theory support", ko: "이론 근거를 확인한다" },
      proceed: { en: "Proceed with current theory frame", ko: "현재 이론 프레임으로 진행한다" },
      defer: { en: "Keep theory concern open", ko: "이론 우려를 열린 쟁점으로 둔다" }
    },
    descriptions: {
      revise: {
        en: "Use the panel result to revise the conceptual frame, distinctions, or scope before proceeding.",
        ko: "패널 결과를 반영해 개념 프레임, 구분, 범위를 먼저 수정합니다."
      },
      evidence: {
        en: "Check theory, literature, concept, or citation support before treating the frame as settled.",
        ko: "이론, 문헌, 개념, 인용 근거를 확인한 뒤 프레임을 확정합니다."
      },
      proceed: {
        en: "Accept the visible theory risk and continue with the current frame.",
        ko: "드러난 이론적 위험을 감수하고 현재 프레임으로 계속 진행합니다."
      },
      defer: {
        en: "Do not commit yet; keep the theory issue visible as an open tension.",
        ko: "아직 확정하지 않고 이론 쟁점을 열린 긴장으로 남깁니다."
      }
    }
  },
  generic: {
    focus: {
      en: "the reviewed issue",
      ko: "검토된 쟁점"
    },
    blockerSummary: {
      en: "The panel concern is that LongTable has reached a decision point that should belong to the researcher.",
      ko: "패널이 멈춘 이유는 LongTable이 연구자가 직접 정해야 할 결정 지점에 도달했기 때문입니다."
    },
    recommendedValue: "revise",
    labels: {
      revise: { en: "Revise reviewed issue", ko: "검토된 쟁점을 수정한다" },
      evidence: { en: "Verify evidence first", ko: "근거를 먼저 확인한다" },
      proceed: { en: "Proceed with current direction", ko: "현재 방향으로 진행한다" },
      defer: { en: "Keep issue open", ko: "쟁점을 열린 상태로 둔다" }
    },
    descriptions: {
      revise: {
        en: "Use the panel result to revise {focus} before proceeding.",
        ko: "패널 결과를 반영해 {focus}을/를 먼저 수정합니다."
      },
      evidence: {
        en: "Check source, data, artifact, or citation support for {focus} before proceeding.",
        ko: "{focus}을/를 지탱할 출처, 데이터, 산출물, 인용 근거를 먼저 확인합니다."
      },
      proceed: {
        en: "Accept the visible risk profile for {focus} and continue.",
        ko: "{focus}에 대해 드러난 위험을 감수하고 계속 진행합니다."
      },
      defer: {
        en: "Do not commit yet; keep {focus} visible as an open tension.",
        ko: "아직 확정하지 않고 {focus}을/를 열린 긴장으로 남깁니다."
      }
    }
  }
};

function decisionDomainFromPrompt(prompt: string): PanelDecisionDomain {
  const normalized = prompt.toLowerCase();
  if (/get[-_ ]?journal|table\/figure|table and figure|figure spine|table spine|manuscript shell|journal manuscript/.test(normalized)) {
    return "manuscript_spine";
  }
  if (/\bmanuscript\b|\bdraft\b|\bpaper\b|\barticle\b|\bsection\b|\bsubmission\b/.test(normalized)) {
    return "manuscript_argument";
  }
  if (/\bmeasurement\b|\bmeasure\b|\bscale\b|\bconstruct\b|\bcoding\b|측정|척도|구성개념|코딩/.test(normalized)) {
    return "measurement";
  }
  if (/\bmethod\b|\bdesign\b|\banalysis\b|\bmodel\b|\bsample\b|\bidentification\b|방법|설계|분석|표본/.test(normalized)) {
    return "method";
  }
  if (/\bevidence\b|\bsource\b|\bcitation\b|\breference\b|\bpdf\b|\bcorpus\b|근거|인용|문헌|자료/.test(normalized)) {
    return "evidence";
  }
  if (/\btheory\b|\bframework\b|\bontology\b|\bconcept\b|이론|개념|온톨로지/.test(normalized)) {
    return "theory";
  }
  return "generic";
}

function panelDecisionOptions(
  copy: PanelDecisionDomainCopy,
  language: OutputLanguage,
  focus: string,
  includeDefer: boolean
): QuestionOption[] {
  const values: PanelDecisionValue[] = includeDefer
    ? ["revise", "evidence", "defer"]
    : ["revise", "evidence", "proceed"];
  return values
    .sort((left, right) => Number(right === copy.recommendedValue) - Number(left === copy.recommendedValue))
    .map((value) => ({
      value,
      label: copy.labels[value][language],
      description: withFocus(copy.descriptions[value][language], focus),
      ...(value === copy.recommendedValue ? { recommended: true } : {})
    }));
}

function promptForPanelDecision(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed.startsWith("LongTable project context\n")) {
    return prompt;
  }

  const sections = trimmed.split(/\n\s*\n/).map((section) => section.trim()).filter(Boolean);
  const lastSection = sections.length > 0 ? sections[sections.length - 1] : undefined;
  return lastSection ?? prompt;
}

export function buildPanelDecisionContext(prompt: string): PanelDecisionContext {
  const decisionPrompt = promptForPanelDecision(prompt);
  const language = detectOutputLanguage(decisionPrompt);
  const domain = decisionDomainFromPrompt(decisionPrompt);
  const copy = PANEL_DECISION_COPY[domain];
  const domainFocus = copy.focus[language];
  const focus = domain === "generic" ? conciseFocusFromPrompt(decisionPrompt) || domainFocus : domainFocus;
  const blockerSummary = copy.blockerSummary[language];
  return {
    language,
    focus,
    blockerSummary,
    decisionQuestion: languageText(
      language,
      `What should LongTable treat as the next human decision for ${focus} after this panel review?`,
      `이 패널 리뷰 이후 LongTable이 ${focus}에 대해 다음 인간 결정으로 기록해야 할 것은 무엇인가요?`
    ),
    displayReason: languageText(
      language,
      `${blockerSummary} This should be resolved by the researcher before LongTable treats the direction as settled.`,
      `${blockerSummary} LongTable이 방향을 확정하기 전에 연구자가 직접 선택해야 합니다.`
    ),
    options: panelDecisionOptions(copy, language, focus, shouldIncludeDeferOption(decisionPrompt)),
    otherLabel: languageText(language, "Other decision", "직접 입력")
  };
}

export function buildPanelPlan(options: BuildPanelPlanOptions): PanelPlan {
  const mode = options.mode ?? "review";
  const explicitRoles = unique([...(options.roles ?? []), ...parseRoleFlag(options.roleFlag)]);
  const routedRoles = routePersonas(options.prompt).consultedRoles;
  const roles = resolvePanelRoles(options);
  const createdAt = nowIso();
  const preferredSurface: InvocationSurface =
    options.nativeWorkers && options.provider === "codex"
      ? "native_workers"
      : options.nativeSubagents && options.provider === "codex"
      ? "native_subagents"
      : "sequential_fallback";

  return {
    id: createId("panel_plan"),
    createdAt,
    mode,
    prompt: options.prompt,
    members: roles.map((role) => memberForRole(role, explicitRoles, routedRoles)),
    visibility: options.visibility ?? "always_visible",
    preferredSurface,
    fallbackSurface: "sequential_fallback",
    checkpointSensitivity: highestSensitivity(roles),
    rationale: [
      "Option A uses provider-neutral panel semantics before native provider orchestration.",
      preferredSurface === "native_workers"
        ? "LongTable-native workers may execute role passes through durable worker state; outputs must normalize back to this PanelResult, and bridge failure must be reported separately from any later sequential fallback."
        : preferredSurface === "native_subagents"
        ? "Codex native subagents may execute the role passes when the current provider session exposes them; outputs must normalize back to this PanelResult."
        : "Sequential fallback is the stable execution path for both Claude Code and Codex.",
      "Sequential fallback remains the ordinary degradation path, but it is not treated as executed merely because a native-worker bridge request failed.",
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
  requestedSurface?: InvocationSurface;
  rationale?: string[];
}): InvocationIntent {
  return {
    id: createId("invocation"),
    kind: "panel",
    mode: options.mode ?? "review",
    prompt: options.prompt,
    roles: options.roles,
    provider: options.provider,
    requestedSurface: options.requestedSurface ?? "sequential_fallback",
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
  const decisionContext = buildPanelDecisionContext(plan.prompt);
  return {
    id: createId("question_record"),
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    prompt: {
      id: createId("question_prompt"),
      checkpointKey: "panel_next_decision",
      title: languageText(decisionContext.language, "Panel follow-up decision", "패널 후속 결정"),
      question: decisionContext.decisionQuestion,
      type: "single_choice",
      options: decisionContext.options,
      allowOther: true,
      otherLabel: decisionContext.otherLabel,
      required: plan.checkpointSensitivity === "high",
      source: "runtime_guidance",
      rationale: [
        "Panel review creates disagreement or risk visibility that should connect to an explicit researcher decision.",
        `Panel decision focus: ${decisionContext.focus}.`,
        "Panel follow-up choices are compact by default; unlisted decisions should use Other.",
        `Panel checkpoint sensitivity: ${plan.checkpointSensitivity}.`
      ],
      displayReason: decisionContext.displayReason,
      preferredSurfaces: provider === "claude"
        ? ["native_structured", "numbered"]
        : ["tmux_popup", "mcp_elicitation", "numbered"]
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
    surface: plan.preferredSurface,
    status: "planned",
    interactionDepth: "independent",
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
    surface: options.plan.preferredSurface,
    interactionDepth: "independent",
    panelPlan: options.plan,
    panelResult: options.result,
    degradationReason: options.plan.preferredSurface === "native_workers"
      ? "LongTable-native panel workers are optional; bridge failure is reported explicitly, and sequential_fallback remains available only when it is deliberately executed."
      : options.plan.preferredSurface === "native_subagents"
      ? "Codex native subagent execution is session-dependent; sequential_fallback is the required LongTable degradation path."
      : "Sequential fallback is the stable LongTable panel surface."
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
  const nativeSubagentNote = plan.preferredSurface === "native_subagents"
    ? [
        "Preferred execution surface: native_subagents when the current Codex session exposes provider-native subagents.",
        "Fallback: if native subagents are unavailable, run the same role passes sequentially and disclose the fallback in the technical record."
      ]
    : plan.preferredSurface === "native_workers"
    ? [
        "Preferred execution surface: LongTable-native panel workers when the local runtime supports them.",
        "Fallback: if native workers are unavailable or stopped, report the bridge failure explicitly; run sequential fallback only as a deliberate fallback execution and disclose it in the technical record."
      ]
    : ["Execution surface: sequential_fallback"];
  return [
    "LongTable mode: Panel",
    ...nativeSubagentNote,
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
    "6. Persistence hint: if this is a real panel result, record structured outputs with `longtable panel record --invocation <id> --result-file <json>` before generating `longtable handoff`.",
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
    requestedSurface: plan.preferredSurface,
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
