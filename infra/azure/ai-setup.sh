#!/usr/bin/env bash
# Switches on AI reading of room names in scanned plans:  bash ai-setup.sh
# Run in Azure Cloud Shell after setup.sh. Safe to run again. Creates an Azure OpenAI resource in
# Switzerland North with a regional ("Standard") deployment, so plans are processed in
# Switzerland. No keys: the plan engine signs in with the apps' managed identity.
# Cost: pay per use, about 1 Rappen per scanned plan.
set -euo pipefail
RG=${RG:-seatline}
LOCATION=switzerlandnorth
DEPLOYMENT=plans
# first one that Azure offers in Switzerland North as a regional deployment
MODELS=${MODELS:-"gpt-4.1-mini gpt-4o-mini gpt-4.1 gpt-4o"}
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

SUB=$(az account show --query id -o tsv)
NAME="seatline-ai-$(printf '%s' "$SUB$RG" | sha256sum | cut -c1-8)"

say "1/4 Azure OpenAI resource '$NAME' in $LOCATION"
az provider register --namespace Microsoft.CognitiveServices -o none
if ! az cognitiveservices account show -n "$NAME" -g "$RG" -o none 2>/dev/null; then
  az cognitiveservices account create -n "$NAME" -g "$RG" -l "$LOCATION" --kind OpenAI --sku S0 \
    --custom-domain "$NAME" --yes -o none
fi
# no API keys: only Microsoft Entra sign-in (the managed identity) works
az resource update -g "$RG" -n "$NAME" --resource-type Microsoft.CognitiveServices/accounts \
  --set properties.disableLocalAuth=true -o none
ENDPOINT=$(az cognitiveservices account show -n "$NAME" -g "$RG" --query properties.endpoint -o tsv)

say "2/4 Model (regional, data stays in Switzerland)"
deployed() { az cognitiveservices account deployment show -n "$NAME" -g "$RG" --deployment-name "$DEPLOYMENT" -o none 2>/dev/null; }
if ! deployed; then
  # new subscriptions often have no regional quota for some models: try each, smallest capacity last
  for m in $MODELS; do
    VERSION=$(az cognitiveservices account list-models -n "$NAME" -g "$RG" \
      --query "[?name=='$m' && skus[?name=='Standard']].version | [-1]" -o tsv 2>/dev/null || true)
    [ -n "$VERSION" ] || { echo "  $m: not offered here"; continue; }
    for capacity in 10 1; do
      if az cognitiveservices account deployment create -n "$NAME" -g "$RG" --deployment-name "$DEPLOYMENT" \
        --model-name "$m" --model-version "$VERSION" --model-format OpenAI \
        --sku-name Standard --sku-capacity "$capacity" -o none 2>/dev/null; then
        echo "  $m ($VERSION), $capacity k tokens/minute"
        break 2
      fi
    done
    echo "  $m: no quota yet in $LOCATION"
  done
  if ! deployed; then
    cat <<HELP

Azure gives this subscription no quota yet for these models in Switzerland North
(regional "Standard" deployments, so the data stays in Switzerland). Ask for some:
  Azure portal → search "Quotas" → Azure OpenAI / Azure AI Foundry → region Switzerland North
  → "gpt-4.1-mini" (or "gpt-4o-mini"), deployment type Standard → Request quota increase
  (10 k tokens per minute is plenty). Then run this script again.
Seatline works meanwhile: scans are imported without room names.
HELP
    exit 1
  fi
fi

say "3/4 Allow the plan engine to use it (managed identity, no keys)"
IDENTITY=$(az containerapp show -n plan-engine -g "$RG" --query "keys(identity.userAssignedIdentities)[0]" -o tsv)
PRINCIPAL=$(az identity show --ids "$IDENTITY" --query principalId -o tsv)
CLIENT=$(az identity show --ids "$IDENTITY" --query clientId -o tsv)
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Cognitive Services OpenAI User" \
  --scope "$(az cognitiveservices account show -n "$NAME" -g "$RG" --query id -o tsv)" -o none 2>/dev/null || true

say "4/4 Telling the plan engine"
az containerapp update -n plan-engine -g "$RG" -o none --set-env-vars \
  "AZURE_OPENAI_ENDPOINT=$ENDPOINT" "AZURE_OPENAI_DEPLOYMENT=$DEPLOYMENT" "AZURE_CLIENT_ID=$CLIENT"

say "✅ AI room names are on. Scanned plans are read in Switzerland ($LOCATION)."
echo "(The role can take a few minutes to apply; until then imports just skip the names.)"
