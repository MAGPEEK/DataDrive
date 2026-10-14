# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS dev
CMD ["sh"]

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm build \
 && pnpm --filter @datadrive/server deploy --prod /out

FROM node:22-alpine AS server
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
RUN mkdir -p /data/blocks && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/main.js"]

FROM nginxinc/nginx-unprivileged:1.27-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
