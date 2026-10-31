#!/usr/bin/env bash
# Container smoke check (F51), ported from Buzzr (buzzer/scripts/docker-smoke.sh): build the image,
# run it with the droplet's settings and memory limit, and prove the one process serves /healthz,
# the client and both Socket.IO namespaces (scripts/smoke.ts). Removes the container on exit.
#
#   npm run smoke:docker            # or: scripts/docker-smoke.sh [image-tag]
#
# Needs Docker and the project's node_modules (smoke.ts runs on the host with socket.io-client).
set -euo pipefail

cd "$(dirname "$0")/.."
TAG="${1:-sketchy:smoke}"
NAME="sketchy-smoke-$$"
PORT="${SMOKE_PORT:-3998}"
BASE="http://127.0.0.1:$PORT"
COMPOSE=deploy/compose.deploy.yaml

fail() {
  echo "FAIL: $*" >&2
  docker logs "$NAME" >&2 || true
  exit 1
}
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

# The droplet's own settings, read from the compose file, so a dropped key fails here.
compose_value() {
  sed -n "s/^ *$1: *['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\} *$/\1/p" "$COMPOSE"
}
TRUST_PROXY=$(compose_value TRUST_PROXY)
NODE_OPTIONS=$(compose_value NODE_OPTIONS)
MEM_LIMIT=$(compose_value mem_limit)
HOST_PORT=$(sed -n "s/^ *- *['\"]\{0,1\}127\.0\.0\.1:\([0-9]*\):3000['\"]\{0,1\} *$/\1/p" "$COMPOSE")
[ -n "$TRUST_PROXY" ] || fail "$COMPOSE does not set TRUST_PROXY"
[ -n "$NODE_OPTIONS" ] || fail "$COMPOSE does not set NODE_OPTIONS"
[ -n "$MEM_LIMIT" ] || fail "$COMPOSE does not set mem_limit"
[ "$HOST_PORT" = 3006 ] || fail "$COMPOSE does not bind 127.0.0.1:3006 to the container's 3000"
echo "ok   $COMPOSE: 127.0.0.1:3006 -> 3000, mem_limit $MEM_LIMIT"

echo "== build $TAG"
docker build -q -t "$TAG" . >/dev/null

echo "== run on :$PORT (TRUST_PROXY=$TRUST_PROXY, NODE_OPTIONS=$NODE_OPTIONS, --memory $MEM_LIMIT)"
docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" --memory "$MEM_LIMIT" \
  -e TRUST_PROXY="$TRUST_PROXY" -e NODE_OPTIONS="$NODE_OPTIONS" \
  "$TAG" >/dev/null

for _ in $(seq 1 30); do
  curl -fsS "$BASE/healthz" >/dev/null 2>&1 && break
  sleep 0.5
done

# /healthz, the client, the SPA fallback, a room, and WebSockets on `/` and `/ink`.
npx --no-install tsx scripts/smoke.ts "$BASE" || fail "scripts/smoke.ts failed"

# The packs came with the image and passed the start-up check.
docker logs "$NAME" 2>&1 | grep -q 'Sketchy server listening' || fail "no 'listening' line in the logs"
echo "ok   the server started with the word packs"

user=$(docker exec "$NAME" id -un)
[ "$user" = node ] || fail "process runs as $user, not node"
echo "ok   runs as node"

health=$(docker inspect --format '{{.State.Health.Status}}' "$NAME")
[ "$health" != unhealthy ] || fail "the image's HEALTHCHECK reports unhealthy"
echo "ok   HEALTHCHECK is $health"

start=$(date +%s)
docker stop "$NAME" >/dev/null
elapsed=$(($(date +%s) - start))
[ "$elapsed" -lt 5 ] || fail "docker stop took ${elapsed}s; SIGTERM was ignored"
echo "ok   stops on SIGTERM in ${elapsed}s"

echo "PASS"
