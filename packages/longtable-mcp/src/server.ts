import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cwd, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { classifyCheckpointTrigger } from "@longtable/checkpoints";
import { renderQuestionRecordInput } from "@longtable/provider-claude";
import { renderQuestionRecordPrompt } from "@longtable/provider-codex";
import type { ProviderKind, QuestionRecord } from "@longtable/core";
import {
  answerWorkspaceQuestion,
  createWorkspaceQuestion,
  inspectProjectWorkspace,
  loadProjectContextFromDirectory,
  loadWorkspaceState,
  syncCurrentWorkspaceView
} from "@longtable/cli";

const SERVER_NAME = "longtable-state";
const SERVER_VERSION = "0.1.11";

const TOOL_NAMES = [
  "read_project",
  "read_session",
  "inspect_workspace",
  "pending_questions",
  "evaluate_checkpoint",
  "create_question",
  "render_question",
  "append_decision",
  "regenerate_current"
];

const cwdSchema = z.object({
  cwd: z.string().optional().describe("LongTable project directory or child path. Defaults to server cwd.")
});

function textResult(structuredContent: Record<string, unknown>): CallToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent, null, 2)
      }
    ],
    structuredContent
  };
}

function errorResult(message: string): CallToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: message
      }
    ],
    isError: true
  };
}

function resolveStartPath(input?: string): string {
  return resolve(input ?? cwd());
}

async function requireContext(startPath?: string) {
  const context = await loadProjectContextFromDirectory(resolveStartPath(startPath));
  if (!context) {
    throw new Error("No LongTable workspace was found from the supplied cwd.");
  }
  return context;
}

function findQuestion(records: QuestionRecord[], questionId?: string): QuestionRecord | null {
  if (questionId) {
    return records.find((record) => record.id === questionId) ?? null;
  }
  return records.filter((record) => record.status === "pending").at(-1) ?? null;
}

async function readAllowedProjectFiles(context: Awaited<ReturnType<typeof requireContext>>) {
  const current = existsSync(context.currentFilePath)
    ? await readFile(context.currentFilePath, "utf8")
    : "";
  const agentsPath = resolve(context.project.projectPath, "AGENTS.md");
  const agents = existsSync(agentsPath)
    ? await readFile(agentsPath, "utf8")
    : "";
  return {
    current,
    agentsPath,
    agents
  };
}

export function createLongTableMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION
    },
    {
      instructions:
        "Use LongTable state tools to inspect .longtable workspaces, evaluate Researcher Checkpoints, write QuestionRecords, append DecisionRecords, and regenerate CURRENT.md. Treat .longtable as the source of truth."
    }
  );

  server.registerTool(
    "read_project",
    {
      title: "Read LongTable Project",
      description: "Read project metadata from a LongTable workspace.",
      inputSchema: cwdSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        return textResult({
          project: context.project,
          files: {
            project: context.projectFilePath,
            session: context.sessionFilePath,
            state: context.stateFilePath,
            current: context.currentFilePath
          }
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "read_session",
    {
      title: "Read LongTable Session",
      description: "Read the current LongTable session record.",
      inputSchema: cwdSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        return textResult({ session: context.session });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "inspect_workspace",
    {
      title: "Inspect LongTable Workspace",
      description: "Inspect workspace files, counts, recent invocations, questions, and decisions.",
      inputSchema: cwdSchema.extend({
        includeFiles: z.boolean().default(false).describe("Include CURRENT.md and AGENTS.md text.")
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd, includeFiles }) => {
      try {
        const context = await loadProjectContextFromDirectory(resolveStartPath(inputCwd));
        const inspection = await inspectProjectWorkspace(resolveStartPath(inputCwd));
        if (!context || !includeFiles) {
          return textResult({ inspection });
        }
        return textResult({
          inspection,
          files: await readAllowedProjectFiles(context)
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "pending_questions",
    {
      title: "List Pending Researcher Checkpoints",
      description: "List pending LongTable QuestionRecords.",
      inputSchema: cwdSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        const state = await loadWorkspaceState(context);
        const pending = (state.questionLog ?? []).filter((record: QuestionRecord) => record.status === "pending");
        return textResult({
          pending,
          required: pending.filter((record: QuestionRecord) => record.prompt.required)
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "evaluate_checkpoint",
    {
      title: "Evaluate Checkpoint Trigger",
      description: "Classify natural-language context into a LongTable checkpoint signal without writing state.",
      inputSchema: cwdSchema.extend({
        prompt: z.string().min(1),
        mode: z.enum(["explore", "review", "critique", "draft", "commit", "submit"]).optional()
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd, prompt, mode }) => {
      try {
        const context = await loadProjectContextFromDirectory(resolveStartPath(inputCwd));
        const state = context ? await loadWorkspaceState(context) : undefined;
        const classification = classifyCheckpointTrigger(prompt, {
          preferredMode: mode,
          unresolvedTensions: state?.openTensions ?? [],
          studyContract: state?.studyContract
        });
        return textResult({ classification });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "create_question",
    {
      title: "Create Researcher Checkpoint",
      description: "Create a pending QuestionRecord in the LongTable workspace.",
      inputSchema: cwdSchema.extend({
        prompt: z.string().min(1),
        title: z.string().optional(),
        question: z.string().optional(),
        provider: z.enum(["codex", "claude"]).optional(),
        required: z.boolean().optional()
      })
    },
    async ({ cwd: inputCwd, prompt, title, question, provider, required }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await createWorkspaceQuestion({
          context,
          prompt,
          title,
          question,
          provider,
          required
        });
        return textResult({
          question: result.question,
          nextAction: `longtable decide --question ${result.question.id} --answer <value>`
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "render_question",
    {
      title: "Render Researcher Checkpoint",
      description: "Render a pending QuestionRecord for Codex numbered prompt or Claude structured question transport.",
      inputSchema: cwdSchema.extend({
        questionId: z.string().optional(),
        provider: z.enum(["codex", "claude"]).default("codex")
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ cwd: inputCwd, questionId, provider }) => {
      try {
        const context = await requireContext(inputCwd);
        const state = await loadWorkspaceState(context);
        const question = findQuestion(state.questionLog ?? [], questionId);
        if (!question) {
          return errorResult("No matching pending LongTable question was found.");
        }
        const transport = provider === "claude"
          ? renderQuestionRecordInput(question)
          : renderQuestionRecordPrompt(question);
        return textResult({ provider, question, transport });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "append_decision",
    {
      title: "Append LongTable Decision",
      description: "Answer a pending QuestionRecord and append a DecisionRecord.",
      inputSchema: cwdSchema.extend({
        questionId: z.string().optional(),
        answer: z.string().min(1),
        rationale: z.string().optional(),
        provider: z.enum(["codex", "claude"]).optional()
      })
    },
    async ({ cwd: inputCwd, questionId, answer, rationale, provider }) => {
      try {
        const context = await requireContext(inputCwd);
        const result = await answerWorkspaceQuestion({
          context,
          questionId,
          answer,
          rationale,
          provider: provider as ProviderKind | undefined
        });
        return textResult({
          question: result.question,
          decision: result.decision
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    "regenerate_current",
    {
      title: "Regenerate CURRENT.md",
      description: "Regenerate CURRENT.md from LongTable machine-readable state.",
      inputSchema: cwdSchema
    },
    async ({ cwd: inputCwd }) => {
      try {
        const context = await requireContext(inputCwd);
        const path = await syncCurrentWorkspaceView(context);
        return textResult({ current: path });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createLongTableMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} MCP server running on stdio`);
}

export async function runLongTableMcpCli(argv = process.argv): Promise<void> {
  if (argv.includes("--self-test")) {
    console.log(JSON.stringify({ name: SERVER_NAME, version: SERVER_VERSION, tools: TOOL_NAMES }, null, 2));
    return;
  }

  await runStdioServer();
}

function isDirectRun(): boolean {
  return process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
}

if (isDirectRun()) {
  runLongTableMcpCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    exit(1);
  });
}
