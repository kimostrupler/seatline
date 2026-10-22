#!/usr/bin/env bash
# Lets Seatline run as a tab in Microsoft Teams and Outlook with single sign-on:
#   bash teams-setup.sh
# Run in Azure Cloud Shell after setup.sh. Safe to run again. It gives the Seatline Entra app an
# "API" that Teams and Outlook may ask tokens for (no extra permissions for customers).
# Afterwards: People & access → Settings → Teams & Outlook → download the app and upload it in
# Teams (Apps → Manage your apps → Upload an app), or in the Teams admin center for everyone.
set -euo pipefail
RG=${RG:-seatline}
APP_NAME=${APP_NAME:-Seatline}
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
[ -n "$APP_ID" ] || { echo "No Entra app '$APP_NAME' — run setup.sh first."; exit 1; }
OBJECT_ID=$(az ad app show --id "$APP_ID" --query id -o tsv)
WEB_URL=$(az containerapp show -n web -g "$RG" --query "properties.template.containers[0].env[?name=='APP_URL'].value | [0]" -o tsv)
HOST=${WEB_URL#https://}
HOST=${HOST%%/*}
URI="api://$HOST/$APP_ID"

say "1/2 API for Teams single sign-on: $URI"
# the scope keeps its id across runs
SCOPE_ID=$(az ad app show --id "$APP_ID" --query "api.oauth2PermissionScopes[?value=='access_as_user'].id | [0]" -o tsv)
[ -n "$SCOPE_ID" ] || SCOPE_ID=$(cat /proc/sys/kernel/random/uuid)
az ad app update --id "$APP_ID" --identifier-uris "$URI"

# Microsoft's own apps that may ask for the token: Teams (desktop/mobile, web), Microsoft 365
# (web, desktop, mobile) and Outlook (desktop, web, mobile)
CLIENTS='["1fec8e78-bce4-4aaf-ab1b-5451cc387264","5e3ce6c0-2b1f-4285-8d4b-75ee78787346",
  "4765445b-32c6-49b0-83e6-1d93765276ca","0ec893e0-5785-4de6-99da-4ed124e5296c",
  "d3590ed6-52b3-4102-aeff-aad2292ab01c","bc59ab01-8403-45c6-8796-ac3ef710b3e3",
  "27922004-5251-4030-b22d-91ecd9a37ea4"]'
az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$OBJECT_ID" \
  --headers 'Content-Type=application/json' --body "{
  \"api\": {
    \"requestedAccessTokenVersion\": 2,
    \"oauth2PermissionScopes\": [{
      \"id\": \"$SCOPE_ID\", \"value\": \"access_as_user\", \"type\": \"User\", \"isEnabled\": true,
      \"adminConsentDisplayName\": \"Use Seatline in Teams and Outlook\",
      \"adminConsentDescription\": \"Lets Teams and Outlook sign people in to Seatline.\",
      \"userConsentDisplayName\": \"Use Seatline in Teams and Outlook\",
      \"userConsentDescription\": \"Lets Teams and Outlook sign you in to Seatline.\"
    }]
  }
}"
az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$OBJECT_ID" \
  --headers 'Content-Type=application/json' --body "{
  \"api\": { \"preAuthorizedApplications\": $(echo "$CLIENTS" | python3 -c "
import json,sys; print(json.dumps([{'appId':c,'delegatedPermissionIds':['$SCOPE_ID']} for c in json.load(sys.stdin)]))") }
}"

say "2/2 Done"
echo "Download the Teams app: $WEB_URL/teams-app"
echo "Upload it in Teams → Apps → Manage your apps → Upload an app (or the Teams admin center for everyone)."
