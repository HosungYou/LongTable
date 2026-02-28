/**
 * checkpoint-logic-lazinit.test.mjs
 *
 * Tests for the lazy-init behavior in mcp/lib/checkpoint-logic.js.
 * Specifically: when both checkpoints.yaml and decision-log.yaml are
 * absent, checkPrerequisites() creates a skeleton checkpoints.yaml
 * and returns first_run:true, approved:false.
 *
 * Run: node --test tests/hooks/checkpoint-logic-lazinit.test.mjs
 */

import { test, describe, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
import { createCheckpointLogic } from '../../mcp/lib/checkpoint-logic.js';

// Load the prerequisite map from the actual file
import { readFileSync as _readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prereqMap = JSON.parse(
  _readFileSync(join(__dirname, '../../mcp/agent-prerequisite-map.json'), 'utf8')
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir() {
  const dir = join(tmpdir(), `diverga-lazinit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function removeTempDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkpoint-logic lazy init', () => {
  let systemDir;
  let publicDir;
  let logic;

  beforeEach(() => {
    systemDir = makeTempDir();
    publicDir = join(systemDir, 'research');
    mkdirSync(publicDir, { recursive: true });
    logic = createCheckpointLogic(prereqMap, systemDir, publicDir);
  });

  after(() => {
    if (systemDir) removeTempDir(systemDir);
  });

  // -------------------------------------------------------------------------
  // Both files missing → first_run behavior
  // -------------------------------------------------------------------------

  test('creates checkpoints.yaml skeleton when both yaml files are missing', () => {
    const checkpointsFile = join(publicDir, 'checkpoints.yaml');
    const decisionLogFile = join(publicDir, 'decision-log.yaml');

    assert.ok(!existsSync(checkpointsFile), 'checkpoints.yaml should not exist yet');
    assert.ok(!existsSync(decisionLogFile), 'decision-log.yaml should not exist yet');

    // Trigger lazy init by calling checkPrerequisites for an agent with prereqs
    logic.checkPrerequisites('c1');

    assert.ok(existsSync(checkpointsFile), 'checkpoints.yaml should be created after first call');
  });

  test('skeleton contains all REQUIRED checkpoints as pending', () => {
    logic.checkPrerequisites('c1');

    const checkpointsFile = join(publicDir, 'checkpoints.yaml');
    const data = yaml.load(readFileSync(checkpointsFile, 'utf8'));

    // Collect all pending checkpoint IDs from the skeleton
    const pendingIds = new Set();
    if (data?.checkpoints?.pending) {
      for (const cp of data.checkpoints.pending) {
        pendingIds.add(cp.checkpoint_id);
      }
    }

    // All required checkpoints from the prereq map should be in the skeleton
    for (const [cpId, level] of Object.entries(prereqMap.checkpoint_levels)) {
      if (level === 'required') {
        assert.ok(pendingIds.has(cpId), `skeleton should include REQUIRED checkpoint: ${cpId}`);
      }
    }
  });

  test('skeleton checkpoint entries have status: pending', () => {
    logic.checkPrerequisites('c1');

    const checkpointsFile = join(publicDir, 'checkpoints.yaml');
    const data = yaml.load(readFileSync(checkpointsFile, 'utf8'));

    if (data?.checkpoints?.pending) {
      for (const cp of data.checkpoints.pending) {
        assert.equal(cp.status, 'pending', `checkpoint ${cp.checkpoint_id} should be pending`);
      }
    }
  });

  test('skeleton checkpoint entries have level: REQUIRED', () => {
    logic.checkPrerequisites('c1');

    const checkpointsFile = join(publicDir, 'checkpoints.yaml');
    const data = yaml.load(readFileSync(checkpointsFile, 'utf8'));

    if (data?.checkpoints?.pending) {
      for (const cp of data.checkpoints.pending) {
        assert.equal(cp.level, 'REQUIRED', `checkpoint ${cp.checkpoint_id} should have level REQUIRED`);
      }
    }
  });

  test('returns first_run: true on first call with missing files', () => {
    const result = logic.checkPrerequisites('c1');
    assert.equal(result.first_run, true);
  });

  test('returns approved: false on first run (prereqs cannot be met without decisions)', () => {
    const result = logic.checkPrerequisites('c1');
    assert.equal(result.approved, false);
  });

  test('missing array contains c1 prerequisites on first run', () => {
    const result = logic.checkPrerequisites('c1');
    assert.ok(Array.isArray(result.missing), 'missing should be an array');
    assert.ok(result.missing.length > 0, 'should report missing prerequisites');
    // c1 needs CP_PARADIGM_SELECTION and CP_RESEARCH_DIRECTION
    assert.ok(
      result.missing.includes('CP_PARADIGM_SELECTION') ||
      result.missing.includes('CP_RESEARCH_DIRECTION'),
      'should include c1 prerequisites in missing list'
    );
  });

  test('entry-point agents approved even on first run', () => {
    // a1 has no prerequisites, so it's approved even on first run
    const result = logic.checkPrerequisites('a1');
    assert.equal(result.approved, true);
  });

  test('subsequent call after skeleton creation does not set first_run', () => {
    // First call creates skeleton
    logic.checkPrerequisites('c1');

    // Second call: checkpoints.yaml now exists (even if all pending)
    const result2 = logic.checkPrerequisites('c1');
    // first_run should not be set on subsequent calls
    assert.ok(result2.first_run !== true, 'first_run should not be true on second call');
  });

  test('message includes first run detected text', () => {
    const result = logic.checkPrerequisites('c1');
    assert.ok(typeof result.message === 'string');
    assert.ok(
      result.message.toLowerCase().includes('first run') ||
      result.message.toLowerCase().includes('initialized'),
      `message should mention first run or initialization, got: ${result.message}`
    );
  });

  // -------------------------------------------------------------------------
  // Skeleton is valid YAML and parseable
  // -------------------------------------------------------------------------

  test('created skeleton is valid parseable YAML', () => {
    logic.checkPrerequisites('e1');

    const checkpointsFile = join(publicDir, 'checkpoints.yaml');
    assert.ok(existsSync(checkpointsFile));

    let data;
    assert.doesNotThrow(() => {
      data = yaml.load(readFileSync(checkpointsFile, 'utf8'));
    }, 'skeleton should be valid YAML');

    assert.ok(data !== null && typeof data === 'object', 'parsed YAML should be an object');
    assert.ok('checkpoints' in data, 'should have checkpoints key');
  });
});
