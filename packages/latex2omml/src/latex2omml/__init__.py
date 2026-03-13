"""
latex2omml — Convert LaTeX math to native Word equations (OMML).

Quick start::

    from docx import Document
    from latex2omml import add_display_equation, add_inline_equation

    doc = Document()
    p = doc.add_paragraph()
    add_display_equation(p, r"E = mc^{2}")
    doc.save("out.docx")

Supports fractions, subscripts, superscripts, Greek letters, \\sum/\\prod,
\\text{}, \\hat{}, \\log/\\ln, and parenthesized groups.
"""

from latex2omml.converter import (
    add_display_equation,
    add_inline_equation,
    latex_to_omml_display,
    latex_to_omml_inline,
)

__version__ = "0.1.0"
__all__ = [
    "add_display_equation",
    "add_inline_equation",
    "latex_to_omml_display",
    "latex_to_omml_inline",
]
