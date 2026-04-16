/**
 * Diverga Agent Runtime v12.0.2
 *
 * Independent Agent Runtime for Diverga Research Agents.
 * Enables parallel execution via Task(subagent_type="diverga:a1") etc.
 *
 * This package provides:
 * - 44 specialized research agents across 9 categories (A-I)
 * - VS (Verbalized Sampling) methodology integration
 * - Human checkpoint protocol
 * - Dynamic prompt loading from SKILL.md files
 *
 * @example
 * ```typescript
 * import { getAgentDefinitions, getAgent } from 'diverga';
 *
 * // Get all agent definitions for Task tool
 * const agents = getAgentDefinitions();
 *
 * // Get a specific agent
 * const a1 = getAgent('a1');
 * ```
 */

// Re-export everything from agents module
export * from './agents/index.js';
export * from './runtime/managed-bridge.js';

// Package info
export const VERSION = '12.0.2';
export const PACKAGE_NAME = 'diverga';

/**
 * Diverga configuration
 */
export interface DivergeConfig {
  /** Enable VS methodology injection */
  enableVS?: boolean;
  /** Enable human checkpoint injection */
  enableCheckpoints?: boolean;
  /** Default model override */
  defaultModel?: 'opus' | 'sonnet' | 'haiku';
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: DivergeConfig = {
  enableVS: true,
  enableCheckpoints: true,
};

/**
 * Quick access to common agent operations
 */
export const diverga = {
  version: VERSION,

  /**
   * Get all 44 agent definitions
   */
  get agents() {
    // Use dynamic import to avoid circular deps
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (async () => {
      const { getAgentDefinitions } = await import('./agents/definitions.js');
      return getAgentDefinitions();
    })();
  },

  /**
   * Get agent by short ID (a1, b1, etc.)
   */
  async agent(id: string) {
    const { getAgent } = await import('./agents/definitions.js');
    return getAgent(id);
  },

  /**
   * Find agent by trigger keyword
   */
  async find(keyword: string) {
    const { findAgentByTrigger } = await import('./agents/definitions.js');
    return findAgentByTrigger(keyword);
  },

  /**
   * Get agents by category (A-I)
   */
  async category(cat: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I') {
    const { getAgentsByCategory } = await import('./agents/definitions.js');
    return getAgentsByCategory(cat);
  },

  /**
   * Get agents by tier
   */
  async tier(t: 'HIGH' | 'MEDIUM' | 'LOW') {
    const { getAgentsByTier } = await import('./agents/definitions.js');
    return getAgentsByTier(t);
  },
};

export default diverga;
