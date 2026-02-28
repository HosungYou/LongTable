#!/usr/bin/env node

/**
 * skill-interceptor.mjs — Claude Code PreToolUse hook
 *
 * Intercepts Skill tool calls targeting diverga:* agents (e.g. /diverga:c1).
 * Checks prerequisites via prereq-checker.mjs and injects
 * soft-block warnings as additionalContext.
 */

import { checkAgentPrereqs, formatWarningMessage } from '../mcp/lib/prereq-checker.mjs';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const hookData = JSON.parse(input);
    const result = processHook(hookData);
    process.stdout.write(JSON.stringify(result));
  } catch (e) {
    // On error, allow the tool call to proceed
    process.stdout.write(JSON.stringify({ continue: true }));
  }
});

function findResearchDir() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'research')) || existsSync(join(dir, '.research'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function processHook(hookData) {
  const toolInput = hookData.tool_input || {};
  const skillName = toolInput.skill || '';

  // Extract agent ID from skill name: "diverga:c1" → "c1"
  const match = skillName.match(/^diverga:([a-i]\d+)/i);
  if (!match) return { continue: true };

  const agentId = match[1].toLowerCase();
  const researchDir = findResearchDir();
  const prereqResult = checkAgentPrereqs(agentId, researchDir);

  if (prereqResult.approved) return { continue: true };

  const message = formatWarningMessage(prereqResult);
  return { continue: true, additionalContext: message };
}
