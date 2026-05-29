# syntax=docker/dockerfile:1

# ============================================================================
# Springfield AI Command Center — multi-stage build
#
# Targets:
#   - `api` : Node.js Express API server (also runs DB push + seed)
#   - `web` : Nginx serving the built React SPA and proxying /api -> api
#
# Both targets share a single `build` stage that compiles the whole pnpm
# monorepo once (libs, API bundle, and the web static build).
# ============================================================================

# ---- build stage -----------------------------------------------------------
FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Copy the whole monorepo and install with the committed lockfile.
# (The full workspace is required so pnpm can resolve the frozen lockfile.)
COPY . .
RUN pnpm install --frozen-lockfile

# Build only the deployable artifacts. The Replit-only `mockup-sandbox`
# design canvas is intentionally skipped (it requires a runtime PORT and is
# not part of the shipped product). esbuild/vite bundle the workspace libs
# directly from source, so no separate lib build step is needed.
RUN pnpm --filter @workspace/api-server run build \
 && pnpm --filter @workspace/web run build

# ---- api runtime -----------------------------------------------------------
# Reuses the build stage so drizzle-kit (DB push), tsx (seed), and the schema
# source are all available at runtime alongside the bundled server.
FROM build AS api
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# ---- web runtime -----------------------------------------------------------
FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/web/dist/public /usr/share/nginx/html
EXPOSE 80
