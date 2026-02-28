/**
 * skill-interceptor.test.mjs
 *
 * Tests for hooks/skill-interceptor.mjs — Claude Code PreToolUse hook
 * for Skill tool calls targeting diverga:* agents (e.g. /diverga:c1).
 *
 * We replicate processHook() from skill-interceptor.mjs directly here so
 * we can drive it without stdin, using the same shared prereq-checker.
 *
 * Run: node --test tests/hooks/skill-interceptor.test.mjs
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { checkAgentPrereqs, formatWarningMessage } from '../../mcp/lib/prereq-checker.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir() {
  const dir = join(tmpdir(), `diverga-skill-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'research'), { recursive: true });
  return dir;
}

function removeTempDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function writeDecisionLog(dir, data) {
  writeFileSync(join(dir, 'research', 'decision-log.yaml'), data, 'utf8');
}

function writeCheckpoints(dir, data) {
  writeFileSync(join(dir, 'research', 'checkpoints.yaml'), data, 'utf8');
}

// ---------------------------------------------------------------------------
// Replicate processHook() from skill-interceptor.mjs
// ---------------------------------------------------------------------------

function processHook(hookData, researchDir) {
  const toolInput = hookData.tool_input || {};
  const skillName = toolInput.skill || '';

  const match = skillName.match(/^diverga:([a-i]\d+)/i);
  if (!match) return { continue: true };

  const agentId = match[1].toLowerCase();
  const prereqResult = checkAgentPrereqs(agentId, researchDir);

  if (prereqResult.approved) return { continue: true };

  const message = formatWarningMessage(prereqResult);
  return { continue: true, additionalContext: message };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('skill-interceptor hook', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  const dirsToClean = [];

  after(() => {
    for (const d of dirsToClean) removeTempDir(d);
    if (tmpDir) removeTempDir(tmpDir);
  });

  // -------------------------------------------------------------------------
  // Agent ID extraction from skill name
  // -------------------------------------------------------------------------

  test('extracts agent ID from diverga:e1 skill format', () => {
    const result = processHook(
      { tool_input: { skill: 'diverga:e1' } },
      tmpDir
    );
    // e1 requires CP_METHODOLOGY_APPROVAL — should soft block
    assert.equal(result.continue, true);
    assert.ok('additionalContext' in result, 'e1 should be soft-blocked (missing prereq)');
  });

  test('extracts agent ID from diverga:c1 skill format', () => {
    const result = processHook(
      { tool_input: { skill: 'diverga:c1' } },
      tmpDir
    );
    assert.equal(result.continue, true);
    assert.ok('additionalContext' in result);
    assert.ok(result.additionalContext.includes('CP_PARADIGM_SELECTION') ||
               result.additionalContext.includes('CP_RESEARCH_DIRECTION'));
  });

  test('extracts uppercase skill format diverga:C1', () => {
    const result = processHook(
      { tool_input: { skill: 'diverga:C1' } },
      tmpDir
    );
    // Should be treated same as diverga:c1
    assert.equal(result.continue, true);
    assert.ok('additionalContext' in result, 'uppercase skill should soft-block same as lowercase');
  });

  // -------------------------------------------------------------------------
  // Soft block for agents with prerequisites
  // -------------------------------------------------------------------------

  test('returns soft block for c1 with missing prerequisites', () => {
    const result = processHook(
      { tool_input: { skill: 'diverga:c1' } },
      tmpDir
    );
    assert.equal(result.continue, true, 'always continues (soft block)');
    assert.ok(typeof result.additionalContext === 'string');
    assert.ok(result.additionalContext.length > 0);
    assert.ok(result.additionalContext.includes('REQUIRED'));
  });

  test('returns soft block for h1 missing CP_PARADIGM_SELECTION', () => {
    const result = processHook(
      { tool_input: { skill: 'diverga:h1' } },
      tmpDir
    );
    assert.equal(result.continue, true);
    assert.ok('additionalContext' in result);
    assert.ok(result.additionalContext.includes('CP_PARADIGM_SELECTION'));
  });

  test('passes through when prerequisites are met', () => {
    writeDecisionLog(tmpDir, `decisions:
  - decision_id: DEV_001
    checkpoint_id: CP_PARADIGM_SELECTION
    selected: quantitative
  - decision_id: DEV_002
    checkpoint_id: CP_RESEARCH_DIRECTION
    selected: AI in education
`);
    const result = processHook(
      { tool_input: { skill: 'diverga:c1' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  // -------------------------------------------------------------------------
  // Pass-through for non-diverga skills
  // -------------------------------------------------------------------------

  test('passes through non-diverga skill', () => {
    const result = processHook(
      { tool_input: { skill: 'oh-my-claudecode:autopilot' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  test('passes through bare skill name (no namespace)', () => {
    const result = processHook(
      { tool_input: { skill: 'autopilot' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  test('passes through diverga-c1 (dash, not colon)', () => {
    // Regex requires "diverga:" not "diverga-"
    const result = processHook(
      { tool_input: { skill: 'diverga-c1' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  test('passes through diverga:setup (non-agent letter prefix)', () => {
    // "setup" does not start with [a-i]\d+
    const result = processHook(
      { tool_input: { skill: 'diverga:setup' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  // -------------------------------------------------------------------------
  // Missing skill field
  // -------------------------------------------------------------------------

  test('handles missing skill field gracefully', () => {
    const result = processHook({ tool_input: {} }, tmpDir);
    assert.deepEqual(result, { continue: true });
  });

  test('handles missing tool_input gracefully', () => {
    const result = processHook({}, tmpDir);
    assert.deepEqual(result, { continue: true });
  });

  test('handles empty skill string', () => {
    const result = processHook({ tool_input: { skill: '' } }, tmpDir);
    assert.deepEqual(result, { continue: true });
  });

  // -------------------------------------------------------------------------
  // Entry-point agents pass through
  // -------------------------------------------------------------------------

  test('passes through entry-point a1 with no prerequisites', () => {
    const result = processHook({ tool_input: { skill: 'diverga:a1' } }, tmpDir);
    assert.deepEqual(result, { continue: true });
  });

  test('passes through entry-point b3 with no prerequisites', () => {
    const result = processHook({ tool_input: { skill: 'diverga:b3' } }, tmpDir);
    assert.deepEqual(result, { continue: true });
  });

  // -------------------------------------------------------------------------
  // Always continue:true
  // -------------------------------------------------------------------------

  test('always returns continue:true even when soft-blocking', () => {
    const agentsWithPrereqs = ['c1', 'c2', 'e1', 'e2', 'h1', 'h2'];
    for (const agentId of agentsWithPrereqs) {
      const result = processHook(
        { tool_input: { skill: `diverga:${agentId}` } },
        tmpDir
      );
      assert.equal(result.continue, true, `${agentId} must always have continue:true`);
    }
  });
});
