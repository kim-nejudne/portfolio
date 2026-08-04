#!/usr/bin/env bash
#
# Ships a fresh build to the droplet. Run from the hub directory:
#
#   ./deploy/deploy.sh
#
# The hub is static, so there is no image to build and no container to restart —
# this is a verify, a build, a precompress, a backup, and an rsync. Adapted from
# PLINTH's, which is the same shape.
#
# Two differences from PLINTH's, both because this is the apex domain:
#   1. `npm run verify` is a gate rather than a habit. The hub is the page a
#      recruiter sees first and the one nobody clicks *back* to — a broken
#      choreography here loses the visit outright, where a broken spoke loses one
#      of five. 36 assertions take under a minute; shipping without them to save
#      that is a bad trade at any hour.
#   2. it serves two names, `kimnejudne.dev` and `www.`, and the www vhost is a
#      301 rather than a second copy.
set -euo pipefail

HOST="${HUB_HOST:-root@165.245.189.5}"
REMOTE="/var/www/hub"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/var/backups/hub-${STAMP}.tar.gz"

cd "$(dirname "$0")/.."

echo "==> Typecheck and build"
npm run build

DIST="dist"
[ -f "${DIST}/index.html" ] || { echo "no build output at ${DIST}" >&2; exit 1; }

# Against the freshly built `dist/`, served by `vite preview`. Not against the
# droplet: these assertions drive a headless browser through the whole scroll and
# several of them hide layers and push cards around to take their measurements,
# which is not something to do to a live site.
if [ "${HUB_SKIP_VERIFY:-}" != "1" ]; then
  echo "==> Verify (HUB_SKIP_VERIFY=1 to skip, and think about why)"
  npx vite preview --port 4501 >/dev/null 2>&1 &
  PREVIEW=$!
  trap 'kill ${PREVIEW} 2>/dev/null || true' EXIT
  sleep 3
  npm run verify
  kill "${PREVIEW}" 2>/dev/null || true
  trap - EXIT
fi

# gzip_static serves these instead of compressing per request. -9 is worth it
# here because it happens once at deploy rather than once per visitor.
#
# Images are deliberately excluded. AVIF and PNG are already compressed, gzip
# gains nothing on them, and the head layers are 7MB of the 8.2MB build — so
# compressing them would double the rsync for no benefit at all.
echo "==> Precompress"
find "$DIST" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \) \
  -exec gzip -9 -k -f {} +

echo "==> Back up current ${REMOTE} -> ${BACKUP}"
ssh "$HOST" "
  set -e
  mkdir -p /var/backups ${REMOTE}
  if [ -n \"\$(ls -A ${REMOTE} 2>/dev/null)\" ]; then
    tar -czf ${BACKUP} -C ${REMOTE} .
    echo \"    backed up \$(du -h ${BACKUP} | cut -f1)\"
  else
    echo '    nothing to back up (empty)'
  fi
"

echo "==> Ship to ${HOST}:${REMOTE}"
# --delete so removed asset hashes don't accumulate. Safe because this directory
# holds nothing but build output, and the previous contents are in ${BACKUP}.
rsync -az --delete "${DIST}/" "${HOST}:${REMOTE}/"

echo "==> Reload nginx"
ssh "$HOST" "chown -R www-data:www-data ${REMOTE} && nginx -t && systemctl reload nginx"

cat <<EOF
==> Done: https://kimnejudne.dev

Rollback if this was wrong:
  ssh ${HOST} 'rm -rf ${REMOTE}/* && tar -xzf ${BACKUP} -C ${REMOTE} \\
    && chown -R www-data:www-data ${REMOTE} && systemctl reload nginx'
EOF
