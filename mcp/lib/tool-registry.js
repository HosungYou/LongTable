/**
 * Diverga v9.0 MCP Tool Registry
 *
 * Routes MCP tool calls to appropriate server methods.
 * Provides backward-compatible v8 tool names.
 */

/**
 * Creates a unified tool registry for all three Diverga MCP servers
 *
 * @param {Object} checkpointServer - Checkpoint validation server
 * @param {Object} memoryServer - Project state and decision memory server
 * @param {Object} commServer - Agent communication server
 * @returns {Object} { tools: Array, dispatch: Function }
 */
export function createToolRegistry(checkpointServer, memoryServer, commServer) {
  // Validate required server arguments
  // Check if all are missing first (for comprehensive error message)
  if (!checkpointServer && !memoryServer && !commServer) {
    throw new Error(
      'createToolRegistry requires checkpoint, memory, and comm server arguments'
    );
  }

  // Then check individually for specific error messages
  if (!checkpointServer) {
    throw new Error('Checkpoint server required');
  }

  if (!memoryServer) {
    throw new Error('Memory server required');
  }

  if (!commServer) {
    throw new Error('Comm server required');
  }

  // =============================================================================
  // Checkpoint Tools (3 tools)
  // =============================================================================

  const checkpointTools = [
    {
      name: 'diverga_check_prerequisites',
      description:
        'Check if prerequisites are met for an agent to proceed. Validates dependencies and checkpoint requirements.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            description: 'Agent identifier to check prerequisites for'
          }
        },
        required: ['agent_id']
      }
    },
    {
      name: 'diverga_mark_checkpoint',
      description:
        'Record completion of a checkpoint with decision rationale. Creates audit trail for project decisions.',
      inputSchema: {
        type: 'object',
        properties: {
          checkpoint_id: {
            type: 'string',
            description: 'Checkpoint identifier (e.g., SCH_DATABASE_SELECTION)'
          },
          decision: {
            type: 'string',
            description: 'Selected option or decision made'
          },
          rationale: {
            type: 'string',
            description: 'Explanation for why this decision was made'
          },
          t_score_feedback: {
            type: 'integer',
            description: 'Optional novelty rating for VS recommendation (1=very typical/predictable, 2=somewhat typical, 3=balanced, 4=somewhat novel, 5=very novel/unexpected). Used for T-Score calibration.',
            minimum: 1,
            maximum: 5
          }
        },
        required: ['checkpoint_id', 'decision', 'rationale']
      }
    },
    {
      name: 'diverga_tscore_feedback',
      description:
        'Get aggregated T-Score feedback from user ratings to calibrate VS recommendations.',
      inputSchema: {
        type: 'object',
        properties: {
          checkpoint_id: {
            type: 'string',
            description: 'Filter by checkpoint ID (optional)'
          },
          methodology: {
            type: 'string',
            description: 'Search for feedback on a specific methodology (optional)'
          }
        }
      }
    },
    {
      name: 'diverga_checkpoint_status',
      description:
        'Get current checkpoint status across the project. Shows passed, pending, and blocked checkpoints.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];

  // =============================================================================
  // Memory Tools (7 tools)
  // =============================================================================

  const memoryTools = [
    {
      name: 'diverga_project_status',
      description:
        'Read current project state including category, stage, decisions, and metadata.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'diverga_project_update',
      description:
        'Update project state fields. Supports partial updates with merge behavior.',
      inputSchema: {
        type: 'object',
        properties: {
          updates: {
            type: 'object',
            description: 'Fields to update in project state'
          }
        },
        required: ['updates']
      }
    },
    {
      name: 'diverga_decision_add',
      description:
        'Record a decision made at a checkpoint. Includes selected option, rationale, and alternatives considered.',
      inputSchema: {
        type: 'object',
        properties: {
          checkpoint_id: {
            type: 'string',
            description: 'Checkpoint where decision was made'
          },
          selected: {
            type: 'string',
            description: 'Option that was selected'
          },
          rationale: {
            type: 'string',
            description: 'Reasoning for the decision'
          },
          alternatives: {
            type: 'array',
            description: 'Other options that were considered',
            items: { type: 'string' }
          },
          metadata: {
            type: 'object',
            description: 'Additional decision metadata'
          },
          t_score_feedback: {
            type: 'integer',
            description: 'Optional novelty rating for VS recommendation (1=very typical/predictable, 2=somewhat typical, 3=balanced, 4=somewhat novel, 5=very novel/unexpected). Used for T-Score calibration.',
            minimum: 1,
            maximum: 5
          }
        },
        required: ['checkpoint_id', 'selected']
      }
    },
    {
      name: 'diverga_decision_list',
      description:
        'List decisions with optional filters. Query by checkpoint, date, agent, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          filters: {
            type: 'object',
            description: 'Filter criteria for decision search'
          }
        }
      }
    },
    {
      name: 'diverga_priority_read',
      description:
        'Read priority context (always-loaded session memory). Max 500 characters.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'diverga_priority_write',
      description:
        'Write priority context for session persistence. Truncated to max_chars if needed.',
      inputSchema: {
        type: 'object',
        properties: {
          context: {
            type: 'string',
            description: 'Priority context to store'
          },
          max_chars: {
            type: 'integer',
            description: 'Maximum character limit (default: 500)'
          }
        },
        required: ['context']
      }
    },
    {
      name: 'diverga_export_yaml',
      description:
        'Export project state to YAML format for human readability and version control.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];

  // =============================================================================
  // Comm Tools (6 tools)
  // =============================================================================

  const commTools = [
    {
      name: 'diverga_agent_register',
      description:
        'Register a new agent in the communication system. Enables message routing.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            description: 'Unique agent identifier'
          },
          metadata: {
            type: 'object',
            description: 'Agent metadata (category, checkpoint, etc.)'
          }
        },
        required: ['agent_id']
      }
    },
    {
      name: 'diverga_agent_list',
      description:
        'List registered agents with optional filters. Query by status, category, checkpoint.',
      inputSchema: {
        type: 'object',
        properties: {
          filters: {
            type: 'object',
            description: 'Filter criteria for agent search'
          }
        }
      }
    },
    {
      name: 'diverga_message_send',
      description:
        'Send message from one agent to another. Creates message in recipient mailbox.',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            description: 'Sender agent ID'
          },
          to: {
            type: 'string',
            description: 'Recipient agent ID'
          },
          content: {
            type: 'string',
            description: 'Message content'
          },
          metadata: {
            type: 'object',
            description: 'Additional message metadata'
          }
        },
        required: ['from', 'to', 'content']
      }
    },
    {
      name: 'diverga_message_mailbox',
      description:
        'Retrieve messages for an agent. Supports filtering by read status, sender, date.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            description: 'Agent whose mailbox to retrieve'
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of messages to return'
          },
          unread_only: {
            type: 'boolean',
            description: 'Only return unread messages'
          }
        },
        required: ['agent_id']
      }
    },
    {
      name: 'diverga_message_acknowledge',
      description:
        'Mark message as read and optionally provide response. Updates message status.',
      inputSchema: {
        type: 'object',
        properties: {
          message_id: {
            type: 'string',
            description: 'Message to acknowledge'
          },
          response: {
            type: 'string',
            description: 'Optional response content'
          }
        },
        required: ['message_id']
      }
    },
    {
      name: 'diverga_message_broadcast',
      description:
        'Send message to all registered agents. Creates messages in all mailboxes.',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            description: 'Sender agent ID'
          },
          content: {
            type: 'string',
            description: 'Broadcast message content'
          },
          metadata: {
            type: 'object',
            description: 'Additional broadcast metadata'
          }
        },
        required: ['from', 'content']
      }
    }
  ];

  // Combine all tools
  const tools = [...checkpointTools, ...memoryTools, ...commTools];

  // =============================================================================
  // Dispatch Function - Routes tool calls to server methods
  // =============================================================================

  /**
   * Dispatch a tool call to the appropriate server method
   *
   * @param {string} toolName - MCP tool name (e.g., 'diverga_check_prerequisites')
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Server method result
   */
  async function dispatch(toolName, args) {
    // Checkpoint Server Routing
    if (toolName === 'diverga_check_prerequisites') {
      return await checkpointServer.checkPrerequisites(args.agent_id);
    }

    if (toolName === 'diverga_mark_checkpoint') {
      return await checkpointServer.markCheckpoint(
        args.checkpoint_id,
        args.decision,
        args.rationale,
        args.t_score_feedback
      );
    }

    if (toolName === 'diverga_checkpoint_status') {
      return await checkpointServer.checkpointStatus();
    }

    if (toolName === 'diverga_tscore_feedback') {
      return await checkpointServer.getTscoreFeedback({
        checkpointId: args.checkpoint_id,
        methodology: args.methodology
      });
    }

    // Memory Server Routing
    if (toolName === 'diverga_project_status') {
      return await memoryServer.readProjectState();
    }

    if (toolName === 'diverga_project_update') {
      return await memoryServer.updateProjectState(args.updates);
    }

    if (toolName === 'diverga_decision_add') {
      return await memoryServer.addDecision(
        args.checkpoint_id,
        args.selected,
        args.rationale,
        args.alternatives,
        args.metadata,
        args.t_score_feedback
      );
    }

    if (toolName === 'diverga_decision_list') {
      return await memoryServer.listDecisions(args.filters || {});
    }

    if (toolName === 'diverga_priority_read') {
      return await memoryServer.readPriorityContext();
    }

    if (toolName === 'diverga_priority_write') {
      return await memoryServer.writePriorityContext(args.context, args.max_chars);
    }

    if (toolName === 'diverga_export_yaml') {
      return await memoryServer.exportToYaml();
    }

    // Comm Server Routing
    if (toolName === 'diverga_agent_register') {
      return await commServer.registerAgent(args.agent_id, args.metadata);
    }

    if (toolName === 'diverga_agent_list') {
      return await commServer.listAgents(args.filters || {});
    }

    if (toolName === 'diverga_message_send') {
      return await commServer.send(args.from, args.to, args.content, args.metadata);
    }

    if (toolName === 'diverga_message_mailbox') {
      return await commServer.mailbox(args.agent_id, args);
    }

    if (toolName === 'diverga_message_acknowledge') {
      return await commServer.acknowledge(args.message_id, args.response);
    }

    if (toolName === 'diverga_message_broadcast') {
      return await commServer.broadcast(args.from, args.content, args.metadata);
    }

    // Unknown tool
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return { tools, dispatch };
}
