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

export type LongTableSkillSurface = "compact" | "full";

const COMPACT_ROLE_SKILL_NAMES: Record<string, string> = {
  methods_critic: "longtable-methods",
  measurement_auditor: "longtable-measure",
  theory_critic: "longtable-theory",
  reviewer: "longtable-reviewer",
  voice_keeper: "longtable-voice"
};

export function resolveClaudeSkillsDir(customDir?: string): string {
  return customDir ? resolve(customDir) : join(homedir(), ".claude", "skills");
}

function skillNameForRole(role: RoleDefinition, surface: LongTableSkillSurface): string {
  if (surface === "compact" && COMPACT_ROLE_SKILL_NAMES[role.key]) {
    return COMPACT_ROLE_SKILL_NAMES[role.key];
  }
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

function baseSkillSpecs(surface: LongTableSkillSurface = "compact"): ClaudeSkillSpec[] {
  const specs = [
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
        "- `longtable: run a panel review of this measurement plan, show the main disagreements, and ask me what decision should be recorded before you revise it.`",
        "- `longtable: use editor, reviewer, methods, measurement, and voice perspectives as a panel to evaluate this manuscript section. Do not collapse disagreement too early.`",
        "- `$longtable-methods`, `$longtable-measure`, `$longtable-theory`, `$longtable-reviewer`, or `$longtable-voice` when the researcher explicitly wants that shortcut.",
        "- `$longtable-start` to create or continue the first research-start interview.",
        "- `$longtable-interview` to run a structured follow-up interview after a Research Specification exists.",
        "",
        "## Rules",
        "",
        "- Treat `.longtable/` state as the project source of truth when present.",
        "- The compact visible shortcut set is panel, methods, measure, theory, reviewer, and voice. Other roles remain available through this router when the request calls for them.",
        "- Prefer natural language over asking the researcher to run shell role commands.",
        "- For systematic review, meta-analysis, PDF collection, full-text extraction, institutionally licensed sources, or TDM work, ensure `longtable access setup` readiness exists or surface an ACCESS CHECKPOINT before continuing.",
        "- Access setup records capability status only. The researcher handles VPN/proxy/library/SSO login directly; LongTable must not store passwords, API keys, tokens, PDFs, or full text in setup state.",
        "- For `$longtable-start`, use natural-language turns for the interview and reserve structured options for final Research Specification confirmation; First Research Shape is only a shorter handle/resume layer.",
        "- For `$longtable-interview`, use option-first follow-up choices only after a usable Research Specification exists. Always include an escape hatch such as Other, free text, or one open follow-up question.",
        "- Do not let unrelated pending Researcher Checkpoints interrupt the interview. Mention them only as separate unresolved checkpoints, and treat them as blocking only when the researcher is confirming, saving, or recording a research decision.",
        "- If a Researcher Checkpoint is needed, ask a short structured question with meaningful options and wait for the researcher.",
        "- If changing LongTable product language, README positioning, or checkpoint policy, ask a Meta-Decision Checkpoint first.",
        "- Stop before acting when the request would change the research question/scope, theory frame, measurement/coding standard, method design, or analysis strategy.",
        "- For low-risk reversible work, proceed with explicit assumptions instead of interrupting.",
        "- For LongTable product, hook, setup, release, or documentation work, do not create research-state QuestionRecords.",
        "- If a checkpoint allows `other`, make `other` visible instead of hiding it in state.",
        "- Treat Claude's structured question surface as transport; LongTable state records are the source of truth.",
        "- When an MCP `elicit_question` tool is available in the client, use it first so the checkpoint can be shown through the native elicitation surface and recorded in LongTable state.",
        "- Use `longtable question --print --provider claude --prompt \"...\"` only as a fallback when MCP/native structured elicitation is unavailable, unsupported, declined, canceled, or blocked by the client.",
        "- If `CURRENT.md` shows a pending required checkpoint, ask the researcher for a selection and wait. Do not choose or record `longtable decide --question <id> --answer <value>` unless the researcher explicitly provides that value.",
        "- Preserve open tensions and authorship instead of forcing closure.",
        "- Disclose consulted roles with `LongTable consulted: ...` when a role is foregrounded.",
        "- Label unsupported external claims as inference or estimate.",
        "",
        "## Panel And Question Ordering",
        "",
        "- If the user asks for a panel, team-style review, debate, disagreement, or multiple perspectives, use the panel surface and expose a structured deliberation record instead of a one-line summary.",
        "- The structured deliberation record must include: roles consulted, each role's main claim or objection, the disagreement map, the decision options, the recommended option when defensible, and the exact researcher-facing question.",
        "- If the panel converges, explain what changed the disagreement; if it does not converge, preserve the unresolved conflict instead of collapsing it into one confident synthesis.",
        "- Ask and stop when missing context would decide a high-risk research commitment.",
        "- Continue with stated assumptions when the missing context is low-risk, reversible, or purely presentational.",
        "- Rank questions by importance and risk; prefer one grouped high-leverage question over a long questionnaire.",
        "- When human knowledge, AI inference, and project state conflict, make the conflict visible and ask for human clarity before treating the direction as settled.",
        "",
        "## Optional CLI Bridge",
        "",
        "If the `longtable` command is available and canonical prompt rendering would help, use `longtable ask --print --prompt \"...\"` or `longtable panel --print --prompt \"...\"` as an adapter aid. Do not make shell commands the user's primary interface."
      ]
    },
    {
      name: "longtable-start",
      description: "Use for `$longtable-start`: create or continue a LongTable research-start interview inside Claude Code, then store a Research Specification through MCP/state, with First Research Shape kept as an optional short handle layer.",
      triggers: ["$longtable-start", "longtable start", "start research interview", "first research shape"],
      body: [
        "## Purpose",
        "",
        "Run the LongTable research-start interview inside Claude Code. This is the primary project-start surface; CLI setup only prepares runtime permissions.",
        "",
        "## Required Routing",
        "",
        "- Use this flow when the user invokes `$longtable-start`.",
        "- Use this flow when the user invokes `$longtable-interview` but the workspace has no usable Research Specification.",
        "- If only a First Research Shape exists, continue into the next Research Specification question or preview before any option-only follow-up interview.",
        "",
        "## Flow",
        "",
        "1. Check whether `.longtable/` exists in the current directory or a parent.",
        "2. If no workspace exists, ask one workspace question only, then use MCP `create_workspace` when available.",
        "3. Begin or resume the interview with MCP `begin_interview` when available.",
        "4. Ask one natural-language question at a time.",
        "5. Evaluate answer quality before classifying it.",
        "6. Record turns with MCP `append_interview_turn` when available.",
        "7. Continue until there is content-based readiness for a Research Specification; never stop merely because a fixed number of turns has passed.",
        "8. Store a First Research Shape with MCP `summarize_interview` when a short resume handle is useful, but do not treat it as closure.",
        "9. Store the fuller Research Specification with MCP `summarize_research_specification` when the interview has enough detail. If enough detail already exists, go directly to this step after or instead of the shape handle.",
        "10. Show the Research Specification Preview explicitly before asking for confirmation.",
        "11. Use MCP `confirm_research_specification` for the final structured confirmation.",
        "12. If confirmation is unavailable, timed out, or deferred, say that the draft Research Specification was saved and that confirmation remains the next action.",
        "13. Use MCP `confirm_first_research_shape` only when the researcher wants to stop at the shorter shape layer.",
        "14. If the researcher explicitly cancels the interview, use MCP `cancel_interview` when available. Do not cancel durable state for a casual topic change unless the researcher says to cancel the interview.",
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
        "- Keep the follow-up focused on one main uncertainty. A sentence may name nearby tensions for context, but avoid bundling several answerable questions into a mini-questionnaire.",
        "- If an answer is thin, ask for one more sentence instead of classifying it.",
        "- Treat one-word or one-letter answers as `quality: thin`.",
        "- Keep hook-added context out of normal replies unless it changes the next research action.",
        "",
        "## Turn Recording",
        "",
        "`append_interview_turn` records the durable interview trace in `.longtable/state.json`: the question asked, the researcher answer, a short reflection, answer quality, whether a follow-up is needed, and any content-based readiness rationale. If MCP tools are unavailable, continue the interview but say that this durable turn was not written.",
        "",
        "Do not set `readyToSummarize: true` because of turn count. Set it only when the answer history supports the closure-readiness criteria below.",
        "",
        "## Closure Readiness",
        "",
        "End the interview only when the conversation has enough material to support a Research Specification for later work:",
        "",
        "- research object: what kind of artifact or study decision LongTable is shaping",
        "- focal uncertainty: what remains hard to name, justify, or inspect",
        "- construct or boundary: what should count and what should not count",
        "- evidence/material: where the first inspection will happen",
        "- protected decision: what LongTable must not settle silently",
        "- next action: the next concrete research move",
        "",
        "Some projects may need two turns; others may need ten or more. If these elements are still vague, ask another natural-language question instead of summarizing.",
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
        "The First Research Shape is the short handle/resume layer. It is useful for early context, but it is not the full research specification and must not be treated as the default endpoint.",
        "",
        "## Research Specification",
        "",
        "Before ending a substantive interview, create or update a fuller Research Specification when the conversation provides enough material. A First Research Shape can feed this step, but it is not required when the specification fields are already clear:",
        "",
        "- title",
        "- researchDirection: question, purpose, scope boundary, inclusion/exclusion criteria",
        "- constructOntology: core constructs, distinctions, and terms that should not be collapsed",
        "- theoryAndFraming: theory anchors, alternatives, and overreach risks",
        "- measurementCoding: variables/constructs, evidence types, coding rules, and open standards",
        "- methodAnalysis: design, analysis options, data sufficiency criteria, and unsettled choices",
        "- evidenceAccess: required sources, Corpus and Access Plan, full-text/PDF route, TDM or institutional-access requirements, and evidence standards",
        "- epistemicAlignment: researcher knowledge, project-state priority, AI inference limits, and the conflict-resolution rule",
        "- protectedDecisions, openQuestions, nextActions, and confidence",
        "",
        "Show a clear `Research Specification Preview` in the researcher's current language before confirmation. Then call `confirm_research_specification`, whose structured options should usually be: save/confirm, ask one more question, revise a section, or keep open. If the researcher chooses ask one more question or revise a section, answer that gap and then return to the Research Specification Preview before ending. If MCP is unavailable, continue in natural language but do not claim that state was written.",
        "",
        "If a confirmed First Research Shape already exists but no Research Specification exists, continue directly into the next Research Specification question or preview. Ask continue/revise/restart only when the researcher explicitly wants to change the short handle or restart the interview."
      ]
    },
    {
      name: "longtable-interview",
      description: "Use for `$longtable-interview`: run an option-first LongTable follow-up interview after a usable Research Specification exists; route to `$longtable-start` when no spec exists.",
      triggers: ["$longtable-interview", "longtable interview", "follow-up research interview", "research specification interview"],
      body: [
        "## Purpose",
        "",
        "Run a post-start LongTable interview inside Claude Code. This skill is for structured follow-up decisions after the research has a usable Research Specification.",
        "",
        "## Required Routing",
        "",
        "- First inspect `CURRENT.md` and `.longtable/state.json` when available.",
        "- If MCP `read_research_specification` is available, use its `readiness.usableForInterview` result as the gate.",
        "- Usable means the shared readiness gate allows interview, normally a confirmed Research Specification.",
        "- If no usable Research Specification exists, route to `$longtable-start` immediately.",
        "- If only a First Research Shape exists, route to `$longtable-start` and continue into the next Research Specification question or preview.",
        "- Do not run an option-only interview before the Research Specification exists.",
        "",
        "## Flow",
        "",
        "1. Read the current Research Specification and identify the decision or section being interviewed.",
        "2. Present a small option-first choice set tied to the current specification.",
        "3. Include an escape hatch such as `Other`, free text, or `ask one open question first`.",
        "4. If the answer changes the specification, propose or apply a Research Specification patch through MCP/state when available.",
        "5. Record the resulting decision as a `DecisionRecord` or explicit open tension; never silently overwrite conflicting research commitments.",
        "",
        "## Option UI Policy",
        "",
        "- Use MCP/native structured elicitation when available.",
        "- Use terminal selector only when the runtime has interactive TTY support.",
        "- Use numbered/plain text fallback when structured UI is unavailable.",
        "- Treat UI as transport. The durable product contract remains `QuestionRecord -> DecisionRecord`.",
        "- Do not require tmux. If a future Codex popup transport is tmux-only, label it as optional and provide fallback."
      ]
    },
    {
      name: "longtable-panel",
      description: "Use when a research decision needs visible disagreement from multiple LongTable roles.",
      triggers: ["lt panel", "longtable panel", "panel review", "team-style review", "disagreement", "conflict"],
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
        "- LongTable-native workers are a CLI/runtime option under `longtable panel --provider codex --native-workers`; `--wait <ms>` asks LongTable to wait briefly for completed result files. In Claude Code, treat them as recorded panel evidence rather than as a Claude product contract.",
        "- If Claude Code exposes a native multi-agent/subagent surface in the current session, it may be used as an adapter; if not, run the same panel roles sequentially and disclose the fallback.",
        "- Sequential fallback is always the stable degradation path; any native worker or native subagent output must normalize final role outputs back into `PanelResult`.",
        "- Do not use OMX `$team` or worker vocabulary as the LongTable product contract. LongTable panel records are the source of truth.",
        "- Prefer MCP/native structured elicitation for the panel checkpoint when available.",
        "- Use `longtable question --print --provider claude --prompt \"...\"` only as the numbered fallback when native elicitation is unavailable or not accepted.",
        "- Do not expose hidden reasoning or tool logs.",
        "- If `.longtable/` exists, align the panel with `CURRENT.md` and project state.",
        "- If `longtable panel --print --prompt \"...\"` is available, it may be used to obtain the canonical fallback prompt.",
        "- Completed native worker runs are recorded by `longtable panel --native-workers --wait`, `longtable panel status --wait`, or `longtable panel resume --wait`. For external/provider results outside that lifecycle, persist structured role outputs with `longtable panel record --invocation <id> --result-file <json>` before generating `longtable handoff`.",
        "- A result file should contain final role summaries, claims, objections, open questions, and evidence refs only; do not persist hidden reasoning, raw tool traces, or tmux logs."
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
  return surface === "full"
    ? specs
    : specs.filter((spec) =>
        spec.name === "longtable" ||
        spec.name === "longtable-start" ||
        spec.name === "longtable-interview" ||
        spec.name === "longtable-panel"
      );
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

function roleSkillSpec(role: RoleDefinition, surface: LongTableSkillSurface = "compact"): ClaudeSkillSpec {
  const label = role.label;
  return {
    name: skillNameForRole(role, surface),
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

function compactRoles(roles: RoleDefinition[]): RoleDefinition[] {
  return roles.filter((role) => Object.hasOwn(COMPACT_ROLE_SKILL_NAMES, role.key));
}

function allClaudeSkillSpecs(roles: RoleDefinition[]): ClaudeSkillSpec[] {
  const byName = new Map<string, ClaudeSkillSpec>();
  for (const spec of [...buildClaudeSkillSpecs(roles, "compact"), ...buildClaudeSkillSpecs(roles, "full")]) {
    byName.set(spec.name, spec);
  }
  return [...byName.values()];
}

export function buildClaudeSkillSpecs(
  roles: RoleDefinition[],
  surface: LongTableSkillSurface = "compact"
): ClaudeSkillSpec[] {
  const roleSpecs = (surface === "compact" ? compactRoles(roles) : roles).map((role) =>
    roleSkillSpec(role, surface)
  );
  return [...baseSkillSpecs(surface), ...roleSpecs];
}

export async function installClaudeSkills(
  roles: RoleDefinition[],
  customDir?: string,
  surface: LongTableSkillSurface = "compact"
): Promise<InstalledClaudeSkill[]> {
  const skillsDir = resolveClaudeSkillsDir(customDir);
  await mkdir(skillsDir, { recursive: true });

  const specs = buildClaudeSkillSpecs(roles, surface);
  const selectedNames = new Set(specs.map((spec) => spec.name));
  for (const spec of allClaudeSkillSpecs(roles)) {
    if (!selectedNames.has(spec.name)) {
      await rm(join(skillsDir, spec.name), { recursive: true, force: true });
    }
  }

  const installed: InstalledClaudeSkill[] = [];
  for (const spec of specs) {
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

  for (const spec of allClaudeSkillSpecs(roles)) {
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
  customDir?: string,
  surface: LongTableSkillSurface = "compact"
): Promise<InstalledClaudeSkill[]> {
  const skillsDir = resolveClaudeSkillsDir(customDir);
  if (!existsSync(skillsDir)) {
    return [];
  }

  const entries = new Set(await readdir(skillsDir));
  return buildClaudeSkillSpecs(roles, surface)
    .filter((spec) => entries.has(spec.name) && existsSync(join(skillsDir, spec.name, "SKILL.md")))
    .map((spec) => ({
      name: spec.name,
      path: join(skillsDir, spec.name, "SKILL.md"),
      description: spec.description
    }));
}
