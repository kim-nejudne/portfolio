# ts-dojo — droplet deployment

`dojo.kimnejudne.dev`, on Kim's DigitalOcean droplet. The plinth pattern (spec §10): a static
build, no process on the droplet, nginx from disk.

> **Two placeholders run through this file.** `$TS_DOJO_HOST` is the droplet as `deploy@host`, for
> ssh, scp and rsync (the same variable `deploy.sh` requires); `$DROPLET_IP` is its IPv4, for the
> DNS record and `dig`. Neither is recorded in this repository: export both in your shell profile
> before following anything below.

| Item | Value |
| --- | --- |
| Host path | `/var/www/ts-dojo`, owned by `www-data` |
| Process | none |
| nginx | `/etc/nginx/sites-available/ts-dojo`, from `deploy/nginx/ts-dojo.conf` |
| TLS | certbot, webroot method against `/var/www/certbot` |
| DNS | Namecheap, A record `dojo` pointing at the droplet |
| Deploy | `deploy/deploy.sh`, by hand from the workstation, `TS_DOJO_HOST` required |

The table is §10 as written. Two rows have changed since, as recorded under Deviations in
`docs/progress.md`. The host path is now `deploy:www-data`, as `/var/www/poketrack` is, and nginx
only reads it. Deploys normally come from a push (below), and `deploy.sh` is the break-glass path.

## Status

Live at https://dojo.kimnejudne.dev since 25 October 2026.

## Deploying

**A push to `main` that touches `ts-dojo/` deploys it.** The workflow is
`.github/workflows/deploy-ts-dojo.yml` in the portfolio. It runs typecheck, lint, the unit tests,
the content lint and the build on the runner, and precompresses the output. It stages `dist/` in
`/var/www/ts-dojo.next` and swaps it live in two passes. The outgoing build is kept in
`/var/www/ts-dojo.prev`. Then it runs `deploy/confirm.sh` against the real host. Markdown-only
commits do not redeploy. Watch a run with `gh run watch`, or start one with
`gh workflow run deploy-ts-dojo.yml`.

`deploy.sh` is the same release done by hand, the break-glass path for when Actions is what's
broken:

```sh
TS_DOJO_HOST=deploy@host ./deploy/deploy.sh
```

Run it from `ts-dojo/` in the portfolio repository, on the workstation, as `deploy` and never
as root. `TS_DOJO_HOST` is required and has no default. In order, the script:

1. runs `pnpm typecheck`, `pnpm lint` and `pnpm content:lint` (every exercise proven solvable,
   spec §3);
2. runs `pnpm build` (the lib files copied, the app and both worker chunks built, the service
   worker written) and checks `dist/index.html`, `dist/sw.js` and the lib files exist;
3. precompresses `js`, `css`, `html`, `svg`, `json` and `d.ts` with `gzip -9`, served by
   `gzip_static` so the droplet's vCPU never recompresses per request;
4. rsyncs `dist/` into `/var/www/ts-dojo.next`, never straight into the live directory;
5. on the box, copies the live site to `/var/www/ts-dojo.prev`, then swaps in two passes:
   `assets/`, `ts/` and `packages/` first, then everything with `--delete` (see Caching for
   why). There is no `chown` and no reload, because nginx only reads static files;
6. runs `deploy/confirm.sh`, which checks the site through nginx with curl and stops at the
   first failure:
   - `https://dojo.kimnejudne.dev/` answers 200 (curl verifies the certificate);
   - `http://` answers 301 to `https://`;
   - `/l/<first lesson>` answers 200 `text/html` (the client-side router's fallback);
   - `/ts/6.0.3/lib.es2025.d.ts` comes back `text/plain`, gzip, with the `.gz` file's length and
     a strong ETag (the precompressed file, not gzip on the fly);
   - an `/assets/` file is `immutable`;
   - `/`, `/index.html` and `/sw.js` are `no-cache`, and the served `sw.js` is the one built;
   - the CSP on `/`, an asset and a lib file is exactly the one in `ts-dojo.conf`;
7. prints the rollback command.

Claude never runs it; Kim does.

## Rollback

Each deploy, by push or by hand, keeps exactly one previous build in `/var/www/ts-dojo.prev`:

```sh
ssh $TS_DOJO_HOST 'rsync -a --delete /var/www/ts-dojo.prev/ /var/www/ts-dojo/'
```

To go back further, check out the old sha and run `deploy.sh` from there.

A rollback also reaches visitors who already have the newer version: their service worker
checks `sw.js` (never cached), finds the restored one, and the app offers "Reload for the new
version" as it does for any update.

## Caching

| Path | Cache-Control | Why |
| --- | --- | --- |
| `/assets/*` | `public, max-age=31536000, immutable` | content-hashed by Vite: the app, both worker chunks, lesson chunks, fonts |
| `/ts/6.0.3/*` | `public, max-age=31536000, immutable` | TypeScript's lib files; the directory is versioned |
| `/packages/*` | `no-cache` (served by `location /`) | F14: the pre-bundled Zod (`zod-<version>.js`) and the package declarations (`types.json`); the service worker serves them from its precache |
| `/`, `/index.html`, `/sw.js`, `/workbox-*.js`, SPA routes | `no-cache` | rewritten every deploy |
| `/manifest.webmanifest` | `no-cache` | names the app and its icon; small |
| `/favicon.svg` | `public, max-age=86400` | not hashed, named by URL; a day, as plinth's brand assets |

`index.html` is `no-cache` because a cached copy would keep pointing at asset hashes that no
longer exist. `sw.js` is `no-cache` because the browser decides whether there is a new version
by fetching it: a cached `sw.js` would hold every visitor on the old precache.

**The service worker.** `vite-plugin-pwa` (spec §9 Offline) precaches the app, both worker
chunks, `/ts/6.0.3/` except the webworker libs no lesson uses, and `/packages/` on the first
visit, about 17.4 MB raw since F14, so every page, lesson, diagnostic and run works offline
afterwards. It registers once the compiler is ready, so the
precache never competes with the first load. On a later visit it fetches the new files in the
background and the header shows "Reload for the new version"; it never reloads by itself.

**The two-pass rsync.** A single `rsync --delete` writes files in no particular order, so for a
few seconds the new `index.html` or `sw.js` could be live while the chunks it names are still in
flight. The first pass puts every new hashed file, lib file and package file in place, without
deleting anything; the second pass writes the entry files and removes what the new build no longer has.

**The SPA fallback.** `location /` is `try_files $uri /index.html`, because the app has a
client-side router: `/l/<lesson>`, `/m/<module>`, `/repl`, `/settings` and `/progress` all
answer with the document, and an unknown path renders the app's own "not found" page.
`/assets/` and `/ts/` end in `=404` instead, so a missing chunk or lib file fails loudly
rather than coming back as HTML with a 200.

## DNS/TLS

The first deploy, in order (spec §10 First deploy, from the hub runbook). Each step is Kim's.

### 1. DNS at Namecheap, by hand

Advanced DNS → Host Records → add:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A | `dojo` | `$DROPLET_IP` | Automatic |

Leave every other record alone. Then confirm, against the authoritative server first (public
resolvers lag by the TTL):

```sh
dig +short @pdns1.registrar-servers.com dojo.kimnejudne.dev A   # $DROPLET_IP
dig +short dojo.kimnejudne.dev A                                # $DROPLET_IP, once caches catch up
```

### 2. Bootstrap vhost, then prove the ACME path

`ts-dojo.conf` names the certificate files, so `nginx -t` fails until they exist. Install the
HTTP-only `deploy/nginx/ts-dojo-bootstrap.conf` first. This step and everything else under nginx and
certbot run as root, not as `deploy`:

```sh
ssh $TS_DOJO_HOST 'mkdir -p /var/www/certbot \
  && install -d -o deploy -g www-data -m 755 /var/www/ts-dojo /var/www/ts-dojo.next /var/www/ts-dojo.prev'
scp deploy/nginx/ts-dojo-bootstrap.conf $TS_DOJO_HOST:/etc/nginx/sites-available/ts-dojo
ssh $TS_DOJO_HOST 'ln -sf /etc/nginx/sites-available/ts-dojo /etc/nginx/sites-enabled/ts-dojo \
  && nginx -t && systemctl reload nginx'
```

A failed validation counts against Let's Encrypt's rate limit, so serve a token by hand and
fetch it over the real name before spending a certbot attempt:

```sh
TOKEN="probe-$(date -u +%s)"
ssh $TS_DOJO_HOST "mkdir -p /var/www/certbot/.well-known/acme-challenge \
  && printf '%s' '$TOKEN' > /var/www/certbot/.well-known/acme-challenge/$TOKEN \
  && chown -R www-data:www-data /var/www/certbot"
curl -sS -L "http://dojo.kimnejudne.dev/.well-known/acme-challenge/$TOKEN"   # prints the token
ssh $TS_DOJO_HOST "rm /var/www/certbot/.well-known/acme-challenge/$TOKEN"
```

### 3. Certificate

Webroot, like every other site on the box:

```sh
ssh $TS_DOJO_HOST 'certbot certonly --webroot -w /var/www/certbot -d dojo.kimnejudne.dev'
```

certbot's timer renews it against the same webroot, which the port-80 block of `ts-dojo.conf`
keeps reachable.

### 4. Swap the bootstrap vhost for the real one

```sh
scp deploy/nginx/ts-dojo.conf $TS_DOJO_HOST:/etc/nginx/sites-available/ts-dojo
ssh $TS_DOJO_HOST 'nginx -t && systemctl reload nginx'
```

`nginx -t` is the guard: `ts-dojo.conf` cannot pass it until step 3 succeeded, and if it fails
nothing reloads and the other sites on the box keep running. Then copy the installed file back
(next section).

### 5. Deploy and confirm

Run `deploy.sh` (Deploying above); its curl checks are the confirmation: the certificate, the
redirect, the lesson URL, the precompressed lib file (its `.gz` length and a strong ETag, which
on-the-fly gzip cannot fake), the cache headers, the CSP compared whole with this conf's, and the
served `sw.js` identical to the one just built. Then, by hand, open
https://dojo.kimnejudne.dev/ and check the padlock, and run once with the network off after one
online visit (DevTools → Network → Offline): the app, a lesson, diagnostics and a run all work.

## nginx

`nginx/ts-dojo.conf` is the shipped configuration. After any change on the droplet, pull the
installed file back so the two cannot drift:

```sh
scp $TS_DOJO_HOST:/etc/nginx/sites-available/ts-dojo deploy/nginx/ts-dojo.conf
```

`deploy.sh` does not touch it; it only reloads. **Never scp a whole vhost over one certbot has
edited**: certbot's TLS lines would be lost. This file is written for `certbot certonly`, which
never edits it, and carries the TLS lines itself.

The differences from `plinth.conf` (spec §10):

- `location / { try_files $uri /index.html; }`, because the app has a client-side router.
  `/assets/` and `/ts/` keep `try_files $uri =404`.
- `location /ts/ { types { text/plain ts; } ... }` with a one-year immutable cache. nginx's
  `mime.types` maps `.ts` to `video/mp2t`; the worker reads the files as text either way, but
  the right type keeps `gzip_types` and any proxy honest.
- `index.html`, `sw.js` and `manifest.webmanifest` are `no-cache`; everything under `/assets/`
  is immutable.
- `gzip_static on`, with `deploy.sh` precompressing `js`, `css`, `html`, `svg`, `json` and
  `d.ts`.
- The Content-Security-Policy:

  ```
  default-src 'self'; script-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'
  ```

  The sandbox loads the user's modules from `blob:` URLs and starts a worker per run; nothing
  else loads from anywhere but this origin. `vite.config.ts` reads the policy from this file
  for `vite preview`, so every Playwright run happens under exactly the shipped policy.

nginx does **not** merge `add_header` across levels: any location with an `add_header` discards
every header inherited from the server block. The security headers and the CSP are therefore
repeated in each location; set once at server level they would silently apply to nothing.
`deploy/deploy.test.ts` checks that every location sends the CSP verbatim.

No `http2`: on this nginx it is a parameter of `listen`, which binds the socket for every vhost
on the box, so turning it on is a box-wide change (the hub's deploy README has the detail).

`nginx/ts-dojo-bootstrap.conf` is the HTTP-only vhost from DNS/TLS step 2. It is not installed
after step 4, but keep it here: a rebuilt box needs it again, in the same order.
