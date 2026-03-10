// @generated DO NOT EDIT - Generated from config/agents.json by scripts/generate.js
// Version: 11.0.0

import type {
  ModelType,
  TierLevel,
  CategoryId,
  AgentIdMapping,
} from './types.js';

// ============================================================
// AGENT ID MAPPINGS
// Maps shorthand IDs (a1, b1, etc.) to directory names
// ============================================================

export const AGENT_MAPPINGS: AgentIdMapping[] = [
  // Category A: Research Foundation (3 agents)
  { shortId: 'a1', fullId: 'diverga:a1', directoryName: 'A1-research-question-refiner' },
  { shortId: 'a2', fullId: 'diverga:a2', directoryName: 'A2-theoretical-framework-architect' },
  { shortId: 'a5', fullId: 'diverga:a5', directoryName: 'A5-paradigm-worldview-advisor' },

  // Category B: Literature & Evidence (2 agents)
  { shortId: 'b1', fullId: 'diverga:b1', directoryName: 'B1-systematic-literature-scout' },
  { shortId: 'b2', fullId: 'diverga:b2', directoryName: 'B2-evidence-quality-appraiser' },

  // Category C: Study Design (4 agents)
  { shortId: 'c1', fullId: 'diverga:c1', directoryName: 'C1-quantitative-design-consultant' },
  { shortId: 'c2', fullId: 'diverga:c2', directoryName: 'C2-qualitative-design-consultant' },
  { shortId: 'c3', fullId: 'diverga:c3', directoryName: 'C3-mixed-methods-design-consultant' },
  { shortId: 'c5', fullId: 'diverga:c5', directoryName: 'C5-meta-analysis-master' },

  // Category D: Data Collection (2 agents)
  { shortId: 'd2', fullId: 'diverga:d2', directoryName: 'D2-interview-focus-group-specialist' },
  { shortId: 'd4', fullId: 'diverga:d4', directoryName: 'D4-measurement-instrument-developer' },

  // Category E: Analysis (3 agents)
  { shortId: 'e1', fullId: 'diverga:e1', directoryName: 'E1-quantitative-analysis-guide' },
  { shortId: 'e2', fullId: 'diverga:e2', directoryName: 'E2-qualitative-coding-specialist' },
  { shortId: 'e3', fullId: 'diverga:e3', directoryName: 'E3-mixed-methods-integration' },

  // Category F: Quality & Validation (1 agents)
  { shortId: 'f5', fullId: 'diverga:f5', directoryName: 'F5-humanization-verifier' },

  // Category G: Publication & Communication (4 agents)
  { shortId: 'g1', fullId: 'diverga:g1', directoryName: 'G1-journal-matcher' },
  { shortId: 'g2', fullId: 'diverga:g2', directoryName: 'G2-academic-communicator' },
  { shortId: 'g5', fullId: 'diverga:g5', directoryName: 'G5-academic-style-auditor' },
  { shortId: 'g6', fullId: 'diverga:g6', directoryName: 'G6-academic-style-humanizer' },

  // Category I: Systematic Review Automation (4 agents)
  { shortId: 'i0', fullId: 'diverga:i0', directoryName: 'I0-scholar-agent-orchestrator' },
  { shortId: 'i1', fullId: 'diverga:i1', directoryName: 'I1-paper-retrieval-agent' },
  { shortId: 'i2', fullId: 'diverga:i2', directoryName: 'I2-screening-assistant' },
  { shortId: 'i3', fullId: 'diverga:i3', directoryName: 'I3-rag-builder' },

  // Category X: Cross-Cutting (1 agents)
  { shortId: 'x1', fullId: 'diverga:x1', directoryName: 'X1-research-guardian' },

];

// ============================================================
// AGENT METADATA DEFINITIONS
// Static metadata for each agent (tools, model, tier, etc.)
// ============================================================

interface AgentStaticConfig {
  displayName: string;
  description: string;
  model: ModelType;
  tier: TierLevel;
  tools: string[];
  icon: string;
  vsLevel: 'Full' | 'Enhanced' | 'Light';
  vsPhases: number[];
  triggers: string[];
  paradigmAffinity: string[];
  checkpoints: string[];
  creativityModules: string[];
  category: CategoryId;
  categoryName: string;
}

export const AGENT_CONFIGS: Record<string, AgentStaticConfig> = {
  // ============================================================
  // CATEGORY A: RESEARCH FOUNDATION (3 agents)
  // ============================================================

  'a1': {
    displayName: 'Research Question Refiner',
    description: 'VS-Enhanced Research Question Refiner - Prevents Mode Collapse and derives differentiated research questions. Enhanced VS 3-Phase process.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","WebSearch"],
    icon: '🎯',
    vsLevel: 'Enhanced',
    vsPhases: [0,1,2,4],
    triggers: ['research question', 'PICO', 'SPIDER', 'research idea', '연구 질문'],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["CP-INIT-002","CP-VS-001","CP-VS-003"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance"],
    category: 'A',
    categoryName: 'Research Foundation',
  },

  'a2': {
    displayName: 'Theory & Critique Architect',
    description: "VS-Enhanced Theory & Critique Architect - Combines theoretical framework design, devil's advocacy critique, ethics advising, and conceptual framework visualization. Full VS 5-Phase process.",
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","WebSearch","Write"],
    icon: '🏛️',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: [
      'theoretical framework',
      'conceptual model',
      'hypothesis derivation',
      'criticism',
      'weakness',
      'reviewer 2',
      'alternative explanation',
      'rebuttal',
      'ethics',
      'IRB',
      'consent',
      'conceptual framework',
      'framework diagram',
      '이론적 프레임워크',
      '개념적 모형',
      '비판',
      '약점',
    ],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["CP-INIT-001","CP-INIT-002","CP-INIT-003","CP-VS-001","CP-VS-002","CP-VS-003"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance","temporal-reframing","community-simulation"],
    category: 'A',
    categoryName: 'Research Foundation',
  },

  'a5': {
    displayName: 'Paradigm Advisor',
    description: 'Paradigm & Worldview Advisor - Philosophical foundations for research design. Covers ontology, epistemology, axiology.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep"],
    icon: '🌐',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: ['paradigm', 'ontology', 'epistemology', 'worldview', 'philosophical foundations', '패러다임', '세계관'],
    paradigmAffinity: ["qualitative","mixed"],
    checkpoints: ["CP-PARADIGM-001","CP-PARADIGM-002","CP-VS-001","CP-VS-002"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance","temporal-reframing","community-simulation"],
    category: 'A',
    categoryName: 'Research Foundation',
  },

  // ============================================================
  // CATEGORY B: LITERATURE & EVIDENCE (2 agents)
  // ============================================================

  'b1': {
    displayName: 'Literature Scout',
    description: 'VS-Enhanced Literature Scout - Comprehensive literature review with integrated trend monitoring, parallel document processing, and multi-methodology support including PRISMA 2020.',
    model: 'sonnet',
    tier: 'MEDIUM',
    tools: ["Read","Glob","Grep","WebSearch","Bash"],
    icon: '📚',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: [
      'literature review',
      'PRISMA',
      'systematic review',
      'scoping review',
      'meta-synthesis',
      'latest research',
      'trends',
      'new publications',
      'batch PDF',
      'parallel reading',
      'multiple documents',
      '문헌고찰',
    ],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["CP-INIT-001","CP-INIT-002","CP-INIT-003","CP-VS-001","CP-VS-002","CP-VS-003"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance","temporal-reframing","community-simulation"],
    category: 'B',
    categoryName: 'Literature & Evidence',
  },

  'b2': {
    displayName: 'Quality Appraiser',
    description: 'VS-Enhanced Quality Appraiser - Context-adaptive quality assessment with GRADE, RoB, CASP, and effect size extraction capabilities.',
    model: 'sonnet',
    tier: 'MEDIUM',
    tools: ["Read","Glob","Grep"],
    icon: '⭐',
    vsLevel: 'Enhanced',
    vsPhases: [0,1,2,4],
    triggers: ['quality appraisal', 'RoB', 'GRADE', 'Newcastle-Ottawa', 'risk of bias', 'methodological quality'],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["CP-INIT-001","CP-INIT-002","CP-VS-001"],
    creativityModules: ["forced-analogy","semantic-distance"],
    category: 'B',
    categoryName: 'Literature & Evidence',
  },

  // ============================================================
  // CATEGORY C: STUDY DESIGN (4 agents)
  // ============================================================

  'c1': {
    displayName: 'Quantitative Design & Sampling',
    description: 'VS-Enhanced Quantitative Design & Sampling - Creative quantitative design with integrated sampling strategy, experimental materials development, and sample size justification.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","Edit","Write"],
    icon: '📐',
    vsLevel: 'Enhanced',
    vsPhases: [0,1,2,4],
    triggers: [
      'RCT',
      'quasi-experimental',
      'experimental design',
      'survey design',
      'power analysis',
      'sample size',
      'factorial design',
      'sampling',
      'G*Power',
      'recruitment',
      'intervention materials',
      'experimental materials',
      'treatment design',
      'manipulation check',
      '표본추출',
      '실험설계',
    ],
    paradigmAffinity: ["quantitative"],
    checkpoints: ["CP-DESIGN-001","CP-DESIGN-002","CP-VS-001","CP-SAMPLING-001"],
    creativityModules: ["forced-analogy","semantic-distance"],
    category: 'C',
    categoryName: 'Study Design',
  },

  'c2': {
    displayName: 'Qualitative Design (Ethnography/AR)',
    description: 'VS-Enhanced Qualitative Design with Ethnography & Action Research - Comprehensive qualitative research design including phenomenology, grounded theory, case study, ethnographic fieldwork, and participatory action research.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","Edit","Write","WebSearch"],
    icon: '🔮',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: [
      'phenomenology',
      'grounded theory',
      'case study',
      'narrative inquiry',
      'ethnography',
      'qualitative design',
      'fieldwork',
      'participant observation',
      'thick description',
      'action research',
      'PAR',
      'CBPR',
      'participatory',
      '현상학',
      '근거이론',
      '사례연구',
      '문화기술지',
    ],
    paradigmAffinity: ["qualitative","mixed"],
    checkpoints: ["CP-QUAL-001","CP-QUAL-002","CP-QUAL-003","CP-VS-001","CP-VS-002","CP-VS-003","CP-ETHNO-001","CP-ETHNO-002","CP-ACTION-001"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance","temporal-reframing","community-simulation"],
    category: 'C',
    categoryName: 'Study Design',
  },

  'c3': {
    displayName: 'Mixed Methods Design',
    description: 'Mixed Methods Design Consultant - Sequential, concurrent, embedded, and multiphase designs with Morse notation.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","Edit","Write"],
    icon: '🔄',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: ['mixed methods', 'sequential design', 'convergent', 'explanatory', 'exploratory', 'Morse notation'],
    paradigmAffinity: ["mixed"],
    checkpoints: ["CP-MIXED-001","CP-MIXED-002","CP-MIXED-003","CP-VS-001","CP-VS-002","CP-VS-003"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance","temporal-reframing","community-simulation"],
    category: 'C',
    categoryName: 'Study Design',
  },

  'c5': {
    displayName: 'Meta-Analysis Master',
    description: 'Meta-Analysis Master - Multi-gate validation, workflow orchestration, Hedges g calculation, with integrated effect size extraction, data integrity guard, and error prevention.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","Edit","Write"],
    icon: '📈',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: [
      'meta-analysis',
      'pooled effect',
      'heterogeneity',
      'forest plot',
      'funnel plot',
      'effect size',
      "Cohen's d",
      "Hedges' g",
      'data integrity',
      'error prevention',
      'anomaly detection',
    ],
    paradigmAffinity: ["quantitative"],
    checkpoints: ["CP-META-001","CP-META-002","CP-META-003","CP-VS-001","CP-VS-002","CP-DATA-001","CP-ERROR-001"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance"],
    category: 'C',
    categoryName: 'Study Design',
  },

  // ============================================================
  // CATEGORY D: DATA COLLECTION (2 agents)
  // ============================================================

  'd2': {
    displayName: 'Data Collection Specialist',
    description: 'Data Collection Specialist - Interview & focus group protocol development, observation protocols, probing strategies, and transcription guidance.',
    model: 'sonnet',
    tier: 'MEDIUM',
    tools: ["Read","Glob","Grep","Edit","Write"],
    icon: '🎙️',
    vsLevel: 'Enhanced',
    vsPhases: [0,1,2,4],
    triggers: [
      'interview',
      'focus group',
      'interview protocol',
      'probing questions',
      'observation',
      'field notes',
      'participant observation',
      'observational study',
      '인터뷰',
      '관찰',
    ],
    paradigmAffinity: ["qualitative","mixed"],
    checkpoints: ["CP-INTERVIEW-001","CP-INTERVIEW-002","CP-OBSERVATION-001","CP-VS-001"],
    creativityModules: ["forced-analogy","semantic-distance"],
    category: 'D',
    categoryName: 'Data Collection',
  },

  'd4': {
    displayName: 'Instrument Developer',
    description: 'Instrument Developer - Scale construction, validity evidence, reliability testing.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","Edit","Write"],
    icon: '📏',
    vsLevel: 'Enhanced',
    vsPhases: [0,1,2,4],
    triggers: ['instrument', 'measurement', 'scale development', 'reliability', 'validity'],
    paradigmAffinity: ["quantitative","mixed"],
    checkpoints: ["CP-INSTRUMENT-001","CP-INSTRUMENT-002","CP-VS-001"],
    creativityModules: ["forced-analogy","semantic-distance"],
    category: 'D',
    categoryName: 'Data Collection',
  },

  // ============================================================
  // CATEGORY E: ANALYSIS (3 agents)
  // ============================================================

  'e1': {
    displayName: 'Quantitative Analysis & Code Gen',
    description: 'Quantitative Analysis & Code Generation - Statistical methods, SEM, multilevel modeling, meta-analysis techniques with integrated R/Python/SPSS/Mplus code generation and sensitivity analysis.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","Bash","Edit","Write"],
    icon: '📈',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: [
      'statistical analysis',
      'ANOVA',
      'regression',
      'SEM',
      'multilevel modeling',
      'R code',
      'Python code',
      'analysis code',
      'SPSS syntax',
      'Mplus syntax',
      'sensitivity analysis',
      'robustness check',
      'leave-one-out',
    ],
    paradigmAffinity: ["quantitative","mixed"],
    checkpoints: ["CP-ANALYSIS-001","CP-ANALYSIS-002","CP-ANALYSIS-003","CP-VS-001","CP-VS-002","CP-VS-003","CP-CODE-001","CP-SENSITIVITY-001"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance","temporal-reframing","community-simulation"],
    category: 'E',
    categoryName: 'Analysis',
  },

  'e2': {
    displayName: 'Qualitative Coding',
    description: 'Qualitative Coding Specialist - Thematic analysis, grounded theory coding, codebook development.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","Edit"],
    icon: '🏷️',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: ['qualitative coding', 'thematic analysis', 'grounded theory coding', 'NVivo', 'ATLAS.ti'],
    paradigmAffinity: ["qualitative","mixed"],
    checkpoints: ["CP-QUAL-ANALYSIS-001","CP-QUAL-ANALYSIS-002","CP-VS-001","CP-VS-002"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance","temporal-reframing","community-simulation"],
    category: 'E',
    categoryName: 'Analysis',
  },

  'e3': {
    displayName: 'Mixed Methods Integration',
    description: 'Mixed Methods Integration Specialist - Joint displays, data transformation, meta-inference development.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","Edit"],
    icon: '🔗',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: ['integration', 'joint display', 'mixed methods analysis', 'meta-inference'],
    paradigmAffinity: ["mixed"],
    checkpoints: ["CP-INTEGRATION-001","CP-INTEGRATION-002","CP-VS-001","CP-VS-002"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance","temporal-reframing","community-simulation"],
    category: 'E',
    categoryName: 'Analysis',
  },

  // ============================================================
  // CATEGORY F: QUALITY & VALIDATION (1 agents)
  // ============================================================

  'f5': {
    displayName: 'Humanization Verifier',
    description: 'Humanization Verifier - Citation integrity, statistical accuracy, meaning preservation, internal consistency, PRISMA/CONSORT/STROBE checklist compliance, reproducibility auditing, and bias/trustworthiness detection.',
    model: 'sonnet',
    tier: 'MEDIUM',
    tools: ["Read","Glob","Grep"],
    icon: '✅',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: [
      'verify humanization',
      'check transformation',
      'validate changes',
      'consistency',
      'alignment',
      'PRISMA',
      'CONSORT',
      'STROBE',
      'COREQ',
      'checklist',
      'reproducibility',
      'OSF',
      'open science',
      'bias',
      'p-hacking',
      'HARKing',
      'QRP',
      'trustworthiness',
    ],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["CP_HUMANIZATION_VERIFY","CP-INIT-001","CP-BIAS-001","CP-TRUST-001","CP-VS-001","CP-VS-002","CP-VS-003"],
    creativityModules: ["forced-analogy","iterative-loop","semantic-distance","temporal-reframing","community-simulation"],
    category: 'F',
    categoryName: 'Quality & Validation',
  },

  // ============================================================
  // CATEGORY G: PUBLICATION & COMMUNICATION (4 agents)
  // ============================================================

  'g1': {
    displayName: 'Journal Matcher',
    description: 'Journal Matcher - Journal recommendation, impact factor analysis, scope matching.',
    model: 'sonnet',
    tier: 'MEDIUM',
    tools: ["Read","Glob","Grep","WebSearch"],
    icon: '📝',
    vsLevel: 'Light',
    vsPhases: [0,1,4],
    triggers: ['journal', 'where to publish', 'target journal', 'impact factor'],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["CP-INIT-001"],
    creativityModules: [],
    category: 'G',
    categoryName: 'Publication & Communication',
  },

  'g2': {
    displayName: 'Publication Specialist',
    description: 'Publication Specialist - Abstract writing, plain language summaries, conference presentations, peer review response strategy, revision management, and pre-registration support.',
    model: 'sonnet',
    tier: 'MEDIUM',
    tools: ["Read","Glob","Grep","Edit","Write"],
    icon: '🎙',
    vsLevel: 'Enhanced',
    vsPhases: [0,1,2,4],
    triggers: [
      'abstract',
      'plain language',
      'academic writing',
      'manuscript',
      'peer review',
      'reviewer response',
      'revision',
      'rebuttal',
      'preregistration',
      'OSF',
      'pre-register',
      'registered report',
    ],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["CP-INIT-001","CP-REVIEW-001","CP-VS-001"],
    creativityModules: ["forced-analogy","semantic-distance"],
    category: 'G',
    categoryName: 'Publication & Communication',
  },

  'g5': {
    displayName: 'Academic Style Auditor',
    description: 'Academic Style Auditor - AI pattern detection (24 categories), probability scoring, risk classification.',
    model: 'sonnet',
    tier: 'MEDIUM',
    tools: ["Read","Glob","Grep"],
    icon: '🔍',
    vsLevel: 'Light',
    vsPhases: [0,1,4],
    triggers: ['AI pattern', 'check AI writing', 'style audit', 'AI probability'],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["CP_HUMANIZATION_REVIEW"],
    creativityModules: [],
    category: 'G',
    categoryName: 'Publication & Communication',
  },

  'g6': {
    displayName: 'Academic Style Humanizer',
    description: 'Academic Style Humanizer - Transform AI patterns to natural prose with citation preservation.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","Edit","Write"],
    icon: '✨',
    vsLevel: 'Enhanced',
    vsPhases: [0,1,2,4],
    triggers: ['humanize', 'humanization', 'natural writing', 'reduce AI patterns'],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["CP_HUMANIZATION_REVIEW","CP_HUMANIZATION_VERIFY"],
    creativityModules: ["semantic-distance"],
    category: 'G',
    categoryName: 'Publication & Communication',
  },

  // ============================================================
  // CATEGORY I: SYSTEMATIC REVIEW AUTOMATION (4 agents)
  // ============================================================

  'i0': {
    displayName: 'SR Pipeline Orchestrator',
    description: 'Systematic Review Pipeline Orchestrator - Coordinates systematic literature review automation.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","Bash","Task"],
    icon: '🔬',
    vsLevel: 'Enhanced',
    vsPhases: [0,1,2,4],
    triggers: ['systematic review', 'PRISMA', '체계적 문헌고찰', '프리즈마'],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["SCH_DATABASE_SELECTION","SCH_SCREENING_CRITERIA","SCH_RAG_READINESS","SCH_PRISMA_GENERATION"],
    creativityModules: ["forced-analogy","semantic-distance"],
    category: 'I',
    categoryName: 'Systematic Review Automation',
  },

  'i1': {
    displayName: 'Paper Retrieval',
    description: 'Paper Retrieval Agent - Multi-database paper fetching from Semantic Scholar, OpenAlex, arXiv.',
    model: 'sonnet',
    tier: 'MEDIUM',
    tools: ["Read","Glob","Grep","Bash","WebFetch"],
    icon: '📄',
    vsLevel: 'Light',
    vsPhases: [0,1,4],
    triggers: ['fetch papers', 'retrieve papers', 'database search', '논문 수집', '데이터베이스 검색'],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["SCH_DATABASE_SELECTION"],
    creativityModules: [],
    category: 'I',
    categoryName: 'Systematic Review Automation',
  },

  'i2': {
    displayName: 'Screening Assistant',
    description: 'Screening Assistant - AI-PRISMA 6-dimension screening with Groq LLM (100x cheaper).',
    model: 'sonnet',
    tier: 'MEDIUM',
    tools: ["Read","Glob","Grep","Bash"],
    icon: '🔍',
    vsLevel: 'Light',
    vsPhases: [0,1,4],
    triggers: ['screen papers', 'inclusion criteria', 'AI screening', '논문 스크리닝', '포함 기준'],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["SCH_SCREENING_CRITERIA"],
    creativityModules: [],
    category: 'I',
    categoryName: 'Systematic Review Automation',
  },

  'i3': {
    displayName: 'RAG Builder',
    description: 'RAG Builder - Vector database construction with local embeddings (zero cost).',
    model: 'haiku',
    tier: 'LOW',
    tools: ["Read","Glob","Grep","Bash"],
    icon: '🗄️',
    vsLevel: 'Light',
    vsPhases: [0,1,4],
    triggers: ['build RAG', 'vector database', 'PDF download', 'RAG 구축', 'PDF 다운로드'],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: ["SCH_RAG_READINESS"],
    creativityModules: [],
    category: 'I',
    categoryName: 'Systematic Review Automation',
  },

  // ============================================================
  // CATEGORY X: CROSS-CUTTING (1 agents)
  // ============================================================

  'x1': {
    displayName: 'Research Guardian',
    description: 'Research Guardian - Cross-cutting research integrity, ethics oversight, and quality assurance across all research phases.',
    model: 'opus',
    tier: 'HIGH',
    tools: ["Read","Glob","Grep","WebSearch"],
    icon: '🛡️',
    vsLevel: 'Full',
    vsPhases: [0,1,2,3,4,5],
    triggers: [
      'research integrity',
      'guardian',
      'oversight',
      'quality assurance',
      'research ethics',
      '연구 윤리',
      '품질 보증',
    ],
    paradigmAffinity: ["quantitative","qualitative","mixed"],
    checkpoints: [],
    creativityModules: ["forced-analogy","semantic-distance"],
    category: 'X',
    categoryName: 'Cross-Cutting',
  },

};
