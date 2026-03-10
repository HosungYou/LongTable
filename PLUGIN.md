# Diverga

**Version**: 11.0.0
**Author**: Hosung You
**Repository**: https://github.com/HosungYou/Diverga
**License**: MIT

---

## Description

Diverga is an AI Research Assistant for the complete research lifecycle. 24 specialized agents support researchers from question formulation to publication, with context persistence and creative methodology guidance.

**Key Features:**
- 24 specialized research agents across 9 categories
- **Memory System for context persistence** (v6.8+)
- **Parallel execution via Task tool** (v6.5+)
- Auto-trigger based on conversation context
- Human checkpoints for critical decisions
- Verbalized Sampling (VS) methodology for creative alternatives
- Multi-language support (English, Korean)

---

## Directory Structure (v11.0.0)

```
diverga/
├── agents/              # 24 agent definitions (Task tool)
│   ├── a1.md           # → Task(subagent_type="diverga:a1", ...)
│   ├── a2.md
│   └── ...
├── skills/              # Skill definitions (Skill tool)
│   ├── research-coordinator/
│   ├── setup/
│   └── ...
└── .claude-plugin/
    └── marketplace.json  # Plugin registration
```

**Important**: Both `/agents/` and `/skills/` are auto-discovered by Claude Code.
Do NOT add explicit `skills` key in marketplace.json.

---

## Quick Start

```
# Step 1: Add to marketplace
/plugin marketplace add https://github.com/HosungYou/Diverga

# Step 2: Install
/plugin install diverga

# Step 3: Setup
/diverga:setup
```

---

## Skills

| Skill | Command | Description |
|-------|---------|-------------|
| Setup | `/diverga:setup` | Initial configuration wizard |
| Help | `/diverga:help` | Agent list and usage guide |
| Memory | `/diverga:memory` | Context persistence for research lifecycle |
| Meta-Analysis | `/diverga:meta-analysis` | Meta-analysis workflow (C5) |
| PDF Extraction | `/diverga:pdf-extract` | Extract data from PDFs (C5) |

---

## Agents (24 total)

### Category A: Research Foundation (3 agents)

| Agent | Command | Description | Model |
|-------|---------|-------------|-------|
| A1-ResearchQuestionRefiner | `diverga:a1` | Refine and sharpen research questions | opus |
| A2-TheoryAndCritiqueArchitect | `diverga:a2` | Theory design, critique, ethics, visualization | opus |
| A5-ParadigmWorldviewAdvisor | `diverga:a5` | Ontology, epistemology guidance | opus |

### Category B: Literature & Evidence (2 agents)

| Agent | Command | Description | Model |
|-------|---------|-------------|-------|
| B1-SystematicLiteratureScout | `diverga:b1` | Systematic literature search | sonnet |
| B2-EvidenceQualityAppraiser | `diverga:b2` | Quality appraisal (RoB, GRADE) | sonnet |

### Category C: Study Design (4 agents)

| Agent | Command | Description | Model |
|-------|---------|-------------|-------|
| C1-QuantitativeDesignConsultant | `diverga:c1` | Quantitative research design | opus |
| C2-QualitativeDesignConsultant | `diverga:c2` | Qualitative research design | opus |
| C3-MixedMethodsDesignConsultant | `diverga:c3` | Mixed methods design | opus |
| C5-MetaAnalysisMaster | `diverga:c5` | Meta-analysis orchestration | opus |

### Category D: Data Collection (2 agents)

| Agent | Command | Description | Model |
|-------|---------|-------------|-------|
| D2-DataCollectionSpecialist | `diverga:d2` | Interview/focus group design | sonnet |
| D4-MeasurementInstrumentDeveloper | `diverga:d4` | Instrument development | opus |

### Category E: Analysis (3 agents)

| Agent | Command | Description | Model |
|-------|---------|-------------|-------|
| E1-QuantitativeAnalysisGuide | `diverga:e1` | Statistical analysis guidance | opus |
| E2-QualitativeCodingSpecialist | `diverga:e2` | Qualitative coding support | opus |
| E3-MixedMethodsIntegration | `diverga:e3` | Mixed methods integration | opus |

### Category F: Quality & Validation (1 agent)

| Agent | Command | Description | Model |
|-------|---------|-------------|-------|
| F5-HumanizationVerifier | `diverga:f5` | Verify humanization quality | haiku |

### Category G: Publication & Communication (4 agents)

| Agent | Command | Description | Model |
|-------|---------|-------------|-------|
| G1-JournalMatcher | `diverga:g1` | Match journals to manuscripts | sonnet |
| G2-PublicationSpecialist | `diverga:g2` | Academic writing support | sonnet |
| G5-AcademicStyleAuditor | `diverga:g5` | Audit academic style | sonnet |
| G6-AcademicStyleHumanizer | `diverga:g6` | Humanize AI-generated text | opus |

### Category I: Systematic Review Automation (4 agents)

| Agent | Command | Description | Model |
|-------|---------|-------------|-------|
| I0-ReviewPipelineOrchestrator | `diverga:i0` | Pipeline coordination and stage management | opus |
| I1-PaperRetrievalAgent | `diverga:i1` | Multi-database fetching (Semantic Scholar, OpenAlex, arXiv) | sonnet |
| I2-ScreeningAssistant | `diverga:i2` | AI-PRISMA 6-dimension screening | sonnet |
| I3-RAGBuilder | `diverga:i3` | Vector database construction (zero cost) | haiku |

### Category X: Cross-Cutting (1 agent)

| Agent | Command | Description | Model |
|-------|---------|-------------|-------|
| X1-ResearchGuardian | `diverga:x1` | Research integrity, ethics oversight, quality assurance | sonnet |

---

## Auto-Trigger Keywords

Diverga automatically detects keywords and activates appropriate agents:

| Keywords (English) | Keywords (Korean) | Agent |
|-------------------|-------------------|-------|
| "research question", "RQ" | "연구 질문", "연구문제" | diverga:a1 |
| "theoretical framework" | "이론적 프레임워크" | diverga:a2 |
| "devil's advocate", "critique" | "반론", "비판적 검토" | diverga:a2 |
| "IRB", "ethics" | "연구 윤리", "IRB" | diverga:a2 |
| "meta-analysis", "effect size" | "메타분석", "효과크기" | diverga:c5 |
| "data extraction", "PDF extract" | "데이터 추출", "PDF 추출" | diverga:c5 |
| "systematic review", "PRISMA" | "체계적 문헌고찰" | diverga:b1 |
| "qualitative", "interview" | "질적 연구", "인터뷰" | diverga:c2 |

---

## Agent Invocation (Task Tool)

Agents are invoked via the Task tool with `subagent_type` parameter:

```python
# Single agent invocation
Task(
    subagent_type="diverga:c5",
    model="opus",
    description="Meta-analysis orchestration",
    prompt="Validate the extracted effect sizes from 50 studies..."
)

# Parallel agents (independent tasks)
Task(subagent_type="diverga:b1", model="sonnet", prompt="Literature search...")
Task(subagent_type="diverga:b2", model="sonnet", prompt="Quality appraisal...")

# Sequential pipeline (C5 handles orchestration, extraction, and validation)
Task(subagent_type="diverga:c5", model="opus", prompt="Full meta-analysis pipeline...")
```

### Model Routing

| Tier | Model | Use For |
|------|-------|---------|
| HIGH | `opus` | Complex reasoning, architecture decisions |
| MEDIUM | `sonnet` | Standard implementation, extraction |
| LOW | `haiku` | Simple lookups, quick tasks |

### Agent-Model Mapping

```
opus:   A1, A2, A5, C1, C2, C3, C5, D4, E1, E2, E3, G6, I0
sonnet: B1, B2, D2, G1, G2, G5, I1, I2, X1
haiku:  F5, I3
```

---

## Configuration

Configuration file: `~/.claude/plugins/diverga/config/diverga-config.json`

```json
{
  "version": "11.0.0",
  "human_checkpoints": {
    "enabled": true,
    "required": ["CP_PARADIGM", "CP_METHODOLOGY"]
  },
  "default_paradigm": "auto",
  "language": "auto"
}
```

---

## Human Checkpoints

| Checkpoint | When | Required |
|------------|------|----------|
| CP_PARADIGM | Research paradigm selection | Yes |
| CP_METHODOLOGY | Methodology approval | Yes |
| CP_THEORY | Theory framework selection | Optional |
| CP_DATA_VALIDATION | Data extraction validation | Optional |

---

## Requirements

- Claude Code CLI

---

## Support

- GitHub Issues: https://github.com/HosungYou/Diverga/issues
- Documentation: https://github.com/HosungYou/Diverga/docs

---

*Version 11.0.0 - Claude Code Exclusive*
