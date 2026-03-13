# Release Notes: Diverga v11.1.2

**Release Date**: 2026-03-13
**Tag**: `v11.1.2`
**Previous**: `v11.1.1` (`1e33043`)

---

## Summary

Setup wizard 수정, 첫 실행 감지 추가, symlink 기반 개발 환경 문서화. Plugin 작성자를 위한 개발 워크플로우 개선.

---

## What's Changed

### Setup Wizard v11.1 (Breaking Fix)

Setup 스킬(`/diverga:setup`)이 v11.1.1 config 스키마와 동기화되지 않은 문제를 수정했습니다.

| Before (Broken) | After (Fixed) |
|-----------------|---------------|
| 3-step wizard | **4-step wizard** (+ VS Arena) |
| Version refs: v8.4.0, v11.0 | **v11.1.1** |
| Config: 11 hardcoded checkpoints | **2 required + 2 optional** (실제 시스템과 일치) |
| Config schema: `hud`, `level` fields | **`vs_arena`, `llm_provider`, `default_paradigm`** |
| Save to: `./config/` (CWD 상대경로) | **`~/.claude/plugins/diverga/config/`** |

**Checkpoint 매핑 명확화:**
- Full: `enabled: true`, required: `[CP_PARADIGM, CP_METHODOLOGY]`, optional: `[CP_THEORY, CP_DATA_VALIDATION]`
- Minimal: `enabled: true`, required only
- Off: `enabled: false` (hook-level REQUIRED 5개는 여전히 강제)

Hook-enforced 5개 REQUIRED 체크포인트(`CP_RESEARCH_DIRECTION`, `CP_PARADIGM_SELECTION`, `CP_METHODOLOGY_APPROVAL`, `SCH_DATABASE_SELECTION`, `SCH_SCREENING_CRITERIA`)는 config 설정과 무관하게 항상 적용됨을 문서에 명시했습니다.

### First-Run Detection

CLAUDE.md에 세션 시작 시 첫 실행 감지 로직을 추가했습니다:
- Config 없거나 버전 불일치 시: `Diverga is installed but not configured. Run /diverga:setup to get started.` 표시
- 자동 setup 실행 없음 (안내 메시지만)

### Symlink-Based Development Guide

Plugin 작성자를 위한 symlink 개발 워크플로우를 `docs/DEVELOPER.md`에 문서화했습니다.

**문제**: Claude Code plugin은 파일을 3곳에 복사 (plugin dir, cache, skills) → 수정 시 매번 3곳 수동 동기화 필요

**해결**: Git repo를 symlink로 연결 → 파일 한 곳에서만 관리

```
Git Repo (단일 소스)
    ├── symlink ← ~/.claude/plugins/diverga/
    ├── symlink ← ~/.claude/plugins/cache/diverga/.../
    └── skills/ (plugin.json이 자동 등록)
```

**문서 내용**: Setup 스크립트, 7가지 실전 팁 (plugin.json 이중관리, 버전 변경 시 cache 경로, 새 스킬 추가, 외장디스크 주의, `plugin update` 주의, 다른 사용자 영향 없음 등)

### Root-Level plugin.json

Plugin 시스템이 루트에서 `plugin.json`을 찾을 수 있도록 `.claude-plugin/plugin.json`과 동일한 파일을 repo 루트에 추가했습니다. Windows 호환성을 위해 symlink가 아닌 실제 파일로 유지합니다.

---

## Commits

| Hash | Message |
|------|---------|
| `6b677a8` | fix(setup): sync setup wizard with v11.1.1 config schema and add first-run detection |
| `9fdf17e` | chore: add root-level plugin.json symlink for symlink-based development |
| `08da559` | fix: convert plugin.json from symlink to regular file for Windows compatibility |
| `b874a3c` | docs: add symlink-based development guide to DEVELOPER.md |

---

## Files Changed

| File | Change |
|------|--------|
| `skills/setup/SKILL.md` | Rewritten: 4-step wizard, correct config schema, checkpoint mappings |
| `CLAUDE.md` | +10 lines: First-Run Detection section |
| `docs/DEVELOPER.md` | +139 lines: Symlink development guide with 7 tips |
| `plugin.json` | New: root-level copy for symlink compatibility |

---

## Migration Notes

### For Existing Users

Setup을 다시 실행하면 올바른 config가 생성됩니다:
```
/diverga:setup
```

이전 setup으로 생성된 config (`./config/diverga-config.json`)는 수동 삭제하세요:
```bash
rm ./config/diverga-config.json
```

### For Plugin Authors (Symlink Setup)

```bash
REPO="/path/to/Diverga"

# Plugin + Cache → repo symlink
rm -rf ~/.claude/plugins/diverga
ln -s "$REPO" ~/.claude/plugins/diverga
rm -rf ~/.claude/plugins/cache/diverga/diverga/11.1.2
ln -s "$REPO" ~/.claude/plugins/cache/diverga/diverga/11.1.2

# Standalone skill symlinks는 불필요 (plugin namespace 사용)
# /diverga:setup, /diverga:help 등으로 접근
```

### Skill Namespace 변경

Standalone skill format (`/diverga-setup`)은 더 이상 사용하지 않습니다. Plugin namespace format을 사용하세요:

| Before | After |
|--------|-------|
| `/diverga-setup` | `/diverga:setup` |
| `/diverga-help` | `/diverga:help` |
| `/diverga-memory` | `/diverga:memory` |

---

## Known Issues

- `plugin update`/`plugin install` 명령이 symlink를 일반 디렉토리로 덮어쓸 수 있음 → 업데이트 후 확인 필요
- `plugin.json`이 repo 루트와 `.claude-plugin/` 두 곳에 존재 → 내용 변경 시 양쪽 모두 수정 필요
