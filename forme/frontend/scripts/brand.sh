#!/usr/bin/env bash
#
# Regenerates frontend/public/og-card.png from the HTML source in
# scripts/brand/. Run from frontend/:
#
#   ./scripts/brand.sh
#
# The shape PLINTH and the hub use, and deliberately not a node dependency: the
# card has to be set in IBM Plex off the real woff2 files, so it is rendered by
# a real browser rather than assembled in an image library.
#
# The static server is rooted at the **monorepo root**, not at frontend/,
# because npm workspaces hoists @fontsource to the top-level node_modules — so
# the card's font URLs are `/node_modules/...` and its own path is
# `/frontend/scripts/brand/og-card.html`.
#
# There were no Open Graph tags on this site at all until 2026-08-06, so every
# paste of a forme.kimnejudne.dev link rendered as a bare grey rectangle.
set -euo pipefail

cd "$(dirname "$0")/.."          # frontend/
FRONTEND="$PWD"
cd ..                            # monorepo root

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome-stable)"
[ -n "$CHROME" ] || { echo "no chromium on PATH" >&2; exit 1; }

PORT=8734
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:${PORT}/frontend/scripts/brand/og-card.html" >/dev/null && break
  sleep 0.1
done

mkdir -p "$FRONTEND/public"

echo "==> Share card"
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-color-profile=srgb \
  --screenshot="$FRONTEND/public/og-card.png" --window-size=1200,630 \
  "http://127.0.0.1:${PORT}/frontend/scripts/brand/og-card.html" >/dev/null 2>&1

echo "    frontend/public/og-card.png  ($(du -h "$FRONTEND/public/og-card.png" | cut -f1))"
echo "==> Done. Next serves public/ at the site root."
