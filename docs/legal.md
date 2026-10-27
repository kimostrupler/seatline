# Legal pages — what to do before selling

The website has a privacy policy, terms of service, a data processing agreement (DPA/AVV) and an
imprint in German, French and English (`/legal/privacy`, `/legal/terms`, `/legal/dpa`,
`/legal/imprint`). They are written in plain words for a
Swiss B2B SaaS, but **they are not legal advice** — have a Swiss lawyer review them before the
first paying customer.

## 1. Your details (one file)

`apps/web/lib/legal/operator.ts` holds the operator's name, address, e-mail (`hello@seatline.ch`)
and, once registered, the company number (`CHE-…`). Seatline is run as a sole proprietorship,
so the imprint shows the owner's name and address, as Swiss law requires (UWG art. 3 s).
When you change a text, update `LEGAL_UPDATED`.

The texts themselves are in `apps/web/lib/legal/docs.ts` (the DPA in `dpa.ts`) (every language must keep the same
sections — `docs.test.ts` checks it).

## 2. Promises the texts make (keep them true)

- **Data in Switzerland**: hosting, backups and logs in Azure Switzerland North.
- **No tracking**: no ads, third-party cookies or analytics services. The only statistics are
  anonymous page-view counts on our own servers (page, referring site, language, device type —
  no cookies, no IP address; `lib/site-stats.ts`), as the privacy policy says. Anything more
  needs a policy update (and possibly a consent banner).
- **E-mail** (sign-in links, invitations) goes out through Hostpoint's SMTP as hello@seatline.ch;
  only a hash of each link is stored, for at most a day.
- **Outreach** (owner Leads page): one personal e-mail per person, to published business
  addresses only, never in bulk (UWG Art. 3 lit. o), with an easy "no thanks". Stored: company,
  contact name/role, the published address, notes; replies are checked for sender, date and subject
  (out-of-office answers are noted); a lead's reply text is read from the mailbox only to show it
  on the Leads page and never stored in Seatline
  (IMAP, Hostpoint). "No" / "no answer" leads are deleted after 12 months. The privacy policy
  (section 3) says so.
- **Sub-processors**: Microsoft, Stripe, Hostpoint. A new one (e.g. an e-mail service) must be added to the privacy policy and
  announced to customers in advance.
- **Deleting workspaces**: on request, and at the latest 6 months after the subscription or
  trial ended. This is a **manual task for now**.
- **30 days’ notice** for price or important terms changes, by e-mail to workspace admins.
- **Data breaches** are reported to affected customers without undue delay (DPA: as a rule
  within 48 hours).
- **DPA promises**: sub-processor changes announced 30 days ahead; one audit per year on
  request; backups overwritten within 35 days after a workspace is deleted. Customers asking
  for a signed copy get a PDF (print `/legal/dpa` to PDF and sign it).

## 3. Worth considering

- Swiss VAT only once turnover exceeds CHF 100,000 a year; then add VAT (Stripe Tax can do it).
- Have a lawyer check the DPA (`/legal/dpa`) together with the terms.
