/**
 * Checkpoint Enforcer Hook
 * Ensures human checkpoints are respected in research workflow
 */

import type { PluginContext, HookResult, ToolParams, CheckpointPrompt } from '../types';
import { CHECKPOINTS } from '../checkpoints';
import { loadContext, addCompletedCheckpoint } from './context-manager';
import prereqMapData from '../mcp/agent-prerequisite-map.json';

// Build prerequisites map from JSON SSoT (agent-prerequisite-map.json)
const AGENT_PREREQUISITES: Record<string, string[]> = {};
for (const [agentId, agentData] of Object.entries(prereqMapData.agents)) {
  AGENT_PREREQUISITES[agentId] = (agentData as { prerequisites: string[] }).prerequisites || [];
}

/**
 * Result shape from MCP prerequisite check
 */
interface CheckResult {
  approved: boolean;
  missing: string[];
  message: string;
}

/**
 * Try checking prerequisites via MCP diverga_check_prerequisites tool.
 * Returns null if MCP is unavailable or the call fails.
 */
async function checkPrerequisitesMCP(agentId: string, context: PluginContext): Promise<CheckResult | null> {
  try {
    if (context?.mcp?.call) {
      const result = await (context.mcp as any).call('diverga_check_prerequisites', { agent_id: agentId });
      if (result) {
        return {
          approved: result.approved ?? false,
          missing: result.missing || [],
          message: result.message || '',
        };
      }
    }
    return null; // MCP not available
  } catch {
    return null; // MCP failed, use fallback
  }
}

/**
 * Map of tool actions to checkpoints they should trigger
 */
const CHECKPOINT_TRIGGERS: Record<string, string[]> = {
  // Research direction decisions
  'research_question': ['CP_RESEARCH_DIRECTION', 'CP_VS_001'],
  'refine_question': ['CP_RESEARCH_DIRECTION', 'CP_VS_001'],

  // Paradigm selection
  'select_paradigm': ['CP_PARADIGM_SELECTION'],
  'methodology_selection': ['CP_PARADIGM_SELECTION'],

  // Theory selection
  'select_theory': ['CP_THEORY_SELECTION', 'CP_VS_001'],
  'framework_design': ['CP_THEORY_SELECTION', 'CP_VS_001'],

  // Methodology approval
  'design_methodology': ['CP_METHODOLOGY_APPROVAL'],
  'approve_design': ['CP_METHODOLOGY_APPROVAL'],

  // Analysis
  'start_analysis': ['CP_ANALYSIS_PLAN'],
  'analyze': ['CP_ANALYSIS_PLAN'],

  // Quality review
  'quality_assessment': ['CP_QUALITY_REVIEW'],
  'assess_quality': ['CP_QUALITY_REVIEW'],

  // VS methodology
  'vs_selection': ['CP_VS_001', 'CP_VS_003'],
  'select_direction': ['CP_VS_001', 'CP_VS_003'],
};

/**
 * Check if checkpoint is already completed
 */
function isCheckpointCompleted(checkpointId: string, context: PluginContext): boolean {
  const researchContext = loadContext();
  if (!researchContext) return false;
  return researchContext.completedCheckpoints.includes(checkpointId);
}

/**
 * Get checkpoint definition
 */
function getCheckpointDefinition(checkpointId: string) {
  return CHECKPOINTS.find(cp => cp.id === checkpointId);
}

/**
 * Create checkpoint prompt for user
 */
function createCheckpointPrompt(checkpointId: string): CheckpointPrompt | null {
  const checkpoint = getCheckpointDefinition(checkpointId);
  if (!checkpoint) return null;

  return {
    id: checkpoint.id,
    level: checkpoint.level,
    message: `
${checkpoint.icon} **${checkpoint.name}** (${checkpoint.level})

${checkpoint.whatToAsk}

_When: ${checkpoint.when}_
`,
    options: [
      { id: 'approve', label: 'Approve / 승인', description: 'Proceed with current direction' },
      { id: 'modify', label: 'Modify / 수정', description: 'Request changes before proceeding' },
      { id: 'cancel', label: 'Cancel / 취소', description: 'Stop and reconsider' },
    ],
  };
}

/**
 * Main checkpoint enforcer hook
 */
export async function checkpointEnforcer(
  params: ToolParams,
  context: PluginContext
): Promise<HookResult> {
  // Get tool action
  const action = params.arguments?.action as string;
  const toolName = params.tool;

  // Check if this action triggers any checkpoints
  const triggerKey = action || toolName;
  const checkpointIds = CHECKPOINT_TRIGGERS[triggerKey] || [];

  if (checkpointIds.length === 0) {
    // No checkpoint required
    return { proceed: true };
  }

  // Try MCP-first prerequisite check when agent ID is available
  const agentId = params.arguments?.agent_id as string | undefined;
  if (agentId) {
    const mcpResult = await checkPrerequisitesMCP(agentId, context);
    if (mcpResult !== null) {
      // MCP responded — use its result
      if (!mcpResult.approved && mcpResult.missing.length > 0) {
        const firstMissing = mcpResult.missing[0];
        const prompt = createCheckpointPrompt(firstMissing);
        return {
          proceed: true,
          message: `⚠️ WARNING: ${mcpResult.message || `Missing prerequisites: ${mcpResult.missing.join(', ')}`}`,
          checkpoint: prompt || undefined,
        };
      }
      return { proceed: true };
    }
    // MCP unavailable — fall through to local file check
  }

  // Local file fallback: Check agent prerequisites from JSON map first
  if (agentId) {
    const normalizedId = agentId.toLowerCase();
    const prereqs = AGENT_PREREQUISITES[normalizedId] || [];
    for (const prereqId of prereqs) {
      if (!isCheckpointCompleted(prereqId, context)) {
        const prompt = createCheckpointPrompt(prereqId);
        const checkpoint = getCheckpointDefinition(prereqId);
        return {
          proceed: true,
          message: `⚠️ WARNING: Agent ${agentId} requires prerequisite checkpoint: ${prereqId}${checkpoint ? ` (${checkpoint.level})` : ''}`,
          checkpoint: prompt || undefined,
        };
      }
    }
  }

  // Local file fallback: Check each checkpoint
  for (const checkpointId of checkpointIds) {
    const checkpoint = getCheckpointDefinition(checkpointId);
    if (!checkpoint) continue;

    // Skip if already completed
    if (isCheckpointCompleted(checkpointId, context)) {
      continue;
    }

    // For REQUIRED checkpoints, soft block with warning
    if (checkpoint.level === 'REQUIRED') {
      const prompt = createCheckpointPrompt(checkpointId);
      return {
        proceed: true,
        message: `⚠️ WARNING: 🔴 CHECKPOINT REQUIRED: ${checkpoint.name} — approval needed before proceeding`,
        checkpoint: prompt || undefined,
      };
    }

    // For RECOMMENDED checkpoints, soft block with warning
    if (checkpoint.level === 'RECOMMENDED') {
      const prompt = createCheckpointPrompt(checkpointId);
      return {
        proceed: true,
        message: `⚠️ WARNING: 🟠 CHECKPOINT RECOMMENDED: ${checkpoint.name} — consider approving before proceeding`,
        checkpoint: prompt || undefined,
      };
    }

    // For OPTIONAL checkpoints, just note it
    // (continue)
  }

  return { proceed: true };
}

/**
 * Mark checkpoint as completed and persist to disk
 */
export function completeCheckpoint(
  checkpointId: string,
  selectedOption: string,
  context: PluginContext
): void {
  const researchContext = loadContext();
  if (!researchContext) return;

  // Delegate to context-manager which handles persistence via saveContext()
  addCompletedCheckpoint(checkpointId, {
    checkpoint: checkpointId,
    timestamp: new Date().toISOString(),
    optionsPresented: ['approve', 'modify', 'cancel'],
    selected: selectedOption,
  });
}

/**
 * Get pending checkpoints for current stage
 */
export function getPendingCheckpoints(context: PluginContext): string[] {
  const researchContext = loadContext();
  if (!researchContext) return [];
  return researchContext.pendingCheckpoints;
}

/**
 * Reset checkpoint (for testing/debugging)
 */
export function resetCheckpoint(checkpointId: string, context: PluginContext): void {
  const researchContext = loadContext();
  if (!researchContext) return;

  researchContext.completedCheckpoints = researchContext.completedCheckpoints.filter(
    cp => cp !== checkpointId
  );
}
