#!/usr/bin/env bash
#
# Ships a fresh build of ts-dojo to the droplet (spec §10). Run from the repository root:
#
#   TS_DOJO_HOST=user@host ./deploy/deploy.sh
#
# Adapted from plinth's deploy.sh, which is the same shape. The target is required rather than
# defaulted: a hardcoded production host in a repo is a target string for anyone reading it, and
# a script that ships to production when run with no arguments has no safe way to be tried out.
# Export it once in your shell profile.
#
# ts-dojo is static, so there is no image to build and no process to restart: this is a check, a
# build, a precompress, a backup and an rsync, then nginx's own answers confirmed with curl.
#
# Differences from plinth's:
#   1. `pnpm content:lint` is a gate: it proves every exercise solvable and its tricks blocked
#      (spec §3), which no other check does.
#   2. the rsync is two passes, so a visitor mid-deploy never gets an index.html or sw.js that
#      names files not there yet (see "Ship" below).
#   3. the curl checks at the end are §12 F15's droplet criteria, run against the real host.
set -euo pipefail

HOST="${TS_DOJO_HOST:?set TS_DOJO_HOST to the droplet, as user@host}"
SITE="dojo.kimnejudne.dev"
REMOTE="/var/www/ts-dojo"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/var/backups/ts-dojo-${STAMP}.tar.gz"
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

# rsync --delete below is irreversible without this.
echo "==> Back up current ${REMOTE} -> ${BACKUP}"
# shellcheck disable=SC2029 # REMOTE and BACKUP are meant to expand here, on the workstation.
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
# Two passes. The hashed assets, the lib files and the pre-bundled packages (F14) go first,
# without --delete: the old index.html still finds its old chunks, and the new files are in
# place before the second pass writes the index.html and sw.js that name them.
rsync -az "${DIST}/assets" "${DIST}/ts" "${DIST}/packages" "${HOST}:${REMOTE}/"
# --delete so removed asset hashes don't accumulate. Safe because this directory holds nothing
# but build output, and the previous contents are in ${BACKUP}. A visitor still on the old
# version is served from their service worker's precache, not from here.
rsync -az --delete "${DIST}/" "${HOST}:${REMOTE}/"

echo "==> Reload nginx"
# shellcheck disable=SC2029 # REMOTE is meant to expand here, on the workstation.
ssh "$HOST" "chown -R www-data:www-data ${REMOTE} && nginx -t && systemctl reload nginx"

# What `vite preview` cannot answer, because it is nginx's rather than the build's (§12 F15):
# the certificate (curl verifies it; no -k anywhere), the redirect, the SPA fallback for a
# lesson URL, the precompressed lib file and its type, and the cache headers.
echo "==> Confirm through nginx"
fail() {
  echo "    ^ $1" >&2
  exit 1
}
# header <url> <name> [curl options...]: the value of one response header, lower-cased name.
header() {
  local url="$1" name="$2"
  shift 2
  curl -sS -o /dev/null -D - "$@" "$url" | tr -d '\r' |
    awk -F': ' -v want="${name,,}" 'tolower($1) == want { print $2 }'
}
status() {
  curl -sS -o /dev/null -w '%{http_code}' "$1"
}

code="$(status "https://${SITE}/")"
printf '    https://%s/  %s (certificate verified)\n' "$SITE" "$code"
[ "$code" = "200" ] || fail "expected 200"

code="$(status "http://${SITE}/")"
location="$(header "http://${SITE}/" location)"
printf '    http://%s/   %s -> %s\n' "$SITE" "$code" "$location"
[ "$code" = "301" ] || fail "expected 301"
[ "$location" = "https://${SITE}/" ] || fail "expected a redirect to https://${SITE}/"

# The first lesson in the build, so the check never names a lesson that no longer exists.
lesson="$(find content/modules -name lesson.mdx | sort | head -n 1 |
  sed -E 's#^content/modules/([^/]+)/([^/]+)/lesson\.mdx$#\1/\2#')"
code="$(status "https://${SITE}/l/${lesson}")"
type="$(header "https://${SITE}/l/${lesson}" content-type)"
printf '    /l/%s  %s %s\n' "$lesson" "$code" "$type"
[ "$code" = "200" ] || fail "expected 200"
case "$type" in text/html*) ;; *) fail "expected text/html" ;; esac

lib="https://${SITE}/ts/6.0.3/lib.es2025.d.ts"
encoding="$(header "$lib" content-encoding -H 'Accept-Encoding: gzip')"
type="$(header "$lib" content-type -H 'Accept-Encoding: gzip')"
length="$(header "$lib" content-length -H 'Accept-Encoding: gzip')"
etag="$(header "$lib" etag -H 'Accept-Encoding: gzip')"
printf '    /ts/6.0.3/lib.es2025.d.ts  Content-Encoding: %s, Content-Type: %s, Content-Length: %s, ETag: %s\n' \
  "${encoding:-<none>}" "${type:-<none>}" "${length:-<none>}" "${etag:-<none>}"
[ "$encoding" = "gzip" ] || fail "expected Content-Encoding: gzip"
case "$type" in text/plain | "text/plain;"*) ;; *) fail "expected text/plain" ;; esac
# gzip on the fly would also say gzip (the file is over gzip_min_length and text/plain is in
# gzip_types), but it streams: no Content-Length and a weak ETag. The precompressed file has
# its own length and a strong ETag.
[ "$length" = "$(stat -c %s "${DIST}/ts/6.0.3/lib.es2025.d.ts.gz")" ] ||
  fail "expected the precompressed file (Content-Length of ${DIST}/ts/6.0.3/lib.es2025.d.ts.gz)"
case "$etag" in W/*) fail "expected a strong ETag (gzip_static), not gzip on the fly" ;; esac

asset="$(find "${DIST}/assets" -maxdepth 1 -name '*.js' | sort | head -n 1)"
asset="/assets/${asset##*/}"
cache="$(header "https://${SITE}${asset}" cache-control)"
printf '    %s  %s\n' "$asset" "$cache"
case "$cache" in *immutable*) ;; *) fail "expected an immutable Cache-Control" ;; esac

for path in / /index.html /sw.js; do
  cache="$(header "https://${SITE}${path}" cache-control)"
  printf '    %-12s %s\n' "$path" "$cache"
  [ "$cache" = "no-cache" ] || fail "expected no-cache"
done

# This build is the one live: the service worker nginx serves is byte for byte the one built.
curl -sS "https://${SITE}/sw.js" | cmp -s - "${DIST}/sw.js" ||
  fail "the served sw.js is not ${DIST}/sw.js"
printf '    /sw.js       identical to %s/sw.js\n' "$DIST"

# The §10 policy as the repo's conf writes it, compared whole, on the document and on an
# asset and a lib file (nginx drops inherited add_header lines per location).
want="$(grep -m1 -o 'Content-Security-Policy "[^"]*"' deploy/nginx/ts-dojo.conf |
  sed -e 's/^Content-Security-Policy "//' -e 's/"$//')"
for path in / "$asset" /ts/6.0.3/lib.es2025.d.ts; do
  csp="$(header "https://${SITE}${path}" content-security-policy)"
  printf '    %-12s CSP %s\n' "$path" "$([ "$csp" = "$want" ] && echo "as in ts-dojo.conf" || echo "${csp:-<none>}")"
  [ "$csp" = "$want" ] || fail "expected the §10 CSP from deploy/nginx/ts-dojo.conf"
done

cat <<EOF
==> Done: https://${SITE}

Rollback if this was wrong:
  ssh ${HOST} 'rm -rf ${REMOTE}/* && tar -xzf ${BACKUP} -C ${REMOTE} \\
    && chown -R www-data:www-data ${REMOTE} && systemctl reload nginx'
EOF
