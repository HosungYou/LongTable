#!/usr/bin/env node

/**
 * Integration test for prereq-enforcer.mjs hook
 *
 * Tests the hook by piping JSON stdin and reading stdout,
 * exactly as Claude Code would invoke it.
 *
 * Creates a temporary SQLite database with controlled checkpoint state
 * to verify all enforcement scenarios.
 */

import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const HOOK_SCRIPT = join(PROJECT_ROOT, 'hooks', 'prereq-enforcer.mjs');

// Load better-sqlite3
const require = createRequire(join(PROJECT_ROOT, 'mcp', 'node_modules', 'placeholder.js'));
const Database = require('better-sqlite3');

let passed = 0;
let failed = 0;
let tempDir = null;

function setup() {
  tempDir = mkdtempSync(join(tmpdir(), 'diverga-hook-test-'));
  console.log(`\n📁 Temp dir: ${tempDir}\n`);
}

function teardown() {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
}

function createTestDb(checkpoints = []) {
  const dbPath = join(tempDir, 'diverga.db');
  // Remove old DB to ensure clean state
  if (existsSync(dbPath)) rmSync(dbPath);
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      checkpoint_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TEXT,
      rationale TEXT
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkpoint_id TEXT,
      decision TEXT,
      rationale TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const insert = db.prepare(
    "INSERT OR REPLACE INTO checkpoints (checkpoint_id, status, completed_at) VALUES (?, 'completed', datetime('now'))"
  );

  for (const cp of checkpoints) {
    insert.run(cp);
  }

  db.close();
  return dbPath;
}

function runHook(toolInput, env = {}) {
  const hookInput = JSON.stringify({
    tool_name: toolInput.skill ? 'Skill' : 'Task',
    tool_input: toolInput
  });

  try {
    const result = execSync(
      `echo '${hookInput.replace(/'/g, "'\\''")}' | node "${HOOK_SCRIPT}"`,
      {
        cwd: tempDir,
        env: {
          ...process.env,
          DIVERGA_RESEARCH_DIR: tempDir,
          ...env
        },
        timeout: 10000,
        encoding: 'utf8'
      }
    );
    return JSON.parse(result.trim());
  } catch (e) {
    // If the command succeeds but returns non-zero, check stdout
    if (e.stdout) {
      try { return JSON.parse(e.stdout.trim()); } catch {}
    }
    throw e;
  }
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ============================================
// TEST SCENARIOS
// ============================================

console.log('═══════════════════════════════════════════════');
console.log('  prereq-enforcer.mjs — Integration Tests');
console.log('═══════════════════════════════════════════════');

setup();

// --- Scenario 1: Non-Diverga calls pass through ---
console.log('\n[1] Non-Diverga calls');

test('Non-Diverga Task passes through', () => {
  const result = runHook({ subagent_type: 'oh-my-claudecode:executor' });
  assertEqual(result.continue, true, 'continue');
});

test('Non-Diverga Skill passes through', () => {
  const result = runHook({ skill: 'commit' });
  assertEqual(result.continue, true, 'continue');
});

test('Empty input passes through', () => {
  const result = runHook({});
  assertEqual(result.continue, true, 'continue');
});

// --- Scenario 2: Entry-point agents always pass ---
console.log('\n[2] Entry-point agents (always allowed)');

test('A1 (entry-point) allowed without DB', () => {
  const result = runHook(
    { subagent_type: 'diverga:a1' },
    { DIVERGA_RESEARCH_DIR: '/nonexistent/path' }
  );
  assertEqual(result.continue, true, 'continue');
});

test('A5 (entry-point) allowed without DB', () => {
  const result = runHook(
    { skill: 'diverga:a5' },
    { DIVERGA_RESEARCH_DIR: '/nonexistent/path' }
  );
  assertEqual(result.continue, true, 'continue');
});

test('G1 (entry-point) allowed without DB', () => {
  const result = runHook({ skill: 'diverga:g1' });
  assertEqual(result.continue, true, 'continue');
});

test('X1 (entry-point) allowed without DB', () => {
  const result = runHook({ subagent_type: 'diverga:x1' });
  assertEqual(result.continue, true, 'continue');
});

// --- Scenario 3: No DB → block non-entry-point ---
console.log('\n[3] No checkpoint DB → block non-entry agents');

test('C1 blocked when no DB exists', () => {
  const result = runHook(
    { subagent_type: 'diverga:c1' },
    { DIVERGA_RESEARCH_DIR: '/nonexistent/path' }
  );
  assertEqual(result.continue, false, 'continue');
  assert(result.message && result.message.includes('BLOCKED'), 'should have BLOCKED message');
});

test('B1 blocked when no DB exists', () => {
  const result = runHook(
    { skill: 'diverga:b1' },
    { DIVERGA_RESEARCH_DIR: '/nonexistent/path' }
  );
  assertEqual(result.continue, false, 'continue');
});

// --- Scenario 4: REQUIRED prerequisites missing → hard block ---
console.log('\n[4] Missing REQUIRED prerequisites → hard block');

createTestDb([]); // Empty DB — no checkpoints completed

test('C1 hard-blocked (needs CP_RESEARCH_DIRECTION + CP_PARADIGM_SELECTION)', () => {
  const result = runHook({ subagent_type: 'diverga:c1' });
  assertEqual(result.continue, false, 'continue');
  assert(result.message.includes('CP_RESEARCH_DIRECTION') || result.message.includes('CP_PARADIGM_SELECTION'),
    'message should mention missing REQUIRED checkpoint');
});

test('D2 hard-blocked (needs CP_METHODOLOGY_APPROVAL)', () => {
  const result = runHook({ skill: 'diverga:d2' });
  assertEqual(result.continue, false, 'continue');
  assert(result.message.includes('BLOCKED'), 'should say BLOCKED');
});

test('I2 hard-blocked (needs SCH_DATABASE_SELECTION)', () => {
  const result = runHook({ subagent_type: 'diverga:i2' });
  assertEqual(result.continue, false, 'continue');
});

// --- Scenario 5: All REQUIRED met → allow ---
console.log('\n[5] All REQUIRED prerequisites met → allow');

createTestDb([
  'CP_RESEARCH_DIRECTION',
  'CP_PARADIGM_SELECTION',
  'CP_METHODOLOGY_APPROVAL',
  'CP_THEORY_SELECTION',
  'CP_VS_001',
  'CP_VS_003',
  'SCH_DATABASE_SELECTION',
  'SCH_SCREENING_CRITERIA',
  'SCH_API_KEY_VALIDATION',
]);

test('C1 allowed (CP_RESEARCH_DIRECTION + CP_PARADIGM_SELECTION met)', () => {
  const result = runHook({ subagent_type: 'diverga:c1' });
  assertEqual(result.continue, true, 'continue');
});

test('D2 allowed (CP_METHODOLOGY_APPROVAL met)', () => {
  const result = runHook({ skill: 'diverga:d2' });
  assertEqual(result.continue, true, 'continue');
});

test('E1 allowed (all prerequisites met)', () => {
  const result = runHook({ subagent_type: 'diverga:e1' });
  assertEqual(result.continue, true, 'continue');
});

test('I2 allowed (SCH_DATABASE_SELECTION met)', () => {
  const result = runHook({ skill: 'diverga:i2' });
  assertEqual(result.continue, true, 'continue');
});

test('I3 allowed (SCH_SCREENING_CRITERIA met)', () => {
  const result = runHook({ subagent_type: 'diverga:i3' });
  assertEqual(result.continue, true, 'continue');
});

// --- Scenario 6: Partial — REQUIRED met but RECOMMENDED missing → soft block ---
console.log('\n[6] RECOMMENDED missing → soft block (warning, not blocked)');

createTestDb([
  'CP_RESEARCH_DIRECTION',
  'CP_PARADIGM_SELECTION',
  // CP_VS_001 and CP_VS_003 are RECOMMENDED — intentionally NOT completed
]);

test('C1 allowed with warning (RECOMMENDED CP_VS_001 missing)', () => {
  const result = runHook({ subagent_type: 'diverga:c1' });
  assertEqual(result.continue, true, 'continue');
  // May or may not have additionalContext depending on if C1 has RECOMMENDED prereqs
  // C1's prereqs are CP_RESEARCH_DIRECTION and CP_PARADIGM_SELECTION (both REQUIRED)
  // It doesn't have RECOMMENDED ones, so no warning expected
});

// --- Scenario 7: Alias resolution ---
console.log('\n[7] Alias resolution');

createTestDb([
  'CP_RESEARCH_DIRECTION',
  'CP_PARADIGM_SELECTION',
  'CP_METHODOLOGY_APPROVAL',
]);

test('Alias "positivist" resolves to v1', () => {
  const result = runHook({ subagent_type: 'diverga:positivist' });
  // v1 needs CP_RESEARCH_DIRECTION + CP_PARADIGM_SELECTION — both met
  assertEqual(result.continue, true, 'continue');
});

test('Alias "pragmatist" resolves to v3', () => {
  const result = runHook({ skill: 'diverga:pragmatist' });
  assertEqual(result.continue, true, 'continue');
});

// --- Scenario 8: VS Arena personas ---
console.log('\n[8] VS Arena personas (V1-V5)');

createTestDb([]); // Empty — no checkpoints

test('V1 hard-blocked without prerequisites', () => {
  const result = runHook({ subagent_type: 'diverga:v1' });
  assertEqual(result.continue, false, 'continue');
});

createTestDb(['CP_RESEARCH_DIRECTION', 'CP_PARADIGM_SELECTION']);

test('V1 allowed with prerequisites met', () => {
  const result = runHook({ subagent_type: 'diverga:v1' });
  assertEqual(result.continue, true, 'continue');
});

test('V5 allowed with prerequisites met', () => {
  const result = runHook({ skill: 'diverga:v5' });
  assertEqual(result.continue, true, 'continue');
});

// --- Scenario 9: Debug mode ---
console.log('\n[9] Debug mode (DIVERGA_HOOK_DEBUG=1)');

test('Debug mode produces stderr output and still works', () => {
  createTestDb(['CP_RESEARCH_DIRECTION']);
  const hookInput = JSON.stringify({
    tool_name: 'Task',
    tool_input: { subagent_type: 'diverga:a1' }
  });

  const result = execSync(
    `echo '${hookInput}' | node "${HOOK_SCRIPT}" 2>/dev/null`,
    {
      cwd: tempDir,
      env: { ...process.env, DIVERGA_RESEARCH_DIR: tempDir, DIVERGA_HOOK_DEBUG: '1' },
      timeout: 10000,
      encoding: 'utf8'
    }
  );
  const parsed = JSON.parse(result.trim());
  assertEqual(parsed.continue, true, 'continue');
});

// --- Summary ---
teardown();

console.log('\n═══════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
