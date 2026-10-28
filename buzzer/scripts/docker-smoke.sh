#!/usr/bin/env bash
# Container smoke check (F34): build the image, run it, and prove the one process serves
# /healthz, the client and the Socket.IO handshake. Removes the container on exit.
#
#   npm run smoke:docker            # or: scripts/docker-smoke.sh [image-tag]
set -euo pipefail

cd "$(dirname "$0")/.."
TAG="${1:-buzzr:smoke}"
NAME="buzzr-smoke-$$"
PORT="${SMOKE_PORT:-3999}"
BASE="http://127.0.0.1:$PORT"

fail() {
  echo "FAIL: $*" >&2
  docker logs "$NAME" >&2 || true
  exit 1
}
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

echo "== build $TAG"
docker build -q -t "$TAG" . >/dev/null

# Run with the droplet's own settings, read from the compose file, so a dropped key fails here.
compose_env() {
  sed -n "s/^ *$1: *['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\} *$/\1/p" deploy/compose.deploy.yaml
}
TRUST_PROXY=$(compose_env TRUST_PROXY)
IMAGES_MAX_MB=$(compose_env IMAGES_MAX_MB)
PUBLIC_URL=$(compose_env PUBLIC_URL)
[ -n "$TRUST_PROXY" ] || fail "deploy/compose.deploy.yaml does not set TRUST_PROXY"
[ -n "$IMAGES_MAX_MB" ] || fail "deploy/compose.deploy.yaml does not set IMAGES_MAX_MB"
[ -n "$PUBLIC_URL" ] || fail "deploy/compose.deploy.yaml does not set PUBLIC_URL"

echo "== run on :$PORT (TRUST_PROXY=$TRUST_PROXY, IMAGES_MAX_MB=$IMAGES_MAX_MB, PUBLIC_URL=$PUBLIC_URL)"
docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" \
  -e TRUST_PROXY="$TRUST_PROXY" -e IMAGES_MAX_MB="$IMAGES_MAX_MB" -e PUBLIC_URL="$PUBLIC_URL" \
  "$TAG" >/dev/null

for _ in $(seq 1 30); do
  curl -fsS "$BASE/healthz" >/dev/null 2>&1 && break
  sleep 0.5
done

status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/healthz")
[ "$status" = 200 ] || fail "/healthz answered $status"
echo "ok   /healthz 200"

curl -fsS "$BASE/" | grep -q '<div id="root"' || fail "/ did not serve the client"
echo "ok   / serves the client"

curl -fsS "$BASE/play/ABCD" | grep -q '<div id="root"' || fail "/play/ABCD did not fall back to the client"
echo "ok   /play/ABCD falls back to the client"

config=$(curl -fsS "$BASE/api/config")
[ "$config" = "{\"joinOrigin\":\"$PUBLIC_URL\"}" ] || fail "/api/config answered $config"
echo "ok   /api/config returns PUBLIC_URL"

# The gateway accepts the WebSocket transport only, so open a real one with the project's client.
node --input-type=module -e "
import { io } from 'socket.io-client';
const socket = io('$BASE', { transports: ['websocket'], reconnection: false, timeout: 5000 });
socket.on('connect', () => { socket.close(); process.exit(0); });
socket.on('connect_error', (err) => { console.error(err.message); process.exit(1); });
" || fail "no Socket.IO WebSocket connection"
echo "ok   Socket.IO WebSocket connects"

# With TRUST_PROXY set, the room-creation limit (10 per hour) keys on X-Forwarded-For,
# as it does behind nginx: one client is refused on its 11th room, another still gets one.
body=$(npx --no-install tsx --eval "
import { DEFAULT_SETTINGS } from './shared/constants.ts';
import { SAMPLE_SET } from './shared/sampleSet.ts';
const settings = { ...DEFAULT_SETTINGS, scoreboardEvery: 0 };
process.stdout.write(JSON.stringify({ set: SAMPLE_SET, settings }));
")
create_room() {
  curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
    -H "X-Forwarded-For: $1" --data "$body" "$BASE/api/rooms"
}
codes=""
for _ in $(seq 1 11); do codes="$codes $(create_room 203.0.113.1)"; done
[ "$codes" = " 201 201 201 201 201 201 201 201 201 201 429" ] || fail "one client's rooms answered$codes"
[ "$(create_room 203.0.113.2)" = 201 ] || fail "a second client was refused: TRUST_PROXY not applied"
echo "ok   rate limit keys on the forwarded client IP"

user=$(docker exec "$NAME" id -un)
[ "$user" = node ] || fail "process runs as $user, not node"
echo "ok   runs as node"

start=$(date +%s)
docker stop "$NAME" >/dev/null
elapsed=$(($(date +%s) - start))
[ "$elapsed" -lt 5 ] || fail "docker stop took ${elapsed}s; SIGTERM was ignored"
echo "ok   stops on SIGTERM in ${elapsed}s"

echo "PASS"
