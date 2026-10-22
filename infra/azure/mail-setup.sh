#!/usr/bin/env bash
# Switches on e-mail (sign-in links, invitations):  bash mail-setup.sh
# Run in Azure Cloud Shell after setup.sh. Safe to run again. Asks for the password of the
# mailbox hello@seatline.ch at Hostpoint, checks it against Hostpoint's mail server, keeps it
# in Key Vault and gives it to the API. Without this, people sign in with Microsoft only.
set -euo pipefail
RG=${RG:-seatline}
SMTP_HOST=${SMTP_HOST:-asmtp.mail.hostpoint.ch}
SMTP_USER=${SMTP_USER:-hello@seatline.ch}
MAIL_FROM=${MAIL_FROM:-Seatline <$SMTP_USER>}
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

SUB=$(az account show --query id -o tsv)
KV="seatline-$(printf '%s' "$SUB$RG" | sha256sum | cut -c1-10)"
WEB_URL=$(az containerapp show -n web -g "$RG" --query "properties.template.containers[0].env[?name=='APP_URL'].value | [0]" -o tsv)

say "1/3 Password of $SMTP_USER"
echo "The password of the mailbox at Hostpoint (Control Panel → E-Mail → $SMTP_USER)."
read -r -s -p "Paste it (hidden): " PASSWORD; echo
[ -n "$PASSWORD" ] || { echo "No password given."; exit 1; }

say "2/3 Checking it with $SMTP_HOST"
# log in over TLS (port 465) and log out again; nothing is sent
if ! curl -sS --max-time 20 --url "smtps://$SMTP_HOST:465" --user "$SMTP_USER:$PASSWORD" \
  -X NOOP >/dev/null 2>&1; then
  echo "Hostpoint did not accept $SMTP_USER with this password. Check it in the Hostpoint Control Panel and run this again."
  exit 1
fi
echo "  Accepted."

say "3/3 Saving it in Key Vault and giving it to the API"
az keyvault secret set --vault-name "$KV" -n smtp-password --value "$PASSWORD" -o none
ENV=(SMTP_HOST="$SMTP_HOST" SMTP_PORT=465 SMTP_USER="$SMTP_USER" SMTP_PASSWORD=secretref:smtp-password
  "MAIL_FROM=$MAIL_FROM" APP_URL="$WEB_URL")
az containerapp secret set -n api -g "$RG" --secrets smtp-password="$PASSWORD" -o none
az containerapp update -n api -g "$RG" --set-env-vars "${ENV[@]}" -o none
az containerapp job secret set -n nightly-sync -g "$RG" --secrets smtp-password="$PASSWORD" -o none
az containerapp job update -n nightly-sync -g "$RG" --set-env-vars "${ENV[@]}" -o none

say "✅ E-mail is on. The sign-in page at $WEB_URL now offers \"E-mail me a sign-in link\"."
