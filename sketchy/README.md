# Sketchy

A party drawing game for game nights. One **Screen** (a laptop on a TV, a tablet or a spare phone) shows the live drawing. The **drawer** draws a secret word on their phone, and everyone else types guesses on theirs. Faster correct guesses score more, corrected for each phone's network latency.

One Node process runs Express and Socket.IO (the main namespace and `/ink`, for the drawing) and serves the built React client. Rooms live in memory. The word **categories** live in one JSON file on a data volume, and whoever runs the server edits them in a password-protected admin at `/admin`. The admin can also draft new categories with the Claude API, under a monthly spend cap. There are no player accounts, no database server and no analytics. The spec is `docs/spec.md`, and every decision it left open is in `docs/DECISIONS.md`.

## Develop

Node 24 or newer and npm.

```sh
npm ci
npm run dev          # server :3000 + Vite :5173 on 0.0.0.0
```

Open `http://localhost:5173` for the Screen. Phones on the same Wi-Fi join with `npm run lan [CODE]`, which prints the LAN Screen and join URLs with terminal QR codes. `/dev/bots/CODE` (development only) spawns fake players.

In development the server keeps its data in `./.data` (gitignored), seeded from `data/packs/` on the first start. For the admin, start with a setup code and open `http://localhost:5173/admin`:

```sh
SKETCHY_ADMIN_SETUP_CODE=my-long-local-setup-code npm run dev
```

Without `SKETCHY_ANTHROPIC_API_KEY`, development uses a fake word generator that spends nothing. `rm -rf .data` starts over: the categories reseed from `data/packs/`, and the admin goes back to setup.

| Command                      | What it does                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm test`                   | Vitest, once                                                                                          |
| `npm run typecheck`          | TypeScript, client and server                                                                         |
| `npm run lint`               | ESLint                                                                                                |
| `npm run format:check`       | Prettier check (`npm run format` writes)                                                              |
| `npm run build`              | Client to `dist/client`, server to `dist/server` and `dist/shared`                                    |
| `npm start`                  | Runs the build in production mode on `PORT` (default 3000)                                            |
| `npm run playtest -- <file>` | Playwright harness, one isolated browser context per role                                             |
| `npm run packs:check`        | Validates the word packs in `data/packs/`                                                             |
| `npm run size`               | Builds and measures the join budget (`/` + `/play` ≤ 120 KB JS, ≤ 59 KB CSS and fonts)                |
| `npm run smoke -- <URL>`     | Smoke checks against any running server: `/healthz`, the client, a room, both Socket.IO namespaces    |
| `npm run smoke:docker`       | Builds the image, runs it with the droplet's settings and runs the smoke checks against it            |
| `npm run mem:probe`          | Needs `npm run build`. Peak memory of a 10-player game with a full gallery (`-- --games N --heap MB`) |

`scripts/autopilot.sh` builds the remaining roadmap features unattended, one fresh Claude Code session each. When nothing is left, it runs the checks, pushes `main` and watches the deploy.

## Docker

The `Dockerfile` has four stages on `node:24-slim`: it installs, builds, installs the runtime dependencies alone, then copies `dist/`, those dependencies and the word packs (`data/packs`) into the runtime image. That image runs as the unprivileged `node` user (uid 1000) and has a `HEALTHCHECK` on `/healthz`. The packs in the image are only the seed. The server writes its data to `DATA_DIR` (`/data` in the image), so mount a volume there. A named volume takes the image's ownership of `/data`, while a host folder must belong to uid 1000.

```sh
docker build -t sketchy .
docker run --rm -p 3000:3000 -v sketchy-data:/data \
  -e SKETCHY_ADMIN_SETUP_CODE=my-long-local-setup-code sketchy
curl -i http://localhost:3000/healthz     # 200 {"ok":true}
```

### Environment

| Variable                     | Default                     | Meaning                                                                                                                                                                                                                                                                                     |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                       | `3000`                      | Port the server listens on inside the container                                                                                                                                                                                                                                             |
| `NODE_ENV`                   | `production` (in the image) | Serves the built client. `development` turns on `/dev/bots` and the dev-only word route, so never set it on the droplet                                                                                                                                                                     |
| `TRUST_PROXY`                | off                         | **Set this behind a reverse proxy.** A hop count such as `1`, `true`, or an Express trust string. Unset, every phone behind the proxy shares one address in the rate limits (10 joins a minute, 10 new games an hour). Never set it without a proxy: then anyone can fake `X-Forwarded-For` |
| `NODE_OPTIONS`               | unset                       | The droplet sets `--max-old-space-size=128`, so V8 collects well before the container's 256 MiB limit                                                                                                                                                                                       |
| `DATA_DIR`                   | `/data` (in the image)      | Folder for `categories.json`, `admin.env` (the admin password's scrypt hash) and `generation-history.json`. `./.data` when unset outside the image. Mount a volume here, or every edit is lost with the container                                                                           |
| `SKETCHY_ADMIN_SETUP_CODE`   | unset                       | The admin's setup code: on the first visit to `/admin` it sets the password, and after that it resets a forgotten one. Use 16+ random characters. With neither this nor a saved password, `/admin` says "Admin not configured"                                                              |
| `SKETCHY_ANTHROPIC_API_KEY`  | unset                       | Claude API key for word generation, the only Anthropic variable read. Unset, generation is off and the admin says why (in development a fake generator stands in)                                                                                                                           |
| `SKETCHY_GENERATION_CAP_USD` | `5`                         | Generation spend cap per UTC calendar month, in US dollars. `0` turns generation off, and an invalid value falls back to 5 with a warning                                                                                                                                                   |

## Deploy

Sketchy runs on Kim's DigitalOcean droplet at **https://sketchy.kimnejudne.dev**, beside Buzzr and the other apps, and shares nothing with them: its own container, port, stack directory, environment and vhost.

|         |                                                                                                                                                                                                                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image   | `sketchy:<tag>`, built on the runner (or a workstation) and shipped with `docker save \| ssh docker load`. The droplet builds nothing                                                                                                                                                                    |
| Process | one container, Node on **loopback `127.0.0.1:3006`**, from `deploy/compose.deploy.yaml` (Buzzr has 3005, PokéTrack 3004)                                                                                                                                                                                 |
| Stack   | `/opt/sketchy/compose.yaml` and `/opt/sketchy/.env` (mode 600: `IMAGE_TAG=` and the admin variables below), both owned by `deploy`; `/opt/sketchy` is `root:deploy` with the sticky bit                                                                                                                  |
| Env     | `TRUST_PROXY=1`, `NODE_OPTIONS=--max-old-space-size=128` and `DATA_DIR=/data`, set in the compose file. `SKETCHY_ADMIN_SETUP_CODE`, `SKETCHY_ANTHROPIC_API_KEY` and `SKETCHY_GENERATION_CAP_USD` come from `/opt/sketchy/.env`, passed through as `${VAR:-}`                                             |
| Data    | `/opt/sketchy/data`, owned by `1000:1000`, mounted at `/data` (`DATA_DIR`). Holds `categories.json` (the word categories, seeded once from `data/packs/` and the only copy after that), `admin.env` (the admin password hash) and `generation-history.json` (priced generations). Deploys never touch it |
| nginx   | `/etc/nginx/sites-available/sketchy`, from `deploy/nginx/sketchy.conf`. Proxies everything, with the WebSocket upgrade on `/socket.io/` (both namespaces share it)                                                                                                                                       |
| TLS     | certbot, webroot method against `/var/www/certbot`                                                                                                                                                                                                                                                       |
| Memory  | `mem_limit: 256m`. One 10-player game with a full gallery peaks at about 166 MB; two at once are the ceiling (DECISIONS 73). The box has about 700 MB free beside Buzzr's 384m                                                                                                                           |

The droplet's root setup (the directory, `.env`, the vhost and the certificate) was done in the bootstrap on 2026-10-30. `deploy/nginx/sketchy.conf` and `deploy/nginx/sketchy-bootstrap.conf` are the live files; keep them in step with the box.

Two placeholders run through these steps, and neither is recorded in this repository. `$DEPLOY_HOST` is the droplet as `user@host` (the `deploy` user, never root, except where a step says so), for ssh and scp. `$DROPLET_IP` is its IPv4 address, for DNS. Run every command from `sketchy/`.

> **A deploy ends every live game.** Rooms live in memory, so a restart drops them, and every connected device shows "This game has ended". Deploy when no game is running. The push-to-deploy workflow waits for this (below).

**A push to `main` that touches `sketchy/` deploys it.** Markdown, `docs/` and `.claude/` changes don't count. The workflow is `.github/workflows/deploy-sketchy.yml` in the portfolio:

1. `checks`: typecheck, lint, format check and tests run on the runner.
2. `droplet`: `scripts/docker-smoke.sh sketchy:<tag>` builds the image and smoke-tests it there, with `TRUST_PROXY`, `NODE_OPTIONS`, `DATA_DIR`, the data volume, `mem_limit` and the port read from the compose file; a second start on the same volume must keep an edited store. The tag is the last commit that changed shipped code under `sketchy/`, not the repository HEAD.
3. The image is shipped with `docker save | ssh docker load`, and `deploy/compose.deploy.yaml` is copied to `/opt/sketchy/compose.yaml`.
4. On the box, as `deploy`, it counts established connections to `127.0.0.1:3006`. nginx keeps no upstream keepalive, so each one is a live WebSocket from a Screen or a phone. It waits up to 10 minutes for the count to reach zero, and fails without changing anything if it doesn't (`ABORT: N live connection(s) after 10 min`).
5. It makes sure `/opt/sketchy/data` exists and belongs to uid 1000 (a throwaway root container of the new image runs `chown`, since `deploy` can't), re-points `IMAGE_TAG`, restarts, and waits for `/healthz`. If that never answers, it rolls `IMAGE_TAG` back to the previous tag. The previous image stays on the box.
6. It runs `npm run smoke -- https://sketchy.kimnejudne.dev` from outside, through nginx and TLS: `/healthz`, the client and its entry script, the `/play` fallback, a room (swept after 3 h idle), the dev word route closed, and WebSockets on `/` and `/ink`.

A Screen left open on a TV keeps its socket, so the wait can fail with no game running. In that case:

```sh
gh workflow run deploy-sketchy.yml -f force=true   # ends any live games
```

The steps below are the same release done by hand: the break-glass path for when Actions is what's broken.

### Routine deploy (break-glass)

Build from a clean, committed tree, smoke-test the image, ship it, re-point and restart:

```sh
TAG=$(git log -1 --format=%h -- .)
npm ci && npm run smoke:docker -- sketchy:$TAG       # builds sketchy:$TAG and checks it
docker save sketchy:$TAG | gzip -1 | ssh $DEPLOY_HOST 'gunzip | docker load'
ssh $DEPLOY_HOST "ss -Htn state established '( sport = :3006 )' | wc -l"   # 0 = no live games
ssh $DEPLOY_HOST "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/' /opt/sketchy/.env \
  && cd /opt/sketchy && docker compose up -d"
ssh $DEPLOY_HOST 'curl -fsS http://127.0.0.1:3006/healthz'          # {"ok":true}
npm run smoke -- https://sketchy.kimnejudne.dev
```

When `deploy/compose.deploy.yaml` changes, copy it first:

```sh
scp deploy/compose.deploy.yaml $DEPLOY_HOST:/opt/sketchy/compose.yaml
```

The data folder must belong to uid 1000 before the first start with the volume, or the server can't seed `categories.json` and exits:

```sh
ssh $DEPLOY_HOST "docker run --rm --user 0 --entrypoint chown -v /opt/sketchy/data:/data sketchy:$TAG 1000:1000 /data"
```

When `deploy/nginx/sketchy.conf` changes, a person with root moves it. `nginx -t` is the guard: if it fails, nothing reloads and the other sites keep running.

```sh
scp deploy/nginx/sketchy.conf root@<droplet>:/etc/nginx/sites-available/sketchy
ssh root@<droplet> 'nginx -t && systemctl reload nginx'
```

### Rolling back

Earlier images stay on the box. The push-button way re-points `IMAGE_TAG` through the same live-game wait and health gate, with no build:

```sh
ssh $DEPLOY_HOST 'docker images sketchy'                     # known tags
gh workflow run deploy-sketchy.yml -f tag=<good-tag>
```

Or by hand:

```sh
ssh $DEPLOY_HOST "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<good-tag>/' /opt/sketchy/.env \
  && cd /opt/sketchy && docker compose up -d"
```

Prune old tags now and then with `docker image rm sketchy:<old-tag>`. The disk is shared.

### Rebuilding the box's setup

Needed only if the droplet is rebuilt; the bootstrap did this once. As root:

1. **DNS.** At Namecheap, Advanced DNS: an `A` record, host `sketchy`, value `$DROPLET_IP` (in place since 2026-10-30). Check `dig +short @pdns1.registrar-servers.com sketchy.kimnejudne.dev A`.
2. **Directory.** `install -d -o root -g deploy -m 1775 /opt/sketchy`, then as `deploy`: `printf 'IMAGE_TAG=\n' > /opt/sketchy/.env && chmod 600 /opt/sketchy/.env`, and copy the compose file as above.
3. **Bootstrap vhost.** `sketchy.conf` names the certificate files, so `nginx -t` fails until they exist. Install `deploy/nginx/sketchy-bootstrap.conf` as `/etc/nginx/sites-available/sketchy`, link it into `sites-enabled`, then `nginx -t && systemctl reload nginx`. Check `http://sketchy.kimnejudne.dev/.well-known/acme-challenge/<token>` serves a test file from `/var/www/certbot` first: a failed validation counts against Let's Encrypt's rate limit.
4. **Certificate.** `certbot certonly --webroot -w /var/www/certbot -d sketchy.kimnejudne.dev`. certbot's timer renews it; the port-80 block of `sketchy.conf` keeps the webroot reachable.
5. **The real vhost.** Install `deploy/nginx/sketchy.conf` over the bootstrap one, `nginx -t && systemctl reload nginx`. Never leave the bootstrap vhost installed.
6. **Ship an image** with the routine deploy above.

The vhost does what Sketchy needs: `Upgrade` and `Connection` on `/socket.io/` (without them every device falls back to long-polling, which adds latency to guesses and ink), a 120 s read timeout (Socket.IO pings every 5 s), no upstream keepalive (the deploy's live-game count relies on it), `client_max_body_size 256k`, and gzip level 6, which keeps the player page inside the 120 KB join budget.

### Health checks

```sh
curl -s https://sketchy.kimnejudne.dev/healthz                    # {"ok":true}
curl -sI https://sketchy.kimnejudne.dev/ | head -1                 # HTTP/2 200
npm run smoke -- https://sketchy.kimnejudne.dev                    # PASS
ssh $DEPLOY_HOST 'docker ps --filter name=sketchy'                 # Up (healthy)
ssh $DEPLOY_HOST 'docker stats --no-stream sketchy-app-1'          # memory against the 256 MiB limit
ssh $DEPLOY_HOST 'tail -n 20 /var/log/nginx/sketchy.access.log'    # /socket.io/ lines answer 101
```

Then play the Manual playtest checklist in `docs/spec.md` on real devices against the deployed URL, with at least two phones on mobile data.

## Admin

`https://sketchy.kimnejudne.dev/admin` manages the word categories: the editor, bulk paste, export and import, and Claude drafts of new categories. Nothing in the game links to it. There is one password for the whole server, with no usernames. Its scrypt hash lives in `DATA_DIR/admin.env` on the volume. Sessions last 12 hours and live in memory, so a restart signs the admin out. Category edits apply to games started afterwards, and a running game keeps its snapshot.

### Setting the variables on the droplet

`/opt/sketchy/.env` belongs to `deploy` with mode 600, inside a sticky, group-writable directory. On this box (`fs.protected_regular = 2`) even root can't append to it with `>>`, so these steps append as `deploy`. Run them as root on the droplet. `read -rs` keeps the value out of the shell history and off the screen:

```sh
# Setup code (once): long and random. It stays valid as the reset key.
printf 'SKETCHY_ADMIN_SETUP_CODE=%s\n' "$(openssl rand -base64 24 | tr -d '/+=')" \
  | runuser -u deploy -- tee -a /opt/sketchy/.env >/dev/null
grep '^SKETCHY_ADMIN_SETUP_CODE=' /opt/sketchy/.env       # read it when you need it

# Claude API key for word generation (paste it at the prompt)
read -rs KEY && printf 'SKETCHY_ANTHROPIC_API_KEY=%s\n' "$KEY" \
  | runuser -u deploy -- tee -a /opt/sketchy/.env >/dev/null; unset KEY

# Monthly cap in USD (optional; 5 when unset, 0 turns generation off)
printf 'SKETCHY_GENERATION_CAP_USD=%s\n' 10 | runuser -u deploy -- tee -a /opt/sketchy/.env >/dev/null
```

To change a value that is already there, edit it in place, again as `deploy` so the file keeps its owner. `sed -i` writes a new file and renames it over the old one, which the sticky directory allows:

```sh
runuser -u deploy -- sed -i 's/^SKETCHY_GENERATION_CAP_USD=.*/SKETCHY_GENERATION_CAP_USD=10/' /opt/sketchy/.env
```

Then recreate the container so it reads the new values. Like any restart, this ends live games:

```sh
cd /opt/sketchy && docker compose up -d
docker compose logs app | grep -E 'Admin:|Word generation'
# Admin: setup mode (no password yet).   or   Admin: password set.
# Word generation: on (Claude).
# Word generation: cap $10.00 per UTC month.
```

The log names the mode only. It never prints the setup code, the password, its hash or the key.

### First sign-in

Open `/admin`, enter the setup code and a new password of at least 12 characters. That signs you in and saves the hash to `/opt/sketchy/data/admin.env`. Setup works once; after that the page asks for the password.

### Resetting

- **Forgotten password:** on the sign-in form, **Forgot password?** takes the setup code and a new password. It signs out every other session.
- **Back to setup mode without the code:** delete the hash line and restart. The volume's files belong to uid 1000, so run it inside the container:

  ```sh
  cd /opt/sketchy && docker compose exec app sed -i '/^ADMIN_PASSWORD_HASH=/d' /data/admin.env && docker compose restart app
  ```

- **Categories back to the seed packs:** this deletes every admin edit, so export first (**Export all** in the admin). Then:

  ```sh
  cd /opt/sketchy && docker compose exec app rm /data/categories.json && docker compose restart app
  docker compose logs app | grep 'Seeded'      # Seeded /data/categories.json from 9 word packs: …
  ```

- **Spend history:** `generation-history.json` is the only record of what generation has cost, and the monthly cap is counted from it. Leave it alone unless you mean to clear the record. If the server can't read or parse it, generation pauses and the admin says why. The server never writes over a file in that state, so fix or remove it by hand and restart.
- **Everything:** stop the stack, delete `/opt/sketchy/data/*` as root, and start it again. The categories reseed and `/admin` goes back to setup.

`docker compose restart` and `up -d` end every live game, just like a deploy.
