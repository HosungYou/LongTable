/**
 * Diverga OpenCode Plugin Types
 */

/**
 * Plugin context provided by OpenCode
 */
export interface PluginContext {
  /** Current working directory */
  cwd: string;
  /** User home directory */
  home: string;
  /** Plugin configuration */
  config: Record<string, unknown>;
  /** Logger instance */
  logger: Logger;
  /** State manager */
  state: StateManager;
  /** MCP client (optional, available when MCP servers configured) */
  mcp?: {
    call(tool: string, args: Record<string, unknown>): Promise<unknown>;
  };
}

/**
 * Logger interface
 */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

/**
 * State manager interface
 */
export interface StateManager {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
}

/**
 * Hook result for before hooks
 */
export interface HookResult {
  /** Whether to proceed with execution */
  proceed: boolean;
  /** Modified parameters (if any) */
  params?: Record<string, unknown>;
  /** Message to display */
  message?: string;
  /** Checkpoint to show */
  checkpoint?: CheckpointPrompt;
}

/**
 * Checkpoint prompt for user interaction
 */
export interface CheckpointPrompt {
  id: string;
  level: 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
  message: string;
  options: CheckpointOption[];
}

/**
 * Checkpoint option
 */
export interface CheckpointOption {
  id: string;
  label: string;
  description: string;
  tScore?: number;
  recommended?: boolean;
}

/**
 * Plugin interface
 */
export interface Plugin {
  name: string;
  version: string;
  hooks: PluginHooks;
  commands: Record<string, CommandHandler>;
}

/**
 * Plugin hooks
 */
export interface PluginHooks {
  'tool.execute.before'?: (params: ToolParams) => Promise<HookResult>;
  'tool.execute.after'?: (params: ToolParams, result: unknown) => Promise<unknown>;
  'tui.prompt.append'?: (prompt: string) => PromptAppendResult;
  'session.created'?: () => SessionCreatedResult;
}

/**
 * Tool parameters
 */
export interface ToolParams {
  tool: string;
  arguments: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/**
 * Prompt append result
 */
export interface PromptAppendResult {
  append: string;
  agent?: AgentInfo;
}

/**
 * Session created result
 */
export interface SessionCreatedResult {
  systemPrompt?: string;
}

/**
 * Command handler
 */
export type CommandHandler = (args?: Record<string, string>) => string;

/**
 * Agent information
 */
export interface AgentInfo {
  id: string;
  name: string;
  icon: string;
  category: string;
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
  claudeModel: 'opus' | 'sonnet' | 'haiku';
  vsLevel: 'Full' | 'Enhanced' | 'Light';
  description: string;
  triggers: {
    keywords: string[];
    context?: string[];
  };
  checkpoints?: string[];
}

/**
 * Research context state
 */
export interface ResearchContext {
  projectName: string;
  projectType: 'quantitative' | 'qualitative' | 'mixed_methods';
  paradigm: string;
  currentStage: number;
  createdAt: string;
  updatedAt: string;
  researchQuestion?: string;
  theoreticalFramework?: string;
  completedCheckpoints: string[];
  pendingCheckpoints: string[];
  decisions: Decision[];
}

/**
 * Decision record
 */
export interface Decision {
  checkpoint: string;
  timestamp: string;
  optionsPresented: string[];
  selected: string;
  rationale?: string;
}

/**
 * Checkpoint definition
 */
export interface CheckpointDefinition {
  id: string;
  name: string;
  level: 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
  when: string;
  whatToAsk: string;
  icon: string;
  category: string;
  agentsUsing: string[];
}

/**
 * T-Score entry
 */
export interface TScoreEntry {
  range: [number, number];
  label: string;
  meaning: string;
  suitableFor: string;
  riskLevel: 'low' | 'medium' | 'high' | 'experimental';
  icon: string;
}
