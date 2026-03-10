# Humanization Pipeline

Transform AI-generated academic text into natural, human-sounding prose while preserving scholarly integrity. Based on Wikipedia's AI Cleanup initiative's 24+4 pattern categories (including S7-S10 structural patterns), adapted for academic writing.

**Reference**: https://github.com/HosungYou/humanizer

---

## Pipeline Overview (v3.0 Multi-Pass, 4-Layer)

```
Content Generation (G2/G3) --> G5 Analysis --> Checkpoint -->
  Pass 1: G6 Vocab (Layer 1-2) --> F5 Quick --> CP_PASS1_REVIEW -->
  Pass 2: G6 Structural (Layer 3) --> F5 Full --> CP_PASS2_REVIEW -->
  Pass 3: G6 Discourse (Layer 4, DT1-DT4) --> F5 Full --> CP_PASS3_REVIEW -->
  [Pass 4 optional: G6 Polish --> F5 Full --> CP_FINAL_REVIEW] -->
  Export
```

After each G6 transform, G5 rescan and F5 verify run **in parallel** (both are read-only on the same G6 output).

```
G6 transform --> [G5 rescan || F5 verify] --> Checkpoint
```

---

## Agents

| Agent | Role | Model |
|-------|------|-------|
| G5-AcademicStyleAuditor v3.0 | AI pattern detection (28 categories, 7 domains) + 13 quantitative metrics + v3.0 composite (6 components) | Sonnet |
| G6-AcademicStyleHumanizer v3.0 | 4-layer transformation (vocab/phrase/structure/discourse) with DT1-DT4 + perturbation naturalization | Opus |
| F5-HumanizationVerifier v3.0 | 8 verification domains including discourse naturalness + v3.0 composite verification | Haiku |

---

## Commands

| Command | Description |
|---------|-------------|
| `"Check AI patterns"` | Run G5 analysis, show pattern report |
| `"Humanize my draft"` | Full multi-pass pipeline with balanced mode |
| `"Humanize (conservative)"` | Minimal changes, high-risk only |
| `"Humanize (aggressive)"` | Maximum naturalness |
| `"Humanize to target: 30%"` | Target-based multi-pass pipeline |
| `"Humanize (multi-pass)"` | Explicit multi-pass with all checkpoints |
| `"Humanize (journal_safe)"` | Preset target: 30% |
| `"Humanize (conference)"` | Preset target: 40% |
| `"Export with humanization"` | Run pipeline before export |

---

## Transformation Modes

| Mode | Target | Layers | Best For |
|------|--------|--------|----------|
| **Conservative** | High-risk patterns only | Layer 1-2 (vocabulary + phrase) | Journal submissions |
| **Balanced** | High + medium + structural | Layer 1-3 (+ structure) | Most academic writing |
| **Balanced (Fast)** | Same as Balanced, merged pass | Layer 1-3 (single G6 call) | Same quality, fewer steps |
| **Aggressive** | All patterns + discourse | Layer 1-4 (+ discourse DT1-DT4) | Maximum naturalness |

---

## Checkpoints

| Checkpoint | Level | When |
|------------|-------|------|
| CP_HUMANIZATION_REVIEW | Recommended | After G5 analysis, before transformation |
| CP_PASS1_REVIEW | Recommended | After vocabulary pass (Rich Checkpoint v2.0) |
| CP_PASS2_REVIEW | Recommended | After structural pass (Rich Checkpoint v2.0) |
| CP_PASS3_REVIEW | Recommended | After discourse pass (Rich Checkpoint v2.0) |
| CP_FINAL_REVIEW | Optional | After polish pass, before export |
| CP_HUMANIZATION_VERIFY | Optional | Post-humanization verification review |

---

## Typographic Character Enforcement

All G6 output MUST use proper Unicode typographic characters:
- **Em dash**: -- (U+2014), NEVER `--`
- **En dash**: -- (U+2013) for number ranges (years, ages, pages)
- **Smart quotes**: curly quotes (U+201C/D, U+2018/9), NEVER straight quotes

F5 verification MUST flag any remaining `--` as a **FAIL condition**.

---

## Section-Selective Humanization

The pipeline supports the `sections` parameter to transform only specific manuscript sections (e.g., `["discussion", "conclusion"]`). Non-selected sections pass through unchanged. Users can modify section selection at any Rich Checkpoint.

## Target Score Auto-Stop

Users set a `target_score` (default: 30%) at STAGE 0. When the score reaches the target, the pipeline auto-recommends "Accept" at the next checkpoint. Users can always override and continue.

---

## Ethics Note

Humanization helps express ideas naturally -- it does NOT make AI use "undetectable." Researchers should follow institutional and journal AI disclosure policies.

See: `.claude/skills/research-coordinator/ethics/ai-writing-ethics.md`
