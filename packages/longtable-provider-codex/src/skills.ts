import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { RoleDefinition } from "@longtable/core";

export interface CodexSkillSpec {
  name: string;
  description: string;
  body: string[];
}

export interface InstalledCodexSkill {
  name: string;
  path: string;
  description: string;
}

export function resolveCodexSkillsDir(customDir?: string): string {
  return customDir ? resolve(customDir) : join(homedir(), ".codex", "skills");
}

function skillNameForRole(role: RoleDefinition): string {
  return `longtable-${role.key.replaceAll("_", "-")}`;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function renderSkillFile(spec: CodexSkillSpec): string {
  return [
    "---",
    `name: ${spec.name}`,
    `description: ${yamlString(spec.description)}`,
    "---",
    "",
    `# ${spec.name}`,
    "",
    ...spec.body
  ].join("\n");
}

function baseSkillSpecs(): CodexSkillSpec[] {
  return [
    {
      name: "longtable",
      description:
        "Use for LongTable research conversations, lt explore/review/panel requests, researcher checkpoints, and role routing.",
      body: [
        "## Purpose",
        "",
        "Act as the LongTable adapter inside Codex. LongTable is a researcher-centered workspace, not a replacement for the researcher.",
        "",
        "## Natural Invocation",
        "",
        "Use this skill when the user says things like:",
        "",
        "- `longtable: help me narrow this project`",
        "- `lt explore: ...`",
        "- `lt review: ...`",
        "- `lt panel: ...`",
        "- `use the LongTable methods critic on this design`",
        "- `$longtable: deploy a research team to review this measurement plan, show the main disagreements, and ask me what decision should be recorded before you revise it.`",
        "- `$longtable: use editor, reviewer, methods, measurement, and voice perspectives to evaluate this manuscript section. Do not collapse disagreement too early.`",
        "- `$longtable-interview` to create or continue the first research-start interview.",
        "",
        "## Routing Rules",
        "",
        "- `lt explore` keeps the problem open and asks clarifying or tension questions before recommending closure.",
        "- `lt review` starts with the strongest weakness, objection, or missing evidence.",
        "- `lt panel` creates a visible multi-role review with synthesis, role opinions, conflict summary, and a decision prompt.",
        "- `$longtable-interview` runs the provider-native LongTable start interview. It replaces the old CLI start questionnaire as the primary research-start surface.",
        "- Natural references to methods, measurement, theory, reviewer, editor, ethics, venue, or voice should foreground the matching LongTable role.",
        "- When research responsibility is about to shift, surface a Researcher Checkpoint before closure.",
        "- When changing LongTable product language, README positioning, or checkpoint policy, surface a Meta-Decision Checkpoint first.",
        "",
        "## Panel And Team Behavior",
        "",
        "- If the user asks for a panel, team, disagreement, or multiple perspectives, treat that as permission to coordinate multiple LongTable roles.",
        "- Use provider-native subagents only when the current Codex runtime makes them available and the user's request clearly calls for multi-agent work.",
        "- If native subagents are unavailable, use LongTable's sequential panel fallback and make the fallback explicit in the technical record.",
        "- Do not expose hidden reasoning, tool logs, or private chain-of-thought. Expose a structured deliberation record instead.",
        "",
        "## Project State",
        "",
        "- Treat `.longtable/` state as the source of truth when present.",
        "- Read `CURRENT.md` when available before giving project-specific advice.",
        "- If a Researcher Checkpoint is needed, ask a concise question with meaningful options and wait for the researcher.",
        "- If a checkpoint allows `other`, make `other` visible instead of hiding it in state.",
        "- Treat provider-native question UI as transport; LongTable state records are the source of truth.",
        "- For `$longtable-interview`, use natural-language turns for the interview and reserve MCP option UI for the final research-facing First Research Shape checkpoint.",
        "- When the `mcp__longtable_state__.elicit_question` tool is available, use it first for researcher checkpoints so Codex can show the MCP elicitation UI and LongTable can record the answer as `mcp_elicitation`.",
        "- Use `longtable question --print --provider codex --prompt \"...\"` only as a fallback when the MCP tool is unavailable, unsupported, declined, canceled, or blocked by the client.",
        "- If `CURRENT.md` shows a pending required checkpoint, do not proceed until `longtable decide --question <id> --answer <value>` records the researcher's choice.",
        "- Preserve open tensions and authorship instead of forcing closure.",
        "- Label unsupported external claims as inference or estimate."
      ]
    },
    {
      name: "longtable-interview",
      description:
        "Use for `$longtable-interview`: create or continue a LongTable research-start interview inside Codex, then store a First Research Shape through MCP/state.",
      body: [
        "## Purpose",
        "",
        "Run the LongTable research-start interview inside Codex. This is the primary project-start surface; the CLI setup command only prepares runtime permissions.",
        "",
        "## When To Use",
        "",
        "- The user invokes `$longtable-interview`.",
        "- The user wants to start a LongTable research workspace from inside Codex.",
        "- A workspace exists but `CURRENT.md` or `.longtable/state.json` lacks a usable First Research Shape.",
        "",
        "## Core Flow",
        "",
        "1. Check whether `.longtable/` exists in the current directory or a parent.",
        "2. If no workspace exists, ask one workspace question only: what folder/project should LongTable use? Then use MCP `create_workspace` when available.",
        "3. Begin or resume the interview with MCP `begin_interview` when available.",
        "4. Ask one natural-language question at a time. Do not show a questionnaire.",
        "5. After each answer, evaluate answer quality before classifying it.",
        "6. Record each turn with MCP `append_interview_turn` when available.",
        "7. Continue until there is enough context for a provisional `first_research_handle`.",
        "8. Store the First Research Shape with MCP `summarize_interview`.",
        "9. Use MCP `confirm_first_research_shape` for the final research-facing option UI checkpoint.",
        "",
        "## Opening Questions",
        "",
        "Start from one of these, adapted to the user's language:",
        "",
        "- What do you want to research?",
        "- If the problem is not clear yet, describe the part that is still hard to say.",
        "",
        "Do not begin with reader/reviewer contribution, theory/method/measurement classification, or quantified variables.",
        "",
        "## Interview Style",
        "",
        "- Use a quiet research-note tone.",
        "- Keep the visual frame minimal, using `LongTable hears:` and `Question:`.",
        "- Reflect the answer before asking the next question.",
        "- Ask one question only; wait for the researcher before continuing.",
        "- If the answer is thin, ask for one more sentence instead of classifying it.",
        "- Treat one-word or one-letter answers as `quality: thin` and request more context.",
        "",
        "Recommended frame:",
        "",
        "```text",
        "LongTable hears:",
        "<one-sentence reflection>",
        "",
        "Question:",
        "<one natural-language follow-up>",
        "```",
        "",
        "## Quality Rules",
        "",
        "- `thin`: too short, generic, or missing a concrete scene/problem/material. Ask a quality follow-up.",
        "- `usable`: enough to continue, but not enough to summarize.",
        "- `rich`: enough detail to infer scene, uncertainty, and first material.",
        "",
        "Do not turn early answers into fixed categories. Let LongTable infer quietly in the background.",
        "",
        "## First Research Shape",
        "",
        "When ready, summarize:",
        "",
        "- `handle`: short first research handle, not a final title",
        "- `currentGoal`: what the researcher is trying to investigate",
        "- `currentBlocker`: what is still hard to name, justify, or inspect",
        "- `researchObject`: optional inferred object such as research_question, theory_framework, measurement_instrument, study_design, analysis_plan, or manuscript",
        "- `gapRisk`: optional inferred risk",
        "- `protectedDecision`: optional decision LongTable should not let settle silently",
        "- `openQuestions`: 2-3 questions that keep ambiguity visible",
        "- `nextAction`: one concrete next research move",
        "- `confidence`: low, medium, or high",
        "",
        "The final structured options belong only at this confirmation point. If MCP elicitation is unavailable, ask the same options in plain text and keep the state update explicit.",
        "",
        "## Fallback",
        "",
        "If MCP tools are unavailable, continue the natural-language interview in Codex, but state that durable LongTable state could not be written. Do not pretend a checkpoint or First Research Shape was recorded."
      ]
    },
    {
      name: "longtable-panel",
      description:
        "Use when LongTable should run a panel or team-style review with visible role disagreement.",
      body: [
        "## Purpose",
        "",
        "Run a LongTable panel-style review in Codex.",
        "",
        "## When To Use",
        "",
        "- The user says `lt panel`.",
        "- The user asks for disagreement, multiple perspectives, a team review, or pre-commit challenge.",
        "- The work touches several research risks at once, such as theory, methods, measurement, venue fit, ethics, or authorship.",
        "",
        "## Output Contract",
        "",
        "Return:",
        "",
        "1. LongTable synthesis",
        "2. Panel opinions by role",
        "3. Conflict summary",
        "4. Decision prompt for the researcher",
        "5. Technical record: roles consulted, execution surface, fallback/native mode, and source/file references used",
        "",
        "## Rules",
        "",
        "- Do not collapse disagreement too early.",
        "- Use a Researcher Checkpoint before treating a high-stakes research decision as settled.",
        "- If the `mcp__longtable_state__.elicit_question` tool is available, prefer it for the panel checkpoint before synthesizing or revising.",
        "- Use `longtable question --print --provider codex --prompt \"...\"` only as the numbered fallback when MCP elicitation is unavailable or not accepted.",
        "- Use `longtable panel --print --prompt \"...\"` only as an optional canonical prompt aid, not as the user's primary interface."
      ]
    },
    {
      name: "longtable-explore",
      description:
        "Use for early LongTable research exploration, problem framing, and question narrowing.",
      body: [
        "## Purpose",
        "",
        "Help the researcher keep the problem open long enough to find a defensible research question.",
        "",
        "## Rules",
        "",
        "- Ask at least two clarifying or tension questions before recommending a direction.",
        "- Surface scope boundaries, candidate constructs, and hidden assumptions.",
        "- Keep unresolved tensions visible.",
        "- Avoid generic search advice unless the user asks for evidence discovery."
      ]
    },
    {
      name: "longtable-review",
      description:
        "Use for LongTable critical review of a claim, paragraph, study design, manuscript section, or plan.",
      body: [
        "## Purpose",
        "",
        "Review a research object without smoothing over weaknesses.",
        "",
        "## Rules",
        "",
        "- Start with the most important weakness, objection, or missing evidence.",
        "- Separate sourced facts, interpretation, and speculation.",
        "- Preserve the researcher's own language where possible.",
        "- Ask a checkpoint question before treating a high-stakes decision as settled."
      ]
    }
  ];
}

function roleSkillSpec(role: RoleDefinition): CodexSkillSpec {
  const label = role.label;
  return {
    name: skillNameForRole(role),
    description: `Use the LongTable ${label} role: ${role.shortDescription}`,
    body: [
      "## Purpose",
      "",
      `Foreground the LongTable ${label} role.`,
      "",
      "## Natural Triggers",
      "",
      role.synonyms.map((synonym) => `- ${synonym}`).join("\n"),
      "",
      "## Role Focus",
      "",
      role.shortDescription,
      "",
      "## Rules",
      "",
      `- Disclose: \`LongTable consulted: ${label}\`.`,
      "- Keep the role grounded in the user's research object and project state.",
      "- Do not invent a separate role definition; this skill is an adapter generated from the LongTable role registry.",
      "- If evidence is needed, ask whether the researcher wants scholarly search or citation verification.",
      "- If the role's judgment would change the project direction, ask a Researcher Checkpoint before closure."
    ]
  };
}

export function buildCodexSkillSpecs(roles: RoleDefinition[]): CodexSkillSpec[] {
  return [...baseSkillSpecs(), ...roles.map(roleSkillSpec)];
}

export async function installCodexSkills(
  roles: RoleDefinition[],
  customDir?: string
): Promise<InstalledCodexSkill[]> {
  const skillsDir = resolveCodexSkillsDir(customDir);
  await mkdir(skillsDir, { recursive: true });

  const installed: InstalledCodexSkill[] = [];
  for (const spec of buildCodexSkillSpecs(roles)) {
    const skillDir = join(skillsDir, spec.name);
    await mkdir(skillDir, { recursive: true });
    const path = join(skillDir, "SKILL.md");
    await writeFile(path, renderSkillFile(spec), "utf8");
    installed.push({
      name: spec.name,
      path,
      description: spec.description
    });
  }

  return installed;
}

export async function removeCodexSkills(
  roles: RoleDefinition[],
  customDir?: string
): Promise<string[]> {
  const skillsDir = resolveCodexSkillsDir(customDir);
  const removed: string[] = [];

  for (const spec of buildCodexSkillSpecs(roles)) {
    const skillDir = join(skillsDir, spec.name);
    if (existsSync(skillDir)) {
      await rm(skillDir, { recursive: true, force: true });
      removed.push(skillDir);
    }
  }

  return removed;
}

export async function listInstalledCodexSkills(
  roles: RoleDefinition[],
  customDir?: string
): Promise<InstalledCodexSkill[]> {
  const skillsDir = resolveCodexSkillsDir(customDir);
  if (!existsSync(skillsDir)) {
    return [];
  }

  const entries = new Set(await readdir(skillsDir));
  return buildCodexSkillSpecs(roles)
    .filter((spec) => entries.has(spec.name) && existsSync(join(skillsDir, spec.name, "SKILL.md")))
    .map((spec) => ({
      name: spec.name,
      path: join(skillsDir, spec.name, "SKILL.md"),
      description: spec.description
    }));
}
