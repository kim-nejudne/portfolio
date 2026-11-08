#!/usr/bin/env bash
# Smoke check of a running Pinpoint (spec: Milestones item 10), from outside, against any URL:
# /healthz, the app shell, /api/config, /api/categories, room creation and lookup, a fallback tile
# and the admin wall. It creates one room (in memory, swept after 3 h idle).
#
#   scripts/smoke.sh <base URL>
#   SMOKE_EXPECT_TILES=1 scripts/smoke.sh https://pinpoint.kimnejudne.dev   # CARTO key set
#   SMOKE_EXPECT_ADMIN=1 scripts/smoke.sh …                                 # ADMIN_PASSWORD_HASH set
#
# Needs curl and node. The CARTO tile URL carries the key, so it is never printed.
set -euo pipefail

BASE="${1:?usage: scripts/smoke.sh <base URL>}"
BASE="${BASE%/}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}
# The body goes to $TMP/body; prints the status code.
get() {
  curl -sS --max-time 10 -o "$TMP/body" -w '%{http_code}' "$@" || echo 000
}
# Evaluates a JS expression over the JSON body as `b`; prints its result.
json() {
  node -e 'const b = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    console.log(String(eval(process.argv[2])))' "$TMP/body" "$1" 2>/dev/null || echo invalid
}

status=$(get "$BASE/healthz")
[ "$status" = 200 ] && [ "$(json 'b.ok === true')" = true ] ||
  fail "/healthz answered $status $(head -c 200 "$TMP/body")"
echo 'ok   /healthz {"ok":true}'

status=$(get "$BASE/")
[ "$status" = 200 ] && grep -q '<div id="root">' "$TMP/body" || fail "/ did not serve the app shell ($status)"
echo 'ok   / serves the app shell'

# Never print this body: with a CARTO key its tile URL carries the key.
status=$(get "$BASE/api/config")
[ "$status" = 200 ] || fail "/api/config answered $status"
[ "$(json 'b.fallbackTiles.url')" = '/tiles/fallback/{z}/{x}/{y}.png' ] ||
  fail "/api/config has no fallback tile template"
tiles=$(json 'b.tiles === null ? "null" : /^https:\/\/\S+$/.test(b.tiles.url) ? "set" : "bad"')
if [ "${SMOKE_EXPECT_TILES:-}" = 1 ]; then
  [ "$tiles" = set ] || fail "/api/config tiles is $tiles, expected a CARTO template"
  echo 'ok   /api/config: fallback template, CARTO tiles set'
else
  [ "$tiles" = set ] || [ "$tiles" = null ] || fail "/api/config tiles is malformed"
  echo "ok   /api/config: fallback template, CARTO tiles $tiles"
fi

status=$(get "$BASE/api/categories")
[ "$status" = 200 ] && [ "$(json 'Array.isArray(b)')" = true ] ||
  fail "/api/categories answered $status, not a JSON array"
echo "ok   /api/categories: a JSON array of $(json 'b.length')"

status=$(get -X POST -H 'content-type: application/json' -d '{}' "$BASE/api/rooms")
code=$(json 'b.code')
[ "$status" = 201 ] && [[ "$code" =~ ^[A-Z]{4}$ ]] || fail "POST /api/rooms answered $status"
status=$(get "$BASE/api/rooms/$code/exists")
[ "$status" = 200 ] && [ "$(json 'b.exists')" = true ] || fail "/api/rooms/$code/exists says no"
echo "ok   POST /api/rooms 201 (room $code), and it exists"

status=$(get "$BASE/tiles/fallback/0/0/0.png")
[ "$status" = 200 ] && [ "$(head -c 8 "$TMP/body" | od -An -tx1 | tr -d ' \n')" = 89504e470d0a1a0a ] ||
  fail "/tiles/fallback/0/0/0.png answered $status, not a PNG"
echo 'ok   /tiles/fallback/0/0/0.png is a PNG'

expected=404
[ "${SMOKE_EXPECT_ADMIN:-}" = 1 ] && expected=401
status=$(get "$BASE/api/admin/session")
[ "$status" = "$expected" ] || fail "/api/admin/session answered $status, expected $expected"
echo "ok   /api/admin/session $status"

echo PASS
