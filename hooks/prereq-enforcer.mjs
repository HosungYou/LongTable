#!/usr/bin/env node

/**
 * prereq-enforcer.mjs — Claude Code PreToolUse hook (v11.2)
 *
 * Unified interceptor for Task and Skill tool calls targeting diverga:* agents.
 * Reads checkpoint state from SQLite (diverga.db) directly.
 *
 * Behavior:
 *   - DIVERGA_TEAM_DISPATCH=1 → bypass all prerequisite checks (orchestrator-approved)
 *   - REQUIRED prerequisite missing → hard block (continue: false)
 *   - RECOMMENDED prerequisite missing → soft block (continue: true + warning)
 *   - Entry-point agents (a1, a5, g1, x1) → always allowed
 *   - No DB found → allow entry-point agents, block others
 *
 * Debug: DIVERGA_HOOK_DEBUG=1 for verbose logging to stderr
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const debug = process.env.DIVERGA_HOOK_DEBUG === '1';

function log(...args) {
  if (debug) process.stderr.write(`[prereq-enforcer] ${args.join(' ')}\n`);
}

// Load agent alias map
let aliasMap = {};
try {
  const aliasPath = join(__dirname, '..', 'config', 'agent-aliases.json');
  const aliasData = JSON.parse(readFileSync(aliasPath, 'utf8'));
  aliasMap = aliasData.aliases || {};
} catch {
  // Alias file missing or malformed — continue without aliases
}

// Load prerequisite map
let prereqMap = null;
try {
  const mapPath = join(__dirname, '..', 'mcp', 'agent-prerequisite-map.json');
  prereqMap = JSON.parse(readFileSync(mapPath, 'utf8'));
} catch {
  log('Failed to load agent-prerequisite-map.json');
}

// Load better-sqlite3 from mcp/node_modules
let Database = null;
try {
  const require = createRequire(join(__dirname, '..', 'mcp', 'node_modules', 'placeholder.js'));
  Database = require('better-sqlite3');
} catch {
  log('better-sqlite3 not available, will use fallback logic');
}

// --- Main ---

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const hookData = JSON.parse(input);
    const result = processHook(hookData);
    process.stdout.write(JSON.stringify(result));
  } catch (e) {
    log('Error:', e.message);
    process.stdout.write(JSON.stringify({ continue: true }));
  }
});

function findResearchDir() {
  // 1. Environment variable (most reliable)
  if (process.env.DIVERGA_RESEARCH_DIR) {
    const envDir = process.env.DIVERGA_RESEARCH_DIR;
    if (existsSync(envDir)) {
      log('Using DIVERGA_RESEARCH_DIR:', envDir);
      return envDir;
    }
  }

  // 2. Walk up from CWD looking for diverga.db or .research/
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'diverga.db')) ||
        existsSync(join(dir, '.research', 'diverga.db')) ||
        existsSync(join(dir, 'research', 'diverga.db'))) {
      log('Found research dir:', dir);
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  log('No research dir found, using CWD:', process.cwd());
  return process.cwd();
}

function findDbPath(researchDir) {
  const candidates = [
    join(researchDir, 'diverga.db'),
    join(researchDir, '.research', 'diverga.db'),
    join(researchDir, 'research', 'diverga.db'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      log('Found DB:', p);
      return p;
    }
  }
  return null;
}

function getPassedCheckpointsFromSQLite(dbPath) {
  const passed = new Set();
  if (!Database) return passed;

  let db;
  try {
    db = new Database(dbPath, { readonly: true });

    // From checkpoints table
    try {
      const cpRows = db.prepare("SELECT checkpoint_id FROM checkpoints WHERE status = 'completed'").all();
      for (const row of cpRows) passed.add(row.checkpoint_id);
    } catch {
      log('No checkpoints table or query error');
    }

    // From decisions table
    try {
      const decRows = db.prepare("SELECT checkpoint_id FROM decisions WHERE checkpoint_id IS NOT NULL").all();
      for (const row of decRows) passed.add(row.checkpoint_id);
    } catch {
      log('No decisions table or query error');
    }
  } catch (e) {
    log('SQLite error:', e.message);
  } finally {
    if (db) {
      try { db.close(); } catch { /* ignore */ }
    }
  }

  log('Passed checkpoints:', [...passed].join(', '));
  return passed;
}

function processHook(hookData) {
  const toolInput = hookData.tool_input || {};

  // Handle both Task (subagent_type) and Skill (skill) tool calls
  let source = toolInput.subagent_type || toolInput.skill || '';

  // Resolve alias if source uses a human-readable name
  const aliasKey = source.replace(/^diverga:/i, '');
  if (aliasMap[aliasKey]) {
    source = `diverga:${aliasMap[aliasKey]}`;
  }

  const match = source.match(/^diverga:([a-ixv]\d+)/i);

  if (!match) {
    // Not a Diverga agent call — pass through
    return { continue: true };
  }

  const agentId = match[1].toLowerCase();
  log('Checking agent:', agentId);

  // Team dispatch bypass: orchestrator already approved this dispatch.
  // Checked via: (1) env var for testing, (2) prompt marker for runtime dispatch.
  const prompt = toolInput.prompt || '';
  if (process.env.DIVERGA_TEAM_DISPATCH === '1' ||
      prompt.includes('DIVERGA_TEAM_DISPATCH=1')) {
    log('Team dispatch mode, bypassing prerequisites for:', agentId);
    return { continue: true };
  }

  if (!prereqMap) {
    log('No prereq map loaded, allowing');
    return { continue: true };
  }

  const agentInfo = prereqMap.agents[agentId];

  if (!agentInfo) {
    log('Agent not in prereq map, allowing');
    return { continue: true };
  }

  // Entry-point agents always allowed
  if (agentInfo.entry_point) {
    log('Entry-point agent, allowing');
    return { continue: true };
  }

  // No prerequisites defined
  if (!agentInfo.prerequisites || agentInfo.prerequisites.length === 0) {
    log('No prerequisites, allowing');
    return { continue: true };
  }

  const researchDir = findResearchDir();
  const dbPath = findDbPath(researchDir);

  // No DB found
  if (!dbPath) {
    log('No checkpoint DB found');
    return {
      continue: false,
      message: `BLOCKED: No checkpoint database found. Run an entry-point agent first (A1, A5, G1, or X1) to initialize the research project.`
    };
  }

  const passedCPs = getPassedCheckpointsFromSQLite(dbPath);
  const checkpointLevels = prereqMap.checkpoint_levels || {};

  const missingRequired = [];
  const missingRecommended = [];

  for (const cp of agentInfo.prerequisites) {
    if (!passedCPs.has(cp)) {
      const level = (checkpointLevels[cp] || 'optional').toLowerCase();
      if (level === 'required') {
        missingRequired.push(cp);
      } else if (level === 'recommended') {
        missingRecommended.push(cp);
      }
    }
  }

  log('Missing required:', missingRequired.join(', '));
  log('Missing recommended:', missingRecommended.join(', '));

  // Hard block for missing REQUIRED prerequisites
  if (missingRequired.length > 0) {
    const allMissing = [...missingRequired, ...missingRecommended];
    return {
      continue: false,
      message: `BLOCKED: Agent ${agentId.toUpperCase()} requires completed checkpoints: ${missingRequired.join(', ')}. Complete these checkpoints first by running the appropriate upstream agent.${missingRecommended.length > 0 ? `\n\nAlso recommended (not blocking): ${missingRecommended.join(', ')}` : ''}`
    };
  }

  // Soft block for missing RECOMMENDED prerequisites
  if (missingRecommended.length > 0) {
    return {
      continue: true,
      additionalContext: `WARNING: Agent ${agentId.toUpperCase()} has unmet recommended checkpoints: ${missingRecommended.join(', ')}. Consider completing these for better results.`
    };
  }

  // All prerequisites met
  log('All prerequisites met, allowing');
  return { continue: true };
}
