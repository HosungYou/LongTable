/**
 * Diverga Checkpoint Definitions
 * Human checkpoint system for research workflow control
 */

import type { CheckpointDefinition } from './types';

/**
 * All checkpoint definitions
 */
export const CHECKPOINTS: CheckpointDefinition[] = [
  // REQUIRED (🔴)
  {
    id: 'CP_RESEARCH_DIRECTION',
    name: 'Research Direction',
    level: 'REQUIRED',
    when: 'Research question finalized',
    whatToAsk: '연구 방향이 결정되었습니다. 이 방향으로 진행해도 될까요?\nResearch direction confirmed. Should we proceed?',
    icon: '🔴',
    category: 'Research Foundation',
    agentsUsing: ['A1', 'A2'],
  },
  {
    id: 'CP_PARADIGM_SELECTION',
    name: 'Paradigm Selection',
    level: 'REQUIRED',
    when: 'Methodology approach decision',
    whatToAsk: '연구 패러다임을 선택해 주세요: 양적/질적/혼합\nPlease select research paradigm: quantitative/qualitative/mixed',
    icon: '🔴',
    category: 'Research Foundation',
    agentsUsing: ['A5', 'C1', 'C2', 'C3'],
  },
  {
    id: 'CP_THEORY_SELECTION',
    name: 'Theory Selection',
    level: 'REQUIRED',
    when: 'Framework chosen',
    whatToAsk: '이론적 프레임워크를 선택해 주세요\nPlease select theoretical framework',
    icon: '🔴',
    category: 'Research Foundation',
    agentsUsing: ['A2'],
  },
  {
    id: 'CP_METHODOLOGY_APPROVAL',
    name: 'Methodology Approval',
    level: 'REQUIRED',
    when: 'Design complete',
    whatToAsk: '연구 방법론을 승인해 주세요\nPlease approve the research methodology',
    icon: '🔴',
    category: 'Study Design',
    agentsUsing: ['C1', 'C2', 'C3', 'H1', 'H2'],
  },
  {
    id: 'CP_VS_001',
    name: 'VS Direction Selection',
    level: 'REQUIRED',
    when: 'After VS alternatives presented',
    whatToAsk: '어떤 방향으로 진행하시겠습니까? (A/B/C)\nWhich direction would you like to proceed? (A/B/C)',
    icon: '🔴',
    category: 'VS Methodology',
    agentsUsing: ['A1', 'A2', 'A3', 'B1', 'C1', 'C2', 'C3'],
  },
  {
    id: 'CP_VS_003',
    name: 'VS Final Confirmation',
    level: 'REQUIRED',
    when: 'Before executing selected option',
    whatToAsk: '선택하신 방향으로 진행합니다. 확인하시겠습니까?\nProceeding with selected direction. Confirm?',
    icon: '🔴',
    category: 'VS Methodology',
    agentsUsing: ['A1', 'A2', 'C1', 'C2', 'C3'],
  },

  // RECOMMENDED (🟠)
  {
    id: 'CP_ANALYSIS_PLAN',
    name: 'Analysis Plan',
    level: 'RECOMMENDED',
    when: 'Before analysis',
    whatToAsk: '분석 계획을 검토해 주시겠습니까?\nWould you like to review the analysis plan?',
    icon: '🟠',
    category: 'Analysis',
    agentsUsing: ['E1', 'E2', 'E3', 'C5'],
  },
  {
    id: 'CP_INTEGRATION_STRATEGY',
    name: 'Integration Strategy',
    level: 'RECOMMENDED',
    when: 'Mixed methods only',
    whatToAsk: '통합 전략을 확인해 주세요\nPlease confirm the integration strategy',
    icon: '🟠',
    category: 'Analysis',
    agentsUsing: ['C3', 'E3'],
  },
  {
    id: 'CP_QUALITY_REVIEW',
    name: 'Quality Review',
    level: 'RECOMMENDED',
    when: 'Assessment done',
    whatToAsk: '품질 평가 결과를 검토해 주세요\nPlease review the quality assessment results',
    icon: '🟠',
    category: 'Quality & Validation',
    agentsUsing: ['B2', 'F1', 'F2', 'F3', 'F4'],
  },
  {
    id: 'CP_SCREENING_CRITERIA',
    name: 'Screening Criteria',
    level: 'RECOMMENDED',
    when: 'Inclusion/exclusion criteria set',
    whatToAsk: '선정/배제 기준을 확인해 주세요\nPlease confirm inclusion/exclusion criteria',
    icon: '🟠',
    category: 'Literature & Evidence',
    agentsUsing: ['B1', 'B2'],
  },
  {
    id: 'CP_SAMPLING_STRATEGY',
    name: 'Sampling Strategy',
    level: 'RECOMMENDED',
    when: 'Sample determined',
    whatToAsk: '표본 전략을 승인해 주세요\nPlease approve the sampling strategy',
    icon: '🟠',
    category: 'Data Collection',
    agentsUsing: ['D1', 'D2'],
  },
  {
    id: 'CP_CODING_APPROACH',
    name: 'Coding Approach',
    level: 'RECOMMENDED',
    when: 'Qualitative coding setup',
    whatToAsk: '코딩 접근법을 확인해 주세요\nPlease confirm the coding approach',
    icon: '🟠',
    category: 'Analysis',
    agentsUsing: ['E2'],
  },
  {
    id: 'CP_THEME_VALIDATION',
    name: 'Theme Validation',
    level: 'RECOMMENDED',
    when: 'Themes identified',
    whatToAsk: '도출된 주제를 검증해 주세요\nPlease validate the identified themes',
    icon: '🟠',
    category: 'Analysis',
    agentsUsing: ['E2', 'E3'],
  },
  {
    id: 'CP_VS_002',
    name: 'VS Risk Warning',
    level: 'RECOMMENDED',
    when: 'When T < 0.3 selected',
    whatToAsk: '선택하신 옵션의 T-Score가 낮습니다 (T < 0.3). 계속하시겠습니까?\nSelected option has low T-Score (T < 0.3). Continue?',
    icon: '🟠',
    category: 'VS Methodology',
    agentsUsing: ['A2', 'A3', 'B1'],
  },

  // OPTIONAL (🟡)
  {
    id: 'CP_VISUALIZATION_PREFERENCE',
    name: 'Visualization Preference',
    level: 'OPTIONAL',
    when: 'Before generating visuals',
    whatToAsk: '시각화 스타일을 선택해 주세요\nPlease select visualization style',
    icon: '🟡',
    category: 'Publication & Communication',
    agentsUsing: ['A6', 'G2'],
  },
  {
    id: 'CP_SEARCH_STRATEGY',
    name: 'Search Strategy',
    level: 'OPTIONAL',
    when: 'Database selection',
    whatToAsk: '검색 전략을 확인해 주세요\nPlease confirm search strategy',
    icon: '🟡',
    category: 'Literature & Evidence',
    agentsUsing: ['B1', 'B4'],
  },
  {
    id: 'CP_WRITING_STYLE',
    name: 'Writing Style',
    level: 'OPTIONAL',
    when: 'Before writing output',
    whatToAsk: '작성 스타일을 선택해 주세요\nPlease select writing style',
    icon: '🟡',
    category: 'Publication & Communication',
    agentsUsing: ['G1', 'G2', 'G3', 'G4'],
  },
  {
    id: 'CP_PROTOCOL_DESIGN',
    name: 'Protocol Design',
    level: 'OPTIONAL',
    when: 'Interview/observation protocol',
    whatToAsk: '프로토콜 설계를 확인해 주세요\nPlease confirm protocol design',
    icon: '🟡',
    category: 'Data Collection',
    agentsUsing: ['D2', 'D3'],
  },
];

/**
 * Get checkpoint by ID
 */
export function getCheckpoint(id: string): CheckpointDefinition | undefined {
  return CHECKPOINTS.find(cp => cp.id === id);
}

/**
 * Get checkpoints by level
 */
export function getCheckpointsByLevel(level: 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL'): CheckpointDefinition[] {
  return CHECKPOINTS.filter(cp => cp.level === level);
}

/**
 * Format checkpoint for display
 */
export function formatCheckpoint(checkpoint: CheckpointDefinition): string {
  return `
${checkpoint.icon} **${checkpoint.name}** (${checkpoint.level})

${checkpoint.whatToAsk}

_When: ${checkpoint.when}_
`;
}

export default CHECKPOINTS;
