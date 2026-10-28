# Buzzr

A browser game-show buzzer. A laptop on the TV is the **Screen** and shows the questions. **Players** buzz from their phones. The **Host** judges from a paired phone or from the Screen's keyboard.

One Node process runs Express and Socket.IO and serves the built React client. Rooms live in memory, and there are no accounts and no database. Question sets live in the host's browser (IndexedDB).

## Develop

Node 24 or newer and npm.

```sh
npm ci
npm run dev          # server :3000 + Vite :5173
```

Open `http://localhost:5173`. Phones on the same Wi-Fi open `http://<laptop-LAN-IP>:5173`. A Screen opened on `localhost` already shows that LAN address in its join QR and URL: the server finds it with `GET /api/config`.

| Command                | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `npm test`             | Vitest, once                                                       |
| `npm run typecheck`    | TypeScript, client and server                                      |
| `npm run lint`         | ESLint                                                             |
| `npm run format:check` | Prettier check (`npm run format` writes)                           |
| `npm run build`        | Client to `dist/client`, server to `dist/server` and `dist/shared` |
| `npm start`            | Runs the build in production mode on `PORT` (default 3000)         |
| `npm run smoke:docker` | Builds the image, runs it and checks it (see below)                |

## Docker

The `Dockerfile` is multi-stage. It installs, builds, then copies `dist/` and the runtime dependencies into a slim Node 24 image. The image runs as the unprivileged `node` user and has a `HEALTHCHECK` on `/healthz`.

```sh
docker build -t buzzr .
docker run --rm -p 3000:3000 buzzr
curl -i http://localhost:3000/healthz     # 200 {"ok":true}
```

`npm run smoke:docker` does the same and checks more:

- `/healthz` answers 200.
- `/` and a client route serve the app.
- A Socket.IO WebSocket connects.
- With `TRUST_PROXY`, `IMAGES_MAX_MB` and `PUBLIC_URL` read from `deploy/compose.deploy.yaml`, the room-creation limit keys on the forwarded client IP, and `/api/config` returns `PUBLIC_URL`.
- The process runs as `node`.
- `docker stop` takes under 5 s.

### Environment

| Variable        | Default                     | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`          | `3000`                      | Port the server listens on inside the container                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `NODE_ENV`      | `production` (in the image) | Serves the built client, and leaves out `/dev/bots`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `TRUST_PROXY`   | off                         | **Set this behind a reverse proxy.** A hop count such as `1`, or an Express trust string. Unset, every player behind the proxy shares one IP in the rate limits, so the whole site gets 10 new rooms per hour. Never set it without a proxy: then anyone can fake `X-Forwarded-For` and get around the limits                                                                                                                                                                                                                                                                                               |
| `IMAGES_MAX_MB` | `500`                       | Server-wide cap on uploaded images, which are held in memory. Lower it on a small host, and keep the container's memory limit above it                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `PUBLIC_URL`    | unset                       | The origin for the Screen's join QR and URL, such as `https://buzzr.example`: an http(s) origin with no path, or the server will not start. Unset, a Screen on `localhost` gets this machine's first private IPv4 with its own page port, and any other Screen uses its own address. **Set it when running the image for a LAN**: inside Docker the private address is the container's, which phones cannot reach. One catch: a port-less `http://` value takes the port of an `http://` Screen page, so `http://quiz.lan` seen from `http://localhost:3000` becomes `http://quiz.lan:3000` (DECISIONS F42) |

## Deploy

Buzzr runs on Kim's DigitalOcean droplet at **https://buzzr.kimnejudne.dev**. It follows the same pattern as the other apps on that box.

|         |                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Image   | `buzzr:<tag>`, built on the workstation and shipped with `docker save \| ssh docker load`                                                    |
| Process | one container, Node on **loopback `127.0.0.1:3005`**, from `deploy/compose.deploy.yaml`                                                      |
| Stack   | `/opt/buzzr/compose.yaml` and `/opt/buzzr/.env` (mode 600, one key: `IMAGE_TAG`), both owned by `deploy`; `/opt/buzzr` is `root:deploy` 1775 |
| nginx   | `/etc/nginx/sites-available/buzzr`, from `deploy/nginx/buzzr.conf`. Proxies everything, including the WebSocket upgrade on `/socket.io/`     |
| TLS     | certbot, webroot method against `/var/www/certbot`                                                                                           |
| Memory  | `mem_limit: 384m`, `IMAGES_MAX_MB=200`. The box has about 700 MB free next to its other apps                                                 |

Two placeholders run through these steps, and neither is recorded in this repository. `$DEPLOY_HOST` is the droplet as `user@host`, for ssh and scp. `$DROPLET_IP` is its IPv4 address, for DNS. Run every command from `buzzer/`.

> **A deploy ends every live game.** Rooms live in memory, so a restart drops them, and every connected device shows "This game has ended". Deploy when no game is running. The push-to-deploy workflow waits for this (below).

**A push to `main` that touches `buzzer/` deploys it.** Markdown, `docs/` and `.claude/` changes don't count. The workflow is `.github/workflows/deploy-buzzer.yml` in the portfolio:

1. typecheck, lint, format check and tests run on the runner.
2. `scripts/docker-smoke.sh buzzr:<tag>` builds the image and smoke-tests it there.
3. The image is shipped with `docker save | ssh docker load`, and `deploy/compose.deploy.yaml` is copied to `/opt/buzzr/compose.yaml`.
4. On the box, as `deploy`, it counts established connections to `127.0.0.1:3005`. nginx keeps no upstream keepalive, so each one is a live WebSocket. It waits up to 10 minutes for the count to reach zero, and fails without changing anything if it doesn't.
5. It re-points `IMAGE_TAG`, restarts, and waits for `/healthz`. If that never answers, it rolls `IMAGE_TAG` back.
6. It checks `https://buzzr.kimnejudne.dev/healthz` from outside.

A Screen left open on a TV keeps its socket, so the wait can fail with no game running. In that case:

```sh
gh workflow run deploy-buzzer.yml -f force=true   # ends any live games
```

The steps below are the same release done by hand, the break-glass path for when Actions is what's broken.

### First deploy

**1. DNS.** At Namecheap, open Advanced DNS → Host Records and add one record. Leave every other record alone.

| Type | Host    | Value         | TTL       |
| ---- | ------- | ------------- | --------- |
| A    | `buzzr` | `$DROPLET_IP` | Automatic |

Confirm it against the authoritative server first, because public resolvers lag by the TTL:

```sh
dig +short @pdns1.registrar-servers.com buzzr.kimnejudne.dev A   # $DROPLET_IP
dig +short buzzr.kimnejudne.dev A                                # $DROPLET_IP, once caches catch up
```

**2. Directories.**

```sh
ssh $DEPLOY_HOST 'mkdir -p /opt/buzzr /var/www/certbot'
```

**3. Bootstrap vhost.** `buzzr.conf` names the certificate files, so `nginx -t` fails until they exist. Install the HTTP-only bootstrap vhost first:

```sh
scp deploy/nginx/buzzr-bootstrap.conf $DEPLOY_HOST:/etc/nginx/sites-available/buzzr
ssh $DEPLOY_HOST 'ln -sf /etc/nginx/sites-available/buzzr /etc/nginx/sites-enabled/buzzr \
  && nginx -t && systemctl reload nginx'
```

A failed validation counts against Let's Encrypt's rate limit. Before you run certbot, serve a token by hand and fetch it over the real name:

```sh
TOKEN="probe-$(date -u +%s)"
ssh $DEPLOY_HOST "mkdir -p /var/www/certbot/.well-known/acme-challenge \
  && printf '%s' '$TOKEN' > /var/www/certbot/.well-known/acme-challenge/$TOKEN \
  && chown -R www-data:www-data /var/www/certbot"
curl -sS "http://buzzr.kimnejudne.dev/.well-known/acme-challenge/$TOKEN"   # prints the token
ssh $DEPLOY_HOST "rm /var/www/certbot/.well-known/acme-challenge/$TOKEN"
```

**4. Certificate.**

```sh
ssh $DEPLOY_HOST 'certbot certonly --webroot -w /var/www/certbot -d buzzr.kimnejudne.dev'
```

certbot's timer renews it against the same webroot. The port-80 block of `buzzr.conf` keeps that path reachable.

**5. Ship the image.** Build from a clean, committed tree. The tag is the last commit that touched `buzzer/`, not the repository HEAD, because the monorepo's other projects move HEAD too.

```sh
TAG=$(git log -1 --format=%h -- .)
docker build -t buzzr:$TAG .
docker save buzzr:$TAG | ssh $DEPLOY_HOST 'docker load'
```

**6. Start the stack.**

```sh
scp deploy/compose.deploy.yaml $DEPLOY_HOST:/opt/buzzr/compose.yaml
ssh $DEPLOY_HOST "printf 'IMAGE_TAG=%s\n' $TAG > /opt/buzzr/.env && chmod 600 /opt/buzzr/.env \
  && cd /opt/buzzr && docker compose up -d"
ssh $DEPLOY_HOST 'curl -fsS http://127.0.0.1:3005/healthz'           # {"ok":true}
```

The compose file sets `TRUST_PROXY=1`, because nginx is the one proxy hop. nginx appends the client's address to `X-Forwarded-For`, and the server trusts only that right-most entry. A value a client sends itself is ignored.

**7. The real vhost.**

```sh
scp deploy/nginx/buzzr.conf $DEPLOY_HOST:/etc/nginx/sites-available/buzzr
ssh $DEPLOY_HOST 'nginx -t && systemctl reload nginx'
```

`nginx -t` is the guard. If it fails, nothing reloads and the other sites on the box keep running.

The vhost does three things that Buzzr needs:

- It passes `Upgrade` and `Connection` on `/socket.io/`. The gateway accepts the WebSocket transport only, so without these headers no device can connect.
- It keeps a 120 s read timeout. Socket.IO pings every 25 s, so this timeout never closes a live socket.
- It sets `client_max_body_size 2m`. Room creation sends up to 1 MB and an image up to 1.5 MB. nginx's 1 MB default would refuse both.

**8. Check it.** See [Health checks](#health-checks), then run the manual acceptance checklist in `docs/SPEC.md` on real devices. At least one phone should be on mobile data.

### Routine deploy (break-glass)

A push does this. By hand, steps 5 and 6 without the scp, as `deploy`:

```sh
TAG=$(git log -1 --format=%h -- .)
docker build -t buzzr:$TAG .
docker save buzzr:$TAG | ssh $DEPLOY_HOST 'docker load'
ssh $DEPLOY_HOST "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/' /opt/buzzr/.env \
  && cd /opt/buzzr && docker compose up -d"
```

When `deploy/compose.deploy.yaml` or `deploy/nginx/buzzr.conf` changes, copy it again as in step 6 or step 7.

### Rolling back

Earlier images stay on the box. The push-button way re-points `IMAGE_TAG` through the same live-game wait and health gate, with no build:

```sh
ssh $DEPLOY_HOST 'docker images buzzr'                       # known tags
gh workflow run deploy-buzzer.yml -f tag=<good-tag>
```

Or by hand:

```sh
ssh $DEPLOY_HOST "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<good-tag>/' /opt/buzzr/.env \
  && cd /opt/buzzr && docker compose up -d"
```

Prune old tags now and then with `docker image rm buzzr:<old-tag>`. The disk is shared.

### Health checks

```sh
curl -s https://buzzr.kimnejudne.dev/healthz                    # {"ok":true}
curl -sI https://buzzr.kimnejudne.dev/ | head -1                 # HTTP/2 200
ssh $DEPLOY_HOST 'docker ps --filter name=buzzr'                 # Up (healthy)
ssh $DEPLOY_HOST 'docker stats --no-stream buzzr-app-1'          # memory against the 384 MiB limit
ssh $DEPLOY_HOST 'tail -n 20 /var/log/nginx/buzzr.access.log'    # /socket.io/ lines answer 101
```

Then check it in a browser:

1. On the laptop, open https://buzzr.kimnejudne.dev/sets and tap **Host this set**.
2. Join from a phone on mobile data. The Player's dot is green.
3. Leave the phone idle on the buzzer. The screen stays on: Wake Lock needs HTTPS, so this is the first place it works.
