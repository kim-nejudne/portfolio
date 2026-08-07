#!/usr/bin/env python3
"""
Pull one glyph out of the vendored variable font as an SVG path.

Run this to regenerate `public/favicon.svg`'s path data:

    python3 scripts/glyph-path.py K 700

Why a script rather than a hand-drawn mark: the favicon is a Bodoni K, and a
Didone drawn by hand is a Didone that looks *almost* right — the whole character
of the face is in the contrast between the stem and the hairlines, and eyeballing
that ratio is exactly the kind of thing a print background notices and everyone
else feels without being able to name. The letter on the page and the letter in
the tab strip come from the same file.

It is deliberately NOT wired into `brand.sh`. fontTools is not a dependency of
this project and should not become one for a file that changes when the display
face changes, which is to say almost never. Install it in a throwaway venv:

    python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools brotli
    /tmp/ft/bin/python scripts/glyph-path.py K 700

The path is committed. This script is here so the number can be re-derived rather
than trusted.
"""

import sys
from pathlib import Path

try:
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.misc.transform import Transform
except ImportError:
    sys.exit(__doc__.strip().split("Install it in a throwaway venv:")[-1].strip())

FONT = Path(__file__).resolve().parent.parent / "src/fonts/bodoni-moda-latin-wght-normal.woff2"

char = sys.argv[1] if len(sys.argv) > 1 else "K"
weight = float(sys.argv[2]) if len(sys.argv) > 2 else 700.0

font = TTFont(FONT)
# The vendored file is a variable font spanning wght 400-900. Pin it, so the
# outline is the one weight rather than the default master.
if "fvar" in font:
    font = instantiateVariableFont(font, {"wght": weight}, inplace=False)

glyph_name = font.getBestCmap()[ord(char)]
glyphs = font.getGlyphSet()
upem = font["head"].unitsPerEm

# Font coordinates are y-up from the baseline; SVG is y-down from the top. Flip
# through the em square so the path can be dropped into a viewBox of side `upem`
# with no transform attribute on the element.
pen = SVGPathPen(glyphs)
glyphs[glyph_name].draw(TransformPen(pen, Transform(1, 0, 0, -1, 0, upem)))

bounds = font["glyf"][glyph_name] if "glyf" in font else None
print(f"<!-- {char} @ wght {weight:.0f}, upem {upem} -->")
if bounds is not None and bounds.numberOfContours:
    print(
        f"<!-- ink box x {bounds.xMin}..{bounds.xMax}  "
        f"y {bounds.yMin}..{bounds.yMax} (y-up from baseline) -->"
    )
print(pen.getCommands())
