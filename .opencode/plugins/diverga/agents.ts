/**
 * Diverga Agent Registry
 * Static agent definitions for OpenCode plugin
 */

import type { AgentInfo } from './types';

/**
 * Complete agent registry
 */
export const AGENT_REGISTRY: Record<string, AgentInfo> = {
  // Category A: Research Foundation
  A1: {
    id: 'A1',
    name: 'Research Question Refiner',
    icon: '🔬',
    category: 'A - Research Foundation',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Enhanced',
    description: 'VS-Enhanced Research Question Refiner - Prevents Mode Collapse and derives differentiated research questions using PICO/SPIDER frameworks',
    triggers: {
      keywords: ['research question', '연구 질문', 'PICO', 'SPIDER', 'research idea'],
      context: ['research planning', 'proposal writing'],
    },
    checkpoints: ['CP_RESEARCH_DIRECTION', 'CP_VS_001', 'CP_VS_003'],
  },
  A2: {
    id: 'A2',
    name: 'Theoretical Framework Architect',
    icon: '🏛️',
    category: 'A - Research Foundation',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Full',
    description: 'VS-Enhanced Theoretical Framework Designer - Prevents Mode Collapse and recommends creative theories with full VS 5-Phase process',
    triggers: {
      keywords: ['theoretical framework', '이론적 프레임워크', 'conceptual model', '가설', 'theory'],
      context: ['theory development', 'framework design'],
    },
    checkpoints: ['CP_THEORY_SELECTION', 'CP_VS_001', 'CP_VS_002', 'CP_VS_003'],
  },
  A3: {
    id: 'A3',
    name: "Devil's Advocate",
    icon: '😈',
    category: 'A - Research Foundation',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Full',
    description: "VS-Enhanced Devil's Advocate - Prevents Mode Collapse and generates original critiques with Full VS 5-Phase process",
    triggers: {
      keywords: ['criticism', 'weakness', 'reviewer 2', 'alternative explanation', 'rebuttal', '비판', '약점'],
      context: ['research review', 'stress testing'],
    },
    checkpoints: ['CP_VS_001', 'CP_VS_003'],
  },
  A4: {
    id: 'A4',
    name: 'Research Ethics Advisor',
    icon: '⚖️',
    category: 'A - Research Foundation',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Enhanced',
    description: 'VS-Enhanced Research Ethics Advisor - Context-adaptive ethical analysis with Enhanced VS 3-Phase process',
    triggers: {
      keywords: ['ethics', 'IRB', 'consent', 'informed consent', 'privacy', 'vulnerable populations'],
      context: ['ethics review', 'IRB preparation'],
    },
    checkpoints: [],
  },
  A5: {
    id: 'A5',
    name: 'Paradigm & Worldview Advisor',
    icon: '🌍',
    category: 'A - Research Foundation',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Enhanced',
    description: 'Paradigm and Worldview Advisor - Philosophical foundations for research design covering ontology, epistemology, and axiology',
    triggers: {
      keywords: ['paradigm', '패러다임', 'ontology', 'epistemology', 'worldview', '세계관'],
      context: ['research philosophy', 'paradigm selection'],
    },
    checkpoints: ['CP_PARADIGM_SELECTION'],
  },
  A6: {
    id: 'A6',
    name: 'Conceptual Framework Visualizer',
    icon: '🎨',
    category: 'A - Research Foundation',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Full',
    description: 'VS-Enhanced Conceptual Framework Visualization Expert - Generates differentiated academic visualizations',
    triggers: {
      keywords: ['conceptual framework', '개념적 모형', 'theoretical model visualization', 'framework diagram'],
      context: ['visualization', 'model design'],
    },
    checkpoints: ['CP_VISUALIZATION_PREFERENCE'],
  },

  // Category B: Literature & Evidence
  B5: {
    id: 'B5',
    name: 'Parallel Document Processor',
    icon: '📦',
    category: 'B - Literature & Evidence',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Enhanced',
    description: 'VS-Enhanced Parallel Document Processor - Batch PDF processing with parallel workers for large-scale document extraction',
    triggers: {
      keywords: ['batch PDF', 'parallel reading', 'multiple documents', 'large files', 'document extraction', 'PDF 일괄 처리', '병렬 처리'],
      context: ['batch processing', 'document extraction'],
    },
    checkpoints: [],
  },
  B1: {
    id: 'B1',
    name: 'Literature Review Strategist',
    icon: '📚',
    category: 'B - Literature & Evidence',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Full',
    description: 'VS-Enhanced Literature Review Strategist - Comprehensive support for multiple review methodologies including PRISMA 2020',
    triggers: {
      keywords: ['literature review', 'PRISMA', 'systematic review', 'scoping review', '선행연구'],
      context: ['literature search', 'review methodology'],
    },
    checkpoints: ['CP_SCREENING_CRITERIA', 'CP_SEARCH_STRATEGY', 'CP_VS_001'],
  },
  B2: {
    id: 'B2',
    name: 'Evidence Quality Appraiser',
    icon: '🔍',
    category: 'B - Literature & Evidence',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Enhanced',
    description: 'VS-Enhanced Evidence Quality Appraiser - Context-adaptive quality assessment with GRADE, RoB, CASP',
    triggers: {
      keywords: ['quality appraisal', 'RoB', 'GRADE', 'risk of bias', 'methodological quality'],
      context: ['quality assessment', 'evidence grading'],
    },
    checkpoints: ['CP_QUALITY_REVIEW'],
  },
  B3: {
    id: 'B3',
    name: 'Effect Size Extractor',
    icon: '📊',
    category: 'B - Literature & Evidence',
    tier: 'LOW',
    claudeModel: 'haiku',
    vsLevel: 'Enhanced',
    description: 'VS-Enhanced Effect Size Extractor - Optimal effect size strategy with context-appropriate selection',
    triggers: {
      keywords: ['effect size', "Cohen's d", "Hedges' g", 'correlation', 'conversion'],
      context: ['effect size calculation', 'data extraction'],
    },
    checkpoints: [],
  },
  B4: {
    id: 'B4',
    name: 'Research Radar',
    icon: '📡',
    category: 'B - Literature & Evidence',
    tier: 'LOW',
    claudeModel: 'haiku',
    vsLevel: 'Enhanced',
    description: 'VS-Enhanced Research Radar - Differentiated trend analysis for strategic research monitoring',
    triggers: {
      keywords: ['latest research', 'trends', 'new publications', 'recent papers'],
      context: ['trend tracking', 'current literature'],
    },
    checkpoints: [],
  },

  // Category C: Study Design
  C4: {
    id: 'C4',
    name: 'Experimental Materials Developer',
    icon: '🧪',
    category: 'C - Study Design',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Enhanced',
    description: 'Experimental Materials Developer - Develops intervention materials, treatment designs, and manipulation checks for experimental studies',
    triggers: {
      keywords: ['intervention materials', 'experimental materials', 'treatment design', 'manipulation check', '중재 자료', '실험 자료 개발'],
      context: ['experimental design', 'material development'],
    },
    checkpoints: [],
  },
  C6: {
    id: 'C6',
    name: 'Data Integrity Guard',
    icon: '🛡️',
    category: 'C - Study Design',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Enhanced',
    description: 'Data Integrity Guard - Data completeness verification, Hedges g calculation, SD recovery for meta-analysis data extraction',
    triggers: {
      keywords: ['data extraction', 'PDF extract', 'extract data', 'data integrity', '데이터 추출', 'PDF 추출', '자료 추출'],
      context: ['data extraction', 'integrity checking'],
    },
    checkpoints: [],
  },
  C7: {
    id: 'C7',
    name: 'Error Prevention Engine',
    icon: '⚙️',
    category: 'C - Study Design',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Enhanced',
    description: 'Error Prevention Engine - Pattern detection, anomaly alerts, error prevention for meta-analysis pipelines',
    triggers: {
      keywords: ['error prevention', 'validation', 'data check', 'anomaly detection', '오류 방지', '검증', '데이터 확인'],
      context: ['error prevention', 'data validation'],
    },
    checkpoints: [],
  },
  C1: {
    id: 'C1',
    name: 'Quantitative Design Consultant',
    icon: '📈',
    category: 'C - Study Design',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Enhanced',
    description: 'VS-Enhanced Quantitative Design Consultant - Creative quantitative design options with context-optimal strategies',
    triggers: {
      keywords: ['RCT', 'quasi-experimental', 'experimental design', 'survey design', 'power analysis'],
      context: ['quantitative research', 'experimental design'],
    },
    checkpoints: ['CP_METHODOLOGY_APPROVAL', 'CP_VS_001', 'CP_VS_003'],
  },
  C2: {
    id: 'C2',
    name: 'Qualitative Design Consultant',
    icon: '🎙️',
    category: 'C - Study Design',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Full',
    description: 'VS-Enhanced Qualitative Design Consultant - Comprehensive qualitative research design support',
    triggers: {
      keywords: ['phenomenology', '현상학', 'grounded theory', '근거이론', 'case study', '사례연구'],
      context: ['qualitative research', 'methodology selection'],
    },
    checkpoints: ['CP_PARADIGM_SELECTION', 'CP_METHODOLOGY_APPROVAL', 'CP_VS_001'],
  },
  C3: {
    id: 'C3',
    name: 'Mixed Methods Design Consultant',
    icon: '🔀',
    category: 'C - Study Design',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Full',
    description: 'Mixed Methods Design Consultant - Sequential, concurrent, embedded, and multiphase designs with Morse notation',
    triggers: {
      keywords: ['mixed methods', '혼합방법', 'sequential', 'convergent', 'embedded'],
      context: ['mixed methods', 'integration design'],
    },
    checkpoints: ['CP_PARADIGM_SELECTION', 'CP_METHODOLOGY_APPROVAL', 'CP_INTEGRATION_STRATEGY'],
  },
  C5: {
    id: 'C5',
    name: 'Meta-Analysis Master',
    icon: '📊',
    category: 'C - Study Design',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Full',
    description: 'Meta-Analysis Master - Multi-gate validation, workflow orchestration, Hedges g calculation',
    triggers: {
      keywords: ['meta-analysis', '메타분석', 'MASEM', 'forest plot', 'heterogeneity'],
      context: ['meta-analysis', 'effect pooling'],
    },
    checkpoints: ['CP_METHODOLOGY_APPROVAL', 'CP_ANALYSIS_PLAN'],
  },

  // Category D: Data Collection
  D1: {
    id: 'D1',
    name: 'Sampling Strategy Advisor',
    icon: '🎯',
    category: 'D - Data Collection',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Enhanced',
    description: 'Sampling Strategy Advisor - Sample size calculation, G*Power, recruitment strategies, theoretical sampling for qualitative research',
    triggers: {
      keywords: ['sampling', 'sample size', 'G*Power', 'recruitment', 'theoretical sampling', '표집', '표본 크기', '샘플링'],
      context: ['sampling design', 'participant recruitment'],
    },
    checkpoints: ['CP_SAMPLING_STRATEGY'],
  },
  D2: {
    id: 'D2',
    name: 'Interview & Focus Group Specialist',
    icon: '🎙️',
    category: 'D - Data Collection',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Enhanced',
    description: 'Interview & Focus Group Specialist - Protocol design, probing questions, focus group facilitation guides',
    triggers: {
      keywords: ['interview', 'focus group', 'interview protocol', 'probing questions', '인터뷰', '면담', '포커스 그룹'],
      context: ['interview design', 'qualitative data collection'],
    },
    checkpoints: ['CP_SAMPLING_STRATEGY'],
  },
  D3: {
    id: 'D3',
    name: 'Observation Protocol Designer',
    icon: '👁️',
    category: 'D - Data Collection',
    tier: 'LOW',
    claudeModel: 'haiku',
    vsLevel: 'Enhanced',
    description: 'Observation Protocol Designer - Observation frameworks, field notes templates, participant observation protocols',
    triggers: {
      keywords: ['observation', 'field notes', 'participant observation', 'observational study', '관찰', '관찰 프로토콜', '현장 관찰'],
      context: ['observation design', 'field research'],
    },
    checkpoints: [],
  },
  D4: {
    id: 'D4',
    name: 'Measurement Instrument Developer',
    icon: '📏',
    category: 'D - Data Collection',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Enhanced',
    description: 'Measurement Instrument Developer - Scale development, reliability and validity testing, survey instrument design',
    triggers: {
      keywords: ['instrument', 'measurement', 'scale development', 'reliability', 'validity', '측정 도구', '척도 개발'],
      context: ['instrument development', 'psychometrics'],
    },
    checkpoints: ['CP_METHODOLOGY_APPROVAL'],
  },

  // Category E: Analysis
  E1: {
    id: 'E1',
    name: 'Quantitative Analysis Guide',
    icon: '🔢',
    category: 'E - Analysis',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Full',
    description: 'Quantitative Analysis Guide - Statistical methods, SEM, multilevel modeling, meta-analysis techniques',
    triggers: {
      keywords: ['statistical analysis', 'regression', 'SEM', 'ANOVA', 'multilevel', '통계 분석'],
      context: ['quantitative analysis', 'statistical methods'],
    },
    checkpoints: ['CP_ANALYSIS_PLAN'],
  },
  E2: {
    id: 'E2',
    name: 'Qualitative Coding Specialist',
    icon: '🏷️',
    category: 'E - Analysis',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Full',
    description: 'Qualitative Coding Specialist - Thematic analysis, grounded theory coding, codebook development',
    triggers: {
      keywords: ['thematic analysis', 'coding', 'codebook', '질적 분석'],
      context: ['qualitative analysis', 'coding process'],
    },
    checkpoints: ['CP_CODING_APPROACH', 'CP_THEME_VALIDATION'],
  },
  E3: {
    id: 'E3',
    name: 'Mixed Methods Integration Specialist',
    icon: '🔗',
    category: 'E - Analysis',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Full',
    description: 'Mixed Methods Integration Specialist - Joint displays, data transformation, meta-inference development',
    triggers: {
      keywords: ['joint display', 'data transformation', 'meta-inference', 'integration'],
      context: ['mixed methods integration', 'data merging'],
    },
    checkpoints: ['CP_INTEGRATION_STRATEGY'],
  },
  E4: {
    id: 'E4',
    name: 'Analysis Code Generator',
    icon: '💻',
    category: 'E - Analysis',
    tier: 'LOW',
    claudeModel: 'haiku',
    vsLevel: 'Light',
    description: 'Analysis Code Generator - R, Python, SPSS, Stata, Mplus syntax generation',
    triggers: {
      keywords: ['R code', 'Python code', 'SPSS syntax', 'Stata', '분석 코드'],
      context: ['code generation', 'analysis scripts'],
    },
    checkpoints: [],
  },

  E5: {
    id: 'E5',
    name: 'Sensitivity Analysis Designer',
    icon: '🔭',
    category: 'E - Analysis',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Enhanced',
    description: 'Sensitivity Analysis Designer - Robustness checks, leave-one-out analysis, subgroup analysis for validating findings',
    triggers: {
      keywords: ['sensitivity analysis', 'robustness check', 'leave-one-out', '민감도 분석', '강건성 검증'],
      context: ['sensitivity analysis', 'robustness testing'],
    },
    checkpoints: [],
  },

  // Category F: Quality & Validation
  F1: {
    id: 'F1',
    name: 'Internal Consistency Checker',
    icon: '✅',
    category: 'F - Quality & Validation',
    tier: 'LOW',
    claudeModel: 'haiku',
    vsLevel: 'Light',
    description: 'Internal Consistency Checker - Logical verification, alignment checking across research sections for coherence',
    triggers: {
      keywords: ['consistency', 'alignment', 'logical verification', 'internal consistency', '일관성 검토', '내적 일관성'],
      context: ['consistency checking', 'quality assurance'],
    },
    checkpoints: [],
  },
  F2: {
    id: 'F2',
    name: 'Checklist Manager',
    icon: '📋',
    category: 'F - Quality & Validation',
    tier: 'LOW',
    claudeModel: 'haiku',
    vsLevel: 'Light',
    description: 'Checklist Manager - CONSORT, STROBE, COREQ, PRISMA, and other reporting guidelines compliance verification',
    triggers: {
      keywords: ['CONSORT', 'STROBE', 'COREQ', 'checklist', 'reporting guideline', '체크리스트', '보고 지침'],
      context: ['reporting guidelines', 'checklist compliance'],
    },
    checkpoints: [],
  },
  F3: {
    id: 'F3',
    name: 'Reproducibility Auditor',
    icon: '🔁',
    category: 'F - Quality & Validation',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Light',
    description: 'Reproducibility Auditor - OSF registration, open science practices, replication readiness assessment',
    triggers: {
      keywords: ['reproducibility', 'OSF', 'open science', 'replication', '재현성', '반복가능성'],
      context: ['reproducibility', 'open science'],
    },
    checkpoints: [],
  },
  F4: {
    id: 'F4',
    name: 'Bias & Trustworthiness Detector',
    icon: '🔎',
    category: 'F - Quality & Validation',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Full',
    description: 'Bias & Trustworthiness Detector - p-hacking detection, HARKing identification, QRP screening, credibility assessment',
    triggers: {
      keywords: ['bias detection', 'trustworthiness', 'p-hacking', 'HARKing', 'QRP', '편향 탐지', '신뢰성'],
      context: ['bias detection', 'research quality'],
    },
    checkpoints: [],
  },
  F5: {
    id: 'F5',
    name: 'Humanization Verifier',
    icon: '🧬',
    category: 'F - Quality & Validation',
    tier: 'LOW',
    claudeModel: 'haiku',
    vsLevel: 'Light',
    description: 'Humanization Verifier - 8-domain verification of humanized academic text including discourse naturalness and typographic correctness',
    triggers: {
      keywords: ['verify humanization', 'check transformation', 'validate changes', 'humanization verify', 'AI text check', '휴먼화 검증', 'AI 텍스트 확인'],
      context: ['humanization verification', 'AI text checking'],
    },
    checkpoints: [],
  },

  // Category G: Publication & Communication
  G1: {
    id: 'G1',
    name: 'Journal Matcher',
    icon: '📰',
    category: 'G - Publication & Communication',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Light',
    description: 'Journal Matcher - Real-time journal matching using OpenAlex + Crossref APIs with checkpoint-based journal selection pipeline',
    triggers: {
      keywords: ['journal match', 'where to publish', 'target journal', 'impact factor', '저널 매칭', '투고처', '학술지'],
      context: ['journal selection', 'publication strategy'],
    },
    checkpoints: ['CP_JOURNAL_PRIORITIES', 'CP_JOURNAL_SELECTION'],
  },
  G2: {
    id: 'G2',
    name: 'Academic Communicator',
    icon: '✍️',
    category: 'G - Publication & Communication',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Light',
    description: 'Academic Communicator - Abstract writing, plain language summaries, manuscript preparation and academic writing support',
    triggers: {
      keywords: ['abstract', 'plain language', 'academic writing', 'manuscript', '학술 글쓰기', '논문 작성', '초록'],
      context: ['academic writing', 'manuscript preparation'],
    },
    checkpoints: [],
  },
  G4: {
    id: 'G4',
    name: 'Pre-registration Composer',
    icon: '📝',
    category: 'G - Publication & Communication',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Light',
    description: 'Pre-registration Composer - OSF pre-registration, AsPredicted templates, registered reports preparation',
    triggers: {
      keywords: ['preregistration', 'OSF', 'pre-register', 'registered report', '사전등록', 'AsPredicted'],
      context: ['preregistration', 'open science'],
    },
    checkpoints: [],
  },
  G5: {
    id: 'G5',
    name: 'Academic Style Auditor',
    icon: '🔬',
    category: 'G - Publication & Communication',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Light',
    description: 'Academic Style Auditor v3.0 - 28 AI pattern categories across 7 domains, 13 quantitative metrics, v3.0 composite scoring',
    triggers: {
      keywords: ['AI pattern', 'check AI writing', 'style audit', 'AI probability', 'AI 패턴', 'AI 글쓰기 검토'],
      context: ['AI pattern detection', 'style analysis'],
    },
    checkpoints: ['CP_HUMANIZATION_REVIEW'],
  },
  G6: {
    id: 'G6',
    name: 'Academic Style Humanizer',
    icon: '🪄',
    category: 'G - Publication & Communication',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Enhanced',
    description: 'Academic Style Humanizer v3.0 - 4-layer transformation (vocab/phrase/structure/discourse) with DT1-DT4 discourse transformation',
    triggers: {
      keywords: ['humanize', 'humanization', 'natural writing', 'reduce AI patterns', '휴먼화', '자연스러운 글쓰기'],
      context: ['humanization', 'academic writing'],
    },
    checkpoints: ['CP_HUMANIZATION_VERIFY'],
  },

  G3: {
    id: 'G3',
    name: 'Peer Review Strategist',
    icon: '👥',
    category: 'G - Publication & Communication',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Enhanced',
    description: 'Peer Review Strategist - Reviewer comment analysis, response letter drafting, revision strategy',
    triggers: {
      keywords: ['reviewer', 'peer review', 'revision', 'response letter', '리뷰어 대응'],
      context: ['peer review', 'revision response'],
    },
    checkpoints: [],
  },

  // Category I: Systematic Review Automation
  I0: {
    id: 'I0',
    name: 'Systematic Review Orchestrator',
    icon: '🎼',
    category: 'I - Systematic Review Automation',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Enhanced',
    description: 'Systematic Review Orchestrator - PRISMA 2020 pipeline coordination, stage management, team lead for automated systematic review',
    triggers: {
      keywords: ['systematic review', 'PRISMA', 'literature review automation', '체계적 문헌고찰', '프리즈마', '문헌고찰 자동화'],
      context: ['systematic review', 'PRISMA pipeline'],
    },
    checkpoints: ['SCH_DATABASE_SELECTION', 'SCH_SCREENING_CRITERIA', 'SCH_RAG_READINESS'],
  },
  I1: {
    id: 'I1',
    name: 'Paper Retrieval Agent',
    icon: '📥',
    category: 'I - Systematic Review Automation',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Light',
    description: 'Paper Retrieval Agent - Multi-database paper fetching from Semantic Scholar, OpenAlex, arXiv with API key validation',
    triggers: {
      keywords: ['fetch papers', 'retrieve papers', 'database search', '논문 수집', '데이터베이스 검색', '논문 검색'],
      context: ['paper retrieval', 'database search'],
    },
    checkpoints: ['SCH_DATABASE_SELECTION', 'SCH_API_KEY_VALIDATION'],
  },
  I2: {
    id: 'I2',
    name: 'Screening Assistant',
    icon: '🔬',
    category: 'I - Systematic Review Automation',
    tier: 'MEDIUM',
    claudeModel: 'sonnet',
    vsLevel: 'Light',
    description: 'Screening Assistant - AI-PRISMA 6-dimension screening with inclusion/exclusion criteria application',
    triggers: {
      keywords: ['screen papers', 'inclusion criteria', 'AI screening', '논문 스크리닝', '선별', '포함 기준'],
      context: ['paper screening', 'PRISMA filtering'],
    },
    checkpoints: ['SCH_SCREENING_CRITERIA'],
  },
  I3: {
    id: 'I3',
    name: 'RAG Builder',
    icon: '🏗️',
    category: 'I - Systematic Review Automation',
    tier: 'LOW',
    claudeModel: 'haiku',
    vsLevel: 'Light',
    description: 'RAG Builder - Vector database construction for systematic review papers with zero-cost embedding strategy',
    triggers: {
      keywords: ['build RAG', 'vector database', 'PDF download', 'RAG 구축', 'PDF 다운로드', '벡터 DB'],
      context: ['RAG construction', 'vector database'],
    },
    checkpoints: ['SCH_RAG_READINESS'],
  },

  // Category H: Specialized
  H1: {
    id: 'H1',
    name: 'Ethnographic Research Advisor',
    icon: '🌐',
    category: 'H - Specialized Approaches',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Full',
    description: 'Ethnographic Research Advisor - Fieldwork planning, cultural immersion, thick description guidance',
    triggers: {
      keywords: ['ethnography', 'fieldwork', 'participant observation', '문화기술지'],
      context: ['ethnographic research', 'cultural studies'],
    },
    checkpoints: ['CP_METHODOLOGY_APPROVAL'],
  },
  H2: {
    id: 'H2',
    name: 'Action Research Facilitator',
    icon: '🎬',
    category: 'H - Specialized Approaches',
    tier: 'HIGH',
    claudeModel: 'opus',
    vsLevel: 'Light',
    description: 'Action Research Facilitator - PAR, CBPR, action research cycles, stakeholder collaboration',
    triggers: {
      keywords: ['action research', 'PAR', 'CBPR', 'participatory', '실행연구'],
      context: ['action research', 'participatory research'],
    },
    checkpoints: ['CP_METHODOLOGY_APPROVAL'],
  },
};

/**
 * Get agent by ID
 */
export function getAgent(agentId: string): AgentInfo | null {
  return AGENT_REGISTRY[agentId.toUpperCase()] || null;
}

/**
 * List all agents
 */
export function listAgents(): AgentInfo[] {
  return Object.values(AGENT_REGISTRY);
}

/**
 * Get agents by category
 */
export function getAgentsByCategory(category: string): AgentInfo[] {
  return Object.values(AGENT_REGISTRY).filter(
    agent => agent.category === category || agent.category.startsWith(category)
  );
}

/**
 * Get agents by tier
 */
export function getAgentsByTier(tier: 'HIGH' | 'MEDIUM' | 'LOW'): AgentInfo[] {
  return Object.values(AGENT_REGISTRY).filter(agent => agent.tier === tier);
}

export default AGENT_REGISTRY;
