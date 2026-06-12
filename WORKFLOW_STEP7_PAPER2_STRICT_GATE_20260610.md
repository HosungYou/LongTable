# Paper 2 Strict Gate C2 (Step 7)

## 운영 기준 (엄격형)
- Paper 2 freeze 후보는 **아래 4개 기준을 순서대로 모두 통과(pass)**해야만 인정한다.
- 하나라도 불충분하면 `Gate C2 = fail`, freeze 후보 진입 불가.

## Gate C2 순차 조건

1) Study-level 정합성
- `00_README_AND_MANIFEST/INPUT_MANIFEST_20260605.csv`와 Paper 2 관련 배제/보류/포함 근거 파일의 study key 집합이 일치해야 한다.
- 단계 상태가 서로 충돌하면 즉시 `fail`.

2) Construct / Coding 정합성
- `PAPER2_PREPROCESSING_PLAN_20260605.md`와 관련 코드북/규칙 산출물 간 construct-코드 명명, 매핑, 해석 범주가 일관되어야 한다.
- 상충 정의가 있으면 resolve 전까지 `fail`.

3) Source adjudication 정합성
- `source_adjudication_decisions_20260605.csv`와 phase2/관련 review 문서의 최종판단(포함/제외/수정/재분류)이 서로 충돌 없이 수렴되어야 한다.
- 미해결/보류가 있으면 `fail`.

4) 입력 매핑 정합성
- `PAPER2_TASK_UNITS_MANIFEST_20260605.csv`의 task 단위와 `09_reference_freeze/` 산출물(예: `paper2_reference_standard_freeze_note.md`, `workbook_mutation_manifest_20260605.csv`, `paper2_llm_task_units_labeled_tiered_freeze_20260605.csv`) 사이의 매핑이 1:1 점검 가능해야 하며 누락/중복이 없어야 한다.

## 고정형 게이트 선언
- 위 4개는 **모두 필수**이며, 임의 완화 불가.
- 정합성 완료 증적은 `WORKFLOW_STATUS_LOG.md` 및 LongTable state의 결정 기록과 함께 남긴다.
