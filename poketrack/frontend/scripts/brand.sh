#!/usr/bin/env bash
#
# Regenerates public/og-card.png from the HTML source in scripts/brand/.
# Run from frontend/:
#
#   ./scripts/brand.sh
#
# The shape PLINTH and the hub use, and deliberately not a node dependency: the
# card has to be set in DotGothic16, which is the entire voice of this spoke, so
# it is rendered by a real browser off the real woff2 rather than assembled in
# an image library. Served over http rather than opened as file:// so the
# node_modules font URLs resolve as they do in the app.
#
# There was no card here at all until 2026-08-06 — the head carried a title, a
# description and three icons, and no Open Graph tags whatsoever, so every paste
# of this link rendered as a bare grey rectangle.
#
# The card draws its own XP bar rather than screenshotting the app, because the
# app's sprites are fetched from PokéAPI at runtime and a share card that needs
# a third-party request to render is one that eventually renders empty. The
# numbers on it are the real medium-slow thresholds — see the comment in
# scripts/brand/og-card.html.
set -euo pipefail

cd "$(dirname "$0")/.."

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome-stable)"
[ -n "$CHROME" ] || { echo "no chromium on PATH" >&2; exit 1; }

PORT=8733
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:${PORT}/scripts/brand/og-card.html" >/dev/null && break
  sleep 0.1
done

echo "==> Share card"
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-color-profile=srgb \
  --screenshot="public/og-card.png" --window-size=1200,630 \
  "http://127.0.0.1:${PORT}/scripts/brand/og-card.html" >/dev/null 2>&1

echo "    public/og-card.png  ($(du -h public/og-card.png | cut -f1))"
echo "==> Done. CRA copies public/ to the root of build/, which nginx serves."
