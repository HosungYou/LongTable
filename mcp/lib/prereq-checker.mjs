import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

// Load the agent prerequisite map
const PREREQ_MAP_PATH = new URL('../agent-prerequisite-map.json', import.meta.url);

let _prereqMap = null;
function getPrereqMap() {
  if (!_prereqMap) {
    _prereqMap = JSON.parse(readFileSync(PREREQ_MAP_PATH, 'utf8'));
  }
  return _prereqMap;
}

function readYaml(filepath) {
  if (!existsSync(filepath)) return null;
  try { return yaml.load(readFileSync(filepath, 'utf8')); } catch { return null; }
}

function getPassedCheckpoints(researchDir) {
  // Check both research/ and .research/ paths
  const paths = [
    join(researchDir, 'research', 'checkpoints.yaml'),
    join(researchDir, '.research', 'checkpoints.yaml'),
    join(researchDir, 'research', 'decision-log.yaml'),
    join(researchDir, '.research', 'decision-log.yaml'),
  ];

  const passed = new Set();

  // From checkpoints.yaml
  for (const cpPath of [paths[0], paths[1]]) {
    const data = readYaml(cpPath);
    if (data?.checkpoints) {
      for (const stage of Object.values(data.checkpoints)) {
        if (Array.isArray(stage)) {
          for (const cp of stage) {
            if (cp.status === 'completed') passed.add(cp.checkpoint_id);
          }
        }
      }
    }
  }

  // From decision-log.yaml
  for (const dlPath of [paths[2], paths[3]]) {
    const data = readYaml(dlPath);
    if (data?.decisions) {
      for (const d of data.decisions) {
        if (d.checkpoint_id) passed.add(d.checkpoint_id);
      }
    }
  }

  return passed;
}

export function checkAgentPrereqs(agentId, researchDir) {
  const prereqMap = getPrereqMap();
  const id = agentId.toLowerCase().replace(/[-_]/g, '');
  const shortId = id.match(/^[a-i]\d+/)?.[0] || id;
  const agent = prereqMap.agents[shortId];

  if (!agent) return { approved: true, missing: [], levels: {}, warnings: [] };
  if (agent.prerequisites.length === 0) return { approved: true, missing: [], levels: {}, warnings: [] };

  const passedCPs = getPassedCheckpoints(researchDir);
  const missing = agent.prerequisites.filter(cp => !passedCPs.has(cp));

  const levels = {};
  const warnings = [];

  for (const cp of missing) {
    const level = prereqMap.checkpoint_levels[cp] || 'optional';
    levels[cp] = level;
    if (level === 'required') {
      warnings.push(`🔴 REQUIRED: ${cp} must be completed before running agent ${agentId}`);
    } else if (level === 'recommended') {
      warnings.push(`🟠 RECOMMENDED: ${cp} should be completed before running agent ${agentId}`);
    }
  }

  const hasRequired = missing.some(cp => (prereqMap.checkpoint_levels[cp] || 'optional') === 'required');

  return {
    approved: missing.length === 0,
    missing,
    levels,
    warnings,
    hasRequired,
    agentName: agent.name || agentId,
    ownCheckpoints: agent.own_checkpoints || []
  };
}

export function formatWarningMessage(result) {
  if (result.approved) return '';

  const lines = [`⚠️ Agent ${result.agentName} has unmet prerequisites:`];
  lines.push('');

  for (const w of result.warnings) {
    lines.push(`  ${w}`);
  }

  lines.push('');
  if (result.hasRequired) {
    lines.push('Ask user: Complete these checkpoints or skip? (REQUIRED checkpoints cannot be skipped)');
  } else {
    lines.push('These are recommended checkpoints. You may proceed or complete them first.');
  }

  return lines.join('\n');
}
