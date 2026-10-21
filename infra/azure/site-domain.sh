#!/usr/bin/env bash
# Puts the public website (landing page + legal pages) on your main domain and its www:
#   bash site-domain.sh example.ch
# Run in Azure Cloud Shell after custom-domain.sh (the app keeps app.example.ch). Safe to run
# again. The website is served by the same web app, so nothing else needs deploying.
set -euo pipefail
APEX=${1:?usage: bash site-domain.sh example.ch}
APEX=${APEX#www.}
WWW="www.$APEX"
RG=${RG:-seatline}
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

ENV_ID=$(az containerapp show -n web -g "$RG" --query "properties.managedEnvironmentId" -o tsv)
ENV_NAME=${ENV_ID##*/}
IP=$(az containerapp env show --ids "$ENV_ID" --query "properties.staticIp" -o tsv)
FQDN=$(az containerapp show -n web -g "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
VERIFY=$(az containerapp show -n web -g "$RG" --query "properties.customDomainVerificationId" -o tsv)

say "1/3 Add these DNS records at your domain provider:"
cat <<RECORDS

  Type   Name                Value
  A      ${APEX}    ${IP}
  TXT    asuid.${APEX}       ${VERIFY}
  CNAME  ${WWW}    ${FQDN}
  TXT    asuid.${WWW}   ${VERIFY}

(Some providers want only the first part of the name: "@" or empty for ${APEX}, "asuid",
"www" and "asuid.www".) Delete any other A or AAAA record of ${APEX} (e.g. a parking page).
Don't touch MX records: e-mail keeps working.
RECORDS
read -r -p "Press Enter once the records are saved (they can take a few minutes to work)… "

bind() { # domain, validation method (main domain: HTTP, www: CNAME)
  az containerapp hostname add -n web -g "$RG" --hostname "$1" -o none 2>/dev/null || true
  for attempt in $(seq 1 25); do
    if az containerapp hostname bind -n web -g "$RG" --hostname "$1" \
      --environment "$ENV_NAME" --validation-method "$2" -o none; then
      return
    fi
    if [ "$attempt" = 25 ]; then
      echo "Not finished after 25 minutes. Check the DNS records, wait a bit and run this again."
      exit 1
    fi
    echo "Not ready yet (DNS or certificate) — trying again in 60 seconds… ($attempt/25)"; sleep 60
  done
}

say "2/3 Connecting $APEX and creating a free certificate (a few minutes)"
bind "$APEX" HTTP
say "3/3 Connecting $WWW"
bind "$WWW" CNAME

say "✅ Done: https://$APEX shows the website (the app stays where it is)"
