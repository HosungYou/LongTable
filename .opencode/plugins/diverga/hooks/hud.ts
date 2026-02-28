/**
 * hud.ts — Diverga HUD (Heads-Up Display) for OpenCode
 *
 * Since OpenCode has no native statusline, we inject HUD info
 * into system prompts and prompt appendices.
 */

import { loadContext } from './context-manager.js';

export type HUDPreset = 'research' | 'checkpoint' | 'memory' | 'minimal';

interface HUDConfig {
  enabled: boolean;
  preset: HUDPreset;
}

let _config: HUDConfig = { enabled: true, preset: 'research' };

// Stage definitions matching the Claude Code plugin
const STAGES: Record<string, { name: string; checkpoints: string[] }> = {
  foundation: {
    name: 'Foundation',
    checkpoints: ['CP_RESEARCH_DIRECTION', 'CP_PARADIGM_SELECTION', 'CP_SCOPE_DEFINITION']
  },
  theory: {
    name: 'Theory',
    checkpoints: ['CP_THEORY_SELECTION', 'CP_VARIABLE_DEFINITION']
  },
  methodology: {
    name: 'Methodology',
    checkpoints: ['CP_METHODOLOGY_APPROVAL']
  },
  design: {
    name: 'Design',
    checkpoints: ['CP_DATABASE_SELECTION', 'CP_SEARCH_STRATEGY', 'CP_SAMPLE_PLANNING']
  },
  execution: {
    name: 'Execution',
    checkpoints: ['CP_SCREENING_CRITERIA', 'CP_RAG_READINESS', 'CP_DATA_EXTRACTION']
  },
  analysis: {
    name: 'Analysis',
    checkpoints: ['CP_ANALYSIS_PLAN']
  },
  validation: {
    name: 'Validation',
    checkpoints: ['CP_QUALITY_GATES', 'CP_PEER_REVIEW', 'CP_PUBLICATION_READY']
  }
};

const ALL_CHECKPOINTS = Object.values(STAGES).flatMap(s => s.checkpoints);

export function setConfig(config: Partial<HUDConfig>): void {
  _config = { ..._config, ...config };
}

export function getConfig(): HUDConfig {
  return { ..._config };
}

export function setPreset(preset: HUDPreset): void {
  _config.preset = preset;
}

export function toggleHUD(): boolean {
  _config.enabled = !_config.enabled;
  return _config.enabled;
}

function getProgressBar(completed: number, total: number): string {
  const filled = Math.round((completed / Math.max(total, 1)) * 11);
  return '●'.repeat(filled) + '○'.repeat(11 - filled);
}

function calculateMemoryHealth(): number {
  const ctx = loadContext();
  if (!ctx) return 0;
  let score = 0;
  if (ctx.projectName) score += 25;
  if (ctx.paradigm) score += 20;
  if (ctx.currentStage !== undefined) score += 15;
  if (ctx.completedCheckpoints?.length) score += Math.min(20, ctx.completedCheckpoints.length * 5);
  if (ctx.decisions?.length) score += Math.min(20, ctx.decisions.length * 5);
  return Math.min(100, score);
}

function detectStage(completedCPs: string[]): string {
  const cpSet = new Set(completedCPs);
  let currentStage = 'foundation';

  for (const [stage, config] of Object.entries(STAGES)) {
    const allMet = config.checkpoints.every(cp => cpSet.has(cp));
    if (allMet) {
      currentStage = stage;
    } else {
      break;
    }
  }

  return currentStage;
}

// Render HUD line based on current preset
export function renderHUD(): string {
  if (!_config.enabled) return '';

  const ctx = loadContext();
  if (!ctx) return '🔬 No project | Use /diverga:setup';

  const completedCPs = ctx.completedCheckpoints || [];
  const stage = detectStage(completedCPs);
  const completed = completedCPs.length;
  const total = ALL_CHECKPOINTS.length;
  const memHealth = calculateMemoryHealth();
  const projectName = ctx.projectName || 'Untitled';

  switch (_config.preset) {
    case 'research':
      return `🔬 ${projectName} | Stage: ${stage} | ${getProgressBar(completed, total)} (${completed}/${total}) | 🧠 ${memHealth}%`;

    case 'checkpoint': {
      const pending = ALL_CHECKPOINTS.filter(cp => !completedCPs.includes(cp));
      return [
        `🔬 ${projectName} | ${getProgressBar(completed, total)}`,
        `   ✅ Completed: ${completed} | ⏳ Pending: ${pending.length}`,
        pending.length > 0 ? `   Next: ${pending[0]}` : '   All checkpoints complete!'
      ].join('\n');
    }

    case 'memory':
      return `🔬 ${projectName} | 🧠 Memory: ${memHealth}% | Context: ${ctx ? 'loaded' : 'empty'}`;

    case 'minimal':
      return `🔬 ${stage}`;

    default:
      return `🔬 ${projectName} | ${stage}`;
  }
}

// For system prompt injection on session.created
export function getHUDSystemPrompt(): string {
  const hud = renderHUD();
  if (!hud) return '';
  return `\n---\n📊 Project Status:\n${hud}\n---\n`;
}

// For tui.prompt.append — append after user prompt
export function getHUDPromptAppend(): string {
  const hud = renderHUD();
  if (!hud) return '';
  return `\n[${hud}]`;
}

// List available presets
export function listPresets(): { name: HUDPreset; description: string }[] {
  return [
    { name: 'research', description: 'Full status with progress bar and memory health' },
    { name: 'checkpoint', description: 'Checkpoint-focused with completion counts' },
    { name: 'memory', description: 'Memory health and context status' },
    { name: 'minimal', description: 'Just the current stage name' }
  ];
}
