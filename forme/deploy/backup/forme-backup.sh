#!/usr/bin/env bash
#
# Nightly Postgres dump for FORME. Installed at /usr/local/bin/forme-backup.sh
# and driven by forme-backup.timer.
#
# Deliberately boring: dump, verify, rotate. The only interesting decisions are
# that it writes atomically (a half-written dump that looks like a backup is
# worse than no backup) and that it refuses to rotate if the new dump failed
# its sanity check — otherwise one bad night quietly eats the good copies.
set -Eeuo pipefail

STACK_DIR=/opt/forme
BACKUP_DIR=/var/backups/forme
KEEP_DAYS=14

# Smallest plausible dump. A schema-only or failed dump is far below this, and
# catching that here is the whole point of checking.
MIN_BYTES=8192

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
target="$BACKUP_DIR/forme-$stamp.sql.gz"
tmp="$target.partial"

container=$(cd "$STACK_DIR" && docker compose ps -q db)
[ -n "$container" ] || fail "the db container is not running"

log "dumping $POSTGRES_DB"
# --clean --if-exists so the dump can be replayed over an existing database.
docker exec -i "$container" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip -9 > "$tmp"

size=$(stat -c%s "$tmp")
[ "$size" -ge "$MIN_BYTES" ] || fail "dump is only ${size} bytes — refusing to keep it"

# Verify it is readable gzip and actually contains the schema, not just a
# header. A truncated pipe produces a valid-looking file that restores nothing.
gzip -t "$tmp" || fail "dump is not valid gzip"

# One pass, no early exit. `zgrep -q` stops reading at the first match, which
# SIGPIPEs the decompressor it is reading from — and under `pipefail` that
# turns a *successful* match into a non-zero exit, nondeterministically
# depending on when the buffer flushes.
expected="jobs job_events preflight_checks users price_rates"
found=$(zcat "$tmp" \
  | grep -oE 'CREATE TABLE public\.(jobs|job_events|preflight_checks|users|price_rates) ' \
  | sort -u | wc -l)
want=$(printf '%s\n' $expected | wc -l)
[ "$found" -eq "$want" ] \
  || fail "dump declares $found of $want expected tables — it is not a complete backup"

mv "$tmp" "$target"
chmod 600 "$target"
log "wrote $target ($(numfmt --to=iec "$size"))"

# Rotate only after a good dump landed.
deleted=$(find "$BACKUP_DIR" -name 'forme-*.sql.gz' -type f -mtime "+$KEEP_DAYS" -print -delete | wc -l)
[ "$deleted" -gt 0 ] && log "pruned $deleted dump(s) older than $KEEP_DAYS days"

log "ok — $(find "$BACKUP_DIR" -name 'forme-*.sql.gz' | wc -l) dump(s) retained"
