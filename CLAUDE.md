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
/.claude/skills   apple-design (HIG), ponytail (coding style), marketing/SEO, design, engineering
                  skills (sources + licences: .claude/skills/THIRD_PARTY.md)
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
- Layout (`components/workspace/shell.tsx`): sidebar · map · details from `lg`; from `md` (tablets,
  half-screen windows) the sidebar stays docked and seat details open as a bottom sheet; below
  `md` the sidebar is a sheet behind the ☰ button.
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
- **Example offices**: an empty floor (no plan, rooms, seats, markers) shows `TemplatePicker`
  (small 12 / medium 33 / large 74 desks). `templateChanges` (`lib/editor/templates.ts`, pure,
  unit-tested) builds rooms, desks (labels by the floor's numbering, scaled to its desk size)
  and markers as ONE editor batch, so Undo removes it.
- The shadcn CLI stops at "overwrite?" prompts and re-adds an npm package called `cn`. If it
  does, fetch the component JSON from the registry instead and fix the `cn` import.

## Microsoft sign-in, people sync, deployment notes (Phase 4)

- **BFF auth**: the web app does OIDC (code + PKCE, `lib/server/oidc.ts`), keeps an encrypted
  session cookie, and the `/api` proxy signs a 60 s HS256 token per request
  (`INTERNAL_AUTH_SECRET`). The API (`auth.guard.ts`) verifies it and maps Entra `tid`/`oid` to a
  workspace/person (`identity.service.ts`). Never forward identity headers from the browser in
  entra mode.
- A sign-in lasts **30 days** (`SESSION_HOURS`; sign out ends it, leavers lose access on the next
  request anyway). Keep the privacy policy's cookie section in step if it changes.
- Signing in also sets `sl_in=1` on the site's parent domain (`signedInMarker`, same lifetime, no
  personal data; cleared on sign-out) because seatline.ch can't read the app's session cookie:
  `looksSignedIn()` makes the website/help headers show **Open Seatline** instead of Sign in.
  It's listed in the privacy policy's cookie section.
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
  `.github/workflows/deploy.yml` deploys on every push to main (OIDC, no stored Azure secrets).
  GitHub's free minutes are limited: CI runs on pull requests only (main = the merged PR, already
  tested), a newer push cancels the older run, docs-only changes (`*.md`, `docs/`) skip CI and
  deploy. Push each PR once when possible.
  Out of minutes (deploy "fails" in seconds, no log): `infra/azure/deploy.sh` in Cloud Shell does
  the same deploy with `az acr build` (docs/azure-setup.md › Deploy without GitHub).
  Docker Hub may rate-limit; Dockerfiles take `--build-arg NODE_IMAGE=…` for a mirror.
- Fast pipeline: deploy builds the three images in parallel with buildx and a registry layer cache
  (`<image>:buildcache` in ACR); the API/web Dockerfiles `pnpm fetch` from the lockfile first so
  that layer survives code-only changes. CI caches the Playwright browser per version (no
  `--with-deps`: the runner already has Chrome's libraries) and skips man-db after apt installs.

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
  date for many people, one `POST /people/changes`, all or nothing), **Settings** (each section a
  fold-out `Fold` (`components/common/fold.tsx`) showing its current value; tests open it with
  `openFold`) (access,
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
- **Onboarding e-mails** (`mail/onboarding.service.ts`, text `onboardingMail`): nightly,
  `list_onboarding_tenants()` (last 10 days, no demos) → admins get day 1 "draw your first floor"
  (skipped if desks exist), day 3 "add your people" (skipped if more than one person), day 7
  "can we help?" (`onboardingDue`, `tenants.onboarding_sent`; workspaces older than the feature = done).
  Each tip ends with "reply stop" (Swiss UWG: easy opt-out); the operator honours it with the owner
  page's row ⋯ → **Stop tips** (`POST /owner/workspaces/:id/stop-tips`, audited `owner.workspace.stop_tips`).
- **People import** (`people/import-file.ts`, pure + unit-tested): Excel (exceljs) or CSV
  (; , tab, quotes, UTF-8 or Windows-1252). Column titles en/de/fr ("Nom" next to "Prénom" = last
  name). `POST /people/import/read` (multipart, saves nothing) returns each row's status (new /
  exists / duplicate / invalid); `POST /people/import` adds the new ones in one transaction,
  sends one "joined" notice and optional invitations. Manual add also sends "joined" now.
- **Security headers** in `apps/web/next.config.ts`: HSTS, X-Frame-Options DENY, nosniff,
  Referrer/Permissions-Policy, COOP. The **CSP** is set per request in `middleware.ts`
  (`lib/csp.ts`, tested): self only, `blob:` images, `frame-ancestors 'none'`, and scripts only
  with that request's nonce + `'strict-dynamic'` (no `'unsafe-inline'` scripts; Next.js stamps its
  own scripts with the nonce). JSON-LD `<script type="application/ld+json">` blocks are data and
  need none. `e2e/pages.spec.ts` fails on any CSP console error. A new outside host (script, font,
  image, API) must be added to the CSP or it's blocked.
- **Per-address limits** (`lib/server/rate-limit.ts`, in memory per instance) key on `clientIp()`: the
  LAST `X-Forwarded-For` entry (added by Azure's ingress); the first one is the caller's and can be faked.
- **Audit** (`pnpm audit --prod`): transitive fixes are forced in `pnpm-workspace.yaml` `overrides`
  (body-parser, postcss, multer). Accepted for now: deepmerge-ts (Prisma CLI, build time only) and uuid
  inside exceljs (the vulnerable `buf` argument is never used). Re-check on each Dependabot round.
- **Dependabot** (`.github/dependabot.yml`): monthly grouped minor/patch PRs for npm, pip, Docker,
  Actions; majors are skipped (read the changelog; react-konva must match Next's React).

## Demo workspaces, desk QR codes, DPA

- **Demo** (`src/demo/demo.service.ts`): `POST /auth/demo` (public) creates a sample office
  (`tenants.is_demo`, 2 floors, meeting rooms, team zones, markers, 22 people, history, a draft
  move plan) in the visitor's language; the admin's address is `demo-…@demo.seatline.invalid`
  and the web (`app/auth/demo` page → POST `start` route, 5 per IP per hour) signs the visitor
  in with an ordinary e-mail session for it. Max 300 at once (`count_demo_tenants`); the nightly
  job deletes them after a day (`purge_demo_tenants`, SECURITY DEFINER, sets
  `seatline.privacy=purge`), their uploaded files first (`list_old_demo_tenants` → `deletePrefix`). Demo: billing state `off`, checkout refused, banner with "Start your
  free trial" (= sign out → sign-in page). `MailService` never sends to `.invalid` addresses.
- **QR stickers**: Export menu → `/map/qr?floor=` (`components/map/desk-labels.tsx`, `qrcode`
  lib, SVG made in the browser), printed 12 per A4 sheet (fixed 3 × 4 grid, `@page` margin 0,
  never split). A code opens `/desk/<seatId>` (`components/map/desk-page.tsx`, signed-in members
  only): place, who sits there (name, job, team, e-mail, since), features, history, "Show on the
  map". Old stickers (`/map?…&seat=`) still work.
- **Legal**: `/legal/dpa` (data processing agreement; text + operator in
  `packages/shared/src/legal.ts`, imported as `@seatline/shared/dist/legal` to keep page bundles
  small; same sections in all languages). Sub-processors listed there and in the privacy policy
  must stay in step. Admins e-mail themselves a PDF copy with their company's name: Settings ›
  Data protection → `POST /privacy/dpa` (`dpa-pdf.ts`, pdf-lib, audited `privacy.dpa`); it
  applies without a signature, a hand-signed copy stays possible on request.

## Space planning

- **Planning** (`/planning`, editors/admins, `@EditorsOnly`): `team_plans` (team, headcount,
  by_date; RLS like everything). `GET /planning` = `spacePlan()` (`apps/api/src/planning/plan.ts`,
  pure, unit-tested): per team people / seated / expected / desks needed / team-zone desks, desks
  free, growth and how many desks are short. `PUT /planning/teams` (headcount null = remove),
  audited as `team_plan.set`.
- There is no Microsoft Teams / Outlook app (removed on purpose); the app may not be framed.

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
  **Phones**: the pages sit in a floating "liquid glass" bottom bar (`mobile-tab-bar.tsx`: Home, Map,
  Moves, People + **More** menu with the rest and Help; utilities `glass` and `pb-tab-bar` in
  `globals.css`). It must be rendered OUTSIDE the sticky header (a backdrop-filter parent pins
  fixed children to itself). The top bar then only shows logo, language and account.
  Every page, the map (view + edit) included, has the same `TopBar` (`components/common/top-bar.tsx`:
  `NavLinks`, language, `AccountMenu`); the map's sidebar only has the place picker + people.
- Layouts: `dashboard_layouts` (person_id null = company default; RLS like everything else).
  `GET /dashboard` falls back personal → company → `DEFAULT_DASHBOARD` (packages/shared).
  Saving one's own layout is allowed for viewers too (`@OwnSettings`). Audited.
- Widgets: catalog + role rules + pure layout helpers in `lib/dashboard.ts`; bodies in
  `components/dashboard/widgets.tsx`. New widget = `WIDGET_TYPES` + `WIDGETS` + body + texts.
  Numbers come from `GET /stats` (one snapshot; weeks are Swiss weeks starting Monday).
- **Setup wizard** (`/setup`, `components/setup/setup-wizard.tsx`): the onboarding form goes there
  (not to an empty map). Step 1: building (company name), floor ("Ground floor"), size = an example
  office (`templateChanges`, sent as one layout batch) or empty; step 2: how people get in (import
  → `/people?import=1` opens the import dialog, by hand, or Microsoft 365) + the free Excel
  template. Uses only existing APIs; a workspace with a building is sent to `/map`. The empty map's
  "Set up my office" button opens it again.
- **Map tour** (`components/map/map-tour.tsx`): three tips over the view map on the first visit
  (colours, click a desk, undo), per browser (`useDismissed('seatline-map-tour-v1')`). e2e projects
  mark it seen via `storageState`; `e2e/map-tour.spec.ts` tests it in a fresh browser.
- **Help button** (top bar + phone "More" menu) opens the topic for the current page
  (`helpTopicFor` in `lib/help`, unit-tested). Help texts must be updated with every UI change.
- **Getting started** (`components/dashboard/getting-started.tsx`, admins, not in demos): 4 steps
  ticked from `/overview` + `/people/directory` (`setupProgress`, `lib/getting-started.ts`);
  hidden per browser + workspace (`useDismissed`), and by itself once all are done.
- The default Home is short on purpose (quick actions, upcoming moves, my seat, seats at a glance,
  floors); the other widgets are one **Add widget** away. Keep it calm: prefer fold-outs and menus
  over showing everything.
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
- The plan page is two steps: **1. Who moves where?** (moves list + Plan on the map / Move a
  team) and **2. When?** (Apply now / Schedule); rename, moving list, back to draft and cancel
  sit in one **More** menu. The seat and person panels fold their history away (`HistoryList
folded`) so the person and the actions stand out.
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
  The webhook re-reads the subscription from Stripe and applies that (events arrive late and
  out of order). Checkout is refused (409 `subscribed`) while a subscription exists.
- The operator's own workspace (an active admin from `OWNER_EMAILS`, e-mail sign-in) is billing
  state `off` like demos: never a trial, never read-only. So nobody may add an `OWNER_EMAILS`
  address to their list by hand (`POST /people`, import, `PATCH /people/:id` → 409
  `reserved_email`); it only gets there when the operator signs up with it.
- The nightly job catches errors per workspace: one broken workspace never stops the others.
- Checkout allows promotion codes (`allow_promotion_codes`); the codes are made in the Stripe
  dashboard (docs/azure-setup.md).
- Checkout and the customer portal run on Stripe's own pages under **pay.seatline.ch** (Stripe
  custom domain, set in the Stripe dashboard + a DNS record). The web app just opens the URL the
  API gets from Stripe (`window.location.assign`), so nothing in code or the CSP depends on the
  domain. Don't hard-code Stripe hosts.
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

- **Landing page design**: the app's own look (tokens + system font from `app/globals.css`,
  light/dark follows the system), built with Tailwind like the app; `components/site/landing/landing.css`
  only holds the scroll entrances (`Reveal` adds `is-live`/`is-in`). Sections: glass sticky header
  (Features, Pricing, Questions, Help, languages, Sign in) → hero + `LiveFloor` (tap a green desk,
  seat colours = the map's) → trust row → promo video (`public/site-video/seatline-promo-2.*`: a
  90 s story "the usual way vs Seatline", 1080p H.264 ~4.6 MB + 13 KB poster, `preload="none"`;
  no captions burned in, so WebVTT subtitles en/de/fr sit next to it, the page language on by
  default) + a comparison table (`COMPARE`, texts `site.compare`: "Many office tools" vs Seatline;
  never name a competitor, only claims true of Seatline, the data row says "depends"). Short
  links for e-mails: `/video`, `/de/video`, `/fr/video` redirect to that landing page `#video`,
  keeping `?utm_source=…` (`videoLink` in `lib/site.ts`, middleware); e-mail pictures (a JPG with
  a play button, a 6 s GIF) in `public/site-video/email/` →
  three parts with phone pictures (`public/site-img/<lang>/`,
  made by help-screenshots.spec.ts) → six short feature items (`site.features`, each opens its help topic) → 4 steps →
  `NoticeDemo` (short: one line, DE/FR/EN switch, the IT e-mail's subject + moves, worded like `notices.ts` via `lib/site/notice-sample.ts` — keep in
  step) → price card → FAQ as fold-outs → blue closing band → footer ("Zürich, Switzerland" + local
  time). The live parts get only `site.live`/`site.notice` via a nested `NextIntlClientProvider`.
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
  IndexNow (Bing & co.): key `INDEXNOW_KEY` (public) served at `/indexnow.txt`; the deploy
  (`infra/azure/indexnow.sh`) posts the live sitemap's pages after each release.
- **Help center** (`/help/<en|de|fr>[/<topic>]`, public, `lib/help/` en/de/fr content, tested
  for same steps/pictures in every language): topics with numbered steps + screenshots, tips,
  FAQ (FAQPage / HowTo JSON-LD), in the sitemap (hreflang) and llms.txt; the middleware sets the
  page language from the address. Screenshots in `apps/web/public/help-img/<lang>/` come from
  the real app: `HELP_SCREENSHOTS=1 pnpm exec playwright test help-screenshots --project
chromium` (re-run after UI changes). In the app: **Help** in the top bar, a dismissible banner
  on Home. Help texts must use the app's real labels (from messages) and only true facts.
- **Video tour** (`/help/<lang>/video-tour`, `lib/help/video.ts`): the 9-minute tutorial (English
  voice, AI-generated with Google AI Studio, no music; English captions burned in). The mp4 (45 MB)
  is NOT in the image: it lives in Blob Storage in Zurich (`lib/media.ts`, storage account
  `seatlinemedia3148`, container `media`, public read; CSP `media-src`). Page: big player
  (`components/help/video-player.tsx`, `preload="none"`, poster `public/site-video/seatline-tutorial.webp`),
  chapters that jump (`CHAPTERS`, `?t=` seconds starts there), German/French subtitles as WebVTT
  at the top of the picture (`video-tour/subtitles` route, from `CUES` in `video-cues.ts`: every
  sentence in en/de/fr, aligned), the whole text as a fold-out, VideoObject JSON-LD with clips.
  The help home also has the 48 s overview (`seatline-promo.mp4`, the landing page's first video,
  English captions burned in; texts `VIDEO[lang].quick`).
  Linked from: a card on the help home, the help sidebar, "Watch this part" on topics with a
  chapter (`topic` in `CHAPTERS`), a button under the landing page's promo video, the footer,
  sitemap and llms.txt. A new video version = upload over the same blob, update the cues/chapters.
- **Free Excel template** (`/help/<lang>/excel-template`, `lib/help/template.ts`; in the help
  sidebar, footers, sitemap, llms.txt): a seating-plan .xlsx per language in
  `apps/web/public/templates/`, made by `node apps/api/scripts/seating-template.mjs` (re-run after
  changes). Its first sheet uses the people import's column titles; `seating-template.test.ts`
  checks that a filled-in template imports.
- A new sub-processor, tracking or retention change must be reflected in the privacy policy
  (`docs/legal.md`). Infra: `infra/azure/site-domain.sh`, bicep `siteDomains`.

## Owner dashboard (operator only)

- `/owner` (`noindex`, linked only for the operator): sign-ups per day, every workspace (counts, billing state,
  last change, admins' e-mails), Stripe (MRR, subscriptions by status, balance, payments) and
  Azure costs (month to date by service and day, forecast at today's pace, last month) and
  **Storage** (database size against its 32 GB disk + biggest tables, files in Blob Storage incl.
  plan imports waiting; files listed at most every 15 min). Refreshes every 30 s. Last month is
  asked with explicit dates (`Custom` + `timePeriod`): some subscriptions refuse `TheLastMonth`.
- Reached from the main menu: **Overview** appears (admins only ask) when `GET /owner/check`
  answers 204; everyone else gets the same 404. The operator's own workspace shows as
  "Owner · free" (`owner` flag, same rule as billing) and isn't counted as a trial.
  The **Setup** column (`setupStep`, `lib/setup-step.ts`) shows where a workspace stopped: no
  desks → no people → nobody seated → in use.
- **Delete a workspace (support)**: row ⋯ → type its name → `DELETE /owner/workspaces/:id`
  (`{ name }` must match). Refused for the operator's own workspace and while a Stripe
  subscription runs (cancel it in Stripe first). SECURITY DEFINER `delete_tenant(uuid)` removes
  every row (history included, like `purge_demo_tenants`), then `StorageService.deletePrefix`
  removes the files; logged as `owner.workspace.delete` in the operator's own activity.
- **Leads** (`/owner/leads`, tab next to the overview; `components/owner/leads-page.tsx`): the
  operator's personal outreach. Tables `leads` + `lead_messages` live in the operator's OWN
  workspace (normal tenant RLS) and only owner-checked endpoints (`/owner/leads…`,
  `LeadsService`) use them. Rules and templates en/de/fr are pure in
  `packages/shared/src/outreach.ts` (imported as `@seatline/shared/dist/outreach`, unit-tested in
  `apps/api/src/owner/outreach.test.ts`): one e-mail per lead at a time, never in bulk, at most
  `MAX_WORDS` (100), a "why now" sentence and no `[placeholder]` left (`messageProblem`). Schedule
  = the next Tue–Thu 8 am Zurich (`nextSendSlot`), or **Send now** (after one confirmation;
  `sendNow` on schedule, or `POST …/messages/:id/send` for a scheduled one; a failed send waits
  for the next slot); the `nightly-sync` job now runs at 01:00 and
  07:00 UTC (cron `0 1,7 * * *`, set by deploy.yml/deploy.sh/bicep): the night run does the
  nightly work, both runs check replies (`runOutreach`), only the morning one sends (7–11 am
  Zurich, `isSendingHour`) and e-mails the operator about due follow-ups (after 7 days). A
  reply (IMAP `InboxService`: envelopes + References/Auto-Submitted headers only; it counts
  when it answers one of our Message-IDs, or comes from the contact's own address and isn't
  auto-submitted — a colleague's out-of-office or a newsletter from the domain doesn't) or a
  "no" cancels what's scheduled; a message is claimed (`sent_at`) before SMTP so it never goes
  out twice; 14 days after the follow-up → `no_answer`;
  "no"/"no_answer" leads are deleted after 12 months. Sent mails: plain text + HTML with the
  video GIF (`outreachHtml`, no tracking), sender "Kimo Strupler · Seatline", Message-ID kept so
  the follow-up is a reply; a copy goes to the mailbox's Sent folder. IMAP: `IMAP_HOST`
  (mail-setup.sh sets imap.mail.hostpoint.ch), login = SMTP user; tests use `MAIL_INBOX` files.
  Audits `owner.lead.*`. The privacy policy (section 3) describes outreach.
- Azure costs that fail show Azure's own reason on the dashboard (`detail`); `owner-setup.sh` now
  reports whether the "Cost Management Reader" role could be given (needs Owner / User Access
  Administrator on the subscription).
- Access: `GET /owner/overview` checks `OWNER_EMAILS` against the caller's person **and** that
  their workspace has no Microsoft (an e-mail link proves the address; an Entra directory could
  claim any address). Anyone else gets Nest's exact "Cannot GET …" 404, and the page calls
  `notFound()` — indistinguishable from a missing page. Its texts (`owner.*`) are left out of
  the layout's client messages and sent only with this page.
- Data: SECURITY DEFINER `owner_workspaces()` (counts only, no seat history),
  `BillingService.ownerSummary()` (Stripe), `AzureCostService` (Cost Management query API with
  the apps' managed identity, role Cost Management Reader, cached 15 min; `COST_SCOPE`,
  `COST_IDENTITY_CLIENT_ID`). Setup: `infra/azure/owner-setup.sh <email>`; bicep + setup.sh keep
  it (`ownerEmails` param read back from the API's env).

## Operations

- Browser errors are posted to the web app's `/client-errors` (sanitized, rate-limited) and
  logged as `ERROR [client-error] …`; `app/error.tsx` is the friendly crash page.
- Error alerts: `infra/azure/alerts.sh` (Azure Monitor log alert → e-mail), run by the deploy
  when the GitHub variable `ALERT_EMAIL` is set. No third-party error service: logs must stay in
  Switzerland. `KEEP_WARM=true` sets min replicas to 1 on deploy (`web`: only the web app).
- `app/loading.tsx` is the loading screen (shown e.g. while sleeping apps wake up); sign-in /
  sign-up pages pass `backHref` to `Centered` for "Back to the website" (`websiteHref`).
- Uptime: `/healthz` (web → API `/health`, which runs `SELECT 1`), pinged every 15 min from
  Zurich by an Application Insights availability test (`infra/azure/uptime.sh`, run by the deploy
  with `ALERT_EMAIL`; rare enough that the apps still scale to zero).
- Backups: `infra/azure/restore-test.sh` (point-in-time restore into a temporary server, check,
  delete); `.github/workflows/restore-test.yml` runs it monthly.
- Staging: `setup.sh` takes `RG`, `APP_NAME`, `BRANCH`; branch `staging` deploys to
  `STAGING_RESOURCE_GROUP`/`STAGING_REGISTRY` (deploy.yml picks by branch; alerts/uptime only on
  main). Staging deploys on push without its own CI run (test it through a PR).
- Website statistics: `SiteBeacon` on site pages → `POST /site-visit` → one log line
  `[site-visit] {event, path, ref, source, lang, device}` (`lib/site-stats.ts`; no cookies, no
  IP). Links with `data-track="cta-…"` count clicks. Report: `infra/azure/site-stats.sh` (also
  counts "Demo workspace" / "New workspace" API log lines). The privacy policy describes it.
- Own domain: `infra/azure/custom-domain.sh`; `main.bicep` takes `customDomain` +
  `customDomainCertificateId`, and `setup.sh` re-reads them so a re-run keeps the binding.

## Working style

- **Ponytail** (`.claude/skills/ponytail/`, from github.com/DietrichGebert/ponytail, MIT, copied —
  no hooks): follow its rules on every coding task (smallest complete change, no unrequested
  features, but never cut tests, validation, security, accessibility). The rules here win when
  they differ. Reviews: `ponytail-review`; whole-repo audit: `ponytail-audit`.
- Other copied skills in `.claude/skills` (see `THIRD_PARTY.md`): marketing/SEO for seatline.ch
  (`seo-audit`, `ai-seo`, `copywriting`, `cro`, `onboarding`, `pricing`, `emails`, `launch`),
  design (`taste-skill`, `frontend-design` — keep the Linear/Notion look and the CSS tokens),
  engineering (`security-and-hardening`, `performance-optimization`, `test-driven-development`,
  `debugging-and-error-recovery`, `frontend-ui-engineering`). This file's rules win (e.g. no
  named competitors, no tracking beyond the cookieless stats, data stays in Switzerland).
- Plan before coding larger steps; show the plan first.
- Small, focused commits with clear messages.
- Keep `README.md` current with how to run everything locally.
- **Always merge finished work to `main`**: once `pnpm check` is green, push the working
  branch, open a PR to `main` and merge it (no need to ask each time).
