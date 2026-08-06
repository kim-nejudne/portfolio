# PLINTH — droplet deployment

Runs on the shared DigitalOcean droplet (sgp1) alongside `n8n`,
`netint-vpuaas`, `poketrack` and `tallow`. 1.9GB of RAM total.

> **Two placeholders run through this file.** `$DEPLOY_HOST` is the droplet as
> `user@host`, for ssh, scp and rsync; `$DROPLET_IP` is its IPv4, for DNS records
> and `dig` checks. Neither is recorded in this repository — export both in your
> shell profile before following anything below.

| | |
|---|---|
| Host path | `/var/www/plinth` (static files, owned by `www-data`) |
| Process | **none** — nginx serves from disk |
| nginx | `/etc/nginx/sites-available/plinth` → `plinth.kimnejudne.dev` |
| Auth | none; the site is public |
| App source | `frontend/` (Vite + React 19 + TS) |

## What this replaced

This vhost previously served a *different* PLINTH — a gym marketing site
("Strength is a discipline, not a mood"). It was deliberately replaced on
2026-08-02 by this site, the 16-week periodised program formerly called BLOCK.

The gym site's source is preserved locally on branch `recovered/plinth-craft-pass`
and tag `recovery/plinth-2026-07-31`. Its last build output is in `dist/` at the
repo root (not `frontend/dist/`). **Neither is on any remote** — do not delete
them without pushing first.

## Why this isn't containerised like tallow

TALLOW is Express + Postgres, so it needs a runtime and gets a compose stack.
PLINTH is a pure static Vite build with no server process at all. Running a
container purely to hand out ~900KB of static assets would cost memory on an
already-crowded box and buy nothing — nginx is already running and already
terminating TLS for four other sites.

A deploy is a build plus an rsync. There is no image and no container.

## Deploying

```bash
./deploy/deploy.sh
```

Typechecks and builds in `frontend/`, precompresses (`gzip -9`, served by
`gzip_static` so the single vCPU isn't recompressing per request), **tars the
current `/var/www/plinth` to `/var/backups/plinth-<UTC-stamp>.tar.gz`**, rsyncs
with `--delete` so stale asset hashes don't accumulate, then reloads nginx.

`PLINTH_HOST` is required and has no default — `PLINTH_HOST=user@host ./deploy/deploy.sh`.

## Rollback

Every run prints the exact restore command for the backup it just took:

```bash
ssh $DEPLOY_HOST 'rm -rf /var/www/plinth/* \
  && tar -xzf /var/backups/plinth-<STAMP>.tar.gz -C /var/www/plinth \
  && chown -R www-data:www-data /var/www/plinth && systemctl reload nginx'
```

## Caching

`/assets/` is content-hashed by Vite and served `immutable` for a year.
`index.html` is served `no-cache` — it's rewritten every deploy and a cached copy
would keep pointing at asset hashes that no longer exist.

nginx does **not** merge `add_header` across levels: any location block with an
`add_header` discards every header inherited from the server block. The security
headers are therefore repeated per location rather than set once at server level,
where they would silently apply to nothing.

## DNS and TLS

Both already in place from the previous site — the A record (`plinth` →
`$DROPLET_IP`, at **Namecheap**, not DigitalOcean) and the certbot certificate
for `plinth.kimnejudne.dev` are unchanged by this deploy. Nothing to redo.

## nginx

`nginx/plinth.conf` is a **verbatim copy of what is installed** at
`/etc/nginx/sites-available/plinth`, pulled back from the droplet after the last
change so the two cannot drift. `deploy.sh` does not touch it — it only reloads.

To change the vhost, edit it there, copy it up, and pull it back:

```bash
scp deploy/nginx/plinth.conf $DEPLOY_HOST:/tmp/plinth.conf
ssh $DEPLOY_HOST '
  cp /etc/nginx/sites-available/plinth /root/plinth.conf.bak-$(date -u +%Y%m%dT%H%M%SZ)
  cp /tmp/plinth.conf /etc/nginx/sites-available/plinth
  nginx -t && systemctl reload nginx'
```

Always `nginx -t` before reloading, and keep the backup — the certbot-managed
lines (`ssl_certificate`, `options-ssl-nginx.conf`, `ssl_dhparam`, the port-80
redirect block) are not reproducible by hand.

### Fixed 2026-08-02 — the site had no 404

`location /` was `try_files $uri $uri/ /index.html` — a single-page-app fallback
on a page with no router. **Every** unknown path answered 200 with the homepage
as `text/html`: `/favicon.ico`, `/og-card.png` and `/robots.txt` all returned the
document, no 404 existed anywhere on the site, and a crawler could have indexed
unlimited duplicate URLs. One line, `=404`.

A regex location for the root-level brand assets was added at the same time, so
the share card and icons get a day of caching instead of inheriting the
document's `no-cache`.

Verified after reload:

```
/                     200  text/html
/robots.txt           200  text/plain
/site.webmanifest     200  application/manifest+json
/og-card.png          200  image/png       Cache-Control: public, max-age=86400
/nonsense-xyz         404
```

## Brand assets

`favicon.svg`, `og-card.png`, the icons, `site.webmanifest`, `robots.txt` and
`sitemap.xml` are in `frontend/public/`, so they ship with an ordinary build.
The rasters are regenerated by `frontend/scripts/brand.sh` (headless chromium,
no npm dependency) — re-run it if the card copy or the mark changes.

They sit at the site root rather than under `/assets/`, deliberately: `/assets/`
is content-hashed and served `immutable` for a year, and platforms cache a share
card by URL and re-scrape it. A year of immutability would pin the first card any
platform ever saw.
