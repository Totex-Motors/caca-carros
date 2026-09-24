#!/usr/bin/env bash
# Grava a chave da OpenAI em deploy/.env sem exibi-la na tela e reinicia o servidor.
# Uso (como root, na VPS): bash /opt/caca-carros/deploy/set-openai-key.sh

set -euo pipefail

APP_DIR="/opt/caca-carros"
ENV_FILE="$APP_DIR/deploy/.env"
COMPOSE="docker compose -f $APP_DIR/deploy/docker-compose.vps.yml --env-file $ENV_FILE"

[ -f "$ENV_FILE" ] || { echo "Instale o app primeiro (deploy/install.sh)." >&2; exit 1; }

read -rsp "Cole a chave da OpenAI (sk-...) e aperte Enter: " KEY </dev/tty; echo
case "$KEY" in
  sk-*) ;;
  *) echo "Isso nao parece uma chave da OpenAI (deve comecar com sk-)." >&2; exit 1 ;;
esac

grep -v -e '^OPENAI_API_KEY=' "$ENV_FILE" > "$ENV_FILE.tmp"
printf 'OPENAI_API_KEY=%s\n' "$KEY" >> "$ENV_FILE.tmp"
grep -q '^OPENAI_MODEL=' "$ENV_FILE.tmp" || printf 'OPENAI_MODEL=gpt-5.5\n' >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "Testando a chave..."
MODEL=$(grep '^OPENAI_MODEL=' "$ENV_FILE" | cut -d= -f2-)
STATUS=$(curl -s -o /dev/null -w '%{http_code}' https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ok\"}],\"max_completion_tokens\":16}")
case "$STATUS" in
  200) echo "Chave OK para o modelo $MODEL." ;;
  401) echo "A OpenAI recusou a chave (401). Confira se copiou a chave inteira." >&2 ;;
  403|404) echo "A chave nao tem acesso ao modelo $MODEL (HTTP $STATUS). Libere o modelo no projeto da OpenAI." >&2 ;;
  *) echo "Resposta inesperada da OpenAI (HTTP $STATUS). A chave foi gravada mesmo assim." >&2 ;;
esac

echo "Reiniciando o servidor..."
$COMPOSE up -d backend
echo "Pronto."
