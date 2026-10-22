#!/usr/bin/env bash
# Tells Bing and the other IndexNow search engines about the website's pages (run by deploy.yml
# after a release). The pages come from the live sitemap; the key is served at /indexnow.txt.
set -euo pipefail
RG=${RG:-seatline}
APP_URL=$(az containerapp show -n web -g "$RG" --query "properties.template.containers[0].env[?name=='APP_URL'].value | [0]" -o tsv)
HOST=$(printf '%s' "$APP_URL" | sed -E 's#^https?://##; s#[:/].*$##')
# the website lives on the app's parent domain (app.seatline.ch → seatline.ch)
if [ "$(printf '%s' "$HOST" | tr -cd . | wc -c)" -ne 2 ]; then
  echo "No website domain for $HOST — nothing to tell"
  exit 0
fi
SITE=${HOST#*.}
KEY=$(curl -fsS "https://$SITE/indexnow.txt")
URLS=$(curl -fsS "https://$SITE/sitemap.xml" | grep -o '<loc>[^<]*' | sed 's/<loc>//' | jq -R . | jq -s .)
echo "Telling IndexNow about $(jq length <<<"$URLS") pages on $SITE"
jq -n --arg host "$SITE" --arg key "$KEY" --arg loc "https://$SITE/indexnow.txt" --argjson urls "$URLS" \
  '{host: $host, key: $key, keyLocation: $loc, urlList: $urls}' |
  curl -fsS -X POST https://api.indexnow.org/indexnow \
    -H 'content-type: application/json; charset=utf-8' --data-binary @- -o /dev/null -w 'IndexNow: HTTP %{http_code}\n'
