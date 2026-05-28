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

export type LongTableSkillSurface = "compact" | "full";

const COMPACT_ROLE_SKILL_NAMES: Record<string, string> = {
  methods_critic: "longtable-methods",
  measurement_auditor: "longtable-measure",
  theory_critic: "longtable-theory",
  reviewer: "longtable-reviewer",
  voice_keeper: "longtable-voice"
};

export function resolveCodexSkillsDir(customDir?: string): string {
  return customDir ? resolve(customDir) : join(homedir(), ".codex", "skills");
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

function baseSkillSpecs(surface: LongTableSkillSurface = "compact"): CodexSkillSpec[] {
  const base = [
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
        "- `$longtable: run a panel review of this measurement plan, show the main disagreements, and ask me what decision should be recorded before you revise it.`",
        "- `$longtable: use editor, reviewer, methods, measurement, and voice perspectives as a panel to evaluate this manuscript section. Do not collapse disagreement too early.`",
        "- `$longtable-methods`, `$longtable-measure`, `$longtable-theory`, `$longtable-reviewer`, or `$longtable-voice` when the researcher explicitly wants that shortcut.",
        "- `$longtable-start` to create or continue the first research-start interview.",
        "- `$longtable-interview` to run a structured follow-up interview after a Research Specification exists.",
        "",
        "## Routing Rules",
        "",
        "- `lt explore` keeps the problem open and asks clarifying or tension questions before recommending closure.",
        "- `lt review` starts with the strongest weakness, objection, or missing evidence.",
        "- `lt panel` creates a visible multi-role review with synthesis, role opinions, conflict summary, and a decision prompt.",
        "- `$longtable-start` runs the provider-native LongTable start interview. It replaces the old CLI start questionnaire as the primary research-start surface.",
        "- `$longtable-interview` is post-start. If `.longtable/state.json` or `CURRENT.md` lacks a usable Research Specification, route to `$longtable-start` before offering option-first follow-up choices.",
        "- Natural references to methods, measurement, theory, reviewer, editor, ethics, venue, or voice should foreground the matching LongTable role.",
        "- The compact visible shortcut set is panel, methods, measure, theory, reviewer, and voice. Other roles remain available through this router when the request calls for them.",
        "- When research responsibility is about to shift, surface a Researcher Checkpoint before closure.",
        "- When changing LongTable product language, README positioning, or checkpoint policy, surface a Meta-Decision Checkpoint first.",
        "- Stop before acting when the request would change the research question/scope, theory frame, measurement/coding standard, method design, or analysis strategy.",
        "- For low-risk reversible work, proceed with explicit assumptions instead of interrupting.",
        "- For LongTable product, hook, setup, release, or documentation work, do not create research-state QuestionRecords.",
        "",
        "## Panel Behavior",
        "",
        "- If the user asks for a panel, disagreement, team-style review, debate, or multiple perspectives, route to the LongTable panel surface first.",
        "- Treat `lt panel` as the primary in-Codex collaborative surface; keep deprecated team-command aliases hidden and disabled.",
        "- Use LongTable's sequential panel fallback as the stable surface and make the fallback explicit in the technical record.",
        "- Do not expose hidden reasoning, tool logs, or private chain-of-thought. Expose a structured deliberation record instead.",
        "- A structured deliberation record must include: roles consulted, each role's main claim or objection, the disagreement map, the decision options, the recommended option when defensible, and the exact researcher-facing question.",
        "- If the panel converges, explain what changed the disagreement; if it does not converge, preserve the unresolved conflict instead of collapsing it into one confident synthesis.",
        "",
        "## Question Ordering",
        "",
        "- Ask and stop when missing context would decide a high-risk research commitment.",
        "- Continue with stated assumptions when the missing context is low-risk, reversible, or purely presentational.",
        "- Rank questions by importance and risk; prefer one grouped high-leverage question over a long questionnaire.",
        "- When human knowledge, AI inference, and project state conflict, make the conflict visible and ask for human clarity before treating the direction as settled.",
        "",
        "## Project State",
        "",
        "- Treat `.longtable/` state as the source of truth when present.",
        "- Read `CURRENT.md` when available before giving project-specific advice.",
        "- If a Researcher Checkpoint is needed, ask a concise question with meaningful options and wait for the researcher.",
        "- If a checkpoint allows `other`, make `other` visible instead of hiding it in state.",
        "- Treat provider-native question UI as transport; LongTable state records are the source of truth.",
        "- For systematic review, meta-analysis, PDF collection, full-text extraction, institutionally licensed sources, or TDM work, ensure `longtable access setup` readiness exists or surface an ACCESS CHECKPOINT before continuing.",
        "- Access setup records capability status only. The researcher handles VPN/proxy/library/SSO login directly; LongTable must not store passwords, API keys, tokens, PDFs, or full text in setup state.",
        "- For `$longtable-start`, use natural-language turns for the interview and reserve MCP option UI for the final research-facing Research Specification checkpoint; First Research Shape is only a shorter handle/resume layer.",
        "- For `$longtable-interview`, use option-first follow-up choices only after a usable Research Specification exists. Always include an escape hatch such as Other, free text, or one open follow-up question.",
        "- Do not let unrelated pending Researcher Checkpoints interrupt the interview. Mention them only as separate unresolved checkpoints, and treat them as blocking only when the researcher is confirming, saving, or recording a research decision.",
        "- When the `mcp__longtable_state__.elicit_question` tool is available, use it first for researcher checkpoints so Codex can show the MCP elicitation UI and LongTable can record the answer as `mcp_elicitation`.",
        "- Use `longtable question --print --provider codex --prompt \"...\"` only as a fallback when the MCP tool is unavailable, unsupported, declined, canceled, or blocked by the client.",
        "- If `CURRENT.md` shows a pending required checkpoint, ask the researcher for a selection and wait. Do not choose or record `longtable decide --question <id> --answer <value>` unless the researcher explicitly provides that value.",
        "- Preserve open tensions and authorship instead of forcing closure.",
        "- Label unsupported external claims as inference or estimate."
      ]
    },
    {
      name: "longtable-start",
      description:
        "Use for `$longtable-start`: create or continue a LongTable research-start interview inside Codex, then store a Research Specification through MCP/state, with First Research Shape kept as an optional short handle layer.",
      body: [
        "## Purpose",
        "",
        "Run the LongTable research-start interview inside Codex. This is the primary project-start surface; the CLI setup command only prepares runtime permissions.",
        "",
        "## When To Use",
        "",
        "- The user invokes `$longtable-start`.",
        "- The user invokes `$longtable-interview` but the workspace has no usable Research Specification.",
        "- The user wants to start a LongTable research workspace from inside Codex.",
        "- A workspace exists but `CURRENT.md` or `.longtable/state.json` lacks a usable Research Specification, or has only a First Research Shape.",
        "",
        "## Core Flow",
        "",
        "1. Check whether `.longtable/` exists in the current directory or a parent.",
        "2. If no workspace exists, ask one workspace question only: what folder/project should LongTable use? Then use MCP `create_workspace` when available.",
        "3. Begin or resume the interview with MCP `begin_interview` when available.",
        "4. Ask one natural-language question at a time. Do not show a questionnaire.",
        "5. After each answer, evaluate answer quality before classifying it.",
        "6. Record each turn with MCP `append_interview_turn` when available.",
        "7. Continue until there is content-based readiness for a Research Specification; never stop merely because a fixed number of turns has passed.",
        "8. Store a First Research Shape with MCP `summarize_interview` when a short resume handle is useful, but do not treat it as closure.",
        "9. Store the fuller Research Specification with MCP `summarize_research_specification` when the interview has enough detail. If enough detail already exists, go directly to this step after or instead of the shape handle.",
        "10. Show the Research Specification Preview explicitly before asking for confirmation.",
        "11. Use MCP `confirm_research_specification` for the final research-facing option UI checkpoint.",
        "12. If confirmation is unavailable, timed out, or deferred, say that the draft Research Specification was saved and that confirmation remains the next action.",
        "13. Use MCP `confirm_first_research_shape` only when the researcher wants to stop at the shorter shape layer.",
        "14. If the researcher explicitly cancels the interview, use MCP `cancel_interview` when available. Do not cancel durable state for a casual topic change unless the researcher says to cancel the interview.",
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
        "- Keep the follow-up focused on one main uncertainty. A sentence may name nearby tensions for context, but avoid bundling several answerable questions into a mini-questionnaire.",
        "- If the answer is thin, ask for one more sentence instead of classifying it.",
        "- Treat one-word or one-letter answers as `quality: thin` and request more context.",
        "- Keep hook-added context out of normal replies unless it changes the next research action.",
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
        "The First Research Shape is the short handle/resume layer. It is useful for early context, but it is not the full research specification and must not be treated as the default endpoint.",
        "",
        "## Research Specification",
        "",
        "Before ending a substantive interview, create or update a fuller Research Specification when the conversation provides enough material. A First Research Shape can feed this step, but it is not required when the specification fields are already clear:",
        "",
        "- `title`: working specification title",
        "- `researchDirection`: question, purpose, scope boundary, inclusion/exclusion criteria",
        "- `constructOntology`: core constructs, distinctions, and terms that should not be collapsed",
        "- `theoryAndFraming`: theory anchors, alternatives, and overreach risks",
        "- `measurementCoding`: variables/constructs, evidence types, coding rules, and open standards",
        "- `methodAnalysis`: design, analysis options, data sufficiency criteria, and unsettled choices",
        "- `evidenceAccess`: required sources, Corpus and Access Plan, full-text/PDF route, TDM or institutional-access requirements, and evidence standards",
        "- `epistemicAlignment`: researcher knowledge, project-state priority, AI inference limits, and the conflict-resolution rule",
        "- `protectedDecisions`, `openQuestions`, `nextActions`, and `confidence`",
        "",
        "Show a clear `Research Specification Preview` in the researcher's current language before confirmation. Then call `confirm_research_specification`, whose structured options should usually be: save/confirm, ask one more question, revise a section, or keep open. If the researcher chooses ask one more question or revise a section, answer that gap and then return to the Research Specification Preview before ending. If MCP elicitation is unavailable, ask the same options in plain text and keep the state update explicit.",
        "",
        "If a confirmed First Research Shape already exists but no Research Specification exists, continue directly into the next Research Specification question or preview. Ask continue/revise/restart only when the researcher explicitly wants to change the short handle or restart the interview.",
        "",
        "## Fallback",
        "",
        "If MCP tools are unavailable, continue the natural-language interview in Codex, but state that durable LongTable state could not be written. Do not pretend a checkpoint, First Research Shape, or Research Specification was recorded."
      ]
    },
    {
      name: "longtable-interview",
      description:
        "Use for `$longtable-interview`: run an option-first LongTable follow-up interview after a usable Research Specification exists; route to `$longtable-start` when no spec exists.",
      body: [
        "## Purpose",
        "",
        "Run a post-start LongTable interview inside Codex. This skill is for structured follow-up decisions after the research has a usable Research Specification.",
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
        "## When To Use",
        "",
        "- The user invokes `$longtable-interview` and a usable Research Specification exists.",
        "- The user wants to revise, extend, or resolve a decision in an existing Research Specification.",
        "- The user needs a bounded follow-up interview around a checkpoint, spec patch, evidence boundary, method choice, coding rule, or protected decision.",
        "",
        "## Core Flow",
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
        "- Do not require tmux. If a future Codex popup transport is tmux-only, label it as optional and provide fallback.",
        "",
        "## Fallback",
        "",
        "If MCP tools are unavailable, continue in Codex with explicit options and state that durable LongTable state could not be written."
      ]
    },
    {
      name: "longtable-panel",
      description:
        "Use when LongTable should run a panel review with visible role disagreement.",
      body: [
        "## Purpose",
        "",
        "Run a LongTable panel-style review in Codex.",
        "",
        "## When To Use",
        "",
        "- The user says `lt panel`.",
        "- The user asks for disagreement, multiple perspectives, team-style review, debate, or pre-commit challenge.",
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
        "- `longtable panel --provider codex --native-workers` may launch durable LongTable-native role workers when the CLI/runtime supports it; add `--wait <ms>` when a bounded command should wait for completed result files. `--native-subagents` remains a compatibility adapter for provider-native subagents.",
        "- If Codex native subagents are available, they may be used as a provider-native execution adapter; if not, run the same roles sequentially and disclose the fallback.",
        "- Sequential fallback is always the stable degradation path; native workers and native subagents must normalize final role outputs back into `PanelResult`.",
        "- Do not use OMX `$team` or worker vocabulary as the LongTable product contract. LongTable panel records are the source of truth.",
        "- If the `mcp__longtable_state__.elicit_question` tool is available, prefer it for the panel checkpoint before synthesizing or revising.",
        "- Use `longtable question --print --provider codex --prompt \"...\"` only as the numbered fallback when MCP elicitation is unavailable or not accepted.",
        "- Use `longtable panel --print --prompt \"...\"` only as an optional canonical prompt aid, not as the user's primary interface.",
        "- Completed native worker runs are recorded by `longtable panel --native-workers --wait`, `longtable panel status --wait`, or `longtable panel resume --wait`. For external/provider results outside that lifecycle, persist structured role outputs with `longtable panel record --invocation <id> --result-file <json>` before generating `longtable handoff`.",
        "- A result file should contain final role summaries, claims, objections, open questions, and evidence refs only; do not persist hidden reasoning, raw tool traces, or tmux logs."
      ]
    }
  ];
  const fullOnly = [
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
  return surface === "full" ? [...base, ...fullOnly] : base;
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

function roleSkillSpec(role: RoleDefinition, surface: LongTableSkillSurface = "compact"): CodexSkillSpec {
  const label = role.label;
  return {
    name: skillNameForRole(role, surface),
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

function allCodexSkillSpecs(roles: RoleDefinition[]): CodexSkillSpec[] {
  const byName = new Map<string, CodexSkillSpec>();
  for (const spec of [...buildCodexSkillSpecs(roles, "compact"), ...buildCodexSkillSpecs(roles, "full")]) {
    byName.set(spec.name, spec);
  }
  return [...byName.values()];
}

export function buildCodexSkillSpecs(
  roles: RoleDefinition[],
  surface: LongTableSkillSurface = "compact"
): CodexSkillSpec[] {
  const roleSpecs = (surface === "compact" ? compactRoles(roles) : roles).map((role) =>
    roleSkillSpec(role, surface)
  );
  return [...baseSkillSpecs(surface), ...roleSpecs];
}

export async function installCodexSkills(
  roles: RoleDefinition[],
  customDir?: string,
  surface: LongTableSkillSurface = "compact"
): Promise<InstalledCodexSkill[]> {
  const skillsDir = resolveCodexSkillsDir(customDir);
  await mkdir(skillsDir, { recursive: true });

  const specs = buildCodexSkillSpecs(roles, surface);
  const selectedNames = new Set(specs.map((spec) => spec.name));
  for (const spec of allCodexSkillSpecs(roles)) {
    if (!selectedNames.has(spec.name)) {
      await rm(join(skillsDir, spec.name), { recursive: true, force: true });
    }
  }

  const installed: InstalledCodexSkill[] = [];
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

export async function removeCodexSkills(
  roles: RoleDefinition[],
  customDir?: string
): Promise<string[]> {
  const skillsDir = resolveCodexSkillsDir(customDir);
  const removed: string[] = [];

  for (const spec of allCodexSkillSpecs(roles)) {
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
  customDir?: string,
  surface: LongTableSkillSurface = "compact"
): Promise<InstalledCodexSkill[]> {
  const skillsDir = resolveCodexSkillsDir(customDir);
  if (!existsSync(skillsDir)) {
    return [];
  }

  const entries = new Set(await readdir(skillsDir));
  return buildCodexSkillSpecs(roles, surface)
    .filter((spec) => entries.has(spec.name) && existsSync(join(skillsDir, spec.name, "SKILL.md")))
    .map((spec) => ({
      name: spec.name,
      path: join(skillsDir, spec.name, "SKILL.md"),
      description: spec.description
    }));
}
