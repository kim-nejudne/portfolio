# syntax=docker/dockerfile:1

# Pinpoint: one Node process serves the built client, the HTTP API, Socket.IO, the stored photos
# and the fallback map tiles.
#
# Built off the droplet (the deploy runner) and shipped with `docker save | ssh docker load`;
# the droplet has no memory to spare for a build.
#
#   docker build -t pinpoint .
#   npm run smoke:docker      # build, run with the droplet's settings and check it

# ---- deps: every dependency, for the build
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build: the client to dist/client, server and shared to dist/server and dist/shared, and
# the fallback tiles (Natural Earth, zoom 0–6) to server/assets/fallback-tiles (not in git)
FROM deps AS build
COPY . .
RUN npm run build && npm run tiles:fallback

# ---- prod-deps: runtime dependencies only (the client's libraries are bundled into dist/client)
FROM node:24-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- runtime
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
# Served from the working directory's server/assets/fallback-tiles (FALLBACK_TILES_DIR).
COPY --chown=node:node --from=build /app/server/assets/fallback-tiles ./server/assets/fallback-tiles
# DATA_DIR: categories.json, photos/, generation-history.jsonl. On the droplet a host folder owned
# by uid 1000 is mounted over it; without a volume the data lives and dies with the container.
RUN mkdir /app/data && chown node:node /app/data

# The official image ships an unprivileged `node` user (uid 1000).
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# node is PID 1 and handles SIGTERM itself (server/index.ts exits within 3 s).
CMD ["node", "--conditions=dist", "dist/server/index.js"]
