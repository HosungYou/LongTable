#!/usr/bin/env node

/**
 * diverga-server.js
 *
 * Unified MCP entry point for Diverga v11.0.
 * SQLite-backed tool server wired to @modelcontextprotocol/sdk.
 *
 * 16 tools total:
 *   - 3 checkpoint tools
 *   - 7 memory tools (project state, decisions, priority context)
 *   - 6 comm tools (agent messaging, broadcast)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { createSqliteServers } from './lib/sqlite-servers.js';
import { createToolRegistry } from './lib/tool-registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Resolve paths and config
// ---------------------------------------------------------------------------

const PREREQ_MAP = JSON.parse(
  readFileSync(join(__dirname, 'agent-prerequisite-map.json'), 'utf8')
);

const researchDir = process.cwd();

// ---------------------------------------------------------------------------
// Initialize SQLite backend
// ---------------------------------------------------------------------------

const dbPath = join(researchDir, '.research', 'diverga.db');
if (!existsSync(join(researchDir, '.research'))) {
  mkdirSync(join(researchDir, '.research'), { recursive: true });
}
const servers = createSqliteServers(dbPath, PREREQ_MAP);
const { checkpointServer, memoryServer, commServer } = servers;

// Graceful shutdown
process.on('SIGINT', () => { servers.close(); process.exit(0); });
process.on('SIGTERM', () => { servers.close(); process.exit(0); });

// ---------------------------------------------------------------------------
// Create tool registry
// ---------------------------------------------------------------------------

const { tools, dispatch } = createToolRegistry(checkpointServer, memoryServer, commServer);

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'diverga', version: '11.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await dispatch(name, args || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
