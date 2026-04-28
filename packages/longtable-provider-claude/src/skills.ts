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
        "- `longtable: deploy a research team to review this measurement plan, show the main disagreements, and ask me what decision should be recorded before you revise it.`",
        "- `longtable: use editor, reviewer, methods, measurement, and voice perspectives to evaluate this manuscript section. Do not collapse disagreement too early.`",
        "- `$longtable-interview` to create or continue the first research-start interview.",
        "",
        "## Rules",
        "",
        "- Treat `.longtable/` state as the project source of truth when present.",
        "- Prefer natural language over asking the researcher to run shell role commands.",
        "- For `$longtable-interview`, use natural-language turns for the interview and reserve structured options for final First Research Shape confirmation.",
        "- If a Researcher Checkpoint is needed, ask a short structured question with meaningful options and wait for the researcher.",
        "- If changing LongTable product language, README positioning, or checkpoint policy, ask a Meta-Decision Checkpoint first.",
        "- If a checkpoint allows `other`, make `other` visible instead of hiding it in state.",
        "- Treat Claude's structured question surface as transport; LongTable state records are the source of truth.",
        "- When an MCP `elicit_question` tool is available in the client, use it first so the checkpoint can be shown through the native elicitation surface and recorded in LongTable state.",
        "- Use `longtable question --print --provider claude --prompt \"...\"` only as a fallback when MCP/native structured elicitation is unavailable, unsupported, declined, canceled, or blocked by the client.",
        "- If `CURRENT.md` shows a pending required checkpoint, do not proceed until `longtable decide --question <id> --answer <value>` records the researcher's choice.",
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
      name: "longtable-interview",
      description: "Use for `$longtable-interview`: create or continue a LongTable research-start interview inside Claude Code, then store a First Research Shape through MCP/state.",
      triggers: ["$longtable-interview", "longtable interview", "start research interview", "first research shape"],
      body: [
        "## Purpose",
        "",
        "Run the LongTable research-start interview inside Claude Code. This is the primary project-start surface; CLI setup only prepares runtime permissions.",
        "",
        "## Flow",
        "",
        "1. Check whether `.longtable/` exists in the current directory or a parent.",
        "2. If no workspace exists, ask one workspace question only, then use MCP `create_workspace` when available.",
        "3. Begin or resume the interview with MCP `begin_interview` when available.",
        "4. Ask one natural-language question at a time.",
        "5. Evaluate answer quality before classifying it.",
        "6. Record turns with MCP `append_interview_turn` when available.",
        "7. Continue until there is enough context for a provisional `first_research_handle`.",
        "8. Store the First Research Shape with MCP `summarize_interview`.",
        "9. Use MCP `confirm_first_research_shape` for the final structured confirmation.",
        "",
        "## Opening",
        "",
        "Begin with one of these, adapted to the user's language:",
        "",
        "- What do you want to research?",
        "- If the problem is not clear yet, describe the part that is still hard to say.",
        "",
        "Do not begin with reader/reviewer contribution, theory/method/measurement classification, or quantified variables.",
        "",
        "## Interview Style",
        "",
        "- Use a quiet research-note tone.",
        "- Reflect with `LongTable hears:` before the next question.",
        "- Ask one question only; wait for the researcher.",
        "- If an answer is thin, ask for one more sentence instead of classifying it.",
        "- Treat one-word or one-letter answers as `quality: thin`.",
        "",
        "## First Research Shape",
        "",
        "Summarize only when enough context exists:",
        "",
        "- handle",
        "- currentGoal",
        "- currentBlocker",
        "- optional researchObject, gapRisk, protectedDecision",
        "- 2-3 openQuestions",
        "- nextAction",
        "- confidence",
        "",
        "Use structured options only for the final confirmation or true checkpoint boundaries. If MCP is unavailable, continue in natural language but do not claim that state was written."
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
        "- Prefer MCP/native structured elicitation for the panel checkpoint when available.",
        "- Use `longtable question --print --provider claude --prompt \"...\"` only as the numbered fallback when native elicitation is unavailable or not accepted.",
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

function mustAskQuestionsForRole(role: RoleDefinition): string[] {
  const common = [
    "What researcher judgment would be hidden if this role gives a confident answer now?",
    "What evidence or project-state reference would change this role's recommendation?"
  ];
  const byRole: Record<string, string[]> = {
    editor: [
      "What is the strongest venue-facing contribution claim, and what would make it overreach?"
    ],
    reviewer: [
      "What objection would a skeptical reviewer raise first, and what missing evidence would answer it?"
    ],
    theory_critic: [
      "Which construct boundary or theoretical assumption must stay explicit before the claim is revised?"
    ],
    methods_critic: [
      "Which design choice, comparison, sample, or causal claim is being treated as settled too early?"
    ],
    measurement_auditor: [
      "What exactly is being measured, and what would count as construct drift or invalid substitution?"
    ],
    ethics_reviewer: [
      "Who could be misrepresented, exposed, or burdened if this design choice is accepted?"
    ],
    voice_keeper: [
      "Which part of the researcher's own narrative or uncertainty should not be polished away?"
    ],
    venue_strategist: [
      "Which venue expectation is being optimized for, and what positioning tradeoff follows from it?"
    ]
  };
  return [...(byRole[role.key] ?? []), ...common];
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
      "## Must-Ask Questions",
      "",
      ...mustAskQuestionsForRole(role).map((question) => `- ${question}`),
      "",
      "## Stop Conditions",
      "",
      "- Stop before closure when the role's recommendation would change a research question, construct definition, measurement rule, authorship boundary, or venue positioning.",
      "- Stop when the role is relying on unstated evidence, a tacit assumption, or a hidden tradeoff.",
      "- Stop when another LongTable role would likely disagree and the disagreement has not been shown to the researcher.",
      "",
      "## Output Contract",
      "",
      "- Start with the role's strongest concern or contribution.",
      "- State one concrete question the researcher should answer if the direction is not yet safe to settle.",
      "- Separate evidence needs from interpretation and from role-specific judgment.",
      "",
      "## Anti-Patterns",
      "",
      "- Do not give generic encouragement or a polished synthesis without the role's actual objection.",
      "- Do not use the role as a decorative label after a normal answer has already been written.",
      "- Do not ask for evidence only as a fallback; name the missing evidence when it changes the recommendation.",
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
