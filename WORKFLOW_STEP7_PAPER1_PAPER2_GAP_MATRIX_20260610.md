# Paper 1/Paper 2 Gap Matrix (Step 7)

## 생성 시점
- 2026-06-10
- Source anchor: `WORKFLOW_STEP7_PAPER1_PAPER2_PARALLEL_PLAN_20260610.md`
- 기준: 파일 존재성 증적 + 기존 longtable 의사결정 로그 (`.longtable/state.json`)

## Paper 1 / Paper 2 상태 비교

| 항목 | Paper 1 (`Paper1_MASEM_Working_20260605`) | Paper 2 (`Paper2_LLM_Extraction_Working_20260605`) | 공통 의사결정 |
|---|---|---|---|
| 입력 기준 | `00_README_AND_MANIFEST/INPUT_MANIFEST_20260605.csv` | `00_README_AND_MANIFEST/INPUT_MANIFEST_20260605.csv` | 공통 시작점: 입력 manifest 존재성은 동일한 날짜 스냅샷 기준으로 유지 |
| 전처리 플랜 | `06_preprocessing_plan/` 산출물 존재 (`PAPER1_PREPROCESSING_PLAN_20260605.md`, `LONGTABLE_PANEL_REVIEW_20260605.md`) | `07_preprocessing_plan/` 산출물 존재 (`PAPER2_PREPROCESSING_PLAN_20260605.md`, `LONGTABLE_PANEL_REVIEW_20260605.md`) | 단계 명명만 다르게 잡혀 있어도 동일하게 “preprocessing gate 통과”로 정렬 필요 |
| 분석 준비 산출 | `07_analysis_ready/` 산출물 존재 (`PAPER1_ANALYSIS_READY_MANIFEST_20260605.csv` 포함) | `08_llm_task_units/` 산출물 존재 (`PAPER2_TASK_UNITS_MANIFEST_20260605.csv` 포함) | Paper 1은 “analysis-ready”, Paper 2는 “task-unit generation”으로 상응 단계로 매핑 |
| QC/체크 | `08_qc_reports/` (`PAPER1_PRE_MODEL_QC_MANIFEST_20260605.csv`) | `09_reference_freeze/` (`paper2_reference_standard_freeze_note.md`, `source_adjudication_decisions_20260605.csv`) | QC와 reference-freeze 성격 차이 때문에 비교 지표가 필요 |
| 고정화 준비 | `09_model_ready_tiered_freeze/` 존재 | `09_reference_freeze/` 존재 | 공통 동기화 게이트 후보는 `model-ready_tiered_freeze` vs `reference_freeze` 비교 |

## 남은 갭
- 정의 정렬: Paper 1의 `analysis_ready -> qc -> model_ready_tiered_freeze` 경로와 Paper 2의 `preprocessing -> task_units -> reference_freeze` 경로를 동일한 “checkpoint boundary”로 해석해야 함.
- 증거 정합성: 본 실행 환경에서 OneDrive 동기화 파일 본문 일부가 지연 응답(읽기 지연)되어 `CSV` 본문 수치 확인은 수동 동기화 후 보강 필요.
- 동시 freeze 조건: 두 논문의 freeze 임계치(특히 Paper 1 모델 데이터 품질 지표 vs Paper 2 reference-standard 지표)가 서로 다른 스키마를 가짐.

## Step 7 공동 다음 체크포인트(권고)
### `C1: Paper 1 `analysis-ready` + QC 증빙 + Paper 2 `reference-freeze` 증빙 동기화
- 완료 조건:
  1) 각 측정 산출물의 존재 증적 및 스키마/필드 정합성 확인
  2) Paper 1/2의 panel review tension 항목을 통합 메모(차기 작업)으로 정렬
  3) `reference-standard vs model-ready` 분기에서 최종 freeze 진입 전 최소 증거 세트 승인
- 보류조건: 핵심 수치 증빙(특히 manifest 행 수/키 동등성)은 현재 상태에서 지연 열람 대상이므로 다음 스텝에서 확인 후 반영

## 다음 작업
1. 두 논문 LongTable 패널 미해결 항목을 통합한 `gap register` 생성
2. `INPUT_MANIFEST` 키 목록과 `analysis_ready`/`task_units` 간 동기화 표를 수치 기반으로 확정
3. `WORKFLOW_STATUS_LOG`에 Step 7 checkpoint 결정 및 보류 항목 기록
