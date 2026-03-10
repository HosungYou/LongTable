# AGENTS.md

> AI-readable documentation for Diverga v11.0.0

## Project Overview

**Diverga** is a Claude Code Skills-based AI research assistant system that breaks free from mode collapse through **Verbalized Sampling (VS) methodology**. It provides context-persistent support for the complete research lifecycle with a focus on **creative, defensible research choices** while ensuring **human decisions remain with humans**.

**Version**: 11.0.0
**Generated**: 2026-03-10
**Repository**: https://github.com/HosungYou/Diverga

---

## Core Philosophy

> "Human decisions remain with humans. AI handles what's beyond human scope."
> "인간이 할 일은 인간이, AI는 인간의 범주를 벗어난 것을 수행"

- **Human-Centered**: AI STOPS at checkpoints and WAITS for human approval
- **No Bypass**: Checkpoints cannot be skipped or auto-approved
- **VS Methodology**: Prevents mode collapse through creative alternatives
- **Context Persistence**: Eliminates re-explanation burden

---

## Architecture

### Directory Structure

```
Diverga/
├── agents/              # 24 agent definitions (Task tool)
│   ├── a1.md           # → Task(subagent_type="diverga:a1", ...)
│   ├── a2.md
│   └── ...
├── skills/              # Skill definitions (Skill tool)
│   ├── research-coordinator/
│   ├── setup/
│   └── ...
├── .claude-plugin/
│   └── plugin.json      # Plugin registration
├── CLAUDE.md            # Project documentation
├── AGENTS.md            # This file
└── README.md            # Public overview
```

---

## Human Checkpoint System

### Checkpoint Levels

| Level | Behavior |
|-------|----------|
| **REQUIRED** | System STOPS - Cannot proceed without explicit approval |
| **RECOMMENDED** | System PAUSES - Strongly suggests approval |
| **OPTIONAL** | System ASKS - Defaults available if skipped |

### Required Checkpoints

| Checkpoint | When | Agent | What Happens |
|------------|------|-------|--------------|
| CP_RESEARCH_DIRECTION | Research question finalized | A1 | Present VS options, WAIT for selection |
| CP_PARADIGM_SELECTION | Methodology approach | A5 | Ask Quantitative/Qualitative/Mixed |
| CP_THEORY_SELECTION | Framework chosen | A2 | Present alternatives with T-Scores |
| CP_METHODOLOGY_APPROVAL | Design complete | C1/C2/C3 | Detailed review required |

### Checkpoint Behavior Protocol

```
When AI reaches a checkpoint:
1. STOP immediately
2. Present options with VS alternatives
3. WAIT for explicit human approval
4. DO NOT proceed until approval received
5. DO NOT assume approval based on context
```

---

## Agent Registry (v11.0.0)

### 24 Specialized Research Agents in 9 Categories

<!-- GENERATED:START -->
| ID | Display Name | Category | Tier | Model | VS Level | Key Triggers |
|----|-------------|----------|------|-------|----------|-------------|
| A1 | Research Question Refiner | A: Research Foundation | HIGH | opus | Enhanced | research question, PICO, SPIDER |
| A2 | Theory & Critique Architect | A: Research Foundation | HIGH | opus | Full | theoretical framework, conceptual model, hypothesis derivation |
| A5 | Paradigm Advisor | A: Research Foundation | HIGH | opus | Full | paradigm, ontology, epistemology |
| B1 | Literature Scout | B: Literature & Evidence | MEDIUM | sonnet | Full | literature review, PRISMA, systematic review |
| B2 | Quality Appraiser | B: Literature & Evidence | MEDIUM | sonnet | Enhanced | quality appraisal, RoB, GRADE |
| C1 | Quantitative Design & Sampling | C: Study Design | HIGH | opus | Enhanced | RCT, quasi-experimental, experimental design |
| C2 | Qualitative Design (Ethnography/AR) | C: Study Design | HIGH | opus | Full | phenomenology, grounded theory, case study |
| C3 | Mixed Methods Design | C: Study Design | HIGH | opus | Full | mixed methods, sequential design, convergent |
| C5 | Meta-Analysis Master | C: Study Design | HIGH | opus | Full | meta-analysis, pooled effect, heterogeneity |
| D2 | Data Collection Specialist | D: Data Collection | MEDIUM | sonnet | Enhanced | interview, focus group, interview protocol |
| D4 | Instrument Developer | D: Data Collection | HIGH | opus | Enhanced | instrument, measurement, scale development |
| E1 | Quantitative Analysis & Code Gen | E: Analysis | HIGH | opus | Full | statistical analysis, ANOVA, regression |
| E2 | Qualitative Coding | E: Analysis | HIGH | opus | Full | qualitative coding, thematic analysis, grounded theory coding |
| E3 | Mixed Methods Integration | E: Analysis | HIGH | opus | Full | integration, joint display, mixed methods analysis |
| F5 | Humanization Verifier | F: Quality & Validation | LOW | haiku | Light | verify humanization, check transformation, validate changes |
| G1 | Journal Matcher | G: Publication & Communication | MEDIUM | sonnet | Light | journal, where to publish, target journal |
| G2 | Publication Specialist | G: Publication & Communication | MEDIUM | sonnet | Enhanced | abstract, plain language, academic writing |
| G5 | Academic Style Auditor | G: Publication & Communication | MEDIUM | sonnet | Light | AI pattern, check AI writing, style audit |
| G6 | Academic Style Humanizer | G: Publication & Communication | HIGH | opus | Enhanced | humanize, humanization, natural writing |
| I0 | SR Pipeline Orchestrator | I: Systematic Review Automation | HIGH | opus | Enhanced | systematic review, PRISMA |
| I1 | Paper Retrieval | I: Systematic Review Automation | MEDIUM | sonnet | Light | fetch papers, retrieve papers, database search |
| I2 | Screening Assistant | I: Systematic Review Automation | MEDIUM | sonnet | Light | screen papers, inclusion criteria, AI screening |
| I3 | RAG Builder | I: Systematic Review Automation | LOW | haiku | Light | build RAG, vector database, PDF download |
| X1 | Research Guardian | X: Cross-Cutting | MEDIUM | sonnet | Full | research integrity, guardian, oversight |
<!-- GENERATED:END -->

---

### Category A: Research Foundation (3 agents)

Establishes theoretical and methodological foundations for research projects.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| A1 | research-question-refiner | FINER/PICO/SPIDER formulation | HIGH | opus | CP_RESEARCH_DIRECTION |
| A2 | theory-and-critique-architect | Theory selection, critique, ethics, visualization with VS | HIGH | opus | CP_THEORY_SELECTION |
| A5 | paradigm-worldview-advisor | Ontology, epistemology, paradigm guidance | HIGH | opus | CP_PARADIGM_SELECTION |

**Paradigm Coverage**: All paradigms

---

### Category B: Literature & Evidence (2 agents)

Systematic evidence gathering, synthesis, and quality appraisal.

| ID | Agent | Purpose | Tier | Model |
|----|-------|---------|------|-------|
| B1 | literature-scout | PRISMA workflows, qualitative search | MEDIUM | sonnet |
| B2 | quality-appraiser | Risk of Bias (RoB), GRADE assessment | MEDIUM | sonnet |

**Paradigm Coverage**: Quantitative, Qualitative (meta-synthesis), Mixed

---

### Category C: Study Design (4 agents)

Paradigm-specific design consultation and meta-analysis orchestration.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| C1 | quantitative-design-and-sampling | RCTs, quasi-experimental, surveys, sampling | HIGH | opus | CP_METHODOLOGY_APPROVAL |
| C2 | qualitative-design | Phenomenology, GT, case study, ethnography, action research | HIGH | opus | CP_METHODOLOGY_APPROVAL |
| C3 | mixed-methods-design | Sequential, convergent designs | HIGH | opus | CP_METHODOLOGY_APPROVAL |
| C5 | meta-analysis-master | Multi-gate validation, workflow orchestration, data integrity | HIGH | opus | CP_META_GATE |

**Paradigm Coverage**: Paradigm-specific (C1, C2, C3), Meta-analysis (C5)

#### C5 Meta-Analysis System

C5 integrates the former C6 (Data Integrity Guard) and C7 (Error Prevention Engine) functions:

- Multi-gate validation (4 gates)
- Phase-based orchestration (7 phases)
- ES hierarchy enforcement
- Hedges' g calculation and SD recovery
- Pattern detection and anomaly alerts

**Meta-Analysis Checkpoints**:
| Checkpoint | Level | When |
|------------|-------|------|
| `CP_META_GATE` | REQUIRED | Any gate failure requiring decision |
| `META_TIER3_REVIEW` | REQUIRED | Data completeness < 40% |
| `META_ANOMALY_REVIEW` | RECOMMENDED | \|g\| > 3.0 detected |
| `META_PRETEST_CONFIRM` | RECOMMENDED | Ambiguous pre/post classification |

---

### Category D: Data Collection (2 agents)

Data collection strategy and instrument development.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| D2 | data-collection-specialist | Interview protocols, focus groups, observation, transcription | MEDIUM | sonnet | - |
| D4 | instrument-developer | Scale construction, validity testing | HIGH | opus | CP_METHODOLOGY_APPROVAL |

**Paradigm Coverage**: Quantitative (D4), Qualitative (D2), Mixed (all)

---

### Category E: Analysis (3 agents)

Paradigm-appropriate analytical strategies and implementation.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| E1 | quantitative-analysis-and-code-gen | Statistical analysis, assumptions, R/Python/SPSS code | HIGH | opus | CP_ANALYSIS_PLAN |
| E2 | qualitative-coding | Thematic, GT coding, NVivo | HIGH | opus | - |
| E3 | mixed-methods-integration | Joint displays, meta-inferences | HIGH | opus | CP_INTEGRATION_STRATEGY |

**Paradigm Coverage**: Paradigm-specific (E1, E2, E3)

---

### Category F: Quality & Validation (1 agent)

Humanization verification for transformed academic text.

| ID | Agent | Purpose | Tier | Model |
|----|-------|---------|------|-------|
| F5 | humanization-verifier | Verify transformation integrity, citation/statistics preservation | LOW | haiku |

**Paradigm Coverage**: All paradigms (humanization pipeline)

---

### Category G: Publication & Communication (4 agents)

Academic writing, dissemination, and humanization pipeline.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| G1 | journal-matcher | Target journal selection, fit | MEDIUM | sonnet | - |
| G2 | publication-specialist | Plain language, audience adaptation, academic writing | MEDIUM | sonnet | - |
| G5 | academic-style-auditor | AI pattern detection (24 categories), probability scoring | MEDIUM | sonnet | CP_HUMANIZATION_REVIEW |
| G6 | academic-style-humanizer | Transform AI patterns to natural academic prose | HIGH | opus | CP_HUMANIZATION_VERIFY |

**Paradigm Coverage**: All paradigms, **Humanization Pipeline (G5 -> G6 -> F5)**

---

### Category I: Systematic Review Automation (4 agents)

Automated PRISMA 2020 systematic literature review pipeline.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| I0 | sr-pipeline-orchestrator | Pipeline coordination, checkpoint management | HIGH | opus | All SCH_* checkpoints |
| I1 | paper-retrieval | Multi-database paper fetching (SS, OA, arXiv) | MEDIUM | sonnet | SCH_DATABASE_SELECTION |
| I2 | screening-assistant | AI-PRISMA 6-dimension screening (Groq LLM) | MEDIUM | sonnet | SCH_SCREENING_CRITERIA |
| I3 | rag-builder | Vector database construction (local, $0 cost) | LOW | haiku | SCH_RAG_READINESS |

**Paradigm Coverage**: Systematic Review, Meta-Analysis

---

### Category X: Cross-Cutting (1 agent)

Research integrity oversight across all research phases.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| X1 | research-guardian | Research integrity, ethics oversight, quality assurance | MEDIUM | sonnet | - |

**Paradigm Coverage**: All paradigms

---

## Model Routing (v11.0.0)

| Tier | Model | Count | Agents |
|------|-------|-------|--------|
| HIGH | Opus | 13 | A1, A2, A5, C1, C2, C3, C5, D4, E1, E2, E3, G6, I0 |
| MEDIUM | Sonnet | 9 | B1, B2, D2, G1, G2, G5, I1, I2, X1 |
| LOW | Haiku | 2 | F5, I3 |

**Total: 24 agents** (Opus: 13, Sonnet: 9, Haiku: 2)

---

## VS-Research Methodology

**Purpose**: Prevent mode collapse (AI always recommending the same thing)

### T-Score (Typicality Score)

| T-Score | Label | Meaning |
|---------|-------|---------|
| >= 0.7 | Common | Highly typical, safe but limited novelty |
| 0.4-0.7 | Moderate | Balanced risk-novelty |
| 0.2-0.4 | Innovative | Novel, requires strong justification |
| < 0.2 | Experimental | Highly novel, high risk/reward |

### 3-Stage VS Process with Human Decision

```
Stage 1: Context & Modal Identification
  - Identify "obvious" recommendations (T > 0.8)

Stage 2: Divergent Exploration
  - Direction A (T~0.6): Safe but differentiated
  - Direction B (T~0.4): Balanced novelty
  - Direction C (T<0.3): Innovative/experimental

Stage 3: Human Selection (CHECKPOINT)
  - Present ALL options with T-Scores
  - WAIT for human decision
  - Execute ONLY selected direction
```

---

## Agent Dependencies

### Sequential Chains (Must Wait)

```
A1-research-question-refiner
  -> A2-theory-and-critique-architect
      -> C1/C2/C3-design-consultants
          -> E1/E2-analysis
```

### Parallel Execution Groups (Can Run Together)

| Group | Agents | Condition |
|-------|--------|-----------|
| Planning | A2 + A5 | After CP_RESEARCH_DIRECTION |
| Literature | B1 + B2 | Independent |
| Quality | G5 (audit) | After writing |
| Publication | G1 + G2 | After quality review |

---

## AI Orchestration Guidelines

### 1. Detecting Research Paradigm

**ALWAYS determine paradigm FIRST before agent selection.**

| Indicator | Paradigm |
|-----------|----------|
| RCT, effect size, power analysis, regression | Quantitative |
| Phenomenology, lived experience, saturation | Qualitative |
| Sequential, convergent, joint display | Mixed Methods |

**If unclear**, invoke **A5-paradigm-advisor** FIRST.

### 2. Agent Invocation Pattern

```python
# Single agent with checkpoint
Task(
    subagent_type="diverga:a1",
    model="opus",
    prompt="Refine research question using FINER/PICO/SPIDER..."
)

# Parallel execution (independent tasks)
Task(subagent_type="diverga:b1", model="sonnet", prompt="Literature search...")
Task(subagent_type="diverga:b2", model="sonnet", prompt="Quality appraisal...")
```

### 3. State Persistence

**Always update** `.research/project-state.yaml` after:
- Paradigm selection (A5)
- Research question finalization (A1)
- Design approval (C1/C2/C3)
- Analysis completion (E1/E2)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `agents/*.md` | Agent definitions (24 agents) |
| `skills/*/SKILL.md` | Skill definitions |
| `.claude-plugin/plugin.json` | Plugin registration |
| `CLAUDE.md` | Project documentation |
| `AGENTS.md` | This file |

---

*This file enables AI assistants to understand Diverga v11.0.0's architecture and operate effectively within its human-centered design.*
