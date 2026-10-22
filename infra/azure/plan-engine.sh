#!/usr/bin/env bash
# Deploys the plan engine (called by .github/workflows/deploy.yml with the new image). The first
# time it creates the container app like main.bicep does, so an existing installation gets plan
# import without running setup.sh again; then it points the API at it.
set -euo pipefail
IMAGE=${1:?usage: plan-engine.sh <image>}
RG=${RG:-seatline}
api() { az containerapp show -n api -g "$RG" --query "$1" -o tsv; }

if az containerapp show -n plan-engine -g "$RG" -o none 2>/dev/null; then
  az containerapp update -n plan-engine -g "$RG" --image "$IMAGE" -o none
else
  echo "Creating the plan engine (first deploy with plan import)"
  IDENTITY=$(api "properties.configuration.registries[0].identity")
  TOKEN=$(az containerapp secret show -n api -g "$RG" --secret-name internal-auth-secret --query value -o tsv)
  az containerapp create -n plan-engine -g "$RG" --environment "$(api properties.managedEnvironmentId)" \
    --image "$IMAGE" --user-assigned "$IDENTITY" \
    --registry-server "$(api "properties.configuration.registries[0].server")" --registry-identity "$IDENTITY" \
    --ingress internal --target-port 8000 --cpu 1.0 --memory 2.0Gi --min-replicas 0 --max-replicas 2 \
    --secrets "internal-auth-secret=$TOKEN" --env-vars "PLAN_ENGINE_TOKEN=secretref:internal-auth-secret" -o none
fi

URL="https://$(az containerapp show -n plan-engine -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
if [ "$(api "properties.template.containers[0].env[?name=='PLAN_ENGINE_URL'].value | [0]")" != "$URL" ]; then
  az containerapp update -n api -g "$RG" -o none \
    --set-env-vars "PLAN_ENGINE_URL=$URL" "PLAN_ENGINE_TOKEN=secretref:internal-auth-secret"
fi
