#!/bin/sh
# Nightly mongodump for PokéTrack. Installed at /opt/poketrack/scripts/backup-db.sh
# and driven by root's crontab at 03:15 UTC — the slot the retired poke-project
# pg_dump used to occupy.
#
#   /opt/poketrack/scripts/backup-db.sh
#
# Writes a gzipped archive per run and keeps the most recent $KEEP. Restore
# instructions live in deploy/README.md.
set -eu

APP_DIR=/opt/poketrack
BACKUP_DIR="$APP_DIR/backups"
CONTAINER=poketrack-db-1
DB=poketrack
KEEP=14

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

mkdir -p "$BACKUP_DIR"

OUT="$BACKUP_DIR/poketrack-$(date -u +%Y%m%d-%H%M%S).archive.gz"
TMP="$OUT.partial"

# The container already carries the root credentials as MONGO_INITDB_ROOT_*, so
# they are expanded inside it and never cross the host shell or appear in a host
# process list. --archive streams to stdout, which lands on the host filesystem.
if ! docker exec -e DUMP_DB="$DB" "$CONTAINER" sh -c '
      mongodump --archive --gzip --quiet \
        --db="$DUMP_DB" \
        --username="$MONGO_INITDB_ROOT_USERNAME" \
        --password="$MONGO_INITDB_ROOT_PASSWORD" \
        --authenticationDatabase=admin' > "$TMP" 2>/dev/null; then
    log "FAILED mongodump errored — keeping existing backups untouched"
    rm -f "$TMP"
    exit 1
fi

# A zero-byte archive means the dump silently produced nothing. Treat it as a
# failure rather than rotating a good backup out in favour of an empty one.
if [ ! -s "$TMP" ]; then
    log "FAILED empty archive — keeping existing backups untouched"
    rm -f "$TMP"
    exit 1
fi

mv "$TMP" "$OUT"
log "ok $(basename "$OUT") ($(du -h "$OUT" | cut -f1))"

# Pruning is deliberately downstream of every failure exit above: a broken dump
# must never be able to age out the last good one.
ls -1t "$BACKUP_DIR"/poketrack-*.archive.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f "$old"
    log "pruned $(basename "$old")"
done
