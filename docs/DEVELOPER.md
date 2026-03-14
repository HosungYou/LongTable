# Developer Notes

## SKILL.md Format for Claude Code Plugins

When creating skills for Claude Code plugins, the `SKILL.md` frontmatter must follow a specific format.

### Correct Format

```yaml
---
name: skill-name
description: |
  Brief description of the skill.
  Include triggers and additional info as text here.
version: "1.0.0"
---

# Skill Title

Markdown content follows...
```

### Rules

1. Only `name`, `description`, `version` fields are supported
2. Put extra metadata (triggers, dependencies) in description text
3. Quote version numbers: `"1.0.0"` not `1.0.0`
4. Do NOT use `command` field -- it breaks skill recognition

### Fields That Break Parsing

These frontmatter fields cause "Unknown skill" errors:
- `command` -- BREAKS parsing
- `category` -- Not supported
- `model_tier` -- Not supported
- `triggers` (as array) -- Not supported
- `dependencies` (as object) -- Not supported

---

## Plugin Directory Structure

```
~/.claude/plugins/diverga/
+-- .claude/
|   +-- skills/
|       +-- memory/
|       |   +-- SKILL.md
|       +-- research-coordinator/
|       |   +-- SKILL.md
|       +-- ...
+-- .claude-plugin/
|   +-- marketplace.json
+-- CLAUDE.md
```

---

## Symlink-Based Development (Recommended for Plugin Authors)

### The Problem

Claude Code plugin은 파일을 **3곳에 복사**해서 사용합니다:

```
~/.claude/plugins/diverga/              ← Plugin 디렉토리
~/.claude/plugins/cache/diverga/.../    ← Plugin 캐시 (스킬 로딩용)
~/.claude/skills/diverga-*/             ← 개별 스킬 디렉토리 (35+개)
```

Git repo에서 파일을 수정해도 이 3곳에는 반영되지 않아서, 매번 수동으로 복사해야 합니다. 스킬이 35개면 35번 복사해야 합니다.

### The Solution: Symlink

**Symlink (심볼릭 링크)** = 파일 바로가기. 원본을 가리키는 포인터입니다.

```
일반 복사:     원본 수정 → 복사본 변하지 않음 (별도 파일)
Symlink:       원본 수정 → 링크도 즉시 반영 (같은 파일을 가리키므로)
```

Git repo를 유일한 소스로 두고, 나머지 3곳을 모두 symlink로 연결하면 파일을 한 곳에서만 관리할 수 있습니다.

### Setup

With dev mode active, source changes reflect immediately — no manual copy needed:

```bash
# Activate dev mode (one-time)
npm run dev:on

# Edit any SKILL.md — changes are live via symlink
# No restart needed for skill content changes
```

Without dev mode (manual sync):
```bash
cp skills/your-skill/SKILL.md \
   ~/.claude/plugins/cache/diverga/diverga/<VERSION>/skills/your-skill/SKILL.md
# Restart Claude Code for changes to take effect
```

---

## Project File Structure

```
project-root/
+-- .research/                  # System files (hidden - internal use only)
|   +-- hud-state.json          # HUD cache
|   +-- priority-context.md     # Compressed context (500 chars)
|   +-- sessions/               # Session records
|
+-- research/                   # Researcher-visible files (public)
|   +-- project-state.yaml      # Project metadata
|   +-- decision-log.yaml       # All research decisions
|   +-- checkpoints.yaml        # Checkpoint states
|   +-- baselines/              # Stable research foundations
|   +-- changes/
|       +-- current/            # Active work
|       +-- archive/            # Completed stages
|
+-- docs/                       # Auto-generated documentation
```

**Migration Note**: Existing projects with files in `.research/` are automatically migrated to `research/` on first access. System-only files remain in `.research/`.

---

## MCP Server Architecture

```
diverga-server.js --> tool-registry.js (16 tools)
      |
      +-- checkpoint-server   memory-server     comm-server
      |        |                    |                |
      |   YAML (default)      YAML (default)    JSON (default)
      |        |                    |                |
      +-- sqlite-servers.js (WAL mode, DIVERGA_BACKEND=sqlite)
```

### Dual Backend

| Backend | Env Var | Description |
|---------|---------|-------------|
| YAML (default) | `DIVERGA_BACKEND=yaml` | Human-readable, backward-compatible |
| SQLite (opt-in) | `DIVERGA_BACKEND=sqlite` | WAL-mode ACID transactions for parallel execution |

First SQLite startup auto-migrates existing YAML/JSON data.

---

## Dev Mode

### Architecture

Dev mode creates selective symlinks from the plugin source to the cache directory.
Only allowlisted paths are linked — all build artifacts, session data, and databases
are automatically blocked.

```
Source (Diverga-core/)
  ├── agents/     ─── symlink ──→  cache/diverga/diverga/dev/agents/
  ├── skills/     ─── symlink ──→  cache/diverga/diverga/dev/skills/
  ├── ...         ─── symlink ──→  ...
  ├── node_modules/  (blocked)
  ├── .git/          (blocked)
  └── *.db           (blocked)
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev:on` | Activate (backup cache, create symlinks, update installed_plugins.json) |
| `npm run dev:off` | Deactivate (remove symlinks, restore backup) |
| `npm run dev:status` | Show current state with symlink health check |

### State File

`.dev-mode.json` (gitignored) tracks activation state:
- `activatedAt`: timestamp
- `sourcePath`: source directory
- `devCachePath`: symlink target directory
- `backupPath`: original cache backup
- `originalVersion`: version before dev mode

### Troubleshooting

| Problem | Solution |
|---------|----------|
| "No cache version found" | Plugin not installed. Run `/plugin install diverga` |
| Broken symlinks | Run `npm run dev:off && npm run dev:on` |
| installed_plugins.json corrupted | Run `npm run dev:off`, manually check the JSON |

---

## Deploy Pipeline

### Commands

| Command | Description |
|---------|-------------|
| `npm run deploy -- patch` | Patch release (X.Y.Z → X.Y.Z+1) |
| `npm run deploy -- minor` | Minor release |
| `npm run deploy -- major` | Major release |
| `npm run deploy -- patch --dry-run` | Preview without changes |

### Pipeline Stages

1. **Pre-flight**: Dev mode off, git clean, main branch check
2. **Build & validate**: generate, tsc, version check
3. **Version bump**: sync across all 38+ files
4. **Git**: commit, tag, push
5. **GitHub Release**: `gh release create` with auto-generated notes
6. **Cache refresh**: clean old cache, copy allowlisted files, update installed_plugins.json

### Release Notes

Release notes go to GitHub Releases ONLY (https://github.com/HosungYou/Diverga/releases).
They are NOT stored as files in the repository. Written in English.

---

## Agent Teams Integration

### Configuration

`config/diverga-config.json`:
```json
{
  "agent_teams": {
    "enabled": false,
    "auto_activate": true,
    "scenarios": ["vs_arena", "systematic_review", "humanize_pipeline", "cross_method"]
  }
}
```

### Enable

1. Via setup wizard: `/diverga:setup` (Step 5)
2. Manual: set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `~/.claude/settings.json`

### Scenarios

| Scenario | Team Name | Teammates | Benefit |
|----------|-----------|-----------|---------|
| VS Arena | vs-arena-debate | 3 personas (V1-V5) | Direct cross-critique |
| Systematic Review | scholarag-pipeline | I1+I2+I3 | Parallel fetch/screen/RAG |
| Humanize | humanize-pipeline | G6+F5 | Direct verification loop |
| Cross-Method | method-comparison | C1+C2+C3 | Competing designs |

---

## Version History

See `CHANGELOG.md` (project root) for full version history.
