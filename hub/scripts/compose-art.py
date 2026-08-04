#!/usr/bin/env python3
"""
Compose Kim's cut layers onto the shared artboard.

The layers arrive from Photopea trimmed to their own content, which throws away
the one thing the whole piece depends on: a shared origin. Every layer in
`public/head/` has to be the same size and register pixel-for-pixel, or the lid
hinges away from a seam that is somewhere else.

So this script is the seam between "art as cut" and "art as shipped". It knows
two things and nothing else — where each source sits relative to the face, and
how the composite maps onto the artboard — and it writes every layer through the
same transform, which is what makes registration a property of the build rather
than something to get right nine times by hand.

    python3 scripts/compose-art.py

Re-run it whenever a layer is re-cut. It is idempotent and it overwrites.

## Adding a layer

Cut it **without moving the canvas** — in Photopea, keep the document the size of
the original photo and export the layer with "trim transparent pixels" OFF. Then
its offset here is (0, 0) and there is nothing to recover. Add a line to SOURCES.

If you do trim it, `scripts/align-art.py` recovers the offset by matching cut
edges — that is how LID_OFFSET below was found. Recovering is a fallback, not
the plan; exporting untrimmed is free.

Everything downstream is measured off whatever lands here, so re-cutting the art
means re-measuring `HINGE` and `LID_ANGLE` and letting `npm run verify` re-derive
`HEAD_OPEN_RISE`. None of those three are constants of the design; they are
constants of the drawing.
"""

from pathlib import Path
import math
import subprocess
import sys

try:
    import numpy as np
    from PIL import Image, ImageChops, ImageDraw
except ImportError:
    sys.exit("needs Pillow and numpy:  pip install --user Pillow numpy")

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"
OUT = ROOT / "public" / "head"

# --- the artboard -----------------------------------------------------------
# `src/head.ts` works in a 1200x1600 coordinate space. The output multiplier is
# a judgement about the *source*, not a constant: at 2x the artboard wants an
# 1800px head, and the drawing supplies 856px, so it would be a 2.1x Lanczos
# upscale of pen line — which invents nothing and softens hairlines. 1.5x asks
# for 1350px, still an upscale but a modest one, and covers a retina desktop
# where the head occupies ~58vh (about 1044 device pixels on a 1440x900 screen
# at DPR 2). Raise it when a denser scan arrives; there is no point before.
CANVAS_W, CANVAS_H = 1200, 1600
SCALE_OUT = 1.5

# --- where each source sits, in the face layer's pixel coordinates ----------
# The face is the origin by definition. The lid was trimmed on export, so its
# offset was recovered by `align-art.py` from the tear the two share.
#
# That recovery reports ~30px RMS and flags itself SUSPECT, which is the tool
# being right to be suspicious and wrong about the cause. The scales agree
# exactly, but this cut is a drawing, and the lid's bottom edge trails wispy pen
# strokes past the tear line while the face's edge does not. Per-column extremes
# disagree by the length of a stray hair.
#
# For this cut the offset did not have to be trusted on that evidence alone. The
# second cut is the *same master* re-cut lower, so the new lid could be
# correlated against the old one directly: it matches at (-12, 0) in the old
# lid's coordinates with a mean absolute difference of **0.0** over 149,307
# pixels — identical pixels, not merely a good fit. Carried through the old
# registration that gives exactly (376, -467), which is what align-art.py says
# on its own. Two independent methods, one answer.
#
# The offset on x is Kim's, by eye, after looking at the composed page: the tear
# reads better with the lid a touch right of where both measurements put it. It
# is a nudge and not a correction — the measured value is 376, and the sum is
# what the page uses. Note the base below has since been moved to 380 by hand as
# well, so the by-eye component is 4 + NUDGE_X_CSS_PX and not just the nudge.
#
# **Asked for in screen pixels, so it is converted rather than pasted in.** A
# source pixel is not a CSS pixel and the ratio is not close to one: the chain is
# source -> artboard (x SCALE_OUT-relative `scale`, 1.577) -> canvas units
# (/ SCALE_OUT) -> CSS (x the head element's height over 1600). At the desktop
# reference — a 900px-tall viewport, where `HEAD_HEIGHT_VH` puts the artboard at
# 928px — that is 0.610 CSS px per source pixel, so 2 on screen is 3.28 here.
# Taking "2px" at face value would have moved it 1.22 CSS px, a little over half
# of what was asked for.
#
# It is exact only at that viewport height. The head is sized in `vh`, so a
# taller window makes every source pixel worth more on screen. There is nothing
# to fix in that — a nudge judged by eye at one size is a nudge judged by eye —
# but it is why the reference is written down rather than the ratio alone.
NUDGE_X_CSS_PX = 2 / 0.6098
LID_OFFSET = (380 + NUDGE_X_CSS_PX, -467)

SOURCES = {
    # layer name  ->  (file, offset in the face layer's coordinates)
    # Kim's names: the drawing was torn in two, top and bottom. `head_top` is
    # the lid — hair and forehead, everything above the tear.
    "face": ("head_bottom.png", (0, 0)),
    "lid": ("head_top.png", LID_OFFSET),
    # The sky shares the lid's offset by construction: it is the same cap, filled
    # in. Draw it on a layer *under* the lid in the same document and export that
    # layer alone, and there is nothing to align.
    "sky": ("sky_cut.png", LID_OFFSET),
}

# --- the sky ----------------------------------------------------------------
# Layers clipped so they cannot paint where another layer's ink already is.
#
# The sky is what shows through the hole the lid leaves. `face.png` is entirely
# transparent above the tear — its ink starts exactly where the cut does — so the
# head already opens onto nothing and the sky needs no drawn cavity behind it.
# What it does need is a bottom edge that stops at the tear, and taking that from
# the face's own alpha is free and exact. Paint the sky as far past the tear as is
# convenient; overlap costs nothing and a gap is a visible seam.
CLIPPED_BY = {"sky": "face"}

# --- three ways to supply the sky, in order of preference -------------------
#
# The *shape* of the sky is not worth drawing. It is the missing cap: its width
# is the head's own width at the tear, its rise is the height of the lid, and
# its bottom edge is the face's alpha. All three are already in the two cuts, so
# the dome is derived and only the **fill** has to come from outside.
#
#   1. art/sky-fill.png   any rectangle of colour and texture. No transparency,
#                         no alignment, no size to hit — it is cover-fitted
#                         through the derived dome. This is the easy one, and it
#                         is what an image model is actually good at.
#   2. art/sky_cut.png    a cut layer with its own alpha, placed at LID_OFFSET
#                         like the lid. Use this to draw a silhouette that is
#                         not the derived dome.
#   3. neither            a flat placeholder in the dome, in the tradition of
#                         the nine grey layers this piece was built against:
#                         correct in position, size and stacking, and honest
#                         about being a shape rather than a drawing.
SKY_FILL = "sky-fill.png"

# The fill in `art/` is a riso-style sky from an image model, with one manual
# step that has to be repeated if it is ever regenerated: **crop the border
# off**. The model printed the sky as a block on a sheet of cream paper, and a
# cream margin inside the dome reads as a ring, not as paper. `-trim` will not
# find it — the border has grain, so it is not uniform. What does find it is the
# hue: the print is cool and the paper is warm, so thresholding blue-minus-red
# isolates the block exactly. Then inset ~1%, because the block's own edge
# carries a lighter rim.

# Flat on purpose. A gradient here would start to look like a decision, and the
# only decision a placeholder is entitled to make is "there is colour behind the
# cut".
SKY_PLACEHOLDER_RGB = (0x6F, 0x8C, 0xA8)

# Layers a source already contains, written as fully transparent.
#
# The face was cut with the neck, collar and shoulders attached. Blanking is not
# the same as deleting: the layer stays in STACK, costs one cached empty PNG,
# and becomes real the day a neck is cut separately.
SUBSUMED = {"neck": "head_bottom.png"}

# --- how the composite maps onto the artboard -------------------------------
# Measured off the face layer, in its own pixels. The crown is the top of the lid;
# the chin is where the jaw stops and the collar takes over.
#
# The second cut moved the tear down to the brow, so the face layer starts 191px
# lower than it used to and every y here moved with it. Crown to chin is 856px in
# both cuts, which is the useful check: the *scale* did not change, so the drawing
# lands on the artboard exactly where it did and nothing in the layout had to move.
CROWN_Y = LID_OFFSET[1]          # -467
CHIN_Y = 389                     # where the jaw stops and the collar flares out
HEAD_CENTRE_X = 764              # midpoint of the head at its widest

# The framing: reproduce the placeholder's, so the timing tuned against it still
# holds on the first run. Head crown to chin fills 900 of the 1600-unit canvas,
# with the crown 180 units down. Both are then re-derived by `npm run verify`
# from what actually got drawn, so these are a starting point and not a claim.
HEAD_TOP_UNITS = 180
HEAD_HEIGHT_UNITS = 900


def tear_edge(face: Image.Image) -> tuple[list, int, int, int]:
    """The tear itself, column by column, separated from the shoulders.

    Returns `(top, left, right, peak_y)` — the topmost row of face ink in each
    column, the span of columns that belong to the cut, and the tear's highest
    point.

    **The separation is the whole job.** `face.png` is transparent above the
    tear, so the topmost ink in a column is the tear — but only for columns that
    have a tear. Outside the head the topmost ink is his shoulders, hundreds of
    rows further down, and any measurement that mixes the two is measuring a
    shape nobody drew.

    So walk out from the tear's highest point while the edge stays *continuous*.
    Neighbouring columns of a hand-drawn tear differ by a pixel or two; the drop
    into the shoulders is a cliff of several hundred. Anything between those two
    scales works as the threshold and none of it is a tuned number.
    """
    a = np.array(face.getchannel("A")) > 128
    h, w = a.shape
    top = [None] * w
    for x in range(w):
        ys = np.nonzero(a[:, x])[0]
        if len(ys):
            top[x] = int(ys[0])

    inked = [x for x in range(w) if top[x] is not None]
    if not inked:
        raise SystemExit("the face layer has no ink — nothing to cut a sky from")
    peak = min(inked, key=lambda x: top[x])

    cliff = h * 0.02  # two per cent of the artboard: far above the tear's own
    left = right = peak  # wobble, far below the drop into the shoulders
    while left > 0 and top[left - 1] is not None and abs(top[left - 1] - top[left]) < cliff:
        left -= 1
    while right < w - 1 and top[right + 1] is not None and abs(top[right + 1] - top[right]) < cliff:
        right += 1
    return top, left, right, top[peak]


def dome_mask(face: Image.Image, lid: Image.Image) -> tuple[Image.Image, tuple, str]:
    """The shape of the missing cap: **a circle**, derived from the face alone.

    Centred on the middle of the tear and on the tear's highest point, so the
    upper half is the dome and the lower half runs under the face to be clipped
    away by it. The radius is **the smallest that contains the whole tear** —
    the furthest any point of the cut lies from that centre. That is a
    derivation rather than a fitting, and it is the one that matters: a sky
    narrower than the mouth it fills leaves paper showing inside the opening,
    and overlap past the tear costs nothing because the face clips it.

    **It was an ellipse and Kim asked for a circle**, which gives up a property
    worth naming rather than losing quietly. The ellipse took its height from the
    lid — the cap rose exactly as far as the piece that swung away — so the sky
    filled precisely the volume the lid vacated and the open head was exactly as
    tall as the closed head. A circle cannot do that, because the two numbers are
    independent, and `HEAD_OPEN_RISE` came down to match. In exchange the shape
    stops depending on the lid at all, so re-cutting the hair can no longer move
    the sky.

    Two earlier versions were wrong about the width, and both are the same
    mistake — measuring the head somewhere other than at the cut.

    1. **The lid's bounding box**, which is much wider than his skull because
       the hair sweeps out to one side. It rendered as a blue disc behind him
       instead of a hole in his head.
    2. **A fixed 60-row band below the topmost face pixel.** That reads as a
       reasonable proxy for "the head's width at the tear" and it is not, because
       the tear is a *wave*: its high point is at x 849 and its left end sits 86
       units lower, so a band 40 canvas units deep never reached the left half of
       the cut. It measured x 360–1037 of a tear that actually spans 210–1020,
       and centred the circle 83 units right of the opening — visibly off, with
       the left end of his brow opening onto bare paper. It survived a re-cut, a
       shape change and a full verify run, because nothing in the suite looks at
       whether the sky fills the hole.

    Returns the mask, the box it occupies, and a line for the build log.
    """
    if not face.getchannel("A").getbbox() or not lid.getchannel("A").getbbox():
        raise SystemExit("cannot derive the sky's shape without face and lid")

    top, left, right, tear_top = tear_edge(face)
    cx, cy = (left + right) / 2, tear_top
    r = max(math.hypot(x - cx, top[x] - cy) for x in range(left, right + 1))

    box = (cx - r, cy - r, cx + r, cy + r)
    mask = Image.new("L", face.size, 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    return mask, box, (
        f"circle r{int(r)} centred ({int(cx)}, {int(cy)}) on a tear "
        f"spanning x{left}..{right}"
    )


def fill_dome(mask: Image.Image, box: tuple, texture: Image.Image | None) -> Image.Image:
    """Put something inside the dome: a supplied texture, or a flat colour.

    The texture is cover-fitted to the dome's own box rather than to the whole
    artboard, so its grain lands at the size it was drawn at instead of being
    stretched across a canvas four times too big.
    """
    img = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    if texture is None:
        img.paste((*SKY_PLACEHOLDER_RGB, 255), (0, 0) + mask.size)
    else:
        bw, bh = int(box[2] - box[0]), int(box[3] - box[1])
        k = max(bw / texture.width, bh / texture.height)
        t = texture.convert("RGB").resize(
            (max(bw, int(texture.width * k)), max(bh, int(texture.height * k))),
            Image.LANCZOS,
        )
        # Centre-crop to the box, then paste it where the box is.
        ox, oy = (t.width - bw) // 2, (t.height - bh) // 2
        img.paste(t.crop((ox, oy, ox + bw, oy + bh)), (int(box[0]), int(box[1])))
    img.putalpha(mask)
    return img


def clip_out(layer: Image.Image, cutter: Image.Image) -> Image.Image:
    """Erase `layer` wherever `cutter` has ink, softly where the ink is soft."""
    keep = ImageChops.invert(cutter.getchannel("A"))
    out = layer.copy()
    out.putalpha(ImageChops.multiply(layer.getchannel("A"), keep))
    return out


def main() -> None:
    if not ART.is_dir():
        sys.exit(f"no source art at {ART}")

    scale = (HEAD_HEIGHT_UNITS * SCALE_OUT) / (CHIN_Y - CROWN_Y)
    out_w, out_h = int(CANVAS_W * SCALE_OUT), int(CANVAS_H * SCALE_OUT)

    # Where the face layer's origin lands on the artboard, in output pixels.
    origin_x = (out_w / 2) - (HEAD_CENTRE_X * scale)
    origin_y = (HEAD_TOP_UNITS * SCALE_OUT) - (CROWN_Y * scale)

    print(f"artboard {out_w}x{out_h}   scale {scale:.5f}")
    print(f"face origin lands at ({origin_x:.1f}, {origin_y:.1f})\n")

    for name, owner in SUBSUMED.items():
        if not (ART / owner).exists():
            continue
        blank = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
        png = OUT / f"{name}.png"
        blank.save(png, optimize=True)
        subprocess.run(
            ["avifenc", "-q", "57", "-s", "6", str(png), str(OUT / f"{name}.avif")],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        print(f"  {name:<14} blank — carried by {owner}")

    # Compose every layer first, then clip, then write. `CLIPPED_BY` needs a
    # layer to already be on the artboard before another can be cut against it,
    # and doing it in artboard space rather than source space means the cutter
    # and the cut are the same pixels the browser will see.
    placed: dict[str, Image.Image] = {}
    notes: dict[str, str] = {}

    for name, (filename, (dx, dy)) in SOURCES.items():
        src = ART / filename
        if not src.exists():
            print(f"  skip {name:<14} {filename} not in art/")
            continue
        img = Image.open(src).convert("RGBA")

        w, h = int(round(img.width * scale)), int(round(img.height * scale))
        img = img.resize((w, h), Image.LANCZOS)

        canvas = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
        canvas.alpha_composite(
            img,
            (int(round(origin_x + dx * scale)), int(round(origin_y + dy * scale))),
        )
        placed[name] = canvas

    # The dome is built last and in artboard space, because it derives its shape
    # from the two real cuts once they are registered.
    if "sky" not in placed and {"face", "lid"} <= placed.keys():
        mask, box, how = dome_mask(placed["face"], placed["lid"])
        fill = ART / SKY_FILL
        texture = Image.open(fill) if fill.exists() else None
        placed["sky"] = fill_dome(mask, box, texture)
        notes["sky"] = (
            f"{how}, filled with {SKY_FILL}"
            if texture is not None
            else f"PLACEHOLDER {how} — drop a texture at art/{SKY_FILL}"
        )

    for name, cutter in CLIPPED_BY.items():
        if name not in placed or cutter not in placed:
            continue
        placed[name] = clip_out(placed[name], placed[cutter])

        # Assert the clip here rather than in the browser, because here is where
        # the property is created and the browser cannot see it at all: what is
        # hidden *underneath* his face leaves no trace in a screenshot. If the
        # sky ever paints on his forehead it will be because this stopped
        # working, and nothing downstream would notice.
        # Against *solid* ink only. `clip_out` scales one alpha by the inverse
        # of the other, so wherever the cutter is半-transparent — every torn pen
        # edge on the drawing — both are partial by construction and the product
        # peaks at 64/255 no matter how correct the clip is. The first version
        # of this assertion tested the raw product and failed instantly on
        # exactly the soft edge the clip is designed to blend.
        # `v == 255` and not `v > 250`: at alpha 251 the clip correctly leaves 4,
        # so a threshold anywhere below full opacity smuggles the same arithmetic
        # back in with a smaller number. Fully opaque ink must erase the layer
        # under it exactly, and that is a claim with no tolerance in it.
        solid = placed[cutter].getchannel("A").point(lambda v: 255 if v == 255 else 0)
        bleed = ImageChops.multiply(placed[name].getchannel("A"), solid)
        worst = bleed.getextrema()[1]
        if worst > 0:
            sys.exit(
                f"{name} still paints under {cutter} (alpha product up to {worst}/255) — "
                "the clip in CLIPPED_BY is not doing its job"
            )
        notes[name] = f"{notes.get(name, '')} clipped to {cutter}".strip()

    # And the sky actually fills the hole it is behind.
    #
    # Asserted here for the same reason the clip is: the browser cannot see it.
    # A mouth the sky fails to reach shows *paper*, and the page is already
    # paper — so the failure renders as a slightly smaller dome and looks
    # completely deliberate. That is exactly how the 60-row band survived a
    # re-cut, a shape change and 35 passing browser assertions while leaving the
    # left end of his brow opening onto nothing.
    #
    # The claim is per-column and there is no tolerance in it: directly above
    # the tear, everywhere along the tear, there must be sky. The row just above
    # the cut is bare by construction — `face.png` is transparent above the tear
    # — so anything found there came from the sky layer or is a hole.
    if "sky" in placed and "face" in placed:
        top, left, right, _ = tear_edge(placed["face"])
        sa = placed["sky"].getchannel("A").load()
        bare = [x for x in range(left, right + 1) if not sa[x, max(0, top[x] - 1)]]
        if bare:
            sys.exit(
                f"the sky does not reach the tear in {len(bare)} of "
                f"{right - left + 1} columns (x{bare[0]}..{bare[-1]}) — the mouth "
                "of the opening would show paper. Check dome_mask's centre and radius."
            )
        notes["sky"] = f"{notes.get('sky', '')} fills the tear".strip()

    for name, canvas in placed.items():
        png = OUT / f"{name}.png"
        canvas.save(png, optimize=True)

        # The AVIF is not decoration — `sources()` in src/head.ts offers it
        # first, so a stale one silently wins over the PNG that was just
        # written and the page shows the previous cut. Always rewrite both.
        avif = OUT / f"{name}.avif"
        subprocess.run(
            ["avifenc", "-q", "57", "-s", "6", str(png), str(avif)],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        note = f"   {notes[name]}" if name in notes else ""
        print(
            f"  {name:<14} {png.name} {png.stat().st_size // 1024:>5}KB"
            f"   {avif.name} {avif.stat().st_size // 1024:>5}KB{note}"
        )


if __name__ == "__main__":
    main()
