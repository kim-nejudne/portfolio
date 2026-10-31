# syntax=docker/dockerfile:1

# Sketchy: one Node process serves the built React client, the HTTP API and both Socket.IO
# namespaces (`/` and `/ink`). Ported from Buzzr (buzzer/Dockerfile).
#
# Built off the droplet (the deploy runner) and shipped with `docker save | ssh docker load`;
# the droplet has no memory to spare for a build.
#
#   docker build -t sketchy .
#   docker run --rm -p 3000:3000 sketchy      # then http://localhost:3000/healthz
#   npm run smoke:docker                      # build, run and check it (scripts/docker-smoke.sh)

# ---- deps: every dependency, for the build
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build: Vite client to dist/client, server and shared to dist/server and dist/shared
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod-deps: runtime dependencies only. `dependencies` is what dist/server imports;
# the client libraries are devDependencies, bundled into dist/client by the build stage.
FROM node:24-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- runtime
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
# The word packs, read and checked once at start (`packsDirFor`: dist/server/../../data/packs).
# Baked into the image: there is no volume and nothing is written at run time.
COPY --chown=node:node data/packs ./data/packs

# The official image ships an unprivileged `node` user (uid 1000).
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
