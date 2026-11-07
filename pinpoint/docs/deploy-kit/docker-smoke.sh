#!/usr/bin/env bash
# Container smoke check (F59): build the image, run it with the droplet's settings and
# memory limit (read from deploy/compose.deploy.yaml, so a dropped key fails here), and prove it
# serves /healthz and the app's critical paths (npm run smoke -- <url>). Removes the container
# on exit.
#
#   scripts/docker-smoke.sh [image-tag]
#
# Needs Docker. The deploy workflow runs it on the runner before the image ships.
set -euo pipefail

cd "$(dirname "$0")/.."
TAG="${1:-pinpoint:smoke}"
NAME="pinpoint-smoke-$$"
PORT="${SMOKE_PORT:-3998}"
BASE="http://127.0.0.1:$PORT"
COMPOSE=deploy/compose.deploy.yaml
# Environment the image needs to boot without real keys (fake mode), if any. The Docker feature
# fills this in; production gets real keys from /opt/pinpoint/.env instead.
EXTRA_ENV=()

fail() {
  echo "FAIL: $*" >&2
  docker logs "$NAME" >&2 || true
  exit 1
}
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

MEM_LIMIT=$(sed -n "s/^ *mem_limit: *['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\} *$/\1/p" "$COMPOSE")
HOST_PORT=$(sed -n "s/^ *- *['\"]\{0,1\}127\.0\.0\.1:\([0-9]*\):3000['\"]\{0,1\} *$/\1/p" "$COMPOSE")
[ -n "$MEM_LIMIT" ] || fail "$COMPOSE does not set mem_limit"
[ "$HOST_PORT" = 3007 ] || fail "$COMPOSE does not bind 127.0.0.1:3007 to the container's 3000"
echo "ok   $COMPOSE: 127.0.0.1:3007 -> 3000, mem_limit $MEM_LIMIT"

# Literal `KEY: 'value'` lines under `environment:` (never ${...} references) go to the container.
mapfile -t COMPOSE_ENV < <(awk '
  /^ *environment:/ { on = 1; ind = match($0, /[^ ]/); next }
  on && match($0, /[^ ]/) <= ind { on = 0 }
  on && /^ *[A-Z_][A-Z0-9_]*: / && $0 !~ /\$\{/ {
    line = $0; sub(/^ */, "", line); split(line, kv, /: */)
    v = substr(line, length(kv[1]) + 2); sub(/^ */, "", v); gsub(/^['\''"]|['\''"]$/, "", v)
    print kv[1] "=" v
  }' "$COMPOSE")
ENV_ARGS=()
for kv in "${COMPOSE_ENV[@]}" "${EXTRA_ENV[@]}"; do ENV_ARGS+=(-e "$kv"); done

echo "== build $TAG"
docker build -q -t "$TAG" . >/dev/null

echo "== run on :$PORT (--memory $MEM_LIMIT, ${#ENV_ARGS[@]} env args)"
docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" --memory "$MEM_LIMIT" \
  "${ENV_ARGS[@]}" "$TAG" >/dev/null

for _ in $(seq 1 60); do
  curl -fsS "$BASE/healthz" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS "$BASE/healthz" >/dev/null || fail "/healthz never answered"
echo "ok   /healthz"

# The app's own checks against a base URL: the main page, critical routes, WebSockets if any.
npm run smoke -- "$BASE" || fail "npm run smoke -- failed"

user=$(docker exec "$NAME" id -u)
[ "$user" != 0 ] || fail "process runs as root"
echo "ok   runs as uid $user"

health=$(docker inspect --format '{{.State.Health.Status}}' "$NAME" 2>/dev/null || echo none)
[ "$health" != unhealthy ] || fail "the image's HEALTHCHECK reports unhealthy"
echo "ok   HEALTHCHECK is $health"

start=$(date +%s)
docker stop "$NAME" >/dev/null
elapsed=$(($(date +%s) - start))
[ "$elapsed" -lt 5 ] || fail "docker stop took ${elapsed}s; SIGTERM was ignored"
echo "ok   stops on SIGTERM in ${elapsed}s"

echo "PASS"
