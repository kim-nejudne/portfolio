#!/usr/bin/env bash
#
# Grab a placeholder crop from a live spoke.
#
# A stand-in crop is a placeholder for a curatorial decision rather than the
# decision. The brief says the crop is chosen "for silhouette and
# colour, not legibility" — that is Kim's call per spoke, and a headless
# screenshot of whatever happens to be above the fold is not it. What these are
# for is the one thing a grey box cannot test: whether the colour rule survives
# contact with loud spokes sitting on one sheet of paper.
#
# THREE ARE NO LONGER STAND-INS AND THIS SCRIPT WILL DESTROY THEM IF ASKED.
# `poketrack`, `buzzer` and `sketchy` are chosen captures, taken at 2x from a
# real browser, with the source kept in art/crops/. They are NOT in the default
# set, so a bare `npm run crops` cannot touch them. Naming one on the command
# line re-shoots its landing page headlessly and overwrites the choice:
#
#   npm run crops                # every stand-in: ts-dojo
#   npm run crops -- poketrack   # explicit, and CLOBBERS the chosen crop
#
# Buzzr's and Sketchy's are of the TV mid-game, which a screenshot of the
# landing page cannot reach. Each was staged on 2026-11-01 against a local
# production build: a Playwright script hosted a room, joined four phones
# and played to the beat (Buzzr: Priya first to buzz, Theo +0.04 s behind;
# Sketchy: a house half-drawn, three wrong guesses in). The TV was captured at
# 1440x960, DPR 2, with the join host showing the live domain. Re-staging
# means repeating that, not running this script.
#
# To re-derive a chosen crop from its source instead, which is what you almost
# certainly want:
#
#   magick art/crops/$n.png -gravity north -crop <SRC_W>x<SRC_H>+0+0 +repage \
#     -resize 900x600 public/crops/$n.png
#   avifenc -q 62 --speed 4 public/crops/$n.png public/crops/$n.avif
#
# The chosen source was framed rather than merely taken, and the frame is the
# decision:
#
#   poketrack  2880x2048  = 1440x1024 at DPR 2, which is 1.40 rather than 3:2,
#                           so 64 CSS px comes off the bottom: -crop 2880x1920.
#   buzzer     2880x1920  = 1440x960 at DPR 2, already 3:2: resize only.
#   sketchy    2880x1920  = the same.
#
# Whichever route, write BOTH formats. sources() offers AVIF first, so a fresh
# PNG beside a stale AVIF ships the stale image and looks like nothing happened.
#
# The filenames and aspect ratio are the contract; src/spokes.ts reads nothing
# else.
set -Eeuo pipefail

cd "$(dirname "$0")/.."
OUT=public/crops
mkdir -p "$OUT"

# 3:2, matching the card frame in src/components/Showcase.tsx.
W=900
H=600

url_for() {
  case $1 in
    poketrack) echo https://poketrack.kimnejudne.dev/ ;;
    ts-dojo)   echo https://dojo.kimnejudne.dev/ ;;
    buzzer)    echo https://buzzr.kimnejudne.dev/ ;;
    sketchy)   echo https://sketchy.kimnejudne.dev/ ;;
    *) echo "unknown spoke: $1" >&2; return 1 ;;
  esac
}

shoot() {
  local name=$1 url tmp
  url=$(url_for "$name")
  tmp=$(mktemp -d)
  # Forced reduced motion, deliberately. Every spoke's reduced-motion policy
  # renders the page complete and static — which is exactly the state a
  # screenshot wants, and the only one it can reliably catch. Without it the
  # retired PLINTH photographed as a black rectangle: its intro curtain was a
  # CSS wipe that a headless run under virtual time never finished.
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

# Default to the ones that are still stand-ins. Naming a spoke opts in — see
# the clobber warning above.
STANDINS=(ts-dojo)
spokes=("$@")
if [ ${#spokes[@]} -eq 0 ]; then
  spokes=("${STANDINS[@]}")
fi
if [ ${#spokes[@]} -eq 0 ]; then
  echo "no stand-in crops left; name a spoke to re-shoot it" >&2
  exit 0
fi

for s in "${spokes[@]}"; do
  case $s in
    poketrack)
      printf 'warning: %s is a chosen crop, not a stand-in — overwriting it\n' "$s" >&2 ;;
  esac
  shoot "$s"
done
