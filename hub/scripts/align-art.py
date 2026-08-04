#!/usr/bin/env python3
"""
Recover a trimmed layer's offset from the cut edge it shares with the face.

Photopea's "trim transparent pixels" on export discards the layer's position,
which is the one thing registration depends on. When that has already happened,
the position is still recoverable for any layer that was cut *against* another:
the lid's bottom edge and the face's top edge are the same tear, so there is
exactly one translation that makes them agree.

    python3 scripts/align-art.py art/face.png art/head.png

Prints the offset and, more importantly, the RMS residual. A few pixels means
the two really are complements of one cut. Tens of pixels means they are not,
and the number is meaningless — check the scale before trusting it.

This is a rescue, not the workflow. Exporting untrimmed costs nothing.
"""

import sys

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit("needs Pillow and numpy:  pip install --user Pillow numpy")


def solid(path: str) -> np.ndarray:
    return np.array(Image.open(path).convert("RGBA"))[:, :, 3] > 128


def edge(mask: np.ndarray, which: str) -> np.ndarray:
    """Topmost (or bottommost) solid row per column; -1 where the column is empty."""
    out = np.full(mask.shape[1], -1)
    for x in range(mask.shape[1]):
        ys = np.where(mask[:, x])[0]
        if len(ys):
            out[x] = ys.min() if which == "top" else ys.max()
    return out


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    base_path, layer_path = sys.argv[1], sys.argv[2]

    base, layer = solid(base_path), solid(layer_path)
    base_top, layer_bottom = edge(base, "top"), edge(layer, "bottom")

    best = None
    for dx in range(-400, base.shape[1], 2):
        xs = np.arange(layer.shape[1]) + dx
        ok = (xs >= 0) & (xs < base.shape[1]) & (layer_bottom >= 0)
        if ok.sum() < 400:
            continue
        ok &= base_top[xs.clip(0, base.shape[1] - 1)] >= 0
        if ok.sum() < 400:
            continue
        # Vertical offset is whatever makes the two edges agree on average;
        # the median resists the notches where one edge has hair and the
        # other does not.
        diff = base_top[xs[ok]] - layer_bottom[ok]
        dy = int(np.median(diff))
        rms = float(np.sqrt(((diff - dy) ** 2).mean()))
        if best is None or rms < best[0]:
            best = (rms, dx, dy, int(ok.sum()))

    if best is None:
        sys.exit("no overlap found — are the two at the same scale?")

    rms, dx, dy, cols = best
    print(f"offset ({dx}, {dy})   rms {rms:.1f}px over {cols} columns")
    print("good" if rms < 8 else "SUSPECT — these may not be complements of one cut")


if __name__ == "__main__":
    main()
