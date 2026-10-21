# Legal pages — what to do before selling

The website has a privacy policy, terms of service and an imprint in German, French and English
(`/legal/privacy`, `/legal/terms`, `/legal/imprint`). They are written in plain words for a
Swiss B2B SaaS, but **they are not legal advice** — have a Swiss lawyer review them before the
first paying customer.

## 1. Fill in your details (one file)

`apps/web/lib/legal/operator.ts`:

- `name`, `street`, `place` — the person or company that runs Seatline
  (as a sole proprietor: your own name; with a GmbH: the company name).
- `uid` — your company number `CHE-…` once you are registered (else leave empty).
- `email` — `hello@seatline.ch` (create it at Hostpoint: _E-Mail → E-Mail-Adressen_, or a
  forward to your own inbox).
- When you change a text, update `LEGAL_UPDATED`.

The texts themselves are in `apps/web/lib/legal/docs.ts` (every language must keep the same
sections — `docs.test.ts` checks it).

## 2. Promises the texts make (keep them true)

- **Data in Switzerland**: hosting, backups and logs in Azure Switzerland North.
- **No tracking**: no analytics, ads or third-party cookies. Adding any needs a policy update
  (and possibly a consent banner).
- **Sub-processors**: Microsoft, Stripe, Hostpoint. A new one (e.g. an e-mail service, Azure
  OpenAI for plan import) must be added to the privacy policy and announced to customers in
  advance.
- **Deleting workspaces**: on request, and at the latest 6 months after the subscription or
  trial ended. This is a **manual task for now**.
- **30 days’ notice** for price or important terms changes, by e-mail to workspace admins.
- **Data breaches** are reported to affected customers without undue delay.

## 3. Worth considering

- Swiss VAT only once turnover exceeds CHF 100,000 a year; then add VAT (Stripe Tax can do it).
- A separate data processing agreement (DPA/AVV) document: some customers' legal teams ask for
  one. Section 6 of the terms covers the essentials; a lawyer can turn it into a standalone DPA.
