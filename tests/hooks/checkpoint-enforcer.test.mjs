/**
 * checkpoint-enforcer.test.mjs
 *
 * Tests for hooks/checkpoint-enforcer.mjs — Claude Code PreToolUse hook.
 * Tests the processHook() logic directly by importing the shared utilities
 * and replicating the hook's decision logic, since processHook is not exported.
 * We test via the exported functions from prereq-checker.mjs (which the hook
 * delegates to) and verify the hook's contract through integration.
 *
 * Run: node --test tests/hooks/checkpoint-enforcer.test.mjs
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { checkAgentPrereqs, formatWarningMessage } from '../../mcp/lib/prereq-checker.mjs';

// ---------------------------------------------------------------------------
// Helpers: temporary research directory
// ---------------------------------------------------------------------------

function makeTempDir() {
  const dir = join(tmpdir(), `diverga-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'research'), { recursive: true });
  return dir;
}

function removeTempDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function writeCheckpoints(dir, data) {
  writeFileSync(join(dir, 'research', 'checkpoints.yaml'), data, 'utf8');
}

function writeDecisionLog(dir, data) {
  writeFileSync(join(dir, 'research', 'decision-log.yaml'), data, 'utf8');
}

// ---------------------------------------------------------------------------
// Replicate the hook's processHook() logic for testing
// ---------------------------------------------------------------------------

function processHook(hookData, researchDir) {
  const toolInput = hookData.tool_input || {};
  const subagentType = toolInput.subagent_type || '';
  const match = subagentType.match(/^diverga:([a-i]\d+)/i);

  if (!match) {
    return { continue: true };
  }

  const agentId = match[1].toLowerCase();
  const prereqResult = checkAgentPrereqs(agentId, researchDir);

  if (prereqResult.approved) {
    return { continue: true };
  }

  const message = formatWarningMessage(prereqResult);
  return {
    continue: true,
    additionalContext: message
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkpoint-enforcer hook', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  // We can't use after() per-test, so clean in each test. Use a shared
  // cleanup array instead.
  const cleanup = [];

  after(() => {
    for (const d of cleanup) removeTempDir(d);
    if (tmpDir) removeTempDir(tmpDir);
  });

  // -------------------------------------------------------------------------
  // Pass-through: non-diverga agents
  // -------------------------------------------------------------------------

  test('passes through non-diverga agent (general-purpose)', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'general-purpose', prompt: 'do something' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  test('passes through when subagent_type is missing', () => {
    const result = processHook({ tool_input: { prompt: 'hello' } }, tmpDir);
    assert.deepEqual(result, { continue: true });
  });

  test('passes through when tool_input is missing', () => {
    const result = processHook({}, tmpDir);
    assert.deepEqual(result, { continue: true });
  });

  test('passes through oh-my-claudecode agent', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'oh-my-claudecode:executor' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  test('passes through bare non-namespaced type', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'executor' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  // -------------------------------------------------------------------------
  // Agent ID extraction
  // -------------------------------------------------------------------------

  test('extracts agent ID from diverga:c1 format', () => {
    // With no checkpoint files, c1 will be missing prereqs (approved:false).
    // Verify the hook did not return bare {continue: true} (which would mean
    // the regex failed), i.e., additionalContext is present.
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:c1' } },
      tmpDir
    );
    assert.equal(result.continue, true);
    // c1 has prerequisites, so it should be a soft block
    assert.ok('additionalContext' in result, 'should inject additionalContext for c1 missing prereqs');
  });

  test('extracts agent ID from diverga:e1 format', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:e1' } },
      tmpDir
    );
    assert.equal(result.continue, true);
    // e1 needs CP_METHODOLOGY_APPROVAL
    assert.ok('additionalContext' in result);
  });

  test('extracts uppercase agent ID (diverga:C1)', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:C1' } },
      tmpDir
    );
    assert.equal(result.continue, true);
    assert.ok('additionalContext' in result, 'should soft-block uppercase C1 same as c1');
  });

  // -------------------------------------------------------------------------
  // Entry-point agents (no prerequisites)
  // -------------------------------------------------------------------------

  test('passes through a1 (entry-point, no prerequisites)', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:a1' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  test('passes through a4 (entry-point, no prerequisites)', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:a4' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  test('passes through b3 (entry-point, no prerequisites)', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:b3' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  test('passes through g1 (entry-point, no prerequisites)', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:g1' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  test('passes through i0 (entry-point, no prerequisites)', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:i0' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  // -------------------------------------------------------------------------
  // Soft block for agents with REQUIRED missing prerequisites
  // -------------------------------------------------------------------------

  test('returns soft block for c1 with both REQUIRED prereqs missing', () => {
    // c1 needs CP_PARADIGM_SELECTION (required) and CP_RESEARCH_DIRECTION (required)
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:c1' } },
      tmpDir
    );
    assert.equal(result.continue, true, 'always continues (soft block)');
    assert.ok(typeof result.additionalContext === 'string');
    assert.ok(result.additionalContext.includes('CP_PARADIGM_SELECTION') ||
               result.additionalContext.includes('CP_RESEARCH_DIRECTION'),
               'warning should mention missing checkpoints');
    assert.ok(result.additionalContext.includes('REQUIRED'), 'should call out REQUIRED level');
  });

  test('returns soft block for c1 mentioning CP_RESEARCH_DIRECTION', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:c1' } },
      tmpDir
    );
    assert.ok(result.additionalContext.includes('CP_RESEARCH_DIRECTION'));
  });

  test('returns soft block for c5 missing CP_METHODOLOGY_APPROVAL', () => {
    // Provide CP_RESEARCH_DIRECTION so only CP_METHODOLOGY_APPROVAL is missing
    writeCheckpoints(tmpDir, `checkpoints:
  active:
    - checkpoint_id: CP_RESEARCH_DIRECTION
      status: completed
`);
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:c5' } },
      tmpDir
    );
    assert.equal(result.continue, true);
    assert.ok('additionalContext' in result);
    assert.ok(result.additionalContext.includes('CP_METHODOLOGY_APPROVAL'));
  });

  // -------------------------------------------------------------------------
  // Soft block for agents with RECOMMENDED missing prerequisites
  // -------------------------------------------------------------------------

  test('returns soft block for g6 missing CP_HUMANIZATION_REVIEW (recommended)', () => {
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:g6' } },
      tmpDir
    );
    assert.equal(result.continue, true);
    assert.ok('additionalContext' in result);
    assert.ok(result.additionalContext.includes('CP_HUMANIZATION_REVIEW'));
  });

  // -------------------------------------------------------------------------
  // Agent is allowed when prerequisites are met
  // -------------------------------------------------------------------------

  test('passes through c1 when all prerequisites are met via checkpoints.yaml', () => {
    writeCheckpoints(tmpDir, `checkpoints:
  active:
    - checkpoint_id: CP_PARADIGM_SELECTION
      status: completed
    - checkpoint_id: CP_RESEARCH_DIRECTION
      status: completed
`);
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:c1' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  test('passes through c1 when prerequisites met via decision-log.yaml', () => {
    writeDecisionLog(tmpDir, `decisions:
  - decision_id: DEV_001
    checkpoint_id: CP_PARADIGM_SELECTION
    selected: quantitative
  - decision_id: DEV_002
    checkpoint_id: CP_RESEARCH_DIRECTION
    selected: AI in education
`);
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:c1' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });

  // -------------------------------------------------------------------------
  // Always continue: true (soft block, never hard block)
  // -------------------------------------------------------------------------

  test('always returns continue:true even when prereqs are missing', () => {
    const agentsWithPrereqs = ['c1', 'c2', 'c3', 'e1', 'e2', 'h1'];
    for (const agentId of agentsWithPrereqs) {
      const result = processHook(
        { tool_input: { subagent_type: `diverga:${agentId}` } },
        tmpDir
      );
      assert.equal(result.continue, true, `agent ${agentId} must always have continue:true`);
    }
  });

  test('always returns continue:true for unknown diverga agent', () => {
    // diverga:z9 — unknown agent; should pass through gracefully
    const result = processHook(
      { tool_input: { subagent_type: 'diverga:z9' } },
      tmpDir
    );
    assert.equal(result.continue, true);
  });

  // -------------------------------------------------------------------------
  // Malformed input
  // -------------------------------------------------------------------------

  test('handles empty object input gracefully', () => {
    const result = processHook({}, tmpDir);
    assert.deepEqual(result, { continue: true });
  });

  test('handles null tool_input gracefully', () => {
    const result = processHook({ tool_input: null }, tmpDir);
    assert.deepEqual(result, { continue: true });
  });

  test('handles empty subagent_type string', () => {
    const result = processHook({ tool_input: { subagent_type: '' } }, tmpDir);
    assert.deepEqual(result, { continue: true });
  });

  test('ignores diverga- prefix (dash, not colon)', () => {
    // The regex requires "diverga:" not "diverga-", so this passes through
    const result = processHook(
      { tool_input: { subagent_type: 'diverga-c1' } },
      tmpDir
    );
    assert.deepEqual(result, { continue: true });
  });
});
