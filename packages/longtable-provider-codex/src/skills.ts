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
        "",
        "## Routing Rules",
        "",
        "- `lt explore` keeps the problem open and asks clarifying or tension questions before recommending closure.",
        "- `lt review` starts with the strongest weakness, objection, or missing evidence.",
        "- `lt panel` creates a visible multi-role review with synthesis, role opinions, conflict summary, and a decision prompt.",
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
        "- Preserve open tensions and authorship instead of forcing closure.",
        "- Label unsupported external claims as inference or estimate."
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
