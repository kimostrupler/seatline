# Put Seatline online (Azure, Switzerland North)

About 30 minutes, once. Afterwards every merge to `main` goes live automatically.
Cost: about **CHF 20–30 per month** (new Azure accounts usually get free credit first).

What gets created, all in **Switzerland North**:

| Part             | Azure service                                | ~ CHF/month |
| ---------------- | -------------------------------------------- | ----------- |
| Database         | PostgreSQL Flexible Server B1ms              | 13–15       |
| Web app + API    | Container Apps (sleep when nobody uses them) | 0–5         |
| Image registry   | Container Registry Basic                     | ~5          |
| Floor plan files | Storage account (private)                    | < 1         |
| Logs             | Log Analytics, capped at 0.5 GB/day          | 0–2         |
| Secrets          | Key Vault                                    | ~0          |

## 1. Azure account

1. Use a Microsoft account that is **only yours** (e.g. a new outlook.com address for Seatline).
   If your account is a guest in an employer's Microsoft 365 (its address shows `#EXT#`), Azure
   sends you to the employer's sign-in — don't continue there; use a separate account.
   If creating the account is "blocked", wait a few hours and try from another network (no VPN).
2. Sign in at <https://portal.azure.com>. Top right should show **your own** directory
   ("Default Directory"). If it says "Don't have a subscription?", click **Start** under
   **Azure free trial** (credit card needed; the free credit is used first).

## 2. Run the setup script (in the browser)

1. Open <https://portal.azure.com> and click the **Cloud Shell** icon (`>_`, top bar).
   Choose **Bash**. If asked about storage, pick "No storage account required".
2. Sign in to GitHub so Cloud Shell can download the (private) repository:

   ```bash
   gh auth login        # GitHub.com → HTTPS → Login with a web browser → enter the code shown
   gh repo clone kimostrupler/seatline
   ```

   (No `gh`? On GitHub use **Code → Download ZIP**, then the Cloud Shell **Upload** button,
   and `unzip seatline-main.zip && mv seatline-main seatline`.)

3. Start the setup:

   ```bash
   bash seatline/infra/azure/setup.sh
   ```

   It takes about 10 minutes and prints each step. It's safe to run again.

## 3. Connect GitHub

At the end the script prints **5 values**. In GitHub open
**Settings → Secrets and variables → Actions → Variables → New repository variable** and add
each one (name and value exactly as printed): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_REGISTRY`.

Then **Actions → Deploy → Run workflow**. After ~10 minutes it shows "Live: https://web.…".

## 4. First sign-in

1. Open the address the script printed and click **Sign in with Microsoft**.
2. You're the first person from your organisation, so Seatline asks for its name and makes
   you the **admin**.
3. People sync: open **People & access** → **Sync now**. The first time it says Seatline needs
   permission — a Microsoft 365 admin clicks **Approve in Microsoft** once. After that, people
   sync every night.

## 5. Optional extras

All set in GitHub → **Settings → Secrets and variables → Actions → Variables**. They take
effect with the next deploy (**Actions → Deploy → Run workflow** to apply them right away).

### Error alerts by e-mail (recommended, ~free)

Add the variable **`ALERT_EMAIL`** = your e-mail address. Azure then e-mails you when Seatline
logs errors (server errors, errors in people's browsers, a failed nightly sync) — at most once
an hour. Logs and alerts stay in Switzerland North. The e-mail links to the logs in the Azure
portal (**Log Analytics workspace → Logs**). The same variable also switches on an **uptime
check**: Azure opens `/healthz` every 15 minutes from Zurich and e-mails you if Seatline doesn't
answer (`infra/azure/uptime.sh`).

### Backup restore test (automatic, monthly)

On the 1st of each month GitHub restores the database as it was an hour earlier into a
temporary server, checks it and deletes it again (**Actions → Backup restore test**, also
runnable by hand). In Cloud Shell, `bash seatline/infra/azure/restore-test.sh` does the same
and also counts workspaces, people and seat history in the copy. Backups are kept 7 days, in
Switzerland.

### A test copy (staging, ~CHF 20/month more)

`RG=seatline-staging APP_NAME="Seatline Staging" BRANCH=staging bash seatline/infra/azure/setup.sh`
creates a separate copy with its own database and sign-in app. Add the two variables it prints
(`STAGING_RESOURCE_GROUP`, `STAGING_REGISTRY`); from then on, pushing to the branch `staging`
deploys there after CI, while `main` still goes live. Try risky changes there first.

### Website statistics

`bash seatline/infra/azure/site-stats.sh` prints the last 30 days (`DAYS=7` for a week): page
views per day, pages, where visitors came from, phone or computer, clicks on "Try it free" /
"Try the demo", demos opened and workspaces created. Counted without cookies or IP addresses.

### Faster first page (~CHF 10–20/month more)

To save money the apps sleep when nobody uses them, so the first visit after a quiet time takes
~15–30 seconds (a loading screen shows meanwhile). Add the variable **`KEEP_WARM`** = `true`
to keep one copy of the web app and the API running, or `web` for only the web app (pages
appear at once, the first data waits a few seconds; about half the cost). Remove it (or set
`false`) to go back.

### Your own web address (e.g. `app.yourcompany.ch`)

You need a domain (e.g. from a Swiss provider like Infomaniak or Hostpoint, ~CHF 10–20/year)
and access to its DNS settings. In Cloud Shell:

```bash
bash seatline/infra/azure/custom-domain.sh app.yourcompany.ch
```

It shows two DNS records to add (a CNAME and a TXT), waits for you, then connects the address,
creates a free HTTPS certificate and updates Microsoft sign-in. The Azure address keeps working.
Running `setup.sh` again later keeps the address.

### The website on your main domain (e.g. `example.ch`)

The landing page and the legal pages are part of the web app. They show on the main domain
and `www` once those point to Azure — the app keeps its own address (`app.example.ch`). In
Cloud Shell:

```bash
bash seatline/infra/azure/site-domain.sh example.ch
```

It shows four DNS records to add (an A record and a TXT for the main domain, a CNAME and a TXT
for `www`), waits for you, then creates free certificates. E-mail (MX records) isn't affected.
The texts need your details first — see [legal.md](legal.md).

### Billing with Stripe (charge customers per seat)

Off until you set it up — then every workspace gets a **30-day free trial**, after which an
admin subscribes under **Billing** (card or invoice via Stripe). Unpaid workspaces become
**read-only**: everyone can still look, nothing can be changed. The bill follows the number of
active seats (updated every night).

1. Create a free account at [stripe.com](https://stripe.com) (start in **test mode** — no real
   money; test card `4242 4242 4242 4242`).
2. Copy **Developers → API keys → Secret key** (`sk_test_…`).
3. In Cloud Shell:

   ```bash
   bash seatline/infra/azure/stripe-setup.sh
   ```

   It asks for the key, creates the price (CHF 2 per seat per month — change the price in
   Stripe any time, or run with `PRICE_CHF_CENTS=500` for CHF 5), adds the webhook and gives the
   keys to the app (kept in Key Vault). Running `setup.sh` again later keeps them.

To go live: activate your Stripe account, then run the script again with the **live** key
(`sk_live_…`). In Stripe, also turn on the **Customer portal** (Settings → Billing → Customer
portal) so admins can change their card or cancel.

**Discount codes** (e.g. founding customers, partners): Stripe → Product catalogue → Coupons →
**+ Create coupon** (e.g. 100 % off, duration "repeating", 6 months), then **Add promotion code**
(e.g. `GRUENDER6`). Customers type it in the "Add promotion code" field on the payment page.

**Own payment domain (done):** in Stripe → Settings → Business → Custom domains, Checkout and the
customer portal run on **pay.seatline.ch** (a DNS record at the domain registrar points it to
Stripe; Stripe checks it for a few hours, then switches over by itself). Seatline needs no change
for this: it always opens the address Stripe returns. If the domain is ever removed, Stripe falls
back to checkout.stripe.com / billing.stripe.com, which also works.

## Good to know

- **Other companies** can sign in the same way: their first person creates their workspace.
  Their Microsoft 365 admin approves Seatline once (Microsoft asks for this for apps from
  publishers that aren't "verified" yet). Before selling widely, verify the publisher in the
  Entra app registration (needs a free Microsoft Partner ID).
- **Secrets** (database passwords, sign-in keys) are generated by the script and kept in the
  Key Vault in your resource group — never in GitHub.
- **Dev sign-in** (the demo company switcher) is never available online.
- **Removing everything:** delete the resource group `seatline` in the Azure portal.
