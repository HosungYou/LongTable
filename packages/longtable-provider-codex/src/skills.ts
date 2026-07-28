import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { RoleDefinition } from "@longtable/core";

export interface CodexSkillSpec {
  name: string;
  description: string;
  disableModelInvocation?: boolean;
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

const LEGACY_CODEX_SKILL_NAMES = [
  "critical-interview",
  "scholar-research",
  "longtable-start",
  "longtable-interview",
  "longtable-panel",
  "longtable-explore",
  "longtable-review",
  "longtable-methods",
  "longtable-measure",
  "longtable-theory",
  "longtable-reviewer",
  "longtable-voice"
] as const;

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
    ...(spec.disableModelInvocation ? ["disable-model-invocation: true"] : []),
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
        "Use as the LongTable research front door for problem diagnosis, a bounded Research Brief, workspace memory, Research Assurance, and routing into LongTable Research.",
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
        "- `lt assure: review this high-risk decision`",
        "- `use the LongTable methods critic on this design`",
        "- `$longtable: run Research Assurance on this measurement plan, preserve disagreement, and interrupt me only if a decision is genuinely blocking.`",
        "- Natural-language requests for research start, diagnosis, review, or a high-risk assurance pass.",
        "- `$longtable-research` for scholarly evidence recovery, citation-slot research, and legal full-text readiness.",
        "",
        "## Routing Rules",
        "",
        "- `lt explore` keeps the problem open and asks clarifying or tension questions before recommending closure.",
        "- `lt review` starts with the strongest weakness, objection, or missing evidence.",
        "- `lt assure` invokes Research Assurance. Provider-native agents may execute lenses; LongTable owns the evidence, disagreement, and checkpoint contract.",
        "- A start or resume intent routes inside `$longtable` to the provider-native research-start interview.",
        "- A grilling or pressure-interview intent routes inside `$longtable` to the one-question pressure loop.",
        "- Natural references to methods, measurement, theory, reviewer, editor, ethics, venue, or voice select internal Research Assurance lenses rather than separate public skills.",
        "- The installation exposes exactly `$longtable` and `$longtable-research`; the former full surface and separate role/panel/start/interview skills are removed.",
        "- Ask at most three clarifying questions before presenting a versioned Research Brief and the choices: start LongTable Research, keep shaping, or save and stop.",
        "- The Research Brief is the provider-neutral handoff. Do not ask LongTable Research to repeat fields already recorded there.",
        "- When research responsibility is about to shift, surface a Researcher Checkpoint before closure.",
        "- When changing LongTable product language, README positioning, or checkpoint policy, surface a Meta-Decision Checkpoint first.",
        "- Stop before acting when the request would change the research question/scope, theory frame, measurement/coding standard, method design, or analysis strategy.",
        "- For low-risk reversible work, proceed with explicit assumptions instead of interrupting.",
        "- For LongTable product, hook, setup, release, or documentation work, do not create research-state QuestionRecords.",
        "",
        "## Research Assurance",
        "",
        "- Treat panel, disagreement, team-style review, debate, or multiple perspectives as compatibility language for Research Assurance.",
        "- Run Assurance automatically only at scope, access/corpus, evidence/claim-strength, visual-evidence, or external-action boundaries.",
        "- Keep Assurance quiet unless a non-compensatory failure or unresolved disagreement requires researcher judgment.",
        "- Provider-native multi-agent execution is an adapter. Do not present agent spawning as the LongTable product.",
        "- Do not expose hidden reasoning, tool logs, or private chain-of-thought. Expose a structured deliberation record instead.",
        "- A structured deliberation record must include: roles consulted, each role's main claim or objection, the disagreement map, the decision options, the recommended option when defensible, and the exact researcher-facing question.",
        "- If the review converges, record what resolved the disagreement; otherwise preserve the unresolved conflict.",
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
        "- For the start route, use natural-language turns and reserve MCP option UI for the final Research Specification checkpoint; First Research Shape is only a short resume handle.",
        "- For the pressure-interview route, read state, name the unresolved `Tension:`, ask exactly one `Pressure question:`, then wait.",
        "- Keep unrelated pending Researcher Checkpoints separate. Treat them as blocking only when the researcher is confirming, saving, or recording a research decision.",
        "- When the `mcp__longtable_state__.elicit_question` tool is available, use it first for researcher checkpoints so Codex can show the MCP elicitation UI and LongTable can record the answer as `mcp_elicitation`.",
        "- Use `longtable question --print --provider codex --prompt \"...\"` only as a fallback when the MCP tool is unavailable, unsupported, declined, canceled, or blocked by the client.",
        "- If `CURRENT.md` shows a pending required checkpoint, ask the researcher for a selection and wait. Do not choose or record `longtable decide --question <id> --answer <value>` unless the researcher explicitly provides that value.",
        "- Preserve open tensions and authorship instead of forcing closure.",
        "- Label unsupported external claims as inference or estimate."
      ]
    },
    {
      name: "longtable-research",
      description:
        "Use LongTable Research for journal-grounded discovery, lawful full-text recovery, verified extraction and synthesis, professional research visuals, and a Verified Research Package.",
      body: [
        "Run LongTable Research.",
        "",
        "Treat `.longtable/` as the source of truth. Consume an existing Research Brief without repeating its questions. Recover only legally accessible scholarly evidence. Provider-native agents may execute bounded tasks; LongTable owns the versioned bundle, provenance, assurance, and human gates.",
        "",
        "## Required Flow",
        "",
        "1. Run `longtable research doctor` before evidence recovery and surface missing connector readiness.",
        "2. Use `longtable research run --query <topic>` for the durable topic, venue, collection, full-text, extraction, visual, verification, and handoff workflow. Use `resume`; do not recreate completed stages.",
        "3. Search in this order: DOI/title seed, Crossref/OpenAlex/Semantic Scholar metadata, arXiv/ERIC/PubMed/PMC/CORE/DOAJ/repository sweep, publisher landing page, and legal PDF/full text.",
        "4. A local PDF corpus requires `--pdf-dir` and an explicit `--pdf-access public_oa|manual_legitimate_access|licensed_tdm|private`. Do not guess its access class.",
        "5. When the run pauses at extract, read only the bounded packets under `provider-tasks/extract/`. Return a `longtable.provider-proposed-patch`; preserve exact quote, locator, hash, version, and access class.",
        "6. Provider proposals may create only `provisional` slots. `filled` requires independent verification and human review under the strict evidence contract.",
        "7. Preserve supports, qualifies, and contradicts relations. Do not collapse conflicts because two providers agree.",
        "8. Stop for a Researcher Checkpoint when access is restricted, evidence changes direction or claim strength, a Visual Evidence Contract needs approval, or an external action is requested.",
        "",
        "## Safety Boundary",
        "",
        "- Do not bypass paywalls, authentication, robots.txt, WAFs, or access controls.",
        "- Do not automate institution login, cookie reuse, proxy/VPN bypass, or session extraction.",
        "- Request manual upload only when the researcher says they have legitimate access.",
        "- Record failure reasons with the LongTable taxonomy: `not_found`, `no_full_text`, `restricted_access`, `robots_or_terms_blocked`, `ambiguous_match`, `download_failed`, `parse_failed`, `weak_evidence`.",
        "",
        "## Output Contract",
        "",
        "- `.longtable/research-runs/<run-id>/journal.md`",
        "- `.longtable/research-runs/<run-id>/expansion-log.md`",
        "- `.longtable/research-runs/<run-id>/claim-ledger.md`",
        "- `.longtable/research-runs/<run-id>/evidence-ledger.md`",
        "- `.longtable/research-runs/<run-id>/fallback-ledger.md`",
        "- `.longtable/research-runs/<run-id>/citation-slot-matrix.md`",
        "- `.longtable/research-runs/<run-id>/sources/manifest.jsonl`",
        "- `.longtable/research-runs/<run-id>/research-bundle.json`",
        "- `.longtable/research-runs/<run-id>/events.jsonl`",
        "- `.longtable/research-runs/<run-id>/provider-tasks/extract/manifest.json`",
        "- `.longtable/research-runs/<run-id>/research-package/README.md`",
        "- `.longtable/research-runs/<run-id>/research-package/package-manifest.json`",
        "",
        "`$scholar-research` and `longtable scholar-research` are one-release compatibility aliases only."
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
        "- The user explicitly wants a first research-start interview rather than a pressure interview.",
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
        "Use for `$longtable-interview`: run a LongTable grilling interview for research plans, arguments, methods, evidence standards, manuscripts, and product decisions.",
      body: [
        "## Purpose",
        "",
        "Run a LongTable grilling interview inside Codex. The goal is to sharpen the next research decision, not to present a questionnaire.",
        "",
        "## Required Context",
        "",
        "- First inspect `CURRENT.md` and `.longtable/state.json` when available.",
        "- If MCP `read_research_specification` is available, use it as context, not as a gate.",
        "- If the answer can be found in `CURRENT.md`, `.longtable/`, the codebase, supplied documents, or cited evidence, inspect those first instead of asking.",
        "- Research Specification state is optional context; use `$longtable-start` only when the researcher explicitly wants a first research-start interview.",
        "- If the researcher explicitly wants a first research-start interview, use `$longtable-start`; otherwise keep the grilling interview here.",
        "",
        "## When To Use",
        "",
        "- The user invokes `$longtable-interview`.",
        "- The user asks for a research pressure interview about a plan, claim, method, evidence standard, manuscript, or LongTable product decision.",
        "- The user wants to revise, extend, or resolve a decision in an existing Research Specification.",
        "- The user needs a pressure interview around a checkpoint, spec patch, evidence boundary, method choice, coding rule, or protected decision.",
        "",
        "## Grilling Loop",
        "",
        "- Ask exactly one question per turn.",
        "- Frame each turn as `Tension:` followed by `Pressure question:`.",
        "- Target a decision, hidden assumption, weak boundary, unsupported claim, or evidence gap.",
        "- Keep any recommendation to one pressure point after the question.",
        "- Continue only while the next question can produce a new decision, sharper boundary, stronger evidence standard, or clearer open tension.",
        "- Stop when remaining questions repeat the same tension without producing a new decision.",
        "",
        "## Core Flow",
        "",
        "1. Read available project state and identify the highest-leverage unresolved tension.",
        "2. Ask exactly one `Pressure question:` under `Tension:`.",
        "3. Wait for the researcher's direct answer.",
        "4. Use MCP/state after the answer or an explicit record request.",
        "5. If the answer changes the specification, propose or apply a Research Specification patch through MCP/state when available.",
        "6. Record the result as a `DecisionRecord`, Research Specification patch, or explicit open tension; preserve conflicting research commitments in the record.",
        "",
        "## Fallback",
        "",
        "If MCP tools are unavailable, continue the grilling interview in Codex and state that durable LongTable state could not be written."
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
        "- `longtable panel --provider codex --native-workers` may launch durable LongTable-native role workers when the CLI/runtime supports it; add `--wait <ms>` when a bounded command should wait for terminal result files. `--native-subagents` remains a compatibility adapter for provider-native subagents.",
        "- If Codex native subagents are available, they may be used as a provider-native execution adapter; if not, run the same roles sequentially and disclose the fallback.",
        "- Sequential fallback is always the stable degradation path; native workers and native subagents must normalize final role outputs back into `PanelResult`.",
        "- Do not use OMX `$team` or worker vocabulary as the LongTable product contract. LongTable panel records are the source of truth.",
        "- If the `mcp__longtable_state__.elicit_question` tool is available, prefer it for the panel checkpoint before synthesizing or revising.",
        "- Use `longtable question --print --provider codex --prompt \"...\"` only as the numbered fallback when MCP elicitation is unavailable or not accepted.",
        "- Use `longtable panel --print --prompt \"...\"` only as an optional canonical prompt aid, not as the user's primary interface.",
        "- Terminal native worker runs (`completed` or `blocked`) are recorded by `longtable panel --native-workers --wait`, `longtable panel status --wait`, or `longtable panel resume --wait`; blocked role outputs remain blocked in the handoff. For external/provider results outside that lifecycle, persist structured role outputs with `longtable panel record --invocation <id> --result-file <json>` before generating `longtable handoff`.",
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
  void surface;
  void fullOnly;
  return base.filter((spec) => spec.name === "longtable" || spec.name === "longtable-research");
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
      "What objection would a skeptical reviewer raise first, and what missing evidence would answer it?",
      "Which journal or venue expectation is the draft trying to satisfy, and what reference-paper pattern proves that expectation?"
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
  const roleSpecificRules = role.key === "editor"
    ? [
        "- If a target journal is named, do not claim journal fit from role intuition alone.",
        "- Require a journal profile before fit judgment: aims/scope, author guidance, recent article pattern, and article type expectations.",
        "- If the journal profile is missing, ask whether to run scholarly/venue search or label the fit as provisional."
      ]
    : role.key === "reviewer"
      ? [
          "## Journal-grounded reviewer workflow",
          "",
          "- Keep `longtable-reviewer` as the visible compact surface; use Journal Editor and Venue Strategist as internal lenses.",
          "- When a target journal, submission venue, reference paper set, or journal-ready claim is named, ground feedback in a `Journal Profile`: aims/scope, author guidance, recent article pattern, and article type expectations.",
          "- Use `longtable-research` or `longtable search --intent venue` to build or refresh a `Reference Pattern Matrix` before making source-backed journal-fit claims.",
          "- Read available reference papers and compare decision structure, paper flow, standardized terminology, Figure/Table conventions, and APA 7 style expectations.",
          "- Return reviewer feedback as: editor-facing contribution claim, reviewer objection, Venue Strategist tradeoff, evidence gap, revision action, and Researcher Checkpoint when the recommendation changes venue positioning."
        ]
    : [];
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
      ...roleSpecificRules,
      "- If evidence is needed, ask whether the researcher wants scholarly search or citation verification.",
      "- If the role's judgment would change the project direction, ask a Researcher Checkpoint before closure."
    ]
  };
}

function compactRoles(_roles: RoleDefinition[]): RoleDefinition[] {
  return [];
}

function legacyCodexSkillNames(roles: RoleDefinition[]): string[] {
  return [...new Set([
    ...LEGACY_CODEX_SKILL_NAMES,
    ...roles.flatMap((role) => [
      skillNameForRole(role, "compact"),
      skillNameForRole(role, "full")
    ])
  ])];
}

export function buildCodexSkillSpecs(
  roles: RoleDefinition[],
  surface: LongTableSkillSurface = "compact"
): CodexSkillSpec[] {
  void roles;
  return baseSkillSpecs(surface);
}

export async function installCodexSkills(
  roles: RoleDefinition[],
  customDir?: string,
  surface: LongTableSkillSurface = "compact"
): Promise<InstalledCodexSkill[]> {
  const skillsDir = resolveCodexSkillsDir(customDir);
  await mkdir(skillsDir, { recursive: true });

  const specs = buildCodexSkillSpecs(roles, surface);
  for (const skillName of legacyCodexSkillNames(roles)) {
    await rm(join(skillsDir, skillName), { recursive: true, force: true });
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

  for (const spec of buildCodexSkillSpecs(roles)) {
    const skillDir = join(skillsDir, spec.name);
    if (existsSync(skillDir)) {
      await rm(skillDir, { recursive: true, force: true });
      removed.push(skillDir);
    }
  }
  for (const skillName of legacyCodexSkillNames(roles)) {
    const skillDir = join(skillsDir, skillName);
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
