# Pinpoint

A geography party game. One **Screen** (a laptop on a TV) shows a city's name or a landmark's photo, everyone drops a pin on the map on their phone, and the closest pin wins the round.

One Node process runs Express and Socket.IO and serves the built React client, the stored landmark photos and the self-rendered fallback map tiles. Rooms live in memory. The **categories** (places by region and level) live in one JSON file on a data volume, and whoever runs the server reviews them in a password-protected admin at `/admin`, where new ones are generated with the Claude API and located through Wikidata and Wikimedia Commons. There are no player accounts, no database server and no analytics. The spec is `docs/spec.md`, and every decision it left open is in `docs/DECISIONS.md`.

## Develop

Node 24 and npm.

```sh
npm ci
npm run tiles:fallback        # once: renders the fallback tiles (gitignored)
npm run dev                   # server :3010 + Vite :5180
GENERATE_FAKE=1 npm run dev   # the admin's generation with a fake writer, checker and Wikimedia (no network)
```

Open `http://localhost:5180` and choose **Show** for the Screen; phones join at `/play/<code>`. In development the server keeps its data in `./.data` (gitignored) and loads the "World (dev)" fixture category when the store is empty.

| Command                   | What it does                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm test`                | Vitest, once                                                                                          |
| `npm run typecheck`       | TypeScript, client and server                                                                         |
| `npm run lint`            | ESLint                                                                                                |
| `npm run format:check`    | Prettier check (`npm run format` writes)                                                              |
| `npm run build`           | Client to `dist/client`, server to `dist/server` and `dist/shared`                                    |
| `npm start`               | Runs the build in production mode on `PORT` (default 3000)                                            |
| `npm run e2e`             | Builds, then plays a 5-round game with a Screen and two phones in Playwright and checks nothing leaks |
| `npm run playtest -- <f>` | Playwright harness, one isolated browser context per role                                             |
| `npm run admin:hash`      | Prints an `ADMIN_PASSWORD_HASH` for a password typed without echo                                     |
| `npm run smoke -- <URL>`  | Smoke checks against any running build (not the dev server)                                           |
| `npm run smoke:docker`    | Builds the image, runs it with the droplet's settings and runs the smoke checks against it            |

`scripts/autopilot.sh` builds the remaining roadmap features unattended, one fresh Claude Code session each. When nothing is left, it runs the checks, pushes `main` and watches the deploy.

## Docker

The `Dockerfile` has four stages on `node:24-slim`: it installs, builds (and renders the fallback tiles), installs the runtime dependencies alone, then copies `dist/`, those dependencies and the tiles into the runtime image. It runs as the unprivileged `node` user (uid 1000), with a `HEALTHCHECK` on `/healthz`. The server writes its data to `DATA_DIR`, so mount a volume there: a host folder must belong to uid 1000.

```sh
docker build -t pinpoint .
docker run --rm -p 3000:3000 -v pinpoint-data:/app/data pinpoint
curl -s http://localhost:3000/healthz     # {"ok":true}
```

### Environment

Names only; the values live in `/opt/pinpoint/.env` on the droplet and nowhere else. `.env.example` lists the same names for development.

| Variable                       | Default                             | Meaning                                                                                                             |
| ------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `PORT`                         | `3000`                              | Listen port inside the container                                                                                    |
| `DATA_DIR`                     | `./.data`; `/app/data` in the image | `categories.json`, `photos/`, `generation-history.jsonl`. The droplet's compose file sets `/data` (DECISIONS 4)     |
| `TRUST_PROXY`                  | off                                 | `1` behind nginx (set in the compose file), so the rate limits key on the real client. Never set it without a proxy |
| `NODE_OPTIONS`                 | unset                               | The compose file sets `--max-old-space-size=192` under the 320 MiB `mem_limit`                                      |
| `PUBLIC_URL`                   | `https://pinpoint.kimnejudne.dev`   | The join URL and QR on the Screen                                                                                   |
| `ADMIN_PASSWORD_HASH`          | unset                               | The admin's password as `scrypt$N$r$p$salt$hash` from `npm run admin:hash`. Unset, every `/api/admin` route is 404  |
| `PINPOINT_ANTHROPIC_API_KEY`   | unset                               | Claude API key for generation. Unset, generation is off                                                             |
| `PINPOINT_CARTO_KEY`           | unset                               | CARTO tiles. Unset, every map uses the fallback tiles                                                               |
| `WIKIMEDIA_CONTACT`            | unset                               | Contact in the Wikimedia User-Agent; generation refuses to start while it is unset                                  |
| `GENERATE_DAILY_LIMIT`         | `20`                                | Levels generated per UTC day                                                                                        |
| `GENERATE_REPLACE_DAILY_LIMIT` | `100`                               | Replacements and AI additions per UTC day                                                                           |
| `PHOTOS_MAX_MB`                | `1024`                              | Disk guard for `photos/`: generation refuses to start above it                                                      |
| `GENERATE_FAKE`                | unset                               | `1` swaps in the fake generator. Development only; never on the droplet                                             |

## Deploy

Pinpoint runs on Kim's DigitalOcean droplet at **https://pinpoint.kimnejudne.dev**, beside the other apps, and shares nothing with them: its own container, port, stack directory, environment and vhost.

|         |                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image   | `pinpoint:<tag>`, built on the runner (or a workstation) and shipped with `docker save \| ssh docker load`. The droplet builds nothing                                                        |
| Process | one container, Node on **loopback `127.0.0.1:3009`** (3007 and 3008 are taken on the box; DECISIONS 1), from `deploy/compose.deploy.yaml`                                                     |
| Stack   | `/opt/pinpoint/compose.yaml` and `/opt/pinpoint/.env` (mode 600: `IMAGE_TAG` and the secrets above), both owned by `deploy`; `/opt/pinpoint` is `root:deploy` 1775                            |
| Env     | `TRUST_PROXY=1`, `NODE_OPTIONS=--max-old-space-size=192` and `DATA_DIR=/data` in the compose file; everything else from `/opt/pinpoint/.env` through `env_file`                               |
| Data    | `/opt/pinpoint/data`, owned by `1000:1000`, mounted at `/data`: `categories.json` (the only copy of the curated categories), `photos/` and `generation-history.jsonl`. Deploys never touch it |
| nginx   | `/etc/nginx/sites-available/pinpoint`, from `deploy/nginx/pinpoint.conf`, with the WebSocket upgrade and no upstream keepalive                                                                |
| TLS     | certbot, webroot method                                                                                                                                                                       |
| Memory  | `mem_limit: 320m`: 114 MB at rest, a 248 MB peak for a 12-player Picture game plus admin work (DECISIONS 67)                                                                                  |

The droplet's root setup (the directory, `.env`, the vhost, the certificate and the backup cron) was done in the bootstrap on 2026-11-07. `deploy/nginx/pinpoint.conf` and `deploy/nginx/pinpoint-bootstrap.conf` are the live files; keep them in step with the box.

`$DEPLOY_HOST` below is the droplet as `user@host` (the `deploy` user, never root, except where a step says so). It is not recorded in this repository. Run every command from `pinpoint/`.

> **A deploy ends every live game.** Rooms live in memory, so a restart drops them. The workflow waits for this (below).

**A push to `main` that touches `pinpoint/` deploys it.** Markdown, `docs/` and `.claude/` changes don't count. The workflow is `.github/workflows/deploy-pinpoint.yml` in the portfolio:

1. `checks`: format, lint, typecheck, test and build run on the runner.
2. `droplet`: `scripts/docker-smoke.sh pinpoint:<tag>` builds the image and smoke-tests it there with `TRUST_PROXY`, `NODE_OPTIONS`, `DATA_DIR`, the data volume, `mem_limit` and the port read from the compose file. The tag is the last commit that changed shipped code under `pinpoint/`, not the repository HEAD.
3. The image is shipped with `docker save | ssh docker load`, and `deploy/compose.deploy.yaml` is copied to `/opt/pinpoint/compose.yaml`.
4. On the box, as `deploy`, it counts established connections to `127.0.0.1:3009`. nginx keeps no upstream keepalive, so each one is a live client. It waits up to 10 minutes for the count to reach zero and fails without changing anything if it doesn't (`ABORT: N live connection(s) after 10 min`).
5. It makes sure `/opt/pinpoint/data` belongs to uid 1000 (a throwaway root container of the new image runs `chown`, since `deploy` can't), re-points `IMAGE_TAG`, restarts and waits for `/healthz`. If that never answers, it rolls `IMAGE_TAG` back to the previous tag. The previous image stays on the box.
6. It runs `npm run smoke -- https://pinpoint.kimnejudne.dev` from outside, through nginx and TLS.

A Screen left open on a TV keeps its socket, so the wait can fail with no game running. Then:

```sh
gh workflow run deploy-pinpoint.yml -f force=true   # ends any live games
```

### Routine deploy (break-glass)

The same release by hand, for when Actions is what's broken. From a clean, committed tree:

```sh
TAG=$(git log -1 --format=%H -- . ':!*.md' ':!docs' ':!.claude' | cut -c1-12)
npm ci && npm run smoke:docker -- pinpoint:$TAG      # builds pinpoint:$TAG and checks it
docker save pinpoint:$TAG | gzip -1 | ssh $DEPLOY_HOST 'gunzip | docker load'
scp deploy/compose.deploy.yaml $DEPLOY_HOST:/opt/pinpoint/compose.yaml
ssh $DEPLOY_HOST "ss -Htn state established '( sport = :3009 )' | wc -l"   # 0 = nobody playing
ssh $DEPLOY_HOST "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/' /opt/pinpoint/.env \
  && cd /opt/pinpoint && docker compose up -d"
ssh $DEPLOY_HOST 'curl -fsS http://127.0.0.1:3009/healthz'          # {"ok":true}
npm run smoke -- https://pinpoint.kimnejudne.dev
```

If the data folder is missing or not uid 1000's, the server can't write `categories.json`:

```sh
ssh $DEPLOY_HOST "docker run --rm --user 0 --entrypoint chown -v /opt/pinpoint/data:/data pinpoint:$TAG 1000:1000 /data"
```

When `deploy/nginx/pinpoint.conf` changes, a person with root moves it. `nginx -t` is the guard: if it fails, nothing reloads and the other sites keep running.

```sh
scp deploy/nginx/pinpoint.conf root@<droplet>:/etc/nginx/sites-available/pinpoint
ssh root@<droplet> 'nginx -t && systemctl reload nginx'
```

### Rolling back

Earlier images stay on the box. The push-button way re-points `IMAGE_TAG` through the same live-connection wait and health gate, with no build:

```sh
ssh $DEPLOY_HOST 'docker images pinpoint'              # known tags
gh workflow run deploy-pinpoint.yml -f tag=<good-tag>  # Actions → Deploy Pinpoint → Run workflow, same thing
```

By hand, the `sed … && docker compose up -d` line of the routine deploy with `<good-tag>`. Prune old tags now and then with `docker image rm pinpoint:<old-tag>`; the disk is shared.

### Secrets on the box

The deploy rewrites only the `IMAGE_TAG` line of `/opt/pinpoint/.env`, so everything else survives deploys. Each change needs a restart (`cd /opt/pinpoint && docker compose up -d`), which ends live games. Edit the file as `deploy` (`ssh $DEPLOY_HOST`, then an editor or the lines below); root's `>>` into it fails on this box.

**Admin password.** Hash it on the workstation (it asks twice, without echo). The hash holds `$`, so it must sit in single quotes, or Compose would read `$32768` as a variable:

```sh
HASH=$(npm run -s admin:hash)
ssh $DEPLOY_HOST "sed -i '/^ADMIN_PASSWORD_HASH=/d' /opt/pinpoint/.env \
  && printf \"ADMIN_PASSWORD_HASH='%s'\n\" '$HASH' >> /opt/pinpoint/.env \
  && cd /opt/pinpoint && docker compose up -d"
```

To turn the admin off, delete the line and restart.

**Keys.** `PINPOINT_ANTHROPIC_API_KEY`, `PINPOINT_CARTO_KEY` (restricted to `pinpoint.kimnejudne.dev` in the CARTO dashboard) and `WIKIMEDIA_CONTACT` are plain `NAME=value` lines; set them with an editor so the value stays out of the shell history. The server never logs the Anthropic key, and the CARTO key reaches browsers only inside `/api/config`'s tile URL.

**The stricter smoke.** Once the CARTO key and the admin hash are set, add `SMOKE_EXPECT_TILES: "1"` and `SMOKE_EXPECT_ADMIN: "1"` as `env:` on the workflow's `smoke` step, so a deploy also fails when the live site loses its tiles or its admin.

### Data and backups

`/etc/cron.d/pinpoint-backup` (installed in the bootstrap, root's) copies `/opt/pinpoint/data/` nightly at 03:17 into `/opt/backups/pinpoint/<date>/`, hard-linked to the previous night with `rsync --link-dest`, so unchanged photos cost no space, and deletes copies older than 14 days (DECISIONS 7). These copies are on the same disk; an off-box copy (DigitalOcean backups or a snapshot) is a separate choice.

**Restore drill** (as root; it touches nothing live):

```sh
ls /opt/backups/pinpoint/                               # pick <date>
rm -rf /tmp/pinpoint-drill && cp -a /opt/backups/pinpoint/<date> /tmp/pinpoint-drill
chown -R 1000:1000 /tmp/pinpoint-drill
TAG=$(sed -n 's/^IMAGE_TAG=//p' /opt/pinpoint/.env)
docker run -d --rm --name pinpoint-drill -p 127.0.0.1:3099:3000 -e DATA_DIR=/data \
  -v /tmp/pinpoint-drill:/data pinpoint:$TAG
sleep 3; curl -s http://127.0.0.1:3099/api/categories | head -c 300   # the live categories
ls /tmp/pinpoint-drill/photos | wc -l; ls /opt/pinpoint/data/photos | wc -l   # same count
docker stop pinpoint-drill && rm -rf /tmp/pinpoint-drill
```

**A real restore** ends live games: `cd /opt/pinpoint && docker compose stop`, then `rsync -a --delete /opt/backups/pinpoint/<date>/ /opt/pinpoint/data/ && chown -R 1000:1000 /opt/pinpoint/data`, then `docker compose up -d`.

### Rebuilding the box's setup

Needed only if the droplet is rebuilt; the bootstrap did this once. As root:

1. **DNS.** At Namecheap, an `A` record, host `pinpoint`, value the droplet's IPv4.
2. **Directory.** `install -d -o root -g deploy -m 1775 /opt/pinpoint` and `install -d -o 1000 -g 1000 /opt/pinpoint/data`, then as `deploy`: `printf 'IMAGE_TAG=\n' > /opt/pinpoint/.env && chmod 600 /opt/pinpoint/.env`, and copy the compose file as above.
3. **Bootstrap vhost.** Install `deploy/nginx/pinpoint-bootstrap.conf` as `/etc/nginx/sites-available/pinpoint`, link it into `sites-enabled`, `nginx -t && systemctl reload nginx`.
4. **Certificate.** `certbot certonly --webroot -w /var/www/certbot -d pinpoint.kimnejudne.dev`; certbot's timer renews it.
5. **The real vhost.** Install `deploy/nginx/pinpoint.conf` over the bootstrap one, `nginx -t && systemctl reload nginx`. It serves `deploy/placeholder/` with a 503 until the container answers.
6. **Backups.** Recreate `/etc/cron.d/pinpoint-backup` as described under Data and backups.
7. **Ship an image** with the routine deploy above, then set the secrets.

### Health checks

```sh
curl -s https://pinpoint.kimnejudne.dev/healthz                    # {"ok":true}
npm run smoke -- https://pinpoint.kimnejudne.dev                    # PASS
ssh $DEPLOY_HOST 'docker ps --filter name=pinpoint'                 # Up (healthy)
ssh $DEPLOY_HOST 'docker stats --no-stream pinpoint-app-1'          # memory against the 320 MiB limit
ssh $DEPLOY_HOST 'tail -n 20 /var/log/nginx/pinpoint.access.log'    # /socket.io/ lines answer 101
```

Then play the Manual acceptance checklist in `docs/spec.md` on real devices against the deployed URL, with at least one phone on mobile data.
