#!/usr/bin/env bash
# Container smoke check (F59): build the image, run it with the droplet's settings from
# deploy/compose.deploy.yaml (TRUST_PROXY, NODE_OPTIONS' heap cap, DATA_DIR on a volume owned by
# uid 1000, mem_limit), so a dropped key fails here, then check /healthz and scripts/smoke.sh's
# paths (the app shell, /api/config, /api/categories, a room, a fallback tile, the admin wall),
# the non-root user, the HEALTHCHECK and a stop on SIGTERM in under 5 s. Cleans up on exit.
#
#   npm run smoke:docker          # or: scripts/docker-smoke.sh [image-tag]
#
# Needs Docker, curl and node. The deploy workflow runs it on the runner before the image ships.
set -euo pipefail

cd "$(dirname "$0")/.."
TAG="${1:-pinpoint:smoke}"
NAME="pinpoint-smoke-$$"
PORT="${SMOKE_PORT:-3998}"
BASE="http://127.0.0.1:$PORT"
COMPOSE=deploy/compose.deploy.yaml
# The host side of the data volume. Its files end up owned by uid 1000, so a root container of
# the image removes them before the folder goes.
DATA_HOST="$(mktemp -d)"
VOLUME="$DATA_HOST/data"

fail() {
  echo "FAIL: $*" >&2
  docker logs "$NAME" >&2 || true
  exit 1
}
cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run --rm --user 0 --entrypoint rm -v "$DATA_HOST:/work" "$TAG" -rf /work/data \
    >/dev/null 2>&1 || true
  rm -rf "$DATA_HOST" 2>/dev/null || true
}
trap cleanup EXIT

compose_value() {
  sed -n "s/^ *$1: *['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\} *$/\1/p" "$COMPOSE"
}
TRUST_PROXY=$(compose_value TRUST_PROXY)
NODE_OPTIONS=$(compose_value NODE_OPTIONS)
DATA_DIR=$(compose_value DATA_DIR)
MEM_LIMIT=$(compose_value mem_limit)
HOST_PORT=$(sed -n "s/^ *- *['\"]\{0,1\}127\.0\.0\.1:\([0-9]*\):3000['\"]\{0,1\} *$/\1/p" "$COMPOSE")
[ "$TRUST_PROXY" = 1 ] || fail "$COMPOSE does not set TRUST_PROXY: '1'"
[[ "$NODE_OPTIONS" == *--max-old-space-size=192* ]] || fail "$COMPOSE does not cap the heap at 192 MB"
[ -n "$DATA_DIR" ] || fail "$COMPOSE does not set DATA_DIR"
grep -Eq "^ *- *['\"]?/opt/pinpoint/data:$DATA_DIR['\"]? *$" "$COMPOSE" ||
  fail "$COMPOSE does not mount /opt/pinpoint/data at $DATA_DIR"
[ -n "$MEM_LIMIT" ] || fail "$COMPOSE does not set mem_limit"
[ "$HOST_PORT" = 3009 ] || fail "$COMPOSE does not bind 127.0.0.1:3009 to the container's 3000"
echo "ok   $COMPOSE: 127.0.0.1:3009 -> 3000, mem_limit $MEM_LIMIT, $NODE_OPTIONS, data at $DATA_DIR"

echo "== build $TAG"
docker build -q -t "$TAG" . >/dev/null

# As the droplet's data folder: owned by 1000:1000 (the image's `node` user).
docker run --rm --user 0 --entrypoint chown -v "$VOLUME:/data" "$TAG" 1000:1000 /data

echo "== run on :$PORT (--memory $MEM_LIMIT)"
docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" --memory "$MEM_LIMIT" \
  -e TRUST_PROXY="$TRUST_PROXY" -e NODE_OPTIONS="$NODE_OPTIONS" -e DATA_DIR="$DATA_DIR" \
  -v "$VOLUME:$DATA_DIR" "$TAG" >/dev/null

for _ in $(seq 1 60); do
  curl -fsS "$BASE/healthz" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS "$BASE/healthz" >/dev/null || fail "/healthz never answered"

scripts/smoke.sh "$BASE" || fail "scripts/smoke.sh failed"

logs=$(docker logs "$NAME" 2>&1)
grep -q '^Pinpoint listening on :3000$' <<<"$logs" ||
  fail "no production 'listening' line in the logs"
echo "ok   started in production"

user=$(docker exec "$NAME" id -u)
[ "$user" = 1000 ] || fail "process runs as uid $user, not 1000"
echo "ok   runs as uid 1000"

health=$(docker inspect --format '{{.State.Health.Status}}' "$NAME")
[ "$health" != unhealthy ] || fail "the image's HEALTHCHECK reports unhealthy"
echo "ok   HEALTHCHECK is $health"

start=$(date +%s)
docker stop "$NAME" >/dev/null
elapsed=$(($(date +%s) - start))
[ "$elapsed" -lt 5 ] || fail "docker stop took ${elapsed}s; SIGTERM was ignored"
echo "ok   stops on SIGTERM in ${elapsed}s"

echo "PASS"
