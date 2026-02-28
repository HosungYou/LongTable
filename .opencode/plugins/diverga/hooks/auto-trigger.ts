/**
 * Auto-Trigger Hook
 * Detects keywords in user prompts and activates appropriate agents
 */

import type { AgentInfo } from '../types';
import { AGENT_REGISTRY, getAgent } from '../agents';

/**
 * Keyword to agent mapping with priority
 */
const KEYWORD_TRIGGERS: Array<{
  keywords: string[];
  agentId: string;
  priority: number;
}> = [
  // Category A: Research Foundation
  {
    keywords: ['research question', '연구 질문', 'pico', 'spider', 'research idea', '연구 아이디어'],
    agentId: 'A1',
    priority: 1,
  },
  {
    keywords: ['theoretical framework', '이론적 프레임워크', 'conceptual model', '개념적 모형', 'theory selection'],
    agentId: 'A2',
    priority: 1,
  },
  {
    keywords: ["devil's advocate", 'criticism', 'weakness', 'reviewer 2', 'reviewer critique', '비판', '약점'],
    agentId: 'A3',
    priority: 2,
  },
  {
    keywords: ['ethics', 'irb', 'consent', 'informed consent', '윤리', '동의서'],
    agentId: 'A4',
    priority: 2,
  },
  {
    keywords: ['paradigm', '패러다임', 'worldview', 'epistemology', 'ontology', '세계관'],
    agentId: 'A5',
    priority: 1,
  },
  {
    keywords: ['conceptual framework', 'framework visualization', 'model diagram', '개념도'],
    agentId: 'A6',
    priority: 2,
  },

  // Category B: Literature & Evidence
  {
    keywords: ['literature review', '문헌 검토', 'prisma', 'systematic review', 'scoping review', '선행연구'],
    agentId: 'B1',
    priority: 1,
  },
  {
    keywords: ['quality appraisal', 'rob', 'grade', 'risk of bias', '품질 평가'],
    agentId: 'B2',
    priority: 2,
  },
  {
    keywords: ['effect size', "cohen's d", "hedges' g", '효과크기', 'effect extraction'],
    agentId: 'B3',
    priority: 2,
  },
  {
    keywords: ['recent publications', 'research trends', 'new papers', '최신 연구'],
    agentId: 'B4',
    priority: 3,
  },
  {
    keywords: ['batch pdf', 'parallel reading', 'multiple documents', 'large files', 'document extraction', 'pdf 일괄 처리', '병렬 처리'],
    agentId: 'B5',
    priority: 2,
  },

  // Category C: Study Design
  {
    keywords: ['experimental design', 'rct', 'quasi-experimental', '실험 설계', 'quantitative design'],
    agentId: 'C1',
    priority: 1,
  },
  {
    keywords: ['phenomenology', '현상학', 'grounded theory', '근거이론', 'case study', '사례연구', 'qualitative design'],
    agentId: 'C2',
    priority: 1,
  },
  {
    keywords: ['mixed methods', '혼합방법', 'convergent', 'sequential', 'embedded design'],
    agentId: 'C3',
    priority: 1,
  },
  {
    keywords: ['intervention materials', 'experimental materials', 'treatment design', 'manipulation check', '중재 자료', '실험 자료 개발'],
    agentId: 'C4',
    priority: 2,
  },
  {
    keywords: ['meta-analysis', '메타분석', 'masem', 'pooled effect', 'heterogeneity'],
    agentId: 'C5',
    priority: 1,
  },
  {
    keywords: ['data extraction', 'pdf extract', 'extract data', 'data integrity', '데이터 추출', 'pdf 추출', '자료 추출'],
    agentId: 'C6',
    priority: 2,
  },
  {
    keywords: ['error prevention', 'anomaly detection', 'data check', '오류 방지', '검증', '데이터 확인'],
    agentId: 'C7',
    priority: 2,
  },

  // Category D: Data Collection
  {
    keywords: ['sampling', 'sample size', 'g*power', 'recruitment', 'theoretical sampling', '표집', '표본 크기', '샘플링'],
    agentId: 'D1',
    priority: 2,
  },
  {
    keywords: ['interview', 'focus group', 'interview protocol', 'probing questions', '인터뷰', '면담', '포커스 그룹'],
    agentId: 'D2',
    priority: 2,
  },
  {
    keywords: ['observation', 'field notes', 'observational study', '관찰', '관찰 프로토콜', '현장 관찰'],
    agentId: 'D3',
    priority: 3,
  },
  {
    keywords: ['instrument', 'scale development', 'reliability', 'validity', '측정 도구', '척도 개발'],
    agentId: 'D4',
    priority: 2,
  },

  // Category E: Analysis
  {
    keywords: ['statistical analysis', 'regression', 'sem', 'anova', '통계 분석', 'multilevel'],
    agentId: 'E1',
    priority: 1,
  },
  {
    keywords: ['thematic analysis', 'coding', '주제 분석', 'qualitative coding', '질적 분석'],
    agentId: 'E2',
    priority: 1,
  },
  {
    keywords: ['joint display', 'integration', 'meta-inference', '통합 분석'],
    agentId: 'E3',
    priority: 2,
  },
  {
    keywords: ['r code', 'python code', 'spss', 'stata', '분석 코드'],
    agentId: 'E4',
    priority: 3,
  },
  {
    keywords: ['sensitivity analysis', 'robustness check', 'leave-one-out', '민감도 분석', '강건성 검증'],
    agentId: 'E5',
    priority: 2,
  },

  // Category F: Quality & Validation
  {
    keywords: ['consistency check', 'internal consistency', 'alignment verification', '일관성 검토', '내적 일관성'],
    agentId: 'F1',
    priority: 3,
  },
  {
    keywords: ['consort', 'strobe', 'coreq', 'checklist', 'reporting guideline', '체크리스트', '보고 지침'],
    agentId: 'F2',
    priority: 3,
  },
  {
    keywords: ['osf', 'open science', 'reproducibility', 'replication', '재현성', '반복가능성'],
    agentId: 'F3',
    priority: 3,
  },
  {
    keywords: ['bias detection', 'trustworthiness', 'p-hacking', 'harking', 'qrp', '편향 탐지', '신뢰성'],
    agentId: 'F4',
    priority: 2,
  },
  {
    keywords: ['verify humanization', 'check transformation', 'validate changes', 'humanization verify', 'ai text check', '휴먼화 검증', 'ai 텍스트 확인'],
    agentId: 'F5',
    priority: 3,
  },

  // Category G: Publication & Communication
  {
    keywords: ['journal match', 'journal selection', 'impact factor', 'where to publish', 'target journal', '저널 매칭', '투고처', '학술지'],
    agentId: 'G1',
    priority: 3,
  },
  {
    keywords: ['abstract', 'plain language', 'academic writing', 'manuscript', '학술 글쓰기', '논문 작성', '초록'],
    agentId: 'G2',
    priority: 3,
  },
  {
    keywords: ['reviewer response', 'peer review', 'revision', '리뷰어 대응', '동료 심사'],
    agentId: 'G3',
    priority: 2,
  },
  {
    keywords: ['preregistration', 'pre-registration', 'aspredicted', 'registered report', '사전등록'],
    agentId: 'G4',
    priority: 3,
  },
  {
    keywords: ['ai pattern', 'check ai writing', 'style audit', 'ai probability', 'ai 패턴', 'ai 글쓰기 검토'],
    agentId: 'G5',
    priority: 2,
  },
  {
    keywords: ['humanize', 'humanization', 'natural writing', 'reduce ai patterns', '휴먼화', '자연스러운 글쓰기'],
    agentId: 'G6',
    priority: 2,
  },

  // Category H: Specialized
  {
    keywords: ['ethnography', 'fieldwork', '문화기술지', 'participant observation', '민족지학', '현장연구'],
    agentId: 'H1',
    priority: 1,
  },
  {
    keywords: ['action research', 'par', 'cbpr', 'participatory', '실행연구', '참여적 연구'],
    agentId: 'H2',
    priority: 1,
  },

  // Category I: Systematic Review Automation
  {
    keywords: ['systematic review automation', 'prisma pipeline', 'literature review automation', '체계적 문헌고찰', '프리즈마', '문헌고찰 자동화'],
    agentId: 'I0',
    priority: 1,
  },
  {
    keywords: ['fetch papers', 'retrieve papers', 'database search', '논문 수집', '데이터베이스 검색', '논문 검색'],
    agentId: 'I1',
    priority: 2,
  },
  {
    keywords: ['screen papers', 'inclusion criteria', 'ai screening', 'prisma screening', '논문 스크리닝', '선별', '포함 기준'],
    agentId: 'I2',
    priority: 2,
  },
  {
    keywords: ['build rag', 'vector database', 'pdf download', 'rag 구축', 'pdf 다운로드', '벡터 db'],
    agentId: 'I3',
    priority: 3,
  },
];

/**
 * Detect agent from prompt text
 */
export function autoTrigger(prompt: string): AgentInfo | null {
  const lowerPrompt = prompt.toLowerCase();

  // Find all matching triggers
  const matches: Array<{ agentId: string; priority: number; matchCount: number }> = [];

  for (const trigger of KEYWORD_TRIGGERS) {
    let matchCount = 0;
    for (const keyword of trigger.keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      matches.push({
        agentId: trigger.agentId,
        priority: trigger.priority,
        matchCount,
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Sort by: 1) match count (desc), 2) priority (asc)
  matches.sort((a, b) => {
    if (b.matchCount !== a.matchCount) {
      return b.matchCount - a.matchCount;
    }
    return a.priority - b.priority;
  });

  // Get the best match
  const bestMatch = matches[0];
  return getAgent(bestMatch.agentId);
}

/**
 * Get all triggered agents (for multi-agent scenarios)
 */
export function getAllTriggeredAgents(prompt: string): AgentInfo[] {
  const lowerPrompt = prompt.toLowerCase();
  const triggered: Set<string> = new Set();

  for (const trigger of KEYWORD_TRIGGERS) {
    for (const keyword of trigger.keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        triggered.add(trigger.agentId);
        break;
      }
    }
  }

  return Array.from(triggered)
    .map(id => getAgent(id))
    .filter((agent): agent is AgentInfo => agent !== null);
}

/**
 * Check if specific agent should be triggered
 */
export function shouldTriggerAgent(prompt: string, agentId: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  const trigger = KEYWORD_TRIGGERS.find(t => t.agentId === agentId);

  if (!trigger) return false;

  return trigger.keywords.some(keyword =>
    lowerPrompt.includes(keyword.toLowerCase())
  );
}

/**
 * Get trigger keywords for an agent
 */
export function getTriggerKeywords(agentId: string): string[] {
  const trigger = KEYWORD_TRIGGERS.find(t => t.agentId === agentId);
  return trigger?.keywords || [];
}
