#!/usr/bin/env bash
# One-time Azure setup for Seatline. Run it in Azure Cloud Shell (Bash) — nothing to install:
#   git clone https://github.com/kimostrupler/seatline.git && bash seatline/infra/azure/setup.sh
# Safe to run again: existing resources and secrets are reused.
#
# Microsoft Graph permissions requested (graph-permissions.json):
#   delegated openid, profile, email, User.Read  — Sign in with Microsoft
#   application User.Read.All                     — nightly people sync (each customer's admin approves it)
set -euo pipefail

RG="${RG:-seatline}"
LOCATION="switzerlandnorth"
REPO="${REPO:-kimostrupler/seatline}"
APP_NAME="Seatline"
DEPLOY_APP_NAME="seatline-github-deploy"
HERE="$(cd "$(dirname "$0")" && pwd)"

say() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
az config set extension.use_dynamic_install=yes_without_prompt --only-show-errors >/dev/null

az account show >/dev/null 2>&1 || { echo "Please sign in first: az login"; exit 1; }
SUB=$(az account show --query id -o tsv)
TENANT=$(az account show --query tenantId -o tsv)
echo "Subscription: $(az account show --query name -o tsv) ($SUB)"

say "0/6 Switching on the Azure services Seatline uses (new subscriptions start with them off)"
for ns in Microsoft.App Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL Microsoft.KeyVault \
  Microsoft.ManagedIdentity Microsoft.OperationalInsights Microsoft.Storage; do
  az provider register --namespace "$ns" -o none
done
for ns in Microsoft.App Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL Microsoft.KeyVault \
  Microsoft.ManagedIdentity Microsoft.OperationalInsights Microsoft.Storage; do
  for _ in $(seq 1 60); do
    [ "$(az provider show --namespace "$ns" --query registrationState -o tsv)" = "Registered" ] && break
    sleep 5
  done
  echo "  $ns: $(az provider show --namespace "$ns" --query registrationState -o tsv)"
done

say "1/6 Resource group '$RG' in $LOCATION"
az group create -n "$RG" -l "$LOCATION" -o none

say "2/6 Secrets (kept in a Key Vault, generated once)"
KV="seatline-$(printf '%s' "$SUB$RG" | sha256sum | cut -c1-10)"
if ! az keyvault show -n "$KV" >/dev/null 2>&1; then
  az keyvault create -n "$KV" -g "$RG" -l "$LOCATION" --enable-rbac-authorization false -o none
fi
# letters and digits only (safe in connection strings), always with upper, lower and digit
new_password() { printf '%sAa1' "$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 36)"; }
secret() {
  local name="$1" value
  value=$(az keyvault secret show --vault-name "$KV" -n "$name" --query value -o tsv 2>/dev/null || true)
  if [ -z "$value" ]; then
    value="${2:-$(new_password)}"
    az keyvault secret set --vault-name "$KV" -n "$name" --value "$value" -o none
  fi
  printf '%s' "$value"
}
PG_PASSWORD=$(secret pg-admin-password)
APP_DB_PASSWORD=$(secret app-db-password)
SESSION_SECRET=$(secret session-secret)
INTERNAL_SECRET=$(secret internal-auth-secret)

say "3/6 Microsoft Entra app '$APP_NAME' (Sign in with Microsoft, any organisation)"
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
if [ -z "$APP_ID" ]; then
  APP_ID=$(az ad app create --display-name "$APP_NAME" --sign-in-audience AzureADMultipleOrgs \
    --required-resource-accesses @"$HERE/graph-permissions.json" --query appId -o tsv)
fi
az ad sp show --id "$APP_ID" >/dev/null 2>&1 || az ad sp create --id "$APP_ID" -o none
ENTRA_SECRET=$(az keyvault secret show --vault-name "$KV" -n entra-client-secret --query value -o tsv 2>/dev/null || true)
if [ -z "$ENTRA_SECRET" ]; then
  ENTRA_SECRET=$(az ad app credential reset --id "$APP_ID" --display-name seatline --years 2 --append --query password -o tsv)
  az keyvault secret set --vault-name "$KV" -n entra-client-secret --value "$ENTRA_SECRET" -o none
fi

say "4/6 Azure resources: database, storage, containers (first run takes ~10 minutes)"
current_image() { az "$@" -g "$RG" --query "properties.template.containers[0].image" -o tsv 2>/dev/null || true; }
API_IMAGE=$(current_image containerapp show -n api)
WEB_IMAGE=$(current_image containerapp show -n web)
PLACEHOLDER="mcr.microsoft.com/k8se/quickstart:latest"
az deployment group create -g "$RG" -n seatline -f "$HERE/main.bicep" -o none --parameters \
  location="$LOCATION" \
  apiImage="${API_IMAGE:-$PLACEHOLDER}" webImage="${WEB_IMAGE:-$PLACEHOLDER}" \
  pgAdminPassword="$PG_PASSWORD" appDbPassword="$APP_DB_PASSWORD" \
  sessionSecret="$SESSION_SECRET" internalAuthSecret="$INTERNAL_SECRET" \
  entraClientId="$APP_ID" entraClientSecret="$ENTRA_SECRET"
output() { az deployment group show -g "$RG" -n seatline --query "properties.outputs.$1.value" -o tsv; }
WEB_URL=$(output webUrl)
REGISTRY=$(output registryName)

say "5/6 Sign-in return addresses for $WEB_URL"
az ad app update --id "$APP_ID" --web-redirect-uris "$WEB_URL/auth/callback" "$WEB_URL/people"

say "6/6 Deploy access for GitHub ($REPO, branch main) — no passwords (OpenID Connect)"
DEPLOY_ID=$(az ad app list --display-name "$DEPLOY_APP_NAME" --query "[0].appId" -o tsv)
[ -n "$DEPLOY_ID" ] || DEPLOY_ID=$(az ad app create --display-name "$DEPLOY_APP_NAME" --query appId -o tsv)
az ad sp show --id "$DEPLOY_ID" >/dev/null 2>&1 || az ad sp create --id "$DEPLOY_ID" -o none
if [ -z "$(az ad app federated-credential list --id "$DEPLOY_ID" --query "[?name=='main'].name" -o tsv)" ]; then
  az ad app federated-credential create --id "$DEPLOY_ID" -o none --parameters "{
    \"name\": \"main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$REPO:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"
fi
DEPLOY_SP=$(az ad sp show --id "$DEPLOY_ID" --query id -o tsv)
assign() {
  az role assignment create --assignee-object-id "$DEPLOY_SP" --assignee-principal-type ServicePrincipal \
    --role "$1" --scope "$2" -o none 2>/dev/null || true
}
assign Contributor "/subscriptions/$SUB/resourceGroups/$RG"
assign AcrPush "$(az acr show -n "$REGISTRY" --query id -o tsv)"

cat <<DONE

✅ Azure is ready. Seatline will live at:  $WEB_URL

Last step — tell GitHub where to deploy. On GitHub open
  https://github.com/$REPO/settings/variables/actions
and add these 5 "Repository variables" (they are not secret):

  AZURE_CLIENT_ID        $DEPLOY_ID
  AZURE_TENANT_ID        $TENANT
  AZURE_SUBSCRIPTION_ID  $SUB
  AZURE_RESOURCE_GROUP   $RG
  AZURE_REGISTRY         $REGISTRY

Then open https://github.com/$REPO/actions/workflows/deploy.yml and press "Run workflow".
After that, every merge to main deploys automatically.

When it's done (~10 minutes): open $WEB_URL, sign in with your Microsoft account and create
your workspace. To let Seatline sync people, a Microsoft 365 admin of your organisation clicks
"Approve in Microsoft" on the People & access page once.
DONE
