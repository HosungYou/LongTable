# Agent Auto-Trigger Keywords Reference

Diverga automatically detects keywords and context to activate appropriate agents via Task tool.

## Invocation Pattern

```python
Task(
    subagent_type="diverga:<agent_id>",
    model="<opus|sonnet|haiku>",
    prompt="<research context + specific task>"
)
```

---

## Category A: Foundation (6 agents)

| Agent | Trigger Keywords (EN) | Trigger Keywords (KR) | Model |
|-------|----------------------|----------------------|-------|
| `diverga:a1` | "research question", "RQ", "refine question" | "연구 질문", "연구문제", "RQ" | opus |
| `diverga:a2` | "theoretical framework", "theory", "conceptual model" | "이론적 프레임워크", "이론적 틀" | opus |
| `diverga:a3` | "devil's advocate", "critique", "counterargument" | "반론", "비판적 검토", "반대 의견" | opus |
| `diverga:a4` | "IRB", "ethics", "informed consent", "research ethics" | "연구 윤리", "IRB", "동의서" | sonnet |
| `diverga:a5` | "paradigm", "ontology", "epistemology", "worldview" | "패러다임", "존재론", "인식론" | opus |
| `diverga:a6` | "conceptual framework", "visualize framework" | "개념적 프레임워크", "프레임워크 시각화" | sonnet |

## Category B: Evidence (5 agents)

| Agent | Trigger Keywords (EN) | Trigger Keywords (KR) | Model |
|-------|----------------------|----------------------|-------|
| `diverga:b1` | "systematic review", "literature search", "PRISMA" | "체계적 문헌고찰", "문헌 검색" | sonnet |
| `diverga:b2` | "quality appraisal", "RoB", "GRADE", "bias assessment" | "품질 평가", "비뚤림 평가" | sonnet |
| `diverga:b3` | "effect size", "extract effect", "Cohen's d", "Hedges' g" | "효과크기", "효과 크기 추출" | haiku |
| `diverga:b4` | "research trends", "emerging topics", "research radar" | "연구 동향", "트렌드" | haiku |
| `diverga:b5` | "batch PDF", "parallel processing", "multiple PDFs" | "PDF 일괄 처리", "병렬 처리" | opus |

## Category C: Design & Meta-Analysis (7 agents)

| Agent | Trigger Keywords (EN) | Trigger Keywords (KR) | Model |
|-------|----------------------|----------------------|-------|
| `diverga:c1` | "quantitative design", "experimental design", "RCT" | "양적 연구 설계", "실험 설계" | opus |
| `diverga:c2` | "qualitative design", "phenomenology", "grounded theory" | "질적 연구 설계", "현상학", "근거이론" | opus |
| `diverga:c3` | "mixed methods", "sequential design", "convergent" | "혼합방법", "혼합 연구", "통합 설계" | opus |
| `diverga:c4` | "intervention materials", "experimental materials" | "중재 자료", "실험 자료 개발" | sonnet |
| `diverga:c5` | "meta-analysis", "pooled effect", "heterogeneity" | "메타분석", "메타 분석", "통합 효과" | opus |
| `diverga:c6` | "data extraction", "PDF extract", "extract data" | "데이터 추출", "PDF 추출", "자료 추출" | sonnet |
| `diverga:c7` | "error prevention", "validation", "data check" | "오류 방지", "검증", "데이터 확인" | sonnet |

## Category D: Data Collection (4 agents)

| Agent | Trigger Keywords (EN) | Trigger Keywords (KR) | Model |
|-------|----------------------|----------------------|-------|
| `diverga:d1` | "sampling", "sample size", "G*Power" | "표집", "표본 크기", "샘플링" | sonnet |
| `diverga:d2` | "interview", "focus group", "interview protocol" | "인터뷰", "면담", "포커스 그룹" | sonnet |
| `diverga:d3` | "observation", "observation protocol" | "관찰", "관찰 프로토콜" | haiku |
| `diverga:d4` | "instrument", "measurement", "scale development" | "측정 도구", "척도 개발" | opus |

## Category E: Analysis (5 agents)

| Agent | Trigger Keywords (EN) | Trigger Keywords (KR) | Model |
|-------|----------------------|----------------------|-------|
| `diverga:e1` | "statistical analysis", "ANOVA", "regression", "SEM" | "통계 분석", "회귀", "분산분석" | opus |
| `diverga:e2` | "qualitative coding", "thematic analysis", "coding" | "질적 코딩", "주제 분석", "코딩" | opus |
| `diverga:e3` | "mixed methods integration", "joint display" | "혼합방법 통합", "통합 분석" | opus |
| `diverga:e4` | "R code", "Python code", "analysis code" | "R 코드", "Python 코드", "분석 코드" | haiku |
| `diverga:e5` | "sensitivity analysis", "robustness check" | "민감도 분석", "강건성 검증" | sonnet |

## Category F: Quality (5 agents)

| Agent | Trigger Keywords (EN) | Trigger Keywords (KR) | Model |
|-------|----------------------|----------------------|-------|
| `diverga:f1` | "consistency check", "internal consistency" | "일관성 검토", "내적 일관성" | haiku |
| `diverga:f2` | "checklist", "CONSORT", "STROBE", "COREQ" | "체크리스트", "보고 지침" | haiku |
| `diverga:f3` | "reproducibility", "replication", "OSF" | "재현성", "반복가능성" | sonnet |
| `diverga:f4` | "bias detection", "trustworthiness" | "편향 탐지", "신뢰성" | sonnet |
| `diverga:f5` | "humanization verify", "AI text check" | "휴먼화 검증", "AI 텍스트 확인" | haiku |

## Category G: Communication (6 agents)

| Agent | Trigger Keywords (EN) | Trigger Keywords (KR) | Model |
|-------|----------------------|----------------------|-------|
| `diverga:g1` | "journal match", "where to publish", "target journal" | "저널 매칭", "투고처", "학술지" | sonnet |
| `diverga:g2` | "academic writing", "manuscript", "write paper" | "학술 글쓰기", "논문 작성" | sonnet |
| `diverga:g3` | "peer review", "reviewer response", "revision" | "동료 심사", "리뷰어 응답", "수정" | sonnet |
| `diverga:g4` | "preregistration", "OSF", "pre-register" | "사전등록", "OSF" | sonnet |
| `diverga:g5` | "AI pattern", "check AI writing", "style audit" | "AI 패턴", "AI 글쓰기 검토" | sonnet |
| `diverga:g6` | "humanize", "humanization", "natural writing" | "휴먼화", "자연스러운 글쓰기" | opus |

## Category H: Specialized (2 agents)

| Agent | Trigger Keywords (EN) | Trigger Keywords (KR) | Model |
|-------|----------------------|----------------------|-------|
| `diverga:h1` | "ethnography", "fieldwork", "participant observation" | "민족지학", "현장연구", "참여관찰" | opus |
| `diverga:h2` | "action research", "participatory", "practitioner" | "실행연구", "참여적 연구" | opus |

## Category I: Systematic Review Automation (4 agents)

| Agent | Trigger Keywords (EN) | Trigger Keywords (KR) | Model |
|-------|----------------------|----------------------|-------|
| `diverga:i0` | "systematic review", "PRISMA", "literature review automation" | "체계적 문헌고찰", "프리즈마", "문헌고찰 자동화" | opus |
| `diverga:i1` | "fetch papers", "retrieve papers", "database search" | "논문 수집", "논문 검색", "데이터베이스 검색" | sonnet |
| `diverga:i2` | "screen papers", "PRISMA screening", "inclusion criteria" | "논문 스크리닝", "선별", "포함 기준" | sonnet |
| `diverga:i3` | "build RAG", "vector database", "embed documents" | "RAG 구축", "벡터 DB", "문서 임베딩" | haiku |

---

## Parallel Execution Groups

Agents in the same group can run in parallel when tasks are independent:

| Group | Agents | Use Case |
|-------|--------|----------|
| Research Design | A1 + A2 + A5 | Parallel foundation work |
| Literature & Evidence | B1 + B2 + B3 | Literature review |
| Meta-Analysis Pipeline | C5 -> C6 -> C7 | Sequential pipeline |
| Quality Assurance | F1 + F3 + F4 | Parallel QA checks |
| Publication Prep | G1 + G2 + G5 | Parallel publication work |
| Systematic Review | I0 -> I1 -> I2 -> I3 | Pipeline (I1+I2 can parallelize) |

## Prerequisite Gate for Parallel Execution

Before running any parallel group:
1. Collect the union of all agents' prerequisites
2. Resolve any incomplete prerequisites via AskUserQuestion
3. Only start parallel execution after all prerequisites pass
