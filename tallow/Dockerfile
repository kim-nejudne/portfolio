# syntax=docker/dockerfile:1

# ---- build: compiles the SPA into dist/ and the server/migrate bundles into dist-server/
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- deps: production node_modules only (express, pg, dotenv)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000

# dumb-init reaps zombies and forwards signals, so `docker stop` is a clean exit.
RUN apk add --no-cache dumb-init

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY --from=build /app/dist-server  ./dist-server
COPY package.json ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/menu').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist-server/server.cjs"]
