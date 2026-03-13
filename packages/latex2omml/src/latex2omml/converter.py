"""
Core LaTeX → OMML converter.

Converts LaTeX math strings to Office Math Markup Language (OMML) XML
elements that render as native equations in Microsoft Word.

Supported constructs:
    - Fractions: ``\\frac{a}{b}``
    - Subscripts / superscripts: ``x_{i}``, ``x^{2}``, ``x_{i}^{2}``
    - Greek letters: ``\\alpha`` … ``\\Omega``
    - Text mode: ``\\text{hello world}``
    - Accents: ``\\hat{x}``, ``\\bar{x}``, ``\\tilde{x}``, ``\\dot{x}``
    - N-ary operators: ``\\sum_{i=1}^{N}``, ``\\prod``, ``\\int``
    - Functions: ``\\log``, ``\\ln``, ``\\exp``, ``\\sin``, ``\\cos``, …
    - Delimiters: ``(…)``
    - Operators: ``+``, ``-``, ``=``, ``<``, ``>``
    - Symbols: ``\\times``, ``\\cdot``, ``\\pm``, ``\\leq``, ``\\geq``, …
    - Square roots: ``\\sqrt{x}``, ``\\sqrt[n]{x}``
"""

from __future__ import annotations

from lxml import etree

# ---------------------------------------------------------------------------
# Namespaces
# ---------------------------------------------------------------------------
MATH_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"
NSMAP = {"m": MATH_NS, "w": WORD_NS}


def _m(tag: str) -> str:
    return f"{{{MATH_NS}}}{tag}"


# ---------------------------------------------------------------------------
# Symbol tables
# ---------------------------------------------------------------------------
GREEK: dict[str, str] = {
    "alpha": "\u03B1", "beta": "\u03B2", "gamma": "\u03B3", "delta": "\u03B4",
    "epsilon": "\u03B5", "varepsilon": "\u03B5", "zeta": "\u03B6",
    "eta": "\u03B7", "theta": "\u03B8", "vartheta": "\u03D1",
    "iota": "\u03B9", "kappa": "\u03BA", "lambda": "\u03BB", "mu": "\u03BC",
    "nu": "\u03BD", "xi": "\u03BE", "pi": "\u03C0", "varpi": "\u03D6",
    "rho": "\u03C1", "varrho": "\u03F1", "sigma": "\u03C3",
    "varsigma": "\u03C2", "tau": "\u03C4", "upsilon": "\u03C5",
    "phi": "\u03C6", "varphi": "\u03D5", "chi": "\u03C7", "psi": "\u03C8",
    "omega": "\u03C9",
    # uppercase
    "Alpha": "\u0391", "Beta": "\u0392", "Gamma": "\u0393", "Delta": "\u0394",
    "Epsilon": "\u0395", "Zeta": "\u0396", "Eta": "\u0397", "Theta": "\u0398",
    "Iota": "\u0399", "Kappa": "\u039A", "Lambda": "\u039B", "Mu": "\u039C",
    "Nu": "\u039D", "Xi": "\u039E", "Pi": "\u03A0", "Rho": "\u03A1",
    "Sigma": "\u03A3", "Tau": "\u03A4", "Upsilon": "\u03A5", "Phi": "\u03A6",
    "Chi": "\u03A7", "Psi": "\u03A8", "Omega": "\u03A9",
}

SYMBOLS: dict[str, str] = {
    "times": "\u00D7", "cdot": "\u00B7", "cdots": "\u22EF",
    "ldots": "\u2026", "vdots": "\u22EE", "ddots": "\u22F1",
    "pm": "\u00B1", "mp": "\u2213",
    "leq": "\u2264", "le": "\u2264", "geq": "\u2265", "ge": "\u2265",
    "neq": "\u2260", "ne": "\u2260", "approx": "\u2248", "equiv": "\u2261",
    "sim": "\u223C", "propto": "\u221D",
    "infty": "\u221E", "partial": "\u2202", "nabla": "\u2207",
    "forall": "\u2200", "exists": "\u2203", "in": "\u2208", "notin": "\u2209",
    "subset": "\u2282", "supset": "\u2283",
    "cup": "\u222A", "cap": "\u2229",
    "to": "\u2192", "rightarrow": "\u2192", "leftarrow": "\u2190",
    "Rightarrow": "\u21D2", "Leftarrow": "\u21D0",
    "iff": "\u21D4", "Leftrightarrow": "\u21D4",
    "quad": "\u2003", "qquad": "\u2003\u2003",
}

NARY_OPS: dict[str, str] = {
    "sum": "\u2211", "prod": "\u220F", "coprod": "\u2210",
    "int": "\u222B", "iint": "\u222C", "iiint": "\u222D",
    "oint": "\u222E",
    "bigcup": "\u22C3", "bigcap": "\u22C2",
}

FUNCTIONS: set[str] = {
    "log", "ln", "exp", "sin", "cos", "tan", "cot", "sec", "csc",
    "arcsin", "arccos", "arctan",
    "sinh", "cosh", "tanh", "coth",
    "min", "max", "sup", "inf", "lim", "limsup", "liminf",
    "arg", "det", "dim", "gcd", "ker", "deg", "hom",
    "Pr", "var", "cov", "cor",
}

ACCENTS: dict[str, str] = {
    "hat": "\u0302",
    "widehat": "\u0302",
    "bar": "\u0305",
    "overline": "\u0305",
    "tilde": "\u0303",
    "widetilde": "\u0303",
    "dot": "\u0307",
    "ddot": "\u0308",
    "vec": "\u20D7",
    "check": "\u030C",
    "breve": "\u0306",
    "acute": "\u0301",
    "grave": "\u0300",
}


# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------
class _Tokenizer:
    """Break a LaTeX math string into (type, value) token pairs."""

    __slots__ = ("tokens", "idx")

    def __init__(self, text: str) -> None:
        self.tokens: list[tuple[str, str]] = []
        self.idx = 0
        self._scan(text)

    def _scan(self, s: str) -> None:  # noqa: C901 — intentionally flat for speed
        i, n = 0, len(s)
        toks = self.tokens
        while i < n:
            ch = s[i]
            if ch == "\\":
                j = i + 1
                if j < n and not s[j].isalpha():
                    toks.append(("CHAR", s[j]))
                    i = j + 1
                    continue
                while j < n and s[j].isalpha():
                    j += 1
                cmd = s[i + 1 : j]
                if cmd == "text":
                    k = j
                    while k < n and s[k] == " ":
                        k += 1
                    if k < n and s[k] == "{":
                        content, end = self._braced_raw(s, k)
                        content = content.replace("\\_", "_")
                        toks.append(("TEXT", content))
                        i = end
                        continue
                toks.append(("CMD", cmd))
                i = j
            elif ch == "{":
                toks.append(("LBRACE", ch)); i += 1
            elif ch == "}":
                toks.append(("RBRACE", ch)); i += 1
            elif ch == "_":
                toks.append(("SUB", ch)); i += 1
            elif ch == "^":
                toks.append(("SUP", ch)); i += 1
            elif ch == "(":
                toks.append(("LPAREN", ch)); i += 1
            elif ch == ")":
                toks.append(("RPAREN", ch)); i += 1
            elif ch == "[":
                toks.append(("LBRACKET", ch)); i += 1
            elif ch == "]":
                toks.append(("RBRACKET", ch)); i += 1
            elif ch in "+-=<>":
                toks.append(("OP", ch)); i += 1
            elif ch == " ":
                i += 1
            elif ch.isdigit():
                j = i
                while j < n and (s[j].isdigit() or s[j] == "."):
                    j += 1
                toks.append(("NUM", s[i:j])); i = j
            elif ch.isalpha():
                toks.append(("LETTER", ch)); i += 1
            elif ch == ",":
                toks.append(("COMMA", ch)); i += 1
            elif ch == "|":
                toks.append(("CHAR", ch)); i += 1
            else:
                toks.append(("CHAR", ch)); i += 1

    @staticmethod
    def _braced_raw(s: str, start: int) -> tuple[str, int]:
        depth, k = 1, start + 1
        n = len(s)
        while k < n and depth > 0:
            if s[k] == "\\":
                k += 2
            elif s[k] == "{":
                depth += 1; k += 1
            elif s[k] == "}":
                depth -= 1; k += 1
            else:
                k += 1
        return s[start + 1 : k - 1], k

    def peek(self) -> tuple[str, str] | None:
        return self.tokens[self.idx] if self.idx < len(self.tokens) else None

    def consume(self) -> tuple[str, str]:
        tok = self.tokens[self.idx]
        self.idx += 1
        return tok

    def has_more(self) -> bool:
        return self.idx < len(self.tokens)


# ---------------------------------------------------------------------------
# OMML builder (recursive-descent parser)
# ---------------------------------------------------------------------------
class _Builder:
    """Parse LaTeX tokens and emit OMML lxml elements."""

    def display(self, latex: str) -> etree._Element:
        """Return ``<m:oMathPara>`` for a display equation."""
        tok = _Tokenizer(latex)
        para = etree.Element(_m("oMathPara"), nsmap=NSMAP)
        omath = etree.SubElement(para, _m("oMath"))
        self._expr(tok, omath)
        return para

    def inline(self, latex: str) -> etree._Element:
        """Return ``<m:oMath>`` for an inline equation."""
        tok = _Tokenizer(latex)
        omath = etree.Element(_m("oMath"), nsmap=NSMAP)
        self._expr(tok, omath)
        return omath

    # ── grammar ──────────────────────────────────────

    def _expr(self, tok: _Tokenizer, parent: etree._Element) -> None:
        while tok.has_more():
            t = tok.peek()
            if t is None or t[0] in ("RBRACE", "RPAREN", "RBRACKET"):
                break
            self._element(tok, parent)

    def _element(self, tok: _Tokenizer, parent: etree._Element) -> None:
        t = tok.peek()
        if t is None:
            return
        tt, tv = t
        if tt == "CMD":
            self._cmd(tok, parent, tv)
        elif tt == "TEXT":
            tok.consume()
            self._scripts(tok, parent, self._run(tv, plain=True))
        elif tt == "LETTER":
            tok.consume()
            self._scripts(tok, parent, self._run(tv, italic=True))
        elif tt == "NUM":
            tok.consume()
            self._scripts(tok, parent, self._run(tv))
        elif tt == "OP":
            tok.consume()
            ch = "\u2212" if tv == "-" else tv
            parent.append(self._run(f" {ch} "))
        elif tt == "COMMA":
            tok.consume()
            parent.append(self._run(", "))
        elif tt == "CHAR":
            tok.consume()
            parent.append(self._run(tv))
        elif tt == "LPAREN":
            self._scripts(tok, parent, self._delimited(tok, "(", ")"))
        elif tt == "LBRACKET":
            self._scripts(tok, parent, self._delimited(tok, "[", "]"))
        elif tt == "LBRACE":
            tok.consume()
            self._expr(tok, parent)
            if tok.has_more() and tok.peek()[0] == "RBRACE":
                tok.consume()
        elif tt in ("SUB", "SUP"):
            self._scripts(tok, parent, self._run(""))
        else:
            tok.consume()

    def _cmd(self, tok: _Tokenizer, parent: etree._Element, cmd: str) -> None:
        if cmd == "frac":
            self._frac(tok, parent)
        elif cmd == "sqrt":
            self._sqrt(tok, parent)
        elif cmd in ACCENTS:
            self._scripts(tok, parent, self._accent(tok, cmd))
        elif cmd in NARY_OPS:
            self._nary(tok, parent)
        elif cmd in FUNCTIONS:
            self._func(tok, parent)
        elif cmd in GREEK:
            tok.consume()
            self._scripts(tok, parent, self._run(GREEK[cmd], italic=True))
        elif cmd in SYMBOLS:
            tok.consume()
            parent.append(self._run(SYMBOLS[cmd]))
        elif cmd in ("left", "right"):
            tok.consume()
            if tok.has_more() and tok.peek()[0] in (
                "LPAREN", "RPAREN", "LBRACKET", "RBRACKET", "CHAR",
            ):
                tok.consume()
        elif cmd == "mathrm":
            tok.consume()
            self._braced_plain(tok, parent)
        elif cmd == "mathbf":
            tok.consume()
            self._braced_bold(tok, parent)
        else:
            tok.consume()
            parent.append(self._run(cmd))

    # ── compound structures ──────────────────────────

    def _frac(self, tok: _Tokenizer, parent: etree._Element) -> None:
        tok.consume()
        f = etree.SubElement(parent, _m("f"))
        num = etree.SubElement(f, _m("num"))
        self._braced(tok, num)
        den = etree.SubElement(f, _m("den"))
        self._braced(tok, den)

    def _sqrt(self, tok: _Tokenizer, parent: etree._Element) -> None:
        tok.consume()
        rad = etree.SubElement(parent, _m("rad"))
        rad_pr = etree.SubElement(rad, _m("radPr"))

        # optional [n] for nth root
        if tok.has_more() and tok.peek()[0] == "LBRACKET":
            tok.consume()
            deg = etree.SubElement(rad, _m("deg"))
            while tok.has_more() and tok.peek()[0] != "RBRACKET":
                self._element(tok, deg)
            if tok.has_more() and tok.peek()[0] == "RBRACKET":
                tok.consume()
        else:
            # hide degree for square root
            deg_hide = etree.SubElement(rad_pr, _m("degHide"))
            deg_hide.set(_m("val"), "1")
            etree.SubElement(rad, _m("deg"))

        e = etree.SubElement(rad, _m("e"))
        self._braced(tok, e)

    def _accent(self, tok: _Tokenizer, cmd: str) -> etree._Element:
        tok.consume()
        acc = etree.Element(_m("acc"))
        pr = etree.SubElement(acc, _m("accPr"))
        ch = etree.SubElement(pr, _m("chr"))
        ch.set(_m("val"), ACCENTS[cmd])
        e = etree.SubElement(acc, _m("e"))
        self._braced(tok, e)
        return acc

    def _nary(self, tok: _Tokenizer, parent: etree._Element) -> None:
        cmd = tok.consume()[1]
        nary = etree.SubElement(parent, _m("nary"))
        pr = etree.SubElement(nary, _m("naryPr"))
        ch = etree.SubElement(pr, _m("chr"))
        ch.set(_m("val"), NARY_OPS[cmd])
        lim = etree.SubElement(pr, _m("limLoc"))
        lim.set(_m("val"), "undOvr")
        sub = etree.SubElement(nary, _m("sub"))
        sup = etree.SubElement(nary, _m("sup"))
        e = etree.SubElement(nary, _m("e"))
        if tok.has_more() and tok.peek()[0] == "SUB":
            tok.consume()
            self._braced(tok, sub)
        if tok.has_more() and tok.peek()[0] == "SUP":
            tok.consume()
            self._braced(tok, sup)
        self._expr(tok, e)

    def _func(self, tok: _Tokenizer, parent: etree._Element) -> None:
        cmd = tok.consume()[1]
        func = etree.SubElement(parent, _m("func"))
        etree.SubElement(func, _m("funcPr"))
        fn = etree.SubElement(func, _m("fName"))
        fn.append(self._run(cmd, plain=True))
        e = etree.SubElement(func, _m("e"))
        if tok.has_more() and tok.peek()[0] == "LPAREN":
            e.append(self._delimited(tok, "(", ")"))
        elif tok.has_more():
            self._element(tok, e)

    def _delimited(
        self, tok: _Tokenizer, open_ch: str, close_ch: str,
    ) -> etree._Element:
        tok.consume()
        d = etree.Element(_m("d"))
        pr = etree.SubElement(d, _m("dPr"))
        bc = etree.SubElement(pr, _m("begChr"))
        bc.set(_m("val"), open_ch)
        ec = etree.SubElement(pr, _m("endChr"))
        ec.set(_m("val"), close_ch)
        e = etree.SubElement(d, _m("e"))
        close_tok = "RPAREN" if close_ch == ")" else "RBRACKET"
        while tok.has_more():
            if tok.peek()[0] == close_tok:
                tok.consume()
                break
            self._element(tok, e)
        return d

    # ── helpers ──────────────────────────────────────

    def _braced(self, tok: _Tokenizer, parent: etree._Element) -> None:
        if tok.has_more() and tok.peek()[0] == "LBRACE":
            tok.consume()
            self._expr(tok, parent)
            if tok.has_more() and tok.peek()[0] == "RBRACE":
                tok.consume()
        elif tok.has_more():
            self._element(tok, parent)

    def _braced_plain(self, tok: _Tokenizer, parent: etree._Element) -> None:
        if tok.has_more() and tok.peek()[0] == "LBRACE":
            tok.consume()
            text_parts = []
            while tok.has_more() and tok.peek()[0] != "RBRACE":
                text_parts.append(tok.consume()[1])
            if tok.has_more():
                tok.consume()
            parent.append(self._run("".join(text_parts), plain=True))

    def _braced_bold(self, tok: _Tokenizer, parent: etree._Element) -> None:
        if tok.has_more() and tok.peek()[0] == "LBRACE":
            tok.consume()
            text_parts = []
            while tok.has_more() and tok.peek()[0] != "RBRACE":
                text_parts.append(tok.consume()[1])
            if tok.has_more():
                tok.consume()
            parent.append(self._run("".join(text_parts), bold=True))

    def _scripts(
        self, tok: _Tokenizer, parent: etree._Element, base: etree._Element,
    ) -> None:
        has_sub = has_sup = False
        sub_el = sup_el = None
        if tok.has_more() and tok.peek()[0] == "SUB":
            has_sub = True
            tok.consume()
            sub_el = etree.Element(_m("sub"))
            self._braced(tok, sub_el)
        if tok.has_more() and tok.peek()[0] == "SUP":
            has_sup = True
            tok.consume()
            sup_el = etree.Element(_m("sup"))
            self._braced(tok, sup_el)
        if has_sub and has_sup:
            w = etree.SubElement(parent, _m("sSubSup"))
            etree.SubElement(w, _m("e")).append(base)
            w.append(sub_el)
            w.append(sup_el)
        elif has_sub:
            w = etree.SubElement(parent, _m("sSub"))
            etree.SubElement(w, _m("e")).append(base)
            w.append(sub_el)
        elif has_sup:
            w = etree.SubElement(parent, _m("sSup"))
            etree.SubElement(w, _m("e")).append(base)
            w.append(sup_el)
        else:
            parent.append(base)

    @staticmethod
    def _run(
        text: str,
        *,
        italic: bool = False,
        bold: bool = False,
        plain: bool = False,
    ) -> etree._Element:
        r = etree.Element(_m("r"))
        rpr = etree.SubElement(r, _m("rPr"))
        sty = etree.SubElement(rpr, _m("sty"))
        if bold and italic:
            sty.set(_m("val"), "bi")
        elif bold:
            sty.set(_m("val"), "b")
        elif italic:
            sty.set(_m("val"), "i")
        else:
            sty.set(_m("val"), "p")
        t = etree.SubElement(r, _m("t"))
        t.text = text
        t.set(f"{{{XML_NS}}}space", "preserve")
        return r


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_builder = _Builder()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def latex_to_omml_display(latex: str) -> etree._Element:
    """Convert a LaTeX string to an ``<m:oMathPara>`` element (display).

    Args:
        latex: LaTeX math expression *without* ``$$`` delimiters.

    Returns:
        An lxml ``Element`` that can be appended to a ``python-docx``
        paragraph's ``_element``.
    """
    return _builder.display(latex)


def latex_to_omml_inline(latex: str) -> etree._Element:
    """Convert a LaTeX string to an ``<m:oMath>`` element (inline).

    Args:
        latex: LaTeX math expression *without* ``$`` delimiters.

    Returns:
        An lxml ``Element``.
    """
    return _builder.inline(latex)


def add_display_equation(paragraph, latex: str) -> None:
    """Insert a native Word display equation into a *python-docx* paragraph.

    Example::

        from docx import Document
        from latex2omml import add_display_equation

        doc = Document()
        p = doc.add_paragraph()
        add_display_equation(p, r"\\frac{a}{b}")
        doc.save("out.docx")

    Args:
        paragraph: A ``python-docx`` ``Paragraph`` object.
        latex: LaTeX math string (without ``$$``).
    """
    paragraph._element.append(latex_to_omml_display(latex))


def add_inline_equation(paragraph, latex: str) -> None:
    """Insert a native Word inline equation into a *python-docx* paragraph.

    Args:
        paragraph: A ``python-docx`` ``Paragraph`` object.
        latex: LaTeX math string (without ``$``).
    """
    paragraph._element.append(latex_to_omml_inline(latex))
