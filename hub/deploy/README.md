# The hub — droplet deployment

The apex. `kimnejudne.dev` itself, on the shared DigitalOcean droplet
`165.245.189.5` (sgp1), alongside `n8n`, `netint-vpuaas`, and the five spokes.
1.9GB of RAM total.

| | |
|---|---|
| Host path | `/var/www/hub` (static files, owned by `www-data`) |
| Process | **none** — nginx serves from disk |
| nginx | `/etc/nginx/sites-available/hub` → `kimnejudne.dev`, `www.kimnejudne.dev` |
| Auth | none; the site is public |
| App source | the `hub/` directory (Vite 6 + React 19 + TS + GSAP) |

## Status — half-deployed, and DNS is the blocking half

**The files are on the droplet and nginx is serving them.** Verified by `Host`
header against the IP, since the name does not point here yet:

```sh
curl -I -H 'Host: kimnejudne.dev' http://165.245.189.5/     # 200
```

**What is not done: DNS, and therefore TLS.** `kimnejudne.dev` currently resolves
to `75.2.60.5` and `192.64.119.15` — Namecheap's parking/redirect service — and
302s to `www.kimnejudne.dev`, which has no A record at all. So the apex is
*already broken* for visitors today, independently of this deploy: it redirects
to a hostname that does not resolve.

Until the A records move, the droplet is running the **bootstrap** vhost
(`nginx/hub-bootstrap.conf`): HTTP only, no redirect, no security headers. That
is not the shipped configuration and must not be left installed.

## Finishing the deploy

### 1. DNS — at Namecheap, by hand

DNS for this domain is at **Namecheap**, not DigitalOcean. Advanced DNS →
Host Records:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `165.245.189.5` | Automatic |
| A | `www` | `165.245.189.5` | Automatic |

Delete the **URL Redirect Record** on `@` that currently sends the apex to
`www` — it is what returns the 302 today, and it will shadow the A record.

**Leave everything else alone.** In particular the `MX` records
(`eforward1–5.registrar-servers.com`) and the SPF `TXT`
(`v=spf1 include:spf.efwd.registrar-servers.com ~all`) are Namecheap email
forwarding for the domain. Changing A records does not affect mail; deleting
those records does.

The five spoke subdomains are separate A records and are not touched.

Wait for propagation before step 2 — certbot validates over HTTP against the
real name, and a failed attempt counts against Let's Encrypt's rate limit
(5 failures per account per hostname per hour):

```sh
dig +short kimnejudne.dev www.kimnejudne.dev    # both -> 165.245.189.5
```

### 2. Certificate

Webroot, matching every other site on this box. Both names on one certificate,
because the `www` vhost needs its own TLS to be able to redirect at all — a
browser validates the certificate for the name it was given *before* it reads a
redirect, so `https://www.` without a cert covering `www` is a security warning
rather than a redirect.

```sh
ssh root@165.245.189.5 \
  'certbot certonly --webroot -w /var/www/certbot \
     -d kimnejudne.dev -d www.kimnejudne.dev'
```

### 3. Swap the bootstrap vhost for the real one

```sh
scp deploy/nginx/hub.conf root@165.245.189.5:/etc/nginx/sites-available/hub
ssh root@165.245.189.5 'nginx -t && systemctl reload nginx'
```

`nginx -t` is the guard that matters here: `hub.conf` references the certificate
paths, so it cannot pass until step 2 has actually succeeded. If it fails,
nothing reloads and the six live sites keep running.

### 4. Confirm

```sh
curl -sI https://kimnejudne.dev/            | head -1   # 200
curl -sI http://kimnejudne.dev/             | head -1   # 301 -> https
curl -sI https://www.kimnejudne.dev/        | head -1   # 301 -> apex
curl -sI https://kimnejudne.dev/no-such     | head -1   # 404, NOT 200
```

That last one is not a formality — see *Caching and the SPA fallback* below.

## Deploying

```sh
./deploy/deploy.sh
```

Typechecks, builds, **runs the 36 browser assertions**, precompresses
(`gzip -9`, served by `gzip_static` so the shared vCPU isn't recompressing per
request), tars the current `/var/www/hub` to
`/var/backups/hub-<UTC-stamp>.tar.gz`, rsyncs with `--delete` so stale asset
hashes don't accumulate, then reloads nginx.

Override the target with `HUB_HOST=root@host ./deploy/deploy.sh`.

**`npm run verify` is a gate here, not a habit.** `HUB_SKIP_VERIFY=1` exists and
should feel uncomfortable to type. This is the page a recruiter sees first and
the one nobody clicks *back* to — a broken choreography loses the visit outright,
where a broken spoke loses one of five.

## Rollback

Every run prints the exact restore command for the backup it just took:

```sh
ssh root@165.245.189.5 'rm -rf /var/www/hub/* \
  && tar -xzf /var/backups/hub-<STAMP>.tar.gz -C /var/www/hub \
  && chown -R www-data:www-data /var/www/hub && systemctl reload nginx'
```

The first deploy had nothing to back up, so there is no pre-hub state to return
to — the apex served a Namecheap redirect, not files.

## Why this isn't containerised

The hub is a pure static Vite build with no server process. Running a container
to hand out static assets would cost memory on a box already carrying five sites
and two co-tenants in 1.9GB, and buy nothing — nginx is already running and
already terminating TLS for seven other names.

A deploy is a build plus an rsync. There is no image and no container.

## Weight

**8.2MB, and 7MB of it is the head.** That is the entire budget story:

| | |
|---|---|
| `head/` | 7.1MB — four layers × (AVIF + PNG fallback) |
| `crops/` | 808KB — five spoke screenshots × (AVIF + PNG) |
| `assets/` | 376KB — JS 320KB (110KB gzipped) + CSS |
| `index.html` | 4KB |

What a visitor actually downloads is far less: the PNGs are fallbacks that only
non-AVIF browsers fetch, so a current browser takes **461KB of head** against
the 600KB budget. The PNGs are shipped because they have to exist for the
`<picture>` fallback to mean anything.

Only `.js/.css/.html/.svg` are precompressed. AVIF and PNG are already
compressed and gzip gains nothing on them — compressing the head would double
the rsync for zero benefit.

## Caching and the SPA fallback

`/assets/` is content-hashed by Vite and served `immutable` for a year.

`/head/` and `/crops/` are **not** hashed — they come from `public/`, so their
URLs are stable while the bytes change. A week, which is long enough to be worth
having and short enough that a re-cut lands without a cache-buster. The art has
been re-cut twice in two days; `immutable` would have been wrong both times.

`index.html` is `no-cache` — rewritten every deploy, and a cached copy would keep
pointing at asset hashes that no longer exist.

**`try_files $uri $uri/ =404`, not `/index.html`.** The hub is one page with no
client-side router. An SPA fallback would answer every unknown path with 200 and
the homepage as text/html: `/favicon.ico` and `/robots.txt` would return the
document, no 404 would exist anywhere, and a crawler could index unlimited
duplicate URLs of the portfolio's front door.

This is not hypothetical. `vite preview` *has* that fallback, and it is exactly
what made the preload assertion pass on a preload pointing at a deleted layer —
200, with `index.html` as the body. The check now compares the response's
content type against the preload's `as`, which is what a `=404` server would have
made unnecessary. See `scripts/verify.mjs`.

## nginx

`nginx/hub.conf` is the shipped configuration and is a copy of what is installed.
Pull it back from the droplet after any change so the two cannot drift.
`deploy.sh` does not touch it — it only reloads.

`nginx/hub-bootstrap.conf` is the HTTP-only vhost used to break the
certificate/nginx chicken-and-egg. Currently installed. Delete it from the
droplet's config by overwriting with `hub.conf` at step 3.

nginx does **not** merge `add_header` across levels: any location block with an
`add_header` discards every header inherited from the server block. The security
headers are therefore repeated per location rather than set once at server level,
where they would silently apply to nothing.

## Known gaps

Not blockers, but they are on the apex, which is where they cost most:

- **No `og:image`.** `index.html` has `og:title`, `og:description` and `og:url`
  but no card, so every share of the portfolio's front door renders imageless.
  PLINTH solves this with `frontend/scripts/brand.sh`, which renders a card
  through headless chromium and needs no image dependency; the same approach
  applies here.
- **No favicon, no `robots.txt`.** Both 404 correctly rather than returning the
  document, which is the right failure, but both should exist on an apex.
- **The five crops are headless screenshots**, not chosen crops. Long-standing;
  see `../README.md`.
