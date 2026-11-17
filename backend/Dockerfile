# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app

# Full toolchain (dev dependencies + sources). Also used by the compose `seed` service.
FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM build AS prod-deps
RUN pnpm prune --prod --ignore-scripts

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=5000
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/uploads && chown app:app /app/uploads
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./
USER app
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD sh -c "wget -qO- http://127.0.0.1:${PORT:-5000}/api/v1/health || exit 1"
# Indexes are created by Mongoose on startup. Set RUN_WORKERS=0 on API replicas
# and run a separate `worker` service (same image) with RUN_WORKERS=1 to scale them apart.
CMD ["node", "dist/main.js"]
