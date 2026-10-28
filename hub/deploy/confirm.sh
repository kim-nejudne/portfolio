#!/usr/bin/env bash
#
# Confirms the live hub through nginx. Run after a deploy, from anywhere:
#
#   ./deploy/confirm.sh
#
# Called by `deploy.sh` at the end of a manual deploy and by
# `.github/workflows/deploy-hub.yml` after a push deploys. One copy of the
# checks, so the two paths cannot drift apart.
set -euo pipefail

SITE="https://kimnejudne.dev"

# The two things `vite preview` cannot answer, because they are nginx's rather
# than the build's: that `try_files $uri $uri/` resolves a directory to its
# index, and that the slashless form 301s to the canonical one. Neither is a
# code change — `hub.conf` is untouched by the case studies — so this is
# confirmation rather than a test, but it is the only place it can happen.
#
# The index at `/work/` goes through the same two checks and is listed first,
# because it is the one path here that failed differently — 403, not 404, since
# `$uri/` resolved the directory and autoindex is off — and the only one that
# is printed on the CV.
echo "==> Confirm the case studies through nginx"
for path in work work/poketrack work/ts-dojo; do
  slash="$(curl -s -o /dev/null -w '%{http_code}' "${SITE}/${path}/")"
  bare="$(curl -s -o /dev/null -w '%{http_code}' "${SITE}/${path}")"
  printf '    /%-15s %s (bare: %s)\n' "${path}/" "$slash" "$bare"
  [ "$slash" = "200" ] || { echo "    ^ expected 200" >&2; exit 1; }
  [ "$bare" = "301" ] || { echo "    ^ expected 301 to the trailing-slash form" >&2; exit 1; }
done

# And the CV through nginx, where `/cv.pdf` falls past the root-asset regex into
# `location /`. The content type is the assertion, not the status: `try_files`
# ends in `=404` here so a missing file is honest, but the type is what proves
# nginx is serving the PDF as a PDF rather than as a download of last resort.
echo "==> Confirm the CV through nginx"
cvtype="$(curl -sI "${SITE}/cv.pdf" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2}')"
printf '    /cv.pdf  %s\n' "${cvtype:-<none>}"
case "$cvtype" in
  application/pdf*) ;;
  *) echo "    ^ expected application/pdf" >&2; exit 1 ;;
esac
