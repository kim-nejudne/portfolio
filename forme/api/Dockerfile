# syntax=docker/dockerfile:1
#
# The API image. Build context is forme/, not api/ — the workspace lockfile
# and @forme/domain both live above this directory. Run it from forme/:
#
#   docker build -f api/Dockerfile -t forme-api:$TAG .
#
# This read "the REPO ROOT" while forme was its own repository. It is a
# directory inside the portfolio monorepo now, and the difference is not
# pedantic: run from the monorepo root the same command uploads all six spokes
# as context, then fails on a COPY that is not there.
#
# Built on a workstation and shipped with `docker save | docker load`. The
# droplet shares 1.9GB with four other services and must never run npm ci.

# ---- deps: the full workspace install, needed to compile
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY api/package.json api/
COPY frontend/package.json frontend/
# The whole workspace, because the api build needs @forme/domain compiled first
# and that needs its own devDependencies.
RUN npm ci --ignore-scripts

# ---- build: domain then api
FROM deps AS build
WORKDIR /repo
COPY packages/domain packages/domain
COPY api api
RUN npm run build --workspace @forme/domain \
 && npm run build --workspace @forme/api

# ---- prod-deps: runtime dependencies only
FROM node:22-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY api/package.json api/
COPY frontend/package.json frontend/
# argon2 ships a prebuilt binary; --ignore-scripts would skip fetching it and
# the API would fail at the first sign-in rather than at build time.
RUN npm ci --omit=dev --workspace @forme/api --include-workspace-root \
 && npm cache clean --force

# ---- runtime
FROM node:22-alpine AS runtime
WORKDIR /repo/api
ENV NODE_ENV=production PORT=4000

# The preflight engine shells out to these. Without them every check that needs
# them reports SKIPPED with a reason rather than passing silently — but the
# whole point of the spoke is that they are real, so they ship in the image.
#   poppler-utils : pdfinfo, pdffonts, pdfimages
#   ghostscript   : inkcov (total area coverage), bbox (safety margin)
# dumb-init reaps zombies — ghostscript is spawned per job — and forwards
# signals so `docker stop` is a clean exit rather than a 10s timeout.
RUN apk add --no-cache poppler-utils ghostscript dumb-init \
 && pdfinfo -v 2>&1 | head -1 \
 && gs --version

COPY --from=prod-deps /repo/node_modules /repo/node_modules
COPY --from=prod-deps /repo/api/node_modules /repo/api/node_modules
COPY --from=build     /repo/packages/domain/dist /repo/packages/domain/dist
COPY --from=build     /repo/packages/domain/package.json /repo/packages/domain/
COPY --from=build     /repo/api/dist /repo/api/dist
COPY --from=build     /repo/api/drizzle /repo/api/drizzle
COPY api/package.json /repo/api/

# Artwork is customer property on a real disk; the volume is mounted here.
RUN mkdir -p /data/artwork && chown -R node:node /data
ENV ARTWORK_DIR=/data/artwork

USER node
EXPOSE 4000

# Checks the database round trip, not just that the process is up — a Node
# process answering 200 while Postgres is unreachable is not healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
