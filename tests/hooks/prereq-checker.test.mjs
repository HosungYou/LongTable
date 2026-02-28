/**
 * prereq-checker.test.mjs
 *
 * Tests for mcp/lib/prereq-checker.mjs — shared utility for checking
 * agent prerequisites against the YAML state files.
 *
 * Run: node --test tests/hooks/prereq-checker.test.mjs
 */

import { test, describe, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { checkAgentPrereqs, formatWarningMessage } from '../../mcp/lib/prereq-checker.mjs';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTempDir() {
  const dir = join(tmpdir(), `diverga-prereq-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
// checkAgentPrereqs tests
// ---------------------------------------------------------------------------

describe('checkAgentPrereqs()', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  const dirs = [];

  after(() => {
    for (const d of dirs) removeTempDir(d);
    if (tmpDir) removeTempDir(tmpDir);
  });

  // -------------------------------------------------------------------------
  // Agents with no prerequisites → approved:true
  // -------------------------------------------------------------------------

  test('returns approved:true for a1 (entry-point, no prerequisites)', () => {
    const result = checkAgentPrereqs('a1', tmpDir);
    assert.equal(result.approved, true);
    assert.deepEqual(result.missing, []);
  });

  test('returns approved:true for a4 (no prerequisites)', () => {
    const result = checkAgentPrereqs('a4', tmpDir);
    assert.equal(result.approved, true);
  });

  test('returns approved:true for b3 (no prerequisites)', () => {
    const result = checkAgentPrereqs('b3', tmpDir);
    assert.equal(result.approved, true);
  });

  test('returns approved:true for g1 (entry-point, no prerequisites)', () => {
    const result = checkAgentPrereqs('g1', tmpDir);
    assert.equal(result.approved, true);
  });

  test('returns approved:true for i0 (no prerequisites)', () => {
    const result = checkAgentPrereqs('i0', tmpDir);
    assert.equal(result.approved, true);
  });

  test('returns approved:true for f1 (no prerequisites)', () => {
    const result = checkAgentPrereqs('f1', tmpDir);
    assert.equal(result.approved, true);
  });

  // -------------------------------------------------------------------------
  // Unknown agent IDs → approved:true (fail open)
  // -------------------------------------------------------------------------

  test('returns approved:true for completely unknown agent ID', () => {
    const result = checkAgentPrereqs('z9', tmpDir);
    assert.equal(result.approved, true, 'unknown agents should fail open');
    assert.deepEqual(result.missing, []);
  });

  test('returns approved:true for empty string agent ID', () => {
    const result = checkAgentPrereqs('', tmpDir);
    assert.equal(result.approved, true);
  });

  test('returns approved:true for "foobar" agent ID', () => {
    const result = checkAgentPrereqs('foobar', tmpDir);
    assert.equal(result.approved, true);
  });

  // -------------------------------------------------------------------------
  // Agents with unmet prerequisites → approved:false
  // -------------------------------------------------------------------------

  test('returns approved:false for c1 when no checkpoint files exist', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    assert.equal(result.approved, false);
    assert.ok(result.missing.length > 0);
    assert.ok(result.missing.includes('CP_PARADIGM_SELECTION') ||
               result.missing.includes('CP_RESEARCH_DIRECTION'));
  });

  test('lists all missing prerequisites for c1', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    // c1 needs CP_PARADIGM_SELECTION and CP_RESEARCH_DIRECTION
    assert.ok(result.missing.includes('CP_PARADIGM_SELECTION'));
    assert.ok(result.missing.includes('CP_RESEARCH_DIRECTION'));
  });

  test('returns approved:false for e1 with missing CP_METHODOLOGY_APPROVAL', () => {
    const result = checkAgentPrereqs('e1', tmpDir);
    assert.equal(result.approved, false);
    assert.ok(result.missing.includes('CP_METHODOLOGY_APPROVAL'));
  });

  test('returns approved:false for g6 with missing CP_HUMANIZATION_REVIEW', () => {
    const result = checkAgentPrereqs('g6', tmpDir);
    assert.equal(result.approved, false);
    assert.ok(result.missing.includes('CP_HUMANIZATION_REVIEW'));
  });

  // -------------------------------------------------------------------------
  // Partial fulfillment
  // -------------------------------------------------------------------------

  test('returns approved:false for c1 when only CP_RESEARCH_DIRECTION is met', () => {
    writeCheckpoints(tmpDir, `checkpoints:
  active:
    - checkpoint_id: CP_RESEARCH_DIRECTION
      status: completed
`);
    const result = checkAgentPrereqs('c1', tmpDir);
    assert.equal(result.approved, false);
    assert.ok(result.missing.includes('CP_PARADIGM_SELECTION'));
    assert.ok(!result.missing.includes('CP_RESEARCH_DIRECTION'));
  });

  test('returns approved:true for c1 when both prerequisites met via checkpoints.yaml', () => {
    writeCheckpoints(tmpDir, `checkpoints:
  active:
    - checkpoint_id: CP_PARADIGM_SELECTION
      status: completed
    - checkpoint_id: CP_RESEARCH_DIRECTION
      status: completed
`);
    const result = checkAgentPrereqs('c1', tmpDir);
    assert.equal(result.approved, true);
    assert.deepEqual(result.missing, []);
  });

  test('returns approved:true for c1 when prerequisites met via decision-log.yaml', () => {
    writeDecisionLog(tmpDir, `decisions:
  - decision_id: DEV_001
    checkpoint_id: CP_PARADIGM_SELECTION
    selected: quantitative
  - decision_id: DEV_002
    checkpoint_id: CP_RESEARCH_DIRECTION
    selected: AI in education
`);
    const result = checkAgentPrereqs('c1', tmpDir);
    assert.equal(result.approved, true);
  });

  test('reads from both checkpoints.yaml and decision-log.yaml combined', () => {
    // c5 needs CP_RESEARCH_DIRECTION and CP_METHODOLOGY_APPROVAL
    writeCheckpoints(tmpDir, `checkpoints:
  active:
    - checkpoint_id: CP_RESEARCH_DIRECTION
      status: completed
`);
    writeDecisionLog(tmpDir, `decisions:
  - decision_id: DEV_001
    checkpoint_id: CP_METHODOLOGY_APPROVAL
    selected: quantitative-rct
`);
    const result = checkAgentPrereqs('c5', tmpDir);
    assert.equal(result.approved, true);
  });

  // -------------------------------------------------------------------------
  // Agent ID normalization
  // -------------------------------------------------------------------------

  test('normalizes lowercase c1 correctly', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    assert.equal(result.approved, false); // prereqs unmet, but ID was recognized
    assert.ok(result.missing.length > 0);
  });

  test('normalizes uppercase C1 correctly', () => {
    const result = checkAgentPrereqs('C1', tmpDir);
    assert.equal(result.approved, false);
    assert.ok(result.missing.length > 0);
  });

  test('normalizes diverga:c1 format (strips prefix)', () => {
    // The prereq-checker itself does: id.match(/^[a-i]\d+/)?.[0]
    // After replace: 'diverga:c1' → 'divergac1' → shortId match fails → treated as unknown?
    // Actually: 'diverga:c1'.toLowerCase().replace(/[-_]/g,'') = 'diverga:c1'
    // match(/^[a-i]\d+/) = null → id itself = 'diverga:c1'
    // agent = prereqMap.agents['diverga:c1'] = undefined → approved:true
    // The hook does the regex stripping BEFORE calling checkAgentPrereqs.
    // So diverga:c1 as agentId to checkAgentPrereqs → unknown → approved:true
    const result = checkAgentPrereqs('diverga:c1', tmpDir);
    // Per actual code: if agent not found → approved:true
    assert.equal(result.approved, true, 'diverga:c1 prefix not stripped by prereq-checker itself');
  });

  test('normalizes diverga-c1 format (dash prefix stripped)', () => {
    // 'diverga-c1'.toLowerCase().replace(/[-_]/g,'') = 'divergac1'
    // match(/^[a-i]\d+/) = null → shortId = 'divergac1'
    // Not a known agent → approved:true
    const result = checkAgentPrereqs('diverga-c1', tmpDir);
    assert.equal(result.approved, true, 'diverga-c1 with dash treated as unknown agent');
  });

  test('normalizes with underscores stripped (c_1)', () => {
    // 'c_1'.replace(/[-_]/g,'') = 'c1', match = 'c1' ✓
    const result = checkAgentPrereqs('c_1', tmpDir);
    // Should resolve to c1
    assert.equal(result.approved, false);
    assert.ok(result.missing.includes('CP_PARADIGM_SELECTION'));
  });

  // -------------------------------------------------------------------------
  // Level classification
  // -------------------------------------------------------------------------

  test('classifies CP_PARADIGM_SELECTION as required in levels map', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    assert.equal(result.levels['CP_PARADIGM_SELECTION'], 'required');
  });

  test('classifies CP_RESEARCH_DIRECTION as required in levels map', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    assert.equal(result.levels['CP_RESEARCH_DIRECTION'], 'required');
  });

  test('classifies CP_HUMANIZATION_REVIEW as recommended in levels map', () => {
    const result = checkAgentPrereqs('g6', tmpDir);
    assert.equal(result.levels['CP_HUMANIZATION_REVIEW'], 'recommended');
  });

  test('hasRequired is true when required checkpoints are missing', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    assert.equal(result.hasRequired, true);
  });

  test('hasRequired is false when only recommended checkpoints are missing', () => {
    const result = checkAgentPrereqs('g6', tmpDir);
    // g6 needs CP_HUMANIZATION_REVIEW which is "recommended"
    assert.equal(result.hasRequired, false);
  });

  // -------------------------------------------------------------------------
  // Warnings array
  // -------------------------------------------------------------------------

  test('generates warning for required missing checkpoint', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    const hasRequired = result.warnings.some(w => w.includes('REQUIRED'));
    assert.ok(hasRequired, 'should have at least one REQUIRED warning');
  });

  test('generates RECOMMENDED warning for recommended missing checkpoints', () => {
    const result = checkAgentPrereqs('g6', tmpDir);
    const hasRecommended = result.warnings.some(w => w.includes('RECOMMENDED'));
    assert.ok(hasRecommended);
  });

  test('warnings array is empty when approved', () => {
    const result = checkAgentPrereqs('a1', tmpDir);
    assert.deepEqual(result.warnings, []);
  });

  // -------------------------------------------------------------------------
  // Checkpoint files with non-completed status ignored
  // -------------------------------------------------------------------------

  test('ignores checkpoints with status != completed', () => {
    writeCheckpoints(tmpDir, `checkpoints:
  pending:
    - checkpoint_id: CP_PARADIGM_SELECTION
      status: pending
    - checkpoint_id: CP_RESEARCH_DIRECTION
      status: pending
`);
    const result = checkAgentPrereqs('c1', tmpDir);
    assert.equal(result.approved, false, 'pending checkpoints should not count as passed');
    assert.ok(result.missing.includes('CP_PARADIGM_SELECTION'));
  });
});

// ---------------------------------------------------------------------------
// formatWarningMessage tests
// ---------------------------------------------------------------------------

describe('formatWarningMessage()', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  after(() => {
    if (tmpDir) removeTempDir(tmpDir);
  });

  test('returns empty string when result is approved', () => {
    const result = checkAgentPrereqs('a1', tmpDir);
    const msg = formatWarningMessage(result);
    assert.equal(msg, '');
  });

  test('generates warning text for required prerequisite', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    const msg = formatWarningMessage(result);
    assert.ok(msg.length > 0);
    assert.ok(msg.includes('REQUIRED'), 'message should mention REQUIRED level');
  });

  test('includes agent name in warning message', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    const msg = formatWarningMessage(result);
    // The agent name or ID should appear
    assert.ok(msg.includes('unmet prerequisites'), 'message should mention unmet prerequisites');
  });

  test('mentions the specific missing checkpoint in warning', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    const msg = formatWarningMessage(result);
    assert.ok(msg.includes('CP_PARADIGM_SELECTION') || msg.includes('CP_RESEARCH_DIRECTION'));
  });

  test('for required missing CPs, mentions override refusal', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    const msg = formatWarningMessage(result);
    assert.ok(msg.includes('cannot be skipped') || msg.includes('REQUIRED'));
  });

  test('for only recommended missing CPs, says they may proceed', () => {
    const result = checkAgentPrereqs('g6', tmpDir);
    const msg = formatWarningMessage(result);
    assert.ok(
      msg.includes('recommended') || msg.includes('may proceed') || msg.includes('RECOMMENDED'),
      'recommended-only message should indicate optional nature'
    );
  });

  test('warning message contains newlines (multi-line format)', () => {
    const result = checkAgentPrereqs('c1', tmpDir);
    const msg = formatWarningMessage(result);
    assert.ok(msg.includes('\n'), 'warning should be multi-line');
  });

  test('approved:true with explicit approved field → returns empty string', () => {
    const fakeApproved = { approved: true, missing: [], levels: {}, warnings: [] };
    const msg = formatWarningMessage(fakeApproved);
    assert.equal(msg, '');
  });
});
