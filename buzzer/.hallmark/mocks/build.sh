#!/bin/sh
# Inlines the real join QR into each theme's mock: <theme>/index.src.html -> <theme>/index.html
cd "$(dirname "$0")"
QR=$(sed 's/<svg /<svg class="qr" aria-label="Join QR code" /' qr.min.svg)
for t in overprint werkstatt pasteup; do
  [ -f "$t/index.src.html" ] && awk -v qr="$QR" '{ sub(/<!--QR-->/, qr); print }' "$t/index.src.html" > "$t/index.html"
done
exit 0
