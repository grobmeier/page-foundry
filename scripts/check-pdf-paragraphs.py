# Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0.
"""Check compiled paragraph-proof geometry. Requires pdfplumber; reads neutral proofs only."""

import sys
from pathlib import Path

import pdfplumber


def marker_top(chars, marker):
    text = "".join(char["text"] for char in chars)
    assert text.count(marker) == 1, f"Missing or repeated {marker}"
    start = text.index(marker)
    # Proof markers use one ASCII code point per glyph.
    assert all(len(char["text"]) == 1 for char in chars)
    return chars[start]["top"]


directory = Path(sys.argv[1])
checked = 0
for size in (8, 11, 20):
    for extra_mm in (0, 3, 12):
        for profile in ("a4", "us-letter", "paperback"):
            path = directory / f"paragraphs-{size}-{extra_mm}-{profile}.pdf"
            with pdfplumber.open(path) as pdf:
                assert len(pdf.pages) == 1, f"Unexpected pagination: {path.name}"
                chars = pdf.pages[0].chars
                alpha, beta, gamma, delta, final = (
                    marker_top(chars, marker)
                    for marker in ("AlphaLine", "BetaLine", "GammaLine", "DeltaLine", "FinalLine")
                )
                line_advance = beta - alpha
                expected = line_advance + extra_mm * 72 / 25.4
                assert line_advance > 0, f"Reversed lines: {path.name}"
                assert abs((delta - gamma) - line_advance) < 0.1, path.name
                for advance in (gamma - beta, final - delta):
                    assert abs(advance - expected) < 0.1, (
                        f"{path.name}: paragraph advance {advance:.2f}pt, "
                        f"expected {expected:.2f}pt"
                    )
                checked += 1
print(f"Paragraph geometry: {checked} compiled PDFs passed.")
