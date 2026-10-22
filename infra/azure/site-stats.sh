#!/usr/bin/env bash
# Website statistics for the last DAYS days (default 30): page views per day, the most
# visited pages, where visitors came from, phone vs computer, clicks on "Try it free" / "Try
# the demo", and demos and workspaces opened. Run in Azure Cloud Shell:  bash site-stats.sh
# Counted without cookies or IP addresses (apps/web/lib/site-stats.ts); data stays in Switzerland.
set -euo pipefail
RG=${RG:-seatline}
DAYS=${DAYS:-30}
az config set extension.use_dynamic_install=yes_without_prompt --only-show-errors >/dev/null
WS=$(az monitor log-analytics workspace list -g "$RG" --query "[0].customerId" -o tsv)

VISITS="ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(${DAYS}d) and ContainerAppName_s == 'web' and Log_s has '[site-visit]'
| extend v = parse_json(extract(@'\[site-visit\] (\{.*\})', 1, Log_s))
| extend event = tostring(v.event), path = tostring(v.path), ref = tostring(v.ref),
  source = tostring(v.source), lang = tostring(v.lang), device = tostring(v.device)"

q() {
  printf '\n\033[1m%s\033[0m\n' "$1"
  az monitor log-analytics query -w "$WS" --analytics-query "$2" -o table 2>/dev/null \
    | grep -v -e '^TableName' -e '^-*$' | sed 's/PrimaryResult//' || echo "  (no data yet)"
}

q "Page views per day" "$VISITS | where event == 'view' | summarize views = count() by day = format_datetime(startofday(TimeGenerated), 'yyyy-MM-dd') | order by day asc"
q "Pages" "$VISITS | where event == 'view' | summarize views = count() by path | order by views desc"
q "Came from" "$VISITS | where event == 'view' | summarize views = count() by ref, source | order by views desc | take 15"
q "Phone or computer · language" "$VISITS | where event == 'view' | summarize views = count() by device, lang | order by views desc"
q "Button clicks" "$VISITS | where event startswith 'cta' | summarize clicks = count() by event"
q "Demos and new workspaces" "ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(${DAYS}d) and ContainerAppName_s == 'api'
| where Log_s has 'Demo workspace' or Log_s has 'New workspace'
| summarize count() by what = iff(Log_s has 'Demo', 'demos opened', 'workspaces created')"
