import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ManagedRuntimePaths {
  root: string;
  setupPath: string;
  codexRuntimePath: string;
  claudeRuntimePath: string;
}

export interface ManagedProfileSeed {
  field: string;
  careerStage: string;
  experienceLevel: 'novice' | 'intermediate' | 'advanced';
  currentProjectType: string;
  preferredCheckpointIntensity: 'low' | 'balanced' | 'high';
}

export interface ManagedSetupOutput {
  profileSeed: ManagedProfileSeed;
  providerSelection: {
    provider: 'codex' | 'claude';
    checkpointProtocol: string;
    supportsStructuredQuestions: boolean;
  };
  defaultInteractionMode?: string;
}

export interface ManagedClaudeRuntimeConfig {
  setupPath: string;
  provider: 'claude';
  checkpointProtocol: string;
  defaultInteractionMode: string;
  profileSummary: {
    field: string;
    careerStage: string;
    experienceLevel: string;
    currentProjectType: string;
  };
}

export interface ManagedClaudeBridge {
  setup: ManagedSetupOutput | null;
  runtime: ManagedClaudeRuntimeConfig;
  setupPath: string;
  runtimePath: string;
}

export function resolveManagedRuntimePaths(home = homedir()): ManagedRuntimePaths {
  const root = join(home, '.diverga');

  return {
    root,
    setupPath: join(root, 'setup.json'),
    codexRuntimePath: join(root, 'runtime', 'codex', 'diverga.toml'),
    claudeRuntimePath: join(root, 'runtime', 'claude', 'diverga.json'),
  };
}

export function readManagedSetupOutput(customPath?: string): ManagedSetupOutput | null {
  const target = customPath ?? resolveManagedRuntimePaths().setupPath;

  if (!existsSync(target)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(target, 'utf8')) as ManagedSetupOutput;
  } catch {
    return null;
  }
}

export function readManagedClaudeRuntimeConfig(
  customPath?: string
): ManagedClaudeRuntimeConfig | null {
  const target = customPath ?? resolveManagedRuntimePaths().claudeRuntimePath;

  if (!existsSync(target)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(target, 'utf8')) as ManagedClaudeRuntimeConfig;
    return parsed.provider === 'claude' ? parsed : null;
  } catch {
    return null;
  }
}

export function detectManagedClaudeBridge(
  options: {
    setupPath?: string;
    runtimePath?: string;
  } = {}
): ManagedClaudeBridge | null {
  const runtime = readManagedClaudeRuntimeConfig(options.runtimePath);

  if (!runtime) {
    return null;
  }

  const setupPath = options.setupPath ?? runtime.setupPath;
  const setup = readManagedSetupOutput(setupPath);

  return {
    setup,
    runtime,
    setupPath,
    runtimePath: options.runtimePath ?? resolveManagedRuntimePaths().claudeRuntimePath,
  };
}
