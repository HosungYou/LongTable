/**
 * humanize-pipeline.ts — Humanization Pipeline for OpenCode
 *
 * Orchestrates: G5 (Audit) → G6 (Humanize) → F5 (Verify)
 * Sequential pipeline with checkpoint enforcement.
 */

export interface PipelineConfig {
  mode: 'conservative' | 'balanced' | 'balanced-fast' | 'aggressive';
  targetScore?: number;
  sections?: string[];
}

export interface PipelineStep {
  agent: string;
  name: string;
  description: string;
  checkpoint?: string;
  checkpointLevel?: 'required' | 'recommended' | 'optional';
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    agent: 'g5',
    name: 'AI Pattern Audit',
    description: 'Detect AI writing patterns (28 categories, 7 domains)',
    checkpoint: 'CP_HUMANIZATION_REVIEW',
    checkpointLevel: 'recommended'
  },
  {
    agent: 'g6',
    name: 'Academic Humanization',
    description: 'Transform AI patterns to natural academic prose (4-layer)',
    checkpoint: undefined // G6 has no own checkpoint, runs after G5's
  },
  {
    agent: 'f5',
    name: 'Quality Verification',
    description: 'Verify transformation integrity and quality',
    checkpoint: 'CP_HUMANIZATION_VERIFY',
    checkpointLevel: 'optional'
  }
];

export function getPipelineSteps(config: PipelineConfig): PipelineStep[] {
  // For conservative mode, only vocab pass
  if (config.mode === 'conservative') {
    return PIPELINE_STEPS;
  }

  // For multi-pass modes, steps repeat
  if (config.mode === 'balanced' || config.mode === 'aggressive') {
    const steps: PipelineStep[] = [];

    // Pass 1: Vocabulary (Layer 1-2)
    steps.push({ ...PIPELINE_STEPS[0] }); // G5 audit
    steps.push({
      agent: 'g6', name: 'Pass 1: Vocabulary',
      description: 'Layer 1-2 vocabulary and phrase transformation',
      checkpoint: 'CP_PASS1_REVIEW', checkpointLevel: 'recommended'
    });
    steps.push({ ...PIPELINE_STEPS[2], checkpoint: undefined }); // F5 quick verify

    // Pass 2: Structural (Layer 3)
    steps.push({
      agent: 'g6', name: 'Pass 2: Structural',
      description: 'Layer 3 structural transformation',
      checkpoint: 'CP_PASS2_REVIEW', checkpointLevel: 'recommended'
    });
    steps.push({ ...PIPELINE_STEPS[2], checkpoint: undefined }); // F5 verify

    if (config.mode === 'aggressive') {
      // Pass 3: Discourse (Layer 4)
      steps.push({
        agent: 'g6', name: 'Pass 3: Discourse',
        description: 'Layer 4 discourse-level transformation (DT1-DT4)',
        checkpoint: 'CP_PASS3_REVIEW', checkpointLevel: 'recommended'
      });
      steps.push({ ...PIPELINE_STEPS[2] }); // F5 full verify
    }

    return steps;
  }

  // balanced-fast: merged L1-3 single pass
  return [
    PIPELINE_STEPS[0], // G5 audit
    {
      agent: 'g6', name: 'Balanced (Fast): L1-3 Merged',
      description: 'Single-pass Layer 1-3 transformation',
      checkpoint: 'CP_PASS1_REVIEW', checkpointLevel: 'recommended'
    },
    PIPELINE_STEPS[2] // F5 verify
  ];
}

export function formatPipelineStatus(currentStep: number, totalSteps: number, stepName: string): string {
  const progress = '●'.repeat(currentStep) + '○'.repeat(totalSteps - currentStep);
  return `🔄 Humanization Pipeline [${progress}] Step ${currentStep}/${totalSteps}: ${stepName}`;
}

export function getPipelineHelp(): string {
  return [
    '✍️ **Humanization Pipeline** (G5 → G6 → F5)',
    '',
    'Transform AI-generated academic text into natural prose.',
    '',
    '**Modes:**',
    '- `conservative` — High-risk patterns only (Layer 1-2)',
    '- `balanced` — High + medium + structural (Layer 1-3)',
    '- `balanced-fast` — Same as balanced, single pass',
    '- `aggressive` — All patterns including discourse (Layer 1-4)',
    '',
    '**Usage:**',
    '- "Humanize my draft" → balanced mode',
    '- "Humanize (conservative)" → minimal changes',
    '- "Humanize to target: 30%" → target-based',
    '',
    '**Checkpoints:** CP_HUMANIZATION_REVIEW, CP_PASS1/2/3_REVIEW, CP_HUMANIZATION_VERIFY'
  ].join('\n');
}
