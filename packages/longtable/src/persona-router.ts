import { getPersonaDefinition, parsePersonaKey, PERSONA_DEFINITIONS, type CanonicalPersona } from "./personas.js";
import type { InteractionMode } from "@longtable/core";

export type OutputLanguage = "ko" | "en";

export interface PersonaRoutingResult {
  outputLanguage: OutputLanguage;
  explicitRoles: CanonicalPersona[];
  implicitRoles: CanonicalPersona[];
  consultedRoles: CanonicalPersona[];
  ambiguousSignal: string | null;
}

export interface LongTableInvocationDirective {
  explicit: boolean;
  cleanedPrompt: string;
  mode?: InteractionMode | "panel" | "status";
  roles: CanonicalPersona[];
  panel: boolean;
  showConflicts: boolean;
}

const AUTO_CALL_LIMIT = 3;
const INVOCATION_PREFIX = /^(?:lt|longtable|long table|롱테이블)\s+/i;

const DIRECTIVE_MAP: Array<{
  key: string;
  mode?: InteractionMode | "panel" | "status";
  roles?: CanonicalPersona[];
  panel?: boolean;
  showConflicts?: boolean;
}> = [
  { key: "explore", mode: "explore" },
  { key: "review", mode: "review" },
  { key: "critique", mode: "critique" },
  { key: "draft", mode: "draft" },
  { key: "commit", mode: "commit" },
  { key: "panel", mode: "panel", panel: true, showConflicts: true },
  { key: "status", mode: "status" },
  { key: "editor", mode: "review", roles: ["editor"] },
  { key: "reviewer", mode: "review", roles: ["reviewer"] },
  { key: "methods", mode: "review", roles: ["methods_critic"] },
  { key: "method", mode: "review", roles: ["methods_critic"] },
  { key: "theory", mode: "review", roles: ["theory_critic"] },
  { key: "measurement", mode: "review", roles: ["measurement_auditor"] },
  { key: "ethics", mode: "review", roles: ["ethics_reviewer"] },
  { key: "voice", mode: "review", roles: ["voice_keeper"] },
  { key: "venue", mode: "review", roles: ["venue_strategist"] }
];

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function detectOutputLanguage(input: string): OutputLanguage {
  return /[가-힣]/.test(input) ? "ko" : "en";
}

export function parseRoleFlag(value?: string): CanonicalPersona[] {
  if (!value?.trim()) {
    return [];
  }

  return unique(
    value
      .split(",")
      .map((part) => parsePersonaKey(part))
      .filter((part): part is CanonicalPersona => part !== null)
  );
}

export function parseInvocationDirective(prompt: string): LongTableInvocationDirective {
  const trimmed = prompt.trim();
  if (!INVOCATION_PREFIX.test(trimmed)) {
    return {
      explicit: false,
      cleanedPrompt: prompt,
      roles: [],
      panel: false,
      showConflicts: false
    };
  }

  const withoutPrefix = trimmed.replace(INVOCATION_PREFIX, "");
  const colonIndex = withoutPrefix.indexOf(":");
  if (colonIndex === -1) {
    return {
      explicit: false,
      cleanedPrompt: prompt,
      roles: [],
      panel: false,
      showConflicts: false
    };
  }

  const directiveKey = withoutPrefix.slice(0, colonIndex).trim().toLowerCase();
  const body = withoutPrefix.slice(colonIndex + 1).trim();
  const directive = DIRECTIVE_MAP.find((entry) => entry.key === directiveKey);

  if (!directive) {
    return {
      explicit: false,
      cleanedPrompt: body || prompt,
      roles: [],
      panel: false,
      showConflicts: false
    };
  }

  return {
    explicit: true,
    cleanedPrompt: body || prompt,
    mode: directive.mode,
    roles: directive.roles ?? [],
    panel: directive.panel === true,
    showConflicts: directive.showConflicts === true
  };
}

export function routePersonas(prompt: string, explicitRoleFlag?: string): PersonaRoutingResult {
  const normalizedPrompt = prompt.toLowerCase();
  const explicitRoles = parseRoleFlag(explicitRoleFlag);

  const naturalLanguageExplicit = PERSONA_DEFINITIONS.filter((persona) =>
    persona.synonyms.some((synonym) => normalizedPrompt.includes(synonym.toLowerCase()))
  ).map((persona) => persona.key);

  const mergedExplicit = unique([...explicitRoles, ...naturalLanguageExplicit]);

  const implicitRoles = PERSONA_DEFINITIONS.filter((persona) => {
    if (persona.triggerMode !== "auto-callable") {
      return false;
    }

    if (mergedExplicit.includes(persona.key)) {
      return false;
    }

    return persona.synonyms.some((synonym) => normalizedPrompt.includes(synonym.toLowerCase()));
  })
    .map((persona) => persona.key)
    .slice(0, AUTO_CALL_LIMIT);

  let ambiguousSignal: string | null = null;
  if (
    normalizedPrompt.includes("review") ||
    normalizedPrompt.includes("봐줘") ||
    normalizedPrompt.includes("검토") ||
    normalizedPrompt.includes("판단")
  ) {
    const hasEditor = mergedExplicit.includes("editor") || implicitRoles.includes("editor");
    const hasReviewer = mergedExplicit.includes("reviewer") || implicitRoles.includes("reviewer");
    if (!hasEditor && !hasReviewer) {
      ambiguousSignal = "editor_or_reviewer";
    }
  }

  return {
    outputLanguage: detectOutputLanguage(prompt),
    explicitRoles: mergedExplicit,
    implicitRoles,
    consultedRoles: unique([...mergedExplicit, ...implicitRoles]),
    ambiguousSignal
  };
}

export function renderDisclosure(roles: CanonicalPersona[], language: OutputLanguage): string | null {
  if (roles.length === 0) {
    return null;
  }

  const labels = roles.map((role) => getPersonaDefinition(role).label);
  return language === "ko"
    ? `LongTable consulted: ${labels.join(", ")}`
    : `LongTable consulted: ${labels.join(", ")}`;
}

export function buildPersonaGuidance(options: {
  mode: InteractionMode;
  prompt: string;
  roleFlag?: string;
  panel?: boolean;
  showConflicts?: boolean;
  showDeliberation?: boolean;
}): { guidedPrompt: string; routing: PersonaRoutingResult } {
  const directive = parseInvocationDirective(options.prompt);
  const effectivePrompt = directive.cleanedPrompt;
  const mergedRoleFlag = [options.roleFlag, directive.roles.join(",")].filter(Boolean).join(",");
  const routing = routePersonas(effectivePrompt, mergedRoleFlag || undefined);
  const disclosure = renderDisclosure(routing.consultedRoles, routing.outputLanguage);
  const lines: string[] = [];

  lines.push(
    routing.outputLanguage === "ko"
      ? `LongTable mode: ${options.mode[0].toUpperCase()}${options.mode.slice(1)}`
      : `LongTable mode: ${options.mode[0].toUpperCase()}${options.mode.slice(1)}`
  );

  if (disclosure) {
    lines.push(disclosure);
  }

  if (routing.ambiguousSignal === "editor_or_reviewer") {
    lines.push(
      routing.outputLanguage === "ko"
        ? "Ambiguity note: 편집자 관점인지 리뷰어 관점인지 애매합니다. 먼저 둘 중 무엇을 우선할지 짧게 확인하세요."
        : "Ambiguity note: it is unclear whether the user wants an editor view or reviewer view. Ask briefly before closing."
    );
  }

  if (options.panel || directive.panel) {
    lines.push(
      routing.outputLanguage === "ko"
        ? "Return format: 1) LongTable synthesis 2) panel opinions by role 3) decision prompt to the researcher."
        : "Return format: 1) LongTable synthesis 2) panel opinions by role 3) decision prompt to the researcher."
    );
  }

  if (options.showConflicts || directive.showConflicts) {
    lines.push(
      routing.outputLanguage === "ko"
        ? "If roles disagree, show the conflict explicitly instead of forcing one answer."
        : "If roles disagree, show the conflict explicitly instead of forcing one answer."
    );
  }

  if (options.showDeliberation) {
    lines.push(
      routing.outputLanguage === "ko"
        ? "Include a short deliberation trace showing why the roles diverged."
        : "Include a short deliberation trace showing why the roles diverged."
    );
  }

  lines.push(
    routing.outputLanguage === "ko"
      ? "For factual, current, or external claims, attach source links or local file references when possible. If you cannot source a statement, label it as inference or estimate."
      : "For factual, current, or external claims, attach source links or local file references when possible. If you cannot source a statement, label it as inference or estimate."
  );

  lines.push(
    routing.outputLanguage === "ko"
      ? "Do not show internal file-search logs, tool traces, or process commentary in the researcher-facing answer."
      : "Do not show internal file-search logs, tool traces, or process commentary in the researcher-facing answer."
  );

  lines.push(effectivePrompt.trim());

  return {
    guidedPrompt: lines.join("\n\n"),
    routing
  };
}
