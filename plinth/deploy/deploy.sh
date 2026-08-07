#!/usr/bin/env bash
#
# Ships a fresh build to the droplet. Run from plinth/:
#
#   PLINTH_HOST=user@host ./deploy/deploy.sh
#
# That was the repo root until the six spokes were merged into one repository.
# The script never cared — it does `cd "$(dirname "$0")/.."` below and locates
# itself — but the instruction had to stop saying "repo root", which now names
# somewhere else entirely.
#
# The target is required rather than defaulted. It used to default to the
# production droplet, which is convenient exactly once and wrong every other
# way: a hardcoded production host in a repo is a target string for anyone
# reading it, and a script that ships to production when run with no arguments
# has no safe way to be tried out. Export it once in your shell profile.
#
# PLINTH is static, so there is no image to build and no container to restart —
# this is a build, a precompress, a backup, and an rsync.
#
# Adapted from the previous PLINTH runbook. Two differences that matter:
#   1. the app lives in frontend/, not at the repo root
#   2. this deploy REPLACES a different site that was already live here, so it
#      takes a restorable backup before the destructive rsync --delete
set -euo pipefail

HOST="${PLINTH_HOST:?set PLINTH_HOST to the droplet, as user@host}"
REMOTE="/var/www/plinth"
APP_DIR="frontend"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/var/backups/plinth-${STAMP}.tar.gz"

cd "$(dirname "$0")/.."

echo "==> Typecheck"
( cd "$APP_DIR" && npx tsc --noEmit )

echo "==> Build"
( cd "$APP_DIR" && npm run build )

DIST="${APP_DIR}/dist"
[ -f "${DIST}/index.html" ] || { echo "no build output at ${DIST}" >&2; exit 1; }

# gzip_static serves these instead of compressing per request. -9 is worth it
# here because it happens once at deploy rather than once per visitor.
echo "==> Precompress"
find "$DIST" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \) \
  -exec gzip -9 -k -f {} +

# The directory currently holds the previous (gym) PLINTH build. rsync --delete
# below is irreversible without this.
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
==> Done: https://plinth.kimnejudne.dev

Rollback if this was wrong:
  ssh ${HOST} 'rm -rf ${REMOTE}/* && tar -xzf ${BACKUP} -C ${REMOTE} \\
    && chown -R www-data:www-data ${REMOTE} && systemctl reload nginx'
EOF
