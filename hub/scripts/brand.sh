#!/usr/bin/env bash
#
# Regenerates the raster brand assets in public/ from the HTML sources in
# scripts/brand/. Run from the hub directory:
#
#   ./scripts/brand.sh
#
# Adapted from PLINTH's, which is the same shape and for the same reason: the
# share card has to be set in the same two faces as the page and carry the same
# artwork, so it is rendered by a real browser off the real stylesheet rather
# than assembled in an image library. The only two things that takes are
# chromium and a static file server, and both are already here.
#
# The card is NOT a mock-up of the page. It loads `public/head/*.png` and uses
# HINGE from `src/head.ts` and LID_ANGLE from `src/choreography.ts`. The art has
# been re-cut twice in two days; a card drawn to merely resemble the page would
# have gone stale twice with nothing to say so.
#
# `public/favicon.svg` is NOT generated here — it is the definition of the mark,
# and the icons below are screenshots of it, so they cannot drift from it. Its
# path data comes from the vendored font via `scripts/glyph-path.py`, which is
# a one-shot needing fontTools and is deliberately not wired into this script.
#
# Sources are served over http (not file://) so the @font-face URLs into
# src/fonts/ resolve the way they do in the app.
set -euo pipefail

cd "$(dirname "$0")/.."

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome-stable)"
[ -n "$CHROME" ] || { echo "no chromium on PATH" >&2; exit 1; }

PORT=8731
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

# Wait for the server rather than sleeping a guessed interval.
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:${PORT}/scripts/brand/icon.html" >/dev/null && break
  sleep 0.1
done

shoot() {
  local src="$1" out="$2" w="$3" h="$4"
  shift 4
  "$CHROME" --headless --disable-gpu --hide-scrollbars "$@" \
    --screenshot="public/${out}" --window-size="${w},${h}" \
    "http://127.0.0.1:${PORT}/scripts/brand/${src}" >/dev/null 2>&1
  echo "    public/${out}  ($(du -h "public/${out}" | cut -f1))"
}

echo "==> Share card"
shoot og-card.html og-card.png 1200 630

# Chromium paints an opaque white backdrop unless told otherwise, which would
# put a white square behind a disc whose corners are meant to be clear.
TRANSPARENT=--default-background-color=00000000

echo "==> Icons"
shoot 'icon.html' favicon-96.png 96 96 "$TRANSPARENT"
# iOS composites this one onto black, so it is rendered over paper instead.
shoot 'icon.html?paper' apple-touch-icon.png 180 180

# The card is flat colour and line art over a halftone — a handful of inks, not
# a photograph — so an adaptive palette is very close to lossless and roughly
# five times smaller. Worth doing on a file whose entire job is to be fetched by
# a scraper on somebody else's timeline.
echo "==> Quantise the card"
python3 - <<'PY'
from PIL import Image
from pathlib import Path

p = Path("public/og-card.png")
before = p.stat().st_size
im = Image.open(p).convert("RGB")
q = im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)

# Refuse to ship a visibly worse card to save bytes. Mean absolute error across
# every channel of every pixel, against the unquantised render.
import statistics
a, b = im.tobytes(), q.convert("RGB").tobytes()
err = statistics.fmean(abs(x - y) for x, y in zip(a, b))
if err > 3.0:
    raise SystemExit(f"quantising moved pixels by {err:.2f}/255 on average — too much, keeping the original")

q.save(p, optimize=True)
after = p.stat().st_size
print(f"    {before//1024}KB -> {after//1024}KB, mean error {err:.2f}/255")
PY

echo "==> Done."
