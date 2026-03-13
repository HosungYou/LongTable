# latex2omml

Convert LaTeX math expressions to native Word equations (OMML) via python-docx.

Part of the [Diverga](https://github.com/HosungYou/Diverga) research agent platform.

## Usage

```python
from docx import Document
from latex2omml import add_display_equation, add_inline_equation

doc = Document()

# Display equation (centered, on its own line)
p = doc.add_paragraph()
add_display_equation(p, r"\frac{a^2 + b^2}{c}")

# Inline equation (within text)
p = doc.add_paragraph()
p.add_run("Einstein's equation ")
add_inline_equation(p, "E = mc^{2}")
p.add_run(" changed physics.")

doc.save("equations.docx")
```

## Supported LaTeX

Fractions, subscripts, superscripts, Greek letters, text mode, accents (hat, bar, tilde, dot, vec),
n-ary operators (sum, prod, int), functions (log, sin, cos, ...), square roots, delimiters,
operators, and 30+ mathematical symbols.

## Key Differentiator

Zero external dependencies beyond lxml and python-docx. No Pandoc, no MS Office XSLT, no commercial libraries.
Pure Python recursive-descent parser that produces native OMML XML.

## Integration with Diverga Agents

- **G2 (Publication Specialist)**: Generates Word documents with native equations
- **G5 (Style Auditor)**: Validates LaTeX syntax in manuscripts
