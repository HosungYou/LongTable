/**
 * sqlite-servers.js
 *
 * Unified SQLite-backed server factory for Diverga v9.0.
 * Produces checkpointServer, memoryServer, and commServer interfaces
 * all backed by a single WAL-mode SQLite database.
 *
 * Replaces the YAML/JSON file-based Layer 2 servers with ACID-safe
 * SQLite storage for reliable parallel agent execution.
 *
 * Usage:
 *   const { checkpointServer, memoryServer, commServer, close } =
 *     createSqliteServers(dbPath, prereqMap);
 */

import Database from 'better-sqlite3';
import yaml from 'js-yaml';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { CHECKPOINT_LEVELS } from './constants.js';
import { deepMerge } from './utils.js';

// ---------------------------------------------------------------------------
// createSqliteServers(dbPath, prereqMap) -> { checkpointServer, memoryServer, commServer, close }
// ---------------------------------------------------------------------------

export function createSqliteServers(dbPath, prereqMap) {
  if (!dbPath) throw new Error('dbPath is required');
  if (!prereqMap) throw new Error('prereqMap is required');

  // Ensure parent directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);

  // Enable WAL mode for concurrent access
  db.pragma('journal_mode = WAL');

  // -------------------------------------------------------------------------
  // Schema creation (idempotent)
  // -------------------------------------------------------------------------

  db.exec(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      checkpoint_id TEXT PRIMARY KEY,
      decision TEXT,
      rationale TEXT,
      level TEXT,
      status TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS decisions (
      decision_id TEXT PRIMARY KEY,
      checkpoint_id TEXT,
      selected TEXT,
      rationale TEXT,
      context TEXT,
      version INTEGER,
      timestamp TEXT
    );

    CREATE TABLE IF NOT EXISTS project_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS agents (
      agent_id TEXT PRIMARY KEY,
      metadata TEXT,
      registered_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
      from_agent TEXT,
      to_agent TEXT,
      content TEXT,
      metadata TEXT,
      status TEXT,
      broadcast INTEGER DEFAULT 0,
      sent_at TEXT,
      read_at TEXT,
      acknowledged_at TEXT,
      response TEXT
    );
  `);

  // -------------------------------------------------------------------------
  // Prepared statements
  // -------------------------------------------------------------------------

  const stmts = {
    // Checkpoints
    upsertCheckpoint: db.prepare(`
      INSERT INTO checkpoints (checkpoint_id, decision, rationale, level, status, completed_at)
      VALUES (@checkpoint_id, @decision, @rationale, @level, @status, @completed_at)
      ON CONFLICT(checkpoint_id) DO UPDATE SET
        decision = @decision,
        rationale = @rationale,
        level = @level,
        status = @status,
        completed_at = @completed_at
    `),
    getCheckpoint: db.prepare('SELECT * FROM checkpoints WHERE checkpoint_id = ?'),
    listCheckpoints: db.prepare('SELECT * FROM checkpoints ORDER BY completed_at DESC, rowid DESC'),

    // Decisions
    insertDecision: db.prepare(`
      INSERT INTO decisions (decision_id, checkpoint_id, selected, rationale, context, version, timestamp)
      VALUES (@decision_id, @checkpoint_id, @selected, @rationale, @context, @version, @timestamp)
    `),
    countDecisions: db.prepare('SELECT COUNT(*) as cnt FROM decisions'),
    listAllDecisions: db.prepare('SELECT * FROM decisions ORDER BY timestamp ASC, rowid ASC'),
    getDecision: db.prepare('SELECT * FROM decisions WHERE decision_id = ?'),

    // Project state
    getProjectState: db.prepare('SELECT value FROM project_state WHERE key = ?'),
    upsertProjectState: db.prepare(`
      INSERT INTO project_state (key, value) VALUES (@key, @value)
      ON CONFLICT(key) DO UPDATE SET value = @value
    `),

    // Agents
    upsertAgent: db.prepare(`
      INSERT INTO agents (agent_id, metadata, registered_at, updated_at)
      VALUES (@agent_id, @metadata, @registered_at, @updated_at)
      ON CONFLICT(agent_id) DO UPDATE SET
        metadata = @metadata,
        updated_at = @updated_at
    `),
    getAgent: db.prepare('SELECT * FROM agents WHERE agent_id = ?'),
    listAllAgents: db.prepare('SELECT * FROM agents ORDER BY registered_at ASC, rowid ASC'),

    // Messages
    insertMessage: db.prepare(`
      INSERT INTO messages (message_id, from_agent, to_agent, content, metadata, status, broadcast, sent_at)
      VALUES (@message_id, @from_agent, @to_agent, @content, @metadata, @status, @broadcast, @sent_at)
    `),
    countMessages: db.prepare('SELECT COUNT(*) as cnt FROM messages'),
    getMessage: db.prepare('SELECT * FROM messages WHERE message_id = ?'),
    markRead: db.prepare('UPDATE messages SET status = ?, read_at = ? WHERE id = ?'),
    markAcknowledged: db.prepare(
      'UPDATE messages SET status = ?, acknowledged_at = ?, response = ? WHERE message_id = ?'
    ),
  };

  // -------------------------------------------------------------------------
  // Shared helpers
  // -------------------------------------------------------------------------

  function _normalizeAgentId(id) {
    const lower = id.toLowerCase();
    const match = lower.match(/^([a-z]\d+)/);
    return match ? match[1] : lower;
  }

  function _nextDecisionId() {
    const { cnt } = stmts.countDecisions.get();
    return `DEV_${String(cnt + 1).padStart(3, '0')}`;
  }

  function _nextMessageId() {
    const { cnt } = stmts.countMessages.get();
    return `msg_${String(cnt + 1).padStart(3, '0')}`;
  }

  function _getPassedCheckpoints() {
    const passed = new Set();
    const rows = stmts.listCheckpoints.all();
    for (const row of rows) {
      if (row.status === 'completed') {
        passed.add(row.checkpoint_id);
      }
    }
    // Also count decisions (a checkpoint_id in decisions means it was addressed)
    const decisions = stmts.listAllDecisions.all();
    for (const d of decisions) {
      if (d.checkpoint_id) {
        passed.add(d.checkpoint_id);
      }
    }
    return passed;
  }

  // =========================================================================
  // checkpointServer
  // =========================================================================

  function cpCheckPrerequisites(agentId) {
    const normalizedId = _normalizeAgentId(agentId);
    const agentInfo = prereqMap.agents?.[normalizedId];

    if (!agentInfo) {
      return {
        approved: true,
        missing: [],
        message: `Agent ${normalizedId}: no prerequisites (unknown agent)`,
        own_checkpoints: [],
      };
    }

    if (agentInfo.entry_point || !agentInfo.prerequisites || agentInfo.prerequisites.length === 0) {
      return {
        approved: true,
        missing: [],
        message: `Agent ${normalizedId}: entry point / no prerequisites`,
        own_checkpoints: agentInfo.own_checkpoints || [],
      };
    }

    const passed = _getPassedCheckpoints();
    const missing = agentInfo.prerequisites.filter(cp => !passed.has(cp));

    return {
      approved: missing.length === 0,
      missing,
      message: missing.length === 0
        ? `Agent ${normalizedId}: all prerequisites met`
        : `Agent ${normalizedId}: missing ${missing.join(', ')}`,
      own_checkpoints: agentInfo.own_checkpoints || [],
    };
  }

  function cpMarkCheckpoint(cpId, decision, rationale, tScoreFeedback = null) {
    const level = CHECKPOINT_LEVELS[cpId] || 'UNKNOWN';
    const now = new Date().toISOString();

    stmts.upsertCheckpoint.run({
      checkpoint_id: cpId,
      decision,
      rationale: rationale ?? null,
      level: level.toUpperCase(),
      status: 'completed',
      completed_at: now,
    });

    // Build context JSON with optional T-Score feedback
    const contextObj = {};
    if (tScoreFeedback != null) {
      contextObj.t_score_feedback = tScoreFeedback;
    }
    const contextStr = Object.keys(contextObj).length > 0 ? JSON.stringify(contextObj) : null;

    // Also record as a decision
    const decisionId = _nextDecisionId();
    stmts.insertDecision.run({
      decision_id: decisionId,
      checkpoint_id: cpId,
      selected: decision,
      rationale: rationale ?? null,
      context: contextStr,
      version: 1,
      timestamp: now,
    });

    return {
      recorded: true,
      checkpoint_id: cpId,
      decision_id: decisionId,
    };
  }

  function cpCheckpointStatus() {
    const passedSet = _getPassedCheckpoints();
    const passed = [...passedSet];

    // Pending: checkpoints in table with status != 'completed' that are not passed
    const allCps = stmts.listCheckpoints.all();
    const pending = allCps
      .filter(cp => cp.status === 'pending' && !passedSet.has(cp.checkpoint_id))
      .map(cp => cp.checkpoint_id);

    const { cnt } = stmts.countDecisions.get();

    const blocked = [];
    if (prereqMap.agents) {
      for (const [agentId, agentInfo] of Object.entries(prereqMap.agents)) {
        if (agentInfo.entry_point) continue;
        if (!agentInfo.prerequisites || agentInfo.prerequisites.length === 0) continue;

        const missing = agentInfo.prerequisites.filter(cp => !passedSet.has(cp));
        if (missing.length > 0) {
          blocked.push({ agent: agentId, missing });
        }
      }
    }

    return { passed, pending, blocked, total_decisions: cnt };
  }

  function cpGetTscoreFeedback(options = {}) {
    const { checkpointId, methodology } = options;
    let rows = stmts.listAllDecisions.all();

    // Filter by checkpoint if specified
    if (checkpointId) {
      rows = rows.filter(r => r.checkpoint_id === checkpointId);
    }

    // Filter by methodology (search in selected text)
    if (methodology) {
      const lowerMethodology = methodology.toLowerCase();
      rows = rows.filter(r => r.selected && r.selected.toLowerCase().includes(lowerMethodology));
    }

    // Extract t_score_feedback from context JSON
    const feedbackValues = [];
    for (const row of rows) {
      if (!row.context) continue;
      try {
        const parsed = JSON.parse(row.context);
        if (parsed.t_score_feedback != null) {
          feedbackValues.push(parsed.t_score_feedback);
        }
      } catch {
        // skip unparseable context
      }
    }

    if (feedbackValues.length === 0) {
      return {
        count: 0,
        avgFeedback: null,
        distribution: [0, 0, 0, 0, 0],
        calibration: null,
      };
    }

    const sum = feedbackValues.reduce((a, b) => a + b, 0);
    const avgFeedback = sum / feedbackValues.length;

    // Distribution: count of each rating 1-5
    const distribution = [0, 0, 0, 0, 0];
    for (const v of feedbackValues) {
      if (v >= 1 && v <= 5) {
        distribution[v - 1]++;
      }
    }

    // Calculate calibration adjustment
    let adjustment, calibratedRange;
    if (avgFeedback <= 1.5) {
      adjustment = 0.2;
      calibratedRange = 'very typical — T-Score should be lower';
    } else if (avgFeedback <= 2.5) {
      adjustment = 0.1;
      calibratedRange = 'somewhat typical — T-Score slightly high';
    } else if (avgFeedback <= 3.5) {
      adjustment = 0;
      calibratedRange = 'balanced — T-Score matches user perception';
    } else if (avgFeedback <= 4.5) {
      adjustment = -0.1;
      calibratedRange = 'somewhat novel — T-Score slightly low';
    } else {
      adjustment = -0.2;
      calibratedRange = 'very novel — T-Score should be higher';
    }

    return {
      count: feedbackValues.length,
      avgFeedback: Math.round(avgFeedback * 100) / 100,
      distribution,
      calibration: { adjustment, calibratedRange },
    };
  }

  const checkpointServer = {
    checkPrerequisites: cpCheckPrerequisites,
    markCheckpoint: cpMarkCheckpoint,
    checkpointStatus: cpCheckpointStatus,
    getTscoreFeedback: cpGetTscoreFeedback,
  };

  // =========================================================================
  // memoryServer
  // =========================================================================

  function memReadProjectState() {
    const row = stmts.getProjectState.get('_state');
    if (!row || !row.value) return {};
    try {
      return JSON.parse(row.value);
    } catch {
      return {};
    }
  }

  function memUpdateProjectState(updates) {
    const current = memReadProjectState();
    const merged = deepMerge(current, updates);
    stmts.upsertProjectState.run({
      key: '_state',
      value: JSON.stringify(merged),
    });
    return { updated: true, state: merged };
  }

  function memAddDecision(checkpointId, selected, rationale, alternatives, metadata, tScoreFeedback = null) {
    const decisionId = _nextDecisionId();
    const now = new Date().toISOString();

    let contextObj = {};
    if (alternatives && Array.isArray(alternatives) && alternatives.length > 0) {
      contextObj.alternatives_considered = alternatives;
    }
    if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
      contextObj.metadata = metadata;
    }
    if (tScoreFeedback != null) {
      contextObj.t_score_feedback = tScoreFeedback;
    }

    const contextStr = Object.keys(contextObj).length > 0 ? JSON.stringify(contextObj) : null;

    stmts.insertDecision.run({
      decision_id: decisionId,
      checkpoint_id: checkpointId,
      selected,
      rationale,
      context: contextStr,
      version: 1,
      timestamp: now,
    });

    return { recorded: true, decision_id: decisionId };
  }

  function _parseDecisionRow(row) {
    const result = { ...row };
    // Parse context JSON
    if (result.context) {
      try {
        const parsed = JSON.parse(result.context);
        // Flatten metadata into the decision object for filter compatibility
        if (parsed.metadata) {
          result.metadata = parsed.metadata;
        }
        if (parsed.alternatives_considered) {
          result.alternatives_considered = parsed.alternatives_considered;
        }
      } catch {
        // leave as string
      }
    }
    return result;
  }

  function memListDecisions(filters = {}) {
    let rows = stmts.listAllDecisions.all();
    let decisions = rows.map(_parseDecisionRow);

    if (filters.checkpoint_id) {
      decisions = decisions.filter(d => d.checkpoint_id === filters.checkpoint_id);
    }

    if (filters.agent) {
      decisions = decisions.filter(d => d.metadata?.agent === filters.agent);
    }

    if (filters.after) {
      decisions = decisions.filter(d => d.timestamp > filters.after);
    }

    if (filters.before) {
      decisions = decisions.filter(d => d.timestamp < filters.before);
    }

    return decisions;
  }

  function memReadPriorityContext() {
    const row = stmts.getProjectState.get('_priority_context');
    if (!row || !row.value) return '';
    return row.value;
  }

  function memWritePriorityContext(content, maxChars = 500) {
    let truncated = content;
    if (truncated.length > maxChars) {
      truncated = truncated.slice(0, maxChars);
    }
    stmts.upsertProjectState.run({
      key: '_priority_context',
      value: truncated,
    });
    return { written: true, length: truncated.length };
  }

  function memExportToYaml() {
    const projectState = memReadProjectState();
    const decisions = memListDecisions();
    const priorityContext = memReadPriorityContext();

    const exportData = {
      project_state: projectState,
      decisions,
      priority_context: priorityContext,
      exported_at: new Date().toISOString(),
      version: '9.0.0',
    };

    return yaml.dump(exportData, { lineWidth: 120, noRefs: true });
  }

  const memoryServer = {
    readProjectState: memReadProjectState,
    updateProjectState: memUpdateProjectState,
    addDecision: memAddDecision,
    listDecisions: memListDecisions,
    readPriorityContext: memReadPriorityContext,
    writePriorityContext: memWritePriorityContext,
    exportToYaml: memExportToYaml,
  };

  // =========================================================================
  // commServer
  // =========================================================================

  function _parseAgentMetadata(row) {
    if (!row) return null;
    let meta = {};
    if (row.metadata) {
      try {
        meta = JSON.parse(row.metadata);
      } catch {
        meta = {};
      }
    }
    return {
      agent_id: row.agent_id,
      ...meta,
      registered_at: row.registered_at,
      updated_at: row.updated_at,
    };
  }

  function commRegisterAgent(agentId, metadata = {}) {
    if (!agentId) throw new Error('Agent ID is required');
    const now = new Date().toISOString();

    // Check if already exists to preserve registered_at
    const existing = stmts.getAgent.get(agentId);
    const registeredAt = existing ? existing.registered_at : now;

    stmts.upsertAgent.run({
      agent_id: agentId,
      metadata: JSON.stringify(metadata),
      registered_at: registeredAt,
      updated_at: now,
    });

    return { registered: true, agent_id: agentId };
  }

  function commListAgents(filters = {}) {
    const rows = stmts.listAllAgents.all();
    let agents = rows.map(_parseAgentMetadata);

    if (filters.status) {
      agents = agents.filter(a => a.status === filters.status);
    }
    if (filters.category) {
      agents = agents.filter(a => a.category === filters.category);
    }
    if (filters.model) {
      agents = agents.filter(a => a.model === filters.model);
    }

    return agents;
  }

  function commSend(from, to, content, metadata) {
    if (!from || !to) throw new Error('Both from and to are required');

    const messageId = _nextMessageId();
    const now = new Date().toISOString();

    const metaStr = (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0)
      ? JSON.stringify(metadata) : null;

    stmts.insertMessage.run({
      message_id: messageId,
      from_agent: from,
      to_agent: to,
      content: typeof content === 'object' ? JSON.stringify(content) : String(content),
      metadata: metaStr,
      status: 'unread',
      broadcast: 0,
      sent_at: now,
    });

    return { sent: true, message_id: messageId };
  }

  function _parseMessageRow(row) {
    let content = row.content;
    try { content = JSON.parse(content); } catch { /* leave as string */ }
    let metadata = null;
    if (row.metadata) {
      try { metadata = JSON.parse(row.metadata); } catch { /* ignore */ }
    }
    return {
      id: row.id,
      message_id: row.message_id,
      from: row.from_agent,
      to: row.to_agent,
      content,
      metadata,
      status: row.status,
      broadcast: row.broadcast === 1,
      sent_at: row.sent_at,
      read_at: row.read_at,
      acknowledged_at: row.acknowledged_at,
      response: row.response,
    };
  }

  function commMailbox(agentId, options = {}) {
    const { status, from, includeRead = false, autoMark = true } = options;

    let sql = 'SELECT * FROM messages WHERE to_agent = ?';
    const params = [agentId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    } else if (!includeRead) {
      sql += " AND status = 'unread'";
    }

    if (from) {
      sql += ' AND from_agent = ?';
      params.push(from);
    }

    sql += ' ORDER BY sent_at ASC, id ASC';

    const rows = db.prepare(sql).all(...params);
    const messages = rows.map(_parseMessageRow);

    // Auto-mark unread messages as read
    if (autoMark !== false) {
      const now = new Date().toISOString();
      for (const row of rows) {
        if (row.status === 'unread') {
          stmts.markRead.run('read', now, row.id);
        }
      }
    }

    return messages;
  }

  function commAcknowledge(messageId, response) {
    if (!messageId) throw new Error('Message ID is required');

    const msg = stmts.getMessage.get(messageId);
    if (!msg) throw new Error(`Message ${messageId} not found`);

    const now = new Date().toISOString();
    stmts.markAcknowledged.run('acknowledged', now, response ?? null, messageId);

    return { acknowledged: true, message_id: messageId };
  }

  function commBroadcast(from, content, metadata) {
    if (!from) throw new Error('From (sender) is required');

    const rows = stmts.listAllAgents.all();
    const recipients = rows.map(r => r.agent_id).filter(id => id !== from);

    const now = new Date().toISOString();
    const metaStr = (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0)
      ? JSON.stringify(metadata) : null;
    const contentStr = typeof content === 'object' ? JSON.stringify(content) : String(content);

    for (const to of recipients) {
      const messageId = _nextMessageId();
      stmts.insertMessage.run({
        message_id: messageId,
        from_agent: from,
        to_agent: to,
        content: contentStr,
        metadata: metaStr,
        status: 'unread',
        broadcast: 1,
        sent_at: now,
      });
    }

    return { sent: true, recipient_count: recipients.length };
  }

  const commServer = {
    registerAgent: commRegisterAgent,
    listAgents: commListAgents,
    send: commSend,
    mailbox: commMailbox,
    acknowledge: commAcknowledge,
    broadcast: commBroadcast,
  };

  // =========================================================================
  // migrateFromYaml(researchDir)
  // =========================================================================

  function migrateFromYaml(researchDir) {
    const skipped = [];
    let migrated = 0;

    function _tryReadYaml(filename) {
      const paths = [
        join(researchDir, 'research', filename),
        join(researchDir, '.research', filename),
        join(researchDir, filename),
      ];
      for (const p of paths) {
        if (existsSync(p)) {
          try {
            return yaml.load(readFileSync(p, 'utf8'));
          } catch {
            return null;
          }
        }
      }
      return null;
    }

    function _tryReadJson(filepath) {
      if (!existsSync(filepath)) return null;
      try {
        return JSON.parse(readFileSync(filepath, 'utf8'));
      } catch {
        return null;
      }
    }

    // --- Checkpoints ---
    const cpData = _tryReadYaml('checkpoints.yaml');
    if (cpData?.checkpoints) {
      const entries = cpData.checkpoints.active || cpData.checkpoints;
      if (Array.isArray(entries)) {
        for (const cp of entries) {
          if (!cp.checkpoint_id) continue;
          const level = cp.level || CHECKPOINT_LEVELS[cp.checkpoint_id] || 'OPTIONAL';
          stmts.upsertCheckpoint.run({
            checkpoint_id: cp.checkpoint_id,
            decision: cp.decision || null,
            rationale: cp.rationale || null,
            level: level.toUpperCase(),
            status: cp.status || 'completed',
            completed_at: cp.completed_at || new Date().toISOString(),
          });
          migrated++;
        }
      }
    } else {
      skipped.push('checkpoints.yaml');
    }

    // --- Decisions ---
    const dlData = _tryReadYaml('decision-log.yaml');
    if (dlData?.decisions && Array.isArray(dlData.decisions)) {
      for (const d of dlData.decisions) {
        if (!d.decision_id) continue;
        const existing = stmts.getDecision.get(d.decision_id);
        if (existing) continue;

        let contextStr = null;
        if (d.context != null) {
          contextStr = typeof d.context === 'object' ? JSON.stringify(d.context) : String(d.context);
        }

        stmts.insertDecision.run({
          decision_id: d.decision_id,
          checkpoint_id: d.checkpoint_id || null,
          selected: d.selected || null,
          rationale: d.rationale || null,
          context: contextStr,
          version: d.version || 1,
          timestamp: d.timestamp || new Date().toISOString(),
        });
        migrated++;
      }
    } else {
      skipped.push('decision-log.yaml');
    }

    // --- Project State ---
    const psData = _tryReadYaml('project-state.yaml');
    if (psData && typeof psData === 'object') {
      memoryServer.updateProjectState(psData);
      migrated++;
    } else {
      skipped.push('project-state.yaml');
    }

    // --- Priority Context ---
    const pcPaths = [
      join(researchDir, '.research', 'priority-context.md'),
      join(researchDir, 'research', 'priority-context.md'),
    ];
    let pcContent = null;
    for (const p of pcPaths) {
      if (existsSync(p)) {
        pcContent = readFileSync(p, 'utf8');
        break;
      }
    }
    if (pcContent) {
      memoryServer.writePriorityContext(pcContent);
      migrated++;
    } else {
      skipped.push('priority-context.md');
    }

    // --- Comm Agents ---
    const agentsData = _tryReadJson(join(researchDir, '.research', 'comm', 'agents.json'));
    if (agentsData?.agents && typeof agentsData.agents === 'object') {
      for (const [id, meta] of Object.entries(agentsData.agents)) {
        commServer.registerAgent(id, meta);
        migrated++;
      }
    } else {
      skipped.push('comm/agents.json');
    }

    // --- Comm Messages ---
    const msgData = _tryReadJson(join(researchDir, '.research', 'comm', 'messages.json'));
    if (msgData?.messages && Array.isArray(msgData.messages)) {
      for (const m of msgData.messages) {
        if (!m.from || !m.to) continue;
        try {
          commServer.send(m.from, m.to, m.content, m.metadata);
          migrated++;
        } catch {
          // skip invalid messages
        }
      }
    } else {
      skipped.push('comm/messages.json');
    }

    return { success: true, migrated, skipped };
  }

  // =========================================================================
  // close
  // =========================================================================

  function close() {
    db.close();
  }

  return { checkpointServer, memoryServer, commServer, migrateFromYaml, close };
}
