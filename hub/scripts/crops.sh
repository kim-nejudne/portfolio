#!/usr/bin/env bash
#
# Grab a placeholder crop from a live spoke.
#
# Three of the five crops are still stand-ins for a curatorial decision rather
# than the decision. The brief says the crop is chosen "for silhouette and
# colour, not legibility" — that is Kim's call per spoke, and a headless
# screenshot of whatever happens to be above the fold is not it. What these are
# for is the one thing a grey box cannot test: whether the colour rule survives
# contact with loud spokes sitting on one sheet of paper.
#
# TWO ARE NO LONGER STAND-INS AND THIS SCRIPT WILL DESTROY THEM IF ASKED.
# `poketrack` and `suki` are chosen captures — taken at 2x from a real browser,
# sources kept in art/crops/. They are NOT in the default set, so a bare
# `npm run crops` cannot touch them. Naming one on the command line re-shoots it
# headlessly and overwrites the choice:
#
#   npm run crops              # tallow plinth forme — the three stand-ins
#   npm run crops -- suki      # explicit, and CLOBBERS the chosen crop
#
# To re-derive a chosen crop from its source instead, which is what you almost
# certainly want:
#
#   magick art/crops/$n.png -gravity north -crop 2880x1920+0+0 +repage \
#     -resize 900x600 public/crops/$n.png
#   avifenc -q 62 --speed 4 public/crops/$n.png public/crops/$n.avif
#
# The captures are 2880x2048 — 1440x1024 at DPR 2, which is 1.40 rather than
# 3:2, so 64 CSS px comes off the bottom. On SUKI that is deliberate: it drops
# the tab bar and leaves the dark total bar (source rows 1784-1911) as the
# closing edge of the frame, with nine pixels to spare.
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
    tallow)    echo https://tallow.kimnejudne.dev/ ;;
    plinth)    echo https://plinth.kimnejudne.dev/ ;;
    forme)     echo https://forme.kimnejudne.dev/ ;;
    poketrack) echo https://poketrack.kimnejudne.dev/ ;;
    suki)      echo https://suki.kimnejudne.dev/ ;;
    *) echo "unknown spoke: $1" >&2; return 1 ;;
  esac
}

shoot() {
  local name=$1 url tmp
  url=$(url_for "$name")
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

# Default to the three that are still stand-ins. Naming a spoke opts in — see
# the clobber warning above.
spokes=("$@")
if [ ${#spokes[@]} -eq 0 ]; then
  spokes=(tallow plinth forme)
fi

for s in "${spokes[@]}"; do
  case $s in
    poketrack|suki)
      printf 'warning: %s is a chosen crop, not a stand-in — overwriting it\n' "$s" >&2 ;;
  esac
  shoot "$s"
done
