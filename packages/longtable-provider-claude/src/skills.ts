import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { RoleDefinition } from "@longtable/core";

export interface ClaudeSkillSpec {
  name: string;
  description: string;
  triggers: string[];
  body: string[];
}

export interface InstalledClaudeSkill {
  name: string;
  path: string;
  description: string;
}

export function resolveClaudeSkillsDir(customDir?: string): string {
  return customDir ? resolve(customDir) : join(homedir(), ".claude", "skills");
}

function skillNameForRole(role: RoleDefinition): string {
  return `longtable-${role.key.replaceAll("_", "-")}`;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function renderSkillFile(spec: ClaudeSkillSpec): string {
  return [
    "---",
    `name: ${spec.name}`,
    `description: ${yamlString(spec.description)}`,
    "triggers:",
    ...spec.triggers.map((trigger) => `  - ${yamlString(trigger)}`),
    "---",
    "",
    `# ${spec.name}`,
    "",
    ...spec.body
  ].join("\n");
}

function baseSkillSpecs(): ClaudeSkillSpec[] {
  return [
    {
      name: "longtable",
      description: "Use for LongTable research conversations, project memory, checkpointing, and role routing.",
      triggers: ["longtable", "lt ", "research workspace", "research checkpoint"],
      body: [
        "## Purpose",
        "",
        "Act as the LongTable adapter inside Claude Code. LongTable is a researcher-centered workspace, not a replacement for the researcher.",
        "",
        "## Invocation",
        "",
        "Use this skill when the user says things like:",
        "",
        "- `longtable: help me narrow this project`",
        "- `lt explore: ...`",
        "- `lt review: ...`",
        "- `lt panel: ...`",
        "",
        "## Rules",
        "",
        "- Treat `.longtable/` state as the project source of truth when present.",
        "- Prefer natural language over asking the researcher to run shell role commands.",
        "- If a Researcher Checkpoint is needed, ask a short structured question with meaningful options and wait for the researcher.",
        "- Treat Claude's structured question surface as transport; LongTable state records are the source of truth.",
        "- Preserve open tensions and authorship instead of forcing closure.",
        "- Disclose consulted roles with `LongTable consulted: ...` when a role is foregrounded.",
        "- Label unsupported external claims as inference or estimate.",
        "",
        "## Optional CLI Bridge",
        "",
        "If the `longtable` command is available and canonical prompt rendering would help, use `longtable ask --print --prompt \"...\"` or `longtable panel --print --prompt \"...\"` as an adapter aid. Do not make shell commands the user's primary interface."
      ]
    },
    {
      name: "longtable-panel",
      description: "Use when a research decision needs visible disagreement from multiple LongTable roles.",
      triggers: ["lt panel", "longtable panel", "panel review", "team review", "disagreement", "conflict"],
      body: [
        "## Purpose",
        "",
        "Run a LongTable panel-style review in Claude Code.",
        "",
        "## Output Contract",
        "",
        "Return:",
        "",
        "1. LongTable synthesis",
        "2. Panel opinions by role",
        "3. Conflict summary",
        "4. Decision prompt for the researcher",
        "5. Evidence or file references used",
        "",
        "## Rules",
        "",
        "- Use multiple research perspectives when the request touches methods, theory, measurement, venue fit, ethics, or authorship.",
        "- Do not collapse disagreement too early.",
        "- Use a Researcher Checkpoint before treating panel synthesis as settled.",
        "- Do not expose hidden reasoning or tool logs.",
        "- If `.longtable/` exists, align the panel with `CURRENT.md` and project state.",
        "- If `longtable panel --print --prompt \"...\"` is available, it may be used to obtain the canonical fallback prompt."
      ]
    },
    {
      name: "longtable-explore",
      description: "Use for early-stage research exploration before the question is settled.",
      triggers: ["lt explore", "explore research", "narrow research question", "problem framing"],
      body: [
        "## Purpose",
        "",
        "Help the researcher keep the problem open long enough to find a defensible question.",
        "",
        "## Rules",
        "",
        "- Ask at least two clarifying or tension questions before recommending a direction.",
        "- Surface candidate boundaries, not just answers.",
        "- Keep unresolved tensions visible.",
        "- Avoid generic literature-search advice unless evidence discovery is actually requested."
      ]
    },
    {
      name: "longtable-review",
      description: "Use for critical review of a claim, paragraph, study design, or plan.",
      triggers: ["lt review", "review this", "criticize this", "what is weak"],
      body: [
        "## Purpose",
        "",
        "Review a research object without smoothing over its weaknesses.",
        "",
        "## Rules",
        "",
        "- Start with the most important risk or objection.",
        "- Separate sourced facts, interpretation, and speculation.",
        "- Preserve the researcher's own language where possible.",
        "- Ask a checkpoint question before treating a high-stakes decision as settled."
      ]
    }
  ];
}

function roleSkillSpec(role: RoleDefinition): ClaudeSkillSpec {
  const label = role.label;
  return {
    name: skillNameForRole(role),
    description: `Use the LongTable ${label} role: ${role.shortDescription}`,
    triggers: [
      ...role.synonyms.slice(0, 8),
      `longtable ${role.key.replaceAll("_", " ")}`,
      `lt ${role.key.replaceAll("_", " ")}`
    ],
    body: [
      "## Purpose",
      "",
      `Foreground the LongTable ${label} role.`,
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

export function buildClaudeSkillSpecs(roles: RoleDefinition[]): ClaudeSkillSpec[] {
  return [...baseSkillSpecs(), ...roles.map(roleSkillSpec)];
}

export async function installClaudeSkills(
  roles: RoleDefinition[],
  customDir?: string
): Promise<InstalledClaudeSkill[]> {
  const skillsDir = resolveClaudeSkillsDir(customDir);
  await mkdir(skillsDir, { recursive: true });

  const installed: InstalledClaudeSkill[] = [];
  for (const spec of buildClaudeSkillSpecs(roles)) {
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

export async function removeClaudeSkills(
  roles: RoleDefinition[],
  customDir?: string
): Promise<string[]> {
  const skillsDir = resolveClaudeSkillsDir(customDir);
  const removed: string[] = [];

  for (const spec of buildClaudeSkillSpecs(roles)) {
    const skillDir = join(skillsDir, spec.name);
    if (existsSync(skillDir)) {
      await rm(skillDir, { recursive: true, force: true });
      removed.push(skillDir);
    }
  }

  return removed;
}

export async function listInstalledClaudeSkills(
  roles: RoleDefinition[],
  customDir?: string
): Promise<InstalledClaudeSkill[]> {
  const skillsDir = resolveClaudeSkillsDir(customDir);
  if (!existsSync(skillsDir)) {
    return [];
  }

  const entries = new Set(await readdir(skillsDir));
  return buildClaudeSkillSpecs(roles)
    .filter((spec) => entries.has(spec.name) && existsSync(join(skillsDir, spec.name, "SKILL.md")))
    .map((spec) => ({
      name: spec.name,
      path: join(skillsDir, spec.name, "SKILL.md"),
      description: spec.description
    }));
}
