#!/usr/bin/env bash
# Container smoke check (F51), ported from Buzzr (buzzer/scripts/docker-smoke.sh): build the image,
# run it with the droplet's settings and memory limit, and prove the one process serves /healthz,
# the client and both Socket.IO namespaces (scripts/smoke.ts). It mounts a temp folder as the data
# volume, prepared as the deploy prepares /opt/sketchy/data, and checks that the first start seeds
# the CategoryStore and a second start keeps an edited one (F77). Removes the container and the
# folder on exit.
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
# The host side of the data volume. Its files end up owned by uid 1000, so a root container
# removes them before the folder goes.
DATA_HOST="$(mktemp -d)"
VOLUME="$DATA_HOST/data"

fail() {
  echo "FAIL: $*" >&2
  docker logs "$NAME" >&2 || true
  exit 1
}
cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run --rm --user 0 -v "$DATA_HOST:/work" "$TAG" rm -rf /work/data >/dev/null 2>&1 || true
  rm -rf "$DATA_HOST" 2>/dev/null || true
}
trap cleanup EXIT

# The droplet's own settings, read from the compose file, so a dropped key fails here.
compose_value() {
  sed -n "s/^ *$1: *['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\} *$/\1/p" "$COMPOSE"
}
TRUST_PROXY=$(compose_value TRUST_PROXY)
NODE_OPTIONS=$(compose_value NODE_OPTIONS)
MEM_LIMIT=$(compose_value mem_limit)
DATA_DIR=$(compose_value DATA_DIR)
HOST_PORT=$(sed -n "s/^ *- *['\"]\{0,1\}127\.0\.0\.1:\([0-9]*\):3000['\"]\{0,1\} *$/\1/p" "$COMPOSE")
[ -n "$TRUST_PROXY" ] || fail "$COMPOSE does not set TRUST_PROXY"
[ -n "$NODE_OPTIONS" ] || fail "$COMPOSE does not set NODE_OPTIONS"
[ -n "$MEM_LIMIT" ] || fail "$COMPOSE does not set mem_limit"
[ "$DATA_DIR" = /data ] || fail "$COMPOSE does not set DATA_DIR to /data"
grep -Eq "^ *- *['\"]?\./data:/data['\"]? *$" "$COMPOSE" || fail "$COMPOSE does not mount ./data at /data"
[ "$HOST_PORT" = 3006 ] || fail "$COMPOSE does not bind 127.0.0.1:3006 to the container's 3000"
echo "ok   $COMPOSE: 127.0.0.1:3006 -> 3000, mem_limit $MEM_LIMIT, ./data mounted at $DATA_DIR"

echo "== build $TAG"
docker build -q -t "$TAG" . >/dev/null

# The deploy's own step (deploy-sketchy.yml): Docker creates the folder, a root container of this
# image hands it to uid 1000, the image's `node` user.
docker run --rm --user 0 --entrypoint chown -v "$VOLUME:/data" "$TAG" 1000:1000 /data
[ "$(docker run --rm -v "$VOLUME:/data" "$TAG" stat -c %u /data)" = 1000 ] ||
  fail "the data volume is not owned by uid 1000"
echo "ok   the data volume is owned by uid 1000"

run_container() {
  echo "== run on :$PORT (TRUST_PROXY=$TRUST_PROXY, NODE_OPTIONS=$NODE_OPTIONS, DATA_DIR=$DATA_DIR, --memory $MEM_LIMIT)"
  docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" --memory "$MEM_LIMIT" \
    -e TRUST_PROXY="$TRUST_PROXY" -e NODE_OPTIONS="$NODE_OPTIONS" -e DATA_DIR="$DATA_DIR" \
    -v "$VOLUME:$DATA_DIR" \
    "$TAG" >/dev/null
  for _ in $(seq 1 30); do
    curl -fsS "$BASE/healthz" >/dev/null 2>&1 && return 0
    sleep 0.5
  done
  fail "/healthz never answered"
}

# The first category's title in the store, read by the image's own node.
store_title() {
  docker run --rm -v "$VOLUME:/data" "$TAG" node -e \
    'console.log(JSON.parse(require("fs").readFileSync("/data/categories.json","utf8")).categories[0].title)'
}

run_container

# /healthz, the client, the SPA fallback, a room, and WebSockets on `/` and `/ink`.
npx --no-install tsx scripts/smoke.ts "$BASE" || fail "scripts/smoke.ts failed"

# The packs came with the image, passed the start-up check and seeded the empty volume.
docker logs "$NAME" 2>&1 | grep -q 'Sketchy server listening' || fail "no 'listening' line in the logs"
docker logs "$NAME" 2>&1 | grep -q "^Seeded $DATA_DIR/categories.json from 9 word packs" ||
  fail "the first start did not seed $DATA_DIR/categories.json from the 9 packs"
echo "ok   the server started with the word packs and seeded the category store"

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

# An edit to the store (as the admin will make) survives a new container on the same volume.
docker rm "$NAME" >/dev/null
docker run --rm -v "$VOLUME:/data" "$TAG" node -e '
  const fs = require("fs"), p = "/data/categories.json";
  const f = JSON.parse(fs.readFileSync(p, "utf8"));
  f.categories[0].title = "Smoke edited";
  fs.writeFileSync(p, JSON.stringify(f, null, 2) + "\n");'
run_container
docker logs "$NAME" 2>&1 | grep -q "^Loaded $DATA_DIR/categories.json: " ||
  fail "the second start did not load the existing store"
! docker logs "$NAME" 2>&1 | grep -q '^Seeded ' || fail "the second start seeded the store again"
[ "$(store_title)" = "Smoke edited" ] || fail "the edited store was replaced"
echo "ok   a second start keeps the edited store (no re-seed)"
docker stop "$NAME" >/dev/null

echo "PASS"
