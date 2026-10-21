# CLAUDE.md — Seatline

## What we are building

Seatline is a multi-tenant SaaS for **office seat management**:

- Companies build their own **floor plans** (buildings → floors → rooms → seats)
- They **assign people to seats** (long-term seating, not hot-desk booking)
- Every move is kept as **history** (who sat where, from when to when, changed by whom)
- They see **free / taken / reserved seats** on an interactive map
- Later: auto-generate floor plans from architect plans (PDF, image, DXF) using a Python worker + AI vision

Target customers: Swiss/EU companies using Microsoft 365. Data must stay in Switzerland
(Azure Switzerland North). Swiss data protection law (nDSG) applies — seat history is personal data.

## Tech stack

| Area               | Choice                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Monorepo           | pnpm workspaces + Turborepo                                            |
| Frontend           | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui              |
| Floor map / editor | react-konva (Konva.js)                                                 |
| Backend API        | NestJS, TypeScript                                                     |
| Database           | PostgreSQL + Prisma                                                    |
| Validation         | zod (shared schemas in `packages/shared`)                              |
| Jobs               | **pg-boss** (queue stored in Postgres — no Redis for now, see Hosting) |
| File storage       | Azure Blob Storage (Azurite locally)                                   |
| Auth               | Microsoft Entra ID (multi-tenant app registration)                     |
| People sync        | Microsoft Graph API                                                    |
| Plan engine        | Python (FastAPI worker), ezdxf for DXF, AI vision for images           |
| Payments           | Stripe (later)                                                         |
| Errors             | Sentry (later)                                                         |
| i18n               | German, English, French (Swiss market)                                 |

## Hosting (Plan A — lean Azure, ~CHF 20–30/month)

- Azure Switzerland North only.
- Postgres Flexible Server **B1ms**, Azure Container Apps (scale to zero), Blob Storage.
- **No Redis**: background jobs use pg-boss in Postgres. Keep job code behind a small
  interface so moving to Redis/BullMQ later only touches that module.
- Scaling up = bigger SKUs, not code changes.

## Repo structure

```
/apps
  /web            Next.js frontend
  /api            NestJS backend (owns the Prisma schema)
  /plan-engine    Python worker (stub until Phase 5)
/packages
  /shared         shared TypeScript types + zod schemas
/infra            docker-compose for local dev (Postgres, Azurite)
/.claude/skills   apple-design (HIG references — use for UI work/reviews)
```

## Data model (first version)

All tables except `tenants` have a `tenant_id`.

- **tenants**: id, name, slug, entra_tenant_id, data_region, created_at
- **people**: id, tenant_id, entra_object_id, email, display_name, department, job_title, app_role (`admin` | `editor` | `viewer` | null = no app access), active, synced_at
- **buildings**: id, tenant_id, name, address
- **floors**: id, tenant_id, building_id, name, level (int), plan_file_key, plan_width, plan_height, scale
- **rooms**: id, tenant_id, floor_id, name, type (`office` | `open_space` | `meeting` | `other`), polygon (jsonb, list of points)
- **seats**: id, tenant_id, floor_id, room_id (nullable), label, x, y, rotation, type (`desk` | `office`), status (`active` | `blocked`)
- **seat_assignments**: id, tenant_id, seat_id, person_id (nullable), kind (`assigned` | `reserved`), reserved_for (text, nullable), start_at, end_at (nullable), assigned_by, note
- **audit_log**: id, tenant_id, actor_id, action, entity_type, entity_id, before (jsonb), after (jsonb), created_at

## Hard rules

1. **Tenant isolation**: every query is scoped by `tenant_id`. PostgreSQL **Row-Level Security**
   is the second safety net (`app.tenant_id` set per transaction). The API connects as a
   non-owner role so RLS can't be bypassed. Tests prove tenant A cannot read tenant B.
2. **History is never overwritten**: moving a person = close the old assignment
   (`end_at = now()`) and create a new one, in one transaction. Never update or delete past assignments.
3. **One open assignment per seat and per person**: partial unique indexes (`WHERE end_at IS NULL`).
4. **Every change writes to `audit_log`** (same transaction as the change).
5. **Store minimal personal data** — only what Graph gives us and we need.
6. No secrets in the repo. Use `.env.example`.
7. TypeScript `strict` everywhere. Validate all API input with zod.
8. Write tests for business logic (assignments, history, tenant isolation).

## Build phases

1. **Foundation**: monorepo, docker-compose, Prisma schema + migrations, RLS, seed data, NestJS modules for buildings/floors/rooms/seats/assignments, tests
2. **UI**: app shell, floor map (view mode), seat details panel, people search, drag-and-drop assign/move, history view
3. **Layout editor**: draw rooms, place seats, upload plan image as background
4. **Microsoft**: Entra login, Graph people sync, roles
5. **Plan engine**: PDF/image/DXF → draft layout, user confirms
6. **SaaS**: onboarding, Stripe billing, retention settings, exports (CSV/PDF)

Locally (`AUTH_MODE=dev` / `DEV_AUTH=true`) the API trusts dev headers `x-tenant-id` / `x-user-id`;
online only Microsoft sign-in works (`DEV_AUTH` is refused in production).

## UI direction

Clean and light, similar to Linear / Notion — not like classic facility software.

- Left: building/floor picker + people search
- Center: zoomable floor map (green = free, grey = taken, yellow = reserved)
- Right: details of the selected seat (person, since when, history)
- Toggle between **View** and **Edit layout** mode

## Web app notes (Phase 2)

- `apps/web/components/workspace/workspace.tsx` is the screen; selection lives in the URL
  (`?building=&floor=&seat=&person=`).
- Floor map = Konva (`components/map/floor-map.tsx`). **Next 15 bundles React 19.2**, so
  react-konva must stay on **19.2.x** (19.3 refuses to run). Canvas colours come from the CSS
  tokens in `app/globals.css` via `useCssVars`.
- The canvas is invisible to keyboards/screen readers: the hidden seat-button list next to it is
  the accessible map — keep it in sync with what the canvas shows.
- Seat status is colour **and** content (initials / R / cross). Status colours mean seat status
  only; selection and focus use `--primary`.
- No hard-coded UI text: everything goes through `messages/en.json` (next-intl).
- Every seat change shows a toast with Undo; undo makes the opposite change (history keeps both).
- shadcn components are added with `npx shadcn@<version> add …`; check its imports afterwards
  (it once pulled an npm package called `cn` instead of `@/lib/utils`).
- Browser tests: `apps/web/e2e`, real API + `seatline_e2e` database, reset before each test.

## Layout editor notes (Phase 3)

- Edit mode = `components/editor/*`; pure edit logic (apply, inverse for undo, move,
  rotate, duplicate, labels) is in `lib/editor/ops.ts` with unit tests — keep logic there.
- Every user action is **one** `PATCH /floors/:id/layout` batch (all or nothing). The client
  creates the UUIDs so undo/redo refer to the same rows. `useLayoutEditor` shows changes
  instantly and sends batches one at a time, in order.
- A seat's room is **derived on the server** from its position (smallest containing room,
  `roomForPoint` in `packages/shared`). Don't let clients set `roomId` in the editor.
- Seats with any assignment history can't be deleted (block them) — enforced in
  `LayoutService`, and the history rows' FK restrict backs it up.
- Plan images: raster only (PNG/JPG/WebP, checked by content). The image's pixel size is the
  floor's coordinate space. Storage keys must start with the tenant id; `getPlan` checks it.
- The canvas uses **pointer events** (mouse, pen and touch alike). One finger on empty floor pans,
  two fingers pinch-zoom (`useViewport`); a second finger cancels the first one's drag.
- Copy/paste goes through `lib/editor/clipboard.ts` (memory + localStorage), so it works across
  floors. Pasting keeps names/labels when free (labels follow the target floor's level) and
  shifts aside if it would land on top of existing items (`pasteClip`, `pasteOffset`).
- Room handles: corners (rectangles stay rectangular, `moveVertex`) and side midpoints
  (`moveEdge`); double-click a side handle adds a corner, a corner removes it.
- Edit mode also works on phones/tablets: the inspector becomes a panel under the canvas.
- The shadcn CLI stops at "overwrite?" prompts and re-adds an npm package called `cn`. If it
  does, fetch the component JSON from the registry instead and fix the `cn` import.

## Microsoft sign-in, people sync, deployment notes (Phase 4)

- **BFF auth**: the web app does OIDC (code + PKCE, `lib/server/oidc.ts`), keeps an encrypted
  session cookie, and the `/api` proxy signs a 60 s HS256 token per request
  (`INTERNAL_AUTH_SECRET`). The API (`auth.guard.ts`) verifies it and maps Entra `tid`/`oid` to a
  workspace/person (`identity.service.ts`). Never forward identity headers from the browser in
  entra mode.
- ID tokens: issuer must equal `<login>/<tid>/v2.0` of the token's own `tid` (multi-tenant), plus
  audience, nonce, signature. Covered by `lib/server/oidc.test.ts`.
- Workspace lookup before the tenant is known uses SECURITY DEFINER SQL functions
  (`resolve_tenant`, `list_sync_tenants`) — keep RLS on everything else.
- New people get the workspace's `default_app_role` **when they first appear** (sync or first
  sign-in); changing the setting doesn't touch existing people.
- People sync (`sync/people-sync.service.ts`) stores only name, e-mail, department, job title,
  active. Never changes roles. Leavers: inactive + open seats closed (history kept).
- Jobs: pg-boss in schema `pgboss` (owned by the API role, created by a migration) for
  "Sync now"; the nightly sync is a separate scheduled container (`dist/jobs/nightly-sync.js`)
  because the API scales to zero. Keep queue code in `jobs/job-queue.service.ts`.
- `jose` is ESM-only; the CommonJS API can `require` it because Node 22 supports require(esm).
- Pages are `force-dynamic` (AUTH_MODE is read at runtime); middleware runs on the Node runtime.
- Browser tests: project `entra` runs `e2e/entra.spec.ts` against a second web app in entra mode
  and `e2e/fake-microsoft.mjs`; everything else runs in dev mode.
- Azure: `infra/azure/main.bicep` + `setup.sh` (Cloud Shell, idempotent, secrets in Key Vault);
  `.github/workflows/deploy.yml` deploys after CI on main (OIDC, no stored Azure secrets).
  Docker Hub may rate-limit; Dockerfiles take `--build-arg NODE_IMAGE=…` for a mirror.

## Activity & overview

- `GET /activity` reads `audit_log` (editors/admins, `@EditorsOnly`), newest first with a cursor,
  plus `refs` (current names of the people/seats/rooms/floors/buildings it mentions). The web
  turns entries into sentences in `lib/activity.ts` (`describe`, unit-tested); removed things are
  named from the entry's own before/after snapshot. New audit actions need a case there.
- `GET /overview` counts seats per floor with the same rule as the map (`seatOccupancy`).

## Home dashboard

- `/` is the dashboard, the map lives at `/map` (`app/page.tsx` redirects old `/?floor=…` links).
  Pages share `PageFrame` + `NavLinks` (top bar); the map's sidebar shows the same `NavLinks`.
- Layouts: `dashboard_layouts` (person_id null = company default; RLS like everything else).
  `GET /dashboard` falls back personal → company → `DEFAULT_DASHBOARD` (packages/shared).
  Saving one's own layout is allowed for viewers too (`@OwnSettings`). Audited.
- Widgets: catalog + role rules + pure layout helpers in `lib/dashboard.ts`; bodies in
  `components/dashboard/widgets.tsx`. New widget = `WIDGET_TYPES` + `WIDGETS` + body + texts.
  Numbers come from `GET /stats` (one snapshot; weeks are Swiss weeks starting Monday).
- The `/api` proxy must export every HTTP method the API uses (PUT was missing once).

## Working style

- Plan before coding larger steps; show the plan first.
- Small, focused commits with clear messages.
- Keep `README.md` current with how to run everything locally.
- **Always merge finished work to `main`**: once `pnpm check` is green, push the working
  branch, open a PR to `main` and merge it (no need to ask each time).
