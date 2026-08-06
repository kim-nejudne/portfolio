#!/usr/bin/env bash
#
# Regenerates public/og-card.png from the HTML source in scripts/brand/.
# Run from the repo root:
#
#   ./scripts/brand.sh
#
# The same shape PLINTH and the hub use, and deliberately not a node dependency.
# The card has to be set in the app's own four faces, so it is rendered by a real
# browser off the real woff2 files rather than assembled in an image library —
# and the only two things that takes are chromium and a static file server.
#
# Sources are served over http rather than opened as file://, so the font URLs
# pointing into src/fonts/ resolve the way they do in the app.
#
# The card was missing entirely until 2026-08-06: the head carried a title and a
# description and nothing else, so every paste of this link into Slack, LinkedIn
# or a DM rendered as a bare grey rectangle.
set -euo pipefail

cd "$(dirname "$0")/.."

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome-stable)"
[ -n "$CHROME" ] || { echo "no chromium on PATH" >&2; exit 1; }

PORT=8732
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

# Wait for the server rather than sleeping a guessed interval.
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:${PORT}/scripts/brand/og-card.html" >/dev/null && break
  sleep 0.1
done

mkdir -p public

echo "==> Share card"
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-color-profile=srgb \
  --screenshot="public/og-card.png" --window-size=1200,630 \
  "http://127.0.0.1:${PORT}/scripts/brand/og-card.html" >/dev/null 2>&1

echo "    public/og-card.png  ($(du -h public/og-card.png | cut -f1))"
echo "==> Done. Vite copies public/ to the root of dist/, which Express serves."
