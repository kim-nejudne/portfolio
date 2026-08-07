#!/usr/bin/env bash
#
# Renders cv/placeholder.html to public/cv.pdf. Run from the hub directory:
#
#   ./cv/build-placeholder.sh
#
# Same shape as scripts/brand.sh: headless chromium over a local http server,
# because the @font-face URLs point into src/fonts/ and file:// would not
# resolve them, which would silently produce a PDF set in Times.
#
# This script is for the *placeholder* only. When the real CV lands it replaces
# public/cv.pdf directly and this script stops being run; see cv/README.md.
set -euo pipefail

cd "$(dirname "$0")/.."

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome-stable)"
[ -n "$CHROME" ] || { echo "no chromium on PATH" >&2; exit 1; }

PORT=8732
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:${PORT}/cv/placeholder.html" >/dev/null && break
  sleep 0.1
done

"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=public/cv.pdf \
  "http://127.0.0.1:${PORT}/cv/placeholder.html" >/dev/null 2>&1

# The magic bytes, not the exit status. Chromium returns 0 on plenty of ways of
# producing nothing useful, and scripts/verify.mjs asserts these same five bytes
# over http, so failing here rather than there keeps the diagnosis local.
head -c 5 public/cv.pdf | grep -q '%PDF-' || {
  echo "public/cv.pdf is not a PDF" >&2
  exit 1
}

echo "    public/cv.pdf  ($(du -h public/cv.pdf | cut -f1))"
