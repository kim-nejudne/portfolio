# syntax=docker/dockerfile:1

# Buzzr: one Node process serves the built React client, the HTTP API and Socket.IO.
#
# Built on a workstation and shipped to the droplet with `docker save | ssh docker load`
# (README, Deploy). The droplet has no memory to spare for a build.
#
#   docker build -t buzzr .
#   docker run --rm -p 3000:3000 buzzr        # then http://localhost:3000/healthz

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
    PORT=3000 \
    DATA_DIR=/app/data

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist

# The built-in sets file lives here (F103). On the droplet it is a bind mount, which must be
# owned by uid 1000 too (README, Deploy).
RUN mkdir /app/data && chown node:node /app/data

# The official image ships an unprivileged `node` user (uid 1000).
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
