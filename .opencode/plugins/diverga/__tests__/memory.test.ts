/**
 * memory.test.ts
 *
 * Tests for hooks/memory.ts — Diverga Memory System for OpenCode.
 *
 * Covers:
 * - detectMemoryKeywords() for English and Korean triggers
 * - parseMemoryCommand() parsing
 * - executeMemoryCommand() output for each action
 *
 * Run: npx vitest run (from .opencode/plugins/diverga/ directory)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock context-manager BEFORE importing memory (vitest hoists vi.mock calls)
vi.mock('../hooks/context-manager.js', () => ({
  loadContext: vi.fn(),
  saveContext: vi.fn(),
  updateContext: vi.fn(),
}));

import {
  detectMemoryKeywords,
  parseMemoryCommand,
  executeMemoryCommand,
  loadMemoryContext,
} from '../hooks/memory.js';
import { loadContext } from '../hooks/context-manager.js';

const mockLoadContext = vi.mocked(loadContext);

// ---------------------------------------------------------------------------
// Test fixtures
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
  describe('English keyword triggers', () => {
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
      expect(detectMemoryKeywords('Recall the previous session context')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(detectMemoryKeywords('WHERE WAS I')).toBe(true);
      expect(detectMemoryKeywords('My Research Progress')).toBe(true);
    });
  });

  describe('Korean keyword triggers', () => {
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

    it('returns true for "지난 세션" (last session)', () => {
      expect(detectMemoryKeywords('지난 세션에서 뭘 했죠?')).toBe(true);
    });

    it('returns true for "계속" (continue)', () => {
      expect(detectMemoryKeywords('계속 진행해줘')).toBe(true);
    });

    it('returns true for "마지막" (last)', () => {
      expect(detectMemoryKeywords('마지막으로 한 작업은?')).toBe(true);
    });
  });

  describe('Unrelated text returns false', () => {
    it('returns false for generic help request', () => {
      expect(detectMemoryKeywords('Help me analyze this dataset')).toBe(false);
    });

    it('returns false for methodology question', () => {
      expect(detectMemoryKeywords('What statistical test should I use?')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(detectMemoryKeywords('')).toBe(false);
    });

    it('returns false for unrelated Korean text', () => {
      expect(detectMemoryKeywords('오늘 날씨 어때?')).toBe(false);
    });

    it('returns false for "research" alone without keyword phrase', () => {
      expect(detectMemoryKeywords('I am doing research on AI')).toBe(false);
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
    const result = parseMemoryCommand('/diverga:memory status');
    expect(result?.action).toBe('status');
  });

  it('parses "memory context" → action: context', () => {
    const result = parseMemoryCommand('memory context');
    expect(result?.action).toBe('context');
  });

  it('parses "show decisions" → action: decisions', () => {
    const result = parseMemoryCommand('show decisions');
    expect(result?.action).toBe('decisions');
  });

  it('parses "show priority" → action: priority', () => {
    const result = parseMemoryCommand('show priority');
    expect(result?.action).toBe('priority');
  });

  it('parses "memory init" → action: init', () => {
    const result = parseMemoryCommand('memory init');
    expect(result?.action).toBe('init');
  });

  it('parses Korean "메모리 상태" → action: status', () => {
    const result = parseMemoryCommand('메모리 상태');
    expect(result?.action).toBe('status');
  });

  it('parses Korean "메모리 컨텍스트" → action: context', () => {
    const result = parseMemoryCommand('메모리 컨텍스트');
    expect(result?.action).toBe('context');
  });

  it('returns null for unrecognized command', () => {
    const result = parseMemoryCommand('do something entirely different');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseMemoryCommand('');
    expect(result).toBeNull();
  });

  it('returns null for run meta-analysis query', () => {
    const result = parseMemoryCommand('run meta-analysis on effect sizes');
    expect(result).toBeNull();
  });

  it('is case-insensitive', () => {
    const result = parseMemoryCommand('MEMORY STATUS');
    expect(result?.action).toBe('status');
  });
});

// ---------------------------------------------------------------------------
// executeMemoryCommand()
// ---------------------------------------------------------------------------

describe('executeMemoryCommand()', () => {
  describe('action: status', () => {
    it('includes project name when context exists', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      const result = executeMemoryCommand({ action: 'status' });
      expect(result).toContain('AI Education Study');
    });

    it('includes "Status" label in output', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      const result = executeMemoryCommand({ action: 'status' });
      expect(result).toContain('Status');
    });

    it('includes checkpoint count', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      const result = executeMemoryCommand({ action: 'status' });
      // 2 completed checkpoints
      expect(result).toContain('2');
    });

    it('includes memory health percentage', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      const result = executeMemoryCommand({ action: 'status' });
      expect(result).toMatch(/\d+%/);
    });

    it('returns no-project message when context is null', () => {
      mockLoadContext.mockReturnValue(null);
      const result = executeMemoryCommand({ action: 'status' });
      expect(result).toContain('No research project');
    });
  });

  describe('action: context', () => {
    it('returns context string with project name', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      const result = executeMemoryCommand({ action: 'context' });
      expect(result).toContain('AI Education Study');
    });

    it('returns no-project message for null context', () => {
      mockLoadContext.mockReturnValue(null);
      const result = executeMemoryCommand({ action: 'context' });
      expect(result).toContain('No research project');
    });
  });

  describe('action: decisions', () => {
    it('lists decisions when they exist', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      const result = executeMemoryCommand({ action: 'decisions' });
      expect(result).toContain('CP_RESEARCH_DIRECTION');
    });

    it('returns no-decisions message for empty decisions', () => {
      mockLoadContext.mockReturnValue(EMPTY_CONTEXT);
      const result = executeMemoryCommand({ action: 'decisions' });
      expect(result).toContain('No decisions');
    });

    it('returns no-decisions message for null context', () => {
      mockLoadContext.mockReturnValue(null);
      const result = executeMemoryCommand({ action: 'decisions' });
      expect(result).toContain('No decisions');
    });
  });

  describe('action: priority', () => {
    it('returns Priority Context message when context exists', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      const result = executeMemoryCommand({ action: 'priority' });
      expect(result).toContain('Priority Context');
    });

    it('includes project name in priority output', () => {
      mockLoadContext.mockReturnValue(FULL_CONTEXT);
      const result = executeMemoryCommand({ action: 'priority' });
      expect(result).toContain('AI Education Study');
    });

    it('returns no-context message when context is null', () => {
      mockLoadContext.mockReturnValue(null);
      const result = executeMemoryCommand({ action: 'priority' });
      expect(result).toContain('No priority context');
    });
  });

  describe('action: init', () => {
    it('returns setup instructions referencing /diverga:setup', () => {
      mockLoadContext.mockReturnValue(null);
      const result = executeMemoryCommand({ action: 'init' });
      expect(result).toContain('/diverga:setup');
    });
  });
});
