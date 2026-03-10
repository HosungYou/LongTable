# AGENTS.md

> AI-readable documentation for Diverga v8.4.0 (Cross-Platform Migration)

## Project Overview

**Diverga** is a Claude Code Skills-based AI research assistant system that breaks free from mode collapse through **Verbalized Sampling (VS) methodology**. It provides context-persistent support for the complete research lifecycle with a focus on **creative, defensible research choices** while ensuring **human decisions remain with humans**.

**Version**: 8.4.0 (Cross-Platform Migration)
**Generated**: 2026-02-12
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

## v6.0 Changes from v5.0

| Feature | v5.0 (Sisyphus) | v6.0 (Human-Centered) |
|---------|-----------------|----------------------|
| **Sisyphus Protocol** | "Work never stops" | REMOVED |
| **Iron Law** | "agent OR checkpoint" | REMOVED |
| **OMC Autonomous Modes** | ralph/ultrawork/ecomode | REMOVED |
| **Human Checkpoints** | Could be bypassed | MANDATORY |
| **Agent Naming** | Numbered (01-21) | Category-based (A1-I3) |
| **Agent Count** | 27 agents | 44 agents (v8.4.0) |
| **State Location** | `.omc/` | `.claude/` |

---

## Architecture

### Directory Structure

```
Diverga/
├── .claude/
│   ├── skills/
│   │   ├── research-coordinator/          # Master coordinator
│   │   │   └── SKILL.md                   # Main entry point
│   │   ├── research-orchestrator/         # Agent orchestration
│   │   │   └── SKILL.md
│   │   └── research-agents/               # 44 specialized agents
│   │       ├── A1-research-question-refiner/
│   │       ├── A2-theoretical-framework-architect/
│   │       ├── ...
│   │       ├── H2-action-research-facilitator/
│   │       ├── I0-review-pipeline-orchestrator/
│   │       ├── I1-paper-retrieval-agent/
│   │       ├── I2-screening-assistant/
│   │       └── I3-rag-builder/
│   ├── config/
│   │   └── research-coordinator-routing.yaml
│   ├── checkpoints/
│   │   ├── checkpoint-definitions.yaml
│   │   ├── checkpoint-handler.md
│   │   └── parallel-execution-rules.yaml
│   └── state/
│       └── checkpoints.json               # Runtime state
├── .research/
│   ├── project-state.yaml                 # Active project context
│   └── decision-log.yaml                  # Human decision audit trail
├── CLAUDE.md                              # Project documentation
├── AGENTS.md                              # This file
└── README.md                              # Public overview
```

---

## Human Checkpoint System (v6.0 Core Feature)

### Checkpoint Levels

| Level | Icon | Behavior |
|-------|------|----------|
| **REQUIRED** | 🔴 | System STOPS - Cannot proceed without explicit approval |
| **RECOMMENDED** | 🟠 | System PAUSES - Strongly suggests approval |
| **OPTIONAL** | 🟡 | System ASKS - Defaults available if skipped |

### Required Checkpoints (🔴 MANDATORY)

| Checkpoint | When | Agent | What Happens |
|------------|------|-------|--------------|
| CP_RESEARCH_DIRECTION | Research question finalized | A1 | Present VS options, WAIT for selection |
| CP_PARADIGM_SELECTION | Methodology approach | A5 | Ask Quantitative/Qualitative/Mixed |
| CP_THEORY_SELECTION | Framework chosen | A2 | Present alternatives with T-Scores |
| CP_METHODOLOGY_APPROVAL | Design complete | C1/C2/C3 | Detailed review required |

### Checkpoint Behavior Protocol

```
┌────────────────────────────────────────────────────────────────┐
│                   CHECKPOINT PROTOCOL                          │
│                                                                │
│   When AI reaches a checkpoint:                                │
│                                                                │
│   1. STOP immediately                                          │
│   2. Present options with VS alternatives                      │
│   3. WAIT for explicit human approval                          │
│   4. DO NOT proceed until approval received                    │
│   5. DO NOT assume approval based on context                   │
│                                                                │
│   [X] NEVER: "Proceeding with..." without asking              │
│   [OK] ALWAYS: "Which direction would you like to proceed?"   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Checkpoint State Storage

Location: `.research/checkpoints.yaml` (v8.2+), `.research/decision-log.yaml`

```json
{
  "session_id": "...",
  "checkpoints": [
    {
      "id": "CP_RESEARCH_DIRECTION",
      "timestamp": "2026-01-25T...",
      "status": "approved",
      "human_decision": "Approved research question B",
      "agent": "A1-research-question-refiner"
    }
  ]
}
```

---

## Agent Registry (v8.4.0)

### 44 Specialized Research Agents in 9 Categories

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
| F5 | Humanization Verifier | F: Quality & Validation | MEDIUM | sonnet | Full | verify humanization, check transformation, validate changes |
| G1 | Journal Matcher | G: Publication & Communication | MEDIUM | sonnet | Light | journal, where to publish, target journal |
| G2 | Publication Specialist | G: Publication & Communication | MEDIUM | sonnet | Enhanced | abstract, plain language, academic writing |
| G5 | Academic Style Auditor | G: Publication & Communication | MEDIUM | sonnet | Light | AI pattern, check AI writing, style audit |
| G6 | Academic Style Humanizer | G: Publication & Communication | HIGH | opus | Enhanced | humanize, humanization, natural writing |
| I0 | SR Pipeline Orchestrator | I: Systematic Review Automation | HIGH | opus | Enhanced | systematic review, PRISMA, 체계적 문헌고찰 |
| I1 | Paper Retrieval | I: Systematic Review Automation | MEDIUM | sonnet | Light | fetch papers, retrieve papers, database search |
| I2 | Screening Assistant | I: Systematic Review Automation | MEDIUM | sonnet | Light | screen papers, inclusion criteria, AI screening |
| I3 | RAG Builder | I: Systematic Review Automation | LOW | haiku | Light | build RAG, vector database, PDF download |
| X1 | Research Guardian | X: Cross-Cutting | HIGH | opus | Full | research integrity, guardian, oversight |
<!-- GENERATED:END -->


Diverga v8.4.0 uses **category-based naming** (A1-I3) for all agents, organized into 9 functional categories.

---

### Category A: Foundation (6 agents)

Establishes theoretical and ethical foundations for research projects.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| A1 | research-question-refiner | FINER/PICO/SPIDER formulation | HIGH | opus | 🔴 CP_RESEARCH_DIRECTION |
| A2 | theoretical-framework-architect | Theory selection with VS methodology | HIGH | opus | 🔴 CP_THEORY_SELECTION |
| A3 | devils-advocate | Critical review, Reviewer 2 simulation | HIGH | opus | - |
| A4 | research-ethics-advisor | IRB protocols, ethical considerations | MEDIUM | sonnet | 🔴 CP_METHODOLOGY_APPROVAL |
| A5 | paradigm-worldview-advisor | Ontology, epistemology, paradigm guidance | HIGH | opus | 🔴 CP_PARADIGM_SELECTION |
| A6 | conceptual-framework-visualizer | Visual framework design, diagrams | MEDIUM | sonnet | 🟡 CP_VISUALIZATION_PREFERENCE |

**Paradigm Coverage**: All paradigms

---

### Category B: Evidence (5 agents)

Systematic evidence gathering, synthesis, quality appraisal, and parallel document processing.

| ID | Agent | Purpose | Tier | Model |
|----|-------|---------|------|-------|
| B1 | systematic-literature-scout | PRISMA workflows, qualitative search | MEDIUM | sonnet |
| B2 | evidence-quality-appraiser | Risk of Bias (RoB), GRADE assessment | MEDIUM | sonnet |
| B3 | effect-size-extractor | Calculate/convert effect sizes | LOW | haiku |
| B4 | research-radar | Monitor new publications, trend alerts | LOW | haiku |
| **B5** | **parallel-document-processor** | **High-throughput PDF/document reading with distributed workload** | **HIGH** | **opus** |

**Paradigm Coverage**: Quantitative (B3), Qualitative (B1 meta-synthesis), Mixed (all), **Document Processing (B5)**

---

### Category C: Design & Meta-Analysis (7 agents)

Paradigm-specific design consultation and meta-analysis orchestration.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| C1 | quantitative-design-consultant | RCTs, quasi-experimental, surveys | HIGH | opus | 🔴 CP_METHODOLOGY_APPROVAL |
| C2 | qualitative-design-consultant | Phenomenology, GT, case study | HIGH | opus | 🔴 CP_METHODOLOGY_APPROVAL |
| C3 | mixed-methods-design-consultant | Sequential, convergent designs | HIGH | opus | 🔴 CP_METHODOLOGY_APPROVAL |
| C4 | experimental-materials-developer | Treatment protocols, manipulation checks | MEDIUM | sonnet | - |
| **C5** | **meta-analysis-master** | **Multi-gate validation, workflow orchestration** | **HIGH** | **opus** | **🔴 CP_META_GATE** |
| **C6** | **data-integrity-guard** | **Data completeness, Hedges' g calculation, SD recovery** | **MEDIUM** | **sonnet** | - |
| **C7** | **error-prevention-engine** | **Pattern detection, anomaly alerts, advisory** | **MEDIUM** | **sonnet** | - |

**Paradigm Coverage**: Paradigm-specific (C1, C2, C3), Experimental focus (C4), **Meta-analysis focus (C5, C6, C7)**

#### C5/C6/C7 Meta-Analysis System (v6.3 New)

Based on V7 GenAI meta-analysis lessons learned:

```
┌─────────────────────────────────────────────────────────────┐
│                 META-ANALYSIS AGENT SYSTEM                   │
├─────────────────────────────────────────────────────────────┤
│ C5-MetaAnalysisMaster (Orchestrator - DECISION AUTHORITY)   │
│   └─ Multi-gate validation (4 gates)                        │
│   └─ Phase-based orchestration (7 phases)                   │
│   └─ ES hierarchy enforcement                               │
│                                                             │
│ C6-DataIntegrityGuard (Service Provider)                    │
│   └─ Hedges' g calculation                                  │
│   └─ SD recovery strategies (4 levels)                      │
│   └─ Version tracking                                       │
│                                                             │
│ C7-ErrorPreventionEngine (Advisory)                         │
│   └─ Pattern detection (pre-test, anomaly)                  │
│   └─ Error taxonomy (5 categories)                          │
│   └─ Pre-extraction warnings                                │
└─────────────────────────────────────────────────────────────┘
```

**Multi-Gate Validation (C5)**:
- Gate 1: Extraction Validation
- Gate 2: Classification Validation (ES Hierarchy)
- Gate 3: Statistical Validation (Hedges' g)
- Gate 4: Independence Validation (Pre-test exclusion)

**New Checkpoints**:
| Checkpoint | Level | When |
|------------|-------|------|
| `CP_META_GATE` | 🔴 | Any gate failure requiring decision |
| `META_TIER3_REVIEW` | 🔴 | Data completeness < 40% |
| `META_ANOMALY_REVIEW` | 🟠 | \|g\| > 3.0 detected |
| `META_PRETEST_CONFIRM` | 🟠 | Ambiguous pre/post classification |

---

### Category D: Data Collection (4 agents)

Comprehensive data collection strategy and instrument development.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| D1 | sampling-strategy-advisor | Probability, purposive sampling | MEDIUM | sonnet | - |
| D2 | interview-focus-group-specialist | Interview protocols, transcription | MEDIUM | sonnet | - |
| D3 | observation-protocol-designer | Field notes, video analysis | LOW | haiku | - |
| D4 | measurement-instrument-developer | Scale construction, validity testing | HIGH | opus | 🔴 CP_METHODOLOGY_APPROVAL |

**Paradigm Coverage**: Quantitative (D1, D4), Qualitative (D2, D3), Mixed (all)

---

### Category E: Analysis (5 agents)

Paradigm-appropriate analytical strategies and implementation.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| E1 | quantitative-analysis-guide | Statistical analysis, assumptions | HIGH | opus | 🟠 CP_ANALYSIS_PLAN |
| E2 | qualitative-coding-specialist | Thematic, GT coding, NVivo | HIGH | opus | - |
| E3 | mixed-methods-integration | Joint displays, meta-inferences | HIGH | opus | 🟠 CP_INTEGRATION_STRATEGY |
| E4 | analysis-code-generator | R, Python, SPSS, NVivo scripts | LOW | haiku | - |
| E5 | sensitivity-analysis-designer | Robustness checks, alternative specs | MEDIUM | sonnet | - |

**Paradigm Coverage**: Paradigm-specific (E1, E2, E3), All (E4, E5)

---

### Category F: Quality (5 agents)

Methodological rigor, reproducibility, bias mitigation, and humanization verification.

| ID | Agent | Purpose | Tier | Model |
|----|-------|---------|------|-------|
| F1 | internal-consistency-checker | Logic verification, alignment | LOW | haiku |
| F2 | checklist-manager | PRISMA, CONSORT, COREQ standards | LOW | haiku |
| F3 | reproducibility-auditor | Open Science Framework (OSF) | MEDIUM | sonnet |
| F4 | bias-trustworthiness-detector | Bias detection, trustworthiness | MEDIUM | sonnet |
| **F5** | **humanization-verifier** | **Verify transformation integrity, citation/statistics preservation** | **LOW** | **haiku** |

**Paradigm Coverage**: All paradigms (F4 adapts to paradigm), **Humanization (F5)**

---

### Category G: Communication (6 agents)

Academic writing, dissemination, peer review response, and humanization pipeline.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| G1 | journal-matcher | Target journal selection, fit | MEDIUM | sonnet | - |
| G2 | academic-communicator | Plain language, audience adaptation | MEDIUM | sonnet | - |
| G3 | peer-review-strategist | Response to reviewers, rebuttals | HIGH | opus | 🟠 CP_RESPONSE_APPROVAL |
| G4 | preregistration-composer | OSF, AsPredicted registration | MEDIUM | sonnet | 🟠 CP_PREREGISTRATION_APPROVAL |
| **G5** | **academic-style-auditor** | **AI pattern detection (24 categories), probability scoring** | **MEDIUM** | **sonnet** | 🟠 CP_HUMANIZATION_REVIEW |
| **G6** | **academic-style-humanizer** | **Transform AI patterns to natural academic prose** | **HIGH** | **opus** | 🟡 CP_HUMANIZATION_VERIFY |

**Paradigm Coverage**: All paradigms, **Humanization Pipeline (G5 → G6 → F5)**

---

### Category H: Specialized (2 agents)

Advanced qualitative and participatory research methodologies.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| H1 | ethnographic-research-advisor | Fieldwork, thick description | HIGH | opus | 🔴 CP_METHODOLOGY_APPROVAL |
| H2 | action-research-facilitator | PAR, CBPR, action cycles | HIGH | opus | 🔴 CP_METHODOLOGY_APPROVAL |

**Paradigm Coverage**: Qualitative/Participatory paradigms

---

### Category I: Systematic Review Automation (4 agents) - NEW v6.5

Automated PRISMA 2020 systematic literature review pipeline.

| ID | Agent | Purpose | Tier | Model | Checkpoint |
|----|-------|---------|------|-------|------------|
| **I0** | **review-pipeline-orchestrator** | **Pipeline coordination, checkpoint management** | **HIGH** | **opus** | **🔴 All SCH_* checkpoints** |
| I1 | paper-retrieval-agent | Multi-database paper fetching (SS, OA, arXiv) | MEDIUM | sonnet | 🔴 SCH_DATABASE_SELECTION |
| I2 | screening-assistant | AI-PRISMA 6-dimension screening (Groq LLM) | MEDIUM | sonnet | 🔴 SCH_SCREENING_CRITERIA |
| I3 | rag-builder | Vector database construction (local, $0 cost) | LOW | haiku | 🟠 SCH_RAG_READINESS |

**Paradigm Coverage**: Systematic Review, Meta-Analysis

#### Category I Systematic Review System (v6.5 New)

Systematic review automation pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│           CATEGORY I: SYSTEMATIC REVIEW AUTOMATION            │
├─────────────────────────────────────────────────────────────┤
│ I0-ReviewPipelineOrchestrator (Conductor - DECISION AUTHORITY)│
│   └─ Pipeline coordination (7 stages)                       │
│   └─ Checkpoint enforcement (4 checkpoints)                 │
│   └─ Cost optimization (Groq → 100x cheaper)               │
│                                                             │
│ I1-PaperRetrievalAgent (Service Provider)                   │
│   └─ Semantic Scholar, OpenAlex, arXiv                      │
│   └─ Scopus, Web of Science (institutional)                 │
│   └─ Rate limiting, deduplication                           │
│                                                             │
│ I2-ScreeningAssistant (Service Provider)                    │
│   └─ AI-PRISMA 6-dimension scoring                          │
│   └─ Groq LLM (100x cheaper than Claude)                    │
│   └─ knowledge_repository (50%) / systematic_review (90%)   │
│                                                             │
│ I3-RAGBuilder (Service Provider)                            │
│   └─ PDF download with retry                                │
│   └─ Token-based chunking (tiktoken)                        │
│   └─ Local embeddings + ChromaDB ($0 cost)                  │
└─────────────────────────────────────────────────────────────┘
```

**New Checkpoints**:
| Checkpoint | Level | When |
|------------|-------|------|
| `SCH_DATABASE_SELECTION` | 🔴 | Database choice before retrieval |
| `SCH_SCREENING_CRITERIA` | 🔴 | PRISMA criteria before screening |
| `SCH_RAG_READINESS` | 🟠 | RAG system ready for queries |
| `SCH_PRISMA_GENERATION` | 🟡 | PRISMA diagram generation |

**Cost Optimization**:
| Task | Provider | Cost/100 papers |
|------|----------|-----------------|
| Screening | Groq (llama-3.3-70b) | $0.01 |
| RAG Queries | Groq | $0.02 |
| Embeddings | Local (MiniLM) | $0 |
| **Total 500-paper review** | **Mixed** | **~$0.07** |

---

## Model Routing (v8.4.0)

| Tier | Model | Count | Agents |
|------|-------|-------|--------|
| HIGH | Opus | 17 | A1, A2, A3, A5, **B5**, C1, C2, C3, **C5**, D4, E1, E2, E3, G3, **G6**, H1, H2, **I0** |
| MEDIUM | Sonnet | 18 | A4, A6, B1, B2, C4, **C6**, **C7**, D1, D2, E5, F3, F4, G1, G2, G4, **G5**, **I1**, **I2** |
| LOW | Haiku | 9 | B3, B4, D3, E4, F1, F2, **F5**, **I3** |

**Total: 44 agents** (40 core + 4 Category I)

### Temperature Settings by Category

| Category | Temperature | Rationale |
|----------|-------------|-----------|
| A (Foundation) | 0.3-0.5 | Strategic with creativity for alternatives |
| B (Evidence) | 0.1-0.3 | Precision in evidence synthesis |
| C (Design) | 0.5-0.7 | Balance rigor with design creativity |
| D (Collection) | 0.3-0.5 | Structured but adaptive protocols |
| E (Analysis) | 0.1-0.3 | Analytical precision required |
| F (Quality) | 0.1 | Maximum consistency for validation |
| G (Communication) | 0.5-0.7 | Creative communication |
| H (Specialized) | 0.7-0.9 | High contextual sensitivity |

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
  └─ Identify "obvious" recommendations (T > 0.8)

Stage 2: Divergent Exploration
  ├─ Direction A (T≈0.6): Safe but differentiated
  ├─ Direction B (T≈0.4): Balanced novelty ⭐
  └─ Direction C (T<0.3): Innovative/experimental

Stage 3: Human Selection (🔴 CHECKPOINT)
  ├─ Present ALL options with T-Scores
  ├─ WAIT for human decision
  └─ Execute ONLY selected direction
```

### VS Example

```
❌ WITHOUT VS (Mode Collapse):
   User: "Help me choose a theoretical framework for AI adoption study"
   AI: "I recommend Technology Acceptance Model (TAM)."
   (Same answer every time, T=0.92)

✅ WITH VS (Diverga):
   User: "Help me choose a theoretical framework for AI adoption study"

   🔴 CHECKPOINT: CP_THEORY_SELECTION

   Diverga: "Let me analyze options across the typicality spectrum:

   [Modal Awareness] TAM (T=0.92) and UTAUT (T=0.85) are predictable choices.

   Recommended Options:
   • Direction A (T≈0.6): Self-Determination Theory × TAM integration
   • Direction B (T≈0.4): Cognitive Load Theory + Adaptive Ecosystem ⭐
   • Direction C (T≈0.2): Neuroplasticity-based technology learning

   Which direction would you like to proceed?"
   (WAITS for human selection)
```

---

## Paradigm Affinity Matrix

### Quantitative Research

**Primary Agents**: A1-A4, B2, B3, C1, C4, D1, D4, E1, E4, E5, F1-F4, G1-G4

**Typical Workflow**:
1. A1 (PICO question) → A2 (Framework) → 🔴 CP_THEORY_SELECTION
2. C1 (Design) → 🔴 CP_METHODOLOGY_APPROVAL → D1 (Sampling) → D4 (Measurement)
3. E1 (Analysis) → 🟠 CP_ANALYSIS_PLAN → E4 (Code) → E5 (Sensitivity)
4. F2 (CONSORT/STROBE) → G1 (Journal)

### Qualitative Research

**Primary Agents**: A1-A6, B1, B2, C2, D1-D3, E2, F2, F4, G1-G4, H1-H2

**Typical Workflow**:
1. A1 (SPIDER question) → A5 (Paradigm) → 🔴 CP_PARADIGM_SELECTION
2. A2 (Framework) → 🔴 CP_THEORY_SELECTION
3. C2 (Design) → 🔴 CP_METHODOLOGY_APPROVAL → D2/D3 (Collection)
4. E2 (Coding) → F4 (Trustworthiness) → F2 (COREQ)

### Mixed Methods Research

**Primary Agents**: ALL agents, especially C3, E3

**Typical Workflow**:
1. A1 → A5 → A2 → 🔴 CP_THEORY_SELECTION
2. C3 (Mixed Design) → 🔴 CP_METHODOLOGY_APPROVAL
3. Sequential: QUAN (C1, E1) → QUAL (C2, E2) → E3 (Integration) → 🟠 CP_INTEGRATION_STRATEGY
4. F2 (Mixed Methods Standards) → G1 (Journal)

---

## Agent Dependencies

### Sequential Chains (Must Wait)

```
A1-research-question-refiner
  └─→ A2-theoretical-framework-architect
      └─→ C1/C2/C3-design-consultants
          └─→ E1/E2-analysis-guides
```

### Parallel Execution Groups (Can Run Together)

| Group | Agents | Condition |
|-------|--------|-----------|
| Planning | A2 + A3 | After CP_RESEARCH_DIRECTION |
| Literature | B1 + B2 + B4 | Independent |
| Quality | F1 + F2 + F3 + F4 | After analysis |
| Publication | G1 + G2 + G4 | After quality review |

---

## AI Orchestration Guidelines (v6.0)

### 1. Detecting Research Paradigm

**ALWAYS determine paradigm FIRST before agent selection.**

| Indicator | Paradigm |
|-----------|----------|
| RCT, effect size, power analysis, regression | Quantitative |
| Phenomenology, lived experience, saturation | Qualitative |
| Sequential, convergent, joint display | Mixed Methods |
| Fieldwork, thick description, culture | Ethnographic |
| Participatory, action cycles, CBPR | Action Research |

**If unclear**, invoke **A5-paradigm-worldview-advisor** FIRST.

### 2. Checkpoint Enforcement

**CRITICAL: v6.0 removes all bypass mechanisms.**

When reaching ANY checkpoint:
1. **STOP** immediately
2. **PRESENT** options with VS alternatives
3. **WAIT** for explicit human approval
4. **DO NOT** proceed until approval received
5. **DO NOT** assume approval based on context

### 3. Agent Invocation Pattern

```python
# Single agent with checkpoint
Task(
    subagent_type="general-purpose",
    description="A1: Research question refinement",
    prompt="""
    [Diverga Agent: A1-research-question-refiner]

    Context: {user_context}

    Task:
    1. Analyze research topic using FINER/PICO/SPIDER
    2. Generate 3 research question options with T-Scores
    3. Present options to user

    🔴 CHECKPOINT: CP_RESEARCH_DIRECTION
    WAIT for human selection before proceeding.
    """
)
```

### 4. Parallel vs. Sequential Execution

**Parallel** (multiple Tasks in ONE message):
```
[Task: B1-systematic-literature-scout] + [Task: B4-research-radar]
```

**Sequential** (wait for completion):
```
[Task: C1-quantitative-design-consultant] → [WAIT] → [Task: D4-measurement]
```

### 5. State Persistence

**Always update** `.research/project-state.yaml` after:
- Paradigm selection (A5)
- Research question finalization (A1)
- Design approval (C1/C2/C3)
- Analysis completion (E1/E2)

```yaml
project:
  paradigm: "Qualitative - Phenomenology"
  research_question: "What are the lived experiences of..."
  current_stage: "Data Analysis"
  checkpoints_passed:
    - CP_RESEARCH_DIRECTION: "2026-01-25"
    - CP_PARADIGM_SELECTION: "2026-01-25"
    - CP_THEORY_SELECTION: "2026-01-25"
    - CP_METHODOLOGY_APPROVAL: "2026-01-25"
  pending_checkpoints:
    - CP_ANALYSIS_PLAN
```

### 6. User Communication

- **Checkpoints**: Use `AskUserQuestion` tool for REQUIRED (🔴) checkpoints
- **Progress**: Show visual indicators "🔴🔴🔴🟡🟡🟡 (3/6 checkpoints passed)"
- **Bilingual**: Match user language (EN/KO)

---

## Auto-Trigger Keywords

### Category A: Foundation

| Keywords | Korean | Agent |
|----------|--------|-------|
| research question, PICO, SPIDER | 연구 질문, 연구문제 | A1 |
| theoretical framework, theory | 이론, 이론적 틀 | A2 |
| critique, devil's advocate | 비판, 반대 의견 | A3 |
| IRB, ethics, consent | 윤리, IRB, 동의서 | A4 |
| paradigm, ontology, epistemology | 패러다임, 존재론 | A5 |
| conceptual framework, diagram | 개념적 프레임워크, 다이어그램 | A6 |

### Category B: Evidence

| Keywords | Korean | Agent |
|----------|--------|-------|
| literature review, PRISMA | 문헌 검토, 체계적 리뷰 | B1 |
| quality appraisal, RoB, GRADE | 질 평가, 편향 위험 | B2 |
| effect size, Cohen's d | 효과크기 | B3 |
| publication alerts, trends | 출판 알림, 동향 | B4 |
| **batch PDF, parallel processing, multiple PDFs** | **PDF 일괄 처리, 병렬 처리** | **B5** |

### Category C: Design

| Keywords | Korean | Agent |
|----------|--------|-------|
| RCT, survey, power analysis | 무작위 대조, 설문, 검정력 | C1 |
| phenomenology, grounded theory | 현상학, 근거이론 | C2 |
| mixed methods, sequential | 혼합연구, 순차적 | C3 |
| experimental materials | 실험 자료, 처치 | C4 |

### Category D: Data Collection

| Keywords | Korean | Agent |
|----------|--------|-------|
| sampling, probability | 표집, 확률 | D1 |
| interview, focus group | 인터뷰, 초점집단 | D2 |
| observation, field notes | 관찰, 현장노트 | D3 |
| scale, instrument, validity | 척도, 도구, 타당도 | D4 |

### Category E: Analysis

| Keywords | Korean | Agent |
|----------|--------|-------|
| statistics, ANOVA, regression | 통계, 분산분석, 회귀 | E1 |
| coding, thematic analysis | 코딩, 주제분석 | E2 |
| integration, joint display | 통합, 메타추론 | E3 |
| R code, Python, SPSS | R 코드, 파이썬 | E4 |
| sensitivity, robustness | 민감도, 강건성 | E5 |

### Category F: Quality

| Keywords | Korean | Agent |
|----------|--------|-------|
| consistency, coherence | 일관성, 정합성 | F1 |
| CONSORT, COREQ, checklist | 체크리스트, 보고 기준 | F2 |
| reproducibility, OSF | 재현성, 오픈사이언스 | F3 |
| bias, trustworthiness | 편향, 신뢰성 | F4 |
| **humanization verify, AI text check** | **휴먼화 검증, AI 텍스트 확인** | **F5** |

### Category G: Communication

| Keywords | Korean | Agent |
|----------|--------|-------|
| journal, submission | 저널, 투고 | G1 |
| plain language, infographic | 쉬운 언어 | G2 |
| reviewer, peer review | 리뷰어, 동료평가 | G3 |
| pre-registration, OSF | 사전등록 | G4 |
| **AI pattern, check AI writing, style audit** | **AI 패턴, AI 글쓰기 검토** | **G5** |
| **humanize, humanization, natural writing** | **휴먼화, 자연스러운 글쓰기** | **G6** |

### Category H: Specialized

| Keywords | Korean | Agent |
|----------|--------|-------|
| ethnography, fieldwork | 민족지학, 현장연구 | H1 |
| action research, PAR, CBPR | 실행연구, 참여적 연구 | H2 |

### Category I: Systematic Review Automation (NEW v6.5+)

| Keywords | Korean | Agent |
|----------|--------|-------|
| systematic review, PRISMA, literature review automation | 체계적 문헌고찰, 프리즈마, 문헌고찰 자동화 | I0 |
| fetch papers, retrieve papers, database search | 논문 수집, 데이터베이스 검색 | I1 |
| screen papers, inclusion criteria, AI screening | 논문 스크리닝, 포함 기준 | I2 |
| build RAG, vector database, PDF download | RAG 구축, PDF 다운로드 | I3 |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude/skills/research-coordinator/SKILL.md` | Master coordinator |
| `.claude/config/research-coordinator-routing.yaml` | Agent-to-model routing |
| `.claude/checkpoints/checkpoint-definitions.yaml` | Checkpoint definitions |
| `.claude/checkpoints/parallel-execution-rules.yaml` | Parallelization rules |
| `.research/project-state.yaml` | Active project context |
| `.research/decision-log.yaml` | Human decision audit trail |

---

## Version History

- **v6.7.0**: Systematic Review Automation - Category I enhanced, 44 total agents, all documentation synced
- **v6.5.0**: Systematic Review Automation - Category I agents (I0-I3), Groq LLM support
- **v6.3.0**: Meta-Analysis Agent System (C5/C6/C7) - Multi-gate validation, Hedges' g calculation
- **v6.2.0**: Parallel Document Processing (B5) - High-throughput PDF processing
- **v6.1.0**: Humanization Pipeline (G5/G6/F5) - AI pattern detection and transformation
- **v6.0.1**: Agent restructuring - Category-based naming (A1-H2)
- **v6.0.0**: Clean Slate - Removed Sisyphus/OMC modes, mandatory checkpoints
- **v5.0.0**: Sisyphus protocol, paradigm detection, 27 agents
- **v4.0.0**: Context persistence, pipeline templates

---

*This file enables AI assistants to understand Diverga v8.4.0's architecture and operate effectively within its human-centered design.*
