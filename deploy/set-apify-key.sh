#!/usr/bin/env bash
# Grava o token da Apify e o Actor de busca em deploy/.env sem exibir o token na tela, e reinicia o servidor.
# Uso (como root, na VPS): bash /opt/caca-carros/deploy/set-apify-key.sh

set -euo pipefail

APP_DIR="/opt/caca-carros"
ENV_FILE="$APP_DIR/deploy/.env"
COMPOSE="docker compose -f $APP_DIR/deploy/docker-compose.vps.yml --env-file $ENV_FILE"

[ -f "$ENV_FILE" ] || { echo "Instale o app primeiro (deploy/install.sh)." >&2; exit 1; }

read -rsp "Cole o token da Apify (apify_api_...) e aperte Enter: " TOKEN </dev/tty; echo
TOKEN=$(printf '%s' "$TOKEN" | tr -d '[:space:]')
echo "Recebido: ${TOKEN:0:12}...${TOKEN: -4} (${#TOKEN} caracteres)"
if [ "${#TOKEN}" -lt 20 ]; then
  echo "O token parece incompleto: a colagem pode ter cortado. Tente de novo." >&2
  exit 1
fi

echo "Testando o token..."
ME=$(curl -s -w '\n%{http_code}' https://api.apify.com/v2/users/me -H "Authorization: Bearer $TOKEN")
STATUS=$(printf '%s' "$ME" | tail -n1)
if [ "$STATUS" != "200" ]; then
  echo "A Apify recusou o token (HTTP $STATUS). Copie de novo em Console > Settings > API & Integrations." >&2
  echo "Nada foi alterado." >&2
  exit 1
fi
USERNAME=$(printf '%s' "$ME" | head -n -1 | grep -o '"username":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Token OK (conta: ${USERNAME:-?})."

DEFAULT_ACTOR="${USERNAME:-usuario}/caca-carros-scraper"
read -rp "Actor de busca [$DEFAULT_ACTOR]: " ACTOR </dev/tty
ACTOR=$(printf '%s' "${ACTOR:-$DEFAULT_ACTOR}" | tr -d '[:space:]')
ACTOR_PATH=$(printf '%s' "$ACTOR" | sed 's#/#~#')
ACT_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "https://api.apify.com/v2/acts/$ACTOR_PATH" -H "Authorization: Bearer $TOKEN")
if [ "$ACT_STATUS" != "200" ]; then
  echo "Nao achei o Actor \"$ACTOR\" nesta conta (HTTP $ACT_STATUS). Confira o nome em Console > Actors." >&2
  echo "Nada foi alterado." >&2
  exit 1
fi
echo "Actor OK: $ACTOR"

grep -v -e '^APIFY_TOKEN=' -e '^APIFY_SCRAPER_ACTOR_ID=' -e '^EXTERNAL_SEARCH_ENABLED=' "$ENV_FILE" > "$ENV_FILE.tmp"
{
  printf 'APIFY_TOKEN=%s\n' "$TOKEN"
  printf 'APIFY_SCRAPER_ACTOR_ID=%s\n' "$ACTOR"
  printf 'EXTERNAL_SEARCH_ENABLED=true\n'
} >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "Reiniciando o servidor..."
$COMPOSE up -d backend
echo "Pronto. Cadastre (ou busque de novo) um carro no site para testar."
