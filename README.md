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

**Once, before the first run** — install:

- [Node.js 22](https://nodejs.org) (LTS)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — start it, it runs the database
- [Git](https://git-scm.com)

Then in a terminal:

```bash
git clone https://github.com/kimostrupler/seatline.git
cd seatline
corepack enable                              # gives you pnpm
pnpm install                                 # also prepares the database client
pnpm db:up                                   # Postgres + Azurite in Docker
cp apps/api/.env.example apps/api/.env       # Windows: copy apps\api\.env.example apps\api\.env
pnpm db:migrate                              # create the tables
pnpm db:seed                                 # two demo companies
```

**Every time** you want to use it: start Docker Desktop, then

```bash
pnpm db:up
pnpm dev                                     # API on :3001, web on :3000
```

Open http://localhost:3000. Locally you don't need Microsoft: pick a demo company and user
(admin / editor / viewer) in the top-left **dev sign-in** menu (`AUTH_MODE=dev`, the default).

In dev mode the API trusts two headers. The seed prints ready-to-use values, e.g.
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
- **Edit layout** (editors; desktop, tablet and phone): switch at the top of the map. Tools on
  the left — select/move (V), add seat (S), draw room by corners (P) or as a rectangle (B), ruler
  to set the scale (M). ⌘C / ⌘X / ⌘V copy, cut and paste (also onto another floor), ⌘D
  duplicates, R rotates, ⌫ deletes, arrows nudge, ⌘Z / ⇧⌘Z undo/redo, hold Space to pan,
  **?** lists every shortcut. Drag a room's corners or sides to resize it (or type its size).
  Several seats can be aligned and spaced evenly; "Add a row of desks" adds desks next to a
  seat. Changes save instantly; the inspector (right, or under the map on phones) edits the
  selection or, with nothing selected, the floor (plan image, scale) and building.
- **Home** (`/`): a dashboard of widgets — seats at a glance, floors, recent changes, seat
  changes per week, people without a seat, open reservations, departments, free and blocked
  seats, Microsoft 365 sync, my seat, quick actions. **Customize** to add, remove, reorder
  (drag or arrows) and resize; everyone has their own layout, admins can save the company
  default. The map is at `/map` (old `/?floor=…` links redirect there).
- **Overview** (everyone): free / taken / reserved seats per building and floor.
- **Activity** (editors and admins): every change in plain words, newest first — filter by
  kind, person and date; each entry links to the seat or floor on the map.
- **Languages:** German, French and English. The browser's language is used, or the person's
  choice (globe menu, remembered in a cookie). Texts live in `apps/web/messages/{de,fr,en}.json`.
- Light and dark follow the system setting. All text lives in `apps/web/messages/en.json`.
- The browser calls `/api/*` on the web app, which forwards to the API (`API_URL`, read at runtime).

## API

| Method           | Path                        | What                                                                  |
| ---------------- | --------------------------- | --------------------------------------------------------------------- |
| GET/POST         | `/buildings`                | list / create                                                         |
| GET/PATCH/DELETE | `/buildings/:id`            |                                                                       |
| GET/PUT/DELETE   | `/dashboard`                | my dashboard layout (save / reset); `PUT /dashboard/default` (admins) |
| GET              | `/stats`                    | numbers and short lists for the dashboard widgets                     |
| GET              | `/overview`                 | seat counts per building and floor                                    |
| GET              | `/activity`                 | change history (editors/admins): `kind personId from to cursor`       |
| GET/POST         | `/floors?buildingId=`       | POST with `copyFromFloorId` copies rooms, seats, plan, scale          |
| GET/POST         | `/rooms?floorId=`           | rooms have a polygon of `{x, y}` points                               |
| GET/POST         | `/seats?floorId=`           | list includes `occupancy` + `currentAssignment`                       |
| GET              | `/seats/:id/history`        | everyone who sat here, newest first                                   |
| POST             | `/assignments`              | `{seatId, personId}` — assign, or move if they sit elsewhere          |
| POST             | `/assignments/reservations` | `{seatId, reservedFor}` — hold a free seat                            |
| POST             | `/assignments/:id/end`      | free the seat (history is kept)                                       |
| GET              | `/people?search=`           | people search                                                         |
| GET              | `/people/:id/history`       | every seat this person had                                            |
| GET              | `/health`                   | no auth                                                               |

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

## Sign-in and people (Microsoft 365)

- Online (`AUTH_MODE=entra`) people **sign in with Microsoft** (any organisation). The first
  person of a new organisation creates its workspace and becomes admin; colleagues join with the
  workspace's role for new people (viewer by default, admins can switch to invite-only).
- The web app holds the session (encrypted cookie) and signs a 60-second token per API request
  (`INTERNAL_AUTH_SECRET`, same value in web and API). Microsoft tokens never reach the browser.
- **People sync** reads name, e-mail, department, job title and account status from Microsoft
  Graph every night (`nightly-sync` job) or on **Sync now**. Leavers become inactive and lose
  their seat; their history stays. A customer's Microsoft 365 admin approves Seatline once.
- **People & access** (admins): roles, who can open Seatline, sync status.

## Going online

See **[docs/azure-setup.md](docs/azure-setup.md)** — one script in Azure Cloud Shell, then every
merge to `main` deploys automatically (`.github/workflows/deploy.yml`).

## File storage

Floor plan images live in Azure Blob Storage (Azurite locally, started by `pnpm db:up`),
in a private container, under `<tenant id>/floors/<floor id>/…`. Browsers never get a
storage URL — `GET /floors/:id/plan` streams the file after the tenant check. Settings:
`AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER` (see `apps/api/.env.example`).
Tests start their own in-memory Azurite.

## Hosting (Plan A — about CHF 20–30 / month)

Azure Switzerland North: Postgres Flexible Server B1ms, Container Apps (scale to zero),
Blob Storage, Container Registry. No Redis — background jobs use pg-boss in Postgres.
Everything is created by `infra/azure/setup.sh`; see [docs/azure-setup.md](docs/azure-setup.md).
