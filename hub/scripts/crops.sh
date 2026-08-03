#!/usr/bin/env bash
#
# Grab a placeholder crop from each live spoke.
#
# These are stand-ins for a curatorial decision, not the decision. The brief
# says the crop is chosen "for silhouette and colour, not legibility" — that is
# Kim's call per spoke, and a headless screenshot of whatever happens to be
# above the fold is not it. What these are for is the one thing a grey box
# cannot test: whether the colour rule survives contact with five loud spokes
# sitting on one sheet of paper.
#
# Re-crop by hand later; the filenames and aspect ratio are the contract, and
# src/spokes.ts reads nothing else.
set -Eeuo pipefail

cd "$(dirname "$0")/.."
OUT=public/crops
mkdir -p "$OUT"

# 3:2, matching the card frame in src/components/Card.tsx.
W=900
H=600

shoot() {
  local name=$1 url=$2
  local tmp
  tmp=$(mktemp -d)
  # Forced reduced motion, deliberately. Every spoke's reduced-motion policy
  # renders the page complete and static — which is exactly the state a
  # screenshot wants, and the only one it can reliably catch. Without it
  # PLINTH photographs as a black rectangle: its intro curtain is a CSS wipe
  # that a headless run under virtual time never finishes.
  chromium --headless --disable-gpu --hide-scrollbars \
    --force-prefers-reduced-motion \
    --virtual-time-budget=6000 \
    --window-size=1440,960 \
    --screenshot="$tmp/shot.png" "$url" >/dev/null 2>&1

  # Centre crop to 3:2 off the top of the page, then down to card size.
  magick "$tmp/shot.png" -gravity north -crop 1440x960+0+0 +repage \
    -resize ${W}x${H}^ -gravity center -extent ${W}x${H} "$OUT/$name.png"
  avifenc -q 62 --speed 4 "$OUT/$name.png" "$OUT/$name.avif" >/dev/null
  printf '%-11s png %7d  avif %7d\n' "$name" \
    "$(stat -c%s "$OUT/$name.png")" "$(stat -c%s "$OUT/$name.avif")"
  rm -rf "$tmp"
}

shoot tallow    https://tallow.kimnejudne.dev/
shoot plinth    https://plinth.kimnejudne.dev/
shoot forme     https://forme.kimnejudne.dev/
shoot poketrack https://poketrack.kimnejudne.dev/
shoot suki      https://suki.kimnejudne.dev/
