#!/bin/sh
# Entrypoint for the API container.
# 1. Applies the Drizzle schema to the database (idempotent on an existing DB).
# 2. Optionally seeds demo data when SEED_ON_START=true.
# 3. Starts the bundled Express server.
set -e

echo "==> Applying database schema (drizzle-kit push)..."
pnpm --filter @workspace/db run push

if [ "${SEED_ON_START}" = "true" ]; then
  echo "==> Seeding demo data..."
  pnpm --filter @workspace/scripts run seed
fi

echo "==> Starting API server on port ${PORT:-8080}..."
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
