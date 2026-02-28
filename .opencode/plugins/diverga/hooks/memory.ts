/**
 * memory.ts — Diverga Memory System for OpenCode
 *
 * 3-Layer Memory:
 * - Layer 1 (Keyword): Auto-detect memory keywords in prompts
 * - Layer 2 (Agent Injection): Auto-inject context when agent triggered
 * - Layer 3 (Command): Explicit /diverga:memory commands
 */

import { loadContext, saveContext, updateContext } from './context-manager.js';
import type { ResearchContext } from '../types.js';

// Layer 1: Keyword triggers for auto-loading context
const MEMORY_KEYWORDS_EN = [
  'where was i', 'where did we stop', 'continue research',
  'my research', 'research status', 'research progress',
  'last session', 'previous session', 'what were we doing'
];

const MEMORY_KEYWORDS_KO = [
  '이어서', '어디까지', '내 연구', '연구 진행', '연구 상태',
  '지난 세션', '이전 세션', '계속', '마지막'
];

export interface MemoryResult {
  triggered: boolean;
  layer: number;
  context: string;
  source: string;
}

// Layer 1: Check if prompt contains memory keywords
export function detectMemoryKeywords(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return MEMORY_KEYWORDS_EN.some(kw => lower.includes(kw)) ||
         MEMORY_KEYWORDS_KO.some(kw => lower.includes(kw));
}

// Layer 1: Load and format context for injection
export function loadMemoryContext(): MemoryResult {
  const ctx = loadContext();
  if (!ctx) {
    return {
      triggered: true, layer: 1,
      context: '📋 No research project found. Use /diverga:setup to initialize.',
      source: 'memory-layer1'
    };
  }

  const lines: string[] = [];
  lines.push('📋 **Research Context Loaded** (Memory Layer 1)');
  lines.push('');

  if (ctx.projectName) lines.push(`**Project**: ${ctx.projectName}`);
  if (ctx.projectType) lines.push(`**Type**: ${ctx.projectType}`);
  if (ctx.paradigm) lines.push(`**Paradigm**: ${ctx.paradigm}`);
  if (ctx.currentStage !== undefined) lines.push(`**Stage**: ${ctx.currentStage}`);

  if (ctx.completedCheckpoints && ctx.completedCheckpoints.length > 0) {
    lines.push('');
    lines.push(`**Completed Checkpoints** (${ctx.completedCheckpoints.length}):`);
    for (const cp of ctx.completedCheckpoints.slice(-5)) {
      lines.push(`  ✅ ${cp}`);
    }
    if (ctx.completedCheckpoints.length > 5) {
      lines.push(`  ... and ${ctx.completedCheckpoints.length - 5} more`);
    }
  }

  if (ctx.decisions && ctx.decisions.length > 0) {
    lines.push('');
    lines.push('**Recent Decisions**:');
    for (const d of ctx.decisions.slice(-3)) {
      lines.push(`  📝 ${d.checkpoint}: ${d.selected}`);
    }
  }

  return {
    triggered: true,
    layer: 1,
    context: lines.join('\n'),
    source: 'memory-layer1-keywords'
  };
}

// Layer 2: Agent context injection
export function getAgentContext(agentId: string): MemoryResult {
  const ctx = loadContext();
  if (!ctx) {
    return {
      triggered: true, layer: 2,
      context: '',
      source: `memory-layer2-agent-${agentId}`
    };
  }

  const lines: string[] = [];
  lines.push(`🔬 **Context for Agent ${agentId.toUpperCase()}**`);

  if (ctx.projectName) lines.push(`Project: ${ctx.projectName}`);
  if (ctx.paradigm) lines.push(`Paradigm: ${ctx.paradigm}`);
  if (ctx.currentStage !== undefined) lines.push(`Stage: ${ctx.currentStage}`);

  // Include relevant completed checkpoints
  if (ctx.completedCheckpoints && ctx.completedCheckpoints.length > 0) {
    lines.push(`Completed: ${ctx.completedCheckpoints.join(', ')}`);
  }

  return {
    triggered: true,
    layer: 2,
    context: lines.join('\n'),
    source: `memory-layer2-agent-${agentId}`
  };
}

// Layer 3: Command handlers
export interface MemoryCommand {
  action: 'status' | 'context' | 'decisions' | 'priority' | 'init';
  args?: string[];
}

export function parseMemoryCommand(input: string): MemoryCommand | null {
  const lower = input.toLowerCase().trim();

  if (lower.includes('memory status') || lower.includes('메모리 상태')) {
    return { action: 'status' };
  }
  if (lower.includes('memory context') || lower.includes('메모리 컨텍스트')) {
    return { action: 'context' };
  }
  if (lower.includes('decisions') || lower.includes('결정')) {
    return { action: 'decisions' };
  }
  if (lower.includes('priority') || lower.includes('우선순위')) {
    return { action: 'priority' };
  }
  if (lower.includes('memory init') || lower.includes('메모리 초기화')) {
    return { action: 'init' };
  }

  return null;
}

export function executeMemoryCommand(cmd: MemoryCommand): string {
  const ctx = loadContext();

  switch (cmd.action) {
    case 'status': {
      if (!ctx) return '📋 No research project initialized. Use /diverga:setup.';
      const cps = ctx.completedCheckpoints?.length || 0;
      return [
        '📋 **Memory Status**',
        `Project: ${ctx.projectName || 'Unknown'}`,
        `Stage: ${ctx.currentStage ?? 'not set'}`,
        `Checkpoints: ${cps} completed`,
        `Decisions: ${ctx.decisions?.length || 0} recorded`,
        `Memory Health: ${calculateHealth(ctx)}%`
      ].join('\n');
    }

    case 'context':
      return loadMemoryContext().context;

    case 'decisions': {
      if (!ctx?.decisions?.length) return '📋 No decisions recorded yet.';
      const lines = ['📋 **Decision Log**', ''];
      for (const d of ctx.decisions) {
        lines.push(`- **${d.checkpoint}**: ${d.selected}`);
        if (d.rationale) lines.push(`  _Rationale_: ${d.rationale}`);
      }
      return lines.join('\n');
    }

    case 'priority': {
      if (!ctx) return '📋 No priority context set.';
      return `📋 **Priority Context**\nProject: ${ctx.projectName || 'Not set'}\nParadigm: ${ctx.paradigm || 'Not set'}`;
    }

    case 'init':
      return '📋 Use /diverga:setup to initialize a new research project.';

    default:
      return '📋 Unknown memory command. Available: status, context, decisions, priority';
  }
}

function calculateHealth(ctx: ResearchContext): number {
  let score = 0;
  if (ctx.projectName) score += 20;
  if (ctx.projectType) score += 15;
  if (ctx.paradigm) score += 15;
  if (ctx.currentStage !== undefined) score += 10;
  if (ctx.completedCheckpoints?.length) score += Math.min(20, ctx.completedCheckpoints.length * 4);
  if (ctx.decisions?.length) score += Math.min(20, ctx.decisions.length * 5);
  return Math.min(100, score);
}
