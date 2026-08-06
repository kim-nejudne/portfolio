# The hub — droplet deployment

The apex. `kimnejudne.dev` itself, on the shared DigitalOcean droplet (sgp1),
alongside `n8n`, `netint-vpuaas`, and the five spokes. 1.9GB of RAM total.

> **Two placeholders run through this file.** `$DEPLOY_HOST` is the droplet as
> `user@host`, for ssh, scp and rsync; `$DROPLET_IP` is its IPv4, for DNS records
> and `dig` checks. Neither is recorded in this repository — export both in your
> shell profile before following anything below.

| | |
|---|---|
| Host path | `/var/www/hub` (static files, owned by `www-data`) |
| Process | **none** — nginx serves from disk |
| nginx | `/etc/nginx/sites-available/hub` → `kimnejudne.dev`, `www.kimnejudne.dev` |
| Auth | none; the site is public |
| App source | the `hub/` directory (Vite 6 + React 19 + TS + GSAP) |

## Status — live

**Deployed 2026-08-05; redeployed 2026-08-06** — twice: the card on stage sized
off the sky reservation with two chosen crops, then **the five case studies at
`/work/<spoke>/`**. A records added, both URL Redirect Records deleted,
certificate issued for both names, `hub.conf` installed over the bootstrap vhost,
all confirmations passing:

```
https://kimnejudne.dev/          200
http://kimnejudne.dev/           301 -> https
https://www.kimnejudne.dev/      301 -> apex
https://kimnejudne.dev/no-such   404      (not the SPA fallback)
https://kimnejudne.dev/work/*/   200      (all five)
https://kimnejudne.dev/work/*    301 -> trailing slash
```

**The case studies needed no change to `hub.conf`.** `try_files $uri $uri/ =404`
already resolves `/work/tallow/` to `/var/www/hub/work/tallow/index.html`, and
nginx 301s the slashless form itself. The last two lines above are checked by
`deploy.sh` after every reload, because they are the only part of this that
`vite preview` reaches by a different code path and so cannot answer.

Certificate expires **2026-11-02**; certbot's timer renews it, webroot against
`/var/www/certbot`, which the port-80 block keeps reachable.

Verified against the deployed site rather than the build: `verify.mjs` takes a
URL, so all **95 assertions were run against `https://kimnejudne.dev/`** through
nginx and TLS, and pass — the homepage and all five case studies. That is a stronger claim than the pre-ship run, which
only ever sees `vite preview`.

### Resolved: the two URL Redirect Records

Worth keeping, because the failure mode is not obvious and a future domain will
have the same records by default.

Adding the A records was not sufficient — Namecheap had **two** URL Redirect
Records, and a redirect record answers as an A record pointing at the forwarder.
So the apex resolved to two addresses:

```
kimnejudne.dev.  A  $DROPLET_IP      the droplet
kimnejudne.dev.  A  192.64.119.15    Namecheap URL Forward
```

**The forwarder has no TLS listener at all.** Port 80 open, port 443 filtered —
it does not refuse, it *hangs*:

```sh
curl -m 20 --resolve kimnejudne.dev:443:192.64.119.15 https://kimnejudne.dev/
# curl: (28) Connection timed out after 20002 milliseconds
```

Which address a visitor got was their resolver's choice, so it worked when tested
and failed for the person the link was sent to. **HSTS made it permanent rather
than self-healing**: the apex sends `max-age=31536000`, so a browser that had
loaded the site once would not fall back to the port that answers.

The second record's host was `kimnejudne`, i.e. `kimnejudne.kimnejudne.dev` — a
stuttering subdomain with no vhost and no certificate, which could only ever have
served plain HTTP from a parking service. Both deleted. Both had redirected over
`http://`; nginx now does the same redirect over TLS.

Authoritative is clean:

```sh
dig +short @pdns1.registrar-servers.com kimnejudne.dev A       # $DROPLET_IP
dig +short @pdns1.registrar-servers.com www.kimnejudne.dev A   # $DROPLET_IP
```

Public resolvers lag by the TTL (1799s), and **anycast resolvers lag unevenly** —
consecutive queries to the same address hit different nodes with different cache
state, so a single `dig` is not evidence either way. Sample repeatedly:

```sh
for r in 1.1.1.1 8.8.8.8 9.9.9.9 208.67.222.222; do
  printf '%-16s ' "$r"
  for i in $(seq 1 10); do printf '%s' "$(dig +short @$r kimnejudne.dev A | grep -c .)"; done
  echo   # want ten 1s; a 2 is a node still holding the old pair
done
```

The `MX` records and SPF `TXT` were checked after the change and are untouched.

## How it was deployed

Kept because renewal, a rebuild of the box, or a second apex would walk the same
path.

### 1. DNS — at Namecheap, by hand

DNS for this domain is at **Namecheap**, not DigitalOcean. Advanced DNS →
Host Records:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `$DROPLET_IP` | Automatic |
| A | `www` | `$DROPLET_IP` | Automatic |

And delete the **URL Redirect Record** on `@` — see above; this is the step that
was missed.

**Leave everything else alone.** In particular the `MX` records
(`eforward1–5.registrar-servers.com`) and the SPF `TXT`
(`v=spf1 include:spf.efwd.registrar-servers.com ~all`) are Namecheap email
forwarding for the domain. Changing A records does not affect mail; deleting
those records does.

The five spoke subdomains are separate A records and are not touched.

### 2. Prove the ACME path before spending a certbot attempt

A failed validation counts against Let's Encrypt's rate limit (5 per account per
hostname per hour), and certbot gives a poor account of *why* it failed. Serving
a token by hand and fetching it over the real name costs nothing and answers the
question outright:

```sh
TOKEN="probe-$(date -u +%s)"
ssh $DEPLOY_HOST "mkdir -p /var/www/certbot/.well-known/acme-challenge \
  && printf '%s' '$TOKEN' > /var/www/certbot/.well-known/acme-challenge/$TOKEN \
  && chown -R www-data:www-data /var/www/certbot"

# -L, and force each address the apex resolves to
for ip in $DROPLET_IP 192.64.119.15; do
  curl -sS -L --resolve "kimnejudne.dev:80:$ip" \
    "http://kimnejudne.dev/.well-known/acme-challenge/$TOKEN"
done
curl -sS -L "http://www.kimnejudne.dev/.well-known/acme-challenge/$TOKEN"
```

All three returned the token, which is why issuance was not a gamble despite the
apex resolving to two addresses. The `-L` is the whole point: HTTP-01 follows
redirects, so the parking address reaching the droplet via its own 302 to `www`
is a *pass*. Delete the token afterwards.

### 3. Certificate

Webroot, matching every other site on this box. Both names on one certificate,
because the `www` vhost needs its own TLS to be able to redirect at all — a
browser validates the certificate for the name it was given *before* it reads a
redirect, so `https://www.` without a cert covering `www` is a security warning
rather than a redirect.

```sh
ssh $DEPLOY_HOST \
  'certbot certonly --webroot -w /var/www/certbot \
     -d kimnejudne.dev -d www.kimnejudne.dev --keep-until-expiring'
```

### 4. Swap the bootstrap vhost for the real one

```sh
ssh $DEPLOY_HOST 'cp /etc/nginx/sites-available/hub /etc/nginx/sites-available/hub.bootstrap.bak'
scp deploy/nginx/hub.conf $DEPLOY_HOST:/etc/nginx/sites-available/hub
ssh $DEPLOY_HOST 'nginx -t && systemctl reload nginx'
```

`nginx -t` is the guard that matters here: `hub.conf` references the certificate
paths, so it cannot pass until step 3 has actually succeeded. If it fails,
nothing reloads and the six live sites keep running.

### 5. Confirm

```sh
curl -sI https://kimnejudne.dev/            | head -1   # 200
curl -sI http://kimnejudne.dev/             | head -1   # 301 -> https
curl -sI https://www.kimnejudne.dev/        | head -1   # 301 -> apex
curl -sI https://kimnejudne.dev/no-such     | head -1   # 404, NOT 200
```

That last one is not a formality — see *Caching and the SPA fallback* below.

Worth also confirming the five spokes still answer, since a reload is box-wide:

```sh
for s in tallow plinth forme poketrack suki; do
  curl -sS -o /dev/null -w "$s %{http_code}\n" "https://$s.kimnejudne.dev/"
done
```

## Deploying

```sh
./deploy/deploy.sh
```

Typechecks, builds, **runs the 95 browser assertions**, precompresses
(`gzip -9`, served by `gzip_static` so the shared vCPU isn't recompressing per
request), tars the current `/var/www/hub` to
`/var/backups/hub-<UTC-stamp>.tar.gz`, rsyncs with `--delete` so stale asset
hashes don't accumulate, then reloads nginx.

`HUB_HOST` is required and has no default — `HUB_HOST=user@host ./deploy/deploy.sh`.

**`npm run verify` is a gate here, not a habit.** `HUB_SKIP_VERIFY=1` exists and
should feel uncomfortable to type. This is the page a recruiter sees first and
the one nobody clicks *back* to — a broken choreography loses the visit outright,
where a broken spoke loses one of five.

## Rollback

Every run prints the exact restore command for the backup it just took:

```sh
ssh $DEPLOY_HOST 'rm -rf /var/www/hub/* \
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
| `crops/` | 875KB — five spoke crops × (AVIF + PNG); 83KB of it is the AVIF |
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
certificate/nginx chicken-and-egg. **No longer installed** — `hub.conf` was
written over it at step 4, and the version it replaced is kept on the droplet at
`/etc/nginx/sites-available/hub.bootstrap.bak`. Keep the file here: a rebuilt box
needs it again, in the same order.

nginx does **not** merge `add_header` across levels: any location block with an
`add_header` discards every header inherited from the server block. The security
headers are therefore repeated per location rather than set once at server level,
where they would silently apply to nothing.

## HTTP/2 — a box-wide decision, currently off

Every site on this droplet, the hub included, serves **HTTP/1.1**. That is not an
oversight in the hub's config; it is the state of the whole box, and it cannot be
changed for the hub alone.

`http2` in nginx 1.24 is a parameter of `listen`, and `listen` binds a **socket**,
not a server block. The first block to claim `0.0.0.0:443` sets the protocol
options for every vhost sharing that socket; the rest get a warning and are
ignored:

```
[warn] protocol options redefined for [::]:443 in /etc/nginx/sites-enabled/plinth:88
```

This was measured, not reasoned about. Adding `http2` to the hub's `listen` and
reloading put **all five spokes and both co-tenants** — `n8n`, `vpuaas` — onto
HTTP/2, from one line in one file. `sites-enabled` is read alphabetically, so
`hub` comes before `plinth`, `poketrack`, `suki` and `tallow` and wins the socket.

It was reverted. Not because HTTP/2 is wrong — it is a real improvement, and this
is the page that most wants it: two large art layers plus JS and CSS, plus two
preloads, against HTTP/1.1's six-connection limit and no header compression. It
was reverted because a change that reaches two co-tenant services is not a side
effect of deploying the apex.

To turn it on deliberately, put it on **every** `:443` block on the box in one
change, so the config states what is actually happening rather than eight files
claiming HTTP/1.1 and getting HTTP/2. On this nginx that is the `listen`
parameter, not the `http2 on;` directive — that arrived in 1.25.1, and using the
wrong form is an `nginx -t` failure, which is the good kind.

## Known gaps

Not blockers, but they are on the apex, which is where they cost most:

- **No `robots.txt`.** It 404s correctly rather than returning the document,
  which is the right failure, but it should exist on an apex.

Closed since: the share card and the icons, added 2026-08-05. `scripts/brand.sh`
renders them through headless chromium off the real fonts and the real head
layers, `public/favicon.svg` is the Bodoni K lifted out of the vendored variable
font, and a 37th assertion fetches every one of them and checks the type and the
declared dimensions — sabotage-proven five ways, including against `vite
preview`'s SPA fallback.

They are served from their own `location` block, with the artwork's week rather
than `/assets/`'s year or `location /`'s `no-cache`. A year would pin the first
card any platform ever scraped; `no-cache` would make every scrape and every tab
revalidate a file that changes about never.
- **Three of the five crops are headless screenshots**, not chosen crops —
  `tallow`, `plinth` and `forme`. `poketrack` and `suki` are chosen captures
  with sources in `art/crops/`. Long-standing; see `../README.md`.
