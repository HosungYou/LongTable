# Paper 1 / Paper 2 Parallel Step-7 Plan (Evidence-anchored)

## 상태 증빙(현재 확인됨)
- Paper 1 (`Paper1_MASEM_Working_20260605`)
  - `00_README_AND_MANIFEST/INPUT_MANIFEST_20260605.csv` 확인됨
  - `06_preprocessing_plan/LONGTABLE_PANEL_REVIEW_20260605.md` 확인됨
  - `06_preprocessing_plan/PAPER1_PREPROCESSING_PLAN_20260605.md` 확인됨
  - `07_analysis_ready/paper1_direct_r_primary_analysis_ready_20260605.csv` 확인됨
  - `07_analysis_ready/PAPER1_ANALYSIS_READY_MANIFEST_20260605.csv` 확인됨
  - `08_qc_reports/PAPER1_PRE_MODEL_QC_MANIFEST_20260605.csv` 확인됨
  - `09_model_ready_tiered_freeze/paper1_direct_r_primary_model_ready_tiered_freeze_20260605.csv` 확인됨
- Paper 2 (`Paper2_LLM_Extraction_Working_20260605`)
  - `00_README_AND_MANIFEST/INPUT_MANIFEST_20260605.csv` 확인됨
  - `07_preprocessing_plan/LONGTABLE_PANEL_REVIEW_20260605.md` 확인됨
  - `07_preprocessing_plan/PAPER2_PREPROCESSING_PLAN_20260605.md` 확인됨
  - `08_llm_task_units/PAPER2_TASK_UNITS_MANIFEST_20260605.csv` 확인됨
  - `09_reference_freeze/source_adjudication_decisions_20260605.csv` 확인됨
  - `09_reference_freeze/paper2_human_final_consensus_reference_document_20260605_v2.md` 패턴 존재(`03_reference_standard_v2` 폴더)

## Step 7 동시 작업 항목
1. Paper 1/2에서 현재 진행 상태 정의:
   - `analysis_ready` vs `reference_freeze` 중 어느 상태를 공통 freeze gate로 정의할지.
2. 데이터 정합성 확인:
   - `INPUT_MANIFEST_20260605.csv` 기준 건수/키 일치성 비교 (동시 검토 테이블 작성).
3. 패널 근거 정렬:
   - Paper 1/2 `LONGTABLE_PANEL_REVIEW_*.md`의 미해결 쟁점 통합 정리.
4. 공통 의사결정 산출:
   - Step 7에서 하나의 다음 checkpoint 정의 후 LongTable state로 반영.

## 권장 다음 action
- LongTable: `CURRENT.md` + `.longtable/state.json` + `WORKFLOW_STATUS_LOG.md`를 근거로 Step 7 시작 기록을 승인.
- AI Adoption: 위 체크 항스트를 `Paper1`/`Paper2` 공통 진행표에 넣고 동일 규칙으로 통일.
