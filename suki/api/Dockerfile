# Built on the workstation and shipped with `docker save | ssh 'docker load'`.
# The droplet never runs this — it shares 1.9GB with n8n, netint-vpuaas,
# poketrack, tallow and forme, and has no headroom for `npm ci`.
#
# Context is the workspace root, not api/, because the API imports @suki/domain
# from a sibling workspace.
FROM node:22-alpine AS build

WORKDIR /repo

# Manifests first, so a dependency install is only redone when a manifest
# changes rather than on every source edit.
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY api/package.json api/
# The web app is a workspace too; npm wants its manifest to resolve the tree
# even though nothing here builds it.
COPY frontend/package.json frontend/

RUN npm ci --workspace @suki/api --workspace @suki/domain --include-workspace-root

COPY packages/domain packages/domain
COPY api api

# The domain package is dual-built (CJS for Nest, ESM for the browser bundle).
RUN npm run build --workspace @suki/domain \
 && npm run build --workspace @suki/api

# Drop dev dependencies rather than rebuilding into a fresh tree: the Nest CLI,
# TypeScript and drizzle-kit are several hundred megabytes that never run in
# production.
RUN npm prune --omit=dev --workspace @suki/api --workspace @suki/domain --include-workspace-root


FROM node:22-alpine AS runtime

# dumb-init reaps zombies and forwards SIGTERM, so `docker compose down` is a
# clean shutdown rather than a ten-second wait followed by SIGKILL — which
# matters here because Nest's shutdown hooks drain the pg pool.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/domain/package.json ./packages/domain/
COPY --from=build /repo/packages/domain/dist ./packages/domain/dist
COPY --from=build /repo/api/package.json ./api/
COPY --from=build /repo/api/dist ./api/dist
COPY --from=build /repo/api/drizzle ./api/drizzle

# Never root. The API writes nothing to disk — its only state is Postgres — so
# it does not even need a writable home.
USER node

WORKDIR /app/api
EXPOSE 4100

# No HEALTHCHECK here: compose owns it, and duplicating it means two probes
# hitting the same endpoint on a shared box.

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
