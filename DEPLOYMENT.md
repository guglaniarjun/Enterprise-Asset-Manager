# Deploying Springfield AI Command Center to a VPS

This repo ships with everything needed to run the full stack (PostgreSQL +
Express API + React SPA) on any Linux VPS using Docker.

## Architecture

```
                        ┌─────────────────────────────┐
   Browser  ──────────▶ │  web  (nginx, port 80)       │
                        │   • serves the React SPA      │
                        │   • proxies /api/* ──────────┐│
                        └──────────────────────────────┼┘
                                                        ▼
                        ┌─────────────────────────────┐
                        │  api  (Express, port 8080)    │
                        │   • applies DB schema on boot │
                        │   • optional demo seed        │
                        └──────────────┬────────────────┘
                                       ▼
                        ┌─────────────────────────────┐
                        │  db   (PostgreSQL 16)         │
                        │   • persisted in `pgdata`     │
                        └─────────────────────────────┘
```

The web container is the only one that publishes a port. All cross-service
traffic stays on the internal Docker network.

## Prerequisites

- A Linux VPS (Ubuntu/Debian recommended) with at least 1 GB RAM.
- [Docker Engine](https://docs.docker.com/engine/install/) and the Docker
  Compose plugin installed:

  ```bash
  curl -fsSL https://get.docker.com | sh
  ```

## Quick start

```bash
# 1. Clone the repo onto the VPS
git clone <your-repo-url> springfield && cd springfield

# 2. Create your environment file and fill in secrets
cp .env.example .env
nano .env            # set strong POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET

# 3. (First boot only) load demo data
#    Set SEED_ON_START=true in .env for the very first `up`, then set it
#    back to false afterwards.

# 4. Build and start everything
docker compose up -d --build

# 5. Check status / logs
docker compose ps
docker compose logs -f api
```

The app is now available at `http://<your-vps-ip>/`.

### Generating secrets

```bash
openssl rand -hex 32   # run once per secret (JWT_SECRET, JWT_REFRESH_SECRET)
```

### Demo credentials

When seeded, log in with:

- **Email:** `admin@springfieldschool.net`
- **Password:** `Admin@12345`

## Common operations

| Task | Command |
| --- | --- |
| View logs | `docker compose logs -f api` |
| Restart a service | `docker compose restart api` |
| Rebuild after `git pull` | `docker compose up -d --build` |
| Re-apply schema only | `docker compose run --rm api pnpm --filter @workspace/db run push` |
| Seed manually | `docker compose run --rm -e SEED_ON_START=false api pnpm --filter @workspace/scripts run seed` |
| Stop everything | `docker compose down` |
| Stop + wipe the database | `docker compose down -v` |

## Putting it behind HTTPS

For production you should terminate TLS in front of the `web` container. Two
common options:

1. **Caddy / Traefik** as an additional reverse proxy that auto-provisions
   Let's Encrypt certificates and forwards to the `web` service.
2. **Host nginx + certbot** on the VPS, proxying `https://yourdomain` to
   `http://127.0.0.1:${WEB_PORT}`.

If you front the stack with another proxy, change `WEB_PORT` in `.env` to an
internal-only port (e.g. `8080`) so port 80/443 stays with your TLS proxy.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `POSTGRES_USER` | no (default `springfield`) | Postgres role name |
| `POSTGRES_PASSWORD` | **yes** | Postgres password |
| `POSTGRES_DB` | no (default `springfield`) | Database name |
| `JWT_SECRET` | **yes** | Access-token signing secret |
| `JWT_REFRESH_SECRET` | **yes** | Refresh-token signing secret |
| `SESSION_SECRET` | no | Legacy fallback for the JWT secrets |
| `SEED_ON_START` | no (default `false`) | Seed demo data on container start |
| `LOG_LEVEL` | no (default `info`) | Pino log level |
| `WEB_PORT` | no (default `80`) | Host port for the web container |

`DATABASE_URL` is assembled automatically by Compose from the Postgres
variables — you do not need to set it yourself.

## Running without Docker (bare metal)

If you prefer to run directly on the host:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run build

export DATABASE_URL=postgres://user:pass@localhost:5432/springfield
export JWT_SECRET=...   JWT_REFRESH_SECRET=...

pnpm --filter @workspace/db run push          # apply schema
pnpm --filter @workspace/scripts run seed     # optional demo data

# API (port 8080)
PORT=8080 node --enable-source-maps artifacts/api-server/dist/index.mjs

# Web build is static at artifacts/web/dist/public — serve with any web
# server and proxy /api to the API process.
```
