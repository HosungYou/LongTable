/**
 * review-pipeline.ts — Systematic Review Pipeline for OpenCode
 *
 * Orchestrates: I0 → I1 → I2 → I3
 * PRISMA 2020 compliant systematic literature review automation.
 */

export interface ReviewPipelineConfig {
  databases?: string[];
  maxPapers?: number;
  screeningModel?: string;
}

export interface ReviewStage {
  agent: string;
  name: string;
  description: string;
  checkpoint?: string;
  checkpointLevel?: 'required' | 'recommended' | 'optional';
  dependencies: string[];
}

const REVIEW_STAGES: ReviewStage[] = [
  {
    agent: 'i0',
    name: 'Pipeline Orchestration',
    description: 'Coordinate 7-stage PRISMA 2020 pipeline',
    dependencies: []
  },
  {
    agent: 'i1',
    name: 'Paper Retrieval',
    description: 'Multi-database fetching (Semantic Scholar, OpenAlex, arXiv)',
    checkpoint: 'SCH_DATABASE_SELECTION',
    checkpointLevel: 'required',
    dependencies: []
  },
  {
    agent: 'i2',
    name: 'Paper Screening',
    description: 'AI-PRISMA 6-dimension screening with inclusion/exclusion',
    checkpoint: 'SCH_SCREENING_CRITERIA',
    checkpointLevel: 'required',
    dependencies: ['SCH_DATABASE_SELECTION']
  },
  {
    agent: 'i3',
    name: 'RAG Building',
    description: 'Vector database construction with local embeddings',
    checkpoint: 'SCH_RAG_READINESS',
    checkpointLevel: 'recommended',
    dependencies: ['SCH_SCREENING_CRITERIA']
  }
];

export function getReviewStages(): ReviewStage[] {
  return [...REVIEW_STAGES];
}

export function getNextStage(completedCheckpoints: string[]): ReviewStage | null {
  const cpSet = new Set(completedCheckpoints);

  for (const stage of REVIEW_STAGES) {
    // Skip stages without checkpoints (i0 orchestrator)
    if (!stage.checkpoint) continue;

    // Check if this stage's checkpoint is already completed
    if (cpSet.has(stage.checkpoint)) continue;

    // Check if all dependencies are met
    const depsMet = stage.dependencies.every(dep => cpSet.has(dep));
    if (!depsMet) continue;

    // This is the next stage to execute
    return stage;
  }

  return null; // All stages complete
}

export function formatReviewStatus(completedCheckpoints: string[]): string {
  const cpSet = new Set(completedCheckpoints);
  const lines: string[] = ['📚 **Systematic Review Pipeline** (PRISMA 2020)', ''];

  for (const stage of REVIEW_STAGES) {
    if (!stage.checkpoint) {
      lines.push(`  🔧 ${stage.name} — Orchestrator`);
      continue;
    }

    const completed = cpSet.has(stage.checkpoint);
    const depsMet = stage.dependencies.every(dep => cpSet.has(dep));

    if (completed) {
      lines.push(`  ✅ ${stage.name} — Complete`);
    } else if (depsMet) {
      lines.push(`  ⏳ ${stage.name} — Ready (${stage.checkpoint})`);
    } else {
      const missing = stage.dependencies.filter(dep => !cpSet.has(dep));
      lines.push(`  🔒 ${stage.name} — Blocked by: ${missing.join(', ')}`);
    }
  }

  return lines.join('\n');
}

export function getReviewPipelineHelp(): string {
  return [
    '📚 **Systematic Review Pipeline** (I0 → I1 → I2 → I3)',
    '',
    'PRISMA 2020 compliant automated literature review.',
    '',
    '**Stages:**',
    '1. I0 — Pipeline Orchestration (coordinate all stages)',
    '2. I1 — Paper Retrieval (Semantic Scholar, OpenAlex, arXiv)',
    '   🔴 Checkpoint: SCH_DATABASE_SELECTION',
    '3. I2 — Paper Screening (AI-PRISMA 6-dimension)',
    '   🔴 Checkpoint: SCH_SCREENING_CRITERIA',
    '4. I3 — RAG Building (vector database, local embeddings)',
    '   🟠 Checkpoint: SCH_RAG_READINESS',
    '',
    '**Usage:**',
    '- "/diverga:review-pipeline" — Start from current stage',
    '- "체계적 문헌고찰 시작" — Auto-detect and start',
    '',
    '**Prerequisites:**',
    '- SCH_DATABASE_SELECTION → required before I2',
    '- SCH_SCREENING_CRITERIA → required before I3'
  ].join('\n');
}

export function validateDatabases(databases: string[]): { valid: string[]; invalid: string[] } {
  const SUPPORTED = ['semantic_scholar', 'openalex', 'arxiv', 'scopus', 'wos', 'pubmed'];
  const valid = databases.filter(db => SUPPORTED.includes(db.toLowerCase()));
  const invalid = databases.filter(db => !SUPPORTED.includes(db.toLowerCase()));
  return { valid, invalid };
}
