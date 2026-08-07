#!/bin/sh
# Regenerates the GoAccess report for poketrack.kimnejudne.dev. Installed at
# /opt/poketrack/scripts/stats.sh and driven by root's crontab hourly.
#
# This replaced client-side analytics rather than supplementing it. Nothing runs
# in the visitor's browser, no third party is involved, and there is no long-lived
# process — nginx is already writing these lines whether or not anyone reads them.
set -eu

LOG_DIR=/var/log/nginx
LOG_BASE=poketrack.access.log
OUT_DIR=/var/www/poketrack-stats
OUT="$OUT_DIR/index.html"
# Must keep a .html suffix: goaccess picks its output format from the extension
# and refuses anything it does not recognise. Dotfile so a half-written report is
# not browsable in the moment before the mv.
TMP="$OUT_DIR/.report-partial.html"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

mkdir -p "$OUT_DIR"

# Oldest first, so the report's date range reads in order. sort -V rather than a
# plain sort: lexically ".log.14.gz" sorts before ".log.9.gz", which would
# interleave a fortnight of traffic backwards.
FILES=$(ls -1 "$LOG_DIR/$LOG_BASE"* 2>/dev/null | sort -V -r || true)

if [ -z "$FILES" ]; then
    log "no $LOG_BASE yet — nginx has not logged a request for this vhost"
    exit 0
fi

# zcat -f reads the compressed and uncompressed generations alike. Deliberately
# stateless — no --persist database — so re-running can never double-count lines
# it has already seen. The whole retained window is cheap to reparse.
# shellcheck disable=SC2086
if ! zcat -f $FILES 2>/dev/null | goaccess - \
        --log-format=COMBINED \
        --ignore-crawlers \
        --anonymize-ip \
        --no-progress \
        --html-report-title="poketrack.kimnejudne.dev" \
        -o "$TMP"; then
    log "FAILED goaccess errored — leaving the previous report in place"
    rm -f "$TMP"
    exit 1
fi

[ -s "$TMP" ] || { log "FAILED empty report — leaving the previous one in place"; rm -f "$TMP"; exit 1; }

mv "$TMP" "$OUT"
chown www-data:www-data "$OUT"
log "ok $(du -h "$OUT" | cut -f1) from $(echo "$FILES" | wc -l) log file(s)"
