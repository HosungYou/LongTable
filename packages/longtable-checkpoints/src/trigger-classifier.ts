import type {
  ArtifactStakes,
  CheckpointLevel,
  CheckpointTriggerClassification,
  CheckpointTriggerClassificationOptions,
  CheckpointTriggerFamily,
  InteractionMode,
  ResearchStage
} from "./types.js";

interface CueRule {
  family: CheckpointTriggerFamily;
  checkpointKey: string;
  stage: ResearchStage;
  stakes?: ArtifactStakes;
  mode?: InteractionMode;
  level: CheckpointLevel;
  cues: RegExp[];
  rationale: string;
}

const RULES: CueRule[] = [
  {
    family: "meta_decision",
    checkpointKey: "meta_decision",
    stage: "problem_framing",
    mode: "review",
    level: "recommended",
    cues: [
      /\brename\b/i,
      /\bnaming\b/i,
      /\bproduct language\b/i,
      /\bplatform term\b/i,
      /\breadme\b/i,
      /\bcheckpoint policy\b/i,
      /\bmake .*authoritative\b/i,
      /이름|명명|리드미|체크포인트 정책|플랫폼 용어|제품 언어/
    ],
    rationale: "Platform language and checkpoint policy should be discussed without creating a research-state checkpoint."
  },
  {
    family: "submission",
    checkpointKey: "submission_release",
    stage: "submission",
    stakes: "external_submission",
    mode: "submit",
    level: "adaptive_required",
    cues: [
      /\bsubmit\b/i,
      /\bsubmission\b/i,
      /\bjournal\b/i,
      /\bpublic\b/i,
      /\brelease\b/i,
      /\bpreregistration\b/i,
      /\bpre[- ]?registration\b/i,
      /\birb\b/i,
      /투고|제출|공개|배포|출시|사전등록|심의/
    ],
    rationale: "External-facing artifacts require explicit researcher responsibility before closure."
  },
  {
    family: "commitment",
    checkpointKey: "research_question_freeze",
    stage: "problem_framing",
    mode: "commit",
    level: "adaptive_required",
    cues: [
      /\bresearch question\b/i,
      /\bresearch direction\b/i,
      /\bscope\b/i,
      /\bboundary\b/i,
      /\bfreeze\b/i,
      /\bfinali[sz]e\b/i,
      /\bsettle\b/i,
      /\bdecide\b/i,
      /\bcommit\b/i,
      /연구문제|연구 질문|연구\s*방향|범위|경계|확정|결정|고정|커밋/
    ],
    rationale: "Freezing the research question converts ambiguity into a human commitment."
  },
  {
    family: "commitment",
    checkpointKey: "theory_selection",
    stage: "theory_selection",
    mode: "commit",
    level: "adaptive_required",
    cues: [
      /\btheory\b/i,
      /\bframework\b/i,
      /\bconceptual\b/i,
      /\bconstruct\b/i,
      /이론|프레임워크|개념|구성개념/
    ],
    rationale: "Theory and construct choices constrain the rest of the study."
  },
  {
    family: "commitment",
    checkpointKey: "method_design_commitment",
    stage: "method_design",
    mode: "commit",
    level: "adaptive_required",
    cues: [
      /\bmethod\b/i,
      /\bmethodology\b/i,
      /\bstudy design\b/i,
      /\bdesign\b/i,
      /\bsampling\b/i,
      /방법론|방법|연구 설계|표본|샘플링/
    ],
    rationale: "Method commitments can silently decide what claims become defensible."
  },
  {
    family: "commitment",
    checkpointKey: "measurement_validity",
    stage: "measurement_design",
    mode: "commit",
    level: "adaptive_required",
    cues: [
      /\bmeasure\b/i,
      /\bmeasurement\b/i,
      /\bscale\b/i,
      /\bsurvey\b/i,
      /\binstrument\b/i,
      /\bvalidity\b/i,
      /측정|척도|설문|도구|타당도/
    ],
    rationale: "Measurement choices should not be settled without construct-validity judgment."
  },
  {
    family: "commitment",
    checkpointKey: "analysis_plan",
    stage: "analysis_planning",
    mode: "commit",
    level: "adaptive_required",
    cues: [
      /\banalysis plan\b/i,
      /\banaly[sz]e\b/i,
      /\bstatistical model\b/i,
      /\bstructural model\b/i,
      /\bpath model\b/i,
      /\banalysis model\b/i,
      /\bstatistical\b/i,
      /\bregression\b/i,
      /\bqualitative coding\b/i,
      /분석 계획|분석|분석\s*(?:모형|모델)|통계\s*(?:모형|모델)|구조\s*방정식|경로\s*모형|통계|회귀|코딩/
    ],
    rationale: "Analysis choices affect inference and should remain inspectable."
  },
  {
    family: "evidence",
    checkpointKey: "evidence_claim",
    stage: "writing",
    mode: "review",
    level: "recommended",
    cues: [
      /\bcitation\b/i,
      /\breference\b/i,
      /\bevidence\b/i,
      /\bsource\b/i,
      /\bhallucination\b/i,
      /\bclaim\b/i,
      /인용|레퍼런스|근거|출처|환각|할루시네이션|주장/
    ],
    rationale: "Evidence-sensitive claims need provenance before synthesis."
  },
  {
    family: "evidence",
    checkpointKey: "scholarly_access_policy",
    stage: "method_design",
    mode: "commit",
    level: "adaptive_required",
    cues: [
      /\b(pdf|full[- ]?text|tdm|publisher api|institutional access|library login|vpn|proxy|subscription|paper collection|source collection|corpus|download)\b/i,
      /PDF|원문|전문|기관\s*구독|기관구독|구독|VPN|프록시|도서관|라이브러리|TDM|논문\s*수집|문헌\s*수집|코퍼스|다운로드/
    ],
    rationale: "Full-text access decisions change corpus coverage, inclusion bias, reproducibility, and TDM permission."
  },
  {
    family: "authorship",
    checkpointKey: "authorship_voice",
    stage: "writing",
    mode: "draft",
    level: "recommended",
    cues: [
      /\bauthor voice\b/i,
      /\bauthorship\b/i,
      /\bmy voice\b/i,
      /\bnarrative\b/i,
      /저자성|내 목소리|문체|서사|나의 생각/
    ],
    rationale: "LongTable should preserve researcher authorship rather than over-smoothing."
  },
  {
    family: "exploration",
    checkpointKey: "knowledge_gap_probe",
    stage: "problem_framing",
    mode: "explore",
    level: "recommended",
    cues: [
      /\bknowledge gap\b/i,
      /\bgap in (my|our|the) knowledge\b/i,
      /\bthe gap\b/i,
      /\bunknown\b/i,
      /\buncertain\b/i,
      /\bnot sure\b/i,
      /\bnot sure whether\b/i,
      /\bdon'?t know\b/i,
      /\bwhat am i missing\b/i,
      /\bwhat are we missing\b/i,
      /\bhelp me narrow\b/i,
      /지식의 공백|지식 공백|모르겠|불확실|놓치고 있|빠뜨리고 있/
    ],
    rationale: "A named knowledge gap should be surfaced as response-only guidance unless a research commitment is being made."
  },
  {
    family: "review",
    checkpointKey: "tacit_assumption_probe",
    stage: "problem_framing",
    mode: "review",
    level: "recommended",
    cues: [
      /\btacit\b/i,
      /\bimplicit\b/i,
      /\bassumption\b/i,
      /\bpremise\b/i,
      /\bblind spot\b/i,
      /\bhidden constraint\b/i,
      /암묵지|암묵적|전제|가정|사각지대|숨은 제약|암묵/
    ],
    rationale: "Tacit assumptions should be made visible without becoming a durable checkpoint unless they block a research commitment."
  },
  {
    family: "exploration",
    checkpointKey: "problem_exploration",
    stage: "problem_framing",
    mode: "explore",
    level: "recommended",
    cues: [
      /\bexplore\b/i,
      /\bnarrow\b/i,
      /\bbrainstorm\b/i,
      /\bframe\b/i,
      /탐색|좁혀|브레인스토밍|프레이밍/
    ],
    rationale: "Exploration should ask tension questions before recommendation."
  },
  {
    family: "review",
    checkpointKey: "panel_disagreement_resolution",
    stage: "analysis_planning",
    mode: "review",
    level: "adaptive_required",
    cues: [
      /\bpanel disagrees?\b/i,
      /\brole disagreement\b/i,
      /\bpanel disagreement\b/i,
      /\bdisagreement\b/i,
      /\bconflict\b/i,
      /\bsynthesi[sz]e and choose\b/i,
      /\bchoose .*framing\b/i,
      /\bbest framing\b/i,
      /패널.*불일치|역할.*불일치|불일치|충돌|종합.*선택|프레이밍.*선택/
    ],
    rationale: "Panel disagreement should not be collapsed into one synthesis without an explicit researcher decision."
  },
  {
    family: "review",
    checkpointKey: "research_review",
    stage: "analysis_planning",
    mode: "review",
    level: "recommended",
    cues: [
      /\breview\b/i,
      /\bcritique\b/i,
      /\bcheck\b/i,
      /\baudit\b/i,
      /리뷰|검토|비판|체크|감사/
    ],
    rationale: "Review requests should preserve objections and unresolved assumptions."
  }
];

function matchCues(prompt: string, rule: CueRule): string[] {
  return rule.cues
    .filter((cue) => cue.test(prompt))
    .map((cue) => cue.source);
}

function inferModeFromPlainCue(prompt: string): InteractionMode | null {
  if (/\bsubmit\b|\bsubmission\b|\bjournal\b|\bpublic\b|투고|제출|공개/.test(prompt)) return "submit";
  if (/\bcommit\b|\bdecide\b|\bfinali[sz]e\b|확정|결정|고정/.test(prompt)) return "commit";
  if (/\bdraft\b|\bwrite\b|초안|작성/.test(prompt)) return "draft";
  if (/\bcritique\b|비판/.test(prompt)) return "critique";
  if (/\breview\b|\bcheck\b|검토|리뷰/.test(prompt)) return "review";
  if (/\bexplore\b|\bnarrow\b|\bbrainstorm\b|탐색|좁혀/.test(prompt)) return "explore";
  return null;
}

function inferConfidence(matchCount: number, level: CheckpointLevel): CheckpointTriggerClassification["confidence"] {
  if (level === "universal_required" || level === "adaptive_required" || matchCount >= 2) {
    return "high";
  }
  if (matchCount === 1) {
    return "medium";
  }
  return "low";
}

function requiresQuestion(level: CheckpointLevel, mode: InteractionMode, family: CheckpointTriggerFamily): boolean {
  return (
    level === "universal_required" ||
    level === "adaptive_required" ||
    mode === "submit" ||
    family === "meta_decision"
  );
}

function looksLikeCommitmentCue(prompt: string): boolean {
  return /\b(final|finalize|commit|ship|submit|publish|freeze|settle|decide|lock|record|apply|incorporate|change|revise|update|replace|reframe|modify|alter)\b/i.test(prompt)
    || /최종|확정|커밋|제출|투고|고정|결정|기록|반영|바꾸|변경|수정|교체|전환|재설정/.test(prompt);
}

function ruleRequiresQuestionForPrompt(rule: CueRule, prompt: string): boolean {
  if (rule.family === "commitment" && !looksLikeCommitmentCue(prompt)) {
    return false;
  }
  return requiresQuestion(rule.level, rule.mode ?? "review", rule.family);
}

function pickBestRule(prompt: string): { rule: CueRule; matches: string[] } | null {
  const candidates = RULES.map((rule) => ({ rule, matches: matchCues(prompt, rule) }))
    .filter((candidate) => candidate.matches.length > 0)
    .sort((a, b) => {
      const requiredDelta = Number(ruleRequiresQuestionForPrompt(b.rule, prompt)) -
        Number(ruleRequiresQuestionForPrompt(a.rule, prompt));
      if (requiredDelta !== 0) return requiredDelta;
      const genericDelta = Number(a.rule.checkpointKey === "research_question_freeze") -
        Number(b.rule.checkpointKey === "research_question_freeze");
      if (genericDelta !== 0) return genericDelta;
      return b.matches.length - a.matches.length;
    });

  return candidates[0] ?? null;
}

function fallbackStage(mode: InteractionMode): ResearchStage {
  switch (mode) {
    case "submit":
      return "submission";
    case "draft":
      return "writing";
    case "commit":
      return "theory_selection";
    case "review":
    case "critique":
      return "analysis_planning";
    case "explore":
    default:
      return "problem_framing";
  }
}

function fallbackStakes(mode: InteractionMode): ArtifactStakes {
  switch (mode) {
    case "submit":
      return "external_submission";
    case "commit":
      return "study_protocol";
    case "draft":
      return "internal_draft";
    case "review":
    case "critique":
    case "explore":
    default:
      return "private_note";
  }
}

function fallbackLevel(mode: InteractionMode): CheckpointLevel {
  switch (mode) {
    case "submit":
      return "adaptive_required";
    case "commit":
      return "recommended";
    default:
      return "recommended";
  }
}

function looksLikeProductOrToolingPrompt(prompt: string): boolean {
  return /\b(longtable|longlongtable|hook|checkpoint|mcp|agents?|skills?|ux|interface|setup|install|cli|npm|version|global|release|deploy|git|github|readme|docs?|documentation|workflow|package|router|autocomplete|simulation test)\b/i.test(prompt)
    || /롱테이블|훅|체크포인트|에이전트|스킬|사용성|인터페이스|설치|세팅|글로벌|배포|버전|릴리즈|깃|깃허브|문서화된\s*절차|패키지|라우터|자동완성|시뮬레이션\s*테스트/.test(prompt);
}

export function classifyCheckpointTrigger(
  prompt: string,
  options: CheckpointTriggerClassificationOptions = {}
): CheckpointTriggerClassification {
  const normalizedPrompt = prompt.trim();
  if (looksLikeProductOrToolingPrompt(normalizedPrompt)) {
    return {
      signal: {
        checkpointKey: options.checkpointKey ?? "product_runtime_guidance",
        baseLevel: "recommended",
        mode: options.preferredMode ?? options.fallbackMode ?? "review",
        artifactStakes: options.artifactStakes ?? "private_note",
        researchStage: options.researchStage ?? "problem_framing",
        ...(options.unresolvedTensions ? { unresolvedTensions: options.unresolvedTensions } : {}),
        ...(options.studyContract ? { studyContract: options.studyContract } : {})
      },
      family: "advisory",
      confidence: "high",
      matchedCues: ["product_tooling"],
      requiresQuestionBeforeClosure: false,
      advisoryOnly: true,
      rationale: ["Product, tooling, and LongTable policy work should use response-only discussion unless the researcher explicitly records a research decision."]
    };
  }

  const best = pickBestRule(normalizedPrompt);
  const inferredMode = inferModeFromPlainCue(normalizedPrompt);
  const mode = options.preferredMode ?? best?.rule.mode ?? inferredMode ?? options.fallbackMode ?? "explore";
  const stage = options.researchStage ?? best?.rule.stage ?? fallbackStage(mode);
  const stakes = options.artifactStakes ?? best?.rule.stakes ?? fallbackStakes(mode);
  const family = best?.rule.family ?? (mode === "explore" ? "exploration" : "advisory");
  const level = family === "commitment" && !looksLikeCommitmentCue(normalizedPrompt)
    ? "recommended"
    : best?.rule.level ?? fallbackLevel(mode);
  const matchedCues = best?.matches ?? [];
  const checkpointKey = options.checkpointKey ?? best?.rule.checkpointKey ?? `${mode}_runtime_guidance`;
  const rationale = [
    best?.rule.rationale ?? "No strong checkpoint cue was detected; use runtime guidance without forcing closure.",
    ...(options.unresolvedTensions && options.unresolvedTensions.length > 0
      ? ["Existing unresolved tensions increase the need to keep questions visible."]
      : [])
  ];
  const questionRequired = requiresQuestion(level, mode, family);

  return {
    signal: {
      checkpointKey,
      baseLevel: level,
      mode,
      artifactStakes: stakes,
      researchStage: stage,
      ...(options.unresolvedTensions ? { unresolvedTensions: options.unresolvedTensions } : {}),
      ...(options.studyContract ? { studyContract: options.studyContract } : {})
    },
    family,
    confidence: inferConfidence(matchedCues.length, level),
    matchedCues,
    requiresQuestionBeforeClosure: questionRequired,
    advisoryOnly: !questionRequired,
    rationale
  };
}
