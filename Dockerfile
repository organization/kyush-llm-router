ARG NODE_VERSION=24.13.0

FROM node:${NODE_VERSION}-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ pkg-config \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json

RUN pnpm install --frozen-lockfile

COPY server ./server
COPY client ./client
COPY shared ./shared
COPY database ./database
COPY scripts ./scripts

RUN pnpm build

FROM node:${NODE_VERSION}-bookworm-slim AS server

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

ENV NODE_ENV=production
ENV SERVER_PORT=3000
ENV DB_DIR=/data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/database ./database

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "server/dist/server/src/index.js"]

FROM nginx:1.28-alpine AS admin-gateway

COPY docker/admin-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80

FROM nginx:1.28-alpine AS public-gateway

COPY docker/public-nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
