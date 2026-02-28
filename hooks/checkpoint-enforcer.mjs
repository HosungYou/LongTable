#!/usr/bin/env node

/**
 * checkpoint-enforcer.mjs — Claude Code PreToolUse hook
 *
 * Intercepts Task tool calls targeting diverga:* agents.
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

  // Extract agent ID from subagent_type: "diverga:a1" → "a1"
  const subagentType = toolInput.subagent_type || '';
  const match = subagentType.match(/^diverga:([a-i]\d+)/i);

  if (!match) {
    // Not a Diverga agent call — pass through
    return { continue: true };
  }

  const agentId = match[1].toLowerCase();
  const researchDir = findResearchDir();
  const prereqResult = checkAgentPrereqs(agentId, researchDir);

  if (prereqResult.approved) {
    return { continue: true };
  }

  const message = formatWarningMessage(prereqResult);

  // Soft block: always continue, inject warning as additionalContext
  return {
    continue: true,
    additionalContext: message
  };
}
