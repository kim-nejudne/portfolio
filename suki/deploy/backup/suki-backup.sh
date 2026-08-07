#!/usr/bin/env bash
#
# Nightly Postgres dump for SUKI. Installed at /usr/local/bin/suki-backup.sh
# and driven by suki-backup.timer.
#
# The operations table is an append-only log and it is the only authoritative
# copy of the shop's history. Phones hold their own queue, but a phone that has
# already synced has no reason to keep anything, and a lost server means every
# device rebases onto an empty log. So this runs nightly and verifies what it
# wrote — a dump that looks like a backup but restores nothing is worse than an
# obvious absence, because it is only discovered on the day it is needed.
set -Eeuo pipefail

# Overridable so the script can actually be exercised before it is installed.
# A backup script that has only ever been read is not a backup strategy.
STACK_DIR=${STACK_DIR:-/opt/suki}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/suki}
KEEP_DAYS=${KEEP_DAYS:-14}

# A coarse floor, not the real verification.
#
# This started at 4096 and rejected the first dump it ever took — a complete
# one, all three tables, gzipped to 1707 bytes. SUKI's schema is three tables
# wide, so at this scale a byte count cannot tell a schema-only dump from a
# full one; the gap between them is smaller than gzip's own variance. Anything
# above this floor is doing no work, and anything set high enough to feel
# reassuring silently throws away good backups.
#
# So the floor only catches genuinely broken output — a truncated pipe, an
# error message where a dump should be. The checks that actually mean something
# are the structural ones below.
MIN_BYTES=512

log() { printf '%s %s\n' "$(date -Is)" "$*"; }
fail() { log "FAILED: $*"; exit 1; }
trap 'fail "unexpected error on line $LINENO"' ERR

[ -f "$STACK_DIR/.env" ] || fail "no $STACK_DIR/.env"
# shellcheck disable=SC1091
set -a; . "$STACK_DIR/.env"; set +a

: "${POSTGRES_USER:?not set in .env}"
: "${POSTGRES_DB:?not set in .env}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Clear partials from an earlier failed run. They are never usable and would
# otherwise sit next to the real dumps looking like backups.
find "$BACKUP_DIR" -name '*.partial' -type f -mmin +60 -delete 2>/dev/null || true

stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$BACKUP_DIR/suki-$stamp.sql.gz"
tmp="$target.partial"

container=$(cd "$STACK_DIR" && docker compose ps -q db)
[ -n "$container" ] || fail "the db container is not running"

log "dumping $POSTGRES_DB"
docker exec -i "$container" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip -9 > "$tmp"

size=$(stat -c%s "$tmp")
[ "$size" -ge "$MIN_BYTES" ] || fail "dump is only ${size} bytes — refusing to keep it"

gzip -t "$tmp" || fail "dump is not valid gzip"

# One pass, no early exit. `zgrep -q` stops at the first match, which SIGPIPEs
# the decompressor feeding it — and under `pipefail` that turns a *successful*
# match into a non-zero exit, nondeterministically.
found=$(zcat "$tmp" \
  | grep -oE 'CREATE TABLE public\.(operations|rejections|clients) ' \
  | sort -u | wc -l)
[ "$found" -eq 3 ] \
  || fail "dump declares $found of 3 expected tables — it is not a complete backup"

# The log is the point. A dump with the schema but no rows would pass every
# check above and restore an empty shop.
rows=$(docker exec -i "$container" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c 'select count(*) from operations')
log "operations in database: $rows"
if [ "$rows" -gt 0 ]; then
  zcat "$tmp" | grep -q 'COPY public.operations' \
    || fail "database holds $rows operations but the dump has no COPY for them"
fi

mv "$tmp" "$target"
chmod 600 "$target"
log "wrote $target ($(numfmt --to=iec "$size"))"

# Rotate only after a good dump landed.
deleted=$(find "$BACKUP_DIR" -name 'suki-*.sql.gz' -type f -mtime "+$KEEP_DAYS" -print -delete | wc -l)
[ "$deleted" -gt 0 ] && log "pruned $deleted dump(s) older than $KEEP_DAYS days"

log "ok — $(find "$BACKUP_DIR" -name 'suki-*.sql.gz' | wc -l) dump(s) retained"
