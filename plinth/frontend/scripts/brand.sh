#!/usr/bin/env bash
#
# Regenerates the raster brand assets in public/ from the HTML sources in
# scripts/brand/. Run from frontend/:
#
#   ./scripts/brand.sh
#
# Deliberately not a node dependency. The card has to be set in the same two
# faces as the page, so it is rendered by a real browser off a real stylesheet
# rather than assembled in an image library — and the only two things that takes
# are chromium and a static file server, both of which are already here.
#
# Sources are served over http (not file://) so the @font-face URLs pointing
# into node_modules resolve the way they would in the app.
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
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --screenshot="public/${out}" --window-size="${w},${h}" \
    "http://127.0.0.1:${PORT}/scripts/brand/${src}" >/dev/null 2>&1
  echo "    public/${out}  ($(du -h "public/${out}" | cut -f1))"
}

echo "==> Share card"
shoot og-card.html og-card.png 1200 630

echo "==> Icons"
shoot icon.html icon-512.png 512 512
shoot icon.html icon-192.png 192 192
shoot icon.html apple-touch-icon.png 180 180

echo "==> Done. favicon.svg is hand-authored — not generated here."
