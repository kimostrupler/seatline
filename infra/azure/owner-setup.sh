#!/usr/bin/env bash
# Switches on your private owner dashboard (https://<app>/owner):
#   bash owner-setup.sh you@example.com
# Run in Azure Cloud Shell after setup.sh. Safe to run again. Only the given address sees the
# page (everyone else gets "page not found"), and only when signed in with an e-mail link to a
# workspace that signs in by e-mail. Also lets the API read this resource group's Azure costs.
set -euo pipefail
RG=${RG:-seatline}
EMAIL=${1:-}
[ -n "$EMAIL" ] || read -r -p "Your sign-in e-mail address: " EMAIL
[ -n "$EMAIL" ] || { echo "No address given."; exit 1; }
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "1/2 Azure costs: the apps' identity may read this resource group's costs"
IDENTITY=$(az identity list -g "$RG" --query "[?ends_with(name, '-pull')] | [0]" -o json)
PRINCIPAL=$(echo "$IDENTITY" | python3 -c "import json,sys; print(json.load(sys.stdin)['principalId'])")
CLIENT=$(echo "$IDENTITY" | python3 -c "import json,sys; print(json.load(sys.stdin)['clientId'])")
SCOPE=$(az group show -n "$RG" --query id -o tsv)
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Cost Management Reader" --scope "$SCOPE" -o none 2>/dev/null || true
echo "  done"

say "2/2 The dashboard is for $EMAIL"
az containerapp update -n api -g "$RG" -o none --set-env-vars \
  "OWNER_EMAILS=$EMAIL" "COST_SCOPE=$SCOPE" "COST_IDENTITY_CLIENT_ID=$CLIENT"
WEB_URL=$(az containerapp show -n web -g "$RG" --query "properties.template.containers[0].env[?name=='APP_URL'].value | [0]" -o tsv)
echo "✅ Open $WEB_URL/owner (signed in as $EMAIL). Azure cost figures can take up to a day to appear."
