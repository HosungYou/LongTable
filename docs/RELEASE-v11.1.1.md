# Release Notes: Diverga v11.1.1

**Release Date**: 2026-03-13
**Tag**: `v11.1.1`
**Commits**: `5083053` (feat), `e7ba731` (release)

---

## What's New

### latex2omml — LaTeX to Word Equation Converter

Diverga now includes an internal Python package that converts LaTeX math expressions to native Word equations (OMML XML). This enables G2 (Publication Specialist) to generate journal-ready Word documents with properly rendered mathematical equations — no Pandoc, MS Office XSLT, or commercial libraries required.

**Package location**: `packages/latex2omml/`

**Supported LaTeX constructs**:
- Fractions (`\frac{a}{b}`), subscripts/superscripts (`x_{i}^{2}`)
- Greek letters (`\alpha` ... `\Omega`), 30+ mathematical symbols
- Text mode (`\text{hello world}`), accents (`\hat{x}`, `\bar{x}`, `\tilde{x}`)
- N-ary operators (`\sum`, `\prod`, `\int`), functions (`\log`, `\sin`, etc.)
- Square roots (`\sqrt{x}`, `\sqrt[n]{x}`), delimiters, operators

**API**:
```python
from latex2omml import add_display_equation, add_inline_equation

doc = Document()
p = doc.add_paragraph()
add_display_equation(p, r"\frac{a^2 + b^2}{c}")
```

**Test coverage**: 36 tests covering all constructs and real-world academic equations.

---

### G2 — Word Document Generation with Native Equations

G2 (Publication Specialist) now includes a complete section on generating Word documents with native OMML equations:

- Core pattern for display and inline equations
- Markdown-to-Word equation conversion pipeline
- Supported LaTeX quick reference table
- Journal-specific formatting guide (Elsevier CHB/IJHCS/C&E, APA 7th)

**Usage**: When G2 generates Word documents for journal submission, it can now render all LaTeX math as native Word equations instead of plain text approximations.

---

### G5 — LaTeX Syntax Validation (Category 7)

G5 (Academic Style Auditor) gains a new pattern category for detecting malformed LaTeX:

| ID | Pattern | Description |
|----|---------|-------------|
| X1 | Unclosed Math Delimiter | Unmatched `$` or `$$` |
| X2 | Missing Braces | `\frac{a}{b` missing `}` |
| X3 | Inconsistent Subscripts | `$R_b$` vs `$R_{b}$` in same document |
| X4 | Unescaped Underscores | `\text{p_value}` → `\text{p\_value}` |
| X5 | Double Dollar Misuse | `$$x$$` inline → `$x$` |
| X6 | Invalid Commands | `\fraq` → `\frac` |

Includes auto-fix rules and a tokenizer-based validation example using the latex2omml package.

---

### Pipeline Integration

```
Manuscript → G5 (LaTeX validation, X1-X6) → Auto-fix suggestions →
G2 (Word generation, latex2omml) → Native OMML equations → .docx
```

---

## Dependencies

New optional dependency group in `pyproject.toml`:

```toml
[project.optional-dependencies]
document = [
    "latex2omml @ file:packages/latex2omml",
    "python-docx>=0.8.11",
    "lxml>=4.0",
]
```

Install with: `pip install -e ".[document]"`

---

## Version Sync

All 38 version-bearing files updated from 11.1.0 → 11.1.1:
- `package.json`, `pyproject.toml`, `.claude-plugin/plugin.json`
- `config/diverga-config.json`, `src/index.ts`
- All 35 skill SKILL.md frontmatter `version` fields

---

## Files Changed

| File | Change |
|------|--------|
| `packages/latex2omml/` | New internal package (5 files, ~600 lines) |
| `packages/latex2omml/src/latex2omml/converter.py` | Core recursive-descent LaTeX parser |
| `packages/latex2omml/tests/test_converter.py` | 36 test cases |
| `skills/g2/SKILL.md` | +75 lines (Word equation generation section) |
| `skills/g5/SKILL.md` | +54 lines (LaTeX syntax patterns Category 7) |
| `pyproject.toml` | `document` optional dependency group |
| `CHANGELOG.md` | v11.1.1 entry |
| 38 files | Version sync 11.1.0 → 11.1.1 |

---

## Installation / Upgrade

### New users
```bash
/plugin marketplace add https://github.com/HosungYou/Diverga
/plugin install diverga
```

### Existing users
```bash
/plugin update diverga
```

### For development
```bash
cd Diverga && pip install -e ".[document]"
```

---

## Global Deployment Notes

- No `.pluginignore` file — all directories (including `skills/` and `packages/`) are included
- `plugin.json` explicitly declares `"skills": "./skills/"` for Claude Code skill discovery
- Marketplace installation performs full repository clone — users receive complete package
- Git tag `v11.1.1` created for version pinning
