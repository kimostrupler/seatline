#!/usr/bin/env bash
# Proves the database backups work: restores the database as it was an hour ago into a
# temporary server, checks it, then deletes the temporary server again (~15–25 minutes, a few
# Rappen). Run it in Azure Cloud Shell — or let GitHub run it every month (restore-test.yml).
#   bash restore-test.sh
# Everything stays in Switzerland North. Nothing touches the live database.
set -euo pipefail
RG=${RG:-seatline}
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
az config set extension.use_dynamic_install=yes_without_prompt --only-show-errors >/dev/null

SERVER=$(az postgres flexible-server list -g "$RG" --query "[?!contains(name, 'restore')].name | [0]" -o tsv)
[ -n "$SERVER" ] || { echo "No database server in $RG"; exit 1; }
TEST="${SERVER}-restore-$(date +%m%d%H%M)"
# delete the temporary server whatever happens
cleanup() { az postgres flexible-server delete -g "$RG" -n "$TEST" --yes -o none 2>/dev/null || true; }
trap cleanup EXIT

say "1/3 Restoring $SERVER as it was an hour ago → $TEST"
az postgres flexible-server restore -g "$RG" -n "$TEST" --source-server "$SERVER" \
  --restore-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" -o none

say "2/3 Checking the restored copy"
STATE=$(az postgres flexible-server show -g "$RG" -n "$TEST" --query state -o tsv)
echo "  server state: $STATE"
[ "$STATE" = "Ready" ] || { echo "::error::The restored server is not ready ($STATE)"; exit 1; }
az postgres flexible-server db show -g "$RG" -s "$TEST" -d seatline -o none \
  || { echo "::error::The restored server has no 'seatline' database"; exit 1; }
echo "  database 'seatline' is there"

# With the admin password (Key Vault, readable in Cloud Shell) also count what's inside.
SUB=$(az account show --query id -o tsv)
KV="seatline-$(printf '%s' "$SUB$RG" | sha256sum | cut -c1-10)"
if PASSWORD=$(az keyvault secret show --vault-name "$KV" -n pg-admin-password --query value -o tsv 2>/dev/null) \
  && command -v psql >/dev/null; then
  HOST=$(az postgres flexible-server show -g "$RG" -n "$TEST" --query fullyQualifiedDomainName -o tsv)
  # the restored server allows Azure services like the original; add this machine just in case
  IP=$(curl -fsS https://api.ipify.org || true)
  [ -n "$IP" ] && az postgres flexible-server firewall-rule create -g "$RG" -n "$TEST" \
    --rule-name restore-test --start-ip-address "$IP" --end-ip-address "$IP" -o none || true
  PGPASSWORD="$PASSWORD" psql "host=$HOST dbname=seatline user=seatlineadmin sslmode=require" -At -c \
    "SELECT 'workspaces: ' || count(*) FROM tenants UNION ALL
     SELECT 'people: ' || count(*) FROM people UNION ALL
     SELECT 'seat history rows: ' || count(*) FROM seat_assignments" \
    | sed 's/^/  /' || echo "  (could not connect to count rows — the restore itself worked)"
else
  echo "  (no access to the Key Vault password here: counted nothing, the restore itself worked)"
fi

say "3/3 Deleting the temporary server"
cleanup
trap - EXIT
echo "✅ Backups work: the database could be restored."
