import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const delayMs = Number(process.env.LONGTABLE_MCP_TEST_DELAY_MS ?? 0);
const workspace = await mkdtemp(join(tmpdir(), "longtable-mcp-elicitation-"));
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = join(repoRoot, "packages", "longtable-mcp", "dist", "server.js");
const setupFixture = join(
  repoRoot,
  "packages",
  "longtable-setup",
  "examples",
  "codex-setup-output.json"
);
let action = "accept";
let remainingDelayMs = delayMs;

async function delay() {
  if (remainingDelayMs > 0) {
    const currentDelayMs = remainingDelayMs;
    remainingDelayMs = 0;
    await new Promise((resolve) => setTimeout(resolve, currentDelayMs));
  }
}

async function openConnection() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd: repoRoot,
    stderr: "pipe"
  });
  const client = new Client(
    { name: "longtable-smoke-client", version: "1.0.0" },
    {
      capabilities: {
        elicitation: {
          form: {}
        }
      },
      versionNegotiation: {
        mode: { pin: "2026-07-28" }
      },
      inputRequired: {
        autoFulfill: true,
        maxRounds: 4
      }
    }
  );
  client.setRequestHandler("elicitation/create", async () => {
    await delay();
    if (action === "accept") {
      return {
        action: "accept",
        content: {
          answer: "proceed"
        }
      };
    }
    return { action };
  });
  await client.connect(transport);
  return {
    client,
    async close() {
      await client.close();
    }
  };
}

async function state() {
  return JSON.parse(await readFile(join(workspace, ".longtable", "state.json"), "utf8"));
}

const acceptedArgs = {
  cwd: workspace,
  prompt: "Choose whether this durable checkpoint should proceed.",
  title: "Durable checkpoint",
  question: "Proceed with the recorded research commitment?",
  checkpointKey: "mcp_2026_durable_checkpoint",
  options: [
    { value: "proceed", label: "Proceed", recommended: true },
    { value: "revise", label: "Revise" }
  ],
  provider: "codex",
  required: true,
  idempotencyKey: "smoke:accepted"
};

let connection = await openConnection();
try {
  const workspaceResult = await connection.client.callTool({
    name: "create_workspace",
    arguments: {
      cwd: workspace,
      projectName: "MCP elicitation smoke",
      seedGoal: "Verify durable Researcher Checkpoints.",
      setupPath: setupFixture
    }
  });
  if (workspaceResult.isError) {
    throw new Error(`MCP workspace setup failed: ${JSON.stringify(workspaceResult)}`);
  }

  const accepted = await connection.client.callTool({
    name: "elicit_question",
    arguments: acceptedArgs
  });
  if (accepted.isError) {
    throw new Error(`MCP accept failed: ${JSON.stringify({
      result: accepted,
      state: await state()
    })}`);
  }

  const acceptedState = await state();
  assert.equal(acceptedState.questionLog.length, 1);
  assert.equal(acceptedState.decisionLog.length, 1);
  assert.equal(acceptedState.questionLog[0].status, "answered");
  assert.deepEqual(
    acceptedState.questionLog[0].transportAttempts.map((event) => event.status),
    ["attempted", "accepted"]
  );

  await connection.client.callTool({
    name: "elicit_question",
    arguments: acceptedArgs
  });
  const replayState = await state();
  assert.equal(replayState.questionLog.length, 1);
  assert.equal(replayState.decisionLog.length, 1);

  action = "decline";
  await connection.client.callTool({
    name: "elicit_question",
    arguments: {
      ...acceptedArgs,
      prompt: "Decline this checkpoint without losing it.",
      checkpointKey: "mcp_2026_declined_checkpoint",
      idempotencyKey: "smoke:declined"
    }
  });
  const declinedState = await state();
  const declined = declinedState.questionLog.find(
    (question) => question.idempotencyKey === "smoke:declined"
  );
  assert.equal(declined.status, "pending");
  assert.equal(declined.transportStatus.status, "declined");
  assert.deepEqual(
    declined.transportAttempts.map((event) => event.status),
    ["attempted", "declined"]
  );

  action = "cancel";
  await connection.client.callTool({
    name: "elicit_question",
    arguments: {
      ...acceptedArgs,
      prompt: "Cancel this transport without losing the checkpoint.",
      checkpointKey: "mcp_2026_cancelled_checkpoint",
      idempotencyKey: "smoke:cancelled"
    }
  });
  const cancelledState = await state();
  const cancelled = cancelledState.questionLog.find(
    (question) => question.idempotencyKey === "smoke:cancelled"
  );
  assert.equal(cancelled.status, "pending");
  assert.equal(cancelled.transportStatus.status, "cancelled");
  assert.deepEqual(
    cancelled.transportAttempts.map((event) => event.status),
    ["attempted", "cancelled"]
  );

  action = "accept";
  await connection.client.callTool({
    name: "elicit_question",
    arguments: {
      ...acceptedArgs,
      prompt: "Persist this checkpoint before restarting the MCP server.",
      checkpointKey: "mcp_2026_restart_checkpoint",
      idempotencyKey: "smoke:restart",
      fallbackOnly: true
    }
  });
} finally {
  await connection.close();
}

connection = await openConnection();
try {
  await connection.client.callTool({
    name: "elicit_question",
    arguments: {
      ...acceptedArgs,
      prompt: "Persist this checkpoint before restarting the MCP server.",
      checkpointKey: "mcp_2026_restart_checkpoint",
      idempotencyKey: "smoke:restart"
    }
  });
  const resumedState = await state();
  const restartedQuestions = resumedState.questionLog.filter(
    (question) => question.idempotencyKey === "smoke:restart"
  );
  assert.equal(restartedQuestions.length, 1);
  assert.equal(restartedQuestions[0].status, "answered");
  assert.deepEqual(
    restartedQuestions[0].transportAttempts.map((event) => event.status),
    ["fallback_rendered", "attempted", "accepted"]
  );
} finally {
  await connection.close();
  await rm(workspace, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  protocol: "2026-07-28",
  delayMs,
  contracts: [
    "accepted",
    "idempotent replay",
    "declined remains pending",
    "cancelled remains pending",
    "fresh-process resume"
  ]
}, null, 2));
