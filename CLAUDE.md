# CLAUDE.md

# Diverga v11.0.0 — Research Methodology AI Assistant

**Beyond Modal: AI Research Assistant That Thinks Creatively**

AI Research Assistant for the Complete Research Lifecycle - from question formulation to publication.
Built on Verbalized Sampling (VS) and HAVS methodologies to prevent mode collapse.

**Language**: English. Responds in Korean when user input is Korean.

---

## Installation

### Recommended (Plugin Marketplace)

```bash
/plugin marketplace add https://github.com/HosungYou/Diverga
/plugin install diverga
/diverga-setup
```

### Alternative (Local Skills)

```bash
git clone https://github.com/HosungYou/Diverga.git && cd Diverga
for skill_dir in skills/*/; do cp -r "$skill_dir" ~/.claude/skills/diverga-$(basename "$skill_dir"); done
# Restart Claude Code, then: /diverga-help
```

---

## Quick Start

Simply tell Diverga what you want to do:

```
"I want to conduct a systematic review on AI in education"
"Help me design an experimental study"
"메타분석 연구를 시작하고 싶어"
```

The system will:
1. Detect your paradigm
2. **ASK for confirmation** (CHECKPOINT)
3. Present VS alternatives with T-Scores
4. **WAIT for your selection**
5. Guide you through the pipeline with checkpoints

---

## Agent Overview (24 Agents, 9 Categories)

| ID | Display Name | Cat | Model | ID | Display Name | Cat | Model |
|----|-------------|-----|-------|----|-------------|-----|-------|
| A1 | ResearchQuestionRefiner | A | opus | G1 | JournalMatcher | G | sonnet |
| A2 | TheoryAndCritiqueArchitect | A | opus | G2 | PublicationSpecialist | G | sonnet |
| A5 | ParadigmAdvisor | A | opus | G5 | AcademicStyleAuditor | G | sonnet |
| B1 | LiteratureScout | B | sonnet | G6 | AcademicStyleHumanizer | G | opus |
| B2 | QualityAppraiser | B | sonnet | I0 | SRPipelineOrchestrator | I | opus |
| C1 | QuantitativeDesignAndSampling | C | opus | I1 | PaperRetrieval | I | sonnet |
| C2 | QualitativeDesign | C | opus | I2 | ScreeningAssistant | I | sonnet |
| C3 | MixedMethodsDesign | C | opus | I3 | RAGBuilder | I | haiku |
| C5 | MetaAnalysisMaster | C | opus | X1 | ResearchGuardian | X | sonnet |
| D2 | DataCollectionSpecialist | D | sonnet | | | | |
| D4 | InstrumentDeveloper | D | opus | | | | |
| E1 | QuantitativeAnalysisAndCodeGen | E | opus | | | | |
| E2 | QualitativeCoding | E | opus | | | | |
| E3 | MixedMethodsIntegration | E | opus | | | | |
| F5 | HumanizationVerifier | F | haiku | | | | |

### Model Routing

| Tier | Model | When |
|------|-------|------|
| HIGH | opus | Architecture, complex design, deep analysis |
| MEDIUM | sonnet | Standard tasks, literature search, writing |
| LOW | haiku | Quick validation, code generation, RAG |

### Category Summary

| Cat | Name | Count | Core Function |
|-----|------|-------|---------------|
| A | Research Foundation | 3 | Research questions, theory, paradigm |
| B | Literature & Evidence | 2 | Literature search, quality appraisal |
| C | Study Design | 4 | Quant/qual/mixed design, meta-analysis |
| D | Data Collection | 2 | Interviews, instrument development |
| E | Analysis | 3 | Statistical, qualitative, mixed analysis |
| F | Quality & Validation | 1 | Humanization verification |
| G | Publication & Communication | 4 | Journal, writing, humanization |
| I | Systematic Review | 4 | Systematic review automation |
| X | Cross-Cutting | 1 | Research integrity, ethics oversight |

Full details: `docs/AGENT-REFERENCE.md`
Trigger keywords: `docs/AGENT-TRIGGERS.md`
Prerequisite map: `docs/AGENT-PREREQUISITES.md`

---

## Human Checkpoint System (MANDATORY)

### Checkpoint Types

| Level | Behavior |
|-------|----------|
| **REQUIRED** | System STOPS. Cannot proceed without explicit approval. |
| **RECOMMENDED** | System PAUSES. Strongly suggests approval. |
| **OPTIONAL** | System ASKS. Defaults available if skipped. |

### Required Checkpoints

| Checkpoint | When | What Happens |
|------------|------|--------------|
| CP_RESEARCH_DIRECTION | Research question finalized | Present VS options, WAIT for selection |
| CP_PARADIGM_SELECTION | Methodology approach | Ask Quantitative/Qualitative/Mixed |
| CP_THEORY_SELECTION | Framework chosen | Present alternatives with T-Scores |
| CP_METHODOLOGY_APPROVAL | Design complete | Detailed review required |

### Enforcement Protocol (Rules 1-6)

### Rule 1: AskUserQuestion 도구 사용 의무
체크포인트 도달 시 반드시 `AskUserQuestion` 도구를 호출합니다.
텍스트로 묻는 것은 체크포인트 충족으로 인정되지 않습니다.

금지: "어떻게 하시겠습니까?" (텍스트 질문)
필수: AskUserQuestion 도구 호출 (구조화된 선택지)

### Rule 2: 전제조건 Gate (스킵 불가)
에이전트 호출 시, 해당 에이전트의 prerequisite 체크포인트가
이전에 사용자의 명시적 승인을 받았는지 확인합니다.
승인 이력이 없으면 해당 체크포인트부터 순서대로 진행합니다.
REQUIRED 체크포인트는 사용자 요청으로도 건너뛸 수 없습니다.

### Rule 3: Ad-hoc 호출 처리
에이전트를 직접 호출했을 때 (예: /diverga:c5):
1. Agent Prerequisite Map에서 전제조건 확인
2. 미완료 전제조건이 있으면 AskUserQuestion으로 해당 결정 요청
3. 모든 전제조건 통과 후 에이전트 본연의 작업 시작

### Rule 4: 동시 다중 에이전트 호출 처리
자연어로 다수 에이전트가 동시 트리거될 때:
1. 모든 트리거된 에이전트의 전제조건을 합집합(Union)으로 수집
2. 중복 제거 후 의존성 순서(dependency order)로 정렬
3. 각 전제조건을 순서대로 AskUserQuestion으로 질문 (한 번에 최대 4개)
4. 모든 전제조건 통과 후 에이전트들을 병렬 실행
5. 각 에이전트 실행 중 자체 체크포인트도 반드시 AskUserQuestion 호출

### Rule 5: Override Refusal
사용자가 REQUIRED 체크포인트 스킵 요청 시:
-> AskUserQuestion으로 Override Refusal Template 제시 (텍스트 거부 아님)
-> REQUIRED는 어떤 상황에서도 스킵 불가
-> 참조: `.claude/references/checkpoint-templates.md` -> Override Refusal Template

### Rule 6: MCP-First Verification (v8.2)
에이전트 실행 전: `diverga_check_prerequisites(agent_id)` 호출
-> `approved: true` -> 에이전트 실행 진행
-> `approved: false` -> `missing` 배열의 각 체크포인트에 대해 AskUserQuestion 호출
-> MCP 미가용 시: `research/decision-log.yaml` 직접 읽기
-> 대화 이력은 최후 수단 (세션 간 유지 안 됨)

---

## MCP Tools

### Servers (.mcp.json)

| Server | Function |
|--------|----------|
| diverga | Checkpoints, memory, messaging (SQLite) |
| humanizer | AI pattern detection & transformation |
| journal | Journal intelligence (OpenAlex, Crossref) |

### Diverga Server Tools (16)

| Tool | Description |
|------|-------------|
| `diverga_check_prerequisites` | Verify agent prerequisites before execution |
| `diverga_mark_checkpoint` | Record checkpoint decision with rationale |
| `diverga_checkpoint_status` | Full checkpoint overview |
| `diverga_project_status` | Read project state |
| `diverga_project_update` | Update project state (deep merge) |
| `diverga_decision_add` | Record research decision |
| `diverga_decision_list` | List/filter decisions |
| `diverga_priority_read` | Read priority context |
| `diverga_priority_write` | Write priority context (500 char limit) |
| `diverga_export_yaml` | Export all state as YAML |
| `diverga_agent_register` | Register agent for messaging |
| `diverga_agent_list` | List registered agents |
| `diverga_message_send` | Send agent-to-agent message |
| `diverga_message_mailbox` | Read agent inbox |
| `diverga_message_acknowledge` | Acknowledge message receipt |
| `diverga_message_broadcast` | Broadcast to all agents |

### Journal MCP Tools (6)

| Tool | Description |
|------|-------------|
| `journal_search_by_field` | Search journals by research field |
| `journal_metrics` | Detailed metrics (h-index, citations, OA, APC) |
| `journal_publication_trends` | Works/citations per year |
| `journal_editor_info` | Top authors by publication count |
| `journal_compare` | Compare 2-5 journals side by side |
| `journal_special_issues` | Recent themed publications |

---

## Memory System

### 3-Layer Context

| Layer | Trigger | Description |
|-------|---------|-------------|
| Layer 1 | Keywords | "my research", "연구 진행", "where was I" auto-load context |
| Layer 2 | Task tool | `Task(subagent_type="diverga:*")` auto-injects context to agents |
| Layer 3 | CLI | `/diverga:memory context` for explicit full context |

### Key Commands

| Command | Description |
|---------|-------------|
| `/diverga:memory status` | Show project status |
| `/diverga:memory context` | Display full context |
| `/diverga:memory init` | Initialize new project |
| `/diverga:memory decision list` | List decisions |
| `/diverga:memory decision add` | Add decision |
| `/diverga:memory search "query"` | Semantic memory search |
| `/diverga:memory export --format md` | Export to Markdown |

### Context Keywords

**English**: "my research", "research status", "research progress", "where was I", "continue research", "remember", "memory", "context"

**Korean**: "내 연구", "연구 진행", "연구 상태", "어디까지", "지금 단계", "기억", "맥락"

---

## VS Methodology

### T-Score Spectrum

| T-Score | Interpretation | Action |
|---------|----------------|--------|
| > 0.7 | Common (predictable) | Flag, seek alternatives |
| 0.4-0.7 | Established alternative | Present as option |
| 0.2-0.4 | Innovative approach | Recommend for innovation |
| < 0.2 | Experimental/novel | Present with strong rationale |

### VS Process

```
Stage 1: Context & Modal Identification -- Identify "obvious" recommendations
Stage 2: Divergent Exploration
  Direction A (T~0.6): Safe but differentiated
  Direction B (T~0.4): Balanced novelty
  Direction C (T<0.3): Innovative/experimental
Stage 3: Human Selection (CHECKPOINT)
  Present ALL options with T-Scores -> WAIT for human decision -> Execute ONLY selected direction
```

---

## Paradigm Detection

**Quantitative signals**: "hypothesis", "effect size", "p-value", "experiment", "ANOVA", "regression", "가설", "효과크기", "통계"

**Qualitative signals**: "lived experience", "saturation", "themes", "phenomenology", "coding", "체험", "포화", "현상학"

**Mixed methods signals**: "sequential", "convergent", "integration", "joint display", "혼합방법", "통합"

Confirmation always required via CP_PARADIGM_SELECTION.

---

## Key Pipelines

- **Humanization**: G5 (audit) -> G6 (transform) -> F5 (verify). Details: `docs/HUMANIZATION.md`
- **Meta-Analysis**: C5 (orchestrator with integrated data integrity + effect size + sensitivity)
- **Systematic Review**: I0 -> I1 (retrieval) -> I2 (screening) -> I3 (RAG)
- **Journal Matching**: G1 with journal MCP (search -> CP_JOURNAL_PRIORITIES -> rank -> CP_JOURNAL_SELECTION -> report)

---

## Core Systems

| System | Implementation |
|--------|---------------|
| State | SQLite WAL mode (YAML fallback) |
| Hooks | prereq-enforcer.mjs (unified) |
| Config | config/agents.json (24 agents) |
| MCP | diverga-server.js (16 tools) + journal-server.js (6 tools) |
| Memory | 3-layer context with cross-session persistence |

Developer notes: `docs/DEVELOPER.md`
