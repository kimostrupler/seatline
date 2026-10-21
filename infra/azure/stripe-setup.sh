#!/usr/bin/env bash
# Switches on billing with Stripe:  bash stripe-setup.sh
# Run in Azure Cloud Shell after setup.sh. Safe to run again. Asks for your Stripe secret key
# (test key sk_test_… first; run again with sk_live_… when going live), then creates the price
# (CHF 2 per seat per month, change it in Stripe any time) and the webhook, keeps the keys in
# Key Vault and gives them to the API. Without this, billing stays off.
set -euo pipefail
RG=${RG:-seatline}
PRICE_CHF_CENTS=${PRICE_CHF_CENTS:-200}
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

SUB=$(az account show --query id -o tsv)
KV="seatline-$(printf '%s' "$SUB$RG" | sha256sum | cut -c1-10)"
# the app's address (its own domain from custom-domain.sh, else the Azure address)
WEB_URL=$(az containerapp show -n web -g "$RG" --query "properties.template.containers[0].env[?name=='APP_URL'].value | [0]" -o tsv)
kv_get() { az keyvault secret show --vault-name "$KV" -n "$1" --query value -o tsv 2>/dev/null || true; }

say "1/4 Stripe secret key"
echo "Stripe dashboard → Developers → API keys → Secret key (sk_test_… or sk_live_…)."
read -r -s -p "Paste it (hidden): " KEY; echo
KEY=$(printf '%s' "$KEY" | tr -d '[:space:]')
case "$KEY" in sk_test_* | sk_live_* | rk_test_* | rk_live_*) ;; *) echo "That is not a secret key (it starts with sk_test_ or sk_live_)."; exit 1 ;; esac
echo "  Got a key starting ${KEY:0:12}… and ending …${KEY: -4} (${#KEY} characters)"
stripe() {
  local out
  if ! out=$(curl -sS -u "$KEY:" -w '\n%{http_code}' "$@"); then echo "Could not reach Stripe." >&2; exit 1; fi
  local code=${out##*$'\n'} body=${out%$'\n'*}
  if [ "${code:0:1}" != 2 ]; then
    echo "Stripe said ($code): $(printf '%s' "$body" | jq -r '.error.message // .' 2>/dev/null)" >&2
    [ "$code" = 401 ] && echo "→ Copy the Secret key again (Developers → API keys → Reveal) and paste the whole key." >&2
    exit 1
  fi
  printf '%s' "$body"
}
stripe https://api.stripe.com/v1/balance >/dev/null
OLD_KEY=$(kv_get stripe-secret-key)

say "2/4 Price: CHF $(printf '%d.%02d' $((PRICE_CHF_CENTS / 100)) $((PRICE_CHF_CENTS % 100))) per seat per month"
PRICE=$(stripe -G https://api.stripe.com/v1/prices -d 'lookup_keys[]=seatline_seat_monthly' | jq -r '.data[0].id // empty')
if [ -z "$PRICE" ]; then
  PRODUCT=$(stripe https://api.stripe.com/v1/products -d name=Seatline \
    -d 'description=Office seat management, per active seat' | jq -r .id)
  PRICE=$(stripe https://api.stripe.com/v1/prices -d product="$PRODUCT" -d currency=chf \
    -d unit_amount="$PRICE_CHF_CENTS" -d 'recurring[interval]=month' \
    -d lookup_key=seatline_seat_monthly -d 'nickname=Per seat per month' | jq -r .id)
fi
echo "  $PRICE"

say "3/4 Webhook → $WEB_URL/api/billing/webhook"
HOOK_URL="$WEB_URL/api/billing/webhook"
WEBHOOK_SECRET=$(kv_get stripe-webhook-secret)
HOOKS=$(stripe -G https://api.stripe.com/v1/webhook_endpoints -d limit=100)
HOOK=$(jq -r --arg u "$HOOK_URL" '.data[] | select(.url == $u) | .id' <<<"$HOOKS" | head -n1)
# remove Seatline webhooks for an older address (e.g. before the own domain)
for old in $(jq -r --arg u "$HOOK_URL" '.data[] | select(.url != $u and (.url | endswith("/api/billing/webhook"))) | .id' <<<"$HOOKS"); do
  stripe -X DELETE "https://api.stripe.com/v1/webhook_endpoints/$old" >/dev/null
  echo "  removed the webhook for an older address"
done
# Stripe shows a webhook's signing secret only once: make a new one if we don't have it (or the key changed)
if [ -n "$HOOK" ] && { [ -z "$WEBHOOK_SECRET" ] || [ "$OLD_KEY" != "$KEY" ]; }; then
  stripe -X DELETE "https://api.stripe.com/v1/webhook_endpoints/$HOOK" >/dev/null
  HOOK=""
fi
if [ -z "$HOOK" ]; then
  WEBHOOK_SECRET=$(stripe https://api.stripe.com/v1/webhook_endpoints -d url="$HOOK_URL" \
    -d 'enabled_events[]=customer.subscription.created' \
    -d 'enabled_events[]=customer.subscription.updated' \
    -d 'enabled_events[]=customer.subscription.deleted' | jq -r .secret)
fi

say "4/4 Saving the keys in Key Vault and giving them to the API"
az keyvault secret set --vault-name "$KV" -n stripe-secret-key --value "$KEY" -o none
az keyvault secret set --vault-name "$KV" -n stripe-webhook-secret --value "$WEBHOOK_SECRET" -o none
az keyvault secret set --vault-name "$KV" -n stripe-price-id --value "$PRICE" -o none
SECRETS=(stripe-secret-key="$KEY" stripe-webhook-secret="$WEBHOOK_SECRET")
ENV=(STRIPE_SECRET_KEY=secretref:stripe-secret-key STRIPE_WEBHOOK_SECRET=secretref:stripe-webhook-secret
  STRIPE_PRICE_ID="$PRICE")
az containerapp secret set -n api -g "$RG" --secrets "${SECRETS[@]}" -o none
az containerapp update -n api -g "$RG" --set-env-vars "${ENV[@]}" -o none
az containerapp job secret set -n nightly-sync -g "$RG" --secrets "${SECRETS[@]}" -o none
az containerapp job update -n nightly-sync -g "$RG" --set-env-vars "${ENV[@]}" -o none

say "✅ Billing is on (${KEY:3:4} mode). Admins see it under Billing; workspaces get a 30-day trial."
