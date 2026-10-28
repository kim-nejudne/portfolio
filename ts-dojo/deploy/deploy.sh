#!/usr/bin/env bash
#
# Ships a fresh build of ts-dojo to the droplet (spec §10). A push to `main` that touches ts-dojo/
# does this already (.github/workflows/deploy-ts-dojo.yml); this script is the same release done
# by hand, the break-glass path when Actions is the thing that is broken. Run from ts-dojo/ in the
# portfolio, as `deploy`, never root:
#
#   TS_DOJO_HOST=deploy@host ./deploy/deploy.sh
#
# Adapted from plinth's deploy.sh, which is the same shape. The target is required rather than
# defaulted: a hardcoded production host in a repo is a target string for anyone reading it, and
# a script that ships to production when run with no arguments has no safe way to be tried out.
# Export it once in your shell profile.
#
# ts-dojo is static, so there is no image to build and no process to restart: this is a check, a
# build, a precompress, a staged rsync and a swap that keeps the outgoing build in
# /var/www/ts-dojo.prev, then nginx's own answers confirmed with curl (deploy/confirm.sh).
#
# No chown and no nginx reload (a deviation from §10, recorded in docs/progress.md):
# /var/www/ts-dojo is deploy:www-data and nginx only reads it, the same arrangement as
# /var/www/poketrack. nginx's own config is root's and a person moves it.
#
# Differences from plinth's:
#   1. `pnpm content:lint` is a gate: it proves every exercise solvable and its tricks blocked
#      (spec §3), which no other check does.
#   2. the swap is two passes, so a visitor mid-deploy never gets an index.html or sw.js that
#      names files not there yet (see "Swap" below).
#   3. the curl checks at the end (deploy/confirm.sh) are §12 F15's droplet criteria, run
#      against the real host.
set -euo pipefail

HOST="${TS_DOJO_HOST:?set TS_DOJO_HOST to the droplet, as deploy@host}"
SITE="dojo.kimnejudne.dev"
REMOTE="/var/www/ts-dojo"
DIST="dist"

cd "$(dirname "$0")/.."

echo "==> Typecheck, lint, content lint"
pnpm typecheck
pnpm lint
pnpm content:lint

# Also copies TypeScript's lib files into public/ts/6.0.3/ and writes the service worker.
echo "==> Build"
pnpm build

[ -f "${DIST}/index.html" ] || { echo "no build output at ${DIST}" >&2; exit 1; }
[ -f "${DIST}/sw.js" ] || { echo "no service worker at ${DIST}/sw.js" >&2; exit 1; }
[ -f "${DIST}/ts/6.0.3/lib.es2025.d.ts" ] || { echo "no lib files under ${DIST}/ts/6.0.3" >&2; exit 1; }
[ -f "${DIST}/packages/types.json" ] || { echo "no pre-bundled packages under ${DIST}/packages" >&2; exit 1; }

# gzip_static serves these instead of compressing per request. -9 is worth it here because it
# happens once at deploy rather than once per visitor. The worker chunk (about 3.6 MB raw) and
# lib.dom.d.ts (2.4 MB) are most of the gain. Fonts are woff2, already compressed.
echo "==> Precompress"
find "$DIST" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \
  -o -name '*.json' -o -name '*.d.ts' \) -exec gzip -9 -k -f {} +

# Staged into ts-dojo.next, never straight into the live directory: a dropped connection
# mid-rsync would otherwise leave a half-written site serving.
echo "==> Stage to ${HOST}:${REMOTE}.next"
rsync -rltz --delete --chmod=D755,F644 "${DIST}/" "${HOST}:${REMOTE}.next/"

# The outgoing build goes to ts-dojo.prev first: the --delete below is irreversible without it.
# Then two passes. The hashed assets, the lib files and the pre-bundled packages (F14) go first,
# without --delete: the old index.html still finds its old chunks, and the new files are in
# place before the second pass writes the index.html and sw.js that name them. --delete so
# removed asset hashes don't accumulate. A visitor still on the old version is served from
# their service worker's precache, not from here.
echo "==> Swap, keeping the outgoing build in ${REMOTE}.prev"
# shellcheck disable=SC2029 # REMOTE is meant to expand here, on the workstation.
ssh "$HOST" "
  set -e
  test -f ${REMOTE}.next/index.html
  rsync -a --delete ${REMOTE}/ ${REMOTE}.prev/
  rsync -a ${REMOTE}.next/assets ${REMOTE}.next/ts ${REMOTE}.next/packages ${REMOTE}/
  rsync -a --delete ${REMOTE}.next/ ${REMOTE}/
"

./deploy/confirm.sh "$DIST"

cat <<EOF
==> Done: https://${SITE}

Rollback if this was wrong (one release back):
  ssh ${HOST} 'rsync -a --delete ${REMOTE}.prev/ ${REMOTE}/'
EOF
