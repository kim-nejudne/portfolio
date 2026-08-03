#!/usr/bin/env python3
"""
Generate the placeholder head layers.

These are NOT the artwork. They are flat vector stand-ins in the correct
proportions, stacking order and registration, written to the exact filenames
the real layers will use (see `src/head.ts`). Their whole job is to let the
choreography, the layout, the reduced-motion policy and the performance budget
be built and tuned before the photo shoot happens — so that dropping the real
art in is a file swap against timing that is already correct.

They are deliberately ugly. A placeholder that looks finished is a placeholder
that ships.

Every layer is drawn on the same 1200x1600 canvas and exported full-bleed, so
the layers register by construction rather than by offset arithmetic. The one
exception is the eye pair, which is cropped to a small box because it is
cross-faded every time the gaze changes and compositing a full-canvas texture
for two eyeballs is waste the mid-range phone in the perf budget cannot afford.
Its box is declared once, here and in `src/head.ts`, in canvas units.

Usage:  python3 scripts/placeholder-head.py
Needs:  rsvg-convert (librsvg), avifenc (libavif)
"""

import subprocess
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "head"

W, H = 1200, 1600

# --- the head's geometry, in canvas units -----------------------------------
# Everything below derives from these five numbers. The real art has to match
# them or the hinge will not land on the seam.
HEAD_CX, HEAD_CY = 600, 630
HEAD_RX, HEAD_RY = 280, 450          # head spans y 180..1080, x 320..880
CUT_Y = 430                          # where the cranium separates

# Half-width of the head at the cut line: 280 * sqrt(1 - ((430-630)/450)^2).
# The cavity ellipse has to be exactly this wide or the opening will not sit
# flush in the silhouette.
CAVITY_RX = 251
CAVITY_RY = 80                       # squashed: we are looking slightly down into it

SKY_RX, SKY_RY = 268, 102             # larger than the opening, smaller than the head:
                                     # it must have room to parallax and no room to spill

EYE_CY = 640
EYE_L_CX, EYE_R_CX = 505, 695
EYE_RX, EYE_RY = 52, 30

# The cropped box the eye layers are exported at. Declared in canvas units and
# mirrored as percentages in src/head.ts.
EYE_BOX = (430, 560, 340, 160)       # x, y, w, h

PAPER = "#F7F4EC"
INK = "#16181D"

# Placeholder tones. Flat greys, no halftone, no modelling — the point is that
# nobody can mistake these for the treatment.
TONE_BACK = "#8C8F96"                # rear of the skull, furthest back
TONE_CAVITY = "#6E727A"              # the inner wall
TONE_EDGE = "#C9CBD0"                # the paper-thickness band on every cut edge
TONE_LID = "#4A4E57"
TONE_UNDER = "#B4B7BE"               # what you see as the lid tips toward you
TONE_FACE = "#5C606A"
TONE_NECK = "#484C55"


def svg(body: str, width: int = W, height: int = H, vb: str | None = None) -> str:
    view = vb or f"0 0 {W} {H}"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="{view}">{body}</svg>'
    )


def head_path_clipped(y0: float, y1: float) -> str:
    """The head ellipse, clipped to a horizontal band. Used to cut the lid off
    the face along the same seam from both sides."""
    return (
        f'<clipPath id="band"><rect x="0" y="{y0}" width="{W}" height="{y1 - y0}"/></clipPath>'
        f'<g clip-path="url(#band)">'
        f'<ellipse cx="{HEAD_CX}" cy="{HEAD_CY}" rx="{HEAD_RX}" ry="{HEAD_RY}"/>'
        f"</g>"
    )


def layer_head_back() -> str:
    """Everything behind the cavity: the rear of the skull, and the far inner
    rim you see across the opening once the lid is up."""
    return svg(
        f'<g fill="{TONE_BACK}">{head_path_clipped(CUT_Y - 150, 1600)}</g>'
        # the far rim, arcing up behind the sky
        f'<path d="M {HEAD_CX - CAVITY_RX} {CUT_Y} '
        f"a {CAVITY_RX} {CAVITY_RY} 0 0 1 {CAVITY_RX * 2} 0 Z\" "
        f'fill="{TONE_BACK}"/>'
    )


def layer_sky() -> str:
    """The printed sky. Drawn larger than the opening so it can parallax inside
    the cavity without ever showing an edge. This is the only colour on the
    page besides the five crops — the rule the whole hub is built on."""
    dots = (
        '<pattern id="halftone" width="14" height="14" patternUnits="userSpaceOnUse">'
        '<circle cx="7" cy="7" r="3.1" fill="#ffffff" opacity="0.30"/>'
        "</pattern>"
    )
    grad = (
        f'<linearGradient id="sky" x1="0" y1="{CUT_Y - SKY_RY}" x2="0" y2="{CUT_Y + SKY_RY}" '
        f'gradientUnits="userSpaceOnUse">'
        '<stop offset="0" stop-color="#2F6BD8"/>'
        '<stop offset="1" stop-color="#8FC2F0"/>'
        "</linearGradient>"
    )
    # Clipped to the head. The cavity layer in front of it masks the opening's
    # rim, but only within the silhouette — anything wider than the head would
    # show as a crescent beside the ears. It did, the first time.
    clip = (
        f'<clipPath id="silhouette">'
        f'<ellipse cx="{HEAD_CX}" cy="{HEAD_CY}" rx="{HEAD_RX}" ry="{HEAD_RY}"/>'
        f"</clipPath>"
    )
    return svg(
        f"<defs>{grad}{dots}{clip}</defs>"
        f'<g clip-path="url(#silhouette)">'
        f'<ellipse cx="{HEAD_CX}" cy="{CUT_Y}" rx="{SKY_RX}" ry="{SKY_RY}" fill="url(#sky)"/>'
        f'<ellipse cx="{HEAD_CX}" cy="{CUT_Y}" rx="{SKY_RX}" ry="{SKY_RY}" fill="url(#halftone)"/>'
        f"</g>"
    )


def layer_cavity() -> str:
    """The inner rim and wall of the opening. This layer is what gives the head
    paper *thickness* — without it the sky reads as a hole cut in a photograph
    rather than the inside of a made object. It masks the oversized sky."""
    # A band across the head with the opening punched out of it (evenodd), so
    # the sky can only be seen through the ellipse.
    return svg(
        f"<defs>"
        f'<clipPath id="silhouette">'
        f'<ellipse cx="{HEAD_CX}" cy="{HEAD_CY}" rx="{HEAD_RX + 2}" ry="{HEAD_RY + 2}"/>'
        f"</clipPath>"
        f"</defs>"
        f'<g clip-path="url(#silhouette)" fill-rule="evenodd">'
        f'<path fill="{TONE_CAVITY}" d="'
        f"M 0 {CUT_Y - SKY_RY - 4} H {W} V {CUT_Y + 130} H 0 Z "
        f"M {HEAD_CX - CAVITY_RX} {CUT_Y} "
        f"a {CAVITY_RX} {CAVITY_RY} 0 1 0 {CAVITY_RX * 2} 0 "
        f"a {CAVITY_RX} {CAVITY_RY} 0 1 0 {-CAVITY_RX * 2} 0 Z"
        f'"/>'
        f"</g>"
        # the visible paper-thickness band along the cut edge
        f'<ellipse cx="{HEAD_CX}" cy="{CUT_Y}" rx="{CAVITY_RX}" ry="{CAVITY_RY}" '
        f'fill="none" stroke="{TONE_EDGE}" stroke-width="9"/>'
    )


def layer_lid() -> str:
    """The cranium. This is the piece that rotates, and its transform-origin is
    the hinge declared in src/head.ts — the back edge of the cut ellipse."""
    return svg(
        f'<g fill="{TONE_LID}">{head_path_clipped(0, CUT_Y)}</g>'
        f'<ellipse cx="{HEAD_CX}" cy="{CUT_Y}" rx="{CAVITY_RX}" ry="{CAVITY_RY}" '
        f'fill="{TONE_LID}"/>'
        # paper thickness, on the lid's own cut edge
        f'<path d="M {HEAD_CX - CAVITY_RX} {CUT_Y} '
        f"a {CAVITY_RX} {CAVITY_RY} 0 0 0 {CAVITY_RX * 2} 0\" "
        f'fill="none" stroke="{TONE_EDGE}" stroke-width="11"/>'
    )


def layer_lid_underside() -> str:
    """What you see as the lid tips toward you. Flat by design."""
    return svg(
        f'<g fill="{TONE_UNDER}">{head_path_clipped(0, CUT_Y)}</g>'
        f'<ellipse cx="{HEAD_CX}" cy="{CUT_Y}" rx="{CAVITY_RX}" ry="{CAVITY_RY}" '
        f'fill="{TONE_UNDER}"/>'
    )


def layer_face() -> str:
    """Brow down. The eye sockets are cut out as real transparent holes, so the
    eye layer behind shows through them and the gaze can change without
    redrawing the face."""
    sockets = (
        f'<ellipse cx="{EYE_L_CX}" cy="{EYE_CY}" rx="{EYE_RX}" ry="{EYE_RY}"/>'
        f'<ellipse cx="{EYE_R_CX}" cy="{EYE_CY}" rx="{EYE_RX}" ry="{EYE_RY}"/>'
    )
    return svg(
        f"<defs>"
        f'<mask id="holes">'
        f'<rect width="{W}" height="{H}" fill="white"/>'
        f'<g fill="black">{sockets}</g>'
        f"</mask>"
        f"</defs>"
        f'<g mask="url(#holes)">'
        f'<g fill="{TONE_FACE}">{head_path_clipped(CUT_Y, 1090)}</g>'
        f"</g>"
        # nose and mouth, enough to read as a face in silhouette
        f'<path d="M {HEAD_CX} 700 v 90 q 0 26 26 26 h 14" fill="none" '
        f'stroke="{TONE_EDGE}" stroke-width="8" stroke-linecap="round"/>'
        f'<path d="M {HEAD_CX - 66} 892 q 66 34 132 0" fill="none" '
        f'stroke="{TONE_EDGE}" stroke-width="9" stroke-linecap="round"/>'
    )


def layer_neck() -> str:
    return svg(
        f'<path fill="{TONE_NECK}" d="'
        f"M {HEAD_CX - 108} 1000 h 216 v 190 "
        f"C {HEAD_CX + 108} 1240 {HEAD_CX + 330} 1268 {HEAD_CX + 430} 1330 "
        f"L {HEAD_CX + 430} {H} H {HEAD_CX - 430} L {HEAD_CX - 430} 1330 "
        f"C {HEAD_CX - 330} 1268 {HEAD_CX - 108} 1240 {HEAD_CX - 108} 1190 Z"
        f'"/>'
    )


def layer_eyes(looking_up: bool) -> str:
    """The two gaze states, cropped to EYE_BOX and rendered in canvas
    coordinates so they register against the sockets with no offset maths.

    The iris is clipped to the eye white. Without that it simply floats up out
    of the socket, and the first attempt added a drooping upper lid to hide it
    — which read as sleepy rather than as looking up, the exact opposite of
    what the beat is for.
    """
    x, y, w, h = EYE_BOX
    iris_dy = -14 if looking_up else 0
    parts = []
    for i, cx in enumerate((EYE_L_CX, EYE_R_CX)):
        parts.append(
            f'<clipPath id="eye{i}">'
            f'<ellipse cx="{cx}" cy="{EYE_CY}" rx="{EYE_RX}" ry="{EYE_RY}"/>'
            f"</clipPath>"
            f'<ellipse cx="{cx}" cy="{EYE_CY}" rx="{EYE_RX}" ry="{EYE_RY}" fill="{PAPER}"/>'
            f'<g clip-path="url(#eye{i})">'
            f'<circle cx="{cx}" cy="{EYE_CY + iris_dy}" r="16" fill="{INK}"/>'
            f"</g>"
        )
    return svg("".join(parts), width=w, height=h, vb=f"{x} {y} {w} {h}")


LAYERS = {
    "head-back": layer_head_back,
    "sky": layer_sky,
    "cavity": layer_cavity,
    "lid": layer_lid,
    "lid-underside": layer_lid_underside,
    "face": layer_face,
    "neck": layer_neck,
    "eyes-forward": lambda: layer_eyes(False),
    "eyes-up": lambda: layer_eyes(True),
}


def need(tool: str) -> None:
    if subprocess.run(["which", tool], capture_output=True).returncode != 0:
        sys.exit(f"missing {tool}")


def main() -> None:
    need("rsvg-convert")
    need("avifenc")
    OUT.mkdir(parents=True, exist_ok=True)

    for name, draw in LAYERS.items():
        svg_path = OUT / f"{name}.svg"
        png_path = OUT / f"{name}.png"
        avif_path = OUT / f"{name}.avif"

        svg_path.write_text(draw())
        subprocess.run(["rsvg-convert", "-o", str(png_path), str(svg_path)], check=True)
        subprocess.run(
            ["avifenc", "-q", "72", "--speed", "4", str(png_path), str(avif_path)],
            check=True,
            capture_output=True,
        )
        svg_path.unlink()
        print(f"{name:16} png {png_path.stat().st_size:>7}  avif {avif_path.stat().st_size:>7}")


if __name__ == "__main__":
    main()
