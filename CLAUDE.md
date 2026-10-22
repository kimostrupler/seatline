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
- **rooms**: id, tenant_id, floor_id, name, type (`office` | `open_space` | `meeting` | `other`), polygon (jsonb, list of points), capacity, equipment (text[]), team (zone)
- **seats**: id, tenant_id, floor_id, room_id (nullable), label, x, y, rotation, type (`desk` | `office`), status (`active` | `blocked`), features (text[])
- **floor_markers**: id, tenant_id, floor_id, kind (kitchen, printer, exit…), x, y, label

(Later tables — e-mail sign-ins, dashboard layouts, move plans, notices — are described in their sections below; the Prisma schema is the source of truth.)

- **seat_assignments**: id, tenant_id, seat_id, person_id (nullable), kind (`assigned` | `reserved`), reserved_for (text, nullable), start_at, end_at (nullable), assigned_by, note
- **audit_log**: id, tenant_id, actor_id, action, entity_type, entity_id, before (jsonb), after (jsonb), created_at

## Hard rules

1. **Tenant isolation**: every query is scoped by `tenant_id`. PostgreSQL **Row-Level Security**
   is the second safety net (`app.tenant_id` set per transaction). The API connects as a
   non-owner role so RLS can't be bypassed. Tests prove tenant A cannot read tenant B.
2. **History is never overwritten**: moving a person = close the old assignment
   (`end_at = now()`) and create a new one, in one transaction. Never update or delete past assignments.
   The only exception is data protection, and only through the database functions
   `purge_history` (retention) and `forget_person` (people who left); see "Privacy" below.
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
online people sign in with Microsoft or with an e-mail link (`DEV_AUTH` is refused in production).

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
- No hard-coded UI text: everything goes through `messages/{en,de,fr}.json` (next-intl). Every
  key must exist in all three with the same `{placeholders}` (`lib/locales.test.ts` checks).
  German is Swiss ("ss", not "ß"; formal "Sie"); French uses "vous". Language = cookie
  `seatline-language`, else the browser's Accept-Language (`pickLanguage`), else English.
- Map "Colour by: Status / Team" (`useColorBy`, per browser). Team colours are `--team-1..4`
  (only 4 pass the all-pairs colour-blind check): the company's 4 largest departments
  (`teamSlots`, from `/stats`), others neutral; the legend highlights any team. Team mode never
  uses status colours; the accessible seat list then names the team.
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
- Desk size: real size once the floor has a scale (`floors.desk_width/depth`, default 1.6 × 0.8 m),
  else 64 × 44 units. `seatSize(floor)` + `SeatSizeContext` feed the shapes, hit tests and bounds.
- Numbering per floor (`seat_numbering`): `floor` = 1.01…, `room` = room number + A, B… (`roomNumber`,
  `seatLabelAt`, `renumberSeats` in ops.ts). A batch may swap labels (the server relabels in two steps).
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
- Mouse: drag on empty floor **pans** (cursor = grab); **Shift + drag** draws a selection box
  (adds to the selection).
- The floor's plan image upload/import lives in the inspector's **Add plan / Change plan** menu
  (rarely used, so it's not a main button).
- Rich layout (`20261025090000_rich_layout`): rooms carry `capacity`/`equipment` (meeting rooms)
  and `team` (a tinted team zone); seats carry `features`; `floor_markers` (kitchen, printer,
  exit, first aid…) — lists in `ROOM_EQUIPMENT`, `SEAT_FEATURES`, `MARKER_KINDS` (packages/shared).
  Markers are part of the layout batch (`markers` create/update/delete, inverse in ops.ts) and
  tool **K**. They're drawn as an HTML overlay with lucide icons (`components/map/markers.tsx`
  `MarkerOverlay`) over the canvas; in the editor invisible Konva circles (`marker:<id>`) make
  them selectable/draggable. The view map has **Find a desk** (`desk-finder.tsx`, filter free
  desks by feature) and an accessible marker list. Copying a floor copies markers too.
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
  active. Never changes roles. Teams = `department`; admins can set one by hand (`PATCH /people/:id/team`,
  sets `team_manual`, then the sync keeps it until `fromDirectory`). Leavers: inactive + open seats closed (history kept).
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

## Sign-in by e-mail link + people added by hand

- For companies without Microsoft 365. `MailService` (`src/mail/`, nodemailer → Hostpoint SMTP as
  hello@seatline.ch; texts en/de/fr in `mail/texts.ts`). Off unless `APP_URL` + SMTP (or the test
  `MAIL_OUTBOX` folder) are set; `GET /auth/options` tells the sign-in page.
- Links: `POST /auth/email/start` (any address gets one — no account enumeration; 3 per address per
  15 min, plus a per-IP limit in the web route), 32 random bytes, only the SHA-256 is stored
  (`email_sign_ins`, no tenant, reachable only through SECURITY DEFINER functions), single use,
  15 minutes. `POST /auth/email/verify` returns the address.
- Web: `/auth/email?token=` is a page with a button (mail scanners open links and would burn
  the token); the POST routes check `Origin` (login CSRF). The session cookie is a union
  (`kind: 'microsoft' | 'email'`; old cookies = microsoft). Email identity = address + picked
  workspace (`tenantId`); `IdentityService.resolveEmail` only lets in people of workspaces
  WITHOUT Microsoft (those keep Microsoft sign-in: `use_microsoft`); several workspaces → `choose`
  (`/signin/workspace`). It never creates people; a new address gets onboarding (+ "Your name").
- Admins add people by hand (`POST /people`, optional invitation e-mail), correct them
  (`PATCH /people/:id`), mark them left/back (`PATCH /people/:id/active`: leaving ends open seats,
  history stays). People from Microsoft (`entra_object_id`) are changed in Microsoft (409
  `from_microsoft`). Infra: `infra/azure/mail-setup.sh` stores the SMTP password in Key Vault.

## People & access (tabs), teams, HR changes, notices

- `/people` has tabs in the URL (`?tab=`): **People** (list: team colour, desk, role, filters all /
  without desk / leaving / left, Add person), **Teams** (cards: seated meter, floors, rename /
  remove via `POST /people/teams/rename`, add people), **Changes** (HR table: team, role, leaving
  date for many people, one `POST /people/changes`, all or nothing), **Settings** (access,
  notices, Microsoft 365, data protection). Files: `components/admin/*-tab.tsx`.
- `people.leaves_on`: today or earlier → leave now (`PeopleService.leave`: inactive, open seats
  end, history kept); later → the nightly job (`leaveDue`, `list_leaving_tenants`) before moves.
  The people sync keeps someone inactive once their leaving date has come.
- Notices (`mail/notify.service.ts`, texts in `mail/notices.ts`): `tenants.notify_emails`,
  `notify_events` (left | joined | team | moves), `notify_language`. Sent after the change is
  saved (never undoes it): manual leave/add/team, HR changes (incl. "leaving on"), sync
  (joined/left), carried-out move plans (who moved from → to). One plain-text e-mail per batch.

## Customer e-mails, people import, security

- **Your new desk** (`mail/desk-mail.service.ts`, text `deskMail`): a single move queues a pg-boss
  `desk-mail` job that runs after `DESK_MAIL_DELAY_SECONDS` (120; tests 0 = send at once). It
  sends nothing if the assignment has ended (undo) or the person is back on the desk they had
  within 15 min. Move plans send at once. Off per workspace: `tenants.notify_people`.
- **Trial reminders**: nightly, `list_trial_tenants()` → `BillingService.remindTrial` e-mails the
  admins 7 days and 1 day before (`trialReminderDue`, `tenants.trial_reminded`). Only when
  billing and e-mail are set up; subscribed workspaces get nothing.
- **People import** (`people/import-file.ts`, pure + unit-tested): Excel (exceljs) or CSV
  (; , tab, quotes, UTF-8 or Windows-1252). Column titles en/de/fr ("Nom" next to "Prénom" = last
  name). `POST /people/import/read` (multipart, saves nothing) returns each row's status (new /
  exists / duplicate / invalid); `POST /people/import` adds the new ones in one transaction,
  sends one "joined" notice and optional invitations. Manual add also sends "joined" now.
- **Security headers** in `apps/web/next.config.ts`: CSP (self only, `blob:` images,
  `frame-ancestors 'none'`), HSTS, nosniff, Referrer/Permissions-Policy, COOP. A new outside
  host (script, font, image, API) must be added to the CSP or it's blocked.
- **Dependabot** (`.github/dependabot.yml`): weekly grouped minor/patch PRs for npm, pip, Docker,
  Actions; majors are skipped (read the changelog; react-konva must match Next's React).

## Demo workspaces, desk QR codes, DPA

- **Demo** (`src/demo/demo.service.ts`): `POST /auth/demo` (public) creates a sample office
  (`tenants.is_demo`, 2 floors, meeting rooms, team zones, markers, 22 people, history, a draft
  move plan) in the visitor's language; the admin's address is `demo-…@demo.seatline.invalid`
  and the web (`app/auth/demo` page → POST `start` route, 5 per IP per hour) signs the visitor
  in with an ordinary e-mail session for it. Max 300 at once (`count_demo_tenants`); the nightly
  job deletes them after a day (`purge_demo_tenants`, SECURITY DEFINER, sets
  `seatline.privacy=purge`). Demo: billing state `off`, checkout refused, banner with "Start your
  free trial" (= sign out → sign-in page). `MailService` never sends to `.invalid` addresses.
- **QR stickers**: Export menu → `/map/qr?floor=` (`components/map/desk-labels.tsx`, `qrcode`
  lib, SVG made in the browser). A code opens `/map?building=&floor=&seat=`.
- **Legal**: `/legal/dpa` (data processing agreement, `lib/legal/dpa.ts`, same sections in all
  languages). Sub-processors listed there and in the privacy policy must stay in step.

## Space planning, Teams & Outlook app

- **Planning** (`/planning`, editors/admins, `@EditorsOnly`): `team_plans` (team, headcount,
  by_date; RLS like everything). `GET /planning` = `spacePlan()` (`apps/api/src/planning/plan.ts`,
  pure, unit-tested): per team people / seated / expected / desks needed / team-zone desks, desks
  free, growth and how many desks are short. `PUT /planning/teams` (headcount null = remove),
  audited as `team_plan.set`.
- **Teams/Outlook tab**: the app package is built at `/teams-app` (`lib/teams/manifest.ts`,
  manifest 1.17, personal static tab → `/teams`, icons in `icons.ts`, id derived from the host).
  `/teams` (public) uses `@microsoft/teams-js` `getAuthToken()` → POST `/auth/teams` →
  `verifyTeamsToken` (audience `api://<host>/<clientId>`, issuer = the token's tenant, v2 or v1
  sts) → ordinary Microsoft session, cookie `SameSite=None; Partitioned` (https only) so it only
  lives inside the Teams frame. Outside Teams `/teams` goes to `/map`. CSP `frame-ancestors`
  allows Teams/Outlook/M365 hosts only (no X-Frame-Options). The `/api` proxy refuses changes
  whose Origin isn't the app. One-time Entra setup: `infra/azure/teams-setup.sh` (Application ID
  URI, `access_as_user` scope, Teams/Outlook/M365 clients pre-authorized, v2 tokens).

## Activity

- `GET /activity` reads `audit_log` (editors/admins, `@EditorsOnly`), newest first with a cursor,
  plus `refs` (current names of the people/seats/rooms/floors/buildings it mentions). The web
  turns entries into sentences in `lib/activity.ts` (`describe`, unit-tested); removed things are
  named from the entry's own before/after snapshot. New audit actions need a case there.
- `?q=` searches: text values in before/after (not ids/timestamps) + current names of people, seats,
  rooms, floors, buildings (entries about, mentioning or made by them). Raw SQL in `ActivityService.search`.
- `GET /overview` counts seats per floor with the same rule as the map (`seatOccupancy`). There
  is no Overview page any more: `/overview` redirects to Home, whose header has the export menu.

## Home dashboard

- `/` is the dashboard, the map lives at `/map` (`app/page.tsx` redirects old `/?floor=…` links).
  Every page, the map (view + edit) included, has the same `TopBar` (`components/common/top-bar.tsx`:
  `NavLinks`, language, `AccountMenu`); the map's sidebar only has the place picker + people.
- Layouts: `dashboard_layouts` (person_id null = company default; RLS like everything else).
  `GET /dashboard` falls back personal → company → `DEFAULT_DASHBOARD` (packages/shared).
  Saving one's own layout is allowed for viewers too (`@OwnSettings`). Audited.
- Widgets: catalog + role rules + pure layout helpers in `lib/dashboard.ts`; bodies in
  `components/dashboard/widgets.tsx`. New widget = `WIDGET_TYPES` + `WIDGETS` + body + texts.
  Numbers come from `GET /stats` (one snapshot; weeks are Swiss weeks starting Monday).
- Customize mode: each widget has one **⋯** menu (move earlier/later, size, remove) — no rows
  of small buttons. A newly added widget is scrolled into view and highlighted, plus a toast.
- The `/api` proxy must export every HTTP method the API uses (PUT was missing once).

## Move plans (planned moves)

- `move_plans` + `move_plan_items` (person → seat, or null = gives up the seat). Editors/admins
  only (`@EditorsOnly`). Edits only while `draft`; `scheduled` is locked (back to draft first).
- `checkPlan` (`apps/api/src/moves/check.ts`, pure, unit-tested) is the one rule set for the
  preview and for applying: problems (seat taken by someone not moving, blocked, wanted twice,
  deleted) block; notes (person left, no change, reservation replaced) don't.
- Applying is all or nothing in one transaction and writes history like single moves (close
  all old rows first, then open the new ones; audits carry `movePlanId`). Scheduled plans are
  applied by the nightly job (`list_due_move_tenants`, after the people sync); a broken plan is
  marked `failed` with its problems and logs an ERROR (→ alert). Nightly moves are recorded as
  made by whoever scheduled the plan; the audit actor is the system.
- Web: `/moves`, `/moves/[id]`, and plan mode on the map (`/map?plan=…`): `projectFloor`
  (`lib/moves.ts`) shows the floor after the plan; the usual gestures add plan items instead.
- **Moving list** `/moves/[id]/print` (`components/moves/moving-list.tsx`): a print page for the
  movers, sorted by starting place, tick box per move, signature lines. Applying a plan sends
  the "moves" notice e-mail (see notices).

## Privacy (nDSG)

- `tenants.history_retention_months` (12/24/60/120, null = forever; default 24). The nightly job
  (after moves) calls `PrivacyService.purge`: forgets people who left before the cut-off, then
  `purge_history(cutoff)` deletes **ended** assignments and audit entries older than it.
- `forget_person(id)` (only inactive people): name → "Former employee" (`FORGOTTEN_NAME`, shown
  translated via `usePersonName`), e-mail/department/job title/Entra id/role removed, and those
  keys stripped from the person's own audit entries. Seat history stays.
- Both are SECURITY DEFINER and act only on `app_current_tenant()`. The append-only triggers let
  rows go only while `seatline.privacy` is set inside them; the app role still has no DELETE.
- `GET /privacy/people/:id/export` (admins): everything about a person as JSON (access request).
  Exports and forgets are audited. `people.left_at` is set by the sync when someone leaves.

## Billing (Stripe)

- `billing/billing.service.ts`; off unless all three `STRIPE_*` env vars are set (state `off`).
  States (`billing-state.ts`): trial (30 days, `tenants.trial_ends_at`) → active / past_due →
  `read_only`. The auth guard refuses writes in `read_only` with 402 `billing_required`, except
  `@BillingExempt` routes (checkout/portal) — reads always work.
- Stripe state arrives only via the signed webhook (`@Public`, raw body; the web proxy passes
  `billing/webhook` through without a session). Subscriptions carry `metadata.tenantId`, but a
  webhook only applies if its customer matches the tenant's `stripe_customer_id`.
- Seat count = active seats; the nightly job syncs it (`list_billed_tenants`). Tests use
  `test/fake-stripe.ts` via `STRIPE_API_BASE`. Keys online: `infra/azure/stripe-setup.sh`.

## Plan import (Phase 5, C1/C2)

- `apps/plan-engine` (Python, FastAPI): DXF (ezdxf), PDF (pdfplumber + pypdfium2), scans (OpenCV).
  Licences matter: no PyMuPDF (AGPL). Untrusted files run in a forkserver child with a 90 s limit.
- Output = draft in the new image's pixels (`planDraftSchema` in packages/shared, validated by the
  API). Known scale → 40 px/m so desks match `SEAT_W`. Keep detection logic in `geometry.py`.
- API: `PlanImportService` stores the image under `<tenant>/floors/<id>/imports/<uuid>.png` until
  apply (→ normal plan upload, audit `floor.plan.import`) or discard. Rooms/desks are created by
  the web as ONE editor batch (`lib/editor/plan-import.ts`), so undo works like any edit.
- Tests: pytest on `samples/make_samples.py` plans; API tests use a fake engine; e2e runs the real
  engine (`scripts/py.sh`: `.venv` locally, `python3` in CI).
- Scans: desks from thin drawn rectangles, walls = long dark lines (specks dropped), room names
  by OCR (`app/ocr.py`: Tesseract deu+fra+eng, installed in the image and CI; missing = no names).
  No AI and nothing leaves the plan engine (the owner decided against AI services: keep it simple).
- Deploy: `infra/azure/plan-engine.sh` (from deploy.yml) creates/updates the internal
  `plan-engine` app and sets the API's `PLAN_ENGINE_URL`; bicep has the same app for setup.sh.

## Website and legal pages

- Landing page `app/welcome` + `app/legal/[doc]` (terms, privacy, imprint) are public. The
  site domain = parent of the app's `APP_URL` host (`siteHosts` in `lib/site.ts`): there `/`
  rewrites to `/welcome`, other paths redirect to the app. robots: index the site, never the app.
- Website texts are `site.*` messages, used only server-side (`app/layout.tsx` keeps them out
  of the client). Legal texts live in `lib/legal/docs.ts` (same sections in all languages,
  tested); the operator's details in `lib/legal/operator.ts` — never invent them.
- SEO / AI: the landing page has an address per language (`/` en, `/de`, `/fr`; the middleware
  rewrites to `/welcome` with the `x-seatline-language` header, which `i18n/request.ts` prefers),
  canonical + hreflang (`lib/seo.ts`), Open Graph/Twitter cards with `/og-image` (next/og),
  schema.org JSON-LD (Organization, SoftwareApplication with price, WebPage, FAQPage),
  `app/icon.svg` + `apple-icon.png`, `/llms.txt` (built from the `site.*` texts), robots that
  welcome AI crawlers on the site and block the app (app pages are `noindex` by default), and a
  sitemap with hreflang. The landing header uses language links, not the cookie switch.
- A new sub-processor, tracking or retention change must be reflected in the privacy policy
  (`docs/legal.md`). Infra: `infra/azure/site-domain.sh`, bicep `siteDomains`.

## Operations

- Browser errors are posted to the web app's `/client-errors` (sanitized, rate-limited) and
  logged as `ERROR [client-error] …`; `app/error.tsx` is the friendly crash page.
- Error alerts: `infra/azure/alerts.sh` (Azure Monitor log alert → e-mail), run by the deploy
  when the GitHub variable `ALERT_EMAIL` is set. No third-party error service: logs must stay in
  Switzerland. `KEEP_WARM=true` sets min replicas to 1 on deploy.
- Uptime: `/healthz` (web → API `/health`, which runs `SELECT 1`), pinged every 15 min from
  Zurich by an Application Insights availability test (`infra/azure/uptime.sh`, run by the deploy
  with `ALERT_EMAIL`; rare enough that the apps still scale to zero).
- Backups: `infra/azure/restore-test.sh` (point-in-time restore into a temporary server, check,
  delete); `.github/workflows/restore-test.yml` runs it monthly.
- Staging: `setup.sh` takes `RG`, `APP_NAME`, `BRANCH`; branch `staging` deploys to
  `STAGING_RESOURCE_GROUP`/`STAGING_REGISTRY` (deploy.yml picks by branch; alerts/uptime only on
  main). CI also runs on pushes to `staging`.
- Website statistics: `SiteBeacon` on site pages → `POST /site-visit` → one log line
  `[site-visit] {event, path, ref, source, lang, device}` (`lib/site-stats.ts`; no cookies, no
  IP). Links with `data-track="cta-…"` count clicks. Report: `infra/azure/site-stats.sh` (also
  counts "Demo workspace" / "New workspace" API log lines). The privacy policy describes it.
- Own domain: `infra/azure/custom-domain.sh`; `main.bicep` takes `customDomain` +
  `customDomainCertificateId`, and `setup.sh` re-reads them so a re-run keeps the binding.

## Working style

- Plan before coding larger steps; show the plan first.
- Small, focused commits with clear messages.
- Keep `README.md` current with how to run everything locally.
- **Always merge finished work to `main`**: once `pnpm check` is green, push the working
  branch, open a PR to `main` and merge it (no need to ask each time).
