/**
 * setup.ts — Diverga Setup Wizard for OpenCode
 *
 * Handles /diverga:setup command for project initialization.
 */

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createContext, loadContext } from './context-manager.js';
import type { ResearchContext } from '../types.js';

export interface SetupResult {
  success: boolean;
  message: string;
  projectName?: string;
  projectType?: string;
}

// Check if a research project exists in the current directory
export function detectExistingProject(): ResearchContext | null {
  return loadContext();
}

// Check if research directories exist
export function hasResearchDirs(): boolean {
  const cwd = process.cwd();
  return existsSync(join(cwd, 'research')) || existsSync(join(cwd, '.research'));
}

// Create research directory structure
export function createResearchDirs(): void {
  const cwd = process.cwd();
  const dirs = [
    join(cwd, '.research'),
    join(cwd, '.research', 'sessions'),
    join(cwd, 'research'),
    join(cwd, 'research', 'baselines'),
    join(cwd, 'research', 'baselines', 'literature'),
    join(cwd, 'research', 'baselines', 'methodology'),
    join(cwd, 'research', 'baselines', 'framework'),
    join(cwd, 'research', 'changes'),
    join(cwd, 'research', 'changes', 'current'),
    join(cwd, 'research', 'changes', 'archive'),
    join(cwd, 'docs')
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// Initialize a new project
export function initializeProject(projectName: string, projectType: string, paradigm?: string): SetupResult {
  try {
    // Create directories
    createResearchDirs();

    // Create context
    createContext(projectName, projectType as ResearchContext['projectType']);

    return {
      success: true,
      message: `✅ Project "${projectName}" initialized successfully!`,
      projectName,
      projectType
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Setup failed: ${error.message}`
    };
  }
}

// Check MCP server connectivity
export function checkMCPServers(): { server: string; available: boolean }[] {
  // In OpenCode, MCP servers are configured in opencode.jsonc
  // We can check if the server files exist
  const servers = [
    { name: 'diverga', path: 'mcp/diverga-server.js' },
    { name: 'journal', path: 'mcp/journal-server.js' },
  ];

  const pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));

  return servers.map(s => ({
    server: s.name,
    available: existsSync(join(pluginDir, s.path))
  }));
}

// Generate setup welcome message
export function getSetupWelcome(): string {
  const existing = detectExistingProject();

  if (existing) {
    return [
      '🔬 **Diverga Setup** — Project Detected',
      '',
      `Project: ${existing.projectName || 'Unknown'}`,
      `Type: ${existing.projectType || 'Unknown'}`,
      `Stage: ${existing.currentStage ?? 'foundation'}`,
      '',
      'Your project is already configured. Use:',
      '- `/diverga:memory status` to check memory',
      '- `/diverga:hud` to configure display',
      '- `/diverga:help` for all commands'
    ].join('\n');
  }

  return [
    '🔬 **Diverga Setup Wizard** v10.3.0',
    '',
    'Welcome! Let\'s set up your research project.',
    '',
    'I need two things:',
    '1. **Project name** — What is your research about?',
    '2. **Research type** — What kind of research?',
    '   - Systematic Review',
    '   - Meta-Analysis',
    '   - Experimental Study',
    '   - Qualitative Study',
    '   - Mixed Methods',
    '   - Other',
    '',
    'Just tell me naturally, e.g.:',
    '"I want to do a systematic review on AI in education"',
    '"메타분석 연구를 하고 싶어요"'
  ].join('\n');
}

// Generate agent catalog summary
export function getAgentCatalog(): string {
  return [
    '📚 **Agent Catalog** (44 agents across 9 categories)',
    '',
    '| Category | Agents | Description |',
    '|----------|--------|-------------|',
    '| A: Foundation | 6 | Research questions, frameworks, ethics |',
    '| B: Evidence | 5 | Literature review, quality appraisal |',
    '| C: Design | 7 | Quantitative, qualitative, mixed, meta-analysis |',
    '| D: Collection | 4 | Sampling, interviews, observation |',
    '| E: Analysis | 5 | Statistical, qualitative coding, integration |',
    '| F: Quality | 5 | Consistency, checklists, reproducibility |',
    '| G: Communication | 6 | Journal matching, writing, humanization |',
    '| H: Specialized | 2 | Ethnography, action research |',
    '| I: Automation | 4 | Systematic review pipeline |',
    '',
    'Use `/diverga:help` for detailed agent information.'
  ].join('\n');
}

// Session start auto-guide
export function getSessionStartMessage(): string {
  const existing = detectExistingProject();

  if (existing) {
    const cps = existing.completedCheckpoints?.length || 0;
    return `🔬 Diverga v10.3.0 | ${existing.projectName} | ${cps} checkpoints completed`;
  }

  return '🔬 Diverga v10.3.0 ready. No project detected — use /diverga:setup or just describe your research.';
}
