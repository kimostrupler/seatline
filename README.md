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
  **Find a desk** filters free desks by feature (standing desk, two screens…); meeting rooms
  show their size and equipment, team zones are tinted, and markers (kitchen, printer, exits…)
  help people find their way.
- Right: the selected seat or person, with actions and full history. Every change can be undone.
- **Edit layout** (editors; desktop, tablet and phone): switch at the top of the map. Tools on
  the left — select/move (V), add seat (S), draw room by corners (P) or as a rectangle (B),
  marker (K: kitchen, printer, exit, first aid…), ruler to set the scale (M). Drag on empty
  floor pans the map; Shift + drag selects several things. ⌘C / ⌘X / ⌘V copy, cut and paste (also onto another floor), ⌘D
  duplicates, R rotates, ⌫ deletes, arrows nudge, ⌘Z / ⇧⌘Z undo/redo, hold Space to pan,
  **?** lists every shortcut. Drag a room's corners or sides to resize it (or type its size).
  Several seats can be aligned and spaced evenly; "Add a row of desks" adds desks next to a
  seat. Changes save instantly; the inspector (right, or under the map on phones) edits the
  selection or, with nothing selected, the floor (plan image, scale) and building. Rooms can
  be meeting rooms (seats, equipment) or a team's zone; desks carry features. Uploading or
  importing a plan is in the floor's **Add plan / Change plan** menu.
- **Home** (`/`): a dashboard of widgets (it replaced the old Overview page; `/overview`
  redirects here, the Excel/CSV export sits in its header) — seats at a glance, floors, recent changes, seat
  changes per week, people without a seat, open reservations, departments, free and blocked
  seats, Microsoft 365 sync, my seat, quick actions. **Customize** to add, remove, reorder
  (drag or arrows) and resize; everyone has their own layout, admins can save the company
  default. Each widget's **⋯** menu moves, resizes or removes it; a newly added widget is
  scrolled into view and highlighted. The map is at `/map` (old `/?floor=…` links redirect there).
- **Moves** (editors and admins): prepare seat changes as a plan, see the floor "after" on the
  map (`/map?plan=…`, drag people as usual — it only changes the plan), move a whole team to a
  floor in one go, then apply now or schedule a day (applied early that morning by the nightly
  job). Problems (a seat someone keeps, blocked seats…) are shown and block applying.
  **Moving list** (`/moves/:id/print`): who moves from where to where, sorted by starting
  desk, with tick boxes — print it for the movers. IT/facility get an e-mail once it's applied.
- **Team colours:** the map legend switches between colouring by status and by team.
- **Exports:** seating list as Excel/CSV (Home, or one floor from the map's download button;
  CSV uses ";" for German/French Excel), seat history as Excel (editors), and "Print floor" — a
  print-ready page with the map and a name list (print or save as PDF in the browser). Exports
  are recorded in the activity log.
- **People & access** (admins, `/people?tab=`): **People** (list with team, desk, role;
  filters; Add person), **Teams** (seated meter per team, rename/remove, add people),
  **Changes** (an HR table: team, role and leaving date for many people, saved together) and
  **Settings** (who can join, e-mail notices, Microsoft 365, data protection).
- **Import a list** (People & access → People): an Excel or CSV file with name and e-mail
  (team, job title optional; titles in English, German or French). Seatline shows what happens
  to each row before anything is saved; there's a template to download.
- **Demo** (website → "Try the demo", `/auth/demo`): a sample office anyone can change, no
  sign-up; deleted after a day. Only with sign-in on (`AUTH_MODE=entra`).
- **QR stickers** (map → Export → Desk QR codes): one per desk; scanning opens the desk on the
  map (who sits there).
- **Planning** (`/planning`, editors): expected headcount per team (and by when) against the
  free desks — "6 desks short" before it happens.
- **Teams & Outlook app** (People & access → Settings, after `infra/azure/teams-setup.sh`): the
  map as a tab in Teams and Outlook, signed in automatically (Teams single sign-on).
- **"Your new desk" e-mails** to the person who got a desk (2 minutes later, so an undone move
  sends nothing), switchable in Settings. Admins get a reminder 7 days and 1 day before the
  free trial ends.
- **E-mail notices:** IT or facility addresses (Settings) get a short professional e-mail when
  someone leaves or joins, changes team, or a move plan is carried out — which desks are free.
  A leaving date in the future is carried out by the nightly job on that day.
- **Data protection** (People & access, admins): how long seat history and the activity log are
  kept (default 2 years; deleted nightly), "Download their data" per person (access request) and
  "Forget this person" for people who left (their seat history stays, unnamed).
- **Activity** (editors and admins): every change in plain words, newest first — filter by
  kind, person and date; each entry links to the seat or floor on the map.
- **Languages:** German, French and English. The browser's language is used, or the person's
  choice (globe menu, remembered in a cookie). Texts live in `apps/web/messages/{de,fr,en}.json`.
- Light and dark follow the system setting. All text lives in `apps/web/messages/en.json`.
- The browser calls `/api/*` on the web app, which forwards to the API (`API_URL`, read at runtime).

## API

| Method           | Path                                                  | What                                                                                                                                              |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET/POST         | `/buildings`                                          | list / create                                                                                                                                     |
| GET/PATCH/DELETE | `/buildings/:id`                                      |                                                                                                                                                   |
| GET/PUT/DELETE   | `/dashboard`                                          | my dashboard layout (save / reset); `PUT /dashboard/default` (admins)                                                                             |
| GET              | `/stats`                                              | numbers and short lists for the dashboard widgets                                                                                                 |
| GET/POST/PATCH   | `/move-plans`, `/move-plans/:id`                      | move plans (editors); `PUT :id/items`, `DELETE :id/items/:personId`, `POST :id/team`, `:id/schedule`, `:id/unschedule`, `:id/apply`, `:id/cancel` |
| GET              | `/exports/seating`, `/exports/history`                | Excel/CSV downloads (`format=xlsx\|csv`, `lang=en\|de\|fr`); history: editors                                                                     |
| GET/POST         | `/privacy/people/:id/export`, `…/forget`              | admins: a person's data as JSON; forget someone who left                                                                                          |
| POST/GET/DELETE  | `/floors/:id/imports`, `…/:importId/image`, `…/apply` | editors: read an architect plan (DXF/PDF/image) → suggested plan, rooms, desks; apply = use its image (+ scale)                                   |
| GET/POST         | `/billing`, `/billing/checkout`, `…/portal`           | admins: plan and trial; open Stripe Checkout / customer portal. `POST /billing/webhook`: Stripe only (signed)                                     |
| GET/PUT          | `/planning`, `/planning/teams`                        | editors: space planning (expected headcount per team vs free desks)                                                                               |
| GET              | `/overview`                                           | seat counts per building and floor                                                                                                                |
| GET              | `/activity`                                           | change history (editors/admins): `kind personId from to cursor`                                                                                   |
| GET/POST         | `/floors?buildingId=`                                 | POST with `copyFromFloorId` copies rooms, seats, plan, scale                                                                                      |
| GET/POST         | `/rooms?floorId=`                                     | rooms have a polygon of `{x, y}` points                                                                                                           |
| GET/POST         | `/seats?floorId=`                                     | list includes `occupancy` + `currentAssignment`                                                                                                   |
| GET              | `/seats/:id/history`                                  | everyone who sat here, newest first                                                                                                               |
| POST             | `/assignments`                                        | `{seatId, personId}` — assign, or move if they sit elsewhere                                                                                      |
| POST             | `/assignments/reservations`                           | `{seatId, reservedFor}` — hold a free seat                                                                                                        |
| POST             | `/assignments/:id/end`                                | free the seat (history is kept)                                                                                                                   |
| GET              | `/people?search=`                                     | people search                                                                                                                                     |
| POST/PATCH       | `/people`, `/people/:id`, `/people/:id/active`        | admins: add people by hand, correct them, mark left/back; `POST /people/changes` (HR table), `POST /people/teams/rename`                          |
| POST             | `/people/import/read`, `/people/import`               | admins: read an Excel/CSV list (nothing saved) → add the new people                                                                               |
| PATCH            | `/floors/:id/layout`                                  | editors: one batch of room/seat/marker changes (all or nothing)                                                                                   |
| GET              | `/people/:id/history`                                 | every seat this person had                                                                                                                        |
| GET              | `/health`                                             | no auth                                                                                                                                           |

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
- **People & access** (admins): roles, who can open Seatline, sync status. A sync error 403
  means the customer's Microsoft admin still has to approve Seatline (Settings → Approve).

## Plan import (architect plans)

- **Edit layout → Floor → Import architect plan**: DXF, PDF or a scan → the plan becomes the
  background, and Seatline suggests rooms (names, types) and desks to keep or drop. One undo
  removes what was imported.
- The Python service in `apps/plan-engine` reads the files (see its README); the API calls it at
  `PLAN_ENGINE_URL` (`POST /floors/:id/imports`, `…/imports/:id/apply`). Unset = import is off.
- Locally: create its `.venv` once (README), then `pnpm --filter @seatline/plan-engine dev`.

## Website and legal pages

- `seatline.ch` / `www` show the landing page (`app/welcome`), the app runs on `app.seatline.ch`
  — same web app; `middleware.ts` picks by host (`lib/site.ts`: the app address's parent domain).
  Locally: http://localhost:3000/welcome.
- Terms, privacy policy, imprint: `/legal/terms|privacy|imprint`, public on both addresses,
  linked from the sign-in page, the account menu and the website footer. Operator details in
  `apps/web/lib/legal/operator.ts`; see [docs/legal.md](docs/legal.md).

## Sign-in by e-mail (without Microsoft 365)

- The sign-in page offers "E-mail me a sign-in link" once the API can send e-mail: `APP_URL` +
  `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` (online: `infra/azure/mail-setup.sh`, Hostpoint,
  hello@seatline.ch). Links work once, for 15 minutes.
- A new address can create a workspace (it signs in by e-mail). Admins add colleagues under
  People & access → **Add person** (optionally with an invitation e-mail).
- Locally/tests: set `MAIL_OUTBOX=/some/folder` (with `APP_URL`) and each e-mail is written there
  as a JSON file instead of being sent.

## Billing (Stripe)

- Off unless `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_ID` are set (online:
  `infra/azure/stripe-setup.sh`). Then: 30-day trial per workspace → subscription per active
  seat → **read-only** if unpaid (changes get HTTP 402 `billing_required`; reading still works).
- Stripe tells us about subscriptions via the webhook (`/api/billing/webhook`, passed through
  the web proxy without a session). The nightly job updates each subscription's seat count.
- Tests use a fake Stripe server (`apps/api/test/fake-stripe.ts`); no Stripe account needed.

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
