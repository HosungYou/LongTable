---
name: setup
description: |
  Diverga v11.3 setup wizard. 3-step researcher profile setup.
  Captures discipline, experience, tools, database access, and Agent Teams preference.
  Triggers: setup, configure, 설정, install
version: "11.1.2"
---

# /diverga:setup

**Version**: 11.2.0
**Trigger**: `/diverga:setup`

## Description

Diverga setup wizard. 2 steps: Researcher Profile + Tools & Access.
Captures information that genuinely changes agent behavior.

## Design Principles

1. **Only ask what agents actually use** — no dead config fields
2. **Lazy config for rare features** — OpenAlex email, citation format, qual software are asked when the relevant agent runs for the first time
3. **Researcher profile is stable** — discipline and tools don't change per project; checkpoints handle project-specific decisions

## Workflow

When user invokes `/diverga:setup`, execute this interactive wizard:

### Step 0: Project Detection

Check for existing config:
- If `~/.claude/plugins/diverga/config/diverga-config.json` exists with `researcher` field → "Existing profile detected. Update?"
- Otherwise → "New profile setup"

### Step 1: Welcome + Researcher Profile

Display welcome message, then ask TWO questions using a single AskUserQuestion call:

```
╔══════════════════════════════════════════════════════════════════╗
║                    Welcome to Diverga v11.2                     ║
║        AI Research Assistant - 24 Agents, 9 Categories          ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Diverga adapts to your background.                             ║
║  A doctoral student gets more scaffolding.                      ║
║  An experienced faculty gets concise recommendations.           ║
║  Your preferred tools determine code and database suggestions.  ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

```yaml
questions:
  - question: "What is your primary research discipline?"
    header: "Discipline"
    multiSelect: false
    options:
      - label: "Education"
        description: "Educational Technology, Curriculum, Higher Ed, STEM Ed, etc."
      - label: "Psychology"
        description: "Clinical, Developmental, Social, Cognitive, I/O, etc."
      - label: "Health Sciences"
        description: "Public Health, Nursing, Medicine, Rehabilitation, etc."
      - label: "Social Sciences"
        description: "Sociology, Political Science, Communication, Business, etc."
    # User can also type a custom discipline via "Other"

  - question: "What is your research experience level?"
    header: "Experience"
    multiSelect: false
    options:
      - label: "Doctoral Student"
        description: "Currently pursuing PhD/EdD. More guidance on methodology and analysis."
      - label: "Postdoc / Early Career"
        description: "Completed doctorate. Familiar with research process."
      - label: "Faculty / Senior Researcher"
        description: "Experienced researcher. Concise recommendations preferred."
```

**How this affects agents:**
- `Doctoral Student` → A1 explains PICO/SPIDER, C1 scaffolds power analysis, E1 adds interpretation guidance
- `Faculty` → Agents skip explanations, go straight to options and trade-offs
- Discipline → G1 prioritizes field-specific journals, I1 leads with field-appropriate databases

### Step 2: Tools & Institutional Access

Ask TWO questions using a single AskUserQuestion call:

```yaml
questions:
  - question: "Which statistical software do you use?"
    header: "Stats Tools"
    multiSelect: true
    options:
      - label: "R"
        description: "tidyverse, lavaan, lme4, etc."
      - label: "Python"
        description: "pandas, statsmodels, scikit-learn, etc."
      - label: "SPSS"
        description: "IBM SPSS Statistics"
      - label: "Stata"
        description: "Stata/SE or Stata/MP"

  - question: "Which academic databases can you access?"
    header: "DB Access"
    multiSelect: true
    options:
      - label: "Scopus"
        description: "Elsevier Scopus (institutional subscription)"
      - label: "Web of Science"
        description: "Clarivate WoS (institutional subscription)"
      - label: "PsycINFO"
        description: "APA PsycINFO (institutional subscription)"
      - label: "ERIC + Semantic Scholar (free)"
        description: "Always available, no subscription needed"
```

**How this affects agents:**
- Stats tools → E1 generates code ONLY in selected languages (no more 4-language output)
- DB access → I1/I0 recommends only accessible databases at `SCH_DATABASE_SELECTION` checkpoint

### Step 3: Agent Teams (Experimental)

Check if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is already set:
- If already `1` → display "Agent Teams: already enabled ✓" and skip question
- Otherwise → ask:

```
question: "Enable Agent Teams for multi-agent collaboration?"
header: "Agent Teams (Experimental)"
options:
  - label: "Enable (Recommended with VS Arena)"
    description: "Agents debate and collaborate directly. Requires more tokens but enables deeper analysis."
  - label: "Skip"
    description: "Agents work independently via coordinator. Lower cost, still effective."
```

**If Enable selected:**
1. Write to `~/.claude/settings.json`:
   ```json
   { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
   ```
   (merge with existing settings, don't overwrite)
2. Add `"agent_teams": { "enabled": true, "auto_activate": true }` to config
3. Note: "Agent Teams enables direct inter-agent debates for VS Arena, systematic reviews, and humanization pipelines."

**If Skip selected:**
- Add `"agent_teams": { "enabled": false }` to config
- Note: "You can enable Agent Teams later by running /diverga:setup again."

### Step 4: Generate Configuration & Complete

After collecting all preferences, generate `config/diverga-config.json` at `~/.claude/plugins/diverga/config/`:

```json
{
  "version": "11.3.0",
  "researcher": {
    "discipline": "Education",
    "experience": "doctoral_student",
    "stats_software": ["R", "SPSS"],
    "db_access": ["Scopus", "ERIC", "Semantic Scholar"]
  },
  "agent_teams": {
    "enabled": true,
    "auto_activate": true
  }
}
```

**Experience level mapping:**
- "Doctoral Student" → `"doctoral_student"`
- "Postdoc / Early Career" → `"early_career"`
- "Faculty / Senior Researcher" → `"faculty"`

Display completion:

```
╔══════════════════════════════════════════════════════════════════╗
║                  Diverga v11.3 Setup Complete!                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Profile saved:                                                  ║
║    Discipline: Education                                        ║
║    Experience: Doctoral Student                                  ║
║    Stats: R, SPSS                                               ║
║    Databases: Scopus, ERIC, Semantic Scholar                    ║
║    Agent Teams: Enabled                                          ║
║                                                                  ║
║  Quick Start:                                                    ║
║  - Just describe your research in natural language               ║
║  - "I want to conduct a systematic review on AI in education"    ║
║  - Diverga adapts to your profile automatically                  ║
║                                                                  ║
║  Commands:                                                       ║
║  - /diverga:help     - View all 24 agents                       ║
║  - /diverga:memory   - Memory system commands                    ║
║  - /diverga:setup    - Update your profile anytime               ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

## Lazy Config (Agent-Level)

These settings are NOT asked during setup. Each agent asks when first needed:

| Setting | Agent | When Asked | Storage |
|---------|-------|------------|---------|
| OpenAlex email | G1 (Journal Matcher) | First `journal_search_by_field` call | `.omc/config.json` |
| Citation format | G2 (Publication) | First manuscript generation | `researcher.citation_format` in config |
| Qualitative software | E2 (Coding) | First qualitative coding task | `researcher.qual_software` in config |

**Lazy config prompt template** (for agents to use):

When an agent needs a lazy config value that isn't set yet:
1. Explain WHY the information is needed (1 sentence, tied to the current task)
2. Ask via AskUserQuestion with relevant options
3. Save to `config/diverga-config.json` under the `researcher` object
4. Continue with the task — do NOT restart or re-prompt

Example (G1 first call):
```
"Journal search uses OpenAlex API. Registering your email enables
faster responses (polite pool). This is optional."
→ AskUserQuestion: [Enter email] [Skip]
→ If email: save to .omc/config.json
```

## First-Run Detection

When a Diverga plugin session starts:
1. Check if `~/.claude/plugins/diverga/config/diverga-config.json` exists with `researcher` field
2. If missing → display:
   ```
   Welcome to Diverga! Run /diverga:setup to set up your researcher profile (1 minute).
   ```
3. Do NOT auto-run — only display the suggestion once.

## Config Schema Reference

```json
{
  "version": "11.3.0",
  "researcher": {
    "discipline": "string",
    "experience": "doctoral_student | early_career | faculty",
    "stats_software": ["R", "Python", "SPSS", "Stata", "Mplus"],
    "db_access": ["Scopus", "Web of Science", "PsycINFO", "ERIC", "Semantic Scholar"],
    "qual_software": "NVivo | ATLAS.ti | MAXQDA | Dedoose | manual",
    "citation_format": "APA | Chicago | Vancouver | Harvard"
  },
  "agent_teams": {
    "enabled": "boolean",
    "auto_activate": "boolean"
  }
}
```

Fields are added incrementally:
- `researcher.discipline`, `experience`, `stats_software`, `db_access` — set during `/diverga:setup`
- `researcher.qual_software`, `citation_format` — added by lazy config when relevant agent runs
- `agent_teams` — set during `/diverga:setup` Step 3

## Error Handling

If config directory doesn't exist, create it:
```bash
mkdir -p ~/.claude/plugins/diverga/config
```
