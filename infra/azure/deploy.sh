#!/usr/bin/env bash
# Deploys main from Azure Cloud Shell: the same steps as .github/workflows/deploy.yml, for when
# GitHub can't run it (e.g. the free Actions minutes are used up). The images are built by Azure
# itself (ACR Tasks, a few cents per build), so no Docker is needed here.
#   cd ~/seatline && git pull && bash infra/azure/deploy.sh
# Settings (all optional): RG (default seatline), KEEP_WARM=true or web, ALERT_EMAIL.
set -euo pipefail
cd "$(dirname "$0")/../.."
RG=${RG:-seatline}
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

REGISTRY=$(az acr list -g "$RG" --query "[0].name" -o tsv)
[ -n "$REGISTRY" ] || { echo "No container registry in resource group $RG (run setup.sh first)."; exit 1; }
SERVER=$(az acr show -n "$REGISTRY" --query loginServer -o tsv)
SHA=$(git rev-parse HEAD)
[ -z "$(git status --porcelain)" ] || echo "⚠ This checkout has local changes; they are deployed too."
API_IMAGE="$SERVER/seatline-api:$SHA"
WEB_IMAGE="$SERVER/seatline-web:$SHA"
ENGINE_IMAGE="$SERVER/seatline-plan-engine:$SHA"

say "1/4 Building the three images in Azure (a few minutes; they build at the same time)"
build() {
  az acr build -r "$REGISTRY" -t "$1:$SHA" -f "$2" --no-logs -o none . > "/tmp/$1.log" 2>&1
}
build seatline-api apps/api/Dockerfile & api=$!
build seatline-web apps/web/Dockerfile & web=$!
build seatline-plan-engine apps/plan-engine/Dockerfile & engine=$!
failed=0
for job in "seatline-api $api" "seatline-web $web" "seatline-plan-engine $engine"; do
  set -- $job
  if wait "$2"; then
    echo "  $1 built"
  else
    failed=1
    echo "  $1 FAILED:"
    cat "/tmp/$1.log"
  fi
done
if [ "$failed" = 1 ]; then
  echo "If Azure says tasks aren't allowed for this subscription (free-credit subscriptions"
  echo "can't use ACR Tasks), deploy with GitHub instead once its minutes are back."
  exit 1
fi

say "2/4 Database migration"
az containerapp job update -n migrate -g "$RG" --image "$API_IMAGE" -o none
RUN=$(az containerapp job start -n migrate -g "$RG" --query name -o tsv)
for _ in $(seq 1 60); do
  STATUS=$(az containerapp job execution show -n migrate -g "$RG" --job-execution-name "$RUN" --query properties.status -o tsv)
  echo "  $STATUS"
  case "$STATUS" in
    Succeeded) break ;;
    Failed | Stopped | Degraded) echo "Migration failed — see the 'migrate' job's logs in Azure."; exit 1 ;;
  esac
  sleep 10
done
[ "$STATUS" = Succeeded ] || { echo "The migration timed out."; exit 1; }

say "3/4 Updating the apps"
MIN=0; WEB_MIN=0
[ "${KEEP_WARM:-}" = true ] && MIN=1 && WEB_MIN=1
[ "${KEEP_WARM:-}" = web ] && WEB_MIN=1
bash infra/azure/plan-engine.sh "$ENGINE_IMAGE"
az containerapp update -n api -g "$RG" --image "$API_IMAGE" --min-replicas "$MIN" -o none
az containerapp update -n web -g "$RG" --image "$WEB_IMAGE" --min-replicas "$WEB_MIN" -o none
az containerapp job update -n nightly-sync -g "$RG" --image "$API_IMAGE" --cron-expression "0 1,7 * * *" -o none
if [ -n "${ALERT_EMAIL:-}" ]; then
  bash infra/azure/alerts.sh || echo "⚠ Could not set up the error alert (see above)"
  bash infra/azure/uptime.sh || echo "⚠ Could not set up the uptime check (see above)"
fi

say "4/4 Checking the site answers"
URL="https://$(az containerapp show -n web -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "$URL/signin"; then
    echo "Live: $URL"
    bash infra/azure/indexnow.sh || echo "⚠ IndexNow ping failed (not important)"
    exit 0
  fi
  sleep 10
done
echo "$URL/signin did not answer."
exit 1
