#!/usr/bin/env bash
# Puts Seatline on your own web address, e.g.  bash custom-domain.sh app.example.ch
# Run in Azure Cloud Shell. Safe to run again. You need access to the domain's DNS settings.
set -euo pipefail
DOMAIN=${1:?usage: bash custom-domain.sh app.example.ch}
RG=${RG:-seatline}
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

ENV_NAME=$(az containerapp show -n web -g "$RG" --query "properties.managedEnvironmentId" -o tsv | sed 's#.*/##')
FQDN=$(az containerapp show -n web -g "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
VERIFY=$(az containerapp show -n web -g "$RG" --query "properties.customDomainVerificationId" -o tsv)

say "1/4 Add these two DNS records at your domain provider:"
cat <<RECORDS

  Type   Name                    Value
  CNAME  ${DOMAIN}       ${FQDN}
  TXT    asuid.${DOMAIN}   ${VERIFY}

(Some providers want only the first part of the name, e.g. "app" and "asuid.app".)
RECORDS
read -r -p "Press Enter once both records are saved (they can take a few minutes to work)… "

say "2/4 Connecting $DOMAIN and creating a free certificate (a few minutes)"
az containerapp hostname add -n web -g "$RG" --hostname "$DOMAIN" -o none 2>/dev/null || true
for attempt in 1 2 3 4 5 6; do
  if az containerapp hostname bind -n web -g "$RG" --hostname "$DOMAIN" \
    --environment "$ENV_NAME" --validation-method CNAME -o none; then
    break
  fi
  [ "$attempt" = 6 ] && { echo "The DNS records aren't visible yet. Wait a bit and run this again."; exit 1; }
  echo "Not ready yet — trying again in 60 seconds…"; sleep 60
done

say "3/4 The app now uses https://$DOMAIN"
az containerapp update -n web -g "$RG" --set-env-vars "APP_URL=https://$DOMAIN" -o none

say "4/4 Allow Microsoft sign-in to return to the new address"
APP_ID=$(az containerapp show -n web -g "$RG" \
  --query "properties.template.containers[0].env[?name=='ENTRA_CLIENT_ID'].value | [0]" -o tsv)
URIS=$( { az ad app show --id "$APP_ID" --query "web.redirectUris[]" -o tsv; \
  echo "https://$DOMAIN/auth/callback"; echo "https://$DOMAIN/people"; } | sort -u)
# shellcheck disable=SC2086
az ad app update --id "$APP_ID" --web-redirect-uris $URIS

say "✅ Done: https://$DOMAIN  (the old Azure address keeps working)"
