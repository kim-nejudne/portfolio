# syntax=docker/dockerfile:1
#
# The web image. Build context is the REPO ROOT:
#
#   docker build -f frontend/Dockerfile -t forme-web:$TAG .
#
# `output: 'standalone'` plus `outputFileTracingRoot` pointed at the repo root
# means Next traces @forme/domain out of the workspace and emits a self-contained
# server — so the runtime stage carries no node_modules install at all.

# ---- deps
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY api/package.json api/
COPY frontend/package.json frontend/
RUN npm ci --ignore-scripts

# ---- build
FROM deps AS build
WORKDIR /repo
COPY packages/domain packages/domain
COPY frontend frontend
# The domain package must be compiled before Next resolves it: the workspace
# symlink points at dist/, which does not exist until this runs.
RUN npm run build --workspace @forme/domain \
 && npm run build --workspace @forme/web

# ---- runtime
FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

RUN apk add --no-cache dumb-init

# Standalone output only. Static assets are not included in the traced server
# and have to be copied alongside it, or every page loads without CSS.
COPY --from=build /repo/frontend/.next/standalone ./
COPY --from=build /repo/frontend/.next/static ./frontend/.next/static

# `public/` is not part of the traced output either, and needs the same
# treatment. It did not exist here at all until the share card was added, so
# nothing was missing and the omission was invisible — the first deploy after
# adding it served `/og-card.png` as a 404 while the `og:image` tag in
# `layout.tsx` pointed straight at it, which is the broken-preview state the
# card was added to fix.
COPY --from=build /repo/frontend/public ./frontend/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "frontend/server.js"]
