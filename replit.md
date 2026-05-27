# Springfield AI Command Center

An admin dashboard and command center for Springfield School, backed by an Express + Postgres API and a React + Vite frontend.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm --filter @workspace/web run dev` — run the web frontend (port 5000, served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, Tailwind, shadcn/Radix, wouter, react-query

## Where things live

- `artifacts/web` — Springfield AI Command Center frontend (path `/`)
- `artifacts/api-server` — Express API (path `/api`)
- `artifacts/mockup-sandbox` — Design canvas (path `/__mockup`)
- `lib/api-spec` — OpenAPI source of truth + Orval codegen
- `lib/api-client-react` — generated react-query hooks + Zod schemas
- `lib/db` — Drizzle schema and migration tooling

## Architecture decisions

- Contract-first: the OpenAPI spec in `lib/api-spec` drives both server validation and client hooks. Always regenerate via `pnpm --filter @workspace/api-spec run codegen` after spec changes.
- Path-based routing through the shared reverse proxy on `localhost:80`. Services declare their paths in `artifact.toml`; never call service ports directly.
- Dev servers must bind to a dual-stack listener (`::`) so the Replit workflow port monitor (which probes IPv6 loopback) recognizes them as healthy. See Gotchas.

## Product

- Login-gated admin dashboard for Springfield School staff.
- Demo credentials: `admin@springfieldschool.net` / `Admin@12345`.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **IPv6 listener required for Vite dev servers.** The workflow port monitor probes the IPv6 loopback (`::1`). If you set `server.host: "0.0.0.0"` in `vite.config.ts`, Vite binds IPv4 only and the workflow will be marked FAILED with `DIDNT_OPEN_A_PORT` even though `curl` succeeds. Use `host: "::"` for both `server` and `preview` blocks (the api-server's bare `app.listen(port)` works because Node defaults to `::`).
- **Don't run `pnpm dev` from the repo root.** Use `restart_workflow <artifact>` or filter to a specific package; artifacts rely on `PORT`/`BASE_PATH` from `[services.env]`.
- **Verify with `typecheck`, not `build`.** Build needs workflow-provided env vars and can fail from a plain shell even when types are fine.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
