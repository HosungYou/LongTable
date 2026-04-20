import type { CheckpointSensitivity, InteractionMode, RoleDefinition } from "@longtable/core";

export const CANONICAL_PERSONAS = [
  "editor",
  "reviewer",
  "theory_critic",
  "methods_critic",
  "measurement_auditor",
  "ethics_reviewer",
  "voice_keeper",
  "venue_strategist"
] as const;

export type CanonicalPersona = (typeof CANONICAL_PERSONAS)[number];

export interface PersonaDefinition {
  key: CanonicalPersona;
  label: string;
  shortDescription: string;
  triggerMode: "auto-callable" | "explicit-only";
  synonyms: string[];
  defaultPanelMember: boolean;
  checkpointSensitivity: CheckpointSensitivity;
  supportedModes: InteractionMode[];
}

export const PERSONA_DEFINITIONS: readonly PersonaDefinition[] = [
  {
    key: "editor",
    label: "Journal Editor",
    shortDescription: "Assesses venue fit, framing strength, and editorial salience.",
    triggerMode: "auto-callable",
    synonyms: ["editor", "journal editor", "editorial", "편집자", "저널 편집자", "에디터"],
    defaultPanelMember: false,
    checkpointSensitivity: "medium",
    supportedModes: ["review", "critique", "draft", "commit", "submit"]
  },
  {
    key: "reviewer",
    label: "Reviewer",
    shortDescription: "Surfaces likely peer-review objections and requests for clarification.",
    triggerMode: "auto-callable",
    synonyms: ["reviewer", "peer reviewer", "심사자", "리뷰어", "심사위원"],
    defaultPanelMember: true,
    checkpointSensitivity: "medium",
    supportedModes: ["review", "critique", "draft", "commit", "submit"]
  },
  {
    key: "theory_critic",
    label: "Theory Critic",
    shortDescription: "Checks conceptual coherence, anchor theory fit, and overreach.",
    triggerMode: "auto-callable",
    synonyms: ["theory", "theoretical", "conceptual", "이론", "이론적", "개념적"],
    defaultPanelMember: true,
    checkpointSensitivity: "high",
    supportedModes: ["explore", "review", "critique", "draft", "commit", "submit"]
  },
  {
    key: "methods_critic",
    label: "Methods Critic",
    shortDescription: "Challenges design logic, methodological defensibility, and alignment.",
    triggerMode: "auto-callable",
    synonyms: ["method", "methods", "methodology", "research design", "방법론", "방법", "연구 설계"],
    defaultPanelMember: true,
    checkpointSensitivity: "high",
    supportedModes: ["explore", "review", "critique", "draft", "commit", "submit"]
  },
  {
    key: "measurement_auditor",
    label: "Measurement Auditor",
    shortDescription: "Looks for construct validity, scale choice, and evidence quality issues.",
    triggerMode: "auto-callable",
    synonyms: [
      "measurement",
      "measure",
      "scale",
      "validity",
      "reliability",
      "측정",
      "척도",
      "타당도",
      "신뢰도"
    ],
    defaultPanelMember: true,
    checkpointSensitivity: "high",
    supportedModes: ["review", "critique", "commit", "submit"]
  },
  {
    key: "ethics_reviewer",
    label: "Ethics Reviewer",
    shortDescription: "Flags consent, IRB, representation, and trust harms.",
    triggerMode: "auto-callable",
    synonyms: ["ethics", "ethical", "irb", "윤리", "윤리적", "irb"],
    defaultPanelMember: false,
    checkpointSensitivity: "high",
    supportedModes: ["explore", "review", "critique", "commit", "submit"]
  },
  {
    key: "voice_keeper",
    label: "Voice Keeper",
    shortDescription: "Protects narrative trace, authorship, and the researcher's own voice.",
    triggerMode: "auto-callable",
    synonyms: ["voice", "tone", "narrative", "authorship", "목소리", "서사", "저자성", "문체"],
    defaultPanelMember: false,
    checkpointSensitivity: "medium",
    supportedModes: ["explore", "review", "critique", "draft", "commit"]
  },
  {
    key: "venue_strategist",
    label: "Venue Strategist",
    shortDescription: "Compares venue expectations and suggests positioning tradeoffs.",
    triggerMode: "explicit-only",
    synonyms: ["venue", "journal fit", "conference fit", "저널 적합성", "학회 적합성", "투고처"],
    defaultPanelMember: false,
    checkpointSensitivity: "medium",
    supportedModes: ["review", "critique", "draft", "commit", "submit"]
  }
] as const;

export function parsePersonaKey(value: string): CanonicalPersona | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return (CANONICAL_PERSONAS as readonly string[]).includes(normalized)
    ? (normalized as CanonicalPersona)
    : null;
}

export function getPersonaDefinition(key: CanonicalPersona): PersonaDefinition {
  return PERSONA_DEFINITIONS.find((persona) => persona.key === key)!;
}

export function listRoleDefinitions(): RoleDefinition[] {
  return PERSONA_DEFINITIONS.map((persona) => ({
    key: persona.key,
    label: persona.label,
    shortDescription: persona.shortDescription,
    triggerMode: persona.triggerMode,
    synonyms: [...persona.synonyms],
    defaultPanelMember: persona.defaultPanelMember,
    checkpointSensitivity: persona.checkpointSensitivity,
    supportedModes: [...persona.supportedModes]
  }));
}
