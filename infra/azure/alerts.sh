#!/usr/bin/env bash
# E-mails ALERT_EMAIL when the apps log errors (API errors, server errors, browser errors
# reported to /client-errors, failed nightly syncs). Safe to run again; the deploy workflow
# runs it when the GitHub variable ALERT_EMAIL is set.
# Logs and alerts stay in Azure Switzerland North (the Log Analytics workspace of the app).
set -euo pipefail
: "${RG:?set RG to the resource group}"
: "${ALERT_EMAIL:?set ALERT_EMAIL}"

WORKSPACE=$(az monitor log-analytics workspace list -g "$RG" --query "[0].id" -o tsv)
LOCATION=$(az monitor log-analytics workspace list -g "$RG" --query "[0].location" -o tsv)

az monitor action-group create -g "$RG" -n seatline-alerts --short-name seatline \
  --action email owner "$ALERT_EMAIL" -o none
GROUP=$(az monitor action-group show -g "$RG" -n seatline-alerts --query id -o tsv)

# Nest logs "ERROR [Context] …"; Next.js prints server errors to stderr; browser errors come
# in as "ERROR [client-error] …". Warnings on stderr are ignored.
QUERY="ContainerAppConsoleLogs_CL
| extend app = coalesce(column_ifexists('ContainerAppName_s', ''), column_ifexists('ContainerJobName_s', ''))
| where app in ('api', 'web', 'nightly-sync', 'migrate')
| where Log_s has 'ERROR' or (app == 'web' and Stream_s == 'stderr' and Log_s !has 'warn')"

az monitor scheduled-query create -g "$RG" -n seatline-errors --location "$LOCATION" \
  --scopes "$WORKSPACE" \
  --description "Seatline logged errors in the last 15 minutes. Open Log Analytics → Logs to see them." \
  --condition "count 'Errors' > 0" --condition-query Errors="$QUERY" \
  --evaluation-frequency 15m --window-size 15m --severity 2 \
  --mute-actions-duration PT1H \
  --action-groups "$GROUP" -o none

echo "Error alerts go to $ALERT_EMAIL (at most one e-mail per hour)."
