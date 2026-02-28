/**
 * hud.test.ts
 *
 * Tests for .opencode/plugins/diverga/hooks/hud.ts
 *
 * Tests renderHUD() for each preset, getHUDSystemPrompt(), and
 * calculateMemoryHealth() range via the rendered output.
 *
 * Run from the .opencode/plugins/diverga directory:
 *   npx vitest run ../../../../tests/opencode/hud.test.ts
 *
 * Or from the repo root:
 *   npx vitest run --config .opencode/plugins/diverga/vitest.config.ts tests/opencode/hud.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../.opencode/plugins/diverga/hooks/context-manager.js', () => ({
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
} from '../../.opencode/plugins/diverga/hooks/hud.js';
import { loadContext } from '../../.opencode/plugins/diverga/hooks/context-manager.js';

const mockLoadContext = vi.mocked(loadContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
      selected: 'quantitative',
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
  setConfig({ enabled: true, preset: 'research' });
});

// ---------------------------------------------------------------------------
// renderHUD() — preset: research
// ---------------------------------------------------------------------------

describe('renderHUD() — preset: research', () => {
  beforeEach(() => setPreset('research'));

  it('returns no-project string when context is null', () => {
    mockLoadContext.mockReturnValue(null);
    expect(renderHUD()).toContain('No project');
  });

  it('includes project name', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    expect(renderHUD()).toContain('Test Research');
  });

  it('includes Stage label', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    expect(renderHUD()).toContain('Stage');
  });

  it('includes progress bar with ● or ○ characters', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    expect(renderHUD()).toMatch(/[●○]/);
  });

  it('includes memory health percentage', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    expect(renderHUD()).toMatch(/\d+%/);
  });

  it('returns empty string when HUD is disabled', () => {
    setConfig({ enabled: false });
    mockLoadContext.mockReturnValue(RICH_CTX);
    expect(renderHUD()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// renderHUD() — preset: checkpoint
// ---------------------------------------------------------------------------

describe('renderHUD() — preset: checkpoint', () => {
  beforeEach(() => setPreset('checkpoint'));

  it('includes "Completed" label', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    expect(renderHUD()).toContain('Completed');
  });

  it('includes "Pending" label', () => {
    mockLoadContext.mockReturnValue(PARTIAL_CTX);
    expect(renderHUD()).toContain('Pending');
  });

  it('shows Next pending checkpoint when there are pending CPs', () => {
    mockLoadContext.mockReturnValue(MINIMAL_CTX);
    expect(renderHUD()).toContain('Next');
  });

  it('shows all-complete message when all checkpoints are done', () => {
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
    expect(renderHUD()).toContain('complete');
  });
});

// ---------------------------------------------------------------------------
// renderHUD() — preset: memory
// ---------------------------------------------------------------------------

describe('renderHUD() — preset: memory', () => {
  beforeEach(() => setPreset('memory'));

  it('includes "Memory" label', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    expect(renderHUD()).toContain('Memory');
  });

  it('includes project name', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    expect(renderHUD()).toContain('Full Study');
  });

  it('includes memory health percentage', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    expect(renderHUD()).toMatch(/\d+%/);
  });

  it('includes "loaded" context indicator', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    expect(renderHUD()).toContain('loaded');
  });
});

// ---------------------------------------------------------------------------
// renderHUD() — preset: minimal
// ---------------------------------------------------------------------------

describe('renderHUD() — preset: minimal', () => {
  beforeEach(() => setPreset('minimal'));

  it('returns non-empty string with 🔬 emoji', () => {
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

  it('returns non-empty string when context exists', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    const result = getHUDSystemPrompt();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains "Project Status" heading', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    expect(getHUDSystemPrompt()).toContain('Project Status');
  });

  it('wraps content with separator lines (---)', () => {
    mockLoadContext.mockReturnValue(RICH_CTX);
    expect(getHUDSystemPrompt()).toContain('---');
  });

  it('returns empty string when HUD is disabled', () => {
    setConfig({ enabled: false });
    mockLoadContext.mockReturnValue(RICH_CTX);
    expect(getHUDSystemPrompt()).toBe('');
  });

  it('returns a string even when context is null', () => {
    mockLoadContext.mockReturnValue(null);
    expect(typeof getHUDSystemPrompt()).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// calculateMemoryHealth() — 0-100 range (via renderHUD output)
// ---------------------------------------------------------------------------

describe('calculateMemoryHealth() range (0-100)', () => {
  beforeEach(() => setPreset('research'));

  it('health percentage stays in 0-100 for all context states', () => {
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

  it('richer context produces equal or higher health than minimal', () => {
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

  it('null context yields 0% or no-project display', () => {
    setPreset('memory');
    mockLoadContext.mockReturnValue(null);
    const result = renderHUD();
    const match = result.match(/(\d+)%/);
    if (match) {
      expect(parseInt(match[1])).toBe(0);
    } else {
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
    expect(listPresets()).toHaveLength(4);
  });

  it('listPresets() names match the 4 expected presets', () => {
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
