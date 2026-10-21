# Seatline

Office seat management for Swiss/EU companies: floor plans, long-term seat assignments
with full history, and a live map of free / taken / reserved seats.

See [`CLAUDE.md`](CLAUDE.md) for the product brief, hard rules and build phases.

## What's in the repo

| Path               | What                                                |
| ------------------ | --------------------------------------------------- |
| `apps/api`         | NestJS API + Prisma schema, migrations, seed, tests |
| `apps/web`         | Next.js frontend (placeholder until Phase 2)        |
| `apps/plan-engine` | Python plan-import worker (stub until Phase 5)      |
| `packages/shared`  | zod input schemas + shared types                    |
| `infra`            | docker-compose for local Postgres and Azurite       |

## Run it locally

Needs Node 22, pnpm 10 (`corepack enable`) and Docker.

```bash
pnpm install
pnpm db:up                                   # Postgres + Azurite in Docker
cp apps/api/.env.example apps/api/.env
pnpm db:migrate                              # apply migrations
pnpm db:seed                                 # two demo companies
pnpm dev                                     # API on :3001, web on :3000
```

Open http://localhost:3000. Until Microsoft sign-in arrives (Phase 4), pick a demo
company and user (admin / editor / viewer) in the top-left **dev sign-in** menu.

The API itself trusts two headers until then. The seed prints ready-to-use values, e.g.
the Alpenblick AG admin:

```bash
curl localhost:3001/buildings \
  -H "x-tenant-id: 11111111-1111-4111-8111-111111111111" \
  -H "x-user-id: 11111111-1111-4111-8111-0000000000a1"
```

### Checks

```bash
pnpm test       # unit + API tests (API tests use the seatline_test database)
pnpm test:e2e   # browser tests (Playwright) against seatline_e2e — run `pnpm build` first
pnpm check      # format + typecheck + all tests + build — same as CI
```

The browser tests start their own API (:3101) and web app (:3100) and reset + re-seed
`seatline_e2e` before every test. If your Docker database was created before Phase 2,
add that database once: `docker compose -f infra/docker-compose.yml exec postgres createdb -U seatline seatline_e2e`.

Changing the schema: edit `apps/api/prisma/schema.prisma`, then
`pnpm --filter @seatline/api db:migrate:dev --name <change>`.

## Web app

- Left: dev sign-in, building and floor pickers, people search (drag a person onto a seat).
- Centre: floor map — scroll to zoom, drag to pan, drag someone onto another seat to move them.
- Right: the selected seat or person, with actions and full history. Every change can be undone.
- Light and dark follow the system setting. All text lives in `apps/web/messages/en.json`.
- The browser calls `/api/*` on the web app, which forwards to the API (`API_URL`, read at runtime).

## API

| Method           | Path                        | What                                                         |
| ---------------- | --------------------------- | ------------------------------------------------------------ |
| GET/POST         | `/buildings`                | list / create                                                |
| GET/PATCH/DELETE | `/buildings/:id`            |                                                              |
| GET/POST         | `/floors?buildingId=`       |                                                              |
| GET/POST         | `/rooms?floorId=`           | rooms have a polygon of `{x, y}` points                      |
| GET/POST         | `/seats?floorId=`           | list includes `occupancy` + `currentAssignment`              |
| GET              | `/seats/:id/history`        | everyone who sat here, newest first                          |
| POST             | `/assignments`              | `{seatId, personId}` — assign, or move if they sit elsewhere |
| POST             | `/assignments/reservations` | `{seatId, reservedFor}` — hold a free seat                   |
| POST             | `/assignments/:id/end`      | free the seat (history is kept)                              |
| GET              | `/people?search=`           | people search                                                |
| GET              | `/people/:id/history`       | every seat this person had                                   |
| GET              | `/health`                   | no auth                                                      |

Viewers can read; changes need the `editor` or `admin` role.

## Database rules

The database enforces the hard rules itself, so a bug in the API can't break them
(see `apps/api/prisma/migrations/*_safety_rules`):

- **Tenant isolation**: Row-Level Security on every table, scoped by `app.tenant_id`,
  which the API sets per transaction. The API connects as `seatline_app`, which is not
  the table owner, so RLS always applies. Child rows reference parents by
  `(tenant_id, id)`, so even a known id from another tenant can't be linked.
- **History is append-only**: a trigger lets an assignment be closed once (`end_at`)
  and nothing else; assignments and audit entries can't be deleted.
- **One open assignment** per seat and per person (partial unique indexes).

## Hosting (Plan A — about CHF 20–30 / month)

Azure Switzerland North: Postgres Flexible Server B1ms, Container Apps (scale to zero),
Blob Storage. No Redis — background jobs will use pg-boss in Postgres.

On Azure, after the first `prisma migrate deploy`, give the API role a password once:
`ALTER ROLE seatline_app LOGIN PASSWORD '…';` (store it in Key Vault / Container Apps
secrets, never in the repo).
