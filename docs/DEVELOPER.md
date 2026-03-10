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

## Testing Skills

```bash
# After editing SKILL.md, sync to plugin directory:
cp ".claude/skills/your-skill/SKILL.md" \
   ~/.claude/plugins/diverga/.claude/skills/your-skill/SKILL.md

# Restart Claude Code for changes to take effect
/exit
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

## Version History

See `docs/CHANGELOG.md` for full version history.
