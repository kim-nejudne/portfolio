#!/bin/sh
# Rebuild PokéTrack's demo world. Installed at /opt/poketrack/scripts/reset-demo.sh
# and driven by root's crontab at 04:15 UTC — an hour after the backup, so a
# reset never lands mid-mongodump.
#
#   /opt/poketrack/scripts/reset-demo.sh
#
# Runs backend/seed_demo.py inside the running API container. That container
# already holds MONGO_URL and can reach mongo on the compose network, which the
# host cannot — mongo publishes no port. Nothing needs installing on the host.
#
# The seed wipes and rebuilds only what is reachable from a demo user, so
# whatever visitors did to the boards during the day is undone and nothing else
# is touched. Ids are derived from a fixed namespace, so a reset does not sign
# anybody out or break a bookmarked project URL.
set -eu

CONTAINER=poketrack-app-1

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

# A reset against a stopped app would half-apply at best. Bail before touching
# anything rather than after.
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]; then
    log "FAILED $CONTAINER is not running — demo world left as it is"
    exit 1
fi

if ! OUTPUT=$(docker exec "$CONTAINER" python seed_demo.py --quiet 2>&1); then
    log "FAILED seed errored — demo world may be partially rebuilt"
    log "$OUTPUT"
    exit 1
fi

log "ok $(echo "$OUTPUT" | grep '^seeded:' || echo 'seeded')"
