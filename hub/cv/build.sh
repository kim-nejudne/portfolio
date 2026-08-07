#!/usr/bin/env bash
#
# Renders cv/cv.html to a PDF. Run from the hub directory:
#
#   ./cv/build.sh                 # -> public/cv.pdf
#   ./cv/build.sh /tmp/draft.pdf  # -> anywhere, for review
#
# Same shape as cv/build-placeholder.sh and scripts/brand.sh: headless
# chromium over a local http server, because the @font-face URLs point into
# src/fonts/ and file:// would not resolve them, which would silently produce
# a PDF set in Times.
#
# This replaces build-placeholder.sh once cv.html carries both pages. Until
# then the placeholder is still what sits at public/cv.pdf, and cv/PLACEHOLDER
# still stops deploy/deploy.sh from shipping either of them.
set -euo pipefail

cd "$(dirname "$0")/.."

OUT="${1:-public/cv.pdf}"

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome-stable)"
[ -n "$CHROME" ] || { echo "no chromium on PATH" >&2; exit 1; }

# The em dash ban is Kim's, 2026-08-07, and it is enforced here rather than
# only in review. Checked against the *source*, before rendering: chromium
# writes page text into a compressed stream, so a grep of the PDF would find
# nothing and the guard would pass in silence. Same trap as the PLACEHOLDER
# sentinel, and the same reason it is a sidecar file rather than a string.
if grep -qP '\x{2014}' cv/cv.html; then
  echo "em dash in cv/cv.html:" >&2
  grep -nP '\x{2014}' cv/cv.html >&2
  exit 1
fi

# There was a guard here that refused to write public/cv.pdf while any figure
# was still marked as unsourced. It is gone because its trigger is gone: Kim
# took the eight figures as final on 2026-08-07 and the `class="fake"` spans
# were removed, so the check could never fire again and a guard that cannot
# fire is worse than no guard, because it reads like protection.
#
# The provenance of those eight is recorded in cv/content.md under "Figures
# that were never sourced". That note is for interview preparation and is the
# only place the distinction still exists.

PORT=8733
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:${PORT}/cv/cv.html" >/dev/null && break
  sleep 0.1
done

# Delete the destination first, so the check below cannot pass on stale bytes.
# Without this, a chromium that fails to write leaves the *previous* PDF in
# place, `head -c 5` finds its magic bytes, and the script reports success over
# a file it did not produce. That is exactly how a sabotage run appeared to
# have overwritten public/cv.pdf when it had not: the evidence was ambiguous
# because the check was reading a file that predated the run.
rm -f "$OUT"

"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$OUT" \
  "http://127.0.0.1:${PORT}/cv/cv.html" >/dev/null 2>&1

# The magic bytes, not the exit status. Chromium returns 0 on plenty of ways
# of producing nothing useful.
[ -f "$OUT" ] && head -c 5 "$OUT" | grep -q '%PDF-' || {
  echo "$OUT was not written, or is not a PDF" >&2
  exit 1
}

# Both pages, not just the one that fits. A CSS error that collapses the page
# break would produce a valid single-page PDF and pass every check above.
PAGES="$(pdfinfo "$OUT" 2>/dev/null | awk '/^Pages/{print $2}')"
[ "$PAGES" = "2" ] || {
  echo "$OUT has $PAGES page(s), expected 2" >&2
  exit 1
}

echo "    $OUT  ($(du -h "$OUT" | cut -f1))"
