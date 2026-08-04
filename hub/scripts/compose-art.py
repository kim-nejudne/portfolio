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
import subprocess
import sys

try:
    from PIL import Image, ImageChops, ImageDraw
except ImportError:
    sys.exit("needs Pillow:  pip install --user Pillow")

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
# That recovery reported 28.8px RMS and flagged itself SUSPECT, which was the
# tool being right to be suspicious and wrong about the cause. The scales agree
# exactly — the head is 728px wide across the tear in both files — but this cut
# is a drawing, and the lid's bottom edge trails wispy pen strokes past the
# tear line while the face's edge does not. Per-column extremes disagree by the
# length of a stray hair. Checked by eye afterwards rather than trusted.
LID_OFFSET = (388, -276)

SOURCES = {
    # layer name  ->  (file, offset in the face layer's coordinates)
    "face": ("face_2.png", (0, 0)),
    "lid": ("head_2.png", LID_OFFSET),
    # The sky shares the lid's offset by construction: it is the same cap, filled
    # in. Draw it on a layer *under* head_2.png in the same document and export
    # that layer alone, and there is nothing to align.
    "sky": ("sky_2.png", LID_OFFSET),
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

# A stand-in until `art/sky_2.png` exists, in the tradition of the nine grey
# placeholder layers this piece was built against: correct in position, size and
# stacking, and honest about being a shape rather than a drawing. A dome over the
# lid's own bounding box, carried well below the tear and then cut off by it.
#
# It is flat on purpose. A gradient here would start to look like a decision, and
# the only decision it is entitled to make is "there is colour behind the cut".
SKY_PLACEHOLDER_RGB = (0x6F, 0x8C, 0xA8)

# Layers a source already contains, written as fully transparent.
#
# The face was cut with the neck, collar and shoulders attached. Blanking is not
# the same as deleting: the layer stays in STACK, costs one cached empty PNG,
# and becomes real the day a neck is cut separately.
SUBSUMED = {"neck": "face_2.png"}

# --- how the composite maps onto the artboard -------------------------------
# Measured off the face layer, in its own pixels. The crown is the top of the lid;
# the chin is where the jaw stops and the collar takes over.
CROWN_Y = LID_OFFSET[1]          # -276
CHIN_Y = 580                     # where the jaw stops and the collar flares out
HEAD_CENTRE_X = 764              # midpoint of the head at its widest (y≈317)

# The framing: reproduce the placeholder's, so the timing tuned against it still
# holds on the first run. Head crown to chin fills 900 of the 1600-unit canvas,
# with the crown 180 units down. Both are then re-derived by `npm run verify`
# from what actually got drawn, so these are a starting point and not a claim.
HEAD_TOP_UNITS = 180
HEAD_HEIGHT_UNITS = 900


def placeholder_sky(face: Image.Image, lid: Image.Image) -> tuple[Image.Image, str]:
    """A flat dome the shape of the missing cap, derived from the two real cuts.

    Works in artboard space and takes both its dimensions from the drawing, so
    it needs no offset and no measurement of its own:

      width   the head's own width across the top of the tear — his temples
      height  from the tear up to the top of the lid, which is the cap's rise

    The first version sized this to the lid's *bounding box*, which is much
    wider than his skull because the hair sweeps out to one side. It rendered as
    a blue disc behind him instead of a hole in his head — a good illustration
    of why a placeholder still has to be derived rather than guessed.
    """
    fa, la = face.getchannel("A"), lid.getchannel("A")
    fbox, lbox = fa.getbbox(), la.getbbox()
    if not fbox or not lbox:
        raise SystemExit("cannot derive a placeholder sky without face and lid")

    tear_top = fbox[1]
    # The head's width where the cut is: ink in the first rows of the face.
    band = fa.crop((0, tear_top, face.width, tear_top + 60)).getbbox()
    left, right = band[0], band[2]
    cx, w = (left + right) / 2, right - left
    rise = tear_top - lbox[1]

    img = Image.new("RGBA", face.size, (0, 0, 0, 0))
    ImageDraw.Draw(img).ellipse(
        # Centred on the tear, so the upper half is the dome and the lower half
        # runs under the face to be clipped away by it.
        (cx - w / 2, tear_top - rise, cx + w / 2, tear_top + rise),
        fill=(*SKY_PLACEHOLDER_RGB, 255),
    )
    return img, f"dome {int(w)}x{int(rise)} on the tear at y{tear_top}"


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

    # The placeholder is built last and in artboard space, because it derives
    # its shape from the two real cuts once they are registered.
    if "sky" not in placed and {"face", "lid"} <= placed.keys():
        placed["sky"], how = placeholder_sky(placed["face"], placed["lid"])
        notes["sky"] = f"PLACEHOLDER {how} — replace with art/{SOURCES['sky'][0]}"

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
