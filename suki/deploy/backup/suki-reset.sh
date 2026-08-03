#!/usr/bin/env bash
#
# Nightly reset of the demo shop. Installed at /usr/local/bin/suki-reset.sh
# and driven by suki-reset.timer.
#
# Why this exists
# ---------------
# SUKI's product model is one shop with several devices behind one counter, all
# sharing one append-only log. `pull` therefore returns every operation past the
# client's cursor, regardless of which device wrote it — which is correct for a
# sari-sari store and wrong for a public portfolio demo, where every visitor is
# a stranger sharing that same shop.
#
# Without this, a recruiter opening the link a week from now would see whatever
# had accumulated: other people's sales, other people's utang, and anything
# crude somebody typed into a note. This wipes the shop each night so every
# visitor starts from the seeded fixtures.
#
# The alternative was scoping the log per visitor, which is the better product
# answer but changes the schema the case study describes. This is the cheap one,
# and its limitation is stated rather than hidden: between one visitor and the
# next reset, they share a shop.
set -Eeuo pipefail

STACK_DIR=${STACK_DIR:-/opt/suki}

log() { printf '%s %s\n' "$(date -Is)" "$*"; }
fail() { log "FAILED: $*"; exit 1; }
trap 'fail "unexpected error on line $LINENO"' ERR

[ -f "$STACK_DIR/.env" ] || fail "no $STACK_DIR/.env"
# shellcheck disable=SC1091
set -a; . "$STACK_DIR/.env"; set +a

: "${POSTGRES_USER:?not set in .env}"
: "${POSTGRES_DB:?not set in .env}"

container=$(cd "$STACK_DIR" && docker compose ps -q db)
[ -n "$container" ] || fail "the db container is not running"

psql_() { docker exec -i "$container" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -q "$@"; }

before=$(psql_ -c 'select count(*) from operations')
log "clearing $before operation(s) from the demo shop"

# TRUNCATE **without** RESTART IDENTITY, deliberately.
#
# `seq` is the cursor every client pages from, and clients keep their cursor in
# IndexedDB across the reset. Restarting the sequence would hand the next
# operation a seq *below* a returning visitor's cursor, so `pull` would never
# return it — that visitor's own sales would sync to the server and then be
# invisible to their next pull, forever. Letting the sequence keep climbing
# costs nothing and keeps every stored cursor meaningful.
psql_ -c 'truncate table operations, rejections, clients'

after=$(psql_ -c 'select count(*) from operations')
[ "$after" -eq 0 ] || fail "operations still holds $after row(s) after truncate"

# The sequence must have kept its position, or returning visitors break. Checked
# rather than assumed, because it is a one-word difference in the statement
# above and the damage would be silent.
# pg_get_serial_sequence returns the sequence *name*, so it has to be cast to
# regclass and read through pg_sequence_last_value. Selecting last_value from
# the function directly looks right and errors at runtime — which, under the
# ERR trap above, would have failed this script every single night.
next=$(psql_ -c "select coalesce(pg_sequence_last_value(pg_get_serial_sequence('operations','seq')::regclass), 0)")
if [ "$next" -lt "$before" ]; then
  fail "the seq sequence went backwards (now $next, was at least $before) — returning clients will lose writes"
fi

log "ok — demo shop reset, seq continues from $next"
