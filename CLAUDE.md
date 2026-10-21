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

Until Phase 4, the API trusts dev headers `x-tenant-id` / `x-user-id` (dev only).

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
- The shadcn CLI stops at "overwrite?" prompts and re-adds an npm package called `cn`. If it
  does, fetch the component JSON from the registry instead and fix the `cn` import.

## Working style

- Plan before coding larger steps; show the plan first.
- Small, focused commits with clear messages.
- Keep `README.md` current with how to run everything locally.
- **Always merge finished work to `main`**: once `pnpm check` is green, push the working
  branch, open a PR to `main` and merge it (no need to ask each time).
