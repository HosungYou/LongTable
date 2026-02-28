/**
 * memory.test.ts
 *
 * Tests for .opencode/plugins/diverga/hooks/memory.ts
 *
 * Tests the detectMemoryKeywords(), parseMemoryCommand(), and
 * executeMemoryCommand() functions from the Diverga OpenCode memory module.
 *
 * Run from the .opencode/plugins/diverga directory:
 *   npx vitest run ../../../../tests/opencode/memory.test.ts
 *
 * Or from the repo root (after `npm install` in .opencode/plugins/diverga):
 *   npx vitest run --config .opencode/plugins/diverga/vitest.config.ts tests/opencode/memory.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock context-manager before importing memory (vitest hoists vi.mock)
vi.mock('../../.opencode/plugins/diverga/hooks/context-manager.js', () => ({
  loadContext: vi.fn(),
  saveContext: vi.fn(),
  updateContext: vi.fn(),
}));

import {
  detectMemoryKeywords,
  parseMemoryCommand,
  executeMemoryCommand,
} from '../../.opencode/plugins/diverga/hooks/memory.js';
import { loadContext } from '../../.opencode/plugins/diverga/hooks/context-manager.js';

const mockLoadContext = vi.mocked(loadContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_CONTEXT = {
  projectName: 'AI Education Study',
  projectType: 'quantitative' as const,
  paradigm: 'post-positivist',
  currentStage: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  completedCheckpoints: ['CP_RESEARCH_DIRECTION', 'CP_PARADIGM_SELECTION'],
  pendingCheckpoints: ['CP_METHODOLOGY_APPROVAL'],
  decisions: [
    {
      checkpoint: 'CP_RESEARCH_DIRECTION',
      timestamp: '2026-01-05T00:00:00.000Z',
      optionsPresented: ['A', 'B'],
      selected: 'quantitative approach',
      rationale: 'Large sample available',
    },
    {
      checkpoint: 'CP_PARADIGM_SELECTION',
      timestamp: '2026-01-06T00:00:00.000Z',
      optionsPresented: ['post-positivist', 'interpretivist'],
      selected: 'post-positivist',
    },
  ],
};

const EMPTY_CONTEXT = {
  projectName: 'Empty Project',
  projectType: 'qualitative' as const,
  paradigm: '',
  currentStage: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  completedCheckpoints: [] as string[],
  pendingCheckpoints: [] as string[],
  decisions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// detectMemoryKeywords()
// ---------------------------------------------------------------------------

describe('detectMemoryKeywords()', () => {
  describe('English keywords', () => {
    it('returns true for "where was i"', () => {
      expect(detectMemoryKeywords('where was i in my analysis?')).toBe(true);
    });

    it('returns true for "my research"', () => {
      expect(detectMemoryKeywords('Show me my research')).toBe(true);
    });

    it('returns true for "research status"', () => {
      expect(detectMemoryKeywords('What is the research status?')).toBe(true);
    });

    it('returns true for "research progress"', () => {
      expect(detectMemoryKeywords('Check research progress')).toBe(true);
    });

    it('returns true for "continue research"', () => {
      expect(detectMemoryKeywords('continue research from yesterday')).toBe(true);
    });

    it('returns true for "last session"', () => {
      expect(detectMemoryKeywords('What did we do in the last session?')).toBe(true);
    });

    it('returns true for "previous session"', () => {
      expect(detectMemoryKeywords('Recall the previous session')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(detectMemoryKeywords('WHERE WAS I')).toBe(true);
      expect(detectMemoryKeywords('My Research Status')).toBe(true);
    });
  });

  describe('Korean keywords', () => {
    it('returns true for "이어서" (continue)', () => {
      expect(detectMemoryKeywords('이어서 진행해줘')).toBe(true);
    });

    it('returns true for "내 연구" (my research)', () => {
      expect(detectMemoryKeywords('내 연구 상태 알려줘')).toBe(true);
    });

    it('returns true for "연구 진행" (research progress)', () => {
      expect(detectMemoryKeywords('연구 진행 상황은?')).toBe(true);
    });

    it('returns true for "연구 상태" (research status)', () => {
      expect(detectMemoryKeywords('현재 연구 상태를 보여줘')).toBe(true);
    });

    it('returns true for "어디까지" (how far)', () => {
      expect(detectMemoryKeywords('어디까지 했지?')).toBe(true);
    });

    it('returns true for "계속" (continue)', () => {
      expect(detectMemoryKeywords('계속 진행해줘')).toBe(true);
    });
  });

  describe('Unrelated text', () => {
    it('returns false for generic analysis request', () => {
      expect(detectMemoryKeywords('Help me analyze this dataset')).toBe(false);
    });

    it('returns false for methodology question', () => {
      expect(detectMemoryKeywords('What statistical test should I use?')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(detectMemoryKeywords('')).toBe(false);
    });

    it('returns false for unrelated Korean', () => {
      expect(detectMemoryKeywords('오늘 날씨 어때?')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// parseMemoryCommand()
// ---------------------------------------------------------------------------

describe('parseMemoryCommand()', () => {
  it('parses "memory status" → action: status', () => {
    const result = parseMemoryCommand('memory status');
    expect(result).not.toBeNull();
    expect(result?.action).toBe('status');
  });

  it('parses "/diverga:memory status" → action: status', () => {
    expect(parseMemoryCommand('/diverga:memory status')?.action).toBe('status');
  });

  it('parses "memory context" → action: context', () => {
    expect(parseMemoryCommand('memory context')?.action).toBe('context');
  });

  it('parses "show decisions" → action: decisions', () => {
    expect(parseMemoryCommand('show decisions')?.action).toBe('decisions');
  });

  it('parses "show priority" → action: priority', () => {
    expect(parseMemoryCommand('show priority')?.action).toBe('priority');
  });

  it('parses "memory init" → action: init', () => {
    expect(parseMemoryCommand('memory init')?.action).toBe('init');
  });

  it('parses Korean "메모리 상태" → action: status', () => {
    expect(parseMemoryCommand('메모리 상태')?.action).toBe('status');
  });

  it('parses Korean "메모리 컨텍스트" → action: context', () => {
    expect(parseMemoryCommand('메모리 컨텍스트')?.action).toBe('context');
  });

  it('returns null for unrecognized command', () => {
    expect(parseMemoryCommand('run meta-analysis')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseMemoryCommand('')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(parseMemoryCommand('MEMORY STATUS')?.action).toBe('status');
  });
});

// ---------------------------------------------------------------------------
// executeMemoryCommand()
// ---------------------------------------------------------------------------

describe('executeMemoryCommand()', () => {
  describe('action: status', () => {
    it('includes project name when context exists', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      expect(executeMemoryCommand({ action: 'status' })).toContain('AI Education Study');
    });

    it('includes "Status" label', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      expect(executeMemoryCommand({ action: 'status' })).toContain('Status');
    });

    it('includes checkpoint count', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      // 2 completed checkpoints
      expect(executeMemoryCommand({ action: 'status' })).toContain('2');
    });

    it('includes memory health percentage', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      expect(executeMemoryCommand({ action: 'status' })).toMatch(/\d+%/);
    });

    it('returns no-project message when context is null', () => {
      mockLoadContext.mockReturnValue(null);
      expect(executeMemoryCommand({ action: 'status' })).toContain('No research project');
    });
  });

  describe('action: context', () => {
    it('includes project name in context output', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      expect(executeMemoryCommand({ action: 'context' })).toContain('AI Education Study');
    });

    it('returns no-project message for null context', () => {
      mockLoadContext.mockReturnValue(null);
      expect(executeMemoryCommand({ action: 'context' })).toContain('No research project');
    });
  });

  describe('action: decisions', () => {
    it('lists checkpoint in decisions output', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      expect(executeMemoryCommand({ action: 'decisions' })).toContain('CP_RESEARCH_DIRECTION');
    });

    it('returns no-decisions message for empty decisions', () => {
      mockLoadContext.mockReturnValue(EMPTY_CONTEXT);
      expect(executeMemoryCommand({ action: 'decisions' })).toContain('No decisions');
    });

    it('returns no-decisions message for null context', () => {
      mockLoadContext.mockReturnValue(null);
      expect(executeMemoryCommand({ action: 'decisions' })).toContain('No decisions');
    });
  });

  describe('action: priority', () => {
    it('includes "Priority Context" label', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      expect(executeMemoryCommand({ action: 'priority' })).toContain('Priority Context');
    });

    it('includes project name', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      expect(executeMemoryCommand({ action: 'priority' })).toContain('AI Education Study');
    });

    it('returns no-context message when null', () => {
      mockLoadContext.mockReturnValue(null);
      expect(executeMemoryCommand({ action: 'priority' })).toContain('No priority context');
    });
  });

  describe('action: init', () => {
    it('returns setup instructions with /diverga:setup', () => {
      mockLoadContext.mockReturnValue(null);
      expect(executeMemoryCommand({ action: 'init' })).toContain('/diverga:setup');
    });
  });
});
