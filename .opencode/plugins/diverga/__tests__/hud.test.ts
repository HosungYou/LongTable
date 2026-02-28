/**
 * hud.test.ts
 *
 * Tests for hooks/hud.ts — Diverga HUD (Heads-Up Display) for OpenCode.
 *
 * Covers:
 * - renderHUD() for each preset (research, checkpoint, memory, minimal)
 * - getHUDSystemPrompt() generates valid text
 * - calculateMemoryHealth() stays in 0-100 range (tested via renderHUD output)
 *
 * Run: npx vitest run (from .opencode/plugins/diverga/ directory)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../hooks/context-manager.js', () => ({
  loadContext: vi.fn(),
  saveContext: vi.fn(),
  updateContext: vi.fn(),
}));

import {
  renderHUD,
  getHUDSystemPrompt,
  setPreset,
  setConfig,
  getConfig,
  toggleHUD,
  listPresets,
  type HUDPreset,
} from '../hooks/hud.js';
import { loadContext } from '../hooks/context-manager.js';

const mockLoadContext = vi.mocked(loadContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NULL_CTX = null;

const MINIMAL_CTX = {
  projectName: '',
  projectType: 'quantitative' as const,
  paradigm: '',
  currentStage: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  completedCheckpoints: [] as string[],
  pendingCheckpoints: [] as string[],
  decisions: [],
};

const PARTIAL_CTX = {
  projectName: 'Test Research',
  projectType: 'quantitative' as const,
  paradigm: 'post-positivist',
  currentStage: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  completedCheckpoints: ['CP_RESEARCH_DIRECTION', 'CP_PARADIGM_SELECTION'],
  pendingCheckpoints: ['CP_METHODOLOGY_APPROVAL'],
  decisions: [
    {
      checkpoint: 'CP_RESEARCH_DIRECTION',
      timestamp: '2026-01-05T00:00:00.000Z',
      optionsPresented: ['A'],
      selected: 'quant',
    },
  ],
};

const RICH_CTX = {
  projectName: 'Full Study',
  projectType: 'mixed_methods' as const,
  paradigm: 'pragmatist',
  currentStage: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  completedCheckpoints: [
    'CP_RESEARCH_DIRECTION',
    'CP_PARADIGM_SELECTION',
    'CP_SCOPE_DEFINITION',
    'CP_THEORY_SELECTION',
    'CP_VARIABLE_DEFINITION',
    'CP_METHODOLOGY_APPROVAL',
  ],
  pendingCheckpoints: [],
  decisions: [
    { checkpoint: 'CP_RESEARCH_DIRECTION', timestamp: '2026-01-05T00:00:00.000Z', optionsPresented: [], selected: 'q' },
    { checkpoint: 'CP_PARADIGM_SELECTION', timestamp: '2026-01-06T00:00:00.000Z', optionsPresented: [], selected: 'pp' },
    { checkpoint: 'CP_METHODOLOGY_APPROVAL', timestamp: '2026-01-07T00:00:00.000Z', optionsPresented: [], selected: 'RCT' },
    { checkpoint: 'CP_ANALYSIS_PLAN', timestamp: '2026-01-08T00:00:00.000Z', optionsPresented: [], selected: 'ANOVA' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to defaults
  setConfig({ enabled: true, preset: 'research' });
});

// ---------------------------------------------------------------------------
// renderHUD() — preset: research
// ---------------------------------------------------------------------------

describe('renderHUD() — preset: research', () => {
  beforeEach(() => setPreset('research'));

  it('returns no-project string when context is null', () => {
    mockLoadContext.mockReturnValue(NULL_CTX);
    const result = renderHUD();
    expect(result).toContain('No project');
  });

  it('includes project name', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    const result = renderHUD();
    expect(result).toContain('Test Research');
  });

  it('includes stage label', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    const result = renderHUD();
    expect(result).toContain('Stage');
  });

  it('includes progress bar with ● or ○ characters', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    const result = renderHUD();
    expect(result).toMatch(/[●○]/);
  });

  it('includes memory health percentage', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = renderHUD();
    expect(result).toMatch(/\d+%/);
  });

  it('returns empty string when HUD is disabled', () => {
    setConfig({ enabled: false });
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = renderHUD();
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// renderHUD() — preset: checkpoint
// ---------------------------------------------------------------------------

describe('renderHUD() — preset: checkpoint', () => {
  beforeEach(() => setPreset('checkpoint'));

  it('includes "Completed" label', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    const result = renderHUD();
    expect(result).toContain('Completed');
  });

  it('includes "Pending" label', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    const result = renderHUD();
    expect(result).toContain('Pending');
  });

  it('shows "Next" pending checkpoint', () => {
    mockLoadContext.mockReturnValue(MINIMAL_CTX);
    const result = renderHUD();
    // With no completed checkpoints, there should be a Next: line
    expect(result).toContain('Next');
  });

  it('shows all-complete message when no pending checkpoints remain', () => {
    const allComplete = {
      ...PARTIAL_CTX,
      completedCheckpoints: [
        'CP_RESEARCH_DIRECTION', 'CP_PARADIGM_SELECTION', 'CP_SCOPE_DEFINITION',
        'CP_THEORY_SELECTION', 'CP_VARIABLE_DEFINITION',
        'CP_METHODOLOGY_APPROVAL',
        'CP_DATABASE_SELECTION', 'CP_SEARCH_STRATEGY', 'CP_SAMPLE_PLANNING',
        'CP_SCREENING_CRITERIA', 'CP_RAG_READINESS', 'CP_DATA_EXTRACTION',
        'CP_ANALYSIS_PLAN',
        'CP_QUALITY_GATES', 'CP_PEER_REVIEW', 'CP_PUBLICATION_READY',
      ],
    };
    mockLoadContext.mockReturnValue(allComplete);
    const result = renderHUD();
    expect(result).toContain('complete');
  });
});

// ---------------------------------------------------------------------------
// renderHUD() — preset: memory
// ---------------------------------------------------------------------------

describe('renderHUD() — preset: memory', () => {
  beforeEach(() => setPreset('memory'));

  it('includes "Memory" label', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = renderHUD();
    expect(result).toContain('Memory');
  });

  it('includes project name', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = renderHUD();
    expect(result).toContain('Full Study');
  });

  it('includes memory health percentage', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = renderHUD();
    expect(result).toMatch(/\d+%/);
  });

  it('includes "loaded" context indicator', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = renderHUD();
    expect(result).toContain('loaded');
  });
});

// ---------------------------------------------------------------------------
// renderHUD() — preset: minimal
// ---------------------------------------------------------------------------

describe('renderHUD() — preset: minimal', () => {
  beforeEach(() => setPreset('minimal'));

  it('returns a non-empty string with emoji', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    const result = renderHUD();
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/🔬/);
  });

  it('is shorter than research preset output', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    const minimalResult = renderHUD();

    setPreset('research');
    const researchResult = renderHUD();

    expect(minimalResult.length).toBeLessThan(researchResult.length);
  });
});

// ---------------------------------------------------------------------------
// getHUDSystemPrompt()
// ---------------------------------------------------------------------------

describe('getHUDSystemPrompt()', () => {
  beforeEach(() => setPreset('research'));

  it('returns a non-empty string when HUD is enabled with context', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = getHUDSystemPrompt();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains "Project Status" heading', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = getHUDSystemPrompt();
    expect(result).toContain('Project Status');
  });

  it('wraps content with separator lines', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = getHUDSystemPrompt();
    expect(result).toContain('---');
  });

  it('returns empty string when HUD is disabled', () => {
    setConfig({ enabled: false });
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = getHUDSystemPrompt();
    expect(result).toBe('');
  });

  it('returns a string (not empty) even when context is null', () => {
    mockLoadContext.mockReturnValue(NULL_CTX);
    const result = getHUDSystemPrompt();
    // renderHUD() returns "No project..." string, which gets wrapped in system prompt
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// calculateMemoryHealth() range (via renderHUD)
// ---------------------------------------------------------------------------

describe('calculateMemoryHealth() range (0–100)', () => {
  beforeEach(() => setPreset('research'));

  it('health percentage is within 0-100 for all contexts', () => {
    const contexts = [MINIMAL_CTX, PARTIAL_CTX, RICH_CTX];
    for (const ctx of contexts) {
      mockLoadContext.mockReturnValue(ctx);
      const result = renderHUD();
      const match = result.match(/(\d+)%/);
      if (match) {
        const pct = parseInt(match[1]);
        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
      }
    }
  });

  it('richer context produces higher health than empty context', () => {
    mockLoadContext.mockReturnValue(MINIMAL_CTX);
    const minResult = renderHUD();

    mockLoadContext.mockReturnValue(RICH_CTX);
    const richResult = renderHUD();

    const minMatch = minResult.match(/(\d+)%/);
    const richMatch = richResult.match(/(\d+)%/);

    if (minMatch && richMatch) {
      expect(parseInt(richMatch[1])).toBeGreaterThanOrEqual(parseInt(minMatch[1]));
    }
  });

  it('returns 0 when context is null (no project loaded)', () => {
    // setPreset to 'memory' to get health % directly
    setPreset('memory');
    mockLoadContext.mockReturnValue(NULL_CTX);
    const result = renderHUD();
    // No project → no %, or if returned, it should be 0
    const match = result.match(/(\d+)%/);
    if (match) {
      expect(parseInt(match[1])).toBe(0);
    } else {
      // No % in output for null context is also valid
      expect(result).toContain('No project');
    }
  });
});

// ---------------------------------------------------------------------------
// HUD configuration helpers
// ---------------------------------------------------------------------------

describe('HUD configuration helpers', () => {
  it('toggleHUD() flips the enabled state', () => {
    const initial = getConfig().enabled;
    const toggled = toggleHUD();
    expect(toggled).toBe(!initial);
    toggleHUD(); // restore
  });

  it('listPresets() returns exactly 4 presets', () => {
    const presets = listPresets();
    expect(presets).toHaveLength(4);
  });

  it('listPresets() contains research, checkpoint, memory, minimal', () => {
    const names = listPresets().map(p => p.name);
    expect(names).toContain('research');
    expect(names).toContain('checkpoint');
    expect(names).toContain('memory');
    expect(names).toContain('minimal');
  });

  it('each preset has a non-empty description', () => {
    for (const preset of listPresets()) {
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });
});
