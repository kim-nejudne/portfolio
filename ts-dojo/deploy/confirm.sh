#!/usr/bin/env bash
#
# Confirms the live ts-dojo through nginx (§12 F15's droplet criteria), against the build that
# was just shipped. Run from ts-dojo/, after a deploy:
#
#   ./deploy/confirm.sh [dist]
#
# Called by deploy.sh at the end of a manual deploy and by .github/workflows/deploy-ts-dojo.yml
# after a push deploys. One copy of the checks, so the two paths cannot drift apart.
set -euo pipefail

SITE="dojo.kimnejudne.dev"
DIST="${1:-dist}"

cd "$(dirname "$0")/.."
[ -f "${DIST}/sw.js" ] || { echo "no build at ${DIST} to compare the live site against" >&2; exit 1; }

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
