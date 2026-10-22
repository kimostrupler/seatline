#!/usr/bin/env bash
# Uptime check: Azure pings the app's /healthz every 15 minutes (rarely enough that the apps
# can still sleep in between — no extra cost) from Zurich, retrying once, and e-mails
# ALERT_EMAIL when it doesn't answer. Results stay in Switzerland North.
# Safe to run again; the deploy workflow runs it when the GitHub variable ALERT_EMAIL is set.
set -euo pipefail
: "${RG:?set RG to the resource group}"
: "${ALERT_EMAIL:?set ALERT_EMAIL}"
az config set extension.use_dynamic_install=yes_without_prompt --only-show-errors >/dev/null
# Application Insights needs this service switched on (setup.sh does; older setups may not)
az provider register --namespace Microsoft.Insights -o none 2>/dev/null || true

WORKSPACE=$(az monitor log-analytics workspace list -g "$RG" --query "[0].id" -o tsv)
LOCATION=$(az monitor log-analytics workspace list -g "$RG" --query "[0].location" -o tsv)
URL=$(az containerapp show -n web -g "$RG" --query "properties.template.containers[0].env[?name=='APP_URL'].value | [0]" -o tsv)
[ -n "$URL" ] || URL="https://$(az containerapp show -n web -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

az monitor app-insights component create -a seatline-uptime -g "$RG" -l "$LOCATION" \
  --workspace "$WORKSPACE" --kind web --application-type web -o none
INSIGHTS=$(az monitor app-insights component show -a seatline-uptime -g "$RG" --query id -o tsv)

az monitor app-insights web-test create -n seatline-uptime -g "$RG" -l "$LOCATION" \
  --defined-web-test-name seatline-uptime --web-test-kind standard --enabled true \
  --frequency 900 --timeout 60 --retry-enabled true \
  --locations Id=emea-ch-zrh-edge \
  --http-verb GET --request-url "$URL/healthz" --expected-status-code 200 \
  --tags "hidden-link:$INSIGHTS=Resource" -o none

az monitor action-group create -g "$RG" -n seatline-alerts --short-name seatline \
  --action email owner "$ALERT_EMAIL" -o none
az monitor metrics alert create -g "$RG" -n seatline-down \
  --scopes "$INSIGHTS" \
  --condition "avg availabilityResults/availabilityPercentage < 100" \
  --window-size 30m --evaluation-frequency 15m --severity 1 \
  --description "Seatline did not answer at $URL/healthz." \
  --action "$(az monitor action-group show -g "$RG" -n seatline-alerts --query id -o tsv)" -o none 2>/dev/null \
  || az monitor metrics alert update -g "$RG" -n seatline-down --enabled true -o none

echo "Uptime check: $URL/healthz every 15 minutes; e-mails go to $ALERT_EMAIL."
